// Post performance from the Business Suite Insights table, read in a background Safari tab. Numbers and levels are computed here, never by the model.
const URL_INSIGHTS = 'https://business.facebook.com/latest/insights/content', PAGE = 'Sandip Builds with AI';
const TOPIC = /পোস্ট|\bposts?\b|পেজ|\bpage\b/i, ASK = /কেমন যাচ্ছে|কেমন চলছে|কেমন গেছে|কেমন করছে|performance|পারফরম্যান্স|insights?|ইনসাইট|\bviews?\b|ভিউ|রিচ|\breach\b|লেভেল|কোনটা ভালো|কোন পোস্ট|সেরা পোস্ট/i, MAKE = /আপলোড|\bupload\b|শিডিউল|\bschedule\b|পোস্ট কর|টায়/i;
const wantsPerf = q => TOPIC.test(q) && ASK.test(q) && !MAKE.test(q);
// "Where am I going wrong?" needs an answer from the numbers, not just the list.
const PAGE_TOPIC = /পেজ|\bpage\b|facebook|ফেসবুক|\bfb\b|পোস্ট|\bposts?\b|রিচ|\breach\b|insights?|ইনসাইট/i, ADVICE = /ভুল|সমস্যা|কেন|কী করলে|কি করলে|কীভাবে বাড়|কিভাবে বাড়|বাড়াব|improve|\bgrow\b|কম হচ্ছে|কমে যাচ্ছে|ভালো করতে|পরামর্শ|\bwhy\b/i;
const wantsAdvice = q => PAGE_TOPIC.test(q) && ADVICE.test(q) && !MAKE.test(q) && !/\bmail\b|মেইল|github|গিটহাব/i.test(q);

const readScript = `window.__sbI='PENDING';(async()=>{const wait=m=>new Promise(r=>setTimeout(r,m)),txt=e=>(e.innerText||'').replace(/[\\u200b\\s]+/g,' ').trim(),H=()=>[...document.querySelectorAll('[role=columnheader]')].map(txt);
for(let i=0;i<48&&!H().some(x=>x==='Views');i++){if(/login/.test(location.href))return{error:'login'};await wait(250)}
if(/login/.test(location.href))return{error:'login'};if(!H().some(x=>x==='Views'))return{error:'table'};if(!document.body.innerText.includes(${JSON.stringify(PAGE)}))return{error:'page'};
const heads=H(),vi=heads.indexOf('Viewers'),cells=r=>[...r.querySelectorAll('[role=gridcell],[role=cell]')].map(txt);
for(let i=0;i<32&&![...document.querySelectorAll('[role=row]')].some(r=>cells(r)[vi]);i++)await wait(250); // numbers arrive after the titles
await wait(500);const filled=c=>c.filter(Boolean).length,seen=new Map(),grab=()=>{let n=0;for(const r of document.querySelectorAll('[role=row]')){const c=cells(r);if(c.length<heads.length-1||!c[0])continue;const k=c[0].slice(0,40)+'|'+c[1],o=seen.get(k);if(!o)n++;if(!o||filled(c)>=filled(o))seen.set(k,c)}return n};
grab();const first=document.querySelector('[role=row]');let box=first;while(box&&!(box.scrollHeight>box.clientHeight+20&&/auto|scroll/.test(getComputedStyle(box).overflowY)))box=box.parentElement;
if(box){let idle=0;for(let i=0;i<14&&idle<2&&seen.size<60;i++){box.scrollTop+=Math.max(200,box.clientHeight*.8);await wait(450);idle=grab()?0:idle+1}}
return{heads,rows:[...seen.values()].slice(0,60)}})().then(v=>{window.__sbI=JSON.stringify(v)}).catch(()=>{window.__sbI=JSON.stringify({error:'table'})});'started'`;

const num = v => { const m = /^(-?[\d,.]+)\s*([KkMm]?)$/.exec(String(v ?? '').trim()); if (!m) return null; const n = parseFloat(m[1].replace(/,/g, '')); return isNaN(n) ? null : Math.round(n * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] || 1)); };
const COLS = { views: 'Views', viewers: 'Viewers', interactions: 'Interactions', likes: 'Likes and reactions', comments: 'Comments', shares: 'Shares', saves: 'Saves', clicks: 'Link clicks', follows: 'Follows' };
function parseTable({ heads, rows }) {
  const at = n => heads.findIndex(h => h === n), title = at('Title'), date = at('Date published');
  if (title < 0 || date < 0 || at('Views') < 0) return [];
  const clean = t => String(t).replace(/(?:\s*(?:Open Dropdown|Boost(?:ed)?(?: (?:post|reel|video))?|Boost|See insights))+\s*$/i, '').trim();
  return rows.filter(r => !/^Your story\b/i.test(r[title])).map(r => { const name = clean(r[title]), p = { id: `${name.slice(0, 60)}|${r[date]}`.slice(0, 200), title: name.slice(0, 120), date: String(r[date]).slice(0, 40) }; for (const [k, h] of Object.entries(COLS)) p[k] = num(r[at(h)]); return p; });
}
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// A level needs at least 3 posts to compare; otherwise saying "good" would mean nothing.
function withLevels(posts) {
  const v = posts.map(p => p.views).filter(x => x !== null), mid = v.length >= 3 ? median(v) : null;
  return { median: mid, posts: posts.map(p => ({ ...p, level: mid === null || p.views === null ? null : p.views >= mid * 1.3 ? 'ভালো' : p.views <= mid * 0.7 ? 'কম' : 'মাঝারি', rate: p.views && p.interactions !== null ? Math.round(p.interactions / p.views * 1000) / 10 : null })) };
}
const show = n => n === null || n === undefined ? 'নেই' : n.toLocaleString('en-IN');
function report(raw) {
  if (!raw.length) { const t = 'Insights-এ এই সময়ের কোনো পোস্ট পেলাম না।'; return { text: t, spoken: t }; }
  const { median: mid, posts } = withLevels(raw), ranked = [...posts].sort((a, b) => (b.views ?? -1) - (a.views ?? -1)), best = ranked[0], worst = ranked.at(-1);
  const rows = ranked.map((p, i) => `${i + 1}. ${p.title}\n${p.date}${p.level ? ' · লেভেল: ' + p.level : ''}\n${show(p.views)} views · ${show(p.viewers)} viewers · ${show(p.interactions)} interaction${p.rate !== null ? ` (${p.rate}%)` : ''} · ${show(p.comments)} comment · ${show(p.shares)} share · ${show(p.saves)} save · ${show(p.follows)} follow`);
  const head = `${posts.length}টা পোস্ট দেখলাম।${mid !== null ? ` মাঝের পোস্টের views ${show(Math.round(mid))}; এর ১.৩ গুণ বা বেশি হলে ভালো, ০.৭ গুণ বা কম হলে কম।` : ' লেভেল বলতে অন্তত ৩টা পোস্ট লাগে।'}`;
  return { text: `${head}\n\n${rows.join('\n\n')}`, spoken: `[warm] ${posts.length}টা পোস্ট দেখলাম। সবচেয়ে বেশি ${show(best.views)} views${posts.length > 1 ? `, সবচেয়ে কম ${show(worst.views)} views` : ''}। পুরো লিস্ট chat-এ দিলাম।` };
}
const wantsAllVideos = q => /সব|\ball\b|যে কয়টা|যত/i.test(q) && /ভিডিও|video|পোস্ট|\bposts?\b/i.test(q) && /analysis|অ্যানালাইসিস|অ্যানালিসিস|এনালাইসিস|বিশ্লেষণ/i.test(q);
module.exports = { wantsAllVideos, wantsAdvice, wantsPerf, readScript, parseTable, withLevels, report, num, URL_INSIGHTS };
