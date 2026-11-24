// Google Docs, Sheets and Drive through the university login already in Safari; no key needed.
// It only creates new files and searches. It never edits, moves, shares or deletes an existing file.
const rx = (s, f = 'i') => new RegExp(s.normalize('NFC'), f);
const clean = q => String(q).normalize('NFC').trim().replace(/[।!?\s]+$/, '');
const DOC = rx('google\\s*docs?|গুগল\\s*ডক|\\bdocs?\\b|ডক\\s*ফাইল|ডকুমেন্ট|ওয়ার্ড\\s*ফাইল'), SHEET = rx('google\\s*sheets?|গুগল\\s*শি[টট]|\\bsheets?\\b|শিট|স্প্রেডশিট'), DRIVE = rx('google\\s*drive|গুগল\\s*ড্রাইভ|\\bdrive\\b|ড্রাইভ');
const MAKE = rx('বানাও|বানিয়ে|তৈরি কর|\\bcreate\\b|\\bmake\\b|লিখে রাখো'), FIND = rx('খোঁজো|খুঁজে|খুঁজো|\\bsearch\\b|\\bfind\\b');
const THIS = rx('(?:^|\\s)(?:এটা|এইটা|এটাকে|এইটাকে|এটি|উপরের(?:টা)?|এই লেখা(?:টা)?)(?:\\s|$)');
const MAX = 20_000;

function parts(s, last) {
  const cut = rx('\\s*:\\s*|\\s+যে\\s+').exec(s), body = cut ? s.slice(cut.index + cut[0].length).trim() : '', head = cut ? s.slice(0, cut.index) : s;
  const title = (rx('["“]([^"”]{1,80})["”]\\s*নামে').exec(head) || rx('(\\S+(?:\\s+\\S+){0,3}?)\\s+নামে').exec(head))?.[1]?.replace(rx('^(?:একটা|একটি|একটা নতুন|নতুন)\\s+'), '').trim();
  return { title, text: body || (THIS.test(head) ? String(last || '').trim() : '') };
}
const stamp = (w, now) => `SB ${w} ${now.toLocaleDateString('en-GB')}`;

function parse(q, last, now = new Date()) {
  const s = clean(q); if (!s || s.length > MAX) return null;
  const isDoc = DOC.test(s), isSheet = SHEET.test(s), isDrive = DRIVE.test(s);
  if (!isDoc && !isSheet && !isDrive) return null;
  if (FIND.test(s)) {
    const query = s.replace(rx('(?:google\\s*)?drive|(?:গুগল\\s*)?ড্রাইভ'), ' ').replace(rx('(?:-?এ|-?তে)(?=\\s)'), ' ').replace(FIND, ' ').replace(rx('(?:^|\\s)(?:আমার|ফাইল(?:টা)?|file|করো|দাও|টা|নামে|নামের|একটু)(?=\\s|$)', 'gi'), ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return query.length >= 2 ? { type: 'search', query } : { ask: 'Drive-এ কী খুঁজব? যেমন বলো: Drive-এ assignment খোঁজো।' };
  }
  if (!MAKE.test(s) || (!isDoc && !isSheet)) return null;
  const { title, text } = parts(s, last);
  if (isSheet && !isDoc) { const rows = text.split('\n').map(l => l.split(/\t|,/).map(c => c.trim())).filter(r => r.some(Boolean)).slice(0, 500); return { type: 'sheet', title: (title || stamp('Sheet', now)).slice(0, 80), rows }; }
  return { type: 'doc', title: (title || stamp('Doc', now)).slice(0, 80), text: text.slice(0, MAX) };
}

const createUrl = (o, email) => `https://docs.google.com/${o.type === 'sheet' ? 'spreadsheets' : 'document'}/create?authuser=${encodeURIComponent(email)}&title=${encodeURIComponent(o.title)}`;
const searchUrl = (query, email) => `https://drive.google.com/drive/search?q=${encodeURIComponent(query)}&authuser=${encodeURIComponent(email)}`;
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const tableHtml = rows => '<table>' + rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</table>';
const wrap = body => `window.__sbR='PENDING';(async()=>{const wait=m=>new Promise(r=>setTimeout(r,m));${body}})().then(v=>{window.__sbR=JSON.stringify(v)}).catch(()=>{window.__sbR='{"err":"page"}'});'x'`;
const ACCOUNT = email => `for(let i=0;i<40&&!/\\/d\\//.test(location.pathname);i++)await wait(250);const id=(/\\/d\\/([^/]+)/.exec(location.pathname)||[])[1];if(/accounts\\.google/.test(location.hostname)||!id)return{err:'login'};if(!document.documentElement.innerHTML.toLowerCase().includes(${JSON.stringify(email.toLowerCase())}))return{err:'account',id};`;
const PASTE = (plain, html) => `e.focus();const dt=new DataTransfer();dt.setData('text/plain',${JSON.stringify(plain)});${html ? `dt.setData('text/html',${JSON.stringify(html)});` : ''}e.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));`;
const squash = `const sq=s=>String(s).normalize('NFC').replace(/[^\\p{L}\\p{M}\\p{N}]+/gu,'');`;

// A file counts as written only after its text is read back from Google.
function docScript(text, email) {
  const probe = text.slice(0, 40);
  return wrap(`${ACCOUNT(email)}${text ? `let f;for(let i=0;i<40&&!f;i++){f=document.querySelector('.docs-texteventtarget-iframe');if(!f)await wait(250)}if(!f)return{err:'editor',id};const d=f.contentDocument,e=d.querySelector('[contenteditable=true]')||d.body;${PASTE(text)}${squash}let ok=false;for(let i=0;i<6&&!ok;i++){await wait(1800);try{const x=await fetch('/document/d/'+id+'/mobilebasic',{credentials:'include'});ok=sq(await x.text()).includes(sq(${JSON.stringify(probe)}))}catch{}}return{id,ok};` : 'await wait(1500);return{id,ok:true};'}`);
}
function sheetScript(rows, email) {
  const plain = rows.map(r => r.join('\t')).join('\n'), probe = rows.flat().find(Boolean) || '';
  return wrap(`${ACCOUNT(email)}${rows.length ? `let e;for(let i=0;i<48&&!e;i++){e=document.querySelector('#waffle-rich-text-editor');if(!e)await wait(250)}if(!e)return{err:'editor',id};await wait(1500);${PASTE(plain, tableHtml(rows))}${squash}let ok=false;for(let i=0;i<6&&!ok;i++){await wait(1800);try{const c=new AbortController();setTimeout(()=>c.abort(),5000);const x=await fetch('/spreadsheets/d/'+id+'/gviz/tq?tqx=out:csv&headers=0',{credentials:'include',signal:c.signal});ok=sq(await x.text()).includes(sq(${JSON.stringify(probe)}))}catch{}}return{id,ok};` : 'await wait(2500);return{id,ok:true};'}`);
}
const SEARCH_JS = wrap(`if(/accounts\\.google/.test(location.hostname))return{err:'login'};const named=()=>[...document.querySelectorAll('tr[data-id]')].some(e=>(e.innerText||'').trim());for(let i=0;i<48&&!named();i++)await wait(250);await wait(1000);const o=[];for(const e of document.querySelectorAll('tr[data-id]')){const n=(e.innerText||'').replace(/\\s+/g,' ').split(' More actions')[0].trim(),id=e.getAttribute('data-id');if(n&&id&&!o.some(x=>x.id===id))o.push({id,n:n.slice(0,80)})}return{files:o.slice(0,8)}`);

const link = (type, id) => type === 'sheet' ? `https://docs.google.com/spreadsheets/d/${id}/edit` : `https://docs.google.com/document/d/${id}/edit`;
function result(o, r) {
  if (r.err === 'login') return 'Safari-তে university Google account লগইন করা নেই। লগইন করে আবার বলো।';
  if (r.err === 'account') return 'Safari অন্য Google account-এ খুলেছে, তাই লিখিনি। University account-এ লগইন আছে কিনা দেখো।';
  const name = o.type === 'sheet' ? 'Sheet' : 'Doc';
  if (!r.id) return `${name} বানাতে পারিনি।`;
  return r.ok ? `"${o.title}" ${name} বানিয়ে দিয়েছি: ${link(o.type, r.id)}` : `"${o.title}" ${name} খুলেছে, কিন্তু লেখাটা বসেছে কিনা নিশ্চিত হতে পারিনি। একবার দেখে নাও: ${link(o.type, r.id)}`;
}
const searchResult = (query, r) => r.err === 'login' ? 'Safari-তে university Google account লগইন করা নেই।' : r.files?.length ? `Drive-এ "${query}" দিয়ে পেলাম:\n` + r.files.map((f, i) => `${i + 1}. ${f.n}\nhttps://drive.google.com/open?id=${f.id}`).join('\n') : `Drive-এ "${query}" দিয়ে কিছু পাইনি।`;
module.exports = { parse, createUrl, searchUrl, docScript, sheetScript, SEARCH_JS, result, searchResult, tableHtml };
