// Report Viewer flags (framework v1): pure logic, no DOM. Part of the Report Viewer core.
//
//   flagClass(rows)   fill each class-table row's `flags` with
//                     { kind, severity: 'flag' | 'warning', label, message }
//
//   namesMatch(a, b)  true if two names loosely belong to the same person
//
// A flag asks the instructor to look; it never changes a score (no false zeros).
// A name mismatch is only a warning: nicknames and typos are common.
// Kinds: tampered, shared-fingerprint, identical-history, wrong-activity (flags);
// name-mismatch (warning).

export function flagClass(rows) {
  for (const row of rows) {
    if (!row.view.checksumOk) {
      row.flags.push(flag('tampered', 'Tampered',
        'This Report fails its checksum: it was edited after it was downloaded.'));
    }
    if (row.uploader && !namesMatch(row.sealedName, row.uploader)) {
      row.flags.push({ kind: 'name-mismatch', severity: 'warning', label: 'Name mismatch',
        message: `This Report is sealed with the name "${row.sealedName}", but was uploaded by ${row.uploader}.` });
    }
  }
  sharedAcrossUploaders(rows, (row) => row.view.fingerprint, (others) =>
    flag('shared-fingerprint', 'Shared Run', `This Report's Run fingerprint is also in the Report from ${others}.`));
  sharedAcrossUploaders(rows, attemptHistory, (others) =>
    flag('identical-history', 'Identical history', `This Report's Attempt history is identical to the Report from ${others}.`));
  flagWrongActivity(rows);
  return rows;
}

// The class majority is the Activity id and version most Reports come from. When
// no single one is most common there is no majority to differ from: no flag.
function flagWrongActivity(rows) {
  const activityOf = (row) => `${row.view.activity.id} version ${row.view.activity.version ?? '?'}`;
  const counts = new Map();
  for (const row of rows) counts.set(activityOf(row), (counts.get(activityOf(row)) ?? 0) + 1);
  if (counts.size < 2) return;
  const [[top, topCount], [, nextCount]] = [...counts].sort((a, b) => b[1] - a[1]);
  if (topCount === nextCount) return;
  for (const row of rows) {
    if (activityOf(row) === top) continue;
    row.flags.push(flag('wrong-activity', 'Different Activity',
      `This Report is from ${activityOf(row)}, but most of the class used ${top}.`));
  }
}

// Every Attempt of every Task, in order, with its State, answers and outcome but not
// its time, so a copier who replays the same values later still matches. Students
// who all pass on the first try with the same (e.g. snapped) values would match
// too, so only a history with at least one failed Attempt counts: two students
// missing in exactly the same way is the telltale. No Attempts is no history.
function attemptHistory(row) {
  const attempts = row.view.parts.flatMap((part) => part.tasks.flatMap((task) => task.attempts));
  if (!attempts.some((a) => !a.passed)) return null;
  return JSON.stringify(row.view.parts.map((part) => part.tasks.map((task) => task.attempts.map((a) =>
    [a.passed, a.state, a.answers, a.feedback]))));
}

// Flag every row whose key (when it has one) is shared with a row from a different
// uploader. One uploader turning in several files from the same Run is not flagged.
function sharedAcrossUploaders(rows, keyOf, makeFlag) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const group of groups.values()) {
    for (const row of group) {
      const others = [...new Set(group.map((r) => r.name).filter((n) => uploaderKey(n) !== uploaderKey(row.name)))];
      if (others.length) row.flags.push(makeFlag(others.join(', ')));
    }
  }
}

const uploaderKey = (name) => String(name).trim().toLowerCase();

// True if two names plausibly belong to the same person. Loose on purpose: it
// ignores case, accents, punctuation, initials and word order; every word of the
// shorter name must match its own word of the longer one, so middle names can be
// left out. Words match if equal, nicknames of each other (Bill / William), one is
// a prefix of at least 3 letters of the other (Chris / Christopher), or, for words
// of 5 letters or more, they differ by a single letter.
export function namesMatch(a, b) {
  const [short, long] = [nameWords(a), nameWords(b)].sort((x, y) => x.length - y.length);
  if (short.length === 0) return false;
  const unused = [...long];
  return short.every((word) => {
    const i = unused.findIndex((other) => wordsMatch(word, other));
    if (i < 0) return false;
    unused.splice(i, 1);
    return true;
  });
}

const nameWords = (name) => String(name ?? '')
  .normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/['’.]/g, '')
  .split(/[^\p{L}\p{N}]+/u)
  .filter((w) => w.length > 1);

function wordsMatch(a, b) {
  if (a === b) return true;
  if (NICKNAMES.get(a)?.has(b)) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 3 && l.startsWith(s)) return true;
  return s.length >= 5 && withinOneEdit(s, l);
}

// One insertion, deletion or substitution at most; s is no longer than l.
function withinOneEdit(s, l) {
  if (l.length - s.length > 1) return false;
  let i = 0;
  while (i < s.length && s[i] === l[i]) i++;
  return s.length === l.length ? s.slice(i + 1) === l.slice(i + 1) : s.slice(i) === l.slice(i + 1);
}

// Common English nicknames. Each group's names all match one another.
const NICKNAME_GROUPS = [
  'william bill billy will willy liam', 'robert bob bobby rob robbie bert', 'richard rick ricky dick rich',
  'elizabeth liz lizzie beth betty eliza libby', 'margaret maggie meg peggy marge', 'katherine catherine kate katie kathy cathy kat',
  'james jim jimmy jamie', 'john jack johnny jon', 'jonathan jon jonny', 'joseph joe joey', 'michael mike mikey mick',
  'thomas tom tommy', 'charles charlie chuck chas', 'edward ed eddie ted ned', 'theodore ted teddy theo',
  'anthony tony', 'daniel dan danny', 'david dave davy', 'steven stephen steve', 'andrew andy drew',
  'nicholas nick nicky', 'alexander alex xander sasha', 'alexandra alex lexi sasha', 'benjamin ben benny',
  'samuel sam sammy', 'samantha sam sammy', 'matthew matt', 'patrick pat paddy', 'patricia pat patty trish tricia',
  'peter pete', 'gregory greg', 'jeffrey geoffrey jeff', 'joshua josh', 'kenneth ken kenny', 'lawrence laurence larry',
  'ronald ron ronnie', 'donald don donnie', 'timothy tim timmy', 'zachary zach zack', 'frederick fred freddie',
  'henry hank harry', 'harold harry hal', 'susan sue suzy', 'deborah debra deb debbie', 'jennifer jen jenny',
  'jessica jess jessie', 'rebecca becky becca', 'victoria vicky tori', 'abigail abby', 'dorothy dot dottie',
  'christine chris chrissy tina', 'christina chris tina', 'barbara barb babs', 'kimberly kim', 'pamela pam',
  'cynthia cindy', 'judith judy', 'jacqueline jackie', 'nathaniel nathan nate', 'gerald gerry jerry',
  'eugene gene', 'raymond ray', 'leonard leo len lenny', 'francis frank frankie', 'frances fran frankie',
  'albert al bert', 'alfred al alf fred', 'isabella isabel bella izzy', 'gabriel gabe', 'gabrielle gabby',
  'vincent vince vinny', 'walter walt wally', 'douglas doug', 'phillip philip phil', 'mitchell mitch',
];
const NICKNAMES = new Map();
for (const group of NICKNAME_GROUPS) {
  const names = group.split(' ');
  for (const name of names) {
    if (!NICKNAMES.has(name)) NICKNAMES.set(name, new Set());
    for (const other of names) if (other !== name) NICKNAMES.get(name).add(other);
  }
}

const flag = (kind, label, message) => ({ kind, severity: 'flag', label, message });
