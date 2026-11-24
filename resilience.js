// Daily backup of memory and chats, and an honest "offline" state when the internet or the AI is not working.
const fs = require('fs'), path = require('path');
const KEEP = 7, DATED = /^\d{4}-\d{2}-\d{2}$/, ITEMS = ['memory.json', 'data.json', 'conversations']; // keys in .env are deliberately not copied
const dayKey = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const copies = dir => { try { return fs.readdirSync(dir).filter(n => DATED.test(n)).sort(); } catch { return []; } };

// One copy a day. It is written to a temp folder first, so a crash can never leave a half backup that looks complete.
async function runBackup(root, now = Date.now()) {
  const dir = path.join(root, 'backups'), day = dayKey(now), dest = path.join(dir, day), tmp = path.join(dir, '.tmp-' + day);
  if (fs.existsSync(dest)) return { day, made: false };
  const found = ITEMS.filter(n => fs.existsSync(path.join(root, n))); if (!found.length) return { day: null, made: false };
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 }); await fs.promises.rm(tmp, { recursive: true, force: true });
  try {
    await fs.promises.mkdir(tmp, { mode: 0o700 });
    for (const n of found) await fs.promises.cp(path.join(root, n), path.join(tmp, n), { recursive: true });
    await fs.promises.rename(tmp, dest);
  } catch (e) { await fs.promises.rm(tmp, { recursive: true, force: true }); throw e; }
  for (const old of copies(dir).slice(0, -KEEP)) await fs.promises.rm(path.join(dir, old), { recursive: true, force: true });
  return { day, made: true };
}
const lastBackup = root => copies(path.join(root, 'backups')).at(-1) || null;

const BRAIN_HOLD = 3 * 60_000;
// Any HTTP answer means the internet works. Nothing about the user is sent.
function makeHealth(url = 'https://api.anthropic.com/', net = fetch, clock = Date.now) {
  let online = true, failedAt = 0;
  const check = async () => { try { await net(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) }); online = true; } catch { online = false; } return online; };
  return { check, netUp: () => online, brainFailed: () => { failedAt = clock(); }, brainOk: () => { failedAt = 0; }, offline: () => !online || (!!failedAt && clock() - failedAt < BRAIN_HOLD) };
}
const OFFLINE = 'এখন offline, ইন্টারনেট বা AI পাচ্ছি না। তাই উত্তর বানিয়ে বলব না। Volume, brightness, টাইমার, পড়ার প্ল্যান আর আজকের তিনটা কাজ এখনো চলবে।';
module.exports = { runBackup, lastBackup, makeHealth, OFFLINE, KEEP };
