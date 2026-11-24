// Mac control decided in code, never by the model, so text from a page or mail cannot trigger it.
// The owner chose that these run at once when asked, with no confirmation card.
const fs = require('fs'), os = require('os'), path = require('path'), { execFile } = require('child_process');
const run = (cmd, args) => new Promise((ok, no) => execFile(cmd, args, { timeout: 15_000 }, (e, so) => e ? no(e) : ok(so.trim())));
const rx = (s, f = 'i') => new RegExp(s.normalize('NFC'), f); // Bangla য় ড় can arrive in two encodings
const NUMBERS = { 'একশো': 100, 'একশ': 100, 'পঁচানব্বই': 95, 'নব্বই': 90, 'পঁচাশি': 85, 'আশি': 80, 'পঁচাত্তর': 75, 'সত্তর': 70, 'পঁয়ষট্টি': 65, 'ষাট': 60, 'পঞ্চান্ন': 55, 'পঞ্চাশ': 50, 'পঁয়তাল্লিশ': 45, 'চল্লিশ': 40, 'পঁয়ত্রিশ': 35, 'তিরিশ': 30, 'ত্রিশ': 30, 'পঁচিশ': 25, 'বিশ': 20, 'পনেরো': 15, 'দশ': 10, 'পাঁচ': 5, 'শূন্য': 0 };
const TRAILING = rx('(?:\\s+(?:just|please|প্লিজ|একটু|তো|শুধু))+$');
const NUM_RE = rx(Object.keys(NUMBERS).join('|'), 'g'), NUM_MAP = Object.fromEntries(Object.entries(NUMBERS).map(([k, v]) => [k.normalize('NFC'), v]));
const FILLER = rx('^(?:(?:amar|tumi|tor|tar|ektu|master|মাস্টার|স্যার|হেই|হে|এসবি|sb|hey|please|প্লিজ|একটু|তার|ওর|আমার|তোর|তোমার|তুমি|তুই|শুধু|just|আ|উম|এই|ল্যাপটপের|ম্যাকের|কম্পিউটারের|mac-?এর|laptop-?এর)[\\s,]+)+');
const clean = q => String(q).normalize('NFC').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).trim().replace(/[।!.?,\s]+$/, '').replace(TRAILING, '').replace(FILLER, '').replace(NUM_RE, w => NUM_MAP[w]);

const VOL = rx('ভলিউম|\\bvolume\\b|সাউন্ড|\\bsound\\b|আওয়াজ'), NOT_MAC = rx('ভিডিও|\\bvideo\\b|রিল|\\breel\\b|পোস্ট|ক্যাপশন|রিভিউ|\\breview\\b');
const BRIGHT = rx('brightness|ব্রাইটনেস|ব্রাইটনেশ|(?:স্ক্রিনের|পর্দার)\\s*আলো');
const WIFI = rx('wi-?\\s?fi|ওয়াই-?\\s?ফাই');
const TAIL = '(?:\\s+(?:অ্যাপ(?:টা|টি)?|\\bapp\\b))?(?:\\s*একটু)?\\s*';
const DO = '(?:\\s*(?:করো|কর|করে দাও|করে দিও|করে ফেলো|দাও|koro|kor|kore dao|kore daw|dao|daw))?$';
const OPEN = rx(TAIL + '(?:খোলো|খুলো|খোল|খুলে দাও|খুলে দিও|খুলে ফেলো|চালাও|\\bkhulo\\b|\\bkholo\\b|\\bkhule (?:dao|daw)\\b|(?:চালু|অন|ওপেন|স্টার্ট|\\bchalu\\b|\\bon\\b|\\bopen\\b|\\bstart\\b)' + DO + ')');
const QUIT = rx(TAIL + '(?:বন্ধ|অফ|কুইট|\\bbondho\\b|\\bbondo\\b|\\boff\\b|\\bquit\\b|\\bclose\\b)' + DO);
const UP = rx('\\bbarao\\b|\\bbariye\\b|বাড়া|বাড়িয়ে|\\bup\\b|\\bincrease\\b'), DOWN = rx('\\bkomao\\b|\\bkomiye\\b|কমা|কমিয়ে|\\bdown\\b|\\bdecrease\\b'), MAX = rx('ফুল|\\bfull\\b|সর্বোচ্চ|\\bmax\\b'), ASK = rx('কত|\\bhow much\\b');
// Closing these would stop SB itself (its app, its page, its server or its brain).
const PROTECTED = new Set(['SB', 'Safari', 'Terminal', 'Finder', 'Claude']);
const ALIASES = { 'সাফারি': 'Safari', 'নোটস': 'Notes', 'নোট': 'Notes', 'মেইল': 'Mail', 'ক্যালেন্ডার': 'Calendar', 'ফাইন্ডার': 'Finder', 'ক্যালকুলেটর': 'Calculator', 'মিউজিক': 'Music', 'গান': 'Music', 'ফটোস': 'Photos', 'ছবি': 'Photos', 'মেসেজ': 'Messages', 'হোয়াটসঅ্যাপ': 'WhatsApp', 'হোয়াটস অ্যাপ': 'WhatsApp', 'ডিসকর্ড': 'Discord', 'ক্যানভা': 'Canva', 'ভিএলসি': 'VLC', 'এক্সকোড': 'Xcode', 'টার্মিনাল': 'Terminal', 'ক্লড': 'Claude', 'প্রিমিয়ার': 'Premiere', 'প্রিমিয়ার প্রো': 'Premiere', 'আফটার ইফেক্টস': 'After Effects', 'অ্যান্টিগ্র্যাভিটি': 'Antigravity', 'এন্টিগ্র্যাভিটি': 'Antigravity', 'অ্যান্টি গ্র্যাভিটি': 'Antigravity', 'এন্টি গ্র্যাভিটি': 'Antigravity' };

const apps = () => ['/Applications', '/System/Applications'].flatMap(d => { try { return fs.readdirSync(d).filter(f => f.endsWith('.app')).map(f => f.slice(0, -4)); } catch { return []; } });
function findApp(name, list) {
  const raw = name.trim().replace(rx('(?:টা|টি)$'), '').trim(), n = (Object.entries(ALIASES).find(([k]) => k.normalize('NFC') === raw)?.[1] || raw).toLowerCase();
  if (n.length < 3) return null;
  return list.find(a => a.toLowerCase() === n) || list.filter(a => new RegExp('(^|\\s)' + n.replace(/[^a-z0-9 ]/g, '\\$&') + '(\\s|$)').test(a.toLowerCase())).sort().at(-1) || null; // newest of "Premiere 2026/2027"
}
const level = (s, set, step, status) => {
  const n = /(\d{1,3})/.exec(s); if (n && +n[1] <= 100) return { op: set, value: +n[1] };
  if (MAX.test(s)) return { op: set, value: 100 };
  if (UP.test(s)) return { op: step, by: 15 };
  if (DOWN.test(s)) return { op: step, by: -15 };
  return ASK.test(s) ? { op: status } : null;
};

function parse(q, list = apps()) {
  const s = clean(q); if (!s || s.length > 70) return null;
  if (BRIGHT.test(s) && !NOT_MAC.test(s)) return level(s, 'brightness', 'brightStep', 'brightStatus');
  if (VOL.test(s) && !NOT_MAC.test(s)) {
    if (rx('আনমিউট|\\bunmute\\b').test(s)) return { op: 'unmute' };
    if (rx('মিউট|\\bmute\\b|(?:সাউন্ড|আওয়াজ|ভলিউম)\\s*(?:বন্ধ|অফ)').test(s)) return { op: 'mute' };
    return level(s, 'volume', 'step', 'volumeStatus');
  }
  if (WIFI.test(s)) {
    if (rx('আছে|\\bstatus\\b|(?:^|\\s)কি(?:\\s|$)|(?:^|\\s)কী(?:\\s|$)').test(s)) return { op: 'wifiStatus' };
    if (rx('বন্ধ|\\bbondho\\b|\\bbondo\\b|(?:^|\\s)অফ(?:\\s|$)|\\boff\\b').test(s)) return { op: 'wifiOff' };
    if (rx('চালু|\\bchalu\\b|(?:^|\\s)অন(?:\\s|$)|\\bon\\b').test(s)) return { op: 'wifiOn' };
    return null;
  }
  let m = /^open\s+(.+)$/i.exec(s), name = m?.[1];
  if (!name && OPEN.test(s)) name = s.replace(OPEN, '');
  if (name) { const app = findApp(name, list); return app ? { op: 'open', app } : null; }
  m = /^(?:quit|close)\s+(.+)$/i.exec(s); name = m?.[1];
  if (!name && QUIT.test(s)) name = s.replace(QUIT, '');
  if (name) { const app = findApp(name, list); return !app ? null : PROTECTED.has(app) ? { op: 'refuse', app } : { op: 'quit', app }; }
  return null;
}
// "Wi-Fi অন করো আর brightness ৫০ করো": runs only if every part is understood, so half a request is never guessed.
function parseAll(q, list = apps()) {
  const parts = String(q).normalize('NFC').trim().replace(FILLER, '').split(rx('\\s+(?:এবং|আর|তারপর|তারপরে|and|then|ar)\\s+|\\s*[,।]\\s*')).map(x => x.trim()).filter(Boolean);
  if (!parts.length || parts.length > 5) return null;
  const ops = parts.map(p => parse(p, list));
  return ops.every(Boolean) ? ops : null;
}

const osa = (...a) => run('osascript', a.flatMap(l => ['-e', l]));
const wifiPort = async () => { const m = /Wi-Fi\nDevice: (\S+)/.exec(await run('networksetup', ['-listallhardwareports'])); if (!m) throw new Error('no wifi'); return m[1]; };
const getVol = async () => +(await osa('output volume of (get volume settings)'));
const bright = (...a) => run(path.join(os.homedir(), '.local/bin/sb-brightness'), a.map(String)).then(Number); // built from brightness.swift
const pct = v => Math.min(100, Math.max(0, Math.round(+v)));
async function perform(o) {
  switch (o.op) {
    case 'brightness': await bright(pct(o.value)); return `Brightness ${pct(o.value)}% করে দিলাম।`;
    case 'brightStep': { const v = pct(await bright() + o.by); await bright(v); return `Brightness এখন ${v}%।`; }
    case 'brightStatus': return `Brightness এখন ${await bright()}%।`;
    case 'volume': await osa(`set volume output volume ${pct(o.value)} without output muted`); return `Volume ${pct(o.value)}% করে দিলাম।`;
    case 'step': { const v = pct(await getVol() + o.by); await osa(`set volume output volume ${v} without output muted`); return `Volume এখন ${v}%।`; }
    case 'volumeStatus': { const v = await getVol(), muted = (await osa('output muted of (get volume settings)')) === 'true'; return muted ? `Volume ${v}%, তবে এখন mute করা।` : `Volume এখন ${v}%।`; }
    case 'mute': await osa('set volume with output muted'); return 'Mute করে দিলাম।';
    case 'unmute': await osa('set volume without output muted'); return 'Mute সরিয়ে দিলাম।';
    case 'wifiStatus': return /: On$/.test(await run('networksetup', ['-getairportpower', await wifiPort()])) ? 'Wi-Fi চালু আছে।' : 'Wi-Fi বন্ধ আছে।';
    case 'wifiOn': await run('networksetup', ['-setairportpower', await wifiPort(), 'on']); return 'Wi-Fi চালু করে দিলাম।';
    case 'wifiOff': await run('networksetup', ['-setairportpower', await wifiPort(), 'off']); return 'Wi-Fi বন্ধ করে দিলাম। ইন্টারনেট ছাড়া আমার AI আর ভয়েস চলবে না, চালু করতে লিখে বলো: Wi-Fi চালু করো।';
    case 'open': await run('open', ['-a', o.app]); return `${o.app} খুলে দিলাম।`;
    case 'quit': await run('osascript', ['-e', 'on run {a}\ntell application a to quit\nend run', o.app]); return `${o.app} বন্ধ করে দিলাম। সেভ না করা কাজ থাকলে ${o.app} নিজেই জিজ্ঞেস করবে।`;
    case 'refuse': return `${o.app} বন্ধ করলে আমিই বন্ধ হয়ে যাব, তাই এটা তুমি নিজে করো।`;
    default: throw new Error('unknown');
  }
}
module.exports = { parse, parseAll, perform, apps };
