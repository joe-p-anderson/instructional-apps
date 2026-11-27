# Activities are stored as JSON data files, not JS modules

An Activity is a plain JSON file beside a small page generated from one template. The page fetches the file and mounts the runner. Until now each Activity was a hand-written JS module, with shared constants, spreads, imports and long design comments. We moved to JSON so that the Activity editor can open an Activity and save it back exactly. A tool can't round-trip a hand-written module without flattening its constants and dropping its comments. The alternatives were:

- **A generated JS module:** it flattens just the same, while still looking like source you could edit by hand.
- **Leaving existing Activities hand-written:** then the editor could not be the main editing surface.

## Consequences

- **Function Conditions:** an Activity can no longer contain one, nor an Activity-level registered Condition type. A Tool or the page can still register Condition types.
- **Design reasoning:** it moves from comments into optional `notes` fields, which students can read in the fetched file.
- **Migration:** the five existing Activities were migrated once, by script. Their per-Activity tests read the JSON.
- **Diffs:** they stay clean only because the editor writes a fixed key order and indent. A hand edit to the JSON is fine, but the next save puts it back into the editor's form.
