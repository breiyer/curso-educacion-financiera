/* Simuladores interactivos. Cada uno se monta en <div data-sim="nombre"></div>. */
(function () {
  'use strict';
  var F = window.Fin, SIMS = {};
  var USURA = 28.34, IBC = 18.89, FECHA_TASAS = 'noviembre de 2026';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function num(v) { var x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; }
  function kpi(label, value, cls) { return '<div class="kpi ' + (cls || '') + '"><b>' + value + '</b><span>' + label + '</span></div>'; }
  var COP = F.fmtCOP, PCT = F.fmtPct;

  /* Construye un simulador a partir de una configuración. */
  function build(host, cfg) {
    host.classList.add('sim');
    var h = '<h4>🧮 ' + cfg.title + '</h4>' + (cfg.sub ? '<p class="sub">' + cfg.sub + '</p>' : '') + '<div class="grid">';
    cfg.fields.forEach(function (f) {
      h += '<div class="field"><label for="' + host.id + '_' + f.id + '">' + f.label + '</label>';
      if (f.opts) {
        h += '<select id="' + host.id + '_' + f.id + '">' + f.opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(f.value) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
      } else if (f.type === 'text') {
        h += '<input id="' + host.id + '_' + f.id + '" type="text" value="' + (f.value || '') + '">';
      } else {
        h += '<input id="' + host.id + '_' + f.id + '" type="number" inputmode="decimal" value="' + f.value + '" step="' + (f.step || 'any') + '"' + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + '>';
      }
      if (f.hint) h += '<small>' + f.hint + '</small>';
      h += '</div>';
    });
    h += '</div><div class="out" aria-live="polite"></div>';
    host.innerHTML = h;
    var out = host.querySelector('.out');
    function vals() {
      var v = {};
      cfg.fields.forEach(function (f) {
        var e = host.querySelector('#' + host.id + '_' + f.id);
        v[f.id] = (f.opts || f.type === 'text') ? e.value : num(e.value);
      });
      return v;
    }
    function run() { out.innerHTML = cfg.compute(vals(), out) || ''; if (cfg.after) cfg.after(out, vals()); }
    host.addEventListener('input', run); host.addEventListener('change', run);
    run();
    return { run: run, vals: vals, out: out };
  }

  function table(rows, opts) {
    opts = opts || {};
    var h = '<div class="table-scroll"><table><thead><tr><th class="num">Mes</th><th class="num">Cuota total</th><th class="num">Intereses</th><th class="num">Abono a capital</th>' + (opts.extras ? '<th class="num">Seguro + cargos</th>' : '') + '<th class="num">Saldo</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td class="num">' + r.n + '</td><td class="num">' + COP(r.payment) + '</td><td class="num">' + COP(r.interest) + '</td><td class="num">' + COP(r.principal) + '</td>' + (opts.extras ? '<td class="num">' + COP((r.insurance || 0) + (r.fee || 0)) + '</td>' : '') + '<td class="num">' + COP(r.balance) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'; }
  function stacked(canvas, rows) {
    var dpr = window.devicePixelRatio || 1, W = canvas.clientWidth || 600, H = 220;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var c = canvas.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
    var step = Math.max(1, Math.ceil(rows.length / 120));
    var pts = rows.filter(function (r, i) { return i % step === 0; });
    var max = Math.max.apply(null, pts.map(function (r) { return r.payment; })) || 1;
    var padL = 8, padB = 18, bw = (W - padL * 2) / pts.length;
    pts.forEach(function (r, i) {
      var x = padL + i * bw, y = H - padB;
      var hc = (r.principal / max) * (H - padB - 10), hi = (r.interest / max) * (H - padB - 10), ho = (((r.insurance || 0) + (r.fee || 0)) / max) * (H - padB - 10);
      c.fillStyle = css('--brand'); c.fillRect(x, y - hc, Math.max(1, bw - 1), hc);
      c.fillStyle = css('--accent'); c.fillRect(x, y - hc - hi, Math.max(1, bw - 1), hi);
      c.fillStyle = css('--info'); c.fillRect(x, y - hc - hi - ho, Math.max(1, bw - 1), ho);
    });
    c.fillStyle = css('--muted'); c.font = '11px system-ui'; c.fillText('Mes 1', padL, H - 4); var t = 'Mes ' + rows.length; c.fillText(t, W - padL - c.measureText(t).width, H - 4);
  }
  var LEG = '<div class="legend"><span><s style="background:var(--brand)"></s>Abono a capital</span><span><s style="background:var(--accent)"></s>Intereses</span><span><s style="background:var(--info)"></s>Seguros y cargos</span></div>';

  /* Conversión del tipo de tasa ingresada a EA (fracción) */
  function toEA(tipo, v) {
    v = v / 100;
    switch (tipo) {
      case 'ea': return v;
      case 'nmv': return F.nominalToEA(v, 12);
      case 'mv': return F.periodicToEA(v, 12);
      case 'ma': return F.periodicToEA(F.anticipatedToVencida(v), 12);
      case 'nma': return F.periodicToEA(F.anticipatedToVencida(v / 12), 12);
      default: return v;
    }
  }
  var TIPOS = [['ea', 'Efectiva anual (E.A.)'], ['nmv', 'Nominal anual mes vencido (N.M.V.)'], ['mv', 'Mensual vencida'], ['ma', 'Mensual anticipada'], ['nma', 'Nominal anual mes anticipado (N.M.A.)']];

  /* ===== Simuladores ===== */
  SIMS.inflacion = function (h) {
    build(h, { title: 'Simulador de inflación y poder adquisitivo', sub: 'Ve cuánto compra mañana el dinero de hoy.',
      fields: [{ id: 'm', label: 'Monto hoy (COP)', value: 1000000, step: 100000 }, { id: 'i', label: 'Inflación anual supuesta (%)', value: 5, step: 0.1 }, { id: 'y', label: 'Años', value: 10, step: 1, min: 1 }],
      compute: function (v) {
        var pp = F.purchasingPower(v.m, v.i / 100, v.y), cost = F.futureValue(v.m, v.i / 100, v.y);
        return '<div class="results">' + kpi('Lo que hoy cuesta ' + COP(v.m) + ' costará en ' + v.y + ' años', COP(cost)) + kpi('Poder de compra de ' + COP(v.m) + ' guardados sin rendimiento', COP(pp), 'alert') + kpi('Pérdida de poder de compra', PCT(1 - pp / v.m, 1)) + '</div>';
      } });
  };
  SIMS.interes = function (h) {
    build(h, { title: 'Interés simple vs. interés compuesto', sub: 'Compara cómo crece (o se acumula una deuda) con y sin reinversión de los intereses.',
      fields: [{ id: 'c', label: 'Capital (COP)', value: 1000000, step: 100000 }, { id: 'r', label: 'Tasa anual (%)', value: 12, step: 0.1 }, { id: 'y', label: 'Años', value: 20, min: 1, step: 1 }],
      compute: function (v) {
        var s = v.c * (1 + v.r / 100 * v.y), c = F.futureValue(v.c, v.r / 100, v.y);
        var t = '<div class="results">' + kpi('Con interés simple', COP(s)) + kpi('Con interés compuesto', COP(c), 'ok') + kpi('Diferencia', COP(c - s)) + kpi('Regla del 72: años para duplicar', v.r > 0 ? (72 / v.r).toFixed(1) : '—') + '</div>';
        var rows = '<div class="table-scroll"><table><thead><tr><th class="num">Año</th><th class="num">Simple</th><th class="num">Compuesto</th></tr></thead><tbody>';
        for (var y = 1; y <= Math.min(v.y, 40); y++) rows += '<tr><td class="num">' + y + '</td><td class="num">' + COP(v.c * (1 + v.r / 100 * y)) + '</td><td class="num">' + COP(F.futureValue(v.c, v.r / 100, y)) + '</td></tr>';
        return t + rows + '</tbody></table></div>';
      } });
  };
  SIMS.ahorro = function (h) {
    build(h, { title: 'Simulador de ahorro mensual', sub: 'Cuánto acumulas ahorrando una cuota fija cada mes.',
      fields: [{ id: 'a', label: 'Aporte mensual (COP)', value: 200000, step: 10000 }, { id: 'r', label: 'Rentabilidad E.A. (%)', value: 8, step: 0.1 }, { id: 'n', label: 'Meses', value: 36, step: 1, min: 1 }, { id: 'i', label: 'Saldo inicial (COP)', value: 0, step: 100000 }],
      compute: function (v) {
        var fv = F.savingsFV(v.a, v.r / 100, v.n, v.i), put = v.a * v.n + v.i;
        return '<div class="results">' + kpi('Total acumulado', COP(fv), 'ok') + kpi('Lo que aportaste', COP(put)) + kpi('Rendimientos', COP(fv - put)) + '</div>';
      } });
  };
  SIMS.meta = function (h) {
    build(h, { title: '¿Cuánto debo ahorrar para una meta?', sub: 'Útil para la cuota inicial, el fondo de emergencia o evitar endeudarte por una compra.',
      fields: [{ id: 'g', label: 'Meta (COP)', value: 10000000, step: 100000 }, { id: 'r', label: 'Rentabilidad E.A. (%)', value: 8, step: 0.1 }, { id: 'n', label: 'Meses', value: 24, step: 1, min: 1 }, { id: 'i', label: 'Ya tengo (COP)', value: 500000, step: 100000 }],
      compute: function (v) { var a = F.savingsNeeded(v.g, v.r / 100, v.n, v.i); return '<div class="results">' + kpi('Aporte mensual necesario', COP(a), 'ok') + kpi('Total aportado', COP(a * v.n)) + '</div>'; } });
  };
  SIMS.conversion = function (h) {
    build(h, { title: 'Convertidor de tasas de interés', sub: 'Escribe una tasa en el formato que te dieron y obtén sus equivalentes. (La Superfinanciera tiene su propio simulador; ver Fuentes).',
      fields: [{ id: 't', label: 'Tipo de tasa que te dieron', value: 'nmv', opts: TIPOS }, { id: 'v', label: 'Valor (%)', value: 24, step: 0.01 }, { id: 'p', label: 'Monto para ejemplo (COP)', value: 1000000, step: 100000 }],
      compute: function (v) {
        var ea = toEA(v.t, v.v), im = F.eaToPeriodic(ea, 12), da = F.vencidaToAnticipated(im);
        var diaria = F.eaToPeriodic(ea, 365);
        return '<div class="results">' + kpi('Efectiva anual (E.A.)', PCT(ea, 4), 'ok') + kpi('Mensual vencida', PCT(im, 4)) + kpi('Nominal anual mes vencido', PCT(im * 12, 4)) + kpi('Mensual anticipada', PCT(da, 4)) + kpi('Nominal anual mes anticipado', PCT(da * 12, 4)) + kpi('Diaria efectiva', PCT(diaria, 5)) + '</div>' +
          '<p class="note">Interés de un mes sobre ' + COP(v.p) + ': <b>' + COP(v.p * im) + '</b> (vencido). Si fuera anticipado se descontaría al inicio: <b>' + COP(v.p * da) + '</b> por mes, pero recibirías ' + COP(v.p * (1 - da)) + ' netos.</p>';
      } });
  };
  SIMS.usura = function (h) {
    build(h, { title: '¿Esta tasa supera la usura?', sub: 'Valores vigentes en ' + FECHA_TASAS + ' (Superfinanciera, crédito de consumo y ordinario). Cámbialos si ya cambió el mes.',
      fields: [{ id: 't', label: 'Tipo de tasa de la oferta', value: 'ea', opts: TIPOS }, { id: 'v', label: 'Tasa de la oferta (%)', value: 30, step: 0.01 }, { id: 'u', label: 'Tasa de usura vigente E.A. (%)', value: USURA, step: 0.01, hint: 'Se publica cada mes.' }],
      compute: function (v) {
        var ea = toEA(v.t, v.v) * 100, over = ea > v.u + 1e-9;
        return '<div class="results">' + kpi('Tu tasa en E.A.', ea.toFixed(2) + ' %', over ? 'alert' : 'ok') + kpi('Usura vigente', v.u.toFixed(2) + ' % E.A.') + kpi('Interés bancario corriente (' + FECHA_TASAS + ')', IBC.toFixed(2) + ' % E.A.') + '</div>' +
          '<p class="note">' + (over ? '🚩 Supera el límite legal de intereses para ese tipo de crédito. Es una señal fuerte de crédito ilegal o de cobro irregular: verifica con la Superfinanciera.' : '✔ No supera el tope. Eso no significa que sea barata: compárala con el interés bancario corriente (' + IBC + ' %) y con otras ofertas.') + ' Recuerda: la usura se compara con la tasa de interés, no con el costo total (seguros, comisiones).</p>';
      } });
  };

  function amortFields(def) {
    return [
      { id: 'p', label: 'Monto (COP)', value: def.p || 20000000, step: 500000 },
      { id: 't', label: 'Tipo de tasa', value: 'ea', opts: TIPOS },
      { id: 'r', label: 'Tasa (%)', value: def.r || 20, step: 0.01 },
      { id: 'n', label: 'Plazo (meses)', value: def.n || 36, step: 1, min: 1, max: 480 }
    ];
  }
  SIMS.amortizacion = function (h) {
    var f = amortFields({}).concat([
      { id: 's', label: 'Sistema', value: 'fr', opts: [['fr', 'Cuota fija (francés)'], ['al', 'Abono constante a capital (alemán)'], ['io', 'Intereses mensuales y capital al final'], ['gr', 'Cuota creciente (gradiente)']] },
      { id: 'g', label: 'Crecimiento mensual de la cuota (solo gradiente, %)', value: 0.5, step: 0.05 },
      { id: 'x', label: 'Abono extra mensual a capital (solo cuota fija)', value: 0, step: 50000 },
      { id: 'sg', label: 'Seguro mensual sobre saldo (%)', value: 0, step: 0.01, hint: 'Ej: 0,05 = 0,05 % mensual' },
      { id: 'cf', label: 'Cargo fijo mensual (COP)', value: 0, step: 1000 }]);
    build(h, { title: 'Simulador de cuotas y tabla de amortización', sub: 'Cambia el sistema y mira cómo se reparte cada cuota entre intereses y capital.', fields: f,
      compute: function (v) {
        var ea = toEA(v.t, v.r), i = F.eaToPeriodic(ea, 12), o = { insuranceRate: v.sg / 100, monthlyFee: v.cf, extra: v.x };
        var rows = v.s === 'al' ? F.scheduleGerman(v.p, i, v.n, o) : v.s === 'io' ? F.scheduleInterestOnly(v.p, i, v.n, o) : v.s === 'gr' ? F.scheduleGradient(v.p, i, v.n, v.g / 100) : F.scheduleFrench(v.p, i, v.n, o);
        var s = F.summarize(rows, v.p);
        return '<div class="results">' + kpi('Tasa mensual equivalente', PCT(i, 4)) + kpi('Primera cuota', COP(rows[0].payment)) + kpi('Última cuota', COP(rows[rows.length - 1].payment)) + kpi('Total de intereses', COP(s.totalInterest), 'alert') + kpi('Total pagado', COP(s.totalPaid)) + kpi('Plazo real', rows.length + ' meses') + '</div>' +
          '<canvas class="chart" aria-label="Gráfico de composición de cada cuota"></canvas>' + LEG + '<details><summary>Ver tabla de amortización completa</summary>' + table(rows, { extras: (v.sg > 0 || v.cf > 0) }) + '</details>';
      }, after: function (out, v) {
        var c = out.querySelector('canvas'); if (!c) return;
        var ea = toEA(v.t, v.r), i = F.eaToPeriodic(ea, 12), o = { insuranceRate: v.sg / 100, monthlyFee: v.cf, extra: v.x };
        var rows = v.s === 'al' ? F.scheduleGerman(v.p, i, v.n, o) : v.s === 'io' ? F.scheduleInterestOnly(v.p, i, v.n, o) : v.s === 'gr' ? F.scheduleGradient(v.p, i, v.n, v.g / 100) : F.scheduleFrench(v.p, i, v.n, o);
        stacked(c, rows);
      } });
  };
  SIMS.comparar = function (h) {
    build(h, { title: 'Compara los 4 sistemas con el mismo crédito', sub: 'Misma tasa y plazo, distinta forma de pagar.', fields: amortFields({ p: 30000000, r: 22, n: 48 }),
      compute: function (v) {
        var i = F.eaToPeriodic(toEA(v.t, v.r), 12);
        var sets = [['Cuota fija (francés)', F.scheduleFrench(v.p, i, v.n)], ['Abono constante a capital', F.scheduleGerman(v.p, i, v.n)], ['Intereses y capital al final', F.scheduleInterestOnly(v.p, i, v.n)], ['Cuota creciente 0,5 % mensual', F.scheduleGradient(v.p, i, v.n, 0.005)]];
        var t = '<div class="table-scroll"><table><thead><tr><th>Sistema</th><th class="num">1ª cuota</th><th class="num">Última cuota</th><th class="num">Intereses totales</th><th class="num">Total pagado</th></tr></thead><tbody>';
        sets.forEach(function (s) { var sm = F.summarize(s[1], v.p); t += '<tr><td>' + s[0] + '</td><td class="num">' + COP(s[1][0].payment) + '</td><td class="num">' + COP(s[1][s[1].length - 1].payment) + '</td><td class="num">' + COP(sm.totalInterest) + '</td><td class="num">' + COP(sm.totalPaid) + '</td></tr>'; });
        return t + '</tbody></table></div><p class="note">Fíjate: el sistema con la cuota inicial más baja no es el más barato. Pagar capital más tarde significa pagar más intereses.</p>';
      } });
  };
  SIMS.costoreal = function (h) {
    build(h, { title: 'Costo efectivo real de un crédito', sub: 'Incluye comisión, seguros y cargos fijos. Calcula la tasa efectiva anual que de verdad pagas (TIR).',
      fields: [{ id: 'p', label: 'Monto solicitado (COP)', value: 20000000, step: 500000 }, { id: 'r', label: 'Tasa pactada E.A. (%)', value: 20, step: 0.01 }, { id: 'n', label: 'Plazo (meses)', value: 36, min: 1, step: 1 },
        { id: 'c', label: 'Comisión o estudio descontado al desembolso (%)', value: 1, step: 0.1 }, { id: 'sg', label: 'Seguro mensual sobre saldo (%)', value: 0.06, step: 0.005 }, { id: 'cf', label: 'Cargo fijo mensual (COP)', value: 0, step: 1000 }],
      compute: function (v) {
        var i = F.eaToPeriodic(v.r / 100, 12), o = { insuranceRate: v.sg / 100, monthlyFee: v.cf, upfrontFee: v.p * v.c / 100 };
        var res = F.costoEfectivoAnual(v.p, i, v.n, o), sm = F.summarize(res.rows, v.p), base = F.paymentFrench(v.p, i, v.n);
        return '<div class="results">' + kpi('Cuota solo capital + interés', COP(base)) + kpi('Primera cuota con seguros y cargos', COP(res.rows[0].payment)) + kpi('Tasa pactada E.A.', PCT(v.r / 100)) + kpi('Costo efectivo anual real', PCT(res.ea), 'alert') + kpi('Recibes en la cuenta', COP(v.p - o.upfrontFee)) + kpi('Total pagado', COP(sm.totalPaid)) + '</div><p class="note">Sobrecosto sobre la tasa pactada: <b>' + ((res.ea - v.r / 100) * 100).toFixed(2) + ' puntos porcentuales</b>. Algunos seguros son obligatorios (p. ej., vida deudores en hipotecas) y otros son voluntarios: pregunta y exige que te lo digan por escrito.</p>';
      } });
  };
  SIMS.comparador = function (h) {
    var fl = [];
    ['a', 'b'].forEach(function (k, idx) {
      var d = idx === 0 ? { r: 19, c: 1.5, sg: 0.07 } : { r: 21, c: 0, sg: 0.03 };
      fl.push({ id: k + 'r', label: 'Oferta ' + k.toUpperCase() + ': tasa E.A. (%)', value: d.r, step: 0.01 });
      fl.push({ id: k + 'c', label: 'Oferta ' + k.toUpperCase() + ': comisión al desembolso (%)', value: d.c, step: 0.1 });
      fl.push({ id: k + 's', label: 'Oferta ' + k.toUpperCase() + ': seguro mensual sobre saldo (%)', value: d.sg, step: 0.005 });
      fl.push({ id: k + 'f', label: 'Oferta ' + k.toUpperCase() + ': cargo fijo mensual (COP)', value: idx === 0 ? 0 : 6000, step: 1000 });
    });
    fl.unshift({ id: 'p', label: 'Monto (COP)', value: 20000000, step: 500000 }, { id: 'n', label: 'Plazo (meses)', value: 36, step: 1, min: 1 });
    build(h, { title: 'Comparador de dos ofertas', sub: 'La tasa más baja no siempre gana. Mira el costo efectivo.', fields: fl,
      compute: function (v) {
        function calc(k) {
          var i = F.eaToPeriodic(v[k + 'r'] / 100, 12);
          var r = F.costoEfectivoAnual(v.p, i, v.n, { insuranceRate: v[k + 's'] / 100, monthlyFee: v[k + 'f'], upfrontFee: v.p * v[k + 'c'] / 100 });
          return { ea: r.ea, tot: F.summarize(r.rows, v.p).totalPaid + v.p * v[k + 'c'] / 100, cuota: r.rows[0].payment };
        }
        var a = calc('a'), b = calc('b'), win = a.tot < b.tot ? 'A' : 'B';
        return '<div class="table-scroll"><table><thead><tr><th></th><th class="num">Oferta A</th><th class="num">Oferta B</th></tr></thead><tbody>' +
          '<tr><td>Primera cuota</td><td class="num">' + COP(a.cuota) + '</td><td class="num">' + COP(b.cuota) + '</td></tr>' +
          '<tr><td>Costo efectivo anual (TIR)</td><td class="num">' + PCT(a.ea) + '</td><td class="num">' + PCT(b.ea) + '</td></tr>' +
          '<tr><td>Total pagado (incluye comisión)</td><td class="num">' + COP(a.tot) + '</td><td class="num">' + COP(b.tot) + '</td></tr></tbody></table></div>' +
          '<p class="note"><b>La oferta ' + win + ' es más barata</b> por ' + COP(Math.abs(a.tot - b.tot)) + ' en total.</p>';
      } });
  };
  SIMS.tarjeta = function (h) {
    build(h, { title: 'Tarjeta de crédito: pago mínimo vs. pago inteligente', sub: 'Supón que no haces más compras con la tarjeta. El pago mínimo se modela como intereses del mes + un % del saldo (varía por emisor; revisa el tuyo).',
      fields: [{ id: 's', label: 'Saldo de la tarjeta (COP)', value: 5000000, step: 100000 }, { id: 'r', label: 'Tasa E.A. (%)', value: 27, step: 0.01, hint: 'Tope: usura (' + USURA + ' % en ' + FECHA_TASAS + ')' }, { id: 'm', label: '% del saldo que incluye el mínimo', value: 3, step: 0.5 }, { id: 'fl', label: 'Pago mínimo nunca menor a (COP)', value: 50000, step: 5000 }, { id: 'f', label: 'Pago fijo que podrías hacer (COP/mes)', value: 400000, step: 10000 }],
      compute: function (v) {
        var a = F.cardMinimumOnly(v.s, v.r / 100, { minPct: v.m / 100, floor: v.fl }), b = F.cardFixedPayment(v.s, v.r / 100, v.f);
        var interest1 = v.s * F.eaToPeriodic(v.r / 100, 12);
        var t = '<div class="results">' + kpi('Interés del primer mes', COP(interest1)) + kpi('Solo mínimo: meses para salir', a.converged ? a.months + ' (' + (a.months / 12).toFixed(1) + ' años)' : '—', 'alert') + kpi('Solo mínimo: intereses totales', COP(a.totalInterest), 'alert') + '</div>';
        if (b.converged) t += '<div class="results">' + kpi('Con pago fijo: meses', b.months) + kpi('Con pago fijo: intereses', COP(b.totalInterest), 'ok') + kpi('Ahorro frente al mínimo', COP(a.totalInterest - b.totalInterest), 'ok') + '</div>';
        else t += '<p class="note">🚩 Tu pago fijo (' + COP(v.f) + ') no alcanza ni para cubrir los intereses del mes (' + COP(interest1) + '): la deuda no baja.</p>';
        return t + '<p class="note">Pagar el <b>total facturado</b> antes de la fecha límite cuesta <b>' + COP(0) + '</b> de intereses en compras de contado.</p>';
      } });
  };
  SIMS.utilizacion = function (h) {
    build(h, { title: 'Utilización de cupo', sub: 'Qué porcentaje de tus cupos de crédito rotativo estás usando. Como referencia general se recomienda mantenerlo bajo ~30 %.',
      fields: [{ id: 'c1', label: 'Cupo tarjeta 1', value: 3000000, step: 100000 }, { id: 's1', label: 'Saldo tarjeta 1', value: 1500000, step: 100000 }, { id: 'c2', label: 'Cupo tarjeta 2', value: 2000000, step: 100000 }, { id: 's2', label: 'Saldo tarjeta 2', value: 200000, step: 100000 }],
      compute: function (v) {
        var c = v.c1 + v.c2, s = v.s1 + v.s2, u = c > 0 ? s / c : 0, cls = u <= 0.3 ? 'ok' : u <= 0.5 ? '' : 'alert';
        return '<div class="results">' + kpi('Utilización total', PCT(u, 1), cls) + kpi('Cupo disponible', COP(c - s)) + '</div><p class="note">' + (u <= 0.3 ? '✔ Zona saludable.' : u <= 0.5 ? '⚠ Zona de cuidado.' : '🚩 Uso alto: señal de riesgo para quien evalúa tu perfil.') + ' (Guía general, no una regla oficial de las centrales colombianas.)</p>';
      } });
  };
  SIMS.permanencia = function (h) {
    build(h, { title: 'Permanencia de un reporte negativo (Ley 2157 de 2021)', sub: 'Calculadora orientativa. Aplica a mora ya pagada. Verifica tu caso en la central de riesgo o con la fuente.',
      fields: [{ id: 'm', label: 'Meses que estuviste en mora hasta pagar', value: 10, step: 1, min: 0, max: 96 }],
      compute: function (v) {
        var perm = Math.min(2 * v.m, 48), cap8 = Math.max(0, 96 - v.m), final = Math.min(perm, cap8);
        return '<div class="results">' + kpi('Doble del tiempo de mora', (2 * v.m) + ' meses') + kpi('Máximo tras el pago', '48 meses (4 años)') + kpi('Permanencia estimada tras pagar', final + ' meses', 'ok') + '</div><p class="note">Además, el dato negativo caduca a los <b>8 años</b> contados desde que entró en mora, aunque nunca hayas pagado. Los datos positivos permanecen de forma indefinida.</p>';
      } });
  };
  SIMS.capacidad = function (h) {
    build(h, { title: 'Capacidad de endeudamiento', sub: 'Calcula cuánto podrías pagar de cuota y cuánto crédito soporta.',
      fields: [{ id: 'i', label: 'Ingreso mensual neto (COP)', value: 4500000, step: 100000 }, { id: 'd', label: 'Cuotas de deudas actuales por mes', value: 500000, step: 50000 }, { id: 'cap', label: 'Tope de deuda sobre ingreso', value: 35, opts: [[30, '30 % (conservador)'], [35, '35 % (moderado)'], [40, '40 % (límite alto)']] },
        { id: 'r', label: 'Tasa E.A. del nuevo crédito (%)', value: 20, step: 0.01 }, { id: 'n', label: 'Plazo (meses)', value: 48, min: 1, step: 1 }],
      compute: function (v) {
        var dti = F.debtToIncome(v.d, v.i), cuota = F.maxNewPayment(v.i, v.d, v.cap / 100), m = F.maxLoan(cuota, F.eaToPeriodic(v.r / 100, 12), v.n);
        var cls = dti <= 0.3 ? 'ok' : dti <= 0.4 ? '' : 'alert';
        return '<div class="results">' + kpi('Deuda actual / ingreso', PCT(dti, 1), cls) + kpi('Cuota máxima para un crédito nuevo', COP(cuota), 'ok') + kpi('Monto máximo aproximado', COP(m)) + '</div><p class="note">' + (dti > v.cap / 100 ? '🚩 Ya superas el tope elegido: antes de pedir más, reduce deudas.' : 'Con ese tope te quedaría ' + COP(v.i * (1 - v.cap / 100)) + ' al mes para todo lo demás. Un banco puede aprobar más; que lo apruebe no significa que te convenga.') + '</p>';
      } });
  };
  SIMS.presupuesto = function (h) {
    build(h, { title: 'Presupuesto 50/30/20 (ajustable)', sub: 'Regla de referencia popular en educación financiera (no es oficial). Ajusta los porcentajes a tu vida.',
      fields: [{ id: 'i', label: 'Ingreso mensual neto (COP)', value: 3500000, step: 100000 }, { id: 'a', label: 'Necesidades (%)', value: 50, step: 1 }, { id: 'b', label: 'Gustos (%)', value: 30, step: 1 }],
      compute: function (v) {
        var c = 100 - v.a - v.b;
        return '<div class="results">' + kpi('Necesidades (' + v.a + ' %)', COP(v.i * v.a / 100)) + kpi('Gustos (' + v.b + ' %)', COP(v.i * v.b / 100)) + kpi('Ahorro y pago de deudas (' + c + ' %)', COP(v.i * c / 100), c < 10 ? 'alert' : 'ok') + '</div>';
      } });
  };
  SIMS.emergencia = function (h) {
    build(h, { title: 'Fondo de emergencia', sub: 'Se suele recomendar entre 3 y 6 meses de gastos esenciales.',
      fields: [{ id: 'g', label: 'Gastos esenciales mensuales (COP)', value: 2500000, step: 100000 }, { id: 'k', label: 'Meses de cobertura', value: 4, min: 1, step: 1 }, { id: 's', label: 'Ya tengo ahorrado (COP)', value: 800000, step: 100000 }, { id: 'a', label: 'Puedo ahorrar al mes (COP)', value: 250000, step: 10000 }],
      compute: function (v) {
        var meta = v.g * v.k, falta = Math.max(0, meta - v.s), meses = v.a > 0 ? Math.ceil(falta / v.a) : Infinity;
        return '<div class="results">' + kpi('Meta del fondo', COP(meta)) + kpi('Te falta', COP(falta), falta ? 'alert' : 'ok') + kpi('Tiempo para lograrlo', isFinite(meses) ? meses + ' meses' : '—') + '</div>';
      } });
  };
  SIMS.estrategia = function (h) {
    var f = [{ id: 'b', label: 'Dinero total mensual para deudas (COP)', value: 1300000, step: 50000 }];
    var d = [['Tarjeta A', 4000000, 28, 160000], ['Libre inversión', 15000000, 19, 520000], ['Almacén', 1200000, 24, 100000], ['', 0, 0, 0]];
    d.forEach(function (x, k) {
      f.push({ id: 'n' + k, label: 'Deuda ' + (k + 1) + ': nombre', value: x[0], type: 'text' }, { id: 's' + k, label: 'Saldo (COP)', value: x[1], step: 100000 }, { id: 'e' + k, label: 'Tasa E.A. (%)', value: x[2], step: 0.1 }, { id: 'm' + k, label: 'Pago mínimo mensual', value: x[3], step: 10000 });
    });
    build(h, { title: 'Bola de nieve vs. avalancha', sub: 'Ingresa hasta 4 deudas (deja el saldo en 0 si no la usas).', fields: f,
      compute: function (v) {
        var debts = [];
        for (var k = 0; k < 4; k++) if (v['s' + k] > 0) debts.push({ name: v['n' + k] || ('Deuda ' + (k + 1)), balance: v['s' + k], ea: v['e' + k] / 100, minPayment: v['m' + k] });
        if (!debts.length) return '<p class="note">Agrega al menos una deuda.</p>';
        var a = F.payoffPlan(debts, v.b, 'avalanche'), s = F.payoffPlan(debts, v.b, 'snowball');
        if (!a.feasible) return '<p class="note">🚩 ' + (a.reason || 'Con ese presupuesto la deuda no se termina nunca.') + '</p>';
        function ord(p) { return p.order.map(function (o) { return o.name + ' (mes ' + o.month + ')'; }).join(' → '); }
        return '<div class="table-scroll"><table><thead><tr><th></th><th class="num">Meses</th><th class="num">Intereses totales</th><th>Orden en que se liquidan</th></tr></thead><tbody>' +
          '<tr><td><b>Avalancha</b> (mayor tasa primero)</td><td class="num">' + a.months + '</td><td class="num">' + COP(a.totalInterest) + '</td><td>' + ord(a) + '</td></tr>' +
          '<tr><td><b>Bola de nieve</b> (menor saldo primero)</td><td class="num">' + s.months + '</td><td class="num">' + COP(s.totalInterest) + '</td><td>' + ord(s) + '</td></tr></tbody></table></div>' +
          '<p class="note">Diferencia en intereses: <b>' + COP(s.totalInterest - a.totalInterest) + '</b>. La avalancha es matemáticamente la más barata; la bola de nieve da victorias rápidas que ayudan a mantener la motivación.</p>';
      } });
  };
  SIMS.prepago = function (h) {
    build(h, { title: 'Abono extra: ¿reducir plazo o reducir cuota?', sub: 'En Colombia (Ley 1555 de 2012) tú decides cómo se aplica un pago anticipado en créditos de consumo y comerciales.',
      fields: [{ id: 'p', label: 'Monto del crédito (COP)', value: 60000000, step: 1000000 }, { id: 'r', label: 'Tasa E.A. (%)', value: 15, step: 0.01 }, { id: 'n', label: 'Plazo (meses)', value: 60, step: 1, min: 2 }, { id: 'a', label: 'Abono después de la cuota número', value: 12, step: 1, min: 1 }, { id: 'x', label: 'Valor del abono extra (COP)', value: 10000000, step: 500000 }],
      compute: function (v) {
        if (v.a >= v.n) return '<p class="note">El abono debe hacerse antes de terminar el plazo.</p>';
        var r = F.prepayCompare(v.p, F.eaToPeriodic(v.r / 100, 12), v.n, Math.round(v.a), v.x);
        return '<div class="table-scroll"><table><thead><tr><th></th><th class="num">Cuota</th><th class="num">Plazo total</th><th class="num">Intereses totales</th><th class="num">Ahorro en intereses</th></tr></thead><tbody>' +
          '<tr><td>Sin abono</td><td class="num">' + COP(r.basePayment) + '</td><td class="num">' + v.n + '</td><td class="num">' + COP(r.baseInterest) + '</td><td class="num">—</td></tr>' +
          '<tr><td>Reducir plazo (misma cuota)</td><td class="num">' + COP(r.reduceTerm.newPayment) + '</td><td class="num">' + r.reduceTerm.months + '</td><td class="num">' + COP(r.reduceTerm.totalInterest) + '</td><td class="num"><b>' + COP(r.reduceTerm.saving) + '</b></td></tr>' +
          '<tr><td>Reducir cuota (mismo plazo)</td><td class="num">' + COP(r.reducePayment.newPayment) + '</td><td class="num">' + v.n + '</td><td class="num">' + COP(r.reducePayment.totalInterest) + '</td><td class="num"><b>' + COP(r.reducePayment.saving) + '</b></td></tr></tbody></table></div>' +
          '<p class="note">Reducir plazo ahorra más intereses; reducir cuota da más aire mensual. Elige según tu flujo de caja.</p>';
      } });
  };
  SIMS.uvr = function (h) {
    build(h, { title: 'Crédito en UVR vs. crédito en pesos a tasa fija', sub: 'Modelo simplificado con inflación constante. En UVR la cuota inicial es menor pero crece con la inflación.',
      fields: [{ id: 'p', label: 'Monto (COP)', value: 150000000, step: 5000000 }, { id: 'u', label: 'Tasa real en UVR (% E.A., sobre UVR)', value: 8.5, step: 0.1 }, { id: 'f', label: 'Tasa fija en pesos (% E.A.)', value: 13.5, step: 0.1 }, { id: 'i', label: 'Inflación anual supuesta (%)', value: 5, step: 0.1 }, { id: 'y', label: 'Años', value: 15, step: 1, min: 1, max: 30 }],
      compute: function (v) {
        var n = v.y * 12, ru = F.scheduleUVR(v.p, v.u / 100, v.i / 100, n), rf = F.scheduleFrench(v.p, F.eaToPeriodic(v.f / 100, 12), n);
        var tu = F.summarize(ru, v.p), tf = F.summarize(rf, v.p);
        var rows = '<div class="table-scroll"><table><thead><tr><th class="num">Año</th><th class="num">Cuota UVR (mes 12 del año)</th><th class="num">Cuota pesos fija</th></tr></thead><tbody>';
        for (var y = 1; y <= v.y; y++) rows += '<tr><td class="num">' + y + '</td><td class="num">' + COP(ru[y * 12 - 1].payment) + '</td><td class="num">' + COP(rf[y * 12 - 1].payment) + '</td></tr>';
        return '<div class="results">' + kpi('Primera cuota UVR', COP(ru[0].payment)) + kpi('Primera cuota pesos', COP(rf[0].payment)) + kpi('Total pagado UVR', COP(tu.totalPaid)) + kpi('Total pagado pesos', COP(tf.totalPaid)) + '</div>' + rows + '</tbody></table></div><p class="note">Con inflación baja el UVR cuesta menos; con inflación alta, más. Prueba subir la inflación a 9 % y mira el efecto. Además, el saldo en pesos puede <i>subir</i> al principio si la inflación supera lo que abonas a capital.</p>';
      } });
  };
  SIMS.hipoteca = function (h) {
    build(h, { title: 'Simulador de vivienda: monto, LTV y cuota', sub: 'La ley limita la primera cuota al 30 % de los ingresos familiares y el monto financiable (en general 70 %; hasta 80 % en VIS). Confirma condiciones con tu entidad.',
      fields: [{ id: 'v', label: 'Valor de la vivienda (COP)', value: 300000000, step: 5000000 }, { id: 'c', label: 'Cuota inicial (%)', value: 30, step: 1 }, { id: 'r', label: 'Tasa E.A. (%)', value: 12.5, step: 0.01 }, { id: 'y', label: 'Años', value: 15, min: 1, max: 30, step: 1 }, { id: 'i', label: 'Ingreso familiar mensual (COP)', value: 9000000, step: 100000 }],
      compute: function (v) {
        var loan = v.v * (1 - v.c / 100), n = v.y * 12, i = F.eaToPeriodic(v.r / 100, 12), cuota = F.paymentFrench(loan, i, n), ratio = cuota / v.i, ltv = F.ltv(loan, v.v);
        var s = F.summarize(F.scheduleFrench(loan, i, n), loan);
        return '<div class="results">' + kpi('Préstamo', COP(loan)) + kpi('LTV (préstamo/valor)', PCT(ltv, 1), ltv > 0.7 ? 'alert' : 'ok') + kpi('Cuota mensual', COP(cuota)) + kpi('Cuota / ingresos', PCT(ratio, 1), ratio > 0.3 ? 'alert' : 'ok') + kpi('Intereses totales', COP(s.totalInterest)) + kpi('Cuota inicial en pesos', COP(v.v * v.c / 100)) + '</div><p class="note">' + (ratio > 0.3 ? '🚩 La primera cuota supera el 30 % de los ingresos familiares: el banco no debería aprobarlo así. Sube la cuota inicial, alarga el plazo o busca una vivienda más barata.' : '✔ Dentro del tope legal del 30 %.') + ' Recuerda presupuestar aparte: escrituración, registro, impuestos, avalúo, seguros (vida y todo riesgo), predial y administración.</p>';
      } });
  };
  SIMS.cobranza = function (h) {
    var hours = [];
    for (var k = 6; k <= 21; k++) { hours.push([k, (k < 10 ? '0' : '') + k + ':00']); }
    build(h, { title: '¿Pueden contactarme ahora? (Ley 2300 de 2023)', sub: 'Horarios de contacto para cobranza. Elige día y hora.',
      fields: [{ id: 'd', label: 'Día', value: 'lv', opts: [['lv', 'Lunes a viernes'], ['sa', 'Sábado'], ['do', 'Domingo'], ['fe', 'Día festivo']] }, { id: 'h', label: 'Hora', value: 16, opts: hours }],
      compute: function (v) {
        var ok = (v.d === 'lv' && v.h >= 7 && v.h < 19) || (v.d === 'sa' && v.h >= 8 && v.h < 15);
        return '<div class="results">' + kpi(ok ? 'Contacto permitido' : 'Contacto NO permitido', ok ? '✔' : '✘', ok ? 'ok' : 'alert') + '</div><p class="note">Horario: lunes a viernes 7:00 a. m. – 7:00 p. m.; sábados 8:00 a. m. – 3:00 p. m.; nunca domingos ni festivos. Solo por canales que tú autorizaste, un contacto por día, sin llamar a tus referencias ni ir a tu casa o trabajo (con excepciones puntuales para algunos microcréditos y rurales). Si te incumplen, puedes quejarte ante la Superfinanciera o la SIC.</p>';
      } });
  };
  SIMS.plan = function (h) {
    var p = window.Course.load(), pl = p.plan || {};
    var fields = [{ id: 'i', label: 'Ingreso mensual neto (COP)', value: pl.i || 3500000, step: 100000 }, { id: 'g', label: 'Gastos fijos esenciales mensuales (COP)', value: pl.g || 1800000, step: 100000 }, { id: 'd', label: 'Cuotas de deudas por mes (COP)', value: pl.d || 400000, step: 10000 }, { id: 'a', label: 'Ahorro mensual actual (COP)', value: pl.a || 200000, step: 10000 }, { id: 'e', label: 'Fondo de emergencia actual (COP)', value: pl.e || 500000, step: 100000 }, { id: 't', label: 'Saldo total de deudas (COP)', value: pl.t || 6000000, step: 100000 }];
    var b = build(h, { title: 'Tu plan de vida crediticia', sub: 'Se guarda solo en este navegador. Tus datos no se envían a ningún servidor.', fields: fields,
      compute: function (v) {
        var dti = F.debtToIncome(v.d, v.i), free = v.i - v.g - v.d - v.a, fondo = v.g * 4;
        return '<div class="results">' + kpi('Deuda / ingreso', PCT(dti, 1), dti <= 0.3 ? 'ok' : dti <= 0.4 ? '' : 'alert') + kpi('Te sobra al mes (después de ahorro)', COP(free), free < 0 ? 'alert' : 'ok') + kpi('Meta de fondo de emergencia (4 meses)', COP(fondo)) + kpi('Cobertura actual', (v.g > 0 ? (v.e / v.g).toFixed(1) : '—') + ' meses') + kpi('Meses de ingreso que debes', v.i > 0 ? (v.t / v.i).toFixed(1) : '—') + '</div>';
      } });
    var box = el('div', 'field', '<label>Mi meta financiera a 12 meses</label><input type="text" id="pl_meta" value="' + (pl.meta || '') + '" placeholder="Ej: reunir un fondo de emergencia de 3 meses"><label style="margin-top:8px">Mi regla personal de endeudamiento</label><input type="text" id="pl_regla" value="' + (pl.regla || '') + '" placeholder="Ej: nunca más del 30 % de mis ingresos en cuotas"><label style="margin-top:8px">Mis 3 acciones para los próximos 30 días</label><textarea id="pl_acc" rows="3" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit" placeholder="1) Consultar mi reporte gratis en Datacrédito y TransUnion&#10;2) ...&#10;3) ...">' + (pl.acc || '') + '</textarea>');
    h.appendChild(box);
    var btn = el('button', 'btn', '💾 Guardar mi plan'); btn.style.marginTop = '12px';
    var pr = el('button', 'btn', '🖨 Imprimir / guardar PDF'); pr.style.cssText = 'margin:12px 0 0 8px;background:var(--line);color:var(--ink)';
    var msg = el('p', 'note', '');
    h.appendChild(btn); h.appendChild(pr); h.appendChild(msg);
    pr.onclick = function () { window.print(); };
    btn.onclick = function () {
      var v = b.vals(), meta = document.getElementById('pl_meta').value.trim(), regla = document.getElementById('pl_regla').value.trim(), acc = document.getElementById('pl_acc').value.trim();
      if (!meta || !regla || acc.length < 10) { msg.textContent = 'Completa tu meta, tu regla personal y al menos una acción.'; return; }
      var p2 = window.Course.load(); p2.plan = { i: v.i, g: v.g, d: v.d, a: v.a, e: v.e, t: v.t, meta: meta, regla: regla, acc: acc, fecha: new Date().toISOString().slice(0, 10) };
      var m = p2.mods.m14 || {}; if (m.quizPassed) m.done = true; p2.mods.m14 = m;
      window.Course.save(p2); window.Course.updateTop(); msg.textContent = '✅ Plan guardado' + (m.done ? ' y módulo completado.' : '. Ahora aprueba el cuestionario para completar el módulo.');
    };
  };

  function init() {
    document.querySelectorAll('[data-sim]').forEach(function (n, k) {
      var name = n.getAttribute('data-sim');
      if (!n.id) n.id = 'sim_' + name + '_' + k;
      if (SIMS[name]) SIMS[name](n);
    });
  }
  window.SIMS = SIMS;
  document.addEventListener('DOMContentLoaded', init);
})();
