// Small Facebook helpers: scoring a post against the others, and saving a video from Facebook's own media hosts.
const fs = require('fs');

// How this post did against the median of the other posts.
function compare(cur, others) {
  const score = p => p.reactions + p.comments * 2 + p.shares * 3, s = others.map(score).sort((a, b) => a - b);
  if (!s.length) return { baseline: null, change: null, score: score(cur) };
  const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { baseline: m, score: score(cur), change: m ? Math.round((score(cur) - m) / m * 100) : null };
}
// Only Facebook's own media hosts, https only, with a size cap.
async function download(url, file, max = 300e6) {
  const okHost = u => { const x = new URL(u); return x.protocol === 'https:' && /(?:^|\.)(?:fbcdn\.net|facebook\.com)$/i.test(x.hostname); };
  if (!okHost(url)) throw new Error('bad media host');
  const r = await fetch(url, { signal: AbortSignal.timeout(180_000) }); if (!r.ok || !okHost(r.url)) throw new Error('media download failed');
  const fd = fs.openSync(file, 'w'); let n = 0;
  try { for await (const c of r.body) { n += c.length; if (n > max) throw new Error('media too large'); fs.writeSync(fd, c); } } finally { fs.closeSync(fd); }
}
module.exports = { compare, download };
