import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.UNIT_TEST = '1';
process.env.DATA_DIR = '/tmp/position-alert-v65-tests';

const {
  app,
  TRADERS,
  hasCoreMember,
  newestPositions,
  normalizeOrder,
  pctNumber,
  pullbackSnapshot,
  pullbackTransition,
  strictQualification,
} = await import(existsSync(new URL('./v64-root/server.js', import.meta.url)) ? './v64-root/server.js' : './server.js');

assert.deepEqual(
  TRADERS.map(x => x.id),
  ['5075281354358777856', '5010080316338276609', '5085948606825292289'],
  'Only the audited core plus two qualified confirmation traders should remain',
);

const ordered = newestPositions([
  { symbol:'OLDUSDT', openTime:'2026-08-27T10:00:00.000Z' },
  { symbol:'UNKNOWNUSDT', openTime:null },
  { symbol:'NEWUSDT', openTime:'2026-08-29T10:00:00.000Z' },
  { symbol:'MIDUSDT', openTime:'2026-08-28T10:00:00.000Z' },
]);
assert.deepEqual(ordered.map(x => x.symbol), ['NEWUSDT','MIDUSDT','OLDUSDT','UNKNOWNUSDT']);

assert.equal(hasCoreMember([{ traderId:'5010080316338276609' }]), false);
assert.equal(hasCoreMember([{ traderId:'5010080316338276609' }, { traderId:'5075281354358777856' }]), true);

assert.equal(pctNumber(0.72106517), 0.72106517);
assert.equal(pctNumber(15), 15);
assert.equal(normalizeOrder({
  symbol:'BTCUSDT', side:'BUY', positionSide:'LONG', executedQty:1,
  avgPrice:100, orderUpdateTime:1,
})?.positionSide, 'LONG');
assert.equal(normalizeOrder({
  symbol:'BTCUSDT', side:'BUY', positionSide:'BOTH', executedQty:1,
  avgPrice:100, orderUpdateTime:1,
}), null, 'One-way BOTH orders must not silently create false hedge-mode positions');

function candidateState(overrides = {}) {
  return {
    trader:{ core:false }, historyStatus:'OK', positions:new Map(),
    screening:{
      roi7d:22, roi30d:96, pnl30d:44751, copierPnl30d:19783,
      aum30d:111224, followers30d:40, ageDays:132, winRate30d:81, mdd30d:15,
    },
    recentStats:{ sample:12 },
    referenceStats:{
      sample:544, profitFactor:4.95, medianDurationMin:84,
      maxLeverage:20, profitConcentration:12.9,
    },
    ...overrides,
  };
}

assert.equal(strictQualification(candidateState()).qualified, true);
assert.equal(strictQualification(candidateState({
  screening:{ ...candidateState().screening, copierPnl30d:-1 },
})).qualified, false);
assert.equal(strictQualification(candidateState({
  screening:{ ...candidateState().screening, winRate30d:99.4 },
})).qualified, false);
assert.equal(strictQualification(candidateState({ historyStatus:'ERROR' })).qualified, false);

function pullbackTracker(side, overrides = {}) {
  return {
    side,
    entryPrice:100,
    extremePrice:side==='SHORT'?95:105,
    atr:1,
    hydrationStatus:'READY',
    invalidPrice:side==='SHORT'?108:92,
    normalSentAt:null,
    deepSentAt:null,
    invalidSentAt:null,
    ...overrides,
  };
}

const longSnapshot = pullbackSnapshot(pullbackTracker('LONG'), 103);
assert.equal(longSnapshot.activated, true);
assert.equal(Math.round(longSnapshot.retracementPct), 40);
assert.deepEqual(longSnapshot.normal, { low:102.5, high:103.09 });

const longNormal = pullbackTransition(pullbackTracker('LONG'), 103, 1_000);
assert.equal(longNormal.eventType, 'PULLBACK');
assert.equal(longNormal.reason, 'FIB_0382');
const longDeep = pullbackTransition(longNormal.tracker, 101.9, 2_000);
assert.equal(longDeep.eventType, 'DEEP_PULLBACK');
const longInvalid = pullbackTransition(longDeep.tracker, 101, 3_000);
assert.equal(longInvalid.eventType, 'INVALIDATION');
assert.equal(longInvalid.reason, 'FIB_TOO_DEEP');
assert.equal(pullbackTransition(longInvalid.tracker, 100.8, 4_000).eventType, null, 'Each pullback stage must notify only once');

const shortNormal = pullbackTransition(pullbackTracker('SHORT'), 97, 5_000);
assert.equal(shortNormal.eventType, 'PULLBACK');
assert.equal(Math.round(shortNormal.snapshot.retracementPct), 40);

const tooSmall = pullbackSnapshot(pullbackTracker('LONG', { extremePrice:100.5 }), 100.2);
assert.equal(tooSmall.activated, false, 'Ordinary noise must not arm pullback alerts');

const structuralInvalid = pullbackTransition(
  pullbackTracker('LONG', { extremePrice:100, invalidPrice:98 }),
  97.9,
  6_000,
);
assert.equal(structuralInvalid.eventType, 'INVALIDATION');
assert.equal(structuralInvalid.reason, 'STRUCTURE');

const testServer = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  testServer.once('listening', resolve);
  testServer.once('error', reject);
});
try {
  const address = testServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  const config = await fetch(`${base}/api/config`).then(r => r.json());
  assert.equal(config.mode, 'V6_5_PULLBACK_RADAR');
  assert.deepEqual(
    config.eventTypes.filter(x => ['PULLBACK','DEEP_PULLBACK','INVALIDATION'].includes(x)),
    ['PULLBACK','DEEP_PULLBACK','INVALIDATION'],
  );
  assert.equal(config.pullback.exactOpenRequired, true);
  const html = await fetch(`${base}/`).then(r => r.text());
  assert.match(html, /自動回踩通知/);
  assert.match(html, /testPullback/);
  const client = await fetch(`${base}/app.js`).then(r => r.text());
  assert.match(client, /<b>回踩<\/b>/);
  assert.doesNotMatch(client, /↩ 回踩雷達/);
  assert.match(client, /tradingview:\/\/chart/);
  assert.match(client, /launchTvFromNotification/);
  const pushTest = await fetch(`${base}/api/test-pullback-push`, {
    method:'POST', headers:{ 'content-type':'application/json' }, body:'{}',
  });
  assert.equal(pushTest.status, 200);
  assert.equal((await pushTest.json()).ok, true);
} finally {
  await new Promise(resolve => testServer.close(resolve));
}

console.log('V6.5 unit checks PASS');
