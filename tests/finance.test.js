// Ejecutar: node tests/finance.test.js
const assert = require('assert');
const F = require('../js/finance.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} esperado ${b}, obtenido ${a}`);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('EA -> mensual -> EA es consistente', () => {
  const m = F.eaToPeriodic(0.2682, 12);            // 26.82% EA ~ 2% mensual
  near(m, 0.02, 1e-4, 'mensual');
  near(F.periodicToEA(0.02, 12), 0.268242, 1e-6, 'EA');
});
t('Nominal 24% capitalizable mensual = 26.8242% EA', () => near(F.nominalToEA(0.24, 12), 0.268242, 1e-6));
t('EA -> nominal mensual vencida', () => near(F.eaToNominal(0.268242, 12), 0.24, 1e-6));
t('Anticipada 2% -> vencida 2.0408%', () => near(F.anticipatedToVencida(0.02), 0.020408, 1e-6));
t('Vencida -> anticipada ida y vuelta', () => near(F.vencidaToAnticipated(F.anticipatedToVencida(0.015)), 0.015, 1e-12));

t('Cuota francesa: 10.000.000, 1,5% mensual, 12 meses = 916.800', () => {
  near(F.paymentFrench(10000000, 0.015, 12), 916799.8, 1, 'cuota');
});
t('Cuota francesa tasa 0 = P/n', () => near(F.paymentFrench(1200, 0, 12), 100, 1e-9));
t('Tabla francesa: saldo final 0 y capital suma P', () => {
  const rows = F.scheduleFrench(50000000, 0.012, 60);
  assert.strictEqual(rows.length, 60);
  near(rows[59].balance, 0, 0.01, 'saldo final');
  near(rows.reduce((s, r) => s + r.principal, 0), 50000000, 0.5, 'capital');
  // todas las cuotas iguales
  near(rows[0].payment, rows[59].payment, 0.5, 'cuotas iguales');
});
t('Tabla alemana: capital constante, cuota decrece, saldo final 0', () => {
  const rows = F.scheduleGerman(12000000, 0.02, 12);
  near(rows[0].principal, 1000000, 1e-6);
  assert.ok(rows[0].payment > rows[11].payment);
  near(rows[11].balance, 0, 1e-6);
  near(rows[0].interest, 240000, 1e-6);
});
t('Alemán paga menos intereses totales que el francés', () => {
  const a = F.summarize(F.scheduleFrench(20000000, 0.015, 36), 20000000).totalInterest;
  const b = F.summarize(F.scheduleGerman(20000000, 0.015, 36), 20000000).totalInterest;
  assert.ok(b < a);
});
t('Solo intereses: capital se paga al final', () => {
  const rows = F.scheduleInterestOnly(1000000, 0.01, 6);
  near(rows[0].payment, 10000, 1e-6); near(rows[5].payment, 1010000, 1e-6);
});
t('Bullet: capital*(1+i)^n', () => {
  const rows = F.scheduleBullet(1000000, 0.01, 12);
  near(rows[11].payment, 1000000 * Math.pow(1.01, 12), 1e-4);
});
t('Gradiente: saldo final 0 y primera cuota menor que la fija', () => {
  const rows = F.scheduleGradient(100000000, 0.01, 120, 0.003);
  near(rows[119].balance, 0, 0.01);
  assert.ok(rows[0].payment < F.paymentFrench(100000000, 0.01, 120));
});
t('Abono extra mensual acorta el plazo', () => {
  const rows = F.scheduleFrench(20000000, 0.015, 36, { extra: 200000 });
  assert.ok(rows.length < 36);
  near(rows[rows.length - 1].balance, 0, 0.01);
});
t('Seguro y cargos aumentan el pago pero no cambian el capital', () => {
  const rows = F.scheduleFrench(10000000, 0.015, 12, { insuranceRate: 0.0005, monthlyFee: 5000 });
  assert.ok(rows[0].payment > rows[0].base);
  near(rows[0].insurance, 5000, 1e-6); near(rows[0].fee, 5000, 1e-6);
});
t('TIR sin costos extra = tasa nominal del crédito', () => {
  const r = F.costoEfectivoAnual(10000000, 0.015, 24);
  near(r.monthly, 0.015, 1e-6); near(r.ea, F.periodicToEA(0.015, 12), 1e-5);
});
t('TIR con comisión y seguro es mayor que la tasa pactada', () => {
  const r = F.costoEfectivoAnual(10000000, 0.015, 24, { upfrontFee: 200000, insuranceRate: 0.0006, monthlyFee: 8000 });
  assert.ok(r.monthly > 0.015);
});
t('Tarjeta: solo mínimo toma mucho más y cuesta más que pago fijo alto', () => {
  const a = F.cardMinimumOnly(5000000, 0.28, { minPct: 0.03 });
  const b = F.cardFixedPayment(5000000, 0.28, 500000);
  assert.ok(a.converged && b.converged);
  assert.ok(a.months > b.months); assert.ok(a.totalInterest > b.totalInterest);
});
t('Tarjeta: pago fijo menor al interés nunca termina', () => {
  const r = F.cardFixedPayment(5000000, 0.28, 50000);
  assert.strictEqual(r.converged, false);
});
t('Tarjeta pago fijo verifica fórmula cerrada', () => {
  const i = F.eaToPeriodic(0.30, 12), P = 3000000, pay = 300000;
  const nExact = -Math.log(1 - P * i / pay) / Math.log(1 + i);
  const r = F.cardFixedPayment(P, 0.30, pay);
  assert.ok(Math.abs(r.months - Math.ceil(nExact)) <= 1, `${r.months} vs ${nExact}`);
});
t('Avalancha cuesta <= bola de nieve en intereses', () => {
  const debts = [
    { name: 'Tarjeta', balance: 4000000, ea: 0.28, minPayment: 150000 },
    { name: 'Libre inversión', balance: 15000000, ea: 0.20, minPayment: 500000 },
    { name: 'Almacén', balance: 1200000, ea: 0.25, minPayment: 100000 }];
  const av = F.payoffPlan(debts, 1000000, 'avalanche');
  const sn = F.payoffPlan(debts, 1000000, 'snowball');
  assert.ok(av.feasible && sn.feasible);
  assert.ok(av.totalInterest <= sn.totalInterest + 1);
  assert.strictEqual(sn.order[0].name, 'Almacén');
});
t('Plan de pagos con presupuesto menor al mínimo es inviable', () => {
  const r = F.payoffPlan([{ name: 'a', balance: 1e6, ea: 0.2, minPayment: 100000 }], 50000, 'avalanche');
  assert.strictEqual(r.feasible, false);
});
t('Prepago: ambas opciones ahorran intereses; reducir plazo ahorra más', () => {
  const r = F.prepayCompare(60000000, 0.012, 60, 12, 10000000);
  assert.ok(r.reduceTerm.saving > 0 && r.reducePayment.saving > 0);
  assert.ok(r.reduceTerm.saving > r.reducePayment.saving);
  assert.ok(r.reduceTerm.months < 60); assert.ok(r.reducePayment.newPayment < r.basePayment);
});
t('UVR: la cuota en pesos crece con la inflación; saldo en UVR llega a 0', () => {
  const rows = F.scheduleUVR(100000000, 0.09, 0.05, 120);
  assert.ok(rows[119].payment > rows[0].payment);
  near(rows[119].balanceUVR, 0, 1e-3);
});
t('UVR con inflación 0 = francés', () => {
  const rows = F.scheduleUVR(100000000, 0.09, 0, 120);
  near(rows[0].payment, F.paymentFrench(100000000, F.eaToPeriodic(0.09, 12), 120), 1e-3);
});
t('Capacidad: 30% de 5.000.000 con deuda 500.000 = 1.000.000', () => near(F.maxNewPayment(5000000, 500000, 0.30), 1000000, 1e-9));
t('maxLoan es inverso de paymentFrench', () => {
  const p = F.paymentFrench(30000000, 0.013, 48);
  near(F.maxLoan(p, 0.013, 48), 30000000, 1e-4);
});
t('Valor futuro y poder adquisitivo', () => {
  near(F.futureValue(1000000, 0.1, 2), 1210000, 1e-6);
  near(F.purchasingPower(1000000, 0.05, 10), 613913.25, 0.5);
});
t('Ahorro: aporte necesario reproduce la meta', () => {
  const need = F.savingsNeeded(10000000, 0.08, 24, 500000);
  near(F.savingsFV(need, 0.08, 24, 500000), 10000000, 0.5);
});
t('LTV', () => near(F.ltv(280000000, 400000000), 0.7, 1e-12));
t('Formato COP / porcentaje', () => {
  assert.ok(F.fmtCOP(1234567).includes('1.234.567'));
  assert.ok(F.fmtPct(0.2834).includes('28,34'));
});
console.log(`\n${n} pruebas pasaron`);
