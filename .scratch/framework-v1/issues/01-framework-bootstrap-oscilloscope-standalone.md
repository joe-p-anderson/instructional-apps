# 01: Framework bootstrap and the oscilloscope Tool in Standalone mode

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student opens the oscilloscope Tool's page with no Activity and gets a working dual-trace scope in the v1 cream-and-serif look: one Mode tab, every Control unlocked, live metrics. This lays down the major-versioned framework folder (ADR 0003), the UI kit, the Tool contract and the Tool host, plus the repo's first test tooling.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The newest oscilloscope lab source ("oscilloscope_lab (8).html", currently only in the user's Downloads folder) is copied into the repo alongside the finished apps as the port reference
- [ ] Test tooling: Node's built-in test runner script, and Playwright as the only npm dev dependency (needed for testing only, never for serving)
- [ ] Framework v1 folder of static ES modules + CSS, no build step; third-party libraries vendored or loaded from a pinned CDN version
- [ ] UI kit: v1 theme from the old apps' cream/serif design; standard Controls (slider paired with number box and reset, toggle, select, button, metric readout)
- [ ] Tool contract per the spec: id, title, Modes; mount(container, Mode, Setup) returns an instance with State (label + unit, plain snapshot), change notification, Control registry (get/set value, lock/unlock, show/hide), Displays with PNG snapshot, State serialize/restore; no global state, mountable several times on one page
- [ ] Tool host: Standalone mode shows one tab per Mode with every Control unlocked
- [ ] Oscilloscope Tool: one Mode; existing signal Controls; the draggable Δt marker registered as a Control (lockable like a slider); Plotly Display; φ, T and pk-pk published as State with units
- [ ] Layout fits a laptop screen without horizontal scrolling
- [ ] Playwright: Standalone mode shows every Control
