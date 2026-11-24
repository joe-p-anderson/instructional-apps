# 08: Encoded answer keys and authoring helper

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** Answer keys and Condition targets no longer appear in plain text in the page source, so casual students can't read them off. Authors encode them with a framework-provided helper. This only deters cheating (ADR 0001).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Targets and answer keys can be stored in a lightweight encoded form that the runner decodes
- [ ] An authoring helper (a small authoring page or a browser-console function) produces the encoded form
- [ ] The oscilloscope Activity's targets and keys are re-encoded with it, and the Activity still behaves identically
- [ ] Node test: encoded Conditions and Questions evaluate the same as their plain forms
