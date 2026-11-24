const assert = require('assert');
const { wantsPerf, parseTable, withLevels, report, num } = require('./pageinsights');

for (const q of ['আমার পেজের পোস্ট কেমন যাচ্ছে?', 'কোন পোস্ট ভালো চলছে', 'page insights দেখাও', 'পোস্টের views কত']) assert(wantsPerf(q), q);
for (const q of ['Facebook Page-এ রাত ৯টায় পোস্ট করো', 'পেজে এটা আপলোড করো', 'আজকের খবর কেমন', 'views মানে কী']) assert(!wantsPerf(q), q);
assert.deepEqual(['258', '1,204', '1.2K', '3M', '', '--'].map(num), [258, 1204, 1200, 3000000, null, null]);

const heads = ['Title', 'Date published', 'Views', 'Reach', 'Viewers', 'Interactions', 'Likes and reactions', 'Comments', 'Shares', 'Saves', 'Link clicks', 'Follows'];
const row = (t, v, i) => [t, 'Nov 21', String(v), '', '10', String(i), '1', '2', '3', '4', '5', '6'];
const p = parseTable({ heads, rows: [row('A', 100, 10), row('B', 200, 20), row('C', 50, 1)] });
assert.deepEqual([p[0].title, p[0].views, p[0].viewers, p[0].interactions, p[0].comments, p[0].follows], ['A', 100, 10, 10, 2, 6]);
const L = withLevels(p);
assert.equal(L.median, 100); assert.deepEqual(L.posts.map(x => x.level), ['মাঝারি', 'ভালো', 'কম']); assert.equal(L.posts[0].rate, 10);
assert(withLevels(p.slice(0, 2)).posts.every(x => x.level === null), 'no level from too few posts');
const r = report(p); assert(r.text.indexOf('1. B') < r.text.indexOf('2. A')); assert(r.spoken.includes('200')); assert(!r.spoken.includes('B'));
assert.deepEqual(parseTable({ heads: ['Other'], rows: [['x']] }), []);
assert.match(report([]).text, /পেলাম না/);
const q = parseTable({ heads, rows: [row('আমার ভিডিও Boost post Open Dropdown', 10, 1), row('Your story expires soon Open Dropdown', 0, 0)] });
assert.equal(q.length, 1, 'stories are not posts'); assert.equal(q[0].title, 'আমার ভিডিও');
assert.equal(parseTable({ heads, rows: [['A', 'Nov 21', '5', '', '', '', '', '', '', '', '', '']] })[0].comments, null, 'an empty cell stays unknown, never 0');
const { wantsAdvice } = require('./pageinsights');
for (const x of ['আমার পেজে কোথায় ভুল হচ্ছে?', 'reach কেন কমে যাচ্ছে', 'পোস্টের views কীভাবে বাড়াব']) assert(wantsAdvice(x), x);
for (const x of ['কেমন আছো', 'mail-এ কী সমস্যা', 'পেজে এটা আপলোড করো', 'আমার পেটে সমস্যা']) assert(!wantsAdvice(x), x);
const { wantsAllVideos } = require('./pageinsights');
assert(wantsAllVideos('আমার Facebook-এ যে কয়টা video ছাড়ছি, সবগুলা video analysis করো')); assert(!wantsAllVideos('আমার শেষ পোস্টটা analysis করো'));
console.log('pageinsights tests ok');
