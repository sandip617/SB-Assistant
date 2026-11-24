const assert = require('assert');
const { wantsFbPost } = require('./metasuite');
for (const q of ['Facebook Page-এ রাত ৯টায় পোস্ট করো', 'আমার পেজে এটা আপলোড করো', 'fb page e post koro']) assert(wantsFbPost(q), q);
for (const q of ['note koro amar fb page name', 'এই পোস্ট অফিসে যাব', 'কেমন আছো']) assert(!wantsFbPost(q), q);
console.log('metasuite tests ok');
