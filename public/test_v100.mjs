import assert from 'node:assert/strict';
import { performanceAggregate, performanceCalibration, realtimeSocketUrl, technicalSnapshot, testWeightedProgress, testStrategyPlaybooks, testMonitorPriority } from './server.js';
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

assert.equal(testWeightedProgress([{ok:true,weight:60},{ok:false,weight:40}]),60);
const p1=testMonitorPriority({status:'WAIT_PULLBACK',observationProgress:90,qualityScore:85,rank:6,setup:{backtest:{}},idea:{estimatedWinRate:60}} ,65);
const p2=testMonitorPriority({status:'WAIT_PULLBACK',observationProgress:55,qualityScore:90,rank:1,setup:{backtest:{}},idea:{estimatedWinRate:70}} ,72);
assert.ok(p1>p2,'completion should dominate observation ranking');

const pbRows=Array.from({length:80},(_,i)=>({open:100+i*.1,high:100.4+i*.1,low:99.7+i*.1,close:100.2+i*.1,volume:1200,openTime:i*300000,closeTime:(i+1)*300000-1}));
const pb=testStrategyPlaybooks({direction:'LONG'},{rows5:pbRows,last:pbRows.at(-1),prev:pbRows.at(-2),setup:{atr5:1,zoneLow:107,zoneHigh:108,zoneMid:107.5,invalidation:106.2},dir:1,t5:{trend:1,momentum:1,volumeRatio:1.3,atr14:1},t15:{trend:1,adx14:30,diBias:1,volumeRatio:1.2},t30:{trend:1},t1h:{trend:1},market:{regime:'TREND_UP',dir:1},derivDir:1,topDir:1,depthDir:1,oiVal:1.5,zoneTouch:false,reclaim:true,candleOk:true,wicker:false,sweep:false,momentum:true,macdImprove:true,spreadOk:true,chaseAtr:.1,h1Opposed:false,t30Opposed:false,adlRisk:'low',fundingCrowded:false,baseScore:84});
assert.equal(pb.candidates.length,5);assert.ok(pb.candidates.some(x=>x.id==='BREAKOUT_RETEST'));assert.ok(pb.candidates.some(x=>x.id==='LIQUIDITY_SWEEP'));assert.ok(pb.candidates.some(x=>x.id==='MOMENTUM_CONTINUATION'));assert.ok(pb.candidates.some(x=>x.id==='RANGE_EXTREME'));

console.log('V10.1 multi-playbook tests passed');
