# 04: Save status in the header

Spec: .scratch/shell-revision/spec.md (Activity runner UI, save status; stories 38–41).

**What to build:** The header's actions show the autosave state. After each successful save it reads "Saved hh:mm" in muted text. If the browser refuses to save (private mode, full storage), it reads "Not saved: download your Report" in the miss colour, announced once. This applies to Activities and Standalone mode alike.

**Blocked by:** 01 (single-row header).

**Status:** ready-for-agent

- [ ] The persistence store reports the success or failure of each write to its caller, with unit tests on the store, including a storage stub that throws.
- [ ] e2e: after changing a Control, "Saved" with a time appears in the header, both on an Activity and on a Standalone page.
- [ ] e2e: with `localStorage.setItem` stubbed to throw, the warning appears.
- [ ] Successful saves aren't announced. A failure is announced once through an assertive live region.
