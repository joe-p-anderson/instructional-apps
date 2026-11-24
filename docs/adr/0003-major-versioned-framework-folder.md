# Activities load the framework from a major-versioned folder

Tools and Activities load the shared framework from `framework/v1/` rather than from an unversioned `framework/`. They are hosted on GitHub Pages indefinitely, and students and the Report Viewer must keep working with past semesters' Activities and Reports. Fixes that keep compatibility go into the current version in place. A breaking change starts `framework/v2/`, and existing Activities stay on v1 until someone ports them deliberately.

## Consequences

Each old major version stays in the repo for as long as any Activity uses it. The Report Viewer must keep reading Reports from every major version that is still in use.
