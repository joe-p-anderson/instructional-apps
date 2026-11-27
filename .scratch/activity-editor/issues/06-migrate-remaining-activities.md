# 06: Migrate the other 4 Activities to JSON

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** Move electrostatics (conductor properties), spacetime (lab 10), fourier (Fourier series) and phasors (phasors and impedance) to the JSON format with ticket 04's script and page template. After this, every Activity on the site is JSON and no hand-written Activity module remains.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Each of the 4 Activities is a JSON file beside its page from the template; its old module is deleted
- [ ] Each one's header comment (its design reasoning) is in its `notes`, moved by hand where the script can't extract it cleanly
- [ ] URLs, Activity ids, versions, and Part and Task ids are unchanged; encoded keys are byte-identical to before
- [ ] Each Activity's unit test reads the JSON with no other change to its assertions, including the phasors and fourier checks that keys agree with the engine
- [ ] Every Activity e2e spec, display-fit and the other cross-Tool e2e checks pass unchanged
- [ ] The site's listings still link every Activity
