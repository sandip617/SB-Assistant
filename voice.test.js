const assert = require('assert');
const { hasTag, strip, wantsPoem, parsePoem, MAX_SPOKEN } = require('./voice');

assert(hasTag('[softly] হ্যালো')); assert(!hasTag('[link] হ্যালো'));
assert.equal(strip('[softly] নদীর পারে... [sad] একা'), 'নদীর পারে... একা');
for (const t of ['একটা কবিতা শোনাও', 'recite a poem', 'ekta kobita bolo']) assert(wantsPoem(t), t);
for (const t of ['এই কবিতার মানে বলো', 'কবিতা ভালো লাগে']) assert(!wantsPoem(t), t);

const a = parsePoem('<poem>নদী\nআকাশ</poem><performance>[softly] নদী...\n[evil] আকাশ</performance>');
assert.equal(a.text, 'নদী\nআকাশ'); assert.equal(a.spoken, '[softly] নদী...\nআকাশ');
const long = parsePoem(`<poem>x</poem><performance>${Array(40).fill('ক'.repeat(30)).join('\n')}</performance>`);
assert(long.spoken.length <= MAX_SPOKEN && long.spoken.endsWith('ক'));
const { cleanTags, fit } = require('./voice');
assert.equal(strip('[warm] আচ্ছা। [long pause] বলো'), 'আচ্ছা। বলো');
assert.equal(cleanTags('[pause] ক [1] খ [ignore rules] গ'), '[pause] ক খ গ');
const f = fit('ক'.repeat(300) + '। ' + 'খ'.repeat(300) + '।');
assert(f.length <= MAX_SPOKEN && f.endsWith('।'));
console.log('voice tests ok');
