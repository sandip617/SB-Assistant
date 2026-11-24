const assert = require('assert'), { sentencer } = require('./sentencer');
const run = (parts) => { const o = [], s = sentencer(x => o.push(x)); parts.forEach(s.push); s.end(); return o; };
const long = 'আজকে তোমার পরীক্ষার পড়া অনেক বাকি আছে সোনা।';
assert.deepStrictEqual(run(['[[ACT', 'ION {"tool":"add_task","input":{"text":"x"}}]]\n', long]), [long]); // action split across chunks is hidden
assert.deepStrictEqual(run(['আচ্ছা। ', long]), ['আচ্ছা। ' + long]); // short sentence joins the next
assert.deepStrictEqual(run([long.slice(0, 9), long.slice(9), ' শেষ']), [long, 'শেষ']); // chunk boundaries and tail
assert.deepStrictEqual(run(['SB: ' + long]), [long]);
assert.deepStrictEqual(run(['[[ACTION {"tool":"x"']), []); // cut-off action never spoken
assert.deepStrictEqual(run(['এই [নোট] লেখাটা তোমার জন্য রাখা আছে সোনা, পড়ে নিও']), ['এই [নোট] লেখাটা তোমার জন্য রাখা আছে সোনা, পড়ে নিও']); // a plain bracket must not silence her
console.log('sentencer tests ok');
