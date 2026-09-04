import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_HEADER_LAYOUT_V2674_20260904';

const CSS=String.raw`
/* CANDIDATE_HEADER_LAYOUT_V2674_20260904 */

/* 候選標題區：文字永遠先排版，再放控制項；禁止文字壓到按鈕/邊框 */
.mw-candidate-group-v2664{
  overflow:hidden!important;
}

.mw-candidate-group-v2664>.candidate-group-summary-v2673{
  display:grid!important;
  grid-template-columns:104px minmax(0,1fr) 46px 24px!important;
  column-gap:16px!important;
  row-gap:0!important;
  align-items:center!important;

  width:100%!important;
  max-width:100%!important;
  min-height:156px!important;
  box-sizing:border-box!important;
  padding:22px 22px!important;
  overflow:hidden!important;
}

/* 左：候選 + 數量 */
.mw-candidate-group-v2664 .candidate-group-title-v2667{
  min-width:0!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  gap:10px!important;
  margin:0!important;
  text-align:center!important;
  white-space:normal!important;
}
.mw-candidate-group-v2664 .candidate-group-title-v2667 b{
  margin:0!important;
  font-size:22px!important;
  line-height:1.3!important;
  text-align:center!important;
  white-space:normal!important;
}
.mw-candidate-group-v2664 .candidate-group-title-v2667 span{
  flex:0 0 auto!important;
  display:grid!important;
  place-items:center!important;
  min-width:38px!important;
  width:38px!important;
  height:38px!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  line-height:1!important;
  text-align:center!important;
}

/* 中：標題 + 兩行資料 */
.mw-candidate-group-v2664 .candidate-group-copy-v2673{
  min-width:0!important;
  width:100%!important;
  max-width:100%!important;
  margin:0!important;
  padding:0!important;

  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:10px!important;

  text-align:center!important;
  overflow:visible!important;
}

.mw-candidate-group-v2664 .candidate-group-copy-v2673 strong{
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  margin:0!important;
  padding:0 8px!important;
  box-sizing:border-box!important;

  font-size:21px!important;
  line-height:1.38!important;
  text-align:center!important;
  white-space:normal!important;
  overflow:visible!important;
  text-overflow:clip!important;
  overflow-wrap:break-word!important;
  word-break:normal!important;
}

/* 清掉舊版造成的膠囊/框線，兩行純文字置中 */
.mw-candidate-group-v2664 .candidate-group-copy-v2673 small{
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:8px!important;

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

.mw-candidate-group-v2664 .candidate-group-copy-v2673 small span{
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:0 6px!important;
  box-sizing:border-box!important;

  border:0!important;
  outline:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;

  font-size:16px!important;
  font-weight:650!important;
  line-height:1.55!important;
  text-align:center!important;
  white-space:normal!important;
  overflow:visible!important;
  text-overflow:clip!important;
  overflow-wrap:break-word!important;
  word-break:normal!important;
}

/* 右：重新整理固定獨立欄，不允許文字侵入 */
.mw-candidate-group-v2664 .candidate-refresh-v2673{
  position:static!important;
  transform:none!important;

  justify-self:center!important;
  align-self:center!important;

  width:42px!important;
  min-width:42px!important;
  height:42px!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;

  display:grid!important;
  place-items:center!important;
  overflow:hidden!important;
}

/* 最右展開箭頭獨立欄 */
.mw-candidate-group-v2664>.candidate-group-summary-v2673>i{
  position:static!important;
  transform:none!important;
  justify-self:center!important;
  align-self:center!important;
  margin:0!important;
  padding:0!important;
  width:20px!important;
  min-width:20px!important;
  text-align:center!important;
}

/* 手機：空間不足就自然換第二行，不縮字、不重疊 */
@media(max-width:700px){
  .mw-candidate-group-v2664>.candidate-group-summary-v2673{
    grid-template-columns:84px minmax(0,1fr) 40px 18px!important;
    column-gap:10px!important;
    min-height:148px!important;
    padding:18px 14px!important;
  }

  .mw-candidate-group-v2664 .candidate-group-title-v2667{
    gap:7px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-title-v2667 b{
    font-size:19px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-title-v2667 span{
    min-width:34px!important;
    width:34px!important;
    height:34px!important;
    font-size:15px!important;
  }

  .mw-candidate-group-v2664 .candidate-group-copy-v2673{
    gap:8px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 strong{
    font-size:17px!important;
    line-height:1.45!important;
    padding:0 4px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 small{
    gap:6px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 small span{
    font-size:14px!important;
    line-height:1.5!important;
    padding:0 3px!important;
  }

  .mw-candidate-group-v2664 .candidate-refresh-v2673{
    width:38px!important;
    min-width:38px!important;
    height:38px!important;
  }
}

@media(max-width:430px){
  /* 很窄時改成三列，控制項永遠不和文字搶空間 */
  .mw-candidate-group-v2664>.candidate-group-summary-v2673{
    grid-template-columns:1fr 44px 20px!important;
    grid-template-areas:
      "title refresh chev"
      "copy copy copy"!important;
    row-gap:14px!important;
    min-height:0!important;
    padding:16px 14px 18px!important;
  }

  .mw-candidate-group-v2664 .candidate-group-title-v2667{
    grid-area:title!important;
    justify-content:flex-start!important;
    text-align:left!important;
  }

  .mw-candidate-group-v2664 .candidate-group-copy-v2673{
    grid-area:copy!important;
    width:100%!important;
  }

  .mw-candidate-group-v2664 .candidate-refresh-v2673{
    grid-area:refresh!important;
  }

  .mw-candidate-group-v2664>.candidate-group-summary-v2673>i{
    grid-area:chev!important;
  }

  .mw-candidate-group-v2664 .candidate-group-copy-v2673 strong,
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 small span{
    text-align:center!important;
  }
}
`;

export function patchCandidateHeaderLayoutV2674(){
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(cssPath))throw new Error('[v2674] candidate CSS missing');

  let css=fs.readFileSync(cssPath,'utf8');
  if(!css.includes(MARKER)){
    css+='\n'+CSS+'\n';
    fs.writeFileSync(cssPath,css,'utf8');
  }

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2674-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }

  return {
    changed:true,
    version:'V2.6.74',
    centered:true,
    noOverlap:true,
    twoLineStats:true,
    refreshIsolated:true,
    responsiveStack:true
  };
}

if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateHeaderLayoutV2674());
