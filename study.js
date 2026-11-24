// Study logic with no I/O: top 3 of the day, exam plan, quiz with spaced repetition, and the focus timer.
const DAY = 864e5, MIN = 60_000;
const pad = n => String(n).padStart(2, '0');
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const midnight = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (t, n) => { const d = new Date(midnight(t)); d.setDate(d.getDate() + n); return d.getTime(); };
const daysBetween = (a, b) => Math.round((midnight(b) - midnight(a)) / DAY); // rounding absorbs daylight-saving days
const shortDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fresh = () => ({ exams: [], nid: 1, review: [], quizLog: [], focusLog: [], focus: null, quiz: null, lastDay: null, lastIds: [], carried: 0 });
const norm = s => String(s ?? '').normalize('NFC').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).trim();

// ---- exam plan: rebuilt from unfinished chapters every time, so falling behind re-plans by itself ----
function addExam(s, { name, date, chapters }, now = Date.now()) {
  const n = norm(name).slice(0, 80), at = new Date(date).getTime(), list = [...new Set((chapters || []).map(c => norm(c).slice(0, 100)).filter(Boolean))].slice(0, 60);
  if (!n) return { error: 'কোন বিষয়ের পরীক্ষা বলো।' };
  if (!Number.isFinite(at) || midnight(at) < midnight(now)) return { error: 'পরীক্ষার তারিখটা ঠিক নয়।' };
  if (!list.length) return { error: 'অন্তত একটা chapter দাও।' };
  const old = s.exams.find(e => e.name.toLowerCase() === n.toLowerCase() && dayKey(e.date) === dayKey(at));
  if (old) { for (const c of list) if (!old.chapters.some(x => x.name.toLowerCase() === c.toLowerCase())) old.chapters.push({ id: s.nid++, name: c, done: false }); return { exam: old }; }
  const exam = { id: s.nid++, name: n, date: at, chapters: list.map(c => ({ id: s.nid++, name: c, done: false })) };
  s.exams.push(exam); return { exam };
}
const upcoming = (s, now) => s.exams.filter(e => midnight(e.date) >= midnight(now)).sort((a, b) => a.date - b.date);
function buildPlan(s, now = Date.now()) {
  const exams = upcoming(s, now); if (!exams.length) return [];
  const left = new Map(exams.map(e => [e.id, e.chapters.filter(c => !c.done)])), total = daysBetween(now, exams.at(-1).date), plan = [];
  for (let i = 0; i <= total; i++) {
    const t = addDays(now, i), day = { day: dayKey(t), at: t, items: [], exams: [] };
    for (const e of exams) {
      const until = daysBetween(t, e.date); if (until < 0) continue;
      if (until === 0) { day.exams.push(e.name); continue; }
      const rem = left.get(e.id), studyDays = until === 1 ? 1 : until - 1; // the day before an exam is kept for revision when there is time
      if (until === 1 && !rem.length) { day.items.push({ examId: e.id, exam: e.name, revision: true }); continue; }
      for (const c of rem.splice(0, Math.ceil(rem.length / studyDays))) day.items.push({ examId: e.id, exam: e.name, chapterId: c.id, chapter: c.name });
    }
    plan.push(day);
  }
  return plan;
}
// Once a day: how many of yesterday's chapters were left, so SB can say the plan moved.
function rollDay(s, now = Date.now()) {
  const key = dayKey(now); if (s.lastDay === key) return false;
  const done = new Set(s.exams.flatMap(e => e.chapters.filter(c => c.done).map(c => c.id)));
  s.carried = s.lastDay ? s.lastIds.filter(id => !done.has(id)).length : 0;
  s.lastDay = key; s.lastIds = (buildPlan(s, now)[0]?.items || []).filter(x => x.chapterId).map(x => x.chapterId); return true;
}
function toggleChapter(s, id) { for (const e of s.exams) { const c = e.chapters.find(x => x.id === +id); if (c) { c.done = !c.done; return c; } } return null; }
function removeExam(s, id) { const i = s.exams.findIndex(e => e.id === +id); if (i < 0) return false; s.exams.splice(i, 1); return true; }
function todayList(s, now = Date.now()) {
  const d = buildPlan(s, now)[0]; if (!d) return '';
  const parts = d.items.map(x => x.revision ? `${x.exam}: পুরো revision` : `${x.exam}: ${x.chapter}`);
  return [d.exams.length ? `আজ পরীক্ষা: ${d.exams.join(', ')}` : '', parts.length ? `আজকের পড়া, ${parts.join('; ')}` : ''].filter(Boolean).join('। ');
}

// ---- top 3 of the day: scored in code so the same facts always give the same answer ----
const URGENT = /urgent|জরুরি|deadline|last date|exam|পরীক্ষা|fee|ফি\b|hall ticket|admit|result|internal|attendance|viva|practical/i;
const VERY = /urgent|জরুরি|today|tomorrow|আজ|কাল|last date/i;
const PROMO = /linkedin|udemy|coursera|newsletter|noreply@(?:medium|quora)|classroom\.google|black friday|sale|offer|discount|unsubscribe|new message|recently posted/i;
function topThree({ classwork = [], study = fresh(), tasks = [], unread = [] }, now = Date.now()) {
  const c = [];
  for (const i of classwork) {
    if (i.done || !i.due) continue;
    const h = (i.due - now) / 3600_000, name = `${i.title}${i.cls ? ` (${i.cls})` : ''} জমা দাও`;
    if (h < 0) { if (h > -14 * 24) c.push({ score: 95, what: name, why: `জমার সময় ${shortDate(i.due)} পেরিয়ে গেছে` }); }
    else if (h <= 24) c.push({ score: 100, what: name, why: `মাত্র ${Math.max(1, Math.round(h))} ঘণ্টা বাকি` });
    else if (h <= 72) c.push({ score: 80, what: name, why: `${Math.ceil(h / 24)} দিনের মধ্যে জমা` });
    else if (h <= 168) c.push({ score: 50, what: name, why: `${shortDate(i.due)}-এ জমা` });
  }
  const today = buildPlan(study, now)[0];
  for (const e of upcoming(study, now)) {
    const left = daysBetween(now, e.date), items = today?.items.filter(x => x.examId === e.id) || [];
    if (!items.length) continue;
    const what = items[0].revision ? `${e.name} পুরো revision করো` : `${e.name}: ${items.map(x => x.chapter).slice(0, 3).join(', ')} পড়ো`;
    c.push({ kind: 'exam', score: left <= 3 ? 90 : left <= 7 ? 70 : 45, what, why: `${left} দিন পরে পরীক্ষা` });
  }
  for (const t of tasks) {
    if (t.done || !t.due) continue;
    const d = daysBetween(now, t.due); if (d === 0) c.push({ score: 75, what: t.text, why: 'আজকের কাজ' }); else if (d === -1 || d === -2) c.push({ score: 55, what: t.text, why: 'সময় পেরিয়ে গেছে' });
  }
  const mail = unread.find(([from, subject]) => URGENT.test(subject) && !PROMO.test(`${from} ${subject}`));
  if (mail) c.push({ score: VERY.test(mail[1]) ? 85 : 60, what: `Mail দেখো: ${String(mail[1]).slice(0, 70)}`, why: 'জরুরি মনে হচ্ছে' });
  // one slot for exam prep, so a busy exam week can't push out a deadline or an urgent mail
  let exams = 0; return c.sort((a, b) => b.score - a.score).filter(x => x.kind !== 'exam' || !exams++).slice(0, 3);
}
const BN = ['১', '২', '৩'];
function topText(list) {
  if (!list.length) return { text: 'আজ জরুরি কিছু পেলাম না। পরীক্ষার তারিখ আর chapter দিলে আমি পড়ার প্ল্যান সাজিয়ে দেব।', spoken: '[warm] আজ জরুরি কিছু পেলাম না।' };
  return { text: `আজকের ${list.length === 3 ? 'তিনটা' : list.length === 2 ? 'দুইটা' : 'একটা'} কাজ:\n` + list.map((x, i) => `${BN[i]}. ${x.what}\n   কেন: ${x.why}`).join('\n'), spoken: '[warm] ' + list.map((x, i) => `${i ? 'তারপর' : 'আগে'} ${x.what}, কারণ ${x.why}।`).join(' ') };
}

// ---- quiz: wrong answers come back after 1, 3, 7, then 14 days ----
const GAPS = [1, 3, 7, 14], LETTERS = ['ক', 'খ', 'গ', 'ঘ'];
function parseQuestions(raw) {
  const m = /\[[\s\S]*\]/.exec(String(raw)); if (!m) return [];
  let a; try { a = JSON.parse(m[0]); } catch { return []; }
  const out = [];
  for (const x of Array.isArray(a) ? a : []) {
    const q = norm(x?.q).slice(0, 400), explain = norm(x?.explain).slice(0, 500); if (!q) continue;
    if (x.type === 'mcq') { const options = (x.options || []).map(o => norm(o).slice(0, 160)); if (options.length === 4 && options.every(Boolean) && new Set(options).size === 4 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4) out.push({ type: 'mcq', q, options, answer: x.answer, explain }); }
    else if (x.type === 'short' && norm(x.answer)) out.push({ type: 'short', q, answer: norm(x.answer).slice(0, 300), explain });
  }
  return out.slice(0, 12);
}
const dueReview = (s, now = Date.now()) => s.review.filter(r => r.due <= now);
function startQuiz(s, questions, source, now = Date.now()) {
  const again = dueReview(s, now).slice(0, 4).map(r => ({ ...r.q, reviewId: r.id })), have = new Set(again.map(x => x.q)), items = [...again, ...questions.filter(x => !have.has(x.q))].slice(0, 12);
  if (!items.length) return null;
  s.quiz = { source: String(source || '').slice(0, 80), items, i: 0, right: 0, at: now }; return s.quiz;
}
const showQuestion = z => { const x = z.items[z.i]; return `প্রশ্ন ${z.i + 1}/${z.items.length}${x.reviewId ? ' (আগের ভুল)' : ''}: ${x.q}` + (x.type === 'mcq' ? '\n' + x.options.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n') : ''); };
function mcqChoice(x, ans) {
  const a = norm(ans).replace(/[।.!?)\s]+$/, '').replace(/^(?:উত্তর|answer|option|অপশন)[\s:]*/i, '').trim(), low = a.toLowerCase();
  let i = LETTERS.indexOf(a); if (i >= 0) return i;
  i = ['a', 'b', 'c', 'd'].indexOf(low); if (i >= 0) return i;
  if (/^[1-4]$/.test(a)) return +a - 1;
  return x.options.findIndex(o => o.toLowerCase() === low);
}
// Applies one answer. Returns the feedback and whether the quiz ended.
function applyAnswer(s, correct, now = Date.now()) {
  const z = s.quiz, x = z.items[z.i]; if (correct) z.right++;
  const old = x.reviewId ? s.review.find(r => r.id === x.reviewId) : s.review.find(r => r.q.q === x.q);
  if (correct && old) { old.box++; if (old.box >= GAPS.length) s.review.splice(s.review.indexOf(old), 1); else old.due = now + GAPS[old.box] * DAY; }
  if (!correct) { const { reviewId, ...q } = x; if (old) { old.box = 0; old.due = now + DAY; } else s.review.push({ id: s.nid++, q, box: 0, due: now + DAY }); if (s.review.length > 300) s.review.shift(); }
  z.i++;
  if (z.i < z.items.length) return { done: false };
  const log = { at: now, source: z.source, right: z.right, total: z.items.length }; s.quizLog.push(log); s.quizLog = s.quizLog.slice(-200); s.quiz = null; return { done: true, log };
}
const stopQuiz = (s, now = Date.now()) => { const z = s.quiz; if (!z) return null; s.quiz = null; if (z.i) { const log = { at: now, source: z.source, right: z.right, total: z.i }; s.quizLog.push(log); return log; } return { right: 0, total: 0 }; };

// ---- focus timer: the server holds the clock, so a page reload doesn't lose it ----
const FOCUS = 25 * MIN, BREAK = 5 * MIN;
function startFocus(s, subject, now = Date.now()) { s.focus = { subject: norm(subject).slice(0, 40) || 'পড়া', phase: 'focus', endsAt: now + FOCUS, startedAt: now }; return s.focus; }
function stopFocus(s, now = Date.now()) {
  const f = s.focus; if (!f) return null; s.focus = null;
  const min = f.phase === 'focus' ? Math.floor((now - f.startedAt) / MIN) : 0;
  if (min >= 5) s.focusLog.push({ at: now, subject: f.subject, min, full: false });
  return { ...f, min };
}
function focusTick(s, now = Date.now()) {
  const f = s.focus; if (!f || now < f.endsAt) return null;
  if (f.phase === 'focus') { s.focusLog.push({ at: f.endsAt, subject: f.subject, min: 25, full: true }); s.focusLog = s.focusLog.slice(-1000); f.phase = 'break'; f.endsAt += BREAK; if (now < f.endsAt) return `২৫ মিনিট শেষ, দারুণ! এবার ৫ মিনিট বিরতি নাও।`; }
  s.focus = null; return 'বিরতি শেষ। আবার বসতে চাইলে বলো, পড়তে বসছি।';
}
const focusing = s => s.focus?.phase === 'focus';
function weekFocus(s, now = Date.now()) {
  const d = new Date(midnight(now)), from = addDays(d, -((d.getDay() + 6) % 7)), by = {}; let sessions = 0, minutes = 0; // the week starts on Monday
  for (const l of s.focusLog) { if (l.at < from) continue; minutes += l.min; if (l.full) sessions++; const b = by[l.subject] ||= { sessions: 0, min: 0 }; b.min += l.min; if (l.full) b.sessions++; }
  return { sessions, minutes, by };
}
module.exports = { fresh, dayKey, addExam, upcoming, buildPlan, rollDay, toggleChapter, removeExam, todayList, topThree, topText, parseQuestions, dueReview, startQuiz, showQuestion, mcqChoice, applyAnswer, stopQuiz, startFocus, stopFocus, focusTick, focusing, weekFocus, LETTERS, FOCUS, BREAK };
