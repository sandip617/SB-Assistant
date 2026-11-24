// Music on YouTube through the user's Safari: play a search, pause, resume, next. Decided in code, never by the model.
const rx = (s, f = 'i') => new RegExp(s.normalize('NFC'), f);
const clean = q => String(q).normalize('NFC').trim().replace(/[।!?.,\s]+$/, '');
const PLAY = rx('বাজাও|বাজিয়ে দাও|বাজায়ে দাও|বাজা\\b|\\bbajao\\b|\\bplay\\b|চালাও|চালিয়ে দাও|লাগাও|শোনাও|শুনাও');
const MUSIC = rx('গান|\\bgaan\\b|\\bsongs?\\b|\\bmusic\\b|মিউজিক|youtube|ইউটিউব');
const NOT = rx('বুঝিয়ে|বোঝাও|রিভিউ|\\breview\\b|analysis|বিশ্লেষণ|https?://|ভলিউম|volume');
const STOP = rx('(?:গান|\\bsong\\b|\\bmusic\\b|মিউজিক|youtube|ইউটিউব|ভিডিও)\\S*\\s*(?:টা\\s*)?(?:থামাও|থামা|বন্ধ করো|বন্ধ কর|\\bpause\\b|\\bstop\\b)|^(?:pause|stop)(?: music| song)?$');
const RESUME = rx('(?:গান|\\bsong\\b|\\bmusic\\b|youtube|ইউটিউব)\\S*\\s*(?:টা\\s*)?(?:আবার চালাও|আবার চালু করো|\\bresume\\b|চালু করো)|^resume$');
const NEXT = rx('(?:পরের|পরেরটা|\\bnext\\b)\\s*(?:গান|\\bsong\\b|ভিডিও|\\bvideo\\b)|(?:গান|\\bsong\\b)\\s*(?:বদলাও|\\bskip\\b)');
const START = rx('চালু\\s*(?:করো|কর|করে দাও|দাও)|(?:অন|\\bon\\b|play)\\s*(?:করো|কর|করে দাও)');
const AGAIN = rx('আবার|\\bresume\\b');
// Everything that is not the song's name: the command, the place, and spoken fillers.
const FILL = rx('(?:^|\\s)(?:আমার|আমাকে|তুমি|তুই|তার জন্য|এর জন্য|একটা|একটু|তো|প্লিজ|please|মাস্টার|sb|এসবি|safari\\S*|সাফারি\\S*|ইউটিউব\\S*|youtube\\S*|গিয়ে|গিয়া|যাও|খুঁজে|সার্চ করে|search করে|থেকে|এ|-এ|তে|আ-?|উম|গানটা|গানটি|গানগুলো|গান|\\bgaan\\b|\\bsong\\b|\\bmusic\\b|মিউজিক|টা|দাও|দিও|দে|কর|করো|করে|শুনি|on|in|আবার)(?=\\s|$)', 'gi');
const nameOf = s => s.replace(PLAY, ' ').replace(START, ' ').replace(/[,।-]+/g, ' ').replace(FILL, ' ').replace(FILL, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);

function parse(q) {
  const s = clean(q); if (!s || s.length > 160 || NOT.test(s)) return null;
  if (NEXT.test(s)) return { op: 'next' };
  if (STOP.test(s)) return { op: 'pause' };
  const music = MUSIC.test(s), bajao = rx('বাজা|\\bbajao\\b').test(s);
  if (!PLAY.test(s) && !START.test(s) && !RESUME.test(s)) return null;
  if (!music && !bajao) return null; // "চালাও" or "চালু করো" alone could mean an app or the timer
  const query = nameOf(s);
  if (!query) return AGAIN.test(s) || START.test(s) || RESUME.test(s) ? { op: 'resume' } : { op: 'ask' };
  return { op: 'play', query };
}

// Opens the search in Safari, reusing only the tab SB itself opened for music (marked by window.name), never a tab the user is watching, then opens the first normal video.
const PLAY_SCRIPT = `on run {u}
tell application "Safari"
set t to missing value
repeat with w in windows
repeat with x in tabs of w
if (URL of x as text) contains "youtube.com" and (do JavaScript "window.name" in x) is "sb-music" then
set t to x
set URL of t to u
set current tab of w to t
set index of w to 1
exit repeat
end if
end repeat
if t is not missing value then exit repeat
end repeat
if t is missing value then
make new document with properties {URL:u}
set t to current tab of front window
end if
set title to ""
set tries to 0
repeat 90 times
set tries to tries + 1
delay 0.4
if tries is 45 then set URL of t to u -- results sometimes never render: load the search once more
try
set title to do JavaScript "(()=>{const a=[...document.querySelectorAll('ytd-video-renderer a#video-title')].find(x=>/\\\\/watch\\\\?v=/.test(x.href||''));if(!a)return '';const n=(a.title||a.textContent||'').trim();window.name='sb-music';location.href=a.href;return n||'video'})()" in t
end try
if title is not "" then exit repeat
end repeat
if title is "" then return "NOTFOUND"
set state to "paused"
repeat 20 times
delay 0.6
try
set state to do JavaScript "(()=>{const v=document.querySelector('video');if(!v||!/\\\\/watch/.test(location.pathname))return 'loading';if(v.paused)v.play().catch(()=>{});return v.paused?'paused':'playing'})()" in t
end try
if state is "playing" then exit repeat
end repeat
return state & linefeed & title
end tell
end run`;
const CONTROL_SCRIPT = `on run {js}
tell application "Safari"
repeat with w in windows
repeat with x in tabs of w
if (URL of x as text) contains "youtube.com/watch" then return do JavaScript js in x
end repeat
end repeat
end tell
return "NONE"
end run`;
const CONTROL_JS = {
  pause: `(()=>{const v=document.querySelector('video');if(!v)return 'NONE';v.pause();return 'ok'})()`,
  resume: `(()=>{const v=document.querySelector('video');if(!v)return 'NONE';v.play();return v.paused?'blocked':'ok'})()`,
  next: `(()=>{const b=document.querySelector('.ytp-next-button');if(!b)return 'NONE';b.click();return 'ok'})()`,
};
const searchUrl = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
function playResult(out) {
  const [state, ...rest] = String(out).trim().split('\n'), title = rest.join(' ').trim().slice(0, 90);
  if (state === 'NOTFOUND') return 'YouTube-এ গানটা খুঁজে পেলাম না। Safari-তে YouTube খুলছে কিনা দেখো।';
  if (state === 'playing') return `চালিয়ে দিলাম: ${title}`;
  return `${title ? `"${title}" খুলেছি, ` : ''}কিন্তু Safari নিজে থেকে বাজাতে দিচ্ছে না। একবার Safari-র ভিডিওতে চাপ দাও। প্রতিবার চাইলে Safari → Settings → Websites → Auto-Play-এ youtube.com-কে "Allow All Auto-Play" করে দাও।`;
}
const controlResult = (op, out) => out === 'NONE' ? 'Safari-তে কোনো YouTube গান চলছে না।' : out === 'blocked' ? 'Safari বাজাতে দিচ্ছে না, ভিডিওতে একবার চাপ দাও।' : { pause: 'গান থামালাম।', resume: 'আবার চালালাম।', next: 'পরের গান চালাচ্ছি।' }[op];
module.exports = { parse, PLAY_SCRIPT, CONTROL_SCRIPT, CONTROL_JS, searchUrl, playResult, controlResult };
