---
name: brightspace-notes
description: Author or edit Obsidian course notes that the bsgen generator turns into a Brightspace package — assignments, units, lessons, pages, files, links, discussion forums. Use when adding or changing anything under a course's brightspace/ folder, wiring homework or labs into a lesson, or preparing a package to import into D2L.
---

# Authoring Brightspace course notes

The format is specified in `brightspace/project_template/SCHEMA.md`, and
`brightspace/templates/` holds a ready-to-copy note for each `type:`. **Start
from a template rather than writing frontmatter from memory** — the templates
are maintained alongside the generator, this file is not.

Read SCHEMA.md when you need detail. Sections §9–§11 are generator internals;
skip them when authoring.

## The rules that fail silently

Everything below produces no error and no warning when you get it wrong. The
note looks correct and the content is quietly missing from the package.

1. **A file nothing links to is not in the course.** Discovery starts at the
   `type: course` note and follows wikilinks. Correct frontmatter is not
   enough — a new assignment must also be added to some lesson's or unit's
   `contents:`, or it ships nowhere. Do both, in the same change, every time.

2. **`contents:` order is the Brightspace sort order.** Reorder by moving
   lines. Match the ordering convention already in the course rather than
   appending to the end. Creation order *is* display order in Brightspace and no
   API route changes it afterwards, so an order pushed once is an order that
   needs a rebuild to change.

3. **`![[file.pdf]]` and `![](assets/fig.png)` mean different things.** The
   wikilink embed attaches a file to an assignment or posts it as a `file`
   topic; the markdown image embeds a picture inline in a body. They are not
   interchangeable.

4. **Author math as `$…$` and `$$…$$`.** Never hand-write `\(…\)` in a note:
   markdown reads `\(` as an escaped paren and eats the backslash, destroying
   the delimiter before Brightspace sees it. The generator converts inline math
   to the delimiters D2L honours.

5. **`points:` and `grade_category:` travel together.** `grade_category:`
   without `points:` is an error — an ungraded assignment has no grade item to
   categorise. The category must match a `title:` in the grades note's
   `categories:` list exactly. Omit both for genuinely ungraded work.

6. **`emit:` is unit-level, append-only, and unrecoverable.** Brightspace import
   never matches existing objects, so re-shipping a unit duplicates it and
   cleanup is entirely manual. Only set `emit:` when the intent is to ship;
   never set `emitted:` by hand.

## Structure is frontmatter; bodies are prose

Four things that used to be markdown constructs in the body are now frontmatter
properties. **Write the property.** Both forms are still read, so an unmigrated
note keeps working, but a note carrying both warns and the frontmatter silently
wins — so never add a body form to a note that already has the property.

| property | on | replaced |
|---|---|---|
| `contents:` | course, content-root, unit, lesson | the wikilinks under `## Contents` |
| `categories:` | grades | the `## Categories` table |
| `standalone_items:` | grades | the `## Standalone items` table |
| `topics:` | discussion-forum | the `## ` headings and their `due::` / `points::` lines |

```yaml
contents:
  - "[[PHY 1200 HW1 math and physics]]"
  - "[[PHY 1200 Field Work#Physics field work 2]]"
categories:
  - { title: Labs, weight: 20, max_item_points: 10, drop_lowest: 0, drop_highest: 0 }
standalone_items:
  - { title: Math quiz 1, points: 10, category: Quizzes }
topics:
  - { title: Physics field work 1, due: 2026-08-30 }
  - { title: Physics field work 2, due: wk2 thu, points: 15 }
```

Three details worth getting right:

- **Bracket the `contents:` entries.** `- PHY 1200 HW1` parses, but a property
  full of bare names is a property full of dead text: the graph and the backlinks
  pane both go quiet. `- "[[PHY 1200 HW1]]"` is a real link in Obsidian.
- **A forum's prompts stay in the body.** `topics:` decides which topics exist
  and in what order and carries their fields; each prompt is the `## ` section
  with the **same title**. Retitling a topic means retitling both halves. A row
  with no section is an empty prompt; a section with no row is flagged.
- **An empty list is a statement.** `standalone_items: []` means there are none.
  Leaving the property off means "fall back to a table", which is not the same.

`bsx migrate <course> --dry-run` converts a note that still uses the body forms,
and refuses to write if the rewrite would change the model.

## Bodies

The body is the object's primary text, and what that means depends on the type:
module description for a unit or lesson, instructions for an assignment, the page
itself for a page. Pages and files have no separate description field — anything
worth saying about a page goes in the page.

An assignment whose body is only an embed shows blank instructions in D2L with
a PDF attached. That is legal and sometimes intended; say so rather than
assuming it was a mistake.

## Always finish by validating

```bash
node brightspace/bsx/packages/cli/src/bsx.ts validate 1200
```

Name the course by its key, its code or its title, or omit it and stand in the
course directory. This checks link resolution, grade categories, duplicate
parents, the frontmatter lists above, and every date — let it catch mistakes
instead of re-reading the schema. It needs no token and no network.

`bsgen` is the older package-import path and still reads only the body forms, so
`uv run bsgen validate` will mis-read a migrated note. Validate with `bsx`.

Report pre-existing failures rather than fixing them silently: which points an
assignment is worth is the instructor's call, not a cleanup.
