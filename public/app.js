const $ = id => document.getElementById(id);
let cfg = null;

function b64ToUint8(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const s = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function price(v) {
  const x = Number(v || 0);
  if (!x) return '-';
  if (x >= 1000) return x.toLocaleString('en-US',{maximumFractionDigits:2});
  if (x >= 1) return x.toLocaleString('en-US',{maximumFractionDigits:4});
  return x.toLocaleString('en-US',{maximumFractionDigits:8});
}
function localTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
  catch { return ''; }
}
function renderPositions(list) {
  if (!list?.length) {
    $('positions').innerHTML = '<div class="empty">目前沒有公開倉位</div>';
    return;
  }
  $('positions').innerHTML = list.map(p => {
    const cls = p.side === 'LONG' ? 'long' : 'short';
    return `<div class="pos"><div><div class="sym">${p.symbol}</div><div class="dir ${cls}">${p.direction}</div></div><div class="price"><span>進場位</span><b>${price(p.entryPrice)}</b></div></div>`;
  }).join('');
}
function renderEvents(list) {
  if (!list?.length) {
    $('events').innerHTML = '<div class="empty">尚無新動靜</div>';
    return;
  }
  $('events').innerHTML = list.map(e => {
    const cls = e.side === 'LONG' ? 'long' : 'short';
    let text = e.direction || '';
    if (e.type === 'OPEN') text = `進場位 ${price(e.entryPrice)}`;
    if (e.type === 'ADD') text = `${e.direction}｜目前進場位 ${price(e.entryPrice)}`;
    if (e.type === 'REDUCE') text = e.direction;
    if (e.type === 'CLOSE') text = `${e.direction}結束`;
    return `<div class="event"><div class="eventTop"><div class="eventTitle"><span class="${cls}">${e.symbol}</span>｜${e.label}</div><div class="eventTime">${localTime(e.ts)}</div></div><div class="eventBody">${text}</div></div>`;
  }).join('');
}
async function refresh() {
  try {
    if (!cfg) cfg = await fetch('/api/config').then(r => r.json());
    const s = await fetch('/api/status').then(r => r.json());
    const ok = !s.lastError;
    $('dot').className = `dot ${ok ? 'ok' : 'bad'}`;
    $('status').textContent = ok ? (s.baselineReady ? '監控中' : '建立基準') : '讀取異常';
    renderPositions(s.positions);
    renderEvents(s.events);
    if (!cfg.pushReady) $('msg').textContent = '伺服器尚未設定推播金鑰。';
  } catch (e) {
    $('dot').className = 'dot bad';
    $('status').textContent = '連線異常';
  }
}

$('subscribe').onclick = async () => {
  try {
    if (!cfg) cfg = await fetch('/api/config').then(r => r.json());
    if (!cfg.vapidPublicKey) throw new Error('伺服器尚未設定推播金鑰');
    if (!('serviceWorker' in navigator)) throw new Error('此瀏覽器不支援通知');
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('你沒有允許通知');
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(cfg.vapidPublicKey),
    });
    const r = await fetch('/api/subscribe', {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(sub)
    });
    if (!r.ok) throw new Error(await r.text());
    $('msg').textContent = '✅ iPhone 通知已開啟';
  } catch (e) {
    $('msg').textContent = `❌ ${e.message}`;
  }
};

$('test').onclick = async () => {
  const r = await fetch('/api/test-push',{method:'POST'});
  $('msg').textContent = r.ok ? '✅ 已送出測試通知' : `❌ 測試失敗：${await r.text()}`;
};

refresh();
setInterval(refresh, 3000);
