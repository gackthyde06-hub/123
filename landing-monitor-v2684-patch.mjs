import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'LANDING_TABS_V2686_20260906';

function abs(rel) {
  return path.join(ROOT, rel);
}

const NEW_TABS = '<div class="pageTabs" role="tablist"><!-- '+MARKER+' --><button class="pageTab active" data-page="monitor" type="button">監控</button><button class="pageTab" data-page="ideas" type="button">建議</button><button class="pageTab" data-page="today" type="button">今日</button><button class="pageTab" data-page="flow" type="button">流向</button><button class="pageTab" data-page="performance" type="button">績效</button><button class="pageTab" data-page="test" type="button">觀察</button></div>';

function patchIndex(src) {
  let out = src;
  out = out.replace(/<div class="pageTabs" role="tablist">[\s\S]*?<\/div>/, NEW_TABS);
  out = out.replace('<section id="page-today" class="page active">', '<section id="page-today" class="page">');
  out = out.replace('<section id="page-monitor" class="page">', '<section id="page-monitor" class="page active">');
  if (!out.includes('ideas-rescue-v2686.js')) {
    out = out.replace('</body>', '<script src="/ideas-rescue-v2686.js?v=2686"></script>\n</body>');
  }
  return out;
}

function patchApp(src) {
  let out = src;
  out = out.replaceAll('position-alert-page-v78', 'position-alert-page-v80');
  out = out.replaceAll('position-alert-page-v79', 'position-alert-page-v80');
  out = out.replace("if(!valid.includes(name))name='today';", "if(!valid.includes(name))name='monitor';");
  out = out.replace("||'today')}catch{setPage('today')}", "||'monitor')}catch{setPage('monitor')}");
  return out;
}

export function applyLandingMonitorPatch() {
  const indexPath = abs('public/index.html');
  const appPath = abs('public/app.js');
  const html = fs.readFileSync(indexPath, 'utf8');
  const js = fs.readFileSync(appPath, 'utf8');
  const nextHtml = patchIndex(html);
  const nextJs = patchApp(js);
  if (nextHtml !== html) fs.writeFileSync(indexPath, nextHtml);
  if (nextJs !== js) fs.writeFileSync(appPath, nextJs);
  return { marker: MARKER, htmlChanged: nextHtml !== html, jsChanged: nextJs !== js };
}
