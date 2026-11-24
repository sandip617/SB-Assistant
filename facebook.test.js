const assert = require('assert'), F = require('./facebook');
assert.deepEqual(F.compare({ reactions: 20, comments: 0, shares: 0 }, [{ reactions: 10, comments: 0, shares: 0 }, { reactions: 10, comments: 0, shares: 0 }]), { baseline: 10, score: 20, change: 100 });
assert.equal(F.compare({ reactions: 1, comments: 0, shares: 0 }, []).change, null);
(async () => {
  await assert.rejects(F.download('https://evil.example/x.mp4', '/tmp/never'), /bad media host/);
  await assert.rejects(F.download('http://video.fbcdn.net/x.mp4', '/tmp/never'), /bad media host/);
  console.log('facebook tests ok');
})().catch(e => { console.error(e); process.exit(1); });
