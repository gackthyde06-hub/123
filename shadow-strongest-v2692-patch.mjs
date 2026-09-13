import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'STRONGEST_BOOK_V2692';

const FN = `
function applyStrongestBookV2692(t, institutional){
  const edge = institutional && typeof institutional === 'object' ? institutional : {};
  const L = String(edge.strategyLabel || t?.strategyLabel || t?.playbookLabel || '');
  const ev = t?.monitorEvidence || t?.lastCheck || {};
  const st = String(t?.structureV2?.state || t?.structure?.state || '').toUpperCase();
  const health = Number(t?.structureV2?.health ?? t?.structure?.health ?? 0);
  const reasons = Array.isArray(edge.hardBlockReasons) ? edge.hardBlockReasons.slice() : [];
  const sweep = L.includes('流動性掃盤');
  const pull = L.includes('順勢回踩');
  let capA = !!edge.capA, hardBlock = !!edge.hardBlock, adj = Number(edge.learningAdjustment || 0);
  let score = Number(edge.edgeScore || 0);
  if (!(sweep || pull)) {
    capA = true; hardBlock = true; adj = Math.min(adj, -4);
    const why = '最強書：只保留掃盤／回踩';
    if (!reasons.includes(why)) reasons.push(why);
  } else {
    if (ev.adverseMarket) { hardBlock = true; capA = true; reasons.push('最強書：大盤逆向'); }
    if (ev.adverse1h) { capA = true; reasons.push('最強書：1H逆向不升A'); }
    if (st === 'DESTROYED' || st === 'DAMAGED') { capA = true; reasons.push('最強書：結構未完整'); }
    if (sweep && (st === 'INTACT' || st === 'RECLAIMING') && health >= 60) { adj = Math.max(adj, 2); score += 4; }
    if (pull && st === 'INTACT' && health >= 70 && !ev.adverse1h) { adj = Math.max(adj, 1); score += 2; }
    if (Number(t?.calibratedWinRate || 0) > 0 && Number(t.calibratedWinRate) < 52) { capA = true; reasons.push('最強書：校準勝率偏薄'); }
  }
  if (hardBlock) capA = true;
  return Object.assign({}, edge, {
    capA, hardBlock, hardBlockReasons: reasons,
    learningAdjustment: adj,
    edgeScore: Math.max(0, Math.min(100, Math.round(score))),
    liveShadowPolicy: 'V2.6.92',
    strongestBook: sweep ? 'SWEEP' : pull ? 'PULLBACK' : 'BLOCKED'
  });
}
`;

export function applyStrongestBookV2692Patch(){
  const file = path.join(ROOT, 'server.js');
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARKER) && s.includes('applyStrongestBookV2692(')) return { changed:false, reason:'already' };
  if (!s.includes('function applyStrongestBookV2692')) {
    const anchor = s.includes('function applyLiveShadowPolicyV2690') ? 'function applyLiveShadowPolicyV2690' : 'function institutionalMentorEdgeV2622(t){';
    if (!s.includes(anchor === 'function applyLiveShadowPolicyV2690' ? 'function applyLiveShadowPolicyV2690' : 'function institutionalMentorEdgeV2622(t){')) {
      throw new Error('anchor missing');
    }
    if (anchor === 'function applyLiveShadowPolicyV2690') s = s.replace('function applyLiveShadowPolicyV2690', FN + 'function applyLiveShadowPolicyV2690');
    else s = s.replace('function institutionalMentorEdgeV2622(t){', FN + 'function institutionalMentorEdgeV2622(t){');
  }
  const old = 'const institutional=institutionalMentorEdgeV2622(t);';
  const neu = 'const institutional=applyStrongestBookV2692(t, applyLiveShadowPolicyV2690(institutionalMentorEdgeV2622(t), institutionalMentorEdgeV2622(t).strategyLabel));';
  // cheaper: wrap once
  const neu2 = 'const _mentor=institutionalMentorEdgeV2622(t); const institutional=applyStrongestBookV2692(t, applyLiveShadowPolicyV2690(_mentor, _mentor.strategyLabel));';
  if (!s.includes('applyStrongestBookV2692(t,')) {
    if (!s.includes(old)) throw new Error('institutional assign missing');
    s = s.replace(old, neu2);
  }
  if (!s.includes(MARKER)) s = '// ' + MARKER + '\n' + s;
  fs.writeFileSync(file, s);
  return { changed:true, version:'V2.6.92' };
}
