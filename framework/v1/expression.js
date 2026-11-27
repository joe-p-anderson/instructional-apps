// State expressions (ADR 0005): a small arithmetic language over named State, used for
// answer keys (and Condition values) worked out at Submit. Pure JS, no DOM, and no
// eval or Function: the source is parsed into a tree, which is then walked.
//
//   parseExpression(source)   // -> { source, names, evaluate(state) }; throws ExpressionError
//     names                   // the State names it uses, in order of first use, once each
//     evaluate(state)         // the value against a State snapshot ({ [name]: value });
//                             // throws ExpressionError for an unknown or non-numeric State.
//                             // A non-finite result (1/0, sqrt(-1)) is returned as it is:
//                             // the caller decides how to judge it.
//   cachedExpression(source)  // parseExpression, parsed once per source
//   isExpression(value)     // true for an { expr: string } value, as stored in an Activity
//   ExpressionError           // .position: index into the source of a parse error (else undefined)
//
// Syntax:
//   numbers (12, 1.5, .5, 2e-3), State names ([A-Za-z_][A-Za-z0-9_]*), parentheses,
//   + - * / (the typographic minus − is also accepted), ^ for powers (right-associative,
//   binding tighter than unary minus: -2^2 = -4, 2^-1 = 0.5);
//   constants pi and e; functions sqrt abs exp ln log10 sin cos tan asin acos atan
//   atan2(y, x) min(...) max(...) deg rad. Trig is in radians; deg() and rad() convert.
//   Constant and function names are reserved: they never name State.

export class ExpressionError extends Error {
  constructor(message, position) {
    super(message);
    this.name = 'ExpressionError';
    this.position = position;
  }
}

export const isExpression = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value) && typeof value.expr === 'string';

const CONSTANTS = { pi: Math.PI, e: Math.E };

// name: [fn, minimum arguments, maximum arguments]
const FUNCTIONS = {
  sqrt: [Math.sqrt, 1, 1],
  abs: [Math.abs, 1, 1],
  exp: [Math.exp, 1, 1],
  ln: [Math.log, 1, 1],
  log10: [Math.log10, 1, 1],
  sin: [Math.sin, 1, 1],
  cos: [Math.cos, 1, 1],
  tan: [Math.tan, 1, 1],
  asin: [Math.asin, 1, 1],
  acos: [Math.acos, 1, 1],
  atan: [Math.atan, 1, 1],
  atan2: [Math.atan2, 2, 2],
  min: [Math.min, 1, Infinity],
  max: [Math.max, 1, Infinity],
  deg: [(x) => (x * 180) / Math.PI, 1, 1],
  rad: [(x) => (x * Math.PI) / 180, 1, 1],
};

const BINARY = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '^': (a, b) => a ** b,
};

// parseExpression, remembered by source: each expression parses once however often it
// is judged. Throws as parseExpression does (a failed parse isn't remembered).
const parsed = new Map();
export function cachedExpression(source) {
  if (!parsed.has(source)) parsed.set(source, parseExpression(source));
  return parsed.get(source);
}

export function parseExpression(source) {
  if (typeof source !== 'string') throw new ExpressionError('An expression must be a string.', 0);
  const tokens = tokenize(source);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const fail = (message, token = peek()) => { throw new ExpressionError(message, token.pos); };
  const expect = (value) => {
    if (peek().value !== value) fail(`Expected "${value}" at position ${peek().pos}.`);
    return next();
  };

  // expr := term (('+' | '-') term)*
  function expr() {
    let node = term();
    while (peek().value === '+' || peek().value === '-') {
      const op = next().value;
      node = { op, left: node, right: term() };
    }
    return node;
  }
  // term := unary (('*' | '/') unary)*
  function term() {
    let node = unary();
    while (peek().value === '*' || peek().value === '/') {
      const op = next().value;
      node = { op, left: node, right: unary() };
    }
    return node;
  }
  // unary := ('-' | '+') unary | power
  function unary() {
    if (peek().value === '-') { next(); return { op: 'neg', arg: unary() }; }
    if (peek().value === '+') { next(); return unary(); }
    return power();
  }
  // power := primary ('^' unary)?    right-associative, and allows 2^-1
  function power() {
    const base = primary();
    if (peek().value !== '^') return base;
    next();
    return { op: '^', left: base, right: unary() };
  }
  // primary := number | constant | name | function '(' args ')' | '(' expr ')'
  function primary() {
    const token = peek();
    if (token.type === 'number') { next(); return { num: token.value }; }
    if (token.value === '(') {
      next();
      const inner = expr();
      expect(')');
      return inner;
    }
    if (token.type === 'name') {
      next();
      if (Object.hasOwn(CONSTANTS, token.value)) return { num: CONSTANTS[token.value] };
      if (Object.hasOwn(FUNCTIONS, token.value)) return call(token);
      if (peek().value === '(') fail(`Unknown function "${token.value}" at position ${token.pos}.`, token);
      return { name: token.value };
    }
    if (token.type === 'end') fail(`The expression ends where a value is expected (position ${token.pos}).`);
    fail(`Unexpected "${token.value}" at position ${token.pos}.`);
  }
  function call(nameToken) {
    const [fn, min, max] = FUNCTIONS[nameToken.value];
    expect('(');
    const args = [];
    if (peek().value !== ')') {
      args.push(expr());
      while (peek().value === ',') { next(); args.push(expr()); }
    }
    expect(')');
    if (args.length < min || args.length > max) {
      const want = min === max ? `${min}` : `at least ${min}`;
      fail(`${nameToken.value}() takes ${want} argument${min === 1 && max === 1 ? '' : 's'}, not ${args.length}.`, nameToken);
    }
    return { fn, args };
  }

  const tree = expr();
  if (peek().type !== 'end') fail(`Unexpected "${peek().value}" at position ${peek().pos}.`);

  const names = [];
  collectNames(tree, names);
  return Object.freeze({
    source,
    names: Object.freeze(names),
    evaluate: (state = {}) => evaluate(tree, state),
  });
}

function evaluate(node, state) {
  if ('num' in node) return node.num;
  if ('name' in node) {
    if (!state || !Object.hasOwn(state, node.name)) throw new ExpressionError(`Unknown State "${node.name}".`);
    const value = state[node.name];
    if (typeof value !== 'number') throw new ExpressionError(`State "${node.name}" is not a number (it is ${String(value)}).`);
    return value;
  }
  if ('fn' in node) return node.fn(...node.args.map((a) => evaluate(a, state)));
  if (node.op === 'neg') return -evaluate(node.arg, state);
  return BINARY[node.op](evaluate(node.left, state), evaluate(node.right, state));
}

function collectNames(node, names) {
  if ('name' in node) { if (!names.includes(node.name)) names.push(node.name); return; }
  for (const child of [node.left, node.right, node.arg, ...(node.args ?? [])]) if (child) collectNames(child, names);
}

function tokenize(source) {
  const tokens = [];
  let pos = 0;
  while (pos < source.length) {
    const ch = source[pos];
    if (/\s/.test(ch)) { pos++; continue; }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(pos));
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]), pos });
      pos += number[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(pos));
    if (name) {
      tokens.push({ type: 'name', value: name[0], pos });
      pos += name[0].length;
      continue;
    }
    if ('+-*/^(),'.includes(ch)) { tokens.push({ type: 'op', value: ch, pos }); pos++; continue; }
    if (ch === '−') { tokens.push({ type: 'op', value: '-', pos }); pos++; continue; }
    throw new ExpressionError(`Unexpected "${ch}" at position ${pos}.`, pos);
  }
  tokens.push({ type: 'end', value: '', pos: source.length });
  return tokens;
}
