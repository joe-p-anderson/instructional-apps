# 01: Numeric Questions judged modulo a period

Spec: .scratch/fourier/spec.md (vocabulary from GLOSSARY.md; builds on framework v1, Spec 0001; respects ADRs 0001–0003).

**What to build:** An Activity author can mark a numeric Question as periodic, for example a phase in degrees with modulus 360.

- The difference between the given value and the correct value is wrapped into the half-open interval (−modulus/2, modulus/2] before the tolerance check.
- So for a correct answer of −90°, both −90° and 270° pass.
- Questions without a modulus behave exactly as before.

This is a compatible change shipped in place in framework v1 (ADR 0003).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A numeric Question accepts an optional positive modulus. Validation rejects a modulus that is non-positive or not a number.
- [ ] With a modulus, judging wraps the difference, then applies tol (or relTol, measured against the answer as before).
- [ ] Without a modulus, every existing numeric Question judges exactly as before, and the existing runner tests stay green.
- [ ] Runner unit test, with answer −90, tol 2 and modulus 360:
  - 270, −450 and −91.5 pass;
  - 90 and −95 fail.
- [ ] Runner unit test across the ±180° wrap: with answer 179, −179.5 passes.
- [ ] The framework README documents the option alongside tol and relTol.

## Comments
