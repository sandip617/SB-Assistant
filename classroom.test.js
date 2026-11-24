const assert = require('assert'), { parseMail, merge, open, dailySummary } = require('./classroom');
const H = 36e5, now = new Date('2026-11-23T17:00:00').getTime(), mail = (subject, body, h = 1) => ({ from: 'Annesha Biswas (Classroom) <no-reply@classroom.google.com>', subject, body, at: new Date(now - h * H).toISOString() });
const a = parseMail(mail('New assignment: "ET-Remedial Revision File"', '￼ ￼ Notification settings 3rd Sem ET B ￼ NEW ASSIGNMENT ￼ ET-Remedial Revision File Dear all See details'));
assert.deepStrictEqual([a.kind, a.title, a.cls, a.due, a.teacher], ['new assignment', 'ET-Remedial Revision File', '3rd Sem ET B', null, 'Annesha Biswas']);
assert.strictEqual(new Date(parseMail(mail('Due tomorrow: "X"', 'Notification settings DAV DUE TOMORROW X Due Nov 24￼ View')).due).getHours(), 23);
assert.strictEqual(new Date(parseMail(mail('New assignment: "X"', 'Notification settings C NEW ASSIGNMENT X Due Nov 25, 5:30 PM')).due).getHours(), 17);
assert.strictEqual(new Date(parseMail({ ...mail('Due tomorrow: "X"', 'Due Jan 2'), at: '2026-12-30T10:00:00' }).due).getFullYear(), 2027);
assert.strictEqual(parseMail(mail('New material: "Notes"', 'x')), null);
let it = [], cl = [];
merge(it, cl, [mail('New assignment: "Old"', 'Notification settings Math NEW ASSIGNMENT Old', 24 * 20), mail('New material: "Notes"', 'Notification settings Physics NEW MATERIAL Notes'), mail('New assignment: "Essay"', 'Notification settings English NEW ASSIGNMENT Essay Due Nov 25, 5:00 PM')], now, true);
assert.deepStrictEqual(cl.sort(), ['English', 'Math', 'Physics']); assert.deepStrictEqual(open(it, now).map(i => i.title), ['Essay']); // old closed on first scan
const s = dailySummary(it, cl, now); assert.ok(s.includes('English-এ 1টা: Essay')); assert.ok(/কিছু বাকি নেই: .*Math/.test(s) && s.includes('Physics')); // has work / no work
merge(it, cl, [mail('New assignment: "Essay"', 'Notification settings English NEW ASSIGNMENT Essay')], now, false); assert.strictEqual(it.filter(i => i.title === 'Essay').length, 1); // no duplicate
merge(it, cl, [mail('Graded: "Essay"', 'Notification settings English GRADED Essay')], now, false); assert.ok(dailySummary(it, cl, now).startsWith('আজ Classroom-এ কোনো assignment বাকি নেই')); // graded closes it
assert.strictEqual(open([{ done: false, due: null, at: now - 31 * 24 * H }], now).length, 0); // undated work stops nagging
cl = ['DAV']; merge([], cl, [mail('Graded: "Netflix"', 'Notification settings DAV Netflix GRADED')], now, false); assert.deepStrictEqual(cl, ['DAV']); // title never becomes a subject
console.log('classroom tests ok');
