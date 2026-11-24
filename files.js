// Read-only access to ~/Desktop, ~/Documents and ~/Downloads. Changes are only planned here and run after the user's yes.
const fs = require('fs'), path = require('path'), { execFile } = require('child_process');
const DOC = /\.(?:pdf|docx?|rtf|xlsx|xlsm)$/i, MAX_DOC = 50e6, { workbookText } = require('./xlsx');
const PDF_JXA = `ObjC.import('Quartz');function run(a){const d=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[0]));if(d.isNil())return JSON.stringify({bad:true});if(d.isLocked)return JSON.stringify({locked:true});const s=d.string;return JSON.stringify({pages:d.pageCount,text:s.isNil()?'':s.js})}`;
const tool = (cmd, args) => new Promise((ok, no) => execFile(cmd, args, { timeout: 30_000, maxBuffer: 5e7 }, (e, so) => e ? no(e) : ok(so)));
const TEXT = /\.(?:txt|md|csv|tsv|json|log|html?|css|js|ts|py|ipynb|xml|ya?ml)$/i, IMAGE = /\.(?:jpe?g|png|heic|webp|gif|tiff?)$/i;
const SECRET = /^(?:id_rsa|id_ed25519|id_ecdsa|credentials?|secrets?|passwords?|tokens?)(?:\..*)?$|\.(?:pem|key|p12|pfx|kdbx|keychain(?:-db)?)$|pass(?:word|words|wd)/i;
const MAX_TEXT = 2e6, MAX_IMAGE = 25e6, SHOW = 12_000;
const norm = s => s.normalize('NFC').toLowerCase(); // macOS stores Bangla filenames decomposed

// Text of a PDF, Word, RTF or Excel file. The caller decides which paths are allowed.
async function extractDoc(f) {
  let text, pages;
  try {
    if (/\.pdf$/i.test(f)) {
      const j = JSON.parse(await tool('osascript', ['-l', 'JavaScript', '-e', PDF_JXA, f]));
      if (j.locked) throw new Error('এই PDF-এ পাসওয়ার্ড দেওয়া, তাই খুলছি না');
      if (j.bad) throw new Error('PDF-টা খোলা যাচ্ছে না');
      ({ text, pages } = j);
      if (text.trim().length < 20) return { pages, scanned: true };
    } else if (/\.xls[xm]$/i.test(f)) {
      try { text = await workbookText(p => tool('unzip', ['-p', f, p]).catch(() => '')); } catch { throw new Error('Excel ফাইলটা খোলা যাচ্ছে না'); }
    } else text = await tool('textutil', ['-convert', 'txt', '-stdout', f]);
  } catch (e) { throw e.code !== undefined || e.killed ? new Error('ফাইলটা পড়া গেল না') : e; }
  return { text, pages };
}

function makeFiles(home, project) {
  const real = p => { try { return fs.realpathSync(p); } catch { return null; } };
  const roots = ['Desktop', 'Documents', 'Downloads'].map(d => real(path.join(home, d))).filter(Boolean), own = real(project);
  const inside = (p, r) => p === r || p.startsWith(r + path.sep);
  const denied = p => {
    const r = roots.find(x => inside(p, x)); if (!r || (own && inside(p, own))) return true;
    return path.relative(r, p).split(path.sep).some(s => s.startsWith('.') || SECRET.test(s));
  };
  const abs = p => { const s = String(p || '').trim(); return path.resolve(home, s === '~' ? '.' : s.replace(/^~\//, '')); };
  // realpath first, so a symlink cannot lead outside the allowed folders
  const check = p => { const x = real(abs(p)); if (!x) throw new Error('এই ফাইল বা ফোল্ডার পাইনি'); if (denied(x)) throw new Error('এই জায়গাটা দেখার অনুমতি নেই'); return x; };
  const entry = (dir, d) => { try { const f = path.join(dir, d.name), s = fs.statSync(f); return { name: d.name.normalize('NFC'), path: f.normalize('NFC'), type: s.isDirectory() ? 'folder' : 'file', size: s.size, modified: s.mtime.toISOString().slice(0, 16) }; } catch { return null; } };
  const visible = (dir, d) => !d.isSymbolicLink() && !denied(path.join(dir, d.name));

  function list(p) {
    const dir = check(p || 'Desktop'); if (!fs.statSync(dir).isDirectory()) throw new Error('এটা ফোল্ডার না');
    const all = fs.readdirSync(dir, { withFileTypes: true }).filter(d => visible(dir, d)).map(d => entry(dir, d)).filter(Boolean).sort((a, b) => b.modified.localeCompare(a.modified));
    return { folder: dir.normalize('NFC'), total: all.length, items: all.slice(0, 150) };
  }
  function search(name, under) {
    const q = norm(String(name || '').trim()); if (!q) throw new Error('কী নামে খুঁজব বলো');
    const start = under ? [check(under)] : roots, stack = start.map(d => [d, 0]), found = []; let seen = 0;
    while (stack.length && found.length < 40 && seen < 20_000) {
      const [dir, depth] = stack.pop(); let ds; try { ds = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const d of ds) {
        seen++; if (!visible(dir, d) || d.name === 'node_modules') continue;
        if (norm(d.name).includes(q)) { const e = entry(dir, d); if (e) found.push(e); }
        if (d.isDirectory() && depth < 6) stack.push([path.join(dir, d.name), depth + 1]);
      }
    }
    return { query: name, items: found.slice(0, 40) };
  }
  function readText(p) {
    const f = check(p), s = fs.statSync(f);
    if (!s.isFile() || !TEXT.test(f)) throw new Error('এই ধরনের ফাইল লেখা হিসেবে পড়তে পারি না');
    if (s.size > MAX_TEXT) throw new Error('ফাইলটা অনেক বড়');
    const b = fs.readFileSync(f); if (b.includes(0)) throw new Error('এটা লেখার ফাইল না');
    const t = b.toString('utf8'); return { path: f.normalize('NFC'), text: t.slice(0, SHOW), cut: t.length > SHOW };
  }
  function imagePath(p) {
    const f = check(p), s = fs.statSync(f);
    if (!s.isFile() || !(IMAGE.test(f) || /\.pdf$/i.test(f))) throw new Error('এটা ছবির ফাইল না'); // a PDF renders as its first page
    if (s.size > MAX_IMAGE) throw new Error('ছবিটা অনেক বড়');
    return f;
  }
  // from = character position, so a long document can be read part by part
  async function readDoc(p, from = 0) {
    const f = check(p), s = fs.statSync(f);
    if (s.isFile() && /\.xls$/i.test(f)) throw new Error('পুরনো .xls পড়তে পারি না। Excel বা Numbers থেকে .xlsx করে সেভ করো');
    if (!s.isFile() || !DOC.test(f)) throw new Error('এটা PDF, Word বা Excel ফাইল না');
    if (s.size > MAX_DOC) throw new Error('ফাইলটা অনেক বড়');
    const { text, pages, scanned } = await extractDoc(f);
    if (scanned) return { path: f.normalize('NFC'), pages, scanned: true };
    const at = Math.max(0, Math.min(+from || 0, text.length)), end = at + SHOW;
    return { path: f.normalize('NFC'), pages, total: text.length, from: at, text: text.slice(at, end), next: end < text.length ? end : null };
  }
  // Only describes a change. Nothing on disk moves until apply() runs after the user's yes.
  function plan({ op, path: from, to }) {
    if (!['move', 'rename', 'delete'].includes(op)) throw new Error('এই কাজটা করা যায় না');
    const src = check(from); if (roots.includes(src)) throw new Error('মূল ফোল্ডার বদলানো যাবে না');
    if (op === 'delete') return { op, from: src, to: null };
    let dest;
    if (op === 'rename') { const n = String(to || '').trim(); if (!n || n !== path.basename(n) || n.startsWith('.') || SECRET.test(n)) throw new Error('নতুন নামটা ঠিক না'); dest = path.join(path.dirname(src), n); }
    else { const dir = check(to); if (!fs.statSync(dir).isDirectory()) throw new Error('গন্তব্যটা ফোল্ডার না'); if (inside(dir, src)) throw new Error('ফোল্ডারকে নিজের ভেতরে সরানো যায় না'); dest = path.join(dir, path.basename(src)); }
    if (fs.existsSync(dest)) throw new Error('ওই নামে আগে থেকেই একটা আছে, তাই বদলাইনি');
    return { op, from: src, to: dest };
  }
  // shortcut: exists-then-rename is not atomic; fine for one person using one Mac.
  async function apply(o, trash) {
    const p = plan({ op: o.op, path: o.from, to: o.op === 'delete' ? null : o.op === 'rename' ? path.basename(o.to) : path.dirname(o.to) }); // checked again: the disk may have changed since the draft
    if (p.op === 'delete') await trash(p.from); else fs.renameSync(p.from, p.to);
    return p;
  }
  return { check, list, search, readText, readDoc, imagePath, plan, apply };
}

const WANT = /ডেস্কটপ|\bdesktop\b|ডাউনলোড|\bdownloads?\b|ডকুমেন্টস|\bdocuments\b|ফোল্ডার|\bfolders?\b|ফাইল|\bfiles?\b/i;
const PICTURE = /(?:ছবি|picture|image|photo|স্ক্রিনশট|screenshot).*(?:খুঁজ|খোঁজ|বের কর|পড়|নম্বর|নাম্বার|সংখ্যা|\bfind\b|\bread\b|number)|(?:খুঁজ|খোঁজ|\bfind\b).*(?:ছবি|picture|image|photo|স্ক্রিনশট|screenshot)/i;
const DOC_ASK = /(?:\bpdf\b|পিডিএফ|\bdocx?\b|\bxlsx\b|\bexcel\b|এক্সেল|ওয়ার্ড ডক|\bword doc).*(?:পড়|খুঁজ|খোঁজ|খোল|সারাংশ|সারমর্ম|\bsummar|\bread\b|\bfind\b|দেখ)|(?:পড়|খুঁজ|খোঁজ|খোল|সারাংশ|\bsummar|\bread\b|\bfind\b).*(?:\bpdf\b|পিডিএফ|\bdocx?\b|\bxlsx\b|\bexcel\b|এক্সেল|ওয়ার্ড ডক|\bword doc)/i;
const wantsFiles = t => !/https?:\/\/|\bgithub\b|গিটহাব|মেইল|\bmail\b|\bemail\b/i.test(t) && (WANT.test(t) || PICTURE.test(t) || DOC_ASK.test(t));
const wantsChange = t => /সরাও|সরিয়ে|মুভ|\bmove\b|\brename\b|নাম বদল|নাম পাল্ট|মুছ|\bdelete\b|ডিলিট|ফেলে দাও/i.test(t);
module.exports = { makeFiles, extractDoc, wantsFiles, wantsChange };
