(function () {
  'use strict';

  var MEAL_API = 'https://www.themealdb.com/api/json/v1/1/random.php';
  var TRANS_API = 'https://api.mymemory.translated.net/get';
  var THEME_KEY = '7rezepte-theme';

  var listEl = document.getElementById('recipes-list');
  var loadingEl = document.getElementById('recipes-loading');
  var errorEl = document.getElementById('recipes-error');
  var btnGen = document.getElementById('btn-generate');
  var themeBtn = document.getElementById('theme-toggle');
  var modalEl = document.getElementById('recipe-modal');
  var modalBackdrop = modalEl && modalEl.querySelector('.recipe-modal-backdrop');
  var modalCloseBtn = document.getElementById('recipe-modal-close');
  var modalLoadingEl = document.getElementById('recipe-modal-loading');
  var modalContentEl = document.getElementById('recipe-modal-content');
  var modalImageEl = document.getElementById('recipe-modal-image');
  var modalTitleEl = document.getElementById('recipe-modal-title');
  var modalMetaEl = document.getElementById('recipe-modal-meta');
  var modalIngredientsEl = document.getElementById('recipe-modal-ingredients');
  var modalInstructionsEl = document.getElementById('recipe-modal-instructions');

  var currentMeals = [];
  var modalOpen = false;
  var modalRequestId = 0;

  function loadTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      document.body.setAttribute('data-theme', saved === 'terminal' ? 'terminal' : 'neomorph');
    } catch (e) {}
  }

  function saveTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function cycleTheme() {
    var cur = document.body.getAttribute('data-theme') || 'neomorph';
    saveTheme(cur === 'neomorph' ? 'terminal' : 'neomorph');
  }

  function showLoading(on) {
    loadingEl.classList.toggle('hidden', !on);
    listEl.classList.toggle('hidden', on);
  }

  function showError(msg) {
    errorEl.textContent = msg || '';
    errorEl.classList.toggle('hidden', !msg);
  }

  function getIngredients(meal) {
    var items = [];
    var i;
    for (i = 1; i <= 20; i++) {
      var ing = meal['strIngredient' + i];
      if (ing && ing.trim()) {
        var measure = meal['strMeasure' + i] || '';
        items.push((measure.trim() ? measure.trim() + ' ' : '') + ing.trim());
      }
    }
    return items;
  }

  function buildMeta(meal) {
    var parts = [];
    if (meal.strCategory) parts.push(meal.strCategory);
    if (meal.strArea) parts.push(meal.strArea);
    return parts.join(' · ');
  }

  function draw(meals) {
    currentMeals = meals || [];
    listEl.innerHTML = '';
    showError('');
    currentMeals.forEach(function (m, index) {
      var title = (m && m.displayTitle) || (m && m.strMeal) || '—';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recipe-item';
      btn.setAttribute('role', 'listitem');
      btn.textContent = title;
      btn.addEventListener('click', function () {
        openRecipe(index);
      });
      listEl.appendChild(btn);
    });
  }

  function translate(text) {
    if (!text || typeof text !== 'string') return Promise.resolve(text || '—');
    return fetch(TRANS_API + '?q=' + encodeURIComponent(text) + '&langpair=en|de')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var t = d && d.responseData && d.responseData.translatedText;
        return t || text;
      })
      .catch(function () { return text; });
  }

  function translateLines(lines) {
    if (!lines || !lines.length) return Promise.resolve([]);
    return translate(lines.join('\n')).then(function (text) {
      return text.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);
    });
  }

  function setModalLoading(on) {
    modalLoadingEl.classList.toggle('hidden', !on);
    modalContentEl.classList.toggle('hidden', on);
  }

  function renderRecipeDetails(meal) {
    var title = meal.displayTitle || meal.strMeal || '—';
    var ingredients = meal.displayIngredients || getIngredients(meal);
    var instructions = meal.displayInstructions || meal.strInstructions || '—';

    modalTitleEl.textContent = title;
    modalMetaEl.textContent = buildMeta(meal);
    modalImageEl.src = meal.strMealThumb || '';
    modalImageEl.alt = title;
    modalImageEl.classList.toggle('hidden', !meal.strMealThumb);

    modalIngredientsEl.innerHTML = '';
    ingredients.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      modalIngredientsEl.appendChild(li);
    });

    modalInstructionsEl.textContent = instructions;
  }

  function ensureRecipeDetails(meal) {
    if (meal.displayIngredients && meal.displayInstructions) {
      return Promise.resolve(meal);
    }

    var ingredients = getIngredients(meal);
    return Promise.all([
      meal.displayIngredients ? Promise.resolve(meal.displayIngredients) : translateLines(ingredients),
      meal.displayInstructions ? Promise.resolve(meal.displayInstructions) : translate(meal.strInstructions || '—')
    ]).then(function (parts) {
      meal.displayIngredients = parts[0];
      meal.displayInstructions = parts[1];
      return meal;
    });
  }

  function openRecipe(index) {
    var meal = currentMeals[index];
    if (!meal || !modalEl) return;

    modalRequestId += 1;
    var requestId = modalRequestId;

    modalOpen = true;
    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    modalTitleEl.textContent = meal.displayTitle || meal.strMeal || '—';
    modalMetaEl.textContent = buildMeta(meal);
    modalIngredientsEl.innerHTML = '';
    modalInstructionsEl.textContent = '';
    modalImageEl.src = meal.strMealThumb || '';
    modalImageEl.alt = meal.displayTitle || meal.strMeal || 'Rezept';
    modalImageEl.classList.toggle('hidden', !meal.strMealThumb);
    setModalLoading(true);

    ensureRecipeDetails(meal)
      .then(function (updatedMeal) {
        if (!modalOpen || requestId !== modalRequestId) return;
        renderRecipeDetails(updatedMeal);
        setModalLoading(false);
      })
      .catch(function () {
        if (!modalOpen || requestId !== modalRequestId) return;
        renderRecipeDetails(meal);
        setModalLoading(false);
      });

    modalCloseBtn.focus();
  }

  function closeRecipe() {
    if (!modalEl) return;
    modalRequestId += 1;
    modalOpen = false;
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setModalLoading(false);
  }

  function oneMeal() {
    return fetch(MEAL_API)
      .then(function (r) {
        if (!r.ok) throw new Error('net');
        return r.json();
      })
      .then(function (d) {
        return (d && d.meals && d.meals[0]) || null;
      });
  }

  function onGenerate() {
    closeRecipe();
    showLoading(true);
    showError('');

    Promise.all([ oneMeal(), oneMeal(), oneMeal(), oneMeal(), oneMeal(), oneMeal(), oneMeal() ])
      .then(function (raw) {
        var meals = raw.filter(Boolean);
        if (!meals.length) {
          showError('Fehler. Bitte erneut versuchen.');
          showLoading(false);
          return;
        }
        return Promise.all(meals.map(function (m) {
          return translate(m.strMeal).then(function (de) {
            m.displayTitle = de;
            return m;
          });
        }));
      })
      .then(function (translated) {
        if (translated && translated.length) draw(translated);
        showLoading(false);
      })
      .catch(function () {
        showError('Fehler. Bitte erneut versuchen.');
        showLoading(false);
      });
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape' && modalOpen) closeRecipe();
  }

  loadTheme();
  btnGen.addEventListener('click', onGenerate);
  themeBtn.addEventListener('click', cycleTheme);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeRecipe);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeRecipe);
  document.addEventListener('keydown', onModalKeydown);
})();
