// News and web answers: decides when to go online, and keeps only source links SB really opened.
const GREETING = /^(?:(?:তোমার|তোর|আপনার|ভাই|হাই|hi|hello)[\s,]+)?(?:কী|কি|ki)\s*(?:খবর|khobor)/i;
const PERSONAL = /মেইল|\bmail\b|ইমেইল|\bemail\b|ফাইল|\bfile|ফোল্ডার|\bfolder|classroom|ক্লাসরুম|assignment|অ্যাসাইনমেন্ট|ক্যালেন্ডার|calendar|youtube|ইউটিউব|github|গিটহাব|ফর্ম|\bform\b/i;
const ONLINE = /খবর|সংবাদ|পত্রিকা|নিউজ|\bnews\b|khobor|ইন্টারনেট|internet|অনলাইনে|ওয়েবে|\bweb\b|গুগল কর|google kor|সার্চ|\bsearch\b/i;
const wantsWeb = t => !GREETING.test(t.trim()) && !PERSONAL.test(t) && ONLINE.test(t);

const urlKey = u => { const x = new URL(u); return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, ''); };

// The model must not be able to cite a page it never fetched.
function parseAnswer(raw, fetched) {
  const opened = new Set(); for (const u of fetched) { try { opened.add(urlKey(u)); } catch {} }
  const spoken = (/<spoken>([\s\S]*?)<\/spoken>/.exec(raw) || [])[1]?.trim() || '';
  const lines = ((/<sources>([\s\S]*?)<\/sources>/.exec(raw) || [])[1] || '').split('\n'), seen = new Set(), sources = [];
  for (const l of lines) {
    const i = l.lastIndexOf('|'); if (i < 0) continue;
    const title = l.slice(0, i).replace(/^[\s\-*\d.]+/, '').trim(), url = l.slice(i + 1).trim();
    try { const u = new URL(url), k = urlKey(url); if (/^https?:$/.test(u.protocol) && opened.has(k) && !seen.has(k)) { seen.add(k); sources.push({ title: title.slice(0, 120) || u.hostname, url }); } } catch {}
  }
  const text = raw.replace(/<spoken>[\s\S]*?<\/spoken>/, '').replace(/<sources>[\s\S]*?<\/sources>/, '').trim();
  if (!sources.length || !text) { const no = 'মূল লেখাগুলো ঠিকমতো পড়তে পারিনি, তাই বানিয়ে কিছু বলছি না। একটু অন্যভাবে জিজ্ঞেস করো।'; return { text: no, spoken: no, sources: [] }; }
  return { text, spoken: spoken || text.split(/(?<=[।!?])/)[0].trim(), sources: sources.slice(0, 6) };
}
// ---- Website status: read-only GET requests to public addresses; never logs in or changes anything ----
const dns = require('dns').promises, net = require('net');
const SITE = /website|ওয়েবসাইট|সাইট|\bsite\b/i, STATUS = /live|লাইভ|active|অ্যাক্টিভ|অ্যাকটিভ|চালু|বন্ধ|\bdown\b|ডাউন|check|চেক|কাজ করছে/i;
const DOMAIN = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s।,]*)?/i;
const siteUrl = t => { const m = DOMAIN.exec(t); return m ? (/^https?:/i.test(m[0]) ? m[0] : 'https://' + m[0]) : null; };
const wantsSite = t => STATUS.test(t) && (SITE.test(t) || !!siteUrl(t)) && !/@/.test(t);

function isPrivate(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168); }
  const v = ip.toLowerCase(); return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || (v.startsWith('::ffff:') ? isPrivate(v.slice(7)) : false);
}
// shortcut: DNS is checked just before the request, not pinned to it; fine for a local single-user assistant.
async function safeGet(start) {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    try {
      const u = new URL(url); if (!/^https?:$/.test(u.protocol)) return { url, status: 0 };
      const ips = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
      if (ips.some(i => isPrivate(i.address))) return { url, status: 0, blocked: true };
      const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'SB-site-check' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), u).href; continue; }
      const html = /html/i.test(r.headers.get('content-type') || '') ? (await r.text()).slice(0, 500_000) : '';
      return { url, status: r.status, html };
    } catch { return { url, status: 0 }; }
  }
  return { url, status: 0 };
}
function pageLinks(html, base) {
  const b = new URL(base), out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)/gi)) {
    try { const u = new URL(m[1], b); u.search = ''; if (u.origin === b.origin && !/\.(?:png|jpe?g|gif|svg|webp|pdf|zip|css|js|mp4)$/i.test(u.pathname) && u.href !== b.href) out.add(u.href); } catch {}
  }
  return [...out].slice(0, 12);
}
async function checkSite(start) {
  const home = await safeGet(start);
  if (home.blocked) return { text: 'এই ঠিকানাটা ব্যক্তিগত নেটওয়ার্কের, তাই চেক করছি না।', spoken: 'এই ঠিকানাটা চেক করছি না।', sources: [] };
  const host = (() => { try { return new URL(home.url).hostname; } catch { return start; } })();
  if (!home.status) return { text: `${host} এখন খুলছে না। সাইটটা বন্ধ, ঠিকানা ভুল, অথবা নেটওয়ার্কের সমস্যা হতে পারে।`, spoken: `${host} এখন খুলছে না।`, sources: [] };
  const pages = await Promise.all(pageLinks(home.html || '', home.url).map(safeGet)), all = [home, ...pages], path = p => { try { return new URL(p.url).pathname; } catch { return p.url; } };
  const live = all.filter(p => p.status >= 200 && p.status < 400), guarded = all.filter(p => [401, 403, 429].includes(p.status)), dead = all.filter(p => !live.includes(p) && !guarded.includes(p));
  const row = (name, a) => a.length ? `\n${name} (${a.length}টা): ${a.map(p => path(p) + (p.status >= 400 ? ` [${p.status || 'খুলছে না'}]` : '')).join(', ')}` : '';
  const state = live.includes(home) ? 'live আছে' : guarded.includes(home) ? 'চালু, কিন্তু এই চেক আটকে দিয়েছে' : 'ঠিকমতো খুলছে না';
  return { text: `${host} ${state}। হোমপেজ থেকে পাওয়া ${all.length}টা পাতা দেখলাম।${row('Live', live)}${row('আটকানো, তাই বলা যাচ্ছে না', guarded)}${row('কাজ করছে না', dead)}`,
    spoken: `${host} ${state}। ${live.length}টা পাতা live, ${dead.length}টা কাজ করছে না।`, sources: [{ title: host, url: home.url }] };
}
module.exports = { wantsWeb, parseAnswer, wantsSite, siteUrl, checkSite, isPrivate, pageLinks };
