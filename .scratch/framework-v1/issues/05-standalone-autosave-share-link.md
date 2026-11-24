# 05: Standalone autosave and share link

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** A student using a Tool in Standalone mode can reload or close the tab without losing their setup, and can copy a link that reproduces it for a classmate or the instructor.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Standalone State autosaves to browser storage, separately per Tool and Mode, and restores on reload
- [ ] A share link encodes the State, following spacetime's `#s=` precedent; opening it reproduces the State
- [ ] Playwright: a reload restores Standalone State; a share link reproduces it
