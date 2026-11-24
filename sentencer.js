// Turns the model's streaming text into speakable sentences; hidden [[ACTION ...]] lines never get through.
const BAD = /ACTION|\[\[|\]\]|টুল ব্যবহার|সিস্টেম প্রম্পট/i, ACT = /\[\[ACTION\s*\{.*?\}\s*\]\]\n?/g;
function sentencer(emit, min = 25) {
  let buf = '', hold = '';
  const out = s => { s = s.replace(/^\s*SB:\s*/, '').trim(); if (!s || BAD.test(s)) return; hold = hold ? hold + ' ' + s : s; if (hold.length >= min) { emit(hold); hold = ''; } };
  return {
    push(t) {
      buf = (buf + t).replace(ACT, '');
      const h = buf.search(/\[\[|\[$/); // hold back only what could be a hidden action
      let safe = h >= 0 ? buf.slice(0, h) : buf, m;
      while ((m = /[।!?\n]|\.\s/.exec(safe))) { const s = safe.slice(0, m.index + m[0].length); out(s); buf = buf.slice(s.length); safe = safe.slice(s.length); }
    },
    end() { buf = buf.replace(ACT, ''); if (!buf.includes('[[')) out(buf); buf = ''; if (hold) emit(hold); hold = ''; },
  };
}
module.exports = { sentencer, BAD };
