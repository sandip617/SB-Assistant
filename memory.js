// Long-term memory (memory.json) and every conversation (conversations/YYYY-MM-DD.jsonl). Both stay on this Mac.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CHAT_ID = /^(?:\d{4}-\d{2}-\d{2}|c\d{13}[a-z0-9]{6})$/;
const SECRET = /পাসওয়ার্ড|\bpassword\b|\bpasscode\b|\botp\b|ওটিপি|\bcvv\b|\bpin\b|পিন কোড|api key|এপিআই কি|\b(?:sk|ghp|github_pat)_\w{10,}/i;
const REMEMBER = /(?:এটা|এইটা|এটি)?\s*(?:মনে রাখ(?:ো|বে|বা|িও|বি)|mone rakh(?:o|ba|bi|io)|\bremember\b(?:\s+that)?)/i;
const FORGET = /(?:এটা|এইটা|এটি)?\s*(?:ভুলে যাও|ভুলে যা\b|ভুলে যাবা|bhule jao|\bforget\b(?:\s+that)?)/i;
const NOT_COMMAND = /[?？]\s*$|মনে রাখ\S*\s+(?:না|লাগবে না)|ভুলে যাও\s+না|\b(?:do|did) you remember\b|\b(?:don'?t|never) forget\b/i;
const STOP = new Set(['আমার', 'যে', 'টা', 'কথা', 'কথাটা', 'এটা', 'ওটা', 'এই', 'ওই', 'সেই', 'নিয়ে', 'তথ্য', 'the', 'my', 'about', 'that', 'this', 'amar']);
const norm = s => s.normalize('NFC').toLowerCase();
const words = s => norm(s).split(/[^\p{L}\p{M}\p{N}]+/u).filter(w => w.length > 1 && !STOP.has(w));
const tidy = s => s.replace(/^[\s,:;।-]+|[\s,:;।.!-]+$/g, '').replace(/^(?:যে|that)\s+/i, '').replace(/\s+(?:যে|কথাটা|কথা)$/, '').trim();
// Chat logs must never keep a pasted key or card number.
const redact = t => String(t).replace(/\b(?:sk|ghp|github_pat)_[A-Za-z0-9_]{10,}\b/g, '[hidden]').replace(/\b[a-f0-9]{32,}\b/gi, '[hidden]').replace(/\b(?:\d[ -]?){13,19}\b/g, '[hidden]');

function command(q) {
  if (NOT_COMMAND.test(q)) return null;
  if (FORGET.test(q)) return { type: 'forget', text: tidy(q.replace(FORGET, ' ')) };
  if (REMEMBER.test(q)) return { type: 'remember', text: tidy(q.replace(REMEMBER, ' ')) };
  return null;
}

// Automatic memory: only the user's own short first-person lines are considered, so pasted pages or mails can't plant a memory.
const FIRST_PERSON = /আমি|আমার|আমাকে|আমায়|\bami\b|\bamar\b|\bamake\b|\bI\b|\bI'm\b|\bmy\b/i;
const worthLearning = q => q.length >= 8 && q.length <= 500 && FIRST_PERSON.test(q) && !SECRET.test(q) && !command(q) && !/https?:\/\//i.test(q);
function parseLearned(raw) {
  try {
    const j = JSON.parse(/\{[\s\S]*\}/.exec(raw)[0]), ok = t => typeof t === 'string' && t.trim().length > 3 && t.length <= 200;
    return { add: (Array.isArray(j.add) ? j.add : []).filter(ok).slice(0, 3).map(t => t.trim()),
      update: (Array.isArray(j.update) ? j.update : []).filter(u => u && Number.isInteger(u.id) && ok(u.text)).slice(0, 3).map(u => ({ id: u.id, text: u.text.trim() })) };
  } catch { return { add: [], update: [] }; }
}

function makeMemory(dir, legacy = []) {
  const file = path.join(dir, 'memory.json'), logs = path.join(dir, 'conversations');
  let items = [];
  try { items = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') { fs.copyFileSync(file, file + '.bad'); console.error('memory.json unreadable, copied to memory.json.bad'); } }
  const write = () => { fs.writeFileSync(file + '.tmp', JSON.stringify(items, null, 1), { mode: 0o600 }); fs.renameSync(file + '.tmp', file); };
  const nextId = () => items.reduce((a, i) => Math.max(a, i.id), 0) + 1;
  const insert = text => { const it = { id: nextId(), text: text.slice(0, 300), at: new Date().toISOString() }; items.push(it); return it; };
  if (legacy.length) { for (const t of legacy) if (!items.some(i => norm(i.text) === norm(String(t)))) insert(String(t)); write(); }

  function remember(text) {
    if (!text) return { status: 'empty' };
    if (SECRET.test(text)) return { status: 'secret' };
    if (items.some(i => norm(i.text) === norm(text))) return { status: 'known' };
    if (items.length >= 200) return { status: 'full' };
    const item = insert(text); write(); return { status: 'saved', item };
  }
  function learn({ add, update }) {
    const changed = [];
    for (const u of update) { const it = items.find(i => i.id === u.id); if (it && !SECRET.test(u.text) && norm(it.text) !== norm(u.text) && !items.some(i => norm(i.text) === norm(u.text))) { it.text = u.text.slice(0, 300); it.at = new Date().toISOString(); changed.push(it.text); } }
    if (changed.length) write();
    for (const t of add) if (remember(t).status === 'saved') changed.push(t);
    return changed;
  }
  const remove = id => { const n = items.length; items = items.filter(i => i.id !== +id); if (items.length === n) return false; write(); return true; };
  function forget(text) {
    if (!text) return { status: 'empty' };
    if (/^(?:সব|সবকিছু|সবই|all|everything)$/i.test(text.trim())) return { status: 'all' }; // wiping everything stays a deliberate click in the panel
    const want = words(text); if (!want.length) return { status: 'none' };
    const scored = items.map(i => { const have = words(i.text); return { i, n: want.filter(w => have.some(h => h === w || (w.length > 2 && h.length > 2 && (h.startsWith(w) || w.startsWith(h))))).length }; });
    const best = Math.max(0, ...scored.map(s => s.n)); if (best < Math.ceil(want.length / 2) || !best) return { status: 'none' };
    const top = scored.filter(s => s.n === best).map(s => s.i);
    if (top.length > 1) return { status: 'many', items: top };
    remove(top[0].id); return { status: 'removed', item: top[0] };
  }
  // One file per chat. The id is checked before it touches a path. Older day-named logs simply appear as chats.
  const chatFile = id => path.join(logs, id + '.jsonl');
  const validChat = id => typeof id === 'string' && CHAT_ID.test(id);
  const newChat = () => 'c' + Date.now() + crypto.randomBytes(3).toString('hex');
  function log(id, role, content, extra = {}) { // a logging failure must never break the chat
    if (!validChat(id)) return;
    try {
      fs.mkdirSync(logs, { recursive: true, mode: 0o700 });
      fs.appendFileSync(chatFile(id), JSON.stringify({ at: new Date().toISOString(), role, content: redact(content).slice(0, 20_000), ...extra }) + '\n', { mode: 0o600 });
    } catch (e) { console.error('conversation log:', e.message); }
  }
  function chat(id) {
    if (!validChat(id)) return [];
    try { return fs.readFileSync(chatFile(id), 'utf8').trim().split('\n').flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } }); } catch { return []; }
  }
  function chats() {
    let names = []; try { names = fs.readdirSync(logs); } catch { return []; }
    return names.filter(f => f.endsWith('.jsonl') && validChat(f.slice(0, -6))).map(f => {
      const id = f.slice(0, -6), rows = chat(id), first = rows.find(r => r.role === 'user');
      return { id, title: (first?.content || 'Chat').replace(/\s+/g, ' ').slice(0, 60), updated: rows.at(-1)?.at || '', count: rows.length };
    }).filter(c => c.count).sort((a, b) => b.updated.localeCompare(a.updated));
  }
  function deleteChats(ids) {
    let n = 0;
    for (const id of Array.isArray(ids) ? ids.slice(0, 500) : []) if (validChat(id)) { try { fs.unlinkSync(chatFile(id)); n++; } catch {} }
    return n;
  }
  return { facts: () => items, remember, learn, remove, forget, log, chat, chats, deleteChats, validChat, newChat };
}
module.exports = { makeMemory, command, redact, worthLearning, parseLearned };
