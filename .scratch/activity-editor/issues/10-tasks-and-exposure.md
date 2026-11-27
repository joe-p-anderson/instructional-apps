# 10: Tasks and their Controls

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** The instructor edits a Part's Tasks: add, retitle, reorder, duplicate and delete, with points, a Hint (its text and the failed-Attempt count it appears after) and notes. On each Task, every Control of the Mode, including revealable layers, is listed under its label with its effective state at that Task (open, locked or hidden), as a three-way switch. Each is marked as changed here or inherited. Flipping a switch makes the editor core rewrite that Task's show, lock and hide lists minimally. Flipping it back to the inherited state removes the Control from them. The live Tool shows the student's view of the selected Task by default, with a Student / Full toggle (spec, "Editor page"). The carry-over follows exactly the runner's rule (show opens, lock shows and locks, hide hides, applied in Task order).

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The Task form uses the tabs from the spec's "Editor page" layout (Prompt, Exposure, Condition, Questions, Hint & notes). Each tab shows its problem count, and the open tab is remembered between Tasks. Tickets 11 to 13 fill the Condition, Questions and prose tabs
- [ ] Tasks can be added, retitled, reordered, duplicated and deleted; ids come from the title, unique within the Part, and stay frozen on retitle
- [ ] Renaming an id by hand warns that it drops student progress on that Task
- [ ] Points, the Hint and notes can be edited
- [ ] The effective exposure the editor core computes matches the runner's carry-over at every Task of all 5 Activities (unit test)
- [ ] Setting a Control writes minimal lists, and setting it back to its inherited state removes it from them (unit test)
- [ ] Changing a Control at an early Task updates the effective states shown on later Tasks
- [ ] A Control id that the Mode doesn't have shows in the problems list
- [ ] The live Tool has a Student / Full toggle. Student is the default on a Task and applies that Task's effective exposure (locked, hidden, including layers), and it updates as soon as a switch is flipped. Full opens every Control. With an Activity or Part selected, the Tool is always Full
- [ ] A Playwright journey: lock a Control at Task 1, see it locked and inherited at Task 3, open it at Task 3, save, and check the lists in the JSON
