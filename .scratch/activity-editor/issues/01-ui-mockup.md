# 01: UI mockup of the Activity editor

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** A throwaway, clickable mockup of the Activity editor page, with fake data and no real Tool, folder or runner. The instructor uses it to check that the editor matches the usability they expect before any real editor UI is built. It follows the spec's layout: the outline of Parts and Tasks on the left; the form for the selected item and the problems list in the middle; a stand-in for the live Tool on the right. It uses the v1 theme so it looks like the site.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The outline lists an Activity, its Parts and their Tasks, and selecting an item shows its form
- [ ] A Part form shows the Mode picker, the Setup values with Capture and typed entry, and notes
- [ ] A Task form shows title, prompt, points, Hint and notes, plus the list of every Control with its effective state (open, locked or hidden) as a three-way switch, each marked as changed here or inherited
- [ ] A nested Condition is shown: an any-of group holding a target ± tol on a State name and a range on a State expression, with a target label, "Use current value", and a live pass or miss line
- [ ] A numeric Question shows an answer as an expression with its live value, and a tolerance preset menu; a choice Question shows editable choices with the correct one marked
- [ ] A prose field shows source beside its rendered preview (MathJax included), with the info hover on HTML tags and `\( \)` math
- [ ] The problems list shows sample problems that jump to their field when clicked
- [ ] The preview button offers "start at Part / Task"
- [ ] The mockup is marked as a prototype and is not linked from the site's listings
- [ ] The instructor has reviewed it and approved it, and any changes it prompted are written back into the spec (the Comments section here records the outcome)
