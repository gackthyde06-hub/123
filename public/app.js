const $ = id => document.getElementById(id);
let cfg = null;
let lastStatus = null;
const PREF_KEY = 'leader-alert-enabled-v5';

function b64ToUint8(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const s = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function price(v) {
  const x = Number(v || 0);
  if (!x) return '-';
  if (x >= 1000) return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (x >= 1) return x.toLocaleString('en-US', { maximumFractionDigits: 6 });
  return x.toLocaleString('en-US', { maximumFractionDigits: 8 });
}
function localTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch { return ''; }
}
function esc(s) {
  return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function defaultEnabled() {
  return cfg?.traders?.map(t => t.id) || [];
}
function loadEnabled() {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (Array.isArray(v)) return v.filter(id => cfg.traders.some(t => t.id === id));
  } catch {}
  return defaultEnabled();
}
function saveEnabled(ids) {
  localStorage.setItem(PREF_KEY, JSON.stringify(ids));
}

async function getPushSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? await reg.pushManager.getSubscription() : null;
}

async function syncPreferences() {
  const sub = await getPushSubscription();
  if (!sub) return;
  await fetch('/api/preferences', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, enabledTraders: loadEnabled() })
  });
}

function renderMasterToggle() {
  const enabled = loadEnabled();
  const allOn = enabled.length === cfg.traders.length;
  $('allToggle').checked = allOn;
  $('allCount').textContent = `${enabled.length}/${cfg.traders.length} 已開啟`;
}

function traderCard(t) {
  const enabled = loadEnabled().includes(t.id);
  const ok = !t.lastError;
  const positions = t.positions?.length
    ? t.positions.map(p => {
        const cls = p.side === 'LONG' ? 'long' : 'short';
        return `<div class="pos"><div><div class="sym">${esc(p.symbol)}</div><div class="dir ${cls}">${esc(p.direction)}</div></div><div class="price"><span>進場均價</span><b>${price(p.entryPrice)}</b></div></div>`;
      }).join('')
    : '<div class="empty">目前沒有公開倉位</div>';

  return `<section class="traderCard">
    <div class="traderHead">
      <div>
        <div class="traderName">${esc(t.name)}</div>
        <div class="traderMeta">${esc(t.role)} · <span class="${ok ? 'okText' : 'badText'}">${ok ? (t.baselineReady ? '監控中' : '建立基準') : '讀取異常'}</span></div>
      </div>
      <label class="switch" aria-label="${esc(t.name)} notification toggle">
        <input type="checkbox" class="traderToggle" data-id="${esc(t.id)}" ${enabled ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
    <div class="positionBox">${positions}</div>
  </section>`;
}

function renderTraders(list) {
  $('traders').innerHTML = list.map(traderCard).join('');
  document.querySelectorAll('.traderToggle').forEach(el => {
    el.addEventListener('change', async e => {
      const id = e.currentTarget.dataset.id;
      const set = new Set(loadEnabled());
      if (e.currentTarget.checked) set.add(id); else set.delete(id);
      saveEnabled([...set]);
      renderMasterToggle();
      await syncPreferences().catch(() => {});
      $('msg').textContent = `✅ 通知設定已更新：${set.size}/${cfg.traders.length}`;
    });
  });
}

function renderEvents(list) {
  if (!list?.length) {
    $('events').innerHTML = '<div class="empty">尚無新動靜</div>';
    return;
  }
  $('events').innerHTML = list.map(e => {
    if (e.kind === 'CONSENSUS') {
      return `<div class="event consensus"><div class="eventTop"><div class="eventTitle">🔥 ${esc(e.symbol)}｜${esc(e.direction)}共識</div><div class="eventTime">${localTime(e.ts)}</div></div><div class="eventBody">${esc((e.traderNames || []).join('、'))}</div></div>`;
    }
    const cls = e.side === 'LONG' ? 'long' : 'short';
    let text = e.direction || '';
    if (e.type === 'OPEN') text = `進場位 ${price(e.tradePrice || e.entryPrice)}`;
    if (e.type === 'ADD') text = `${e.direction}｜成交位 ${price(e.tradePrice || e.entryPrice)}`;
    if (e.type === 'REDUCE') text = `${e.direction}｜成交位 ${price(e.tradePrice || e.entryPrice)}`;
    if (e.type === 'CLOSE') text = `${e.direction}結束｜成交位 ${price(e.tradePrice || e.entryPrice)}`;
    return `<div class="event"><div class="eventTop"><div class="eventTitle"><span class="traderBadge">${esc(e.traderName)}</span> <span class="${cls}">${esc(e.symbol)}</span>｜${esc(e.label)}</div><div class="eventTime">${localTime(e.ts)}</div></div><div class="eventBody">${esc(text)}</div></div>`;
  }).join('');
}

async function refresh() {
  try {
    if (!cfg) cfg = await fetch('/api/config', { cache: 'no-store' }).then(r => r.json());
    const s = await fetch('/api/status', { cache: 'no-store' }).then(r => r.json());
    lastStatus = s;
    const ok = s.healthy > 0;
    $('dot').className = `dot ${ok ? 'ok' : 'bad'}`;
    $('status').textContent = ok ? `監控中 ${s.healthy}/${s.total}` : '讀取異常';
    renderMasterToggle();
    renderTraders(s.traders || []);
    renderEvents(s.events || []);
    if (!cfg.pushReady) $('msg').textContent = '伺服器尚未設定推播金鑰。';
  } catch (e) {
    $('dot').className = 'dot bad';
    $('status').textContent = '連線異常';
  }
}

$('allToggle').addEventListener('change', async e => {
  const ids = e.currentTarget.checked ? defaultEnabled() : [];
  saveEnabled(ids);
  renderMasterToggle();
  if (lastStatus) renderTraders(lastStatus.traders || []);
  await syncPreferences().catch(() => {});
  $('msg').textContent = e.currentTarget.checked ? '✅ 已開啟全部交易員通知' : '🔕 已關閉全部交易員通知';
});

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
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub, enabledTraders: loadEnabled() })
    });
    if (!r.ok) throw new Error(await r.text());
    $('msg').textContent = '✅ iPhone 通知已開啟，開關設定已同步';
  } catch (e) {
    $('msg').textContent = `❌ ${e.message}`;
  }
};

$('test').onclick = async () => {
  const firstEnabled = loadEnabled()[0] || cfg?.traders?.[0]?.id;
  const r = await fetch('/api/test-push', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ traderId: firstEnabled })
  });
  $('msg').textContent = r.ok ? '✅ 已送出測試通知' : `❌ 測試失敗：${await r.text()}`;
};

refresh();
setInterval(refresh, 3000);
