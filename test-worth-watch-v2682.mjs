import assert from 'node:assert/strict';
import {evaluateWorthWatchV2682,selectWorthWatchV2682} from './worth-watch-v2682-core.mjs';

function row(o={}){
  return {
    candidate:true,candidateBand:'WATCH',candidateScore:72,candidateWinRate:56,rank:8,rankScore:68,
    trackerStatus:'WATCHING',freshnessAgeMs:45_000,observationProgress:88,monitorState:'WATCHING',chaseAtr:.18,
    dataHealth:{coverage:84,confidence:80},structure:{state:'INTACT',health:91,confidence:92},entry:{rr:1.6},
    marketRegime:'TREND',strategyLabel:'突破回踩',blockers:[],candidateHardBlockers:[],candidateSoftWait:['策略尚未ready'],risks:[],trade:null,
    symbol:'BTCUSDT',direction:'LONG',...o
  };
}
function boot(o={}){return {support:12,netExpectancyR:.02,netProfitFactor:1.02,strengthFailureRisk:.18,...o}}
function ok(name,r,b=boot()){const d=evaluateWorthWatchV2682(r,b);assert.equal(d.eligible,true,`${name}: ${d.blockers.join(' | ')}`);return d}
function no(name,r,b=boot(),pat=null){const d=evaluateWorthWatchV2682(r,b);assert.equal(d.eligible,false,`${name}: unexpectedly eligible`);if(pat)assert.ok(d.blockers.some(x=>pat.test(x)),`${name}: blockers=${d.blockers.join(' | ')}`);return d}

ok('healthy WATCH',row());
ok('strategy not ready alone is soft',row({blockers:['策略尚未ready'],candidateSoftWait:['策略尚未ready']}));
no('ADL hard blocker',row({blockers:['ADL高風險'],candidateHardBlockers:['ADL高風險']}),boot(),/硬/);
no('destroyed structure',row({structure:{state:'DESTROYED',health:96,confidence:95}}),boot(),/結構/);
no('damaged structure',row({structure:{state:'DAMAGED',health:94,confidence:95}}),boot(),/結構/);
no('stale',row({freshnessAgeMs:181_000}),boot(),/3分鐘/);
no('too far chase',row({chaseAtr:.46}),boot(),/ATR/);
no('negative bootcamp with support',row(),boot({support:10,netExpectancyR:-.20,netProfitFactor:1}),/淨期望/);
ok('negative bootcamp ignored when insufficient support',row(),boot({support:5,netExpectancyR:-.30,netProfitFactor:.40}));
no('liquidity sweep intact',row({strategyLabel:'流動性掃盤反轉'}),boot(),/收復證據/);
ok('liquidity sweep reclaiming',row({strategyLabel:'流動性掃盤反轉',structure:{state:'RECLAIMING',health:84,confidence:92}}));
const relative=ok('relative strict fallback',row({candidateBand:'RELATIVE',candidateScore:66,candidateWinRate:57,rank:7,rankScore:80,observationProgress:95,chaseAtr:.15,dataHealth:{coverage:90,confidence:88},structure:{state:'INTACT',health:97,confidence:96},entry:{rr:1.8}}));
assert.equal(relative.mode,'RELATIVE_FALLBACK');
no('weak relative not promoted',row({candidateBand:'RELATIVE',candidateScore:55,candidateWinRate:54,rank:10,rankScore:70,observationProgress:90,chaseAtr:.20,structure:{state:'INTACT',health:94,confidence:94}}),boot(),/相對品質/);

const items=[
  {row:row({symbol:'AUSDT',candidateBand:'WATCH',candidateScore:80}),decision:ok('sel A',row({symbol:'AUSDT',candidateBand:'WATCH',candidateScore:80}))},
  {row:row({symbol:'BUSDT',candidateBand:'PRIME',candidateScore:75}),decision:ok('sel B',row({symbol:'BUSDT',candidateBand:'PRIME',candidateScore:75}))},
  {row:row({symbol:'CUSDT',candidateBand:'WATCH',candidateScore:70}),decision:ok('sel C',row({symbol:'CUSDT',candidateBand:'WATCH',candidateScore:70}))},
  {row:row({symbol:'DUSDT',candidateBand:'RELATIVE',candidateScore:66,candidateWinRate:57,rank:7,rankScore:80,observationProgress:95,chaseAtr:.15,dataHealth:{coverage:90,confidence:88},structure:{state:'INTACT',health:97,confidence:96},entry:{rr:1.8}}),decision:ok('sel D',row({symbol:'DUSDT',candidateBand:'RELATIVE',candidateScore:66,candidateWinRate:57,rank:7,rankScore:80,observationProgress:95,chaseAtr:.15,dataHealth:{coverage:90,confidence:88},structure:{state:'INTACT',health:97,confidence:96},entry:{rr:1.8}}))},
  {row:row({symbol:'EUSDT',candidateBand:'RELATIVE',candidateScore:67,candidateWinRate:58,rank:6,rankScore:81,observationProgress:96,chaseAtr:.14,dataHealth:{coverage:91,confidence:89},structure:{state:'INTACT',health:98,confidence:96},entry:{rr:1.9}}),decision:ok('sel E',row({symbol:'EUSDT',candidateBand:'RELATIVE',candidateScore:67,candidateWinRate:58,rank:6,rankScore:81,observationProgress:96,chaseAtr:.14,dataHealth:{coverage:91,confidence:89},structure:{state:'INTACT',health:98,confidence:96},entry:{rr:1.9}}))},
];
let selected=selectWorthWatchV2682(items,{max:3});
assert.equal(selected.length,3);
assert.ok(selected.every(x=>x.decision.mode==='PRIMARY'),'primary must outrank fallback when >=3 primary exist');
const twoPrimary=items.filter((_,i)=>[0,1,3,4].includes(i));
selected=selectWorthWatchV2682(twoPrimary,{max:3});
assert.equal(selected.length,3);
assert.equal(selected.filter(x=>x.decision.mode==='RELATIVE_FALLBACK').length,1,'max one relative fallback');
console.log('PASS worth-watch-v2682 core unit tests');
