# 07: Editor shell: open, outline, save

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** The first working Activity editor, built to the approved mockup (ticket 01).
- **Folder:** the instructor grants the repo folder once, in Chrome or Edge, and it is remembered between visits.
- **Open:** the editor lists every Tool and its Activities, and opens one into the outline of Parts and Tasks.
- **Edit:** the Activity-level fields (title, course, version, notes) can be edited.
- **Save:** Ctrl+S, or the Save button, writes the JSON back into the checkout.

This ticket creates the DOM-free **editor core**: open (decode every encoded field), edits returning new documents (with undo and redo), save (stable JSON, re-encoded), and problems. It also creates the folder-access interface (list folders, read file, write file), with a Chrome implementation, a download fallback and an in-memory implementation for tests.

**Blocked by:** 01, 06

**Status:** ready-for-agent

- [ ] The editor page lives with the existing authoring helper in framework v1; it starts the folder grant and remembers the folder handle, asking for permission again when the browser requires it
- [ ] Every Tool and its Activities are listed; opening one shows its outline and the Activity form
- [ ] Opening any of the 5 Activities and saving with no edits writes a byte-identical file (editor core unit test)
- [ ] Editing title, course, version or notes and saving writes only that change
- [ ] Undo and redo work for edits
- [ ] Closing or switching Activities with unsaved changes warns first
- [ ] Without the File System Access API, save downloads the file
- [ ] The problems list shows the runner's own validation errors, each with a path to its field
- [ ] A Playwright journey with the in-memory folder: open an Activity, change its title, save, and check the written JSON
