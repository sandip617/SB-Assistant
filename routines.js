// Repeating automations ("প্রতিদিন সকাল ৮টায় ..."). They only remind or report; a routine can never send, post, move or delete anything.
const rx = (s, f = 'i') => new RegExp(s.normalize('NFC'), f);
const clean = q => String(q).normalize('NFC').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).trim().replace(/[।!?\s]+$/, '');
const DAYS = [['রবি', 'sunday'], ['সোম', 'monday'], ['মঙ্গল', 'tuesday'], ['বুধ', 'wednesday'], ['বৃহস্পতি', 'thursday'], ['শুক্র', 'friday'], ['শনি', 'saturday']];
const NAMES = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const WORDS = { 'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'দশ': 10, 'এগারো': 11, 'বারো': 12 };
const num = '\\d{1,2}|' + Object.keys(WORDS).join('|');
const TIME = rx(`(ভোর|সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|সন্ধা|রাত)?(?:ে|ের)?\\s*(সাড়ে\\s*)?(${num})(?:[:.](\\d{2}))?\\s*(?:(টায়|টার|টা)|(am|pm)\\b)`);
const EVERY = rx('প্রতিদিন|প্রতি দিন|রোজ|\\bdaily\\b|\\bevery ?day\\b|(?:প্রতি|প্রত্যেক)\\s*(?:রবি|সোম|মঙ্গল|বুধ|বৃহস্পতি|শুক্র|শনি)|\\bevery (?:sun|mon|tues|wednes|thurs|fri|satur)day\\b');
const WANT = rx('মনে করি|\\bremind\\b|জানাবে|জানিও|জানাবা|বলবে|বলবা|বলে দিও|শোনাবে|শোনাবা|শুনিও|দিও|দিবে|দিবা');
const LIST = rx('অটোমেশন|\\bautomations?\\b|রুটিন|\\broutines?\\b');

function to24(period, h, half) {
  const m = half ? 30 : 0;
  if (period === 'am') return { hour: h % 12, minute: m };
  if (period === 'pm') return { hour: h % 12 + 12, minute: m };
  if (!period) return h > 12 && h < 24 ? { hour: h, minute: m } : null; // "৫টা" could be morning or evening
  if (/ভোর|সকাল/.test(period)) return { hour: h === 12 ? 12 : h, minute: m };
  if (/দুপুর/.test(period)) return { hour: h >= 11 ? h : h + 12, minute: m };
  if (/রাত/.test(period)) return { hour: h === 12 ? 0 : h <= 4 ? h : h + 12, minute: m };
  return { hour: h === 12 ? 12 : h + 12, minute: m }; // afternoon, evening
}
const pad = n => String(n).padStart(2, '0');
const clock = a => { const h = a.hour % 12 || 12, p = a.hour < 5 ? 'রাত' : a.hour < 12 ? 'সকাল' : a.hour < 16 ? 'দুপুর' : a.hour < 18 ? 'বিকাল' : a.hour < 20 ? 'সন্ধ্যা' : 'রাত'; return `${p} ${h}${a.minute ? ':' + pad(a.minute) : ''}টা`; };
const label = a => `${a.days ? 'প্রতি ' + a.days.map(d => NAMES[d]).join(', ') : 'প্রতিদিন'} ${clock(a)}`;
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parse(q) {
  const s = clean(q).replace(rx('(\\d{1,2})\\s*টা\\s+(\\d{2})(?:\\s*(?:মিনিটে|মিনিট|টায়))?'), '$1:$2টায়'); if (!s || s.length > 200) return null;
  if (LIST.test(s)) {
    if (rx('বাদ|বন্ধ|মুছ|ডিলিট|\\bdelete\\b|\\bremove\\b|\\bstop\\b').test(s)) { const n = /(\d+)/.exec(s); return { type: 'remove', n: n ? +n[1] : null }; }
    if (rx('দেখাও|কী কী|কি কি|তালিকা|\\blist\\b|\\bshow\\b|আছে').test(s)) return { type: 'list' };
  }
  if (!EVERY.test(s) || !WANT.test(s)) return null;
  const t = TIME.exec(s); if (!t) return { type: 'ask', say: 'কয়টায় করব? যেমন বলো, প্রতিদিন সকাল ৮টায়।' };
  const h = WORDS[t[3]] || +t[3], min = t[4] != null ? +t[4] : null, time = to24(t[6]?.toLowerCase() || t[1], h, !!t[2]);
  if (!time) return { type: 'ask', say: `${h}টা মানে সকাল না রাত? সকাল বা বিকাল সহ আবার বলো।` };
  if (min != null) time.minute = min;
  if (time.hour > 23 || time.minute > 59) return { type: 'ask', say: 'সময়টা ঠিক বুঝিনি, আবার বলো।' };
  const low = s.toLowerCase(), days = DAYS.map(([b, e], i) => rx(`(?:প্রতি|প্রত্যেক)\\s*${b}|,\\s*${b}বার|ও\\s*${b}বার|আর\\s*${b}বার`).test(s) || low.includes('every ' + e) ? i : -1).filter(i => i >= 0);
  const kind = rx('ব্রিফিং|\\bbriefing\\b').test(s) ? 'brief' : rx('ক্লাসরুম|\\bclassroom\\b|অ্যাসাইনমেন্ট|\\bassignments?\\b').test(s) ? 'classroom' : rx('মেইল|\\bmails?\\b|\\bemails?\\b').test(s) ? 'mail' : 'remind';
  const text = s.replace(EVERY, ' ').replace(rx('বার\\b'), ' ').replace(TIME, ' ').replace(rx('(?:আমাকে\\s*)?(?:মনে করিয়ে|মনে করাই[য়]ে)\\s*(?:দিও|দিবে|দিবা|দাও)?|\\bremind me(?: to)?\\b|জানিও|জানাবে|জানাবা|বলবে|বলবা|বলে দিও'), ' ').replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').slice(0, 120);
  if (kind === 'remind' && text.length < 2) return { type: 'ask', say: 'কী মনে করিয়ে দেব?' };
  return { type: 'add', ...time, days: days.length && days.length < 7 ? days : null, kind, text };
}

function create(p, now, id) { // a time already gone today starts tomorrow instead of firing at once
  const a = { id, hour: p.hour, minute: p.minute, days: p.days, kind: p.kind, text: p.text, last: null };
  if (now.getHours() * 60 + now.getMinutes() >= a.hour * 60 + a.minute) a.last = dayKey(now);
  return a;
}
// Late is fine (the Mac may have been asleep), but a routine runs at most once a day.
const isDue = (a, now) => a.last !== dayKey(now) && (!a.days || a.days.includes(now.getDay())) && now.getHours() * 60 + now.getMinutes() >= a.hour * 60 + a.minute;
const what = a => ({ brief: 'ব্রিফিং', classroom: 'Classroom-এর খবর', mail: 'College mail-এর খবর' })[a.kind] || a.text;
module.exports = { parse, create, isDue, label, what, dayKey };
