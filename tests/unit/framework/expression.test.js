import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseExpression, isExpression, ExpressionError } from '../../../framework/v1/expression.js';

const close = (actual, expected, msg) => {
  assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${msg}: got ${actual}, want ${expected}`);
};

// [expression, State snapshot, value] — values worked out by hand.
const table = [
  ['42', {}, 42],
  ['1.5', {}, 1.5],
  ['.25', {}, 0.25],
  ['2e3', {}, 2000],
  ['1.5E-2', {}, 0.015],
  ['I * 1000', { I: 0.0042 }, 4.2],
  ['V_L - V_C', { V_L: 5, V_C: 3 }, 2],
  // precedence
  ['1 + 2 * 3', {}, 7],
  ['(1 + 2) * 3', {}, 9],
  ['10 - 4 - 3', {}, 3],
  ['12 / 3 / 2', {}, 2],
  ['2 * 3 ^ 2', {}, 18],
  ['1 + 2 ^ 3 * 2', {}, 17],
  // ^ is right-associative
  ['2 ^ 3 ^ 2', {}, 512],
  ['(2 ^ 3) ^ 2', {}, 64],
  // unary minus
  ['-3', {}, -3],
  ['--3', {}, 3],
  ['-x', { x: 4 }, -4],
  ['-2 ^ 2', {}, -4],
  ['(-2) ^ 2', {}, 4],
  ['2 ^ -1', {}, 0.5],
  ['3 * -2', {}, -6],
  ['4 − 1', {}, 3], // the typographic minus sign
  // constants
  ['pi', {}, Math.PI],
  ['e', {}, Math.E],
  ['2 * pi * f', { f: 50 }, 100 * Math.PI],
  // every function
  ['sqrt(16)', {}, 4],
  ['abs(-2.5)', {}, 2.5],
  ['exp(1)', {}, Math.E],
  ['ln(e ^ 2)', {}, 2],
  ['log10(1000)', {}, 3],
  ['sin(pi / 2)', {}, 1],
  ['cos(pi)', {}, -1],
  ['tan(pi / 4)', {}, Math.tan(Math.PI / 4)],
  ['asin(1)', {}, Math.PI / 2],
  ['acos(-1)', {}, Math.PI],
  ['atan(1)', {}, Math.PI / 4],
  ['atan2(1, -1)', {}, 3 * Math.PI / 4],
  ['min(3, -1, 2)', {}, -1],
  ['max(3, -1, 2)', {}, 3],
  ['min(7)', {}, 7],
  // deg and rad
  ['deg(pi)', {}, 180],
  ['rad(90)', {}, Math.PI / 2],
  ['deg(atan2(Vy, Vx))', { Vx: 0, Vy: -2 }, -90],
  ['sin(rad(30))', {}, 0.5],
  ['1 / sqrt(L * C)', { L: 0.01, C: 1e-6 }, 10000],
];

test('expressions evaluate to the expected values against a State snapshot', () => {
  for (const [source, state, value] of table) close(parseExpression(source).evaluate(state), value, source);
});

test('an expression parses once and evaluates against any number of snapshots', () => {
  const expr = parseExpression('I * 1000');
  assert.equal(expr.evaluate({ I: 0.002 }), 2);
  assert.equal(expr.evaluate({ I: 0.005 }), 5);
  assert.equal(expr.source, 'I * 1000');
});

test('an expression lists the State names it uses, once each, without constants or functions', () => {
  assert.deepEqual(parseExpression('1 / sqrt(L * C) + L - pi * e').names, ['L', 'C']);
  assert.deepEqual(parseExpression('3 * 4').names, []);
});

test('a parse error is an ExpressionError that gives its position', () => {
  const cases = [
    ['', 0],
    ['1 +', 3],
    ['2 * (3 + 4', 10],
    ['2 $ 3', 2],
    ['3 4', 2],
    ['foo(2)', 0],
    ['sqrt(1, 2)', 0],
    ['atan2(1)', 0],
    ['max()', 0],
    ['1 + )', 4],
    ['sin', 3],
  ];
  for (const [source, position] of cases) {
    assert.throws(() => parseExpression(source), (err) => {
      assert.ok(err instanceof ExpressionError, `${source}: ${err}`);
      assert.equal(err.position, position, `${source}: ${err.message}`);
      return true;
    });
  }
});

test('only strings parse', () => {
  assert.throws(() => parseExpression(42), ExpressionError);
});

test('an unknown State name is an ExpressionError naming it when evaluated', () => {
  const expr = parseExpression('I * R');
  assert.throws(() => expr.evaluate({ I: 1 }), (err) => err instanceof ExpressionError && err.message.includes('"R"'));
});

test('a State that is not a number is an ExpressionError naming it', () => {
  assert.throws(() => parseExpression('on + 1').evaluate({ on: true }), (err) => err instanceof ExpressionError && err.message.includes('"on"'));
});

test('a non-finite result is returned as it is, for the caller to judge', () => {
  assert.equal(parseExpression('1 / x').evaluate({ x: 0 }), Infinity);
  assert.ok(Number.isNaN(parseExpression('sqrt(-1)').evaluate({})));
});

test('inputs that would need eval are refused', () => {
  for (const source of ['alert(1)', 'x.constructor', 'this', '[1]', "'a'", 'x = 1', 'constructor(1)', '__proto__']) {
    assert.throws(() => parseExpression(source).evaluate({ x: 1 }), ExpressionError, source);
  }
  const src = readFileSync(new URL('../../../framework/v1/expression.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\beval\s*\(|\bFunction\s*\(/);
});

test('isExpression recognises an { expr } value', () => {
  assert.equal(isExpression({ expr: 'I * 1000' }), true);
  for (const v of [3, 'I', null, {}, { expr: 3 }, [{ expr: 'x' }]]) assert.equal(isExpression(v), false);
});
