const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), R = require('./resilience');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-backup-')), day = n => new Date(2026, 10, n, 10).getTime(), back = path.join(root, 'backups');
  try {
    assert.deepEqual(await R.runBackup(root, day(1)), { day: null, made: false }, 'nothing to copy');
    fs.writeFileSync(path.join(root, '.env'), 'SECRET=1'); fs.writeFileSync(path.join(root, 'memory.json'), '{"a":1}'); fs.writeFileSync(path.join(root, 'data.json'), '{}');
    fs.mkdirSync(path.join(root, 'conversations')); fs.writeFileSync(path.join(root, 'conversations/c1.jsonl'), 'hello\n');
    assert.equal((await R.runBackup(root, day(1))).made, true);
    assert.equal(fs.readFileSync(path.join(back, '2026-11-01/memory.json'), 'utf8'), '{"a":1}'); assert(fs.existsSync(path.join(back, '2026-11-01/conversations/c1.jsonl')));
    assert(!fs.existsSync(path.join(back, '2026-11-01/.env')), 'keys are never copied');
    fs.writeFileSync(path.join(root, 'memory.json'), '{"a":2}'); assert.equal((await R.runBackup(root, day(1))).made, false, 'once a day');
    assert.equal(fs.readFileSync(path.join(back, '2026-11-01/memory.json'), 'utf8'), '{"a":1}');
    fs.mkdirSync(path.join(back, 'keep-me')); fs.writeFileSync(path.join(back, 'keep-me/x'), '1');
    for (let d = 2; d <= 10; d++) await R.runBackup(root, day(d));
    const left = fs.readdirSync(back).filter(n => /^\d/.test(n)).sort(); assert.equal(left.length, R.KEEP); assert.equal(left[0], '2026-11-04'); assert.equal(left.at(-1), '2026-11-10');
    assert(fs.existsSync(path.join(back, 'keep-me/x')), 'only dated backups are ever removed'); assert.equal(R.lastBackup(root), '2026-11-10');
    assert(!fs.readdirSync(back).some(n => n.startsWith('.tmp')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }

  let up = true, t = 1000; const h = R.makeHealth('https://x.test/', async () => { if (!up) throw new Error('down'); return { status: 404 }; }, () => t);
  assert.equal(await h.check(), true, 'any HTTP answer means online'); assert.equal(h.offline(), false);
  up = false; assert.equal(await h.check(), false); assert.equal(h.offline(), true); assert.equal(h.netUp(), false);
  up = true; await h.check(); assert.equal(h.offline(), false);
  h.brainFailed(); assert.equal(h.offline(), true, 'AI failure counts'); assert.equal(h.netUp(), true); h.brainOk(); assert.equal(h.offline(), false);
  h.brainFailed(); t += 3 * 60_000 + 1; assert.equal(h.offline(), false, 'a past failure clears by itself');
  console.log('resilience tests ok');
})();
