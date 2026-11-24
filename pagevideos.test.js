const assert = require('assert');
const { wantsVideoReview, howMany, matchStats } = require('./pagevideos');

for (const q of ['আমার Facebook-এর সব ভিডিও রিভিউ করো', 'পেজের শেষ reel analysis করো', 'আমার যে কয়টা video ছাড়ছি সবগুলা video analysis করো']) assert(wantsVideoReview(q), q);
for (const q of ['এই ভিডিও পোস্ট করার আগে চেক করো রিভিউ', 'YouTube-এর আমার video review করো', 'reel.mp4 আমার রিভিউ করো', 'আমার পেজ কেমন যাচ্ছে', 'ভিডিও মানে কী']) assert(!wantsVideoReview(q), q);
assert.equal(howMany('শেষ ভিডিও রিভিউ করো'), 1); assert.equal(howMany('সব ভিডিও রিভিউ করো'), 5);
const rows = [{ title: 'রোজ সকালে business news খুঁজতে', views: 453 }, { title: 'AI দিয়ে বানালাম News Board!', views: 363 }];
assert.equal(matchStats('AI দিয়ে বানালাম News Board! 🔥 আমি Sandip', rows).views, 363);
assert.equal(matchStats('একদম অন্য লেখা এখানে আছে', rows), null); assert.equal(matchStats('', rows), null);
console.log('pagevideos tests ok');
