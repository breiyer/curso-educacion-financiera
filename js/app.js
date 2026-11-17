/* Datos de módulos y utilidades de progreso/navegación. */
(function () {
  'use strict';
  var MODULES = [
    { id: 'm01', n: 1, level: 1, title: 'Dinero, inflación y valor del dinero en el tiempo', min: 35, sum: 'Por qué el dinero de hoy vale más que el de mañana y qué papel juega el interés.' },
    { id: 'm02', n: 2, level: 1, title: '¿Qué es un crédito? Actores, términos y garantías', min: 35, sum: 'Acreedor, deudor, capital, plazo, garantías y cómo se ve un crédito por dentro.' },
    { id: 'm03', n: 3, level: 1, title: 'Tasas de interés: EA, nominal, vencida, anticipada, usura', min: 50, sum: 'La parte que más confunde: qué tasa te cobran de verdad y cómo compararlas.' },
    { id: 'm04', n: 4, level: 2, title: 'Cuotas y sistemas de amortización', min: 55, sum: 'Cuota fija, abono constante a capital, pago al final, UVR y cómo leer una tabla de amortización.' },
    { id: 'm05', n: 5, level: 2, title: 'Productos de crédito en Colombia', min: 45, sum: 'Libre inversión, vivienda, vehículo, educación, tarjeta, libranza, microcrédito y créditos informales.' },
    { id: 'm06', n: 6, level: 2, title: 'El costo real: seguros, comisiones y costo efectivo', min: 45, sum: 'Lo que no sale en la tasa: seguros, cuotas de manejo, comisiones y cómo comparar ofertas.' },
    { id: 'm07', n: 7, level: 3, title: 'Historial crediticio, score y centrales de riesgo', min: 55, sum: 'Datacrédito, TransUnion, habeas data, Ley 2157 y cómo construir un buen historial.' },
    { id: 'm08', n: 8, level: 3, title: 'Presupuesto y capacidad de endeudamiento', min: 45, sum: 'Cuánto puedes pagar sin ahogarte y cómo calcularlo.' },
    { id: 'm09', n: 9, level: 3, title: 'La tarjeta de crédito a fondo', min: 50, sum: 'Cupo, corte, pago, diferido, pago mínimo e interés compuesto en tu contra o a tu favor.' },
    { id: 'm10', n: 10, level: 4, title: 'Estrategias de pago, prepagos y compra de cartera', min: 50, sum: 'Bola de nieve, avalancha, abonos extra, refinanciación y consolidación.' },
    { id: 'm11', n: 11, level: 4, title: 'Crédito de vivienda a fondo', min: 55, sum: 'UVR, pesos, LTV, leasing, subsidios y costos asociados a comprar vivienda.' },
    { id: 'm12', n: 12, level: 4, title: 'Mora, cobranza y tus derechos como consumidor financiero', min: 50, sum: 'Qué hacer si no puedes pagar, qué puede y qué no puede hacer un cobrador.' },
    { id: 'm13', n: 13, level: 4, title: 'Fraudes, sobreendeudamiento, insolvencia y reconstrucción', min: 50, sum: 'Estafas comunes, gota a gota, la Ley de insolvencia y cómo recuperar tu historial.' },
    { id: 'm14', n: 14, level: 4, title: 'Proyecto final: tu plan de vida crediticia', min: 40, sum: 'Integra todo en un plan personal con metas, presupuesto y reglas propias.' }
  ];
  var LEVELS = { 1: 'Nivel 1 · Fundamentos', 2: 'Nivel 2 · Cuotas y productos', 3: 'Nivel 3 · Vida crediticia', 4: 'Nivel 4 · Avanzado' };
  var KEY = 'cc_progress_v1', PASS = 0.7;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { mods: {} }; } catch (e) { return { mods: {} }; }
  }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* modo privado */ } }
  function doneCount(p) { return MODULES.filter(function (m) { return p.mods[m.id] && p.mods[m.id].done; }).length; }

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }

  function buildChrome() {
    var base = document.body.getAttribute('data-base') || '';
    var cur = document.body.getAttribute('data-id') || document.body.getAttribute('data-page');
    var p = load();
    var main = document.querySelector('main');
    var layout = el('div', { 'class': 'layout' });
    var top = el('div', { 'class': 'topbar no-print' });
    top.innerHTML = '<button class="ghost menu-btn" aria-label="Abrir menú" id="menuBtn">☰</button>' +
      '<a class="brand" href="' + base + 'index.html">💳 Vida crediticia · Curso Colombia</a>' +
      '<div class="progress-mini" title="Progreso del curso"><i id="topProg"></i></div>' +
      '<button class="ghost" id="themeBtn" aria-label="Cambiar tema">🌓</button>';
    var side = el('nav', { 'class': 'sidebar no-print', 'aria-label': 'Contenido del curso', id: 'sidebar' });
    var h = '<a href="' + base + 'index.html"' + (cur === 'index' ? ' class="current"' : '') + '><span class="tick">🏠</span>Inicio</a>';
    var lastLevel = 0;
    MODULES.forEach(function (m) {
      if (m.level !== lastLevel) { h += '<h4>' + LEVELS[m.level] + '</h4>'; lastLevel = m.level; }
      var d = p.mods[m.id] && p.mods[m.id].done;
      h += '<a href="' + base + 'modulos/' + m.id + '.html" class="' + (d ? 'done ' : '') + (cur === m.id ? 'current' : '') + '"><span class="tick">' + (d ? '✔' : m.n) + '</span><span>' + m.title + '</span></a>';
    });
    h += '<h4>Recursos</h4>' +
      '<a href="' + base + 'glosario.html"' + (cur === 'glosario' ? ' class="current"' : '') + '><span class="tick">📖</span>Glosario</a>' +
      '<a href="' + base + 'examen.html"' + (cur === 'examen' ? ' class="current"' : '') + '><span class="tick">📝</span>Examen final</a>' +
      '<a href="' + base + 'certificado.html"' + (cur === 'certificado' ? ' class="current"' : '') + '><span class="tick">🎓</span>Certificado</a>' +
      '<a href="' + base + 'fuentes.html"' + (cur === 'fuentes' ? ' class="current"' : '') + '><span class="tick">🔎</span>Fuentes</a>';
    side.innerHTML = h;
    main.parentNode.insertBefore(top, main);
    main.parentNode.insertBefore(layout, main);
    layout.appendChild(side); layout.appendChild(main);
    var foot = el('footer', { 'class': 'site' }, 'Curso educativo, no es asesoría financiera, legal ni de inversión. Las cifras de tasas y normas cambian: verifica siempre en la fuente oficial. · <a href="' + base + 'fuentes.html">Fuentes</a>');
    document.body.appendChild(foot);

    document.getElementById('menuBtn').onclick = function () { side.classList.toggle('open'); };
    side.addEventListener('click', function (e) { if (e.target.closest('a')) side.classList.remove('open'); });
    var theme = localStorage.getItem('cc_theme');
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('themeBtn').onclick = function () {
      var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('cc_theme', t); } catch (e) {}
    };
    updateTop();
  }

  function updateTop() {
    var p = load(), bar = document.getElementById('topProg');
    if (bar) bar.style.width = Math.round(doneCount(p) / MODULES.length * 100) + '%';
  }

  function moduleNav() {
    var id = document.body.getAttribute('data-id');
    var i = MODULES.findIndex(function (m) { return m.id === id; });
    if (i < 0) return;
    var base = document.body.getAttribute('data-base') || '';
    var nav = el('div', { 'class': 'nav-pages no-print' });
    var prev = MODULES[i - 1], next = MODULES[i + 1];
    nav.innerHTML = (prev ? '<a href="' + prev.id + '.html"><small>← Anterior</small>' + prev.title + '</a>' : '<a href="' + base + 'index.html"><small>← Inicio</small>Índice del curso</a>') +
      (next ? '<a class="next" href="' + next.id + '.html"><small>Siguiente →</small>' + next.title + '</a>' : '<a class="next" href="' + base + 'examen.html"><small>Último paso →</small>Examen final</a>');
    document.querySelector('.wrap').appendChild(nav);
    var head = document.querySelector('.wrap > .kicker');
    if (!head) {
      var m = MODULES[i];
      var k = el('div', { 'class': 'kicker' }, LEVELS[m.level] + ' · Módulo ' + m.n);
      document.querySelector('.wrap').insertBefore(k, document.querySelector('.wrap').firstChild);
    }
  }

  /* ---------- Quiz ---------- */
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function renderQuiz(host, questions, opts) {
    opts = opts || {};
    var items = questions.map(function (q) {
      var idx = shuffle(q.o.map(function (_, k) { return k; }));
      return { q: q, order: idx };
    });
    var html = '';
    items.forEach(function (it, qi) {
      html += '<div class="q" data-qi="' + qi + '"><p class="stem">' + (qi + 1) + '. ' + it.q.q + '</p>';
      it.order.forEach(function (oi) {
        html += '<label><input type="radio" name="q' + qi + '" value="' + oi + '"> ' + it.q.o[oi] + '</label>';
      });
      html += '<div class="why" hidden></div></div>';
    });
    html += '<button class="btn" id="qCheck">Comprobar respuestas</button> <button class="btn ghost" style="background:var(--line);color:var(--ink)" id="qRetry" hidden>Intentar de nuevo</button><div class="result" id="qResult" aria-live="polite"></div>';
    host.innerHTML = html;
    var btn = host.querySelector('#qCheck'), retry = host.querySelector('#qRetry');
    btn.onclick = function () {
      var ok = 0, unanswered = 0;
      items.forEach(function (it, qi) {
        var box = host.querySelector('.q[data-qi="' + qi + '"]');
        var sel = box.querySelector('input:checked');
        if (!sel) { unanswered++; return; }
      });
      if (unanswered) { host.querySelector('#qResult').textContent = 'Responde todas las preguntas (' + unanswered + ' sin responder).'; return; }
      items.forEach(function (it, qi) {
        var box = host.querySelector('.q[data-qi="' + qi + '"]');
        var sel = box.querySelector('input:checked'), v = +sel.value;
        box.querySelectorAll('label').forEach(function (lb) {
          var r = +lb.querySelector('input').value;
          if (r === it.q.a) lb.classList.add('right'); else if (r === v) lb.classList.add('wrong');
          lb.querySelector('input').disabled = true;
        });
        if (v === it.q.a) ok++;
        var w = box.querySelector('.why'); w.hidden = false; w.innerHTML = (v === it.q.a ? '✔ Correcto. ' : '✘ Incorrecto. ') + (it.q.w || '');
      });
      var score = ok / items.length, pass = score >= (opts.pass || PASS);
      host.querySelector('#qResult').innerHTML = 'Resultado: ' + ok + ' de ' + items.length + ' (' + Math.round(score * 100) + '%). ' + (pass ? '🎉 ¡Aprobado!' : 'Necesitas al menos ' + Math.round((opts.pass || PASS) * 100) + '%. Repasa el módulo e inténtalo de nuevo.');
      btn.hidden = true; retry.hidden = false;
      if (opts.onDone) opts.onDone(score, pass);
    };
    retry.onclick = function () { renderQuiz(host, questions, opts); host.scrollIntoView({ behavior: 'smooth' }); };
  }

  function setupModuleQuiz() {
    var id = document.body.getAttribute('data-id');
    var host = document.getElementById('quiz');
    if (!host || !window.QUIZZES || !window.QUIZZES[id]) return;
    var wrapper = el('div', { 'class': 'quiz' }, '<h2>🧪 Comprueba lo aprendido</h2><p>Necesitas 70 % o más para completar el módulo.</p><div id="quizBody"></div><p class="result" id="modStatus"></p>');
    host.appendChild(wrapper);
    var p = load(), st = p.mods[id];
    function status() {
      var p2 = load(), s = p2.mods[id];
      var need = (id === 'm14' && !p2.plan) ? ' Falta guardar tu plan personal arriba para completar este módulo.' : '';
      document.getElementById('modStatus').innerHTML = s && s.done ? '✅ Módulo completado (mejor puntaje: ' + Math.round(s.score * 100) + '%).' : (s && s.score != null ? 'Mejor puntaje: ' + Math.round(s.score * 100) + '%.' + need : need);
    }
    renderQuiz(wrapper.querySelector('#quizBody'), window.QUIZZES[id], {
      onDone: function (score, pass) {
        var p2 = load(); var s = p2.mods[id] || {};
        s.score = Math.max(s.score || 0, score); s.quizPassed = s.quizPassed || pass;
        s.done = !!(s.quizPassed && (id !== 'm14' || p2.plan));
        p2.mods[id] = s; save(p2); status(); updateTop();
        var a = document.querySelector('#sidebar a.current'); if (a && s.done) { a.classList.add('done'); a.querySelector('.tick').textContent = '✔'; }
      }
    });
    status();
  }

  window.Course = { MODULES: MODULES, LEVELS: LEVELS, load: load, save: save, doneCount: doneCount, renderQuiz: renderQuiz, shuffle: shuffle, updateTop: updateTop, PASS: PASS };

  document.addEventListener('DOMContentLoaded', function () {
    buildChrome();
    if (document.body.getAttribute('data-page') === 'module') { moduleNav(); setupModuleQuiz(); }
  });
})();
