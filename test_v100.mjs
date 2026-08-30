import assert from 'node:assert/strict';
import { performanceAggregate, performanceCalibration, realtimeSocketUrl, technicalSnapshot } from './server.js';
const rows=[
  {version:'V10.0',status:'RESOLVED',result:'WIN',realizedR:1,grossReturnPct:1,netReturnPct:.88,mfePct:1.2,maePct:.2,tier:'HIGH',direction:'LONG',marketRegime:'TREND_UP',symbol:'BTCUSDT',calibratedWinRate:65,signalToPushMs:2800,pushServiceMs:120,deliveryLatencyMs:430},
  {version:'V10.0',status:'RESOLVED',result:'LOSS',realizedR:-1,grossReturnPct:-1,netReturnPct:-1.12,mfePct:.1,maePct:1,tier:'HIGH',direction:'LONG',marketRegime:'TREND_UP',symbol:'BTCUSDT',calibratedWinRate:65,signalToPushMs:3100,pushServiceMs:180,deliveryLatencyMs:520},
  {version:'V10.0',status:'RESOLVED',result:'TIMEOUT',realizedR:.2,grossReturnPct:.2,netReturnPct:.08,mfePct:.5,maePct:.3,tier:'NORMAL',direction:'SHORT',marketRegime:'CHOP',symbol:'ETHUSDT',calibratedWinRate:60,signalToPushMs:3500,pushServiceMs:150},
];
const s=performanceAggregate(rows);assert.equal(s.sample,3);assert.equal(s.hitRate,33.3);assert.equal(s.decisiveHitRate,50);assert.equal(s.timeouts,1);assert.equal(s.receivedAcks,2);assert.ok(s.p95DeliveryLatencyMs>=430);
const cal=performanceCalibration(rows);assert.equal(cal.sample,3);assert.equal(cal.actualHitRate,33.3);assert.ok(cal.brierScore>0&&cal.brierScore<1);
const pub=realtimeSocketUrl('public',['BTCUSDT']);assert.match(pub,/\/public\/stream\?streams=/);assert.match(pub,/btcusdt@bookTicker/);assert.match(pub,/depth20@100ms/);
const market=realtimeSocketUrl('market',['BTCUSDT']);assert.match(market,/\/market\/stream\?streams=/);assert.match(market,/!markPrice@arr@1s/);assert.match(market,/btcusdt@aggTrade/);
const candles=Array.from({length:80},(_,i)=>({open:100+i*.1,high:101+i*.1,low:99+i*.1,close:100.5+i*.1,volume:100+i,openTime:i*300000,closeTime:(i+1)*300000-1}));const tech=technicalSnapshot(candles);assert.ok(Number.isFinite(tech.rsi14));assert.ok(Number.isFinite(tech.atr14));
console.log('V10 unit tests passed');
