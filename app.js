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

  function draw(meals) {
    listEl.innerHTML = '';
    showError('');
    (meals || []).forEach(function (m) {
      var title = (m && m.displayTitle) || (m && m.strMeal) || '—';
      var div = document.createElement('div');
      div.setAttribute('role', 'listitem');
      div.textContent = title;
      listEl.appendChild(div);
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

  loadTheme();
  btnGen.addEventListener('click', onGenerate);
  themeBtn.addEventListener('click', cycleTheme);
})();
