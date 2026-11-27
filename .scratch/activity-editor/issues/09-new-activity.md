# 09: Create a new Activity

Spec: .scratch/activity-editor/spec.md (vocabulary from GLOSSARY.md; respects ADRs 0001–0005).

**What to build:** From the Open screen (ticket 07) the instructor creates a new Activity: they pick a Tool and give an id, title and course. The editor writes the Activity's JSON and its page from the single template into that Tool's activities folder, then opens it, ready for Parts. The URL has the same shape as every other Activity's, so it can be linked from Brightspace.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The new-Activity form picks from the Tools listed, and needs an id (a slug, offered from the title), a title and a course
- [ ] An id already used in that Tool's folder is refused
- [ ] Both files are written; the page is identical to every other Activity page from the template
- [ ] The new Activity opens in the editor, and its "needs at least one Part" problem shows until a Part is added
- [ ] A Playwright journey with the in-memory folder checks both files are written and that the page loads the new Activity
