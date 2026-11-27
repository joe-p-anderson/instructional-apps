# 08: Parts, Setup and the live Tool

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** The instructor edits Parts in the editor:
- add, retitle, reorder and delete Parts;
- pick each Part's Mode from the Tool's Modes;
- see the real Tool mounted at that Part's Mode and Setup, beside the form.

The Setup can be set by operating the live Tool and clicking Capture, which stores only the Mode's Setup keys (ticket 03), or by typing or clearing individual values. The editor core gains **Tool info**: Mode ids and titles, Setup keys, Control ids and labels, and State names with labels and units, gathered by mounting each Mode once in a hidden container.

**Blocked by:** 03, 07

**Status:** ready-for-agent

- [ ] Parts can be added, retitled, reordered and deleted; a new Part's id is a slug of its title, unique in the Activity, and stays frozen on retitle
- [ ] The Mode picker offers only the Tool's Modes
- [ ] The live Tool remounts when the selected Part, its Mode or its Setup changes; operating it never changes the Activity on its own
- [ ] Capture stores exactly the Mode's Setup keys from the live State; typed values can be set or cleared one by one
- [ ] A Setup key the Mode doesn't declare, or an unknown Mode, shows in the problems list
- [ ] Editor core unit tests cover Part edits, Capture and the new problems
- [ ] A Playwright journey: add a Part, choose its Mode, move a Control on the live Tool, Capture, save, and check the Setup in the JSON
