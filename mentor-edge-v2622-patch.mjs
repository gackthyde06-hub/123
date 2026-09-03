import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='INSTITUTIONAL_MENTOR_EDGE_V2622';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2622-edge] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2622-edge] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const ext=path.extname(f)||'.tmp',tmp=`${f}.v2622-${process.pid}-${Date.now()}${ext}`;fs.writeFileSync(tmp,a,'utf8');try{if(ext==='.js'||ext==='.mjs')check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function range(s,a,b,repl,label){const i=s.indexOf(a),j=i>=0?s.indexOf(b,i+a.length):-1;if(i<0||j<0)throw new Error(`[v2622-edge] ${label} anchor missing`);return s.slice(0,i)+repl+s.slice(j)}
function patchServer(){
 const f=must('server.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return{changed:false,reason:'already'};if(!s.includes('INSTITUTIONAL_SHADOW_EDGE_V2621'))throw new Error('[v2622-edge] V2621 institutional layer missing');const helper=fs.readFileSync(must('mentor-edge-v2622-code.inc'),'utf8').trimEnd()+'\n\n';
 const stateStart='function stateLearningAdjustment(t){',stateEnd='function stateLearningTable(limit=24)';const state=`${helper}function stateLearningAdjustment(t){
  const features=stateLearningFeatures(t),actualEvidence=actualStateEvidence(features),institutionalEdge=institutionalMentorEdgeV2622(t),shadowAdjustment=Number(institutionalEdge.learningAdjustment||0),adjustment=clamp(shadowAdjustment+Number(actualEvidence.adjustment||0),-STATE_LEARNING_MAX_BONUS,STATE_LEARNING_MAX_BONUS);
  return {adjustment,shadowAdjustment,actualAdjustment:Number(actualEvidence.adjustment||0),actualEvidence,level:institutionalEdge.level,key:null,features,stats:{sample:institutionalEdge.sample,hitRate:institutionalEdge.stats?.hitRate??null,profitFactor:institutionalEdge.stats?.netProfitFactor??null,expectancyR:institutionalEdge.stats?.netExpectancyR??null},active:institutionalEdge.sample>=SHADOW_EDGE_MIN_SAMPLE_V2621,crossAsset:false,institutionalEdge};
}\n`;
 s=range(s,stateStart,stateEnd,state,'state learning');
 s=s.replace("const institutional=institutionalEdgeV2621(t);","const institutional=institutionalMentorEdgeV2622(t);");
 s=s.replace("institutional=institutionalEdgeV2621(t),blockers=","institutional=institutionalMentorEdgeV2622(t),blockers=");
 s=s.replace("mentor=institutionalEdgeV2621(t),grade=","mentor=institutionalMentorEdgeV2622(t),grade=");
 s=s.replace("const assetClass=assetClassForSymbolV2612(t?.symbol),all=edgeRowsV2621()", "const assetClass=mentorAssetForTrackerV2622(t),all=edgeRowsV2621()");
 s=s.replaceAll('edgeAssetV2621(x)===assetClass','mentorAssetV2622(x)===assetClass');
 // Enrich manual rows without changing the A/B notification settings or the execution form.
 const old="institutionalEdge:{version:institutional.version,score:institutional.edgeScore,level:institutional.level,sample:institutional.sample,costRatio:institutional.cost?.ratio??null,costGateA:institutional.costGateA,costGateB:institutional.costGateB,capA:institutional.capA,hardBlock:institutional.hardBlock,strategyStats:institutional.strategyStats}";
 const neu="institutionalEdge:{version:institutional.version,score:institutional.edgeScore,confidence:institutional.confidenceScore,level:institutional.level,sample:institutional.sample,netProfitFactor:institutional.stats?.netProfitFactor??null,netExpectancyR:institutional.stats?.netExpectancyR??null,wilsonLow:institutional.stats?.wilsonLow??null,costRatio:institutional.cost?.ratio??null,costGateA:institutional.costGateA,costGateB:institutional.costGateB,capA:institutional.capA,hardBlock:institutional.hardBlock,watchEligible:institutional.watchEligible,stability:{score:institutional.stability?.score,positiveFolds:institutional.stability?.positiveFolds,totalFolds:institutional.stability?.totalFolds},concentration:{score:institutional.concentration?.score,top2Share:institutional.concentration?.top2Share,topSymbols:institutional.concentration?.topSymbols},forward:{sample:institutional.forward?.sample,status:institutional.forward?.status,target:institutional.forward?.target,netProfitFactor:institutional.forward?.stats?.netProfitFactor,netExpectancyR:institutional.forward?.stats?.netExpectancyR},strategyStats:institutional.strategyStats}";
 if(s.includes(old))s=s.replace(old,neu);else console.warn('[v2622-edge] manual edge return already evolved');
 // Stamp both regular Shadow and ABC Shadow records with the mentor generation and robust edge snapshot.
 s=s.replace("const features=stateLearningFeatures(t),keys=stateLearningKeys(features),learning=stateLearningAdjustment(t),now=new Date().toISOString()", "const features=stateLearningFeatures(t),keys=stateLearningKeys(features),learning=stateLearningAdjustment(t),mentor=institutionalMentorEdgeV2622(t),now=new Date().toISOString()");
 s=s.replace("learningAdjustmentAtEntry:Number(learning.adjustment||0),tierAtEntry:","learningAdjustmentAtEntry:Number(learning.adjustment||0),mentorModelVersion:SHADOW_MENTOR_VERSION_V2622,institutionalEdgeAtEntry:Number(mentor?.edgeScore||0),mentorConfidenceAtEntry:Number(mentor?.confidenceScore||0),mentorForwardStatusAtEntry:String(mentor?.forward?.status||'COLLECTING'),tierAtEntry:");
 s=s.replaceAll('mentorModelVersion:SHADOW_EDGE_VERSION_V2621','mentorModelVersion:SHADOW_MENTOR_VERSION_V2622');
 // Harden ABC capture: ensure the mentor snapshot variable exists even if an older fixture/source skipped the V2621 insertion anchor.
 {const a=s.indexOf('function abcShadowCapture(rows){'),b=a>=0?s.indexOf('async function manualOpportunityLoop',a):-1;if(a>=0){const end=b>a?b:Math.min(s.length,a+12000),blk=s.slice(a,end);if(blk.includes('institutionalEdgeAtEntry:Number(mentor')&&!/mentor=institutional(?:Mentor)?EdgeV2622\(t\)/.test(blk)){const next=blk.replace(/(const features=stateLearningFeatures\(t\),[^;]*?learning=stateLearningAdjustment\(t\),)(grade=)/,'$1mentor=institutionalMentorEdgeV2622(t),$2');if(next!==blk)s=s.slice(0,a)+next+s.slice(end)}}}
 s=s.replace("institutionalEdgeAtEntry:Number(mentor.edgeScore||0),costRatioAtEntry:","institutionalEdgeAtEntry:Number(mentor.edgeScore||0),mentorConfidenceAtEntry:Number(mentor.confidenceScore||0),mentorForwardStatusAtEntry:String(mentor.forward?.status||\'COLLECTING\'),costRatioAtEntry:");
 s=s.replace("'strategyNetExpRAtEntry']","'strategyNetExpRAtEntry','mentorConfidenceAtEntry','mentorForwardStatusAtEntry']");
 // Read-only mentor diagnostics for the new UI. No settings, keys, push endpoints, or Railway secrets are returned.
 const endpoint="app.get('/api/shadow-mentor',(_req,res)=>{try{res.set('cache-control','private, max-age=10');res.json(mentorTrainingSummaryV2622())}catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}});\n\n";
 if(!s.includes("app.get('/api/shadow-mentor'")){const anchors=["app.get('/healthz'","if (process.env.UNIT_TEST !== '1')","export {"];let i=-1;for(const anchor of anchors){i=s.indexOf(anchor);if(i>=0)break}if(i<0)i=s.length;s=s.slice(0,i)+endpoint+s.slice(i)}
 s=`// ${MARKER}\n${s}`;return{changed:save(f,before,s)}
}
export function patchMentorEdgeV2622(){return patchServer()}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchMentorEdgeV2622());
