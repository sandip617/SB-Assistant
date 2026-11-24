// Reads .xlsx text with no dependency: an .xlsx is a zip of XML files. Read-only; formulas are never run, only their saved values are shown.
const MAX_SHEETS = 20, MAX_ROWS = 5000;
const unxml = s => String(s).replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/gi, (_, d, h, n) => d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[n.toLowerCase()]);
const attr = (s, n) => (new RegExp(`(?:^|\\s)${n}="([^"]*)"`).exec(s) || [])[1];
const texts = s => [...s.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => unxml(m[1])).join('');
const colIndex = r => [...(/^[A-Z]+/.exec(r || '') || [''])[0]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

// Excel stores dates as numbers, so a date column would otherwise read as 46350.
function dateStyles(xml) {
  const custom = new Set([...xml.matchAll(/<numFmt\b([^>]*)\/?>/g)].filter(m => { const f = unxml(attr(m[1], 'formatCode') || '').replace(/\[[^\]]*\]|"[^"]*"|\\./g, ''); return /[ymd]/i.test(f); }).map(m => +attr(m[1], 'numFmtId')));
  const block = (/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml) || [])[1] || '';
  return [...block.matchAll(/<xf\b([^>]*?)\/?>/g)].map(m => { const id = +attr(m[1], 'numFmtId'); return (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || custom.has(id); });
}
const fromSerial = n => { const d = new Date(Math.round((n - 25569) * 864e5)); if (isNaN(d)) return String(n); const s = d.toISOString(); return n % 1 ? s.slice(0, 16).replace('T', ' ') : s.slice(0, 10); };

function cell(attrs, body, shared, isDate) {
  const t = attr(attrs, 't');
  if (t === 'inlineStr') return texts(body);
  const v = (/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body) || [])[1]; if (v == null) return '';
  if (t === 's') return shared[+v] ?? '';
  if (t === 'b') return v === '1' ? 'TRUE' : 'FALSE';
  if (t === 'str' || t === 'e') return unxml(v);
  return isDate[+attr(attrs, 's')] && Number.isFinite(+v) ? fromSerial(+v) : v;
}
function sheetText(xml, shared, isDate) {
  const rows = []; let cut = false;
  for (const m of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    if (rows.length >= MAX_ROWS) { cut = true; break; }
    const line = [];
    for (const c of (m[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) { const i = colIndex(attr(c[1], 'r')); if (i >= 0 && i < 200) line[i] = cell(c[1], c[2] || '', shared, isDate).replace(/[\t\r\n]+/g, ' ').trim(); }
    const s = Array.from(line, x => x ?? '').join('\t').replace(/\t+$/, ''); if (s) rows.push(s);
  }
  return rows.join('\n') + (cut ? `\n(প্রথম ${MAX_ROWS} সারি পর্যন্ত পড়েছি)` : '');
}
// read(part) gives the text of one file inside the zip, or '' if it isn't there.
async function workbookText(read) {
  const book = await read('xl/workbook.xml'); if (!book.includes('<sheet')) throw new Error('bad workbook');
  const rels = Object.fromEntries([...(await read('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b([^>]*)\/?>/g)].map(m => [attr(m[1], 'Id'), attr(m[1], 'Target')]));
  const shared = [...(await read('xl/sharedStrings.xml')).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g)].map(m => texts(m[1] || '')), isDate = dateStyles(await read('xl/styles.xml'));
  const out = [];
  for (const m of [...book.matchAll(/<sheet\b([^>]*)\/?>/g)].slice(0, MAX_SHEETS)) {
    if (/^(?:hidden|veryHidden)$/.test(attr(m[1], 'state') || '')) continue;
    const target = rels[attr(m[1], 'r:id')]; if (!target) continue;
    const part = target.startsWith('/') ? target.slice(1) : 'xl/' + target; if (!/^xl\/[\w/.-]+\.xml$/.test(part) || part.includes('..')) continue;
    out.push(`## Sheet: ${unxml(attr(m[1], 'name') || '')}\n${sheetText(await read(part), shared, isDate) || '(ফাঁকা)'}`);
  }
  return out.join('\n\n');
}
module.exports = { workbookText };
