(function () {
  'use strict';

  var MEAL_API = 'https://www.themealdb.com/api/json/v1/1/random.php';
  var TRANS_API = 'https://api.mymemory.translated.net/get';
  var TRANS_LIMIT = 450;

  var listEl = document.getElementById('recipes-list');
  var loadingEl = document.getElementById('recipes-loading');
  var errorEl = document.getElementById('recipes-error');
  var btnGenerate = document.getElementById('btn-generate');
  var modalEl = document.getElementById('recipe-modal');
  var modalBackdrop = modalEl.querySelector('.recipe-modal-backdrop');
  var modalClose = document.getElementById('recipe-modal-close');
  var modalLoading = document.getElementById('recipe-modal-loading');
  var modalBody = document.getElementById('recipe-modal-content');
  var modalImg = document.getElementById('recipe-modal-image');
  var modalTitle = document.getElementById('recipe-modal-title');
  var modalMeta = document.getElementById('recipe-modal-meta');
  var modalIngredients = document.getElementById('recipe-modal-ingredients');
  var modalInstructions = document.getElementById('recipe-modal-instructions');

  var meals = [];
  var modalOpen = false;
  var loadToken = 0;

  function show(el, visible) {
    el.classList.toggle('hidden', !visible);
  }

  function ingredients(meal) {
    var out = [];
    for (var i = 1; i <= 20; i++) {
      var name = meal['strIngredient' + i];
      if (!name || !name.trim()) continue;
      var amount = (meal['strMeasure' + i] || '').trim();
      out.push(amount ? amount + ' ' + name.trim() : name.trim());
    }
    return out;
  }

  function splitText(text, max) {
    max = max || TRANS_LIMIT;
    if (!text || text.length <= max) return [text || ''];

    var parts = [];
    var rest = text.trim();

    while (rest.length > max) {
      var slice = rest.slice(0, max);
      var at = slice.lastIndexOf('\n\n');
      if (at < 80) at = slice.lastIndexOf('\n');
      if (at < 80) at = slice.lastIndexOf('. ');
      if (at < 80) at = slice.lastIndexOf(' ');
      if (at < 40) at = max;

      var chunk = rest.slice(0, at).trim();
      if (!chunk) {
        chunk = rest.slice(0, max);
        at = max;
      } else if (rest.slice(at, at + 2) === '. ') {
        at += 2;
      } else if (rest[at] === '\n' || rest[at] === ' ') {
        at += 1;
      }

      parts.push(chunk);
      rest = rest.slice(at).trim();
    }

    if (rest) parts.push(rest);
    return parts;
  }

  function badTranslation(text) {
    return /QUERY LENGTH LIMIT EXCEEDED|MAX ALLOWED QUERY/i.test(text);
  }

  function translateOne(text) {
    if (!text) return Promise.resolve('');
    return fetch(TRANS_API + '?q=' + encodeURIComponent(text) + '&langpair=en|de')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var out = data.responseData && data.responseData.translatedText;
        if (!out || badTranslation(out)) return text;
        return out;
      })
      .catch(function () { return text; });
  }

  function translateText(text) {
    var chunks = splitText(text);
    return chunks.reduce(function (chain, chunk) {
      return chain.then(function (result) {
        return translateOne(chunk).then(function (part) {
          return result ? result + '\n\n' + part : part;
        });
      });
    }, Promise.resolve(''));
  }

  function translateList(items) {
    if (!items.length) return Promise.resolve([]);

    var groups = [];
    var group = [];
    var len = 0;

    items.forEach(function (item) {
      var next = len + item.length + (group.length ? 1 : 0);
      if (group.length && next > TRANS_LIMIT) {
        groups.push(group);
        group = [item];
        len = item.length;
      } else {
        group.push(item);
        len = next;
      }
    });
    if (group.length) groups.push(group);

    return groups.reduce(function (chain, batch) {
      return chain.then(function (acc) {
        return translateOne(batch.join('\n')).then(function (text) {
          if (badTranslation(text)) return acc.concat(batch);
          return acc.concat(text.split('\n').map(function (s) { return s.trim(); }).filter(Boolean));
        });
      });
    }, Promise.resolve([]));
  }

  function fetchMeal() {
    return fetch(MEAL_API)
      .then(function (res) {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then(function (data) {
        return (data.meals && data.meals[0]) || null;
      });
  }

  function renderList(items) {
    meals = items;
    listEl.innerHTML = '';
    errorEl.textContent = '';
    show(errorEl, false);

    items.forEach(function (meal, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recipe-item';
      btn.textContent = meal.displayTitle || meal.strMeal;
      btn.addEventListener('click', function () {
        openRecipe(index);
      });
      listEl.appendChild(btn);
    });
  }

  function fillModal(meal, isLoading) {
    var title = meal.displayTitle || meal.strMeal;

    modalTitle.textContent = title;
    modalMeta.textContent = [meal.strCategory, meal.strArea].filter(Boolean).join(' · ');

    if (meal.strMealThumb) {
      modalImg.src = meal.strMealThumb;
      modalImg.alt = title;
      show(modalImg, true);
    } else {
      show(modalImg, false);
    }

    show(modalLoading, isLoading);
    show(modalBody, !isLoading);

    if (isLoading) return;

    modalIngredients.innerHTML = '';
    (meal.displayIngredients || ingredients(meal)).forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      modalIngredients.appendChild(li);
    });

    modalInstructions.textContent = meal.displayInstructions || meal.strInstructions || '';
  }

  function loadDetails(meal) {
    if (meal.displayIngredients && meal.displayInstructions) {
      return Promise.resolve(meal);
    }

    return Promise.all([
      meal.displayIngredients ? meal.displayIngredients : translateList(ingredients(meal)),
      meal.displayInstructions ? meal.displayInstructions : translateText(meal.strInstructions || '')
    ]).then(function (parts) {
      meal.displayIngredients = parts[0];
      meal.displayInstructions = parts[1];
      return meal;
    });
  }

  function openRecipe(index) {
    var meal = meals[index];
    if (!meal) return;

    var token = ++loadToken;
    modalOpen = true;

    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    fillModal(meal, true);
    modalClose.focus();

    loadDetails(meal).then(function (ready) {
      if (!modalOpen || token !== loadToken) return;
      fillModal(ready, false);
    });
  }

  function closeRecipe() {
    loadToken++;
    modalOpen = false;
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function generate() {
    closeRecipe();
    show(loadingEl, true);
    show(listEl, false);
    errorEl.textContent = '';
    show(errorEl, false);

    Promise.all(Array.from({ length: 7 }, fetchMeal))
      .then(function (results) {
        var picked = results.filter(Boolean);
        if (!picked.length) throw new Error('empty');

        return Promise.all(picked.map(function (meal) {
          return translateOne(meal.strMeal).then(function (title) {
            meal.displayTitle = title;
            return meal;
          });
        }));
      })
      .then(function (translated) {
        renderList(translated);
      })
      .catch(function () {
        errorEl.textContent = 'Fehler. Bitte erneut versuchen.';
        show(errorEl, true);
      })
      .then(function () {
        show(loadingEl, false);
        show(listEl, true);
      });
  }

  btnGenerate.addEventListener('click', generate);
  modalClose.addEventListener('click', closeRecipe);
  modalBackdrop.addEventListener('click', closeRecipe);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalOpen) closeRecipe();
  });
})();
