/* Matemática financiera del curso. Funciones puras, sin DOM.
   Se usan en el navegador (window.Fin) y en las pruebas con Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fin = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Conversión de tasas ---------- */
  // EA -> tasa periódica (m = periodos por año). Ej: m=12 mensual vencida.
  function eaToPeriodic(ea, m) { return Math.pow(1 + ea, 1 / m) - 1; }
  // Tasa periódica -> EA
  function periodicToEA(i, m) { return Math.pow(1 + i, m) - 1; }
  // Nominal anual (con capitalización m veces al año) -> EA
  function nominalToEA(nom, m) { return Math.pow(1 + nom / m, m) - 1; }
  // EA -> nominal anual (período vencido)
  function eaToNominal(ea, m) { return m * eaToPeriodic(ea, m); }
  // Tasa periódica anticipada (d) -> periódica vencida (i): i = d / (1 - d)
  function anticipatedToVencida(d) { return d / (1 - d); }
  // Periódica vencida -> anticipada: d = i / (1 + i)
  function vencidaToAnticipated(i) { return i / (1 + i); }

  /* ---------- Cuota y amortización ---------- */
  // Cuota fija (sistema francés). i = tasa periódica, n = número de cuotas.
  function paymentFrench(P, i, n) {
    if (n <= 0) return 0;
    if (i === 0) return P / n;
    return P * i / (1 - Math.pow(1 + i, -n));
  }

  function round2(x) { return Math.round(x * 100) / 100; }

  function summarize(rows, P) {
    var totalInt = 0, totalPaid = 0, totalIns = 0, totalFees = 0;
    rows.forEach(function (r) {
      totalInt += r.interest; totalPaid += r.payment;
      totalIns += (r.insurance || 0); totalFees += (r.fee || 0);
    });
    return {
      totalInterest: totalInt, totalInsurance: totalIns, totalFees: totalFees,
      totalPaid: totalPaid, months: rows.length,
      totalCost: totalPaid - P // todo lo que se paga por encima de lo prestado
    };
  }

  /* Opciones comunes:
     insuranceRate: seguro mensual como fracción del saldo (ej. 0.0004 = 0,04% mensual)
     monthlyFee: cargo fijo mensual en COP (ej. cuota de manejo, seguro de vida fijo)
     extra: abono extra mensual a capital (COP)
  */
  function scheduleFrench(P, i, n, opt) {
    opt = opt || {};
    var rows = [], bal = P, pay = paymentFrench(P, i, n), k = 0;
    while (bal > 0.005 && k < n + 600) {
      k++;
      var interest = bal * i;
      var principal = Math.min(bal, pay - interest + (opt.extra || 0));
      if (principal < 0) principal = 0;
      var ins = bal * (opt.insuranceRate || 0);
      var fee = opt.monthlyFee || 0;
      var payment = interest + principal;
      bal -= principal;
      if (bal < 0.005) bal = 0;
      rows.push({ n: k, payment: payment + ins + fee, base: payment, interest: interest,
        principal: principal, insurance: ins, fee: fee, balance: bal });
      if (k >= n && !(opt.extra > 0)) break;
    }
    return rows;
  }

  // Abono constante a capital (sistema alemán)
  function scheduleGerman(P, i, n, opt) {
    opt = opt || {};
    var rows = [], bal = P, cap = P / n;
    for (var k = 1; k <= n; k++) {
      var interest = bal * i;
      var ins = bal * (opt.insuranceRate || 0);
      var fee = opt.monthlyFee || 0;
      bal -= cap; if (bal < 0.005) bal = 0;
      rows.push({ n: k, payment: cap + interest + ins + fee, base: cap + interest,
        interest: interest, principal: cap, insurance: ins, fee: fee, balance: bal });
    }
    return rows;
  }

  // Pago único al vencimiento: se pagan intereses cada mes y el capital al final
  function scheduleInterestOnly(P, i, n, opt) {
    opt = opt || {};
    var rows = [];
    for (var k = 1; k <= n; k++) {
      var interest = P * i, ins = P * (opt.insuranceRate || 0), fee = opt.monthlyFee || 0;
      var cap = (k === n) ? P : 0;
      rows.push({ n: k, payment: interest + cap + ins + fee, base: interest + cap,
        interest: interest, principal: cap, insurance: ins, fee: fee,
        balance: (k === n) ? 0 : P });
    }
    return rows;
  }

  // Bullet total: todo (capital + intereses compuestos) se paga al final
  function scheduleBullet(P, i, n) {
    var total = P * Math.pow(1 + i, n);
    var rows = [];
    for (var k = 1; k <= n; k++) {
      var last = k === n;
      rows.push({ n: k, payment: last ? total : 0, base: last ? total : 0,
        interest: last ? total - P : 0, principal: last ? P : 0, insurance: 0, fee: 0,
        balance: last ? 0 : P * Math.pow(1 + i, k) });
    }
    return rows;
  }

  // Cuota que crece un % fijo cada año (cuota gradiente geométrica): se calcula la 1a cuota
  // para amortizar P con cuotas mensuales que suben g por mes.
  function scheduleGradient(P, i, n, g) {
    var c1;
    if (Math.abs(i - g) < 1e-12) c1 = P * (1 + i) / n;
    else c1 = P * (i - g) / (1 - Math.pow((1 + g) / (1 + i), n));
    var rows = [], bal = P, c = c1;
    for (var k = 1; k <= n; k++) {
      var interest = bal * i, principal = c - interest;
      bal -= principal; if (k === n || bal < 0.005) { principal += bal; bal = 0; }
      rows.push({ n: k, payment: c, base: c, interest: interest, principal: principal,
        insurance: 0, fee: 0, balance: bal });
      c = c * (1 + g);
    }
    return rows;
  }

  /* ---------- Costo efectivo (TIR) ---------- */
  // flows[0] = dinero recibido (positivo), resto = pagos (negativos). Devuelve tasa mensual.
  function irr(flows) {
    function npv(r) {
      var s = 0;
      for (var t = 0; t < flows.length; t++) s += flows[t] / Math.pow(1 + r, t);
      return s;
    }
    var lo = 0, hi = 5; // 0 % a 500 % mensual
    if (npv(lo) >= 0) return 0; // no hay costo financiero
    for (var it = 0; it < 200; it++) {
      var mid = (lo + hi) / 2;
      if (npv(mid) < 0) lo = mid; else hi = mid; // VPN crece con la tasa
    }
    return (lo + hi) / 2;
  }

  // Costo efectivo anual de un crédito con seguros/comisiones.
  // upfrontFee: comisión o estudio de crédito descontado al desembolso.
  function costoEfectivoAnual(P, iMonthly, n, opt) {
    opt = opt || {};
    var rows = scheduleFrench(P, iMonthly, n, opt);
    var flows = [P - (opt.upfrontFee || 0)];
    rows.forEach(function (r) { flows.push(-r.payment); });
    var m = irr(flows);
    return { monthly: m, ea: periodicToEA(m, 12), rows: rows };
  }

  /* ---------- Tarjeta de crédito ---------- */
  // Simula pagar solo el mínimo. minPct = % del saldo + intereses (como lo hacen varios emisores)
  // mode 'interest+pct': mínimo = interés + minPct * saldo;  'pct': mínimo = minPct * saldo (+ intereses no cubiertos)
  function cardMinimumOnly(balance, ea, opt) {
    opt = opt || {};
    var i = eaToPeriodic(ea, 12), minPct = opt.minPct == null ? 0.05 : opt.minPct;
    var floor = opt.floor == null ? 0 : opt.floor, fee = opt.monthlyFee || 0;
    var months = 0, totalInt = 0, totalPaid = 0, bal = balance;
    while (bal > 1 && months < 1200) {
      months++;
      var interest = bal * i;
      var min = Math.max(interest + minPct * bal, floor);
      if (min > bal + interest) min = bal + interest;
      totalInt += interest; totalPaid += min + fee;
      bal = bal + interest - min;
    }
    return { months: months, totalInterest: totalInt, totalPaid: totalPaid + 0, converged: bal <= 1 };
  }

  // Pagando una cuota fija mensual (si es menor al interés, nunca se acaba)
  function cardFixedPayment(balance, ea, payment) {
    var i = eaToPeriodic(ea, 12), bal = balance, months = 0, totalInt = 0;
    if (payment <= balance * i) return { months: Infinity, totalInterest: Infinity, totalPaid: Infinity, converged: false };
    while (bal > 0.5 && months < 1200) {
      months++;
      var interest = bal * i; totalInt += interest;
      var pay = Math.min(payment, bal + interest);
      bal = bal + interest - pay;
    }
    return { months: months, totalInterest: totalInt, totalPaid: balance + totalInt, converged: true };
  }

  /* ---------- Estrategias de pago de varias deudas ---------- */
  // debts: [{name, balance, ea, minPayment}]; budget = dinero total mensual para deudas
  // strategy: 'avalanche' (mayor tasa primero) | 'snowball' (menor saldo primero)
  function payoffPlan(debts, budget, strategy) {
    var ds = debts.map(function (d) { return { name: d.name, balance: d.balance, i: eaToPeriodic(d.ea, 12), min: d.minPayment, ea: d.ea }; });
    var totalMin = ds.reduce(function (s, d) { return s + d.min; }, 0);
    if (budget < totalMin) return { feasible: false, reason: 'El presupuesto es menor que la suma de los pagos mínimos.' };
    var months = 0, totalInt = 0, order = [], timeline = [];
    while (ds.some(function (d) { return d.balance > 0.5; }) && months < 1200) {
      months++;
      var avail = budget;
      ds.forEach(function (d) {
        if (d.balance <= 0.5) return;
        var interest = d.balance * d.i; totalInt += interest; d.balance += interest;
        var pay = Math.min(d.min, d.balance); d.balance -= pay; avail -= pay;
      });
      var active = ds.filter(function (d) { return d.balance > 0.5; });
      active.sort(function (a, b) {
        return strategy === 'snowball' ? a.balance - b.balance : b.i - a.i;
      });
      for (var k = 0; k < active.length && avail > 0.005; k++) {
        var p = Math.min(avail, active[k].balance); active[k].balance -= p; avail -= p;
      }
      ds.forEach(function (d) {
        if (d.balance <= 0.5 && !d.done) { d.done = true; d.balance = 0; order.push({ name: d.name, month: months }); }
      });
    }
    return { feasible: months < 1200, months: months, totalInterest: totalInt, order: order };
  }

  /* ---------- Prepago: reducir plazo vs reducir cuota ---------- */
  // Abona 'extra' al capital después de 'afterMonth' cuotas pagadas.
  function prepayCompare(P, i, n, afterMonth, extra) {
    var base = scheduleFrench(P, i, n);
    var baseInt = base.reduce(function (s, r) { return s + r.interest; }, 0);
    var pay = paymentFrench(P, i, n);
    var bal = base[afterMonth - 1].balance;
    var newBal = Math.max(0, bal - extra);
    var remaining = n - afterMonth;
    var paidInt = base.slice(0, afterMonth).reduce(function (s, r) { return s + r.interest; }, 0);
    // Opción A: misma cuota, menos plazo
    var k = 0, b = newBal, intA = 0;
    while (b > 0.5 && k < 1200) { k++; var it = b * i; intA += it; var pp = Math.min(pay, b + it); b = b + it - pp; }
    // Opción B: mismo plazo, menor cuota
    var newPay = paymentFrench(newBal, i, remaining);
    var intB = newPay * remaining - newBal;
    return {
      baseInterest: baseInt, basePayment: pay,
      reduceTerm: { months: afterMonth + k, newPayment: pay, totalInterest: paidInt + intA, saving: baseInt - (paidInt + intA), monthsSaved: n - (afterMonth + k) },
      reducePayment: { months: n, newPayment: newPay, totalInterest: paidInt + intB, saving: baseInt - (paidInt + intB), monthsSaved: 0 }
    };
  }

  /* ---------- UVR (crédito indexado a la inflación) ---------- */
  // P en COP, iEA = tasa real EA sobre la UVR, inflEA = inflación anual supuesta, n meses.
  function scheduleUVR(P, iEA, inflEA, n) {
    var iM = eaToPeriodic(iEA, 12), infM = eaToPeriodic(inflEA, 12);
    var uvr0 = 1; // normalizamos: 1 UVR = 1 COP al inicio para ver el efecto relativo
    var balU = P / uvr0, cuotaU = paymentFrench(balU, iM, n), rows = [];
    var uvr = uvr0;
    for (var k = 1; k <= n; k++) {
      uvr = uvr * (1 + infM);
      var interestU = balU * iM, capU = cuotaU - interestU;
      balU -= capU; if (balU < 1e-6) balU = 0;
      rows.push({ n: k, payment: cuotaU * uvr, base: cuotaU * uvr, interest: interestU * uvr,
        principal: capU * uvr, insurance: 0, fee: 0, balance: balU * uvr, balanceUVR: balU, uvr: uvr });
    }
    return rows;
  }

  /* ---------- Capacidad de endeudamiento ---------- */
  function debtToIncome(monthlyDebt, monthlyIncome) { return monthlyIncome > 0 ? monthlyDebt / monthlyIncome : NaN; }
  // Cuota máxima = (tope % * ingreso) - deudas actuales
  function maxNewPayment(income, currentDebtPayments, cap) {
    return Math.max(0, income * cap - currentDebtPayments);
  }
  // Monto máximo que se puede pedir con una cuota máxima dada
  function maxLoan(payment, i, n) {
    if (i === 0) return payment * n;
    return payment * (1 - Math.pow(1 + i, -n)) / i;
  }

  /* ---------- Valor del dinero en el tiempo ---------- */
  function futureValue(PV, rate, years) { return PV * Math.pow(1 + rate, years); }
  function presentValue(FV, rate, years) { return FV / Math.pow(1 + rate, years); }
  // Poder adquisitivo de un monto tras 'years' años con inflación 'infl'
  function purchasingPower(amount, infl, years) { return amount / Math.pow(1 + infl, years); }
  // Ahorro mensual con aportes al final de cada mes y tasa EA
  function savingsFV(monthly, ea, months, initial) {
    var i = eaToPeriodic(ea, 12), fv = (initial || 0) * Math.pow(1 + i, months);
    fv += i === 0 ? monthly * months : monthly * (Math.pow(1 + i, months) - 1) / i;
    return fv;
  }
  // Aporte mensual necesario para llegar a una meta
  function savingsNeeded(goal, ea, months, initial) {
    var i = eaToPeriodic(ea, 12);
    var remaining = goal - (initial || 0) * Math.pow(1 + i, months);
    if (remaining <= 0) return 0;
    return i === 0 ? remaining / months : remaining * i / (Math.pow(1 + i, months) - 1);
  }

  /* ---------- Hipotecario ---------- */
  function ltv(loan, propertyValue) { return loan / propertyValue; }

  /* ---------- Formato ---------- */
  function fmtCOP(x) {
    if (!isFinite(x)) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(x));
  }
  function fmtPct(x, d) {
    if (!isFinite(x)) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'percent', minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }).format(x);
  }

  return {
    eaToPeriodic: eaToPeriodic, periodicToEA: periodicToEA, nominalToEA: nominalToEA, eaToNominal: eaToNominal,
    anticipatedToVencida: anticipatedToVencida, vencidaToAnticipated: vencidaToAnticipated,
    paymentFrench: paymentFrench, scheduleFrench: scheduleFrench, scheduleGerman: scheduleGerman,
    scheduleInterestOnly: scheduleInterestOnly, scheduleBullet: scheduleBullet, scheduleGradient: scheduleGradient,
    summarize: summarize, irr: irr, costoEfectivoAnual: costoEfectivoAnual,
    cardMinimumOnly: cardMinimumOnly, cardFixedPayment: cardFixedPayment, payoffPlan: payoffPlan,
    prepayCompare: prepayCompare, scheduleUVR: scheduleUVR,
    debtToIncome: debtToIncome, maxNewPayment: maxNewPayment, maxLoan: maxLoan,
    futureValue: futureValue, presentValue: presentValue, purchasingPower: purchasingPower,
    savingsFV: savingsFV, savingsNeeded: savingsNeeded, ltv: ltv, fmtCOP: fmtCOP, fmtPct: fmtPct, round2: round2
  };
});
