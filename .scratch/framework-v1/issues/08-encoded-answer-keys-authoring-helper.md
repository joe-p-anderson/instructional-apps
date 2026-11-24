# 08: Encoded answer keys and authoring helper

Spec: docs/specs/0001-framework-v1.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0003).

**What to build:** Answer keys and Condition targets no longer appear in plain text in the page source, so casual students can't read them off. Authors encode them with a framework-provided helper. This only deters cheating (ADR 0001).

**Blocked by:** 04

**Status:** resolved

- [x] Targets and answer keys can be stored in a lightweight encoded form that the runner decodes
- [x] An authoring helper (a small authoring page or a browser-console function) produces the encoded form
- [x] The oscilloscope Activity's targets and keys are re-encoded with it, and the Activity still behaves identically
- [x] Node test: encoded Conditions and Questions evaluate the same as their plain forms

## Comments

- Built on branch `ticket-08`. `framework/v1/runner/keys.js` has `encodeKey(value)`, which turns any JSON value into an `enc1:` string (JSON, XOR pad, base64url), plus `decodeKey` and `decodeActivity`. `createRunner` and `scoreActivity` decode the definition internally, so the Report Viewer path decodes too. The runner never exposes decoded keys. Students still see the usual miss feedback, such as "need π/2".
- Authors can encode any value in an Activity: a whole Condition (which also hides `targetLabel`) or a single Question field (`answer`, `tol`, `correct`).
- Authoring helper: `framework/v1/authoring/encode-keys.html`. The author pastes a JS expression and copies the key. `encodeKey()` and `decodeKey()` are also on `window` for console use.
- The oscilloscope Activity's four Conditions are now encoded. Its existing unit and e2e tests pass unchanged.
