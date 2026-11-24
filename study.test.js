const assert = require('assert'), S = require('./study'), C = require('./classroom');
const at = (d, h = 9, m = 0) => new Date(2026, 10, d, h, m).getTime(), DAY = 864e5, HOUR = 3600e3;

// classroom board and reminders
const now = at(24);
const items = [{ id: 1, title: 'late', due: at(20) }, { id: 2, title: 'far', due: at(30) }, { id: 3, title: 'near', due: at(25) }, { id: 4, title: 'nodate', due: null }, { id: 5, title: 'gone', due: at(25), done: true }, { id: 6, title: 'old late', due: at(10) }];
const b = C.board(items, now);
assert.deepEqual(b.upcoming.map(x => x.id), [3, 2]); assert.deepEqual(b.overdue.map(x => x.id), [1, 6]); assert.deepEqual(b.noDate.map(x => x.id), [4]);
const it = [{ id: 1, title: 'A', due: now + 20 * HOUR }, { id: 2, title: 'B', due: now + 2 * HOUR }, { id: 3, title: 'C', due: now + 30 * HOUR }, { id: 4, title: 'D', due: now - HOUR }, { id: 5, title: 'E', due: now + HOUR, done: true }];
assert.equal(C.deadlineAlerts(it, now).length, 2); assert.equal(C.deadlineAlerts(it, now).length, 0, 'each reminder fires once');
assert.equal(C.deadlineAlerts(it, now + 7 * HOUR).length, 1, 'C enters 24h'); assert.equal(C.deadlineAlerts(it, now + 18 * HOUR).length, 1, 'the 3-hour one follows');

// exam plan
let s = S.fresh();
assert(S.addExam(s, { name: 'Physics', date: at(20), chapters: ['a'] }, now).error, 'past date');
assert(S.addExam(s, { name: 'Physics', date: at(29), chapters: [] }, now).error, 'no chapters');
const { exam } = S.addExam(s, { name: 'Physics', date: at(29), chapters: ['১', '২', '৩', '৪', '৫', '৬'] }, now);
let p = S.buildPlan(s, now);
assert.equal(p.length, 6); assert.equal(p.slice(0, 4).flatMap(d => d.items).length, 6, 'all chapters before revision day');
assert(p[4].items[0].revision, 'the day before is revision'); assert.deepEqual(p[5].exams, ['Physics']); assert.equal(p[5].items.length, 0);
S.rollDay(s, now); const first = p[0].items.length;
S.toggleChapter(s, p[0].items[0].chapterId); assert.equal(exam.chapters.filter(c => c.done).length, 1);
assert(S.rollDay(s, at(25))); assert.equal(s.carried, first - 1, 'unfinished chapters are counted'); assert(!S.rollDay(s, at(25, 20)));
p = S.buildPlan(s, at(25)); assert.equal(p.slice(0, 3).flatMap(d => d.items).length, 5, 'falling behind re-plans into fewer days');
const crash = S.fresh(); S.addExam(crash, { name: 'M', date: at(25), chapters: ['x', 'y', 'z'] }, now); assert.equal(S.buildPlan(crash, now)[0].items.length, 3, 'one day left still fits everything');
const two = S.fresh(); S.addExam(two, { name: 'A', date: at(26), chapters: ['a1', 'a2'] }, now); S.addExam(two, { name: 'B', date: at(27), chapters: ['b1', 'b2'] }, now);
assert.equal(S.buildPlan(two, now).flatMap(d => d.items).filter(x => x.chapter).length, 4); assert(S.todayList(two, now).includes('a1'));
const dup = S.fresh(); S.addExam(dup, { name: 'A', date: at(26), chapters: ['x'] }, now); S.addExam(dup, { name: 'a', date: at(26), chapters: ['x', 'y'] }, now); assert.equal(dup.exams.length, 1); assert.equal(dup.exams[0].chapters.length, 2);

// top three
const t = S.topThree({ classwork: [{ title: 'Soon', due: now + 5 * HOUR }, { title: 'Far', due: now + 6 * DAY }, { title: 'Sub', due: now + HOUR, done: true }], study: two, tasks: [{ text: 'আজ', due: S.dayKey(now) + 'T20:00' }], unread: [['LinkedIn', 'exam offer'], ['Dean <d@u.in>', 'Urgent: exam fee last date']] }, now);
assert.equal(t.length, 3); assert(t[0].what.startsWith('Soon')); assert(t.some(x => x.what.startsWith('A:')), 'exam prep'); assert(t.some(x => x.what.includes('exam fee')), 'urgent mail'); assert(!t.some(x => x.what.includes('offer'))); assert(t.every(x => x.why));
assert(S.topText(t).text.startsWith('আজকের তিনটা কাজ')); assert(S.topText([]).text.includes('জরুরি কিছু পাইনি') || S.topText([]).text.includes('পেলাম না'));

// quiz
const raw = 'x [{"type":"mcq","q":"Q1","options":["a","b","c","d"],"answer":2,"explain":"e"},{"type":"mcq","q":"bad","options":["a","a","c","d"],"answer":0},{"type":"mcq","q":"bad2","options":["a","b","c","d"],"answer":7},{"type":"short","q":"Q2","answer":"ans","explain":"e2"}] y';
const qs = S.parseQuestions(raw); assert.deepEqual(qs.map(x => x.q), ['Q1', 'Q2']); assert.deepEqual(S.parseQuestions('nope'), []);
for (const [a, r] of [['গ', 2], ['c', 2], ['C.', 2], ['3', 2], ['৩', 2], ['উত্তর: গ', 2], ['b', 1], ['হয়তো', -1]]) assert.equal(S.mcqChoice(qs[0], a), r, a);
let q = S.fresh(); S.startQuiz(q, qs, 'notes', now); assert(S.showQuestion(q.quiz).includes('গ) c'));
assert.equal(S.applyAnswer(q, false, now).done, false); assert.equal(q.review.length, 1); assert.equal(q.review[0].due, now + DAY);
const end = S.applyAnswer(q, true, now); assert(end.done); assert.deepEqual([end.log.right, end.log.total], [1, 2]); assert.equal(q.quiz, null);
assert.equal(S.dueReview(q, now).length, 0); assert.equal(S.dueReview(q, now + DAY).length, 1);
S.startQuiz(q, [], 'r', now + DAY); assert(q.quiz.items[0].reviewId); assert(S.showQuestion(q.quiz).includes('আগের ভুল'));
S.applyAnswer(q, true, now + DAY); assert.equal(q.review[0].box, 1); assert.equal(q.review[0].due, now + 4 * DAY, 'next gap is 3 days');
q.review[0].box = 3; S.startQuiz(q, [], 'r', now + 9 * DAY); S.applyAnswer(q, true, now + 9 * DAY); assert.equal(q.review.length, 0, 'learned after the last gap');
assert.equal(S.startQuiz(S.fresh(), [], 'x', now), null);
const st = S.fresh(); S.startQuiz(st, qs, 'n', now); S.applyAnswer(st, true, now); assert.deepEqual([S.stopQuiz(st, now).right, st.quiz], [1, null]);

// focus
let f = S.fresh(); S.startFocus(f, 'Physics', now); assert(S.focusing(f)); assert.equal(S.focusTick(f, now + 10 * 60e3), null);
assert(/বিরতি/.test(S.focusTick(f, now + S.FOCUS))); assert(!S.focusing(f)); assert.equal(f.focus.phase, 'break'); assert.equal(f.focusLog.length, 1);
assert(/বিরতি শেষ/.test(S.focusTick(f, now + S.FOCUS + S.BREAK))); assert.equal(f.focus, null);
let g = S.fresh(); S.startFocus(g, 'Math', now); assert(/বিরতি শেষ/.test(S.focusTick(g, now + 3 * HOUR)), 'a long sleep skips the break'); assert.equal(g.focusLog.length, 1);
let h = S.fresh(); S.startFocus(h, 'Bio', now); assert.equal(S.stopFocus(h, now + 3 * 60e3).min, 3); assert.equal(h.focusLog.length, 0, 'under 5 minutes is not logged');
S.startFocus(h, 'Bio', now); S.stopFocus(h, now + 10 * 60e3); assert.deepEqual(h.focusLog.map(l => [l.min, l.full]), [[10, false]]);
const w = S.weekFocus(f, now + S.FOCUS); assert.equal(w.sessions, 1); assert.equal(w.by.Physics.sessions, 1); assert.equal(S.weekFocus(f, at(24) + 7 * DAY).sessions, 0, 'a new week starts clean');
const { YT_ID, focusSubject } = require('./studyroutes');
for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?t=3', 'https://www.youtube.com/watch?t=9&v=dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ']) assert.equal(YT_ID.exec('এই ভিডিওটা বুঝিয়ে দাও ' + u)?.[1], 'dQw4w9WgXcQ', u);
assert.equal(YT_ID.exec('https://evil.example/watch?v=dQw4w9WgXcQ'), null); assert.equal(focusSubject('Physics পড়তে বসছি'), 'Physics'); assert.equal(focusSubject('পড়তে বসছি'), '');
{ // during an MCQ, a different request is not taken as the answer
  const db = { tasks: [], classwork: [] }, st = require('./studyroutes').makeStudy({ db, save() {}, askClaude: async () => '{}', uploads: new Map(), voice: { fit: x => x, strip: x => x }, mail: { unread: [] } });
  db.study.quiz = { at: Date.now(), i: 0, right: 0, items: [{ type: 'mcq', q: '?', options: ['a', 'b', 'c', 'd'], answer: 1 }] };
  for (const q of ['খ', 'আমার মনে হয় গ', 'quiz বন্ধ']) assert(st.job(q, null), q);
  for (const q of ['Facebook খোলো', 'ভলিউম বাড়াও']) assert.equal(st.job(q, null), null, q);
}
console.log('study tests ok');
process.exit(0); // makeStudy keeps a timer running
