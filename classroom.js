// Google Classroom via its notification emails: tracks subjects and open assignments for the daily 5 PM summary.
const DAY = 864e5;
const fmt = ms => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const clean = b => b.replace(/￼/g, ' ').replace(/\s+/g, ' ');
const classOf = body => (/Notification settings\s*(.*?)\s*(?:NEW [A-Z]+|DUE TOMORROW|DUE TODAY|GRADED|RETURNED)/.exec(clean(body)) || [])[1] || '';

function parseMail({ from = '', subject = '', body = '', at }) {
  const m = /^(New assignment|Due tomorrow|Due today|Graded|Returned)[^:]*:\s*"?(.*?)"?\s*$/i.exec(subject.replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const kind = m[1].toLowerCase(), title = m[2].replace(/…$/, '').trim(), sent = new Date(at).getTime(), t = clean(body);
  const d = /\bDue ((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2})(?:,? (\d{1,2}:\d{2} ?[AP]M))?/.exec(t);
  let due = null;
  if (d) { // the email has no year: a date far behind the email belongs to next year
    const y = new Date(sent).getFullYear(), at2 = yr => new Date(`${d[1]}, ${yr} ${(d[2] || '11:59 PM').replace(/([AP]M)/, ' $1').replace(/\s+/g, ' ')}`).getTime();
    due = at2(y); if (due < sent - 180 * DAY) due = at2(y + 1);
    if (isNaN(due)) due = null;
  }
  return { kind, title, cls: classOf(body), due, at: sent, teacher: (/^"?(.*?) \(Classroom\)/.exec(from) || [])[1] || '', key: title.toLowerCase().replace(/\s+/g, ' ').slice(0, 30) };
}

// first = first scan ever: anything already old is closed instead of listed.
function merge(items, classes, mails, now, first) {
  for (const m of mails) { if (/^(Graded|Returned)/i.test(m.subject || '')) continue; const c = classOf(m.body || ''); if (c && !classes.includes(c)) classes.push(c); } // graded mails put the title next to the class name
  let id = items.reduce((a, i) => Math.max(a, i.id), 0);
  for (const p of mails.map(parseMail).filter(Boolean).sort((a, b) => a.at - b.at)) {
    const it = items.find(i => i.key === p.key);
    if (p.kind === 'graded' || p.kind === 'returned') { if (it) it.done = true; continue; }
    if (!it) items.push({ id: ++id, key: p.key, title: p.title, cls: p.cls, teacher: p.teacher, at: p.at, due: p.due, done: false });
    else if (p.due) it.due = p.due;
  }
  if (first) for (const i of items) if (i.due ? i.due < now : now - i.at > 14 * DAY) i.done = true;
}
// a past-due item stays one day; one with no date drops off after 30 days, so the summary can't nag forever
const open = (items, now) => items.filter(i => !i.done && (i.due ? i.due > now - DAY : now - i.at < 30 * DAY));

// What the HUD shows: only work not marked submitted. Mail cannot prove a submission, so "done" means graded, returned, or the owner's button.
function board(items, now) {
  const left = items.filter(i => !i.done), byDue = (a, b) => a.due - b.due;
  return { overdue: left.filter(i => i.due && i.due <= now).sort((a, b) => b.due - a.due), upcoming: left.filter(i => i.due && i.due > now).sort(byDue), noDate: left.filter(i => !i.due).sort((a, b) => b.at - a.at) };
}
// In-HUD reminders, once each, 24 and 3 hours before a deadline.
function deadlineAlerts(items, now) {
  const out = [];
  for (const i of items) {
    if (i.done || !i.due || i.due <= now) continue;
    const left = i.due - now, name = i.title + (i.cls ? ` (${i.cls})` : '');
    if (left <= 3 * 3600e3 && !i.warn3) { i.warn3 = i.warn24 = true; out.push(`${name} জমার আর ৩ ঘণ্টাও বাকি নেই, শেষ সময় ${fmt(i.due)}।`); }
    else if (left <= DAY && !i.warn24) { i.warn24 = true; out.push(`${name} জমার ২৪ ঘণ্টাও বাকি নেই, শেষ সময় ${fmt(i.due)}।`); }
  }
  return out;
}

function dailySummary(items, classes, now) {
  const list = open(items, now), by = new Map();
  for (const i of list) { const c = i.cls || 'অন্যান্য'; by.set(c, [...(by.get(c) || []), i]); }
  const free = classes.filter(c => !by.has(c));
  if (!list.length) return 'আজ Classroom-এ কোনো assignment বাকি নেই।' + (free.length ? ` সব subject ফাঁকা: ${free.join(', ')}।` : '');
  const parts = [...by].map(([c, a]) => `${c}-এ ${a.length}টা: ${a.slice(0, 3).map(i => i.title + (i.due ? ` (জমা ${fmt(i.due)})` : '')).join(', ')}${a.length > 3 ? `, আরও ${a.length - 3}টা` : ''}।`);
  return `আজকের Classroom। বাকি আছে, ${parts.join(' ')}` + (free.length ? ` কিছু বাকি নেই: ${free.join(', ')}।` : '');
}
module.exports = { parseMail, merge, open, board, deadlineAlerts, dailySummary, fmt };
