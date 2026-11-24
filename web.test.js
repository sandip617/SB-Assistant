const assert = require('assert');
const { wantsWeb, parseAnswer } = require('./web');

for (const t of ['আজকের বড় খবর কী?', 'এই news টা বিশ্লেষণ করো', 'ইন্টারনেটে খুঁজে বলো', 'aj er khobor bolo']) assert(wantsWeb(t), t);
for (const t of ['কী খবর?', 'তোমার কি খবর', 'আমার মেইলে কী খবর', 'এই ফাইলটা search করো', 'আমার কাজ বলো']) assert(!wantsWeb(t), t);

const raw = 'বিশ্লেষণ।\n<spoken>ছোট সারাংশ।</spoken>\n<sources>\nReal | https://www.news.example/a/\nFake | https://evil.example/x\nBad | javascript:alert(1)\n</sources>';
const a = parseAnswer(raw, ['https://news.example/a']);
assert.equal(a.text, 'বিশ্লেষণ।'); assert.equal(a.spoken, 'ছোট সারাংশ।');
assert.deepEqual(a.sources.map(s => s.title), ['Real']);
const none = parseAnswer(raw, []);
assert.equal(none.sources.length, 0); assert(!none.text.includes('বিশ্লেষণ'));
const { wantsSite, siteUrl, isPrivate, pageLinks } = require('./web');
assert(wantsSite('আমার website-এ কী কী live আছে')); assert(wantsSite('example.com চালু আছে?'));
assert(!wantsSite('এই শব্দের meaning কী')); assert(!wantsSite('a@b.com এ mail check করো'));
assert.equal(siteUrl('example.com/a live?'), 'https://example.com/a');
for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1']) assert(isPrivate(ip), ip);
for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) assert(!isPrivate(ip), ip);
assert.deepEqual(pageLinks('<a href="/about?x=1">a</a><a href="https://other.example/">b</a><a href="/f.pdf">c</a><a href="#top">d</a>', 'https://me.example/'), ['https://me.example/about']);
console.log('web tests ok');
