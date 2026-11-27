# 03: Setup keys on the Tool contract

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Each Mode of every Tool declares its Setup keys: the State names its mount accepts as a Setup. The Activity editor can then read them without mounting the Tool, and Capture stores only them. The keys come from what each Mode reads today, in its header comment and its mount code.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The Tool contract documents the Setup keys on each `modes` entry, and `defineTool` rejects a declaration that isn't a list of strings
- [x] All 8 Tools (oscilloscope, bench-scope, electrostatics, spacetime, least-squares, vernier, fourier, phasors) declare Setup keys for every Mode
- [x] A contract test mounts every Tool and Mode and checks that each Setup key is a name in that Mode's State
- [x] Every existing unit and e2e test passes unchanged

## Comments

Built on branch `ae-03`.

- `framework/v1/tool.js`: each `modes` entry may carry `setupKeys`, a list of distinct non-empty strings; `defineTool` rejects anything else (`modes[i].setupKeys` in the error). The field is optional to `defineTool` (so existing fixtures still define), but every shipped Tool declares it on every Mode. Read it without mounting as `tool.modes.find((m) => m.id === modeId).setupKeys`. Unit tests in `tests/unit/framework/tool.test.js`.
- Mode-module Tools (electrostatics, fourier, phasors) export `setupKeys` from each `modes/*.js` module and pass it through their `modes` list; the single-Mode Tools declare it inline.
- Contract test: `tests/e2e/setup-keys.spec.js` (Tools need a DOM), mounting each Tool and Mode on the new empty fixture `tests/e2e/fixtures/blank.html` and checking every key is in `state.snapshot()`.
- **Setup values that are not State are not Setup keys**, as the spec requires: bench-scope `seed`, electrostatics gauss `handleAngle`, fourier synthesis `coefficientTable`, and spacetime `names`, `grid`, `showKp`, `objs` and `tool` (spacetime's only Setup key is `v`). Existing Activities use some of them (fourier-series Part 1 `coefficientTable: true`; lab10 `names`, `grid`, `tool`), so Capture would drop them and the "unknown Setup key" problem (spec story 18) would flag them. The editor tickets need a decision here, e.g. a second per-Mode list of non-State Setup options.
