// Expressive speech for Eleven v4: tags go to the voice only and never appear in the chat.
const NAMES = 'long pause|pause|softly|whispers|sad|sighs|excited|warm|warmly|tenderly|happy|delighted|curious|amused|laughs';
const TAG = new RegExp(`\\[(?:${NAMES})\\]\\s*`, 'gi');
const hasTag = t => new RegExp(`\\[(?:${NAMES})\\]`, 'i').test(t);
const strip = t => t.replace(TAG, '').replace(/[ \t]{2,}/g, ' ').trim();
const cleanTags = t => t.replace(/\[[^\]]*\]\s*/g, m => hasTag(m) ? m : ''); // anything else in brackets would be read as a voice instruction
const fit = t => { const c = cleanTags(t).trim(); if (c.length <= MAX_SPOKEN) return c; const cut = c.slice(0, MAX_SPOKEN), i = Math.max(cut.lastIndexOf('।'), cut.lastIndexOf('?'), cut.lastIndexOf('!')); return i > 0 ? cut.slice(0, i + 1) : cut; };
const wantsPoem = t => /কবিতা|আবৃত্তি|ছড়া|\bpoem\b|kobita|abritti/i.test(t) && !/মানে|অর্থ|meaning/i.test(t) && /শোনাও|শুনাও|বলো|বল\b|পড়ো|আবৃত্তি|লিখ|recite|shonao|sunao|bolo/i.test(t);

// Free plan: a poem is spoken up to whole lines within this limit; the chat still shows all of it.
const MAX_SPOKEN = 450;
function parsePoem(raw) {
  const poem = (/<poem>([\s\S]*?)<\/poem>/.exec(raw) || [])[1]?.trim() || strip(raw.replace(/<\/?\w+>/g, '')).trim();
  const perf = (/<performance>([\s\S]*?)<\/performance>/.exec(raw) || [])[1]?.trim() || poem;
  const clean = cleanTags(perf);
  let spoken = '';
  for (const l of clean.split('\n')) { if (spoken && (spoken + '\n' + l).length > MAX_SPOKEN) break; spoken += (spoken ? '\n' : '') + l; }
  return { text: poem, spoken: spoken.slice(0, MAX_SPOKEN) };
}
module.exports = { hasTag, strip, cleanTags, fit, wantsPoem, parsePoem, MAX_SPOKEN };
