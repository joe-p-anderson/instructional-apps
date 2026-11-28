# 01: UI mockup of the Activity editor

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** A throwaway, clickable mockup of the Activity editor page, with fake data and no real Tool, folder or runner. The instructor uses it to check that the editor matches the usability they expect before any real editor UI is built. It follows the spec's layout: the outline of Parts and Tasks on the left; the form for the selected item and the problems list in the middle; a stand-in for the live Tool on the right. It uses the v1 theme so it looks like the site.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The outline lists an Activity, its Parts and their Tasks, and selecting an item shows its form
- [x] A Part form shows the Mode picker, the Setup values with Capture and typed entry, and notes
- [x] A Task form shows title, prompt, points, Hint and notes, plus the list of every Control with its effective state (open, locked or hidden) as a three-way switch, each marked as changed here or inherited
- [x] A nested Condition is shown: an any-of group holding a target ± tol on a State name and a range on a State expression, with a target label, "Use current value", and a live pass or miss line
- [x] A numeric Question shows an answer as an expression with its live value, and a tolerance preset menu; a choice Question shows editable choices with the correct one marked
- [x] A prose field shows source beside its rendered preview (MathJax included), with the info hover on HTML tags and `\( \)` math
- [x] The problems list shows sample problems that jump to their field when clicked
- [x] The preview button offers "start at Part / Task"
- [x] The mockup is marked as a prototype and is not linked from the site's listings
- [x] The instructor has reviewed it and approved it, and any changes it prompted are written back into the spec (the Comments section here records the outcome)

## Comments

**2026-11-27, mockup built.** It's at `framework/v1/authoring/activity-editor.prototype.html`. Run `node scripts/static-server.js 4173`, then open `/framework/v1/authoring/activity-editor.prototype.html`. It isn't linked from any listing.

It uses fake data: a cut-down Phasors and Impedance Activity. A stand-in Tool with sliders drives the live values, so Capture, "Use current value", the expression values and the pass or miss lines all respond.

The spec fixes the three-column layout, so the three variants differ only in the Task form. Switch with `?variant=`, the bottom bar, or ← →:
- **A, Stacked form:** every section in one scroll.
- **B, Sectioned tabs:** Prompt / Exposure / Condition / Questions / Hint & notes, with a problem count on each tab.
- **C, Exposure beside the Tool:** the exposure list sits in the right column, under the live Tool. If C is chosen, the spec's "On the right, the live Tool" needs amending.

Sample problems are seeded on purpose: an unknown Control, a duplicate Question id, a parse error, an unknown Setup key and an unknown State. The first three block preview, the way the runner's validation would.

The mockup assumes one choice that the spec should settle when this is reviewed: tol is a plain number, while target, equals, above and below take a number or a State expression.

Waiting on: the instructor's review and approval, which variant to take, and any spec changes it prompts. Once the editor page is built, move the prototype to a throwaway branch (prototype skill, rule 6) rather than merging it to main.

**2026-11-27, review: Student / Full toggle.** The instructor asked for the live Tool to show the student's view of the selected Task by default, with a Student / Full toggle. The mockup now has one, replacing the old opt-in checkbox. Written into the spec under "Editor page", and added to ticket 10's checklist.

**2026-11-27, review: variant B chosen.** The Task form is split into tabs (Prompt / Exposure / Condition / Questions / Hint & notes), each with its problem count. This is written into the spec's "Editor page" layout. Variants A and C are kept in the prototype file for reference only.

**2026-11-27, review: Open screen.** The mockup's header dropdown won't scale with the library. It is replaced by an Open screen: a searchable table filtered by course (first) and Tool, with recents pinned. This is written into the spec ("Editor page", stories 3 and 8) and into ticket 07. It is not mocked.

**2026-11-27, review: tolerances.** Tolerances are plain numbers, never expressions. They can be given in the unit or as a %, and a target Condition gains `relTol` to support the %. Written into the spec ("Tolerances", stories 30 and 40) and tickets 05, 11 and 12. The mockup still shows a separate tol field for Conditions and separate tol/relTol fields for Questions; the spec governs.

**2026-11-27, approved.** The instructor approved the mockup with the changes above: the tabbed Task form (variant B), the Student / Full toggle, the Open screen, and the tolerances. The spec now holds all of them. The prototype is a reference only: build the editor from the spec and tickets, and move the prototype file to a throwaway branch before `activity-editor` merges to main.


**2026-11-27, prototype moved.** The mockup now lives only on the throwaway branch `activity-editor-prototype` (`git show activity-editor-prototype:framework/v1/authoring/activity-editor.prototype.html`). It is deleted from `activity-editor`, so it won't merge to main.
