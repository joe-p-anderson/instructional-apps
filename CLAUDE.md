# CLAUDE.md

## Conventions

- **Grilling uses `AskUserQuestion`.** When running `/grilling` (or any grill-style skill such as `/grill-me` or `/grill-with-docs`), put each question to the user through the `AskUserQuestion` tool, one decision at a time and with the recommended answer first, rather than as plain prose questions in chat.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/` (no remote tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
