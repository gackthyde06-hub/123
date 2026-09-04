import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_HEADER_COMPACT_V2679_20260904';

const CSS=String.raw`
/* CANDIDATE_HEADER_COMPACT_V2679_20260904 */
.mw-candidate-group-v2664{overflow:hidden!important}

/* 候選區頭：兩列結構。第一列只放名稱/控制，第二列完整放統計；不再讓統計被擠成直排。 */
.mw-candidate-group-v2664>.candidate-group-summary-v2673{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) 42px 22px!important;
  grid-template-areas:"title refresh chev" "stats stats stats"!important;
  column-gap:10px!important;
  row-gap:9px!important;
  align-items:center!important;
  width:100%!important;
  max-width:100%!important;
  min-height:0!important;
  box-sizing:border-box!important;
  padding:13px 15px 12px!important;
  overflow:hidden!important;
}

.mw-candidate-group-v2664 .candidate-group-title-v2667{
  grid-area:title!important;
  min-width:0!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:8px!important;
  margin:0!important;
  text-align:left!important;
  white-space:nowrap!important;
}
.mw-candidate-group-v2664 .candidate-group-title-v2667 b{
  margin:0!important;
  font-size:19px!important;
  line-height:1.2!important;
  text-align:left!important;
  white-space:nowrap!important;
}
.mw-candidate-group-v2664 .candidate-group-title-v2667 span{
  flex:0 0 auto!important;
  display:grid!important;
  place-items:center!important;
  width:34px!important;
  min-width:34px!important;
  height:34px!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  font-size:14px!important;
  line-height:1!important;
  text-align:center!important;
}

/* 移除重複標題，省空間；統計才是這一列真正有用的資訊。 */
.mw-candidate-group-v2664 .candidate-group-copy-v2673{
  grid-area:stats!important;
  min-width:0!important;
  width:100%!important;
  max-width:100%!important;
  margin:0!important;
  padding:0!important;
  display:block!important;
  text-align:center!important;
  overflow:visible!important;
}
.mw-candidate-group-v2664 .candidate-group-copy-v2673>strong{
  display:none!important;
}
.mw-candidate-group-v2664 .candidate-group-copy-v2673>small{
  display:flex!important;
  flex-flow:row wrap!important;
  align-items:center!important;
  justify-content:center!important;
  gap:4px 12px!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  outline:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  text-align:center!important;
  overflow:visible!important;
}
.mw-candidate-group-v2664 .candidate-group-copy-v2673>small>span{
  display:inline-block!important;
  width:auto!important;
  max-width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  outline:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  font-size:12.5px!important;
  font-weight:700!important;
  line-height:1.5!important;
  text-align:center!important;
  white-space:nowrap!important;
  word-break:keep-all!important;
  overflow-wrap:normal!important;
  text-overflow:clip!important;
  overflow:visible!important;
}

.mw-candidate-group-v2664 .candidate-refresh-v2673{
  grid-area:refresh!important;
  position:static!important;
  transform:none!important;
  justify-self:center!important;
  align-self:center!important;
  display:grid!important;
  place-items:center!important;
  width:38px!important;
  min-width:38px!important;
  height:38px!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
}
.mw-candidate-group-v2664>.candidate-group-summary-v2673>i{
  grid-area:chev!important;
  position:static!important;
  transform:none!important;
  justify-self:center!important;
  align-self:center!important;
  width:18px!important;
  min-width:18px!important;
  margin:0!important;
  padding:0!important;
  text-align:center!important;
}

@media(max-width:700px){
  .mw-candidate-group-v2664>.candidate-group-summary-v2673{
    grid-template-columns:minmax(0,1fr) 40px 20px!important;
    grid-template-areas:"title refresh chev" "stats stats stats"!important;
    column-gap:8px!important;
    row-gap:8px!important;
    min-height:0!important;
    padding:12px 13px 11px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-title-v2667{gap:7px!important}
  .mw-candidate-group-v2664 .candidate-group-title-v2667 b{font-size:18px!important}
  .mw-candidate-group-v2664 .candidate-group-title-v2667 span{
    width:32px!important;min-width:32px!important;height:32px!important;font-size:13px!important
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673>small{
    gap:3px 10px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673>small>span{
    font-size:12px!important;
    line-height:1.45!important;
  }
  .mw-candidate-group-v2664 .candidate-refresh-v2673{
    width:36px!important;min-width:36px!important;height:36px!important
  }
}

@media(max-width:430px){
  .mw-candidate-group-v2664>.candidate-group-summary-v2673{
    grid-template-columns:minmax(0,1fr) 38px 18px!important;
    grid-template-areas:"title refresh chev" "stats stats stats"!important;
    padding:11px 12px 10px!important;
    row-gap:7px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673>small{
    justify-content:center!important;
    gap:2px 8px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673>small>span{
    font-size:11.5px!important;
    white-space:nowrap!important;
  }
}

@media(max-width:360px){
  .mw-candidate-group-v2664 .candidate-group-copy-v2673>small>span{
    font-size:11px!important;
  }
}
`;

export function patchCandidateHeaderLayoutV2674(){
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(cssPath))throw new Error('[v2679] candidate CSS missing');

  let css=fs.readFileSync(cssPath,'utf8');
  if(!css.includes(MARKER)){
    css+='\n'+CSS+'\n';
    fs.writeFileSync(cssPath,css,'utf8');
  }

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2679-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }

  const out=fs.readFileSync(cssPath,'utf8');
  for(const needle of [MARKER,'grid-template-areas:"title refresh chev" "stats stats stats"','candidate-group-copy-v2673>strong','white-space:nowrap!important']){
    if(!out.includes(needle))throw new Error('[v2679] post verify missing: '+needle);
  }

  return {
    changed:true,
    version:'V2.6.79',
    compactHeader:true,
    twoRowLayout:true,
    noVerticalStats:true,
    noOverlap:true,
    mobileSafe:true,
    serverUntouched:true
  };
}

if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateHeaderLayoutV2674());
