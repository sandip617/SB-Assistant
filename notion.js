// Saves the owner's notes to Notion and finds them again. It only adds new pages under the one page the owner shared; it never edits or deletes.
const API = 'https://api.notion.com/v1', VERSION = '2022-06-28';
const rx = (s, f = 'i') => new RegExp(s.normalize('NFC'), f);
const clean = q => String(q).normalize('NFC').trim().replace(/[।!?\s]+$/, '');
const NOTION = rx('notion|নোশন|নোটিয়ন'), AS_NOTE = rx('নোট হিসেবে|নোট হিসাবে|নোট আকারে');
const SAVE = rx('রাখো|রেখে|সেভ|\\bsave\\b|লিখে|বানাও|\\badd\\b|যোগ'), FIND = rx('খোঁজো|খুঁজে|খুঁজো|\\bsearch\\b|\\bfind\\b|দেখাও');
const THIS = rx('(?:^|\\s)(?:এটা|এইটা|এটাকে|এইটাকে|এটি|উপরের(?:টা)?|এই লেখা(?:টা)?)(?:\\s|$)');
const MAX = 20_000;

function parse(q, last) {
  const s = clean(q); if (!s || s.length > MAX || !(NOTION.test(s) || AS_NOTE.test(s))) return null;
  if (FIND.test(s) && NOTION.test(s)) {
    const query = s.replace(NOTION, ' ').replace(rx('^[\\s-]*(?:এ|তে)(?=\\s)'), ' ').replace(FIND, ' ').replace(rx('(?:^|\\s)(?:আমার|নোট(?:টা|গুলো)?|note|notes|করো|দাও|-?এ|একটু|সব)(?=\\s|$)', 'gi'), ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return { type: 'search', query };
  }
  if (!SAVE.test(s)) return null;
  const cut = rx('\\s*:\\s*|\\s+যে\\s+').exec(s), head = cut ? s.slice(0, cut.index) : s, body = cut ? s.slice(cut.index + cut[0].length).trim() : '';
  const text = (body || (THIS.test(head) ? String(last || '').trim() : '')).slice(0, MAX);
  if (!text) return { ask: 'কী নোট রাখব? যেমন বলো: Notion-এ রাখো যে কাল পরীক্ষার ফি দিতে হবে।' };
  const named = (rx('["“]([^"”]{1,80})["”]\\s*নামে').exec(head) || rx('(\\S+(?:\\s+\\S+){0,3}?)\\s+নামে').exec(head))?.[1]?.replace(rx('^(?:একটা|একটি|নতুন)\\s+'), '').trim();
  return { type: 'save', title: (named || text.split('\n')[0]).slice(0, 80), text };
}
const pageId = s => { const m = String(s).replace(/-/g, '').match(/[0-9a-f]{32}(?=$|[?#/])/i); return m ? m[0].toLowerCase() : null; };
const validKey = k => /^(?:ntn_|secret_)\w{20,200}$/.test(String(k));
// Notion allows 2000 characters per block and 100 blocks per request.
function blocks(text) {
  const out = [];
  for (const line of text.split('\n')) { if (!line.trim()) continue; for (let i = 0; i < line.length; i += 1900) out.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line.slice(i, i + 1900) } }] } }); }
  return out.slice(0, 100);
}
const call = async (net, p, method, body, key = process.env.NOTION_TOKEN) => {
  const r = await net(API + p, { method, headers: { authorization: 'Bearer ' + key, 'notion-version': VERSION, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!r.ok) throw new Error('notion ' + r.status); return r.json();
};
const ready = () => !!process.env.NOTION_TOKEN && !!process.env.NOTION_PAGE_ID;
const check = (key, id, net = fetch) => call(net, '/pages/' + id, 'GET', null, key);
const save = async (o, net = fetch) => (await call(net, '/pages', 'POST', { parent: { page_id: process.env.NOTION_PAGE_ID }, properties: { title: { title: [{ type: 'text', text: { content: o.title } }] } }, children: blocks(o.text) })).url;
const titleOf = p => Object.values(p.properties || {}).find(x => x.type === 'title')?.title?.map(t => t.plain_text).join('') || '(নাম নেই)';
// Notion's search takes a while to index a new page, so the notes under SB Notes are read directly first.
// shortcut: reads the first 100 notes directly, older-first; add paging if the list grows past that.
async function search(query, net = fetch) {
  const q = String(query).normalize('NFC').toLowerCase(), home = String(process.env.NOTION_PAGE_ID).replace(/-/g, '');
  const kids = (await call(net, `/blocks/${process.env.NOTION_PAGE_ID}/children?page_size=100`, 'GET')).results.filter(b => b.type === 'child_page' && b.child_page.title.normalize('NFC').toLowerCase().includes(q)).reverse().map(b => ({ title: b.child_page.title.slice(0, 80), url: 'https://www.notion.so/' + b.id.replace(/-/g, '') }));
  const found = (await call(net, '/search', 'POST', { query, page_size: 8, filter: { property: 'object', value: 'page' }, sort: { direction: 'descending', timestamp: 'last_edited_time' } })).results.filter(p => String(p.id).replace(/-/g, '') !== home).map(p => ({ title: titleOf(p).slice(0, 80), url: p.url }));
  const id = u => (/[0-9a-f]{32}/.exec(String(u).replace(/-/g, '')) || [u])[0], seen = new Set();
  return [...kids, ...found].filter(x => !seen.has(id(x.url)) && seen.add(id(x.url))).slice(0, 8);
}
module.exports = { parse, pageId, validKey, blocks, ready, check, save, search };
