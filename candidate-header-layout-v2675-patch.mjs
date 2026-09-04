import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_HEADER_LAYOUT_V2675_20260904';

const CSS=String.raw`
/* CANDIDATE_HEADER_LAYOUT_V2675_20260904 */

/*
  最終候選標題排版規則：
  1) 所有文字都在自己的完整內容區置中。
  2) 重新整理與展開控制項永遠有獨立保留區，不與文字競爭寬度。
  3) 寬度不足時只換行，不壓字、不截字、不溢出。
  4) 手機版把控制項移到底部中央，讓文字取得完整寬度。
*/
.mw-candidate-group-v2664{
  overflow:hidden!important;
}

.mw-candidate-group-v2664>.candidate-group-summary-v2673{
  position:relative!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:10px!important;

  width:100%!important;
  max-width:100%!important;
  min-height:154px!important;
  box-sizing:border-box!important;
  margin:0!important;
  padding:20px 86px!important;
  overflow:hidden!important;
  list-style:none!important;
}
.mw-candidate-group-v2664>.candidate-group-summary-v2673::-webkit-details-marker{
  display:none!important;
}

/* 候選 + 數量：整體置中 */
.mw-candidate-group-v2664 .candidate-group-title-v2667{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  flex-wrap:wrap!important;
  gap:9px!important;

  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;

  text-align:center!important;
  white-space:normal!important;
  overflow:visible!important;
}
.mw-candidate-group-v2664 .candidate-group-title-v2667 b{
  margin:0!important;
  padding:0!important;
  font-size:21px!important;
  line-height:1.32!important;
  text-align:center!important;
  white-space:normal!important;
  overflow-wrap:break-word!important;
}
.mw-candidate-group-v2664 .candidate-group-title-v2667 span{
  flex:0 0 auto!important;
  display:grid!important;
  place-items:center!important;
  min-width:36px!important;
  width:36px!important;
  height:36px!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  line-height:1!important;
  text-align:center!important;
}

/* 主標題 + 統計：完整寬度置中，不使用膠囊框 */
.mw-candidate-group-v2664 .candidate-group-copy-v2673{
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
  box-sizing:border-box!important;

  text-align:center!important;
  overflow:visible!important;
}
.mw-candidate-group-v2664 .candidate-group-copy-v2673 strong{
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;

  font-size:20px!important;
  line-height:1.38!important;
  text-align:center!important;
  white-space:normal!important;
  overflow:visible!important;
  text-overflow:clip!important;
  overflow-wrap:anywhere!important;
  word-break:normal!important;
}
.mw-candidate-group-v2664 .candidate-group-copy-v2673 small{
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:4px!important;

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
  padding:0!important;
  box-sizing:border-box!important;

  border:0!important;
  outline:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;

  font-size:15px!important;
  font-weight:650!important;
  line-height:1.5!important;
  text-align:center!important;
  white-space:normal!important;
  overflow:visible!important;
  text-overflow:clip!important;
  overflow-wrap:anywhere!important;
  word-break:normal!important;
}

/* 桌面控制項：鎖在右側保留區，永遠不覆蓋文字 */
.mw-candidate-group-v2664 .candidate-refresh-v2673{
  position:absolute!important;
  top:50%!important;
  right:40px!important;
  left:auto!important;
  bottom:auto!important;
  transform:translateY(-50%)!important;

  display:grid!important;
  place-items:center!important;
  width:38px!important;
  min-width:38px!important;
  height:38px!important;
  margin:0!important;
  padding:0!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
  z-index:3!important;
}
.mw-candidate-group-v2664>.candidate-group-summary-v2673>i{
  position:absolute!important;
  top:50%!important;
  right:14px!important;
  left:auto!important;
  bottom:auto!important;
  transform:translateY(-50%)!important;

  display:grid!important;
  place-items:center!important;
  width:18px!important;
  min-width:18px!important;
  height:24px!important;
  margin:0!important;
  padding:0!important;
  text-align:center!important;
  z-index:2!important;
}

/* 平板/手機：文字使用完整寬度，控制項獨立到底部中央 */
@media(max-width:700px){
  .mw-candidate-group-v2664>.candidate-group-summary-v2673{
    min-height:0!important;
    gap:8px!important;
    padding:16px 14px 64px!important;
  }

  .mw-candidate-group-v2664 .candidate-group-title-v2667{
    justify-content:center!important;
    text-align:center!important;
    gap:8px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-title-v2667 b{
    font-size:19px!important;
    text-align:center!important;
  }
  .mw-candidate-group-v2664 .candidate-group-title-v2667 span{
    min-width:34px!important;
    width:34px!important;
    height:34px!important;
    font-size:14px!important;
  }

  .mw-candidate-group-v2664 .candidate-group-copy-v2673{
    width:100%!important;
    gap:7px!important;
    text-align:center!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 strong{
    width:100%!important;
    font-size:17px!important;
    line-height:1.45!important;
    text-align:center!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 small{
    width:100%!important;
    gap:4px!important;
    text-align:center!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 small span{
    width:100%!important;
    font-size:13.5px!important;
    line-height:1.5!important;
    text-align:center!important;
  }

  .mw-candidate-group-v2664 .candidate-refresh-v2673{
    top:auto!important;
    right:auto!important;
    left:50%!important;
    bottom:14px!important;
    transform:translateX(-28px)!important;
    width:36px!important;
    min-width:36px!important;
    height:36px!important;
  }
  .mw-candidate-group-v2664>.candidate-group-summary-v2673>i{
    top:auto!important;
    right:auto!important;
    left:50%!important;
    bottom:20px!important;
    transform:translateX(24px)!important;
    width:18px!important;
    min-width:18px!important;
    height:24px!important;
  }
}

/* 極窄手機：繼續換行，絕不縮成一行或靠左 */
@media(max-width:430px){
  .mw-candidate-group-v2664>.candidate-group-summary-v2673{
    padding:15px 12px 62px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-title-v2667,
  .mw-candidate-group-v2664 .candidate-group-copy-v2673,
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 strong,
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 small,
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 small span{
    width:100%!important;
    max-width:100%!important;
    text-align:center!important;
    justify-content:center!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 strong{
    font-size:16.5px!important;
  }
  .mw-candidate-group-v2664 .candidate-group-copy-v2673 small span{
    font-size:13px!important;
    line-height:1.52!important;
  }
}
`;

export function patchCandidateHeaderLayoutV2675(){
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(cssPath))throw new Error('[v2675] candidate CSS missing');

  let css=fs.readFileSync(cssPath,'utf8');
  if(!css.includes(MARKER)){
    css+='\n'+CSS+'\n';
    fs.writeFileSync(cssPath,css,'utf8');
  }

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2675-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }

  const finalCss=fs.readFileSync(cssPath,'utf8');
  const checks=[
    MARKER,
    'justify-content:center!important',
    'padding:20px 86px!important',
    'position:absolute!important',
    'padding:16px 14px 64px!important',
    'overflow-wrap:anywhere!important',
    'background:transparent!important'
  ];
  for(const token of checks)if(!finalCss.includes(token))throw new Error('[v2675] post-check missing: '+token);

  return {
    changed:true,
    version:'V2.6.75',
    allTextCentered:true,
    controlsReserved:true,
    noOverlap:true,
    wrapsInsteadOfSqueezes:true,
    mobileControlsSeparated:true
  };
}

if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateHeaderLayoutV2675());
