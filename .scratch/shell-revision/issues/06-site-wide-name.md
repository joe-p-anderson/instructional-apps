# 06: Site-wide student name and sign-out

Spec: .scratch/shell-revision/spec.md (Name storage and sign-out; stories 47–57). Glossary: Name gate, Run.

**What to build:** A name entered at the Name gate is stored for the whole site.
- **Opening an Activity:** one with no saved Run starts its Run straight away with the stored name, with no Name gate. A saved Run is restored under its own sealed name, as today.
- **Start over:** discards this Activity's Run and starts a new one with the stored name.
- **Signing out:** the ⋯ menu gains "Not <name>? Sign out". After a confirm, it forgets the stored name, discards this Activity's saved Run and shows the Name gate. Other Activities' saved Runs are untouched.
- **The header:** shows the Run's name.

**Blocked by:** 01 (single-row header).

**Status:** resolved

- [x] The persistence layer has a site-wide name store, with unit tests.
- [x] e2e: start Activity A with a name, then open Activity B: B starts with no Name gate and the header shows the name.
- [x] e2e: Sign out on B (after confirming) shows the Name gate on B. A's saved Run is still restored under the original name.
- [x] e2e: Start over (after confirming) starts a new Run with no Name gate when a name is stored.
- [x] The Start over and Sign out confirm texts describe exactly what is discarded.
- [x] The e2e helpers that fill in the Name gate still work, since each test starts with clean storage. Tests that rely on the gate across Activities are updated.
- [x] The framework README's runner description and the Activity runner UI's header comment are updated.
