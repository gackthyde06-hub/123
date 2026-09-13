/* LIVE_SHADOW_POLICY_V2690
 * Ranked from production shadow CSV 2026-09-14 (~6680 rows).
 * TIMEOUT is not a win. Structure-learning hitRate is not trade expectancy.
 */
export const LIVE_SHADOW_POLICY_VERSION = 'V2.6.90';

const RULES = [
  { test: /\u7a81\u7834\u56de\u6e2c/, capA: true, hardBlock: true, adjMax: -3, reason: '\u5373\u6642\u5f71\u5b50\uff1a\u7a81\u7834\u56de\u6e2c 1153\u7b46 avgR -0.024\uff0c\u7981\u6b62\u7576 A / \u9ad8\u52dd\u7387\u901a\u77e5' },
  { test: /\u52d5\u80fd/, capA: true, hardBlock: false, adjMax: 0, reason: '\u5373\u6642\u5f71\u5b50\uff1a\u52d5\u80fd\u7e8c\u653b\u671f\u671b\u504f\u8584\uff0c\u9650\u5236 A' },
  { test: /\u6d41\u52d5\u6027\u6383\u76e4/, capA: false, hardBlock: false, adjMin: 1, reason: '\u5373\u6642\u5f71\u5b50\uff1a\u6383\u76e4\u53cd\u8f49\u76f8\u5c0d\u6700\u7a69' },
  { test: /\u9806\u52e2\u56de\u8e29/, capA: false, hardBlock: false, adjMin: 0, reason: '\u5373\u6642\u5f71\u5b50\uff1a\u9806\u52e2\u56de\u8e29\u4fdd\u7559\u5019\u9078' }
];

export function applyLiveShadowPolicyV2690(edge = {}, label = '') {
  const L = String(label || edge.strategyLabel || '');
  const reasons = Array.isArray(edge.hardBlockReasons) ? edge.hardBlockReasons.slice() : [];
  let capA = !!edge.capA;
  let hardBlock = !!edge.hardBlock;
  let adj = Number(edge.learningAdjustment || 0);
  for (const rule of RULES) {
    if (!rule.test.test(L)) continue;
    if (rule.capA) capA = true;
    if (rule.hardBlock) hardBlock = true;
    if (Number.isFinite(rule.adjMax)) adj = Math.min(adj, rule.adjMax);
    if (Number.isFinite(rule.adjMin)) adj = Math.max(adj, rule.adjMin);
    if (!reasons.includes(rule.reason)) reasons.push(rule.reason);
  }
  if (hardBlock) capA = true;
  return {
    ...edge,
    capA,
    hardBlock,
    hardBlockReasons: reasons,
    learningAdjustment: adj,
    liveShadowPolicy: LIVE_SHADOW_POLICY_VERSION
  };
}
