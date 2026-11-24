// Conditions: declarative tests on named State, evaluated only on Submit.
export function evaluateCondition(condition, state) {
  const value = state[condition.state];
  return [{ pass: Math.abs(value - condition.target) <= condition.tol }];
}
