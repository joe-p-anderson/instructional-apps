// The preview plan (no DOM): what the preview page (../preview.html) is handed for the editor's
// current, unsaved Activity, and whether it may start.
//
// planPreview(editor, { p, t }, toolInfo?) -> { blockers, activity, start }
//   blockers  the problems that would make the runner refuse the Activity: its own validation
//             (source 'runner'), an unknown Mode (the Tool can't mount it) and an unknown Control
//             (the runner throws applying the exposure); or one of source 'preview' when Part p
//             has no Task to start at. While there are any, activity and start are null.
//   activity  editor.preview() under the preview Activity id (<id>~preview), so even its
//             in-memory Run is never keyed like a student's.
//   start     { partId, taskId } of Part p, Task t: the runner's PREVIEW_START option
//             (runner/preview.js), which counts the Tasks before it as passed.

export const PREVIEW_ID_SUFFIX = '~preview';
const BLOCKING = new Set(['runner', 'modes', 'controls']);

export function planPreview(editor, { p, t }, toolInfo) {
  const blockers = editor.problems(toolInfo).filter((pr) => BLOCKING.has(pr.source));
  const part = editor.doc.parts?.[p];
  const task = part?.tasks?.[t];
  if (!blockers.length && !task) {
    blockers.push({ path: ['parts', p], message: `${part ? `Part ${p + 1}` : 'This Activity'} has no Tasks to start at`, source: 'preview' });
  }
  if (blockers.length) return { blockers, activity: null, start: null };
  const activity = editor.preview();
  return {
    blockers,
    activity: { ...activity, id: `${activity.id}${PREVIEW_ID_SUFFIX}` },
    start: { partId: part.id, taskId: task.id },
  };
}
