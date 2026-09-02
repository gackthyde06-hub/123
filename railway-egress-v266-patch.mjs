import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'RAILWAY_EGRESS_V266';

function writeIfChanged(file, before, after) {
  if (before === after) return false;
  fs.writeFileSync(file, after, 'utf8');
  return true;
}

function patchServer() {
  const file = path.join(__dirname, 'server.js');
  if (!fs.existsSync(file)) throw new Error('[v266-cost] missing server.js');
  const before = fs.readFileSync(file, 'utf8');
  let s = before;

  if (!s.includes("import compression from 'compression';")) {
    const anchor = "import express from 'express';";
    if (!s.includes(anchor)) throw new Error('[v266-cost] express import anchor not found');
    s = s.replace(anchor, `${anchor}\nimport compression from 'compression';`);
  }

  if (!s.includes(MARKER)) {
    const oldBlock = `app.use(express.json({ limit: '128kb' }));\napp.use(express.static(path.join(__dirname, 'public'), {\n  etag: false,\n  lastModified: false,\n  setHeaders(res) {\n    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');\n  }\n}));`;

    const newBlock = `// ${MARKER}: lower Railway egress without slowing server-side notification polling.\n// Dynamic JSON + static text assets are compressed; browser assets may be reused safely.\napp.use(compression({ threshold: 1024, level: 4 }));\napp.use(express.json({ limit: '128kb' }));\n\n// API data must stay fresh, but "no-cache" permits conditional revalidation instead of forcing\n// the entire payload to be transferred again when it has not changed.\napp.use((req, res, next) => {\n  if (req.method === 'GET' && req.path.startsWith('/api/')) {\n    res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');\n  }\n  next();\n});\n\napp.use(express.static(path.join(__dirname, 'public'), {\n  etag: true,\n  lastModified: true,\n  setHeaders(res, filePath) {\n    const name = path.basename(filePath).toLowerCase();\n    if (name === 'index.html' || name === 'sw.js' || name === 'manifest.webmanifest') {\n      // Shell / service worker always revalidate so updates are not trapped by a stale cache.\n      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');\n    } else if (/\\.(?:png|jpe?g|webp|gif|ico|svg)$/.test(name)) {\n      // Versioned artwork and app icons are large and rarely change.\n      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');\n    } else if (/\\.(?:css|js)$/.test(name)) {\n      // JS/CSS already use version query strings from prepare-ui; one-hour reuse is safe.\n      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');\n    } else {\n      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');\n    }\n  }\n}));`;

    if (!s.includes(oldBlock)) {
      throw new Error('[v266-cost] current static-cache block not found; refusing a blind server.js edit');
    }
    s = s.replace(oldBlock, newBlock);
  }

  return writeIfChanged(file, before, s);
}

function patchFetchCaching(text) {
  return text
    .replaceAll("cache:'no-store'", "cache:'no-cache'")
    .replaceAll('cache:"no-store"', 'cache:"no-cache"');
}

function patchMainApp() {
  const file = path.join(__dirname, 'public', 'app.js');
  if (!fs.existsSync(file)) throw new Error('[v266-cost] missing public/app.js');
  const before = fs.readFileSync(file, 'utf8');
  let s = patchFetchCaching(before);

  if (!s.includes('refreshActivePageV266')) {
    const oldTimer = `setInterval(()=>{const active=document.querySelector('.pageTab.active')?.dataset?.page;if(active==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}else if(active==='flow')void refreshMarketFlow(false);else if(active==='ideas')void refreshRankedIdeas(false);else if(active==='test'||active==='monitor')void refreshTestSignals(false);else if(active==='performance')void refreshPerformance(false)},8_000);`;
    const newTimer = `// ${MARKER}: keep the existing 8-second foreground refresh, but stop paying for\n// JSON responses while the browser/PWA is hidden. Push notifications and backend polling continue.\nfunction refreshActivePageV266(){\n  if(document.hidden)return;\n  const active=document.querySelector('.pageTab.active')?.dataset?.page;\n  if(active==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}\n  else if(active==='flow')void refreshMarketFlow(false);\n  else if(active==='ideas')void refreshRankedIdeas(false);\n  else if(active==='test'||active==='monitor')void refreshTestSignals(false);\n  else if(active==='performance')void refreshPerformance(false);\n}\nsetInterval(refreshActivePageV266,8_000);\ndocument.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshActivePageV266()});`;
    if (!s.includes(oldTimer)) throw new Error('[v266-cost] 8s active-page refresh anchor not found');
    s = s.replace(oldTimer, newTimer);
  }

  return writeIfChanged(file, before, s);
}

function patchGrowthFile(file) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, 'utf8');
  let s = patchFetchCaching(before);

  const oldTimer = `function startTimer(){stopTimer();state.timer=setInterval(()=>{if(state.open)void loadData(true)},60_000)}`;
  const newTimer = `function startTimer(){stopTimer();state.timer=setInterval(()=>{if(state.open&&!document.hidden)void loadData(true)},60_000)}`;
  if (s.includes(oldTimer)) s = s.replace(oldTimer, newTimer);

  if (!s.includes('sgVisibilityV266')) {
    const anchor = `function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null}}`;
    if (s.includes(anchor)) {
      s = s.replace(anchor, `${anchor}\n  const sgVisibilityV266=()=>{if(!document.hidden&&state.open)void loadData(false)};\n  document.addEventListener('visibilitychange',sgVisibilityV266);`);
    }
  }
  return writeIfChanged(file, before, s);
}

export function patchRailwayCostV266() {
  const changed = {
    server: patchServer(),
    app: patchMainApp(),
    growthRoot: patchGrowthFile(path.join(__dirname, 'system-growth.js')),
    growthPublic: patchGrowthFile(path.join(__dirname, 'public', 'system-growth.js')),
  };
  return { changed: Object.values(changed).some(Boolean), files: changed, marker: MARKER };
}
