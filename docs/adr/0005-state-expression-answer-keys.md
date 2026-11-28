# Answer keys can be State expressions worked out at Submit

A numeric Question's answer, and any value a Condition tests, may be a State expression instead of a number, such as `I * 1000` or `1/sqrt(L*C)`. The runner evaluates it against the Part's live State at the moment of Submit. Until now every key was a number worked out in advance and stored encoded, and a key that disagreed with the Tool was caught only by a test written for that purpose. The alternatives were:

- **Keep stored numbers, with the editor filling them from the Tool:** this keeps the runner unchanged but leaves keys able to drift from the engine.
- **Evaluate expressions once, at the Part's Setup:** that needs a hidden copy of the Tool, and the key no longer follows what the student sees.

The expression language is a small parser with no `eval`: arithmetic, `^`, pi and e, the usual math functions, and deg and rad, with trig in radians.

## Consequences

- **Moving keys:** a key follows the student's State, so where a Task leaves a Control open, the key moves with it. That is the intent.
- **Unknown State names:** they can't be caught before a Run, because State exists only once the Tool is mounted. The Activity editor reports them; at Submit they are a miss with feedback.
- **The Report:** since keys vary per Attempt, each judged numeric result records the expected value it was judged against. That is an optional field within Report format version 1.
- **Encoding:** expressions are stored encoded like other keys, which deters casual reading only (ADR 0001).
