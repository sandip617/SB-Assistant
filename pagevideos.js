// Finds the Page's own published videos through the user's Safari session, for review. Read-only: nothing here clicks or changes anything.
const VID = /ভিডিও|\bvideos?\b|রিল|\breels?\b/i, DO = /রিভিউ|\breview\b|analysis|অ্যানালাইসিস|অ্যানালিসিস|এনালাইসিস|বিশ্লেষণ/i, WHERE = /facebook|ফেসবুক|\bfb\b|পেজ|\bpage\b|ছাড়|আমার/i, NOT = /পোস্ট করার আগে|আগে চেক|youtube|ইউটিউব|\.(?:mp4|mov|m4v|webm)\b/i;
const wantsVideoReview = q => VID.test(q) && DO.test(q) && WHERE.test(q) && !NOT.test(q);
const howMany = q => /শেষ|\blast\b|\blatest\b|সর্বশেষ/i.test(q) ? 1 : 5; // each video takes about a minute on this Mac

const REF_JS = `window.__sbR=JSON.stringify({login:/login/.test(location.href),id:(new URLSearchParams(location.search).get('asset_id'))||((document.documentElement.innerHTML.match(/"page_id":"(\\d{6,})"/)||[])[1])||''});'x'`;
const ITEM_JS = `window.__sbR='PENDING';(async()=>{const wait=m=>new Promise(r=>setTimeout(r,m)),find=()=>/"progressive_url":"(https:[^"]+)"/.exec(document.documentElement.innerHTML);for(let i=0;i<40&&!find();i++)await wait(250);const m=find(),meta=p=>document.querySelector('meta[property="'+p+'"]')?.content||'';
return{login:/login/.test(location.href),url:m?JSON.parse('"'+m[1]+'"'):null,text:(meta('og:description')||meta('og:title')||'').replace(/\\s+/g,' ').trim().slice(0,300)}})().then(v=>{window.__sbR=JSON.stringify(v)}).catch(()=>{window.__sbR='{"url":null}'});'x'`;

// The Page's public video tabs also show other people's suggested reels, so only Business Suite's Published list counts as "mine".
const PUBLISHED = 'https://business.facebook.com/latest/posts/published_posts';
const OWN_JS = `window.__sbR='PENDING';(async()=>{const wait=m=>new Promise(r=>setTimeout(r,m));for(let i=0;i<48&&document.querySelectorAll('[role=row]').length<2;i++)await wait(250);await wait(1800);const h=document.documentElement.innerHTML;return{login:/login/.test(location.href),ids:[...new Set([...h.matchAll(/"video_id":"(\\d{6,})"/g)].map(m=>m[1]))].slice(0,20)}})().then(v=>{window.__sbR=JSON.stringify(v)}).catch(()=>{window.__sbR='{"ids":[]}'});'x'`;
// Pairs a video with its Insights row by the start of its caption.
const key = s => String(s || '').normalize('NFC').replace(/[^\p{L}\p{M}\p{N}]+/gu, '').toLowerCase().slice(0, 18);
function matchStats(text, rows) { const k = key(text); if (k.length < 6) return null; return rows.find(r => { const a = key(r.title); return a.length >= 6 && (a.startsWith(k) || k.startsWith(a)); }) || null; }
module.exports = { wantsVideoReview, howMany, matchStats, REF_JS, ITEM_JS, PUBLISHED, OWN_JS };
