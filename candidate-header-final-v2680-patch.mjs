import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_HEADER_FINAL_V2680_20260904';

const CSS=String.raw`
/* CANDIDATE_HEADER_FINAL_V2680_20260904 */
/* Runs after V2676. Actual DOM is: title | pipeline | refresh | chevron. Keep it one compact row. */
.mw-candidate-group-v2664>summary.candidate-compact-v2676{
  position:relative!important;
  display:grid!important;
  grid-template-columns:auto minmax(0,1fr) 30px 14px!important;
  grid-template-areas:"title pipeline refresh chev"!important;
  column-gap:8px!important;
  row-gap:0!important;
  align-items:center!important;
  width:100%!important;
  max-width:100%!important;
  min-height:48px!important;
  height:auto!important;
  margin:0!important;
  padding:7px 10px!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667{
  grid-area:title!important;
  min-width:0!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:6px!important;
  width:auto!important;
  margin:0!important;
  padding:0!important;
  white-space:nowrap!important;
  text-align:left!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 b{
  margin:0!important;
  font-size:17px!important;
  line-height:1.15!important;
  text-align:left!important;
  white-space:nowrap!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 span{
  display:grid!important;
  place-items:center!important;
  width:29px!important;
  min-width:29px!important;
  height:29px!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  font-size:12px!important;
  line-height:1!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-pipeline-v2676{
  grid-area:pipeline!important;
  display:block!important;
  min-width:0!important;
  width:100%!important;
  max-width:100%!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  border:0!important;
  background:transparent!important;
  box-shadow:none!important;
  color:#98a4aa!important;
  font-size:12px!important;
  font-weight:600!important;
  line-height:1.2!important;
  text-align:center!important;
  white-space:nowrap!important;
  word-break:keep-all!important;
  overflow:hidden!important;
  text-overflow:clip!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-refresh-v2673{
  grid-area:refresh!important;
  position:static!important;
  transform:none!important;
  justify-self:end!important;
  align-self:center!important;
  display:grid!important;
  place-items:center!important;
  width:30px!important;
  min-width:30px!important;
  max-width:30px!important;
  height:30px!important;
  min-height:30px!important;
  max-height:30px!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676>i{
  grid-area:chev!important;
  position:static!important;
  transform:none!important;
  justify-self:end!important;
  align-self:center!important;
  display:grid!important;
  place-items:center!important;
  width:14px!important;
  min-width:14px!important;
  height:18px!important;
  margin:0!important;
  padding:0!important;
  text-align:center!important;
}
@media(max-width:430px){
  .mw-candidate-group-v2664>summary.candidate-compact-v2676{
    grid-template-columns:auto minmax(0,1fr) 29px 13px!important;
    grid-template-areas:"title pipeline refresh chev"!important;
    column-gap:6px!important;
    min-height:46px!important;
    padding:6px 9px!important;
  }
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667{gap:5px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 b{font-size:16px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 span{width:27px!important;min-width:27px!important;height:27px!important;font-size:11px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-pipeline-v2676{font-size:11.2px!important;line-height:1.15!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-refresh-v2673{width:29px!important;min-width:29px!important;max-width:29px!important;height:29px!important;min-height:29px!important;max-height:29px!important}
}
@media(max-width:360px){
  .mw-candidate-group-v2664>summary.candidate-compact-v2676{column-gap:5px!important;padding-left:8px!important;padding-right:8px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 b{font-size:15px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 span{width:25px!important;min-width:25px!important;height:25px!important;font-size:10.5px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-pipeline-v2676{font-size:9px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-refresh-v2673{width:27px!important;min-width:27px!important;max-width:27px!important;height:27px!important;min-height:27px!important;max-height:27px!important}
}
`

export function patchCandidateHeaderFinalV2680(){
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  const jsPath=path.join(__dirname,'public','manual-candidate-v2664.js');
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(cssPath))throw new Error('[v2680] candidate CSS missing');
  if(!fs.existsSync(jsPath))throw new Error('[v2680] candidate runtime missing');

  const runtime=fs.readFileSync(jsPath,'utf8');
  for(const needle of ['candidate-compact-v2676','candidate-pipeline-v2676','CANDIDATE_NARRATIVE_LAYOUT_V2676_20260904']){
    if(!runtime.includes(needle))throw new Error('[v2680] current candidate DOM prerequisite missing: '+needle);
  }

  let css=fs.readFileSync(cssPath,'utf8');
  if(!css.includes(MARKER)){
    css+='\n'+CSS.trim()+'\n';
    fs.writeFileSync(cssPath,css,'utf8');
  }

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2680-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }

  const out=fs.readFileSync(cssPath,'utf8');
  for(const needle of [MARKER,'grid-area:pipeline!important','grid-template-areas:"title pipeline refresh chev"','candidate-pipeline-v2676','min-height:48px!important']){
    if(!out.includes(needle))throw new Error('[v2680] post verify missing: '+needle);
  }
  return {changed:true,version:'V2.6.80',finalAfterV2676:true,compactSingleRow:true,pipelineCentered:true,refreshRight:true};
}

if(import.meta.url===`file://${process.argv[1]}`){
  try{console.log(patchCandidateHeaderFinalV2680())}catch(e){console.error(e?.stack||e);process.exit(1)}
}
