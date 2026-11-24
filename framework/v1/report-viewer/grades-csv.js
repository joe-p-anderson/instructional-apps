// Grades CSV export (framework v1): part of the Report Viewer core. Pure logic, no DOM.
//
//   gradesCsv(rows, { item }?) -> string
//       rows: the class rows from openClass (core.js); item: the Brightspace grade
//       item name, defaulting to the first row's Activity title. One CSV line per
//       row, CRLF line endings, with the recomputed points (row.earned).
//
// PROVISIONAL FORMAT (spec, Grades CSV export): the columns below are a guess at
// Brightspace's grades import shape and have NOT been checked against a real
// Brightspace grades export. Change COLUMNS, and only COLUMNS, once one has been
// inspected (for example to an OrgDefinedId or Username identifier column, or a
// "<Numeric MaxPoints:N>" annotation on the grade column header).
//   Submission Id            the "<id>-<id>" prefix of the bulk-download name
//                            (uploaderFromPath); blank when the path has none
//   Student                  the uploader's name, else the Report's sealed name
//   <item> Points Grade      the points recomputed from the Attempts
//   End-of-Line Indicator    "#", which Brightspace imports expect as the last column
const COLUMNS = [
  ['Submission Id', (row) => row.submissionId ?? ''],
  ['Student', (row) => row.name],
  [(item) => `${item} Points Grade`, (row) => row.earned],
  ['End-of-Line Indicator', () => '#'],
];

export function gradesCsv(rows, { item = rows[0]?.view?.activity?.title || 'Activity' } = {}) {
  const header = COLUMNS.map(([label]) => (typeof label === 'function' ? label(item) : label));
  const lines = [header, ...rows.map((row) => COLUMNS.map(([, value]) => value(row)))];
  return lines.map((fields) => fields.map(csvField).join(',')).join('\r\n') + '\r\n';
}

// RFC 4180 quoting. Text that a spreadsheet would run as a formula (=, +, -, @,
// tab, CR at the start) is prefixed with ' so a Report's names can't inject one.
// Numbers are written as they are.
function csvField(value) {
  if (typeof value === 'number') return String(value);
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}
