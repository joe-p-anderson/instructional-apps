# 03: Setup keys on the Tool contract

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Each Mode of every Tool declares its Setup keys: the State names its mount accepts as a Setup. The Activity editor can then read them without mounting the Tool, and Capture stores only them. The keys come from what each Mode reads today, in its header comment and its mount code.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Tool contract documents the Setup keys on each `modes` entry, and `defineTool` rejects a declaration that isn't a list of strings
- [ ] All 8 Tools (oscilloscope, bench-scope, electrostatics, spacetime, least-squares, vernier, fourier, phasors) declare Setup keys for every Mode
- [ ] A contract test mounts every Tool and Mode and checks that each Setup key is a name in that Mode's State
- [ ] Every existing unit and e2e test passes unchanged
