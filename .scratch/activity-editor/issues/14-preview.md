# 14: Preview

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** From the editor the instructor previews the unsaved Activity in the real runner, in a pane or a new tab. The preview is a throwaway Run: autosave is off, it runs under a preview Activity id, and it never touches a student's Run in the same browser. The instructor can start at any Part and Task, with the earlier Tasks treated as passed. That uses a preview-only runner option that marks them passed without Attempts, and it never appears in a student's Run or a Report. While the runner would reject the Activity, the preview refuses to start and says why.

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] The preview runs the editor's current, unsaved Activity
- [ ] It writes nothing to browser storage and leaves any existing Run of that Activity untouched
- [ ] Starting at a chosen Part and Task opens it with every earlier Task shown as passed
- [ ] The preview-only start option can't be reached from an Activity page; a runner unit test shows that a normal Run ignores it
- [ ] With a validation problem, the preview button explains why it won't start
- [ ] A Playwright journey: open the preview at Part 2, Task 3 of an Activity, Submit there, and check that no Run was saved
