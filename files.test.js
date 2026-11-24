const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { makeFiles, wantsFiles, wantsChange } = require('./files');

(async () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sb-files-')));
  try {
    for (const d of ['Desktop/App', 'Desktop/box', 'Documents', 'Downloads', 'Private']) fs.mkdirSync(path.join(home, d), { recursive: true });
    const w = (f, t = 'x') => fs.writeFileSync(path.join(home, f), t);
    w('Desktop/note.txt', 'number 42'); w('Desktop/App/.env', 'SECRET=1'); w('Desktop/.hidden.txt'); w('Desktop/server.pem'); w('Desktop/passwords.txt'); w('Private/out.txt'); w('Downloads/ছবি.png');
    fs.symlinkSync(path.join(home, 'Private/out.txt'), path.join(home, 'Desktop/link.txt'));
    const F = makeFiles(home, path.join(home, 'Desktop/App'));

    assert.equal(F.readText('~/Desktop/note.txt').text, 'number 42');
    for (const p of ['Desktop/App/.env', 'Desktop/.hidden.txt', 'Desktop/server.pem', 'Desktop/passwords.txt', 'Desktop/link.txt', 'Private/out.txt', '/etc/hosts', 'Desktop/../Private/out.txt']) assert.throws(() => F.readText(p), /অনুমতি/, p);
    const names = F.list('Desktop').items.map(i => i.name);
    assert(names.includes('note.txt')); for (const n of ['App', '.hidden.txt', 'server.pem', 'passwords.txt', 'link.txt']) assert(!names.includes(n), n);
    assert.equal(F.search('ছবি'.normalize('NFD')).items.length, 1);
    assert.equal(F.search('out').items.length, 0);

    const mv = F.plan({ op: 'move', path: 'Desktop/note.txt', to: 'Documents' });
    assert(fs.existsSync(path.join(home, 'Desktop/note.txt')), 'plan must not change the disk');
    await F.apply(mv); assert(fs.existsSync(path.join(home, 'Documents/note.txt')));
    w('Desktop/note.txt');
    assert.throws(() => F.plan({ op: 'move', path: 'Desktop/note.txt', to: 'Documents' }), /আগে থেকেই/);
    assert.throws(() => F.plan({ op: 'rename', path: 'Desktop/note.txt', to: '../evil.txt' }), /ঠিক না/);
    assert.throws(() => F.plan({ op: 'delete', path: 'Desktop' }), /মূল/);
    assert.throws(() => F.plan({ op: 'move', path: 'Desktop/box', to: 'Desktop/box' }), /নিজের/);
    let gone; await F.apply(F.plan({ op: 'delete', path: 'Desktop/note.txt' }), async p => { gone = p; });
    assert.equal(gone, path.join(home, 'Desktop/note.txt'));

    const { execFileSync } = require('child_process');
    w('Desktop/report.txt', 'WORDCODE 8841\n' + 'long line of text\n'.repeat(1500));
    execFileSync('textutil', ['-convert', 'docx', path.join(home, 'Desktop/report.txt'), '-output', path.join(home, 'Desktop/report.docx')]);
    const d1 = await F.readDoc('Desktop/report.docx'); assert(d1.text.includes('WORDCODE 8841')); assert(d1.next > 0);
    const d2 = await F.readDoc('Desktop/report.docx', d1.next); assert.equal(d2.from, d1.next); assert(!d2.text.includes('WORDCODE'));
    w('Desktop/plain.txt', 'PDFCODE 2957 is written inside this document');
    fs.writeFileSync(path.join(home, 'Desktop/plain.pdf'), execFileSync('/usr/sbin/cupsfilter', ['-m', 'application/pdf', path.join(home, 'Desktop/plain.txt')], { stdio: ['ignore', 'pipe', 'ignore'] }));
    const p1 = await F.readDoc('Desktop/plain.pdf'); assert(p1.text.includes('PDFCODE 2957'), p1.text); assert.equal(p1.pages, 1);
    w('Desktop/broken.pdf', 'not a pdf'); await assert.rejects(F.readDoc('Desktop/broken.pdf'), /খোলা যাচ্ছে না/);
    w('Desktop/.secret.pdf', 'x'); await assert.rejects(F.readDoc('Desktop/.secret.pdf'), /অনুমতি/);
    await assert.rejects(F.readDoc('Desktop/plain.txt'), /Word বা Excel/);
    for (const t of ['এই PDF টা পড়ে সারাংশ দাও', 'report.docx খুঁজে দাও']) assert(wantsFiles(t), t);
    for (const t of ['PDF কী জিনিস?', 'এই word এর meaning বলো']) assert(!wantsFiles(t), t);

    for (const t of ['Desktop-এর ফাইলগুলো দেখাও', 'এই ফোল্ডারে ছবিটা খুঁজে নম্বরটা বলো', 'ছবিটা খুঁজে দাও']) assert(wantsFiles(t), t);
    for (const t of ['একটা ছবি আঁকার আইডিয়া দাও', 'আমার mail-এর file দেখাও', 'কেমন আছো']) assert(!wantsFiles(t), t);
    assert(wantsChange('ফাইলটা মুছে দাও')); assert(!wantsChange('ফাইলটা পড়ো'));
    console.log('files tests ok');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
