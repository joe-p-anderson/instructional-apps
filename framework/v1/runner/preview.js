// The preview-only runner option (the Activity editor's preview, ../authoring/preview.html).
//
//   createRunner(activity, { tools, [PREVIEW_START]: { partId, taskId } })
//
// starts the Run at that Task: every Task of the Parts before it, and every earlier Task of its
// own Part, counts as passed without Attempts, and the exposure they leave is applied when the
// Run starts. Those passes are never saved and never reach a Report (they have no Attempts),
// so a normal Run restored from a preview's save starts from the beginning.
//
// The key is a Symbol, so no Activity file, URL or JSON option can carry it: only code that
// imports this module can start a Run part-way, and no Activity page does.
export const PREVIEW_START = Symbol('fw1 preview start');
