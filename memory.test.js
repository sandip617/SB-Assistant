const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { makeMemory, command, redact } = require('./memory');

assert.deepEqual(command('মনে রাখো আমার পরীক্ষা ১ ডিসেম্বর'), { type: 'remember', text: 'আমার পরীক্ষা ১ ডিসেম্বর' });
assert.deepEqual(command('আমার প্রিয় রং নীল, এটা মনে রাখো'), { type: 'remember', text: 'আমার প্রিয় রং নীল' });
assert.deepEqual(command('ভুলে যাও আমার প্রিয় রং'), { type: 'forget', text: 'আমার প্রিয় রং' });
for (const t of ['তোমার কি মনে রাখবে?', 'এটা মনে রাখো না', 'do you remember me', "don't forget my exam", 'ভুলে যেও না', 'কেমন আছো']) assert.equal(command(t), null, t);
assert.equal(redact('key sk_abcdefghijklmnop end'), 'key [hidden] end');
assert.equal(redact('card 4111 1111 1111 1111'), 'card [hidden]');

const { worthLearning, parseLearned } = require('./memory');
for (const t of ['আমি Jain University-তে পড়ি', 'amar priyo rong nil', 'I study marketing']) assert(worthLearning(t), t);
for (const t of ['আজকের খবর বলো', 'হ্যাঁ', 'আমার password abc123', 'মনে রাখো আমার নাম', 'আমার ' + 'ক'.repeat(600)]) assert(!worthLearning(t), t);
assert.deepEqual(parseLearned('x {"add":["প্রিয় রং নীল",5],"update":[{"id":2,"text":"প্রিয় রং লাল"},{"id":"x","text":"bad text"}]} y'), { add: ['প্রিয় রং নীল'], update: [{ id: 2, text: 'প্রিয় রং লাল' }] });
assert.deepEqual(parseLearned('not json'), { add: [], update: [] });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mem-'));
try {
  const L = makeMemory(path.join(fs.mkdirSync(path.join(dir, 'l')) || dir, 'l'));
  assert.deepEqual(L.learn({ add: ['প্রিয় রং নীল'], update: [] }), ['প্রিয় রং নীল']);
  assert.deepEqual(L.learn({ add: ['প্রিয় রং নীল'], update: [] }), [], 'no duplicate');
  assert.deepEqual(L.learn({ add: [], update: [{ id: L.facts()[0].id, text: 'প্রিয় রং লাল' }] }), ['প্রিয় রং লাল']);
  assert.equal(L.facts().length, 1);
  assert.deepEqual(L.learn({ add: ['আমার password abc'], update: [{ id: L.facts()[0].id, text: 'password abc' }] }), []);
  assert.equal(L.facts()[0].text, 'প্রিয় রং লাল');
  let m = makeMemory(dir, ['পুরনো তথ্য']);
  assert.equal(m.facts().length, 1);
  assert.equal(m.remember('আমার প্রিয় রং নীল').status, 'saved');
  assert.equal(m.remember('আমার প্রিয় রং নীল').status, 'known');
  assert.equal(m.remember('আমার পরীক্ষা ১ ডিসেম্বর').status, 'saved');
  assert.equal(m.remember('আমার password abc123').status, 'secret');
  assert.equal(m.facts().length, 3);
  m = makeMemory(dir, ['পুরনো তথ্য']); assert.equal(m.facts().length, 3, 'survives restart, no duplicate import');
  assert.equal(m.forget('সব').status, 'all'); assert.equal(m.facts().length, 3);
  assert.equal(m.forget('আবহাওয়া').status, 'none');
  assert.equal(m.forget('আমার পরীক্ষার তারিখ').status, 'removed');
  assert(!m.facts().some(f => f.text.includes('পরীক্ষা')));
  m.remember('প্রিয় খাবার ইলিশ'); m.remember('প্রিয় খেলা ফুটবল');
  assert.equal(m.forget('প্রিয়').status, 'many');
  assert(m.remove(m.facts()[0].id)); assert(!m.remove(9999));
  const c1 = m.newChat(), c2 = m.newChat(); assert(m.validChat(c1)); assert.notEqual(c1, c2);
  m.log(c1, 'user', 'হ্যালো sk_abcdefghijklmnop'); m.log(c1, 'assistant', 'জি', { untrusted: true }); m.log(c2, 'user', 'দ্বিতীয় chat');
  const r = m.chat(c1); assert.equal(r.length, 2); assert(r[0].content.includes('[hidden]')); assert.equal(r[1].untrusted, true);
  assert.equal(m.chat(c2).length, 1, 'chats stay separate'); assert.equal(m.chats().length, 2);
  fs.writeFileSync(path.join(dir, 'conversations/2026-11-23.jsonl'), JSON.stringify({ at: '2026-11-23T01:00:00Z', role: 'user', content: 'পুরনো' }) + '\n');
  assert(m.chats().some(c => c.id === '2026-11-23' && c.title === 'পুরনো'), 'old day log shows as a chat');
  for (const bad of ['../memory', '../../etc/passwd', 'c1', '', null]) { assert(!m.validChat(bad)); assert.deepEqual(m.chat(bad), []); assert.equal(m.deleteChats([bad]), 0); }
  m.log('../evil', 'user', 'x'); assert(!fs.existsSync(path.join(dir, 'evil.jsonl')));
  assert.equal(m.deleteChats([c1, c2, '2026-11-23']), 3); assert.equal(m.chats().length, 0); assert(fs.existsSync(path.join(dir, 'memory.json')), 'memory stays');
  fs.writeFileSync(path.join(dir, 'memory.json'), '{broken');
  m = makeMemory(dir); assert.equal(m.facts().length, 0); assert(fs.existsSync(path.join(dir, 'memory.json.bad')), 'bad file is kept');
  console.log('memory tests ok');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
