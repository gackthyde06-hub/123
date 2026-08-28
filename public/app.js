const $ = id => document.getElementById(id);

let cfg = null;
let lastStatus = null;

const TRADER_PREF = 'position-alert-traders-v52';
const TYPE_PREF = 'position-alert-types-v52';
const DEFAULT_TYPES = ['OPEN', 'ADD', 'REDUCE', 'CLOSE', 'CONSENSUS'];

function esc(s) {
  return String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[c]));
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
    return new Date(iso).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function defaultTraderIds() {
  return cfg?.traders?.map(t => t.id) || [];
}

function loadArray(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (Array.isArray(value)) return value;
  } catch {}
  return fallback;
}

function loadEnabledTraders() {
  const valid = new Set(defaultTraderIds());
  return loadArray(TRADER_PREF, defaultTraderIds()).filter(id => valid.has(id));
}

function saveEnabledTraders(ids) {
  localStorage.setItem(TRADER_PREF, JSON.stringify(ids));
}

function loadEnabledTypes() {
  const valid = new Set(cfg?.eventTypes || DEFAULT_TYPES);
  return loadArray(TYPE_PREF, [...valid]).filter(type => valid.has(type));
}

function saveEnabledTypes(types) {
  localStorage.setItem(TYPE_PREF, JSON.stringify(types));
}

function typeLabel(type) {
  return ({
    OPEN: '建倉',
    ADD: '加碼',
    REDUCE: '減碼',
    CLOSE: '平倉',
    CONSENSUS: '共識',
  })[type] || type;
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
    body: JSON.stringify({
      endpoint: sub.endpoint,
      enabledTraders: loadEnabledTraders(),
      enabledTypes: loadEnabledTypes(),
    })
  });
}

function renderMasterToggle() {
  const enabled = loadEnabledTraders();
  const allOn = enabled.length === cfg.traders.length;

  $('allToggle').checked = allOn;
  $('allCount').textContent = `${enabled.length}/${cfg.traders.length}`;
}

function renderTypeOptions() {
  const enabled = new Set(loadEnabledTypes());

  $('typeOptions').innerHTML = (cfg.eventTypes || DEFAULT_TYPES).map(type => `
    <label class="typeChoice">
      <input class="typeToggle" type="checkbox" data-type="${esc(type)}" ${enabled.has(type) ? 'checked' : ''}>
      <span>${esc(typeLabel(type))}</span>
    </label>
  `).join('');

  document.querySelectorAll('.typeToggle').forEach(el => {
    el.addEventListener('change', async () => {
      const types = [...document.querySelectorAll('.typeToggle:checked')]
        .map(x => x.dataset.type);

      saveEnabledTypes(types);
      await syncPreferences().catch(() => {});
      $('msg').textContent = '✅ 通知類型已更新';
    });
  });
}

function positionRow(p, extra = false) {
  const cls = p.side === 'LONG' ? 'long' : 'short';

  return `
    <div class="pos ${extra ? 'extraPos hidden' : ''}">
      <div>
        <div class="sym">${esc(p.symbol)}</div>
        <div class="dir ${cls}">${esc(p.direction)}</div>
      </div>
      <div class="price">
        <span>進場均價</span>
        <b>${price(p.entryPrice)}</b>
      </div>
    </div>
  `;
}

function traderCard(t) {
  const enabled = loadEnabledTraders().includes(t.id);
  const ok = !t.lastError;
  const list = t.positions || [];
  const first = list.slice(0, 2);
  const rest = list.slice(2);

  let positions = '';

  if (!list.length) {
    positions = '<div class="empty">目前無倉位</div>';
  } else {
    positions = first.map(p => positionRow(p, false)).join('');
    positions += rest.map(p => positionRow(p, true)).join('');

    if (rest.length) {
      positions += `
        <button class="moreBtn" data-count="${rest.length}">
          顯示其餘 ${rest.length} 筆
        </button>
      `;
    }
  }

  return `
    <section class="traderCard" data-trader="${esc(t.id)}">
      <div class="traderHead">
        <div>
          <div class="traderName">${esc(t.name)}</div>
          <div class="state ${ok ? 'okText' : 'badText'}">
            ${ok ? (t.baselineReady ? '監控中' : '建立中') : '讀取異常'}
          </div>
        </div>

        <label class="switch">
          <input
            type="checkbox"
            class="traderToggle"
            data-id="${esc(t.id)}"
            ${enabled ? 'checked' : ''}
          >
          <span class="slider"></span>
        </label>
      </div>

      <div class="positionBox">
        ${positions}
      </div>
    </section>
  `;
}

function bindTraderControls() {
  document.querySelectorAll('.traderToggle').forEach(el => {
    el.addEventListener('change', async e => {
      const id = e.currentTarget.dataset.id;
      const set = new Set(loadEnabledTraders());

      if (e.currentTarget.checked) set.add(id);
      else set.delete(id);

      saveEnabledTraders([...set]);
      renderMasterToggle();

      await syncPreferences().catch(() => {});
      $('msg').textContent = '✅ 交易員通知已更新';
    });
  });

  document.querySelectorAll('.moreBtn').forEach(btn => {
    btn.addEventListener('click', e => {
      const box = e.currentTarget.closest('.positionBox');
      const extras = [...box.querySelectorAll('.extraPos')];
      const opening = extras.some(x => x.classList.contains('hidden'));

      extras.forEach(x => x.classList.toggle('hidden', !opening));

      e.currentTarget.textContent = opening
        ? '收合'
        : `顯示其餘 ${e.currentTarget.dataset.count} 筆`;
    });
  });
}

function renderTraders(list) {
  $('traders').innerHTML = list.map(traderCard).join('');
  bindTraderControls();
}

function eventAction(e) {
  if (e.type === 'OPEN') return e.direction || '';
  if (e.type === 'ADD') return '加碼';
  if (e.type === 'REDUCE') return '減碼';
  if (e.type === 'CLOSE') return '平倉';
  if (e.type === 'CONSENSUS') return `${e.direction || ''}共識`;
  return e.type || '';
}

function renderEvents(list) {
  if (!list?.length) {
    $('events').innerHTML = '<div class="empty">尚無新動靜</div>';
    return;
  }

  $('events').innerHTML = list.slice(0, 12).map(e => {
    if (e.kind === 'CONSENSUS') {
      return `
        <div class="event">
          <span class="eventTime">${localTime(e.ts)}</span>
          <b>${esc(eventAction(e))}</b>
          <span>${esc(e.symbol)}</span>
          <span class="muted">${esc((e.traderNames || []).join('、'))}</span>
        </div>
      `;
    }

    return `
      <div class="event">
        <span class="eventTime">${localTime(e.ts)}</span>
        <b>${esc(e.traderName)}</b>
        <span>${esc(eventAction(e))}</span>
        <span>${esc(e.symbol)}</span>
        <span class="muted">${price(e.tradePrice || e.entryPrice)}</span>
      </div>
    `;
  }).join('');
}

async function refresh() {
  try {
    if (!cfg) {
      cfg = await fetch('/api/config', { cache: 'no-store' }).then(r => r.json());
      renderTypeOptions();
    }

    const s = await fetch('/api/status', { cache: 'no-store' }).then(r => r.json());
    lastStatus = s;

    const ok = s.healthy > 0;
    $('dot').className = `dot ${ok ? 'ok' : 'bad'}`;
    $('status').textContent = ok ? `${s.healthy}/${s.total}` : '異常';

    renderMasterToggle();
    renderTraders(s.traders || []);
    renderEvents(s.events || []);

    if (!cfg.pushReady) $('msg').textContent = '伺服器推播尚未就緒';
  } catch {
    $('dot').className = 'dot bad';
    $('status').textContent = '連線異常';
  }
}

$('allToggle').addEventListener('change', async e => {
  const ids = e.currentTarget.checked ? defaultTraderIds() : [];

  saveEnabledTraders(ids);
  renderMasterToggle();

  if (lastStatus) renderTraders(lastStatus.traders || []);

  await syncPreferences().catch(() => {});
  $('msg').textContent = e.currentTarget.checked
    ? '✅ 全部交易員已開啟'
    : '🔕 全部交易員已關閉';
});

$('subscribe').onclick = async () => {
  try {
    if (!cfg) cfg = await fetch('/api/config', { cache: 'no-store' }).then(r => r.json());

    if (!cfg.vapidPublicKey) throw new Error('伺服器尚未設定推播金鑰');
    if (!('serviceWorker' in navigator)) throw new Error('此瀏覽器不支援通知');

    const reg = await navigator.serviceWorker.register('/sw.js?v=52');
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
      body: JSON.stringify({
        subscription: sub,
        enabledTraders: loadEnabledTraders(),
        enabledTypes: loadEnabledTypes(),
      })
    });

    if (!r.ok) throw new Error(await r.text());

    $('msg').textContent = '✅ iPhone 通知已同步';
  } catch (e) {
    $('msg').textContent = `❌ ${e.message}`;
  }
};

function b64ToUint8(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const s = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

$('test').onclick = async () => {
  const traderId = loadEnabledTraders()[0] || cfg?.traders?.[0]?.id;

  const r = await fetch('/api/test-push', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ traderId }),
  });

  $('msg').textContent = r.ok
    ? '✅ 測試通知已送出'
    : `❌ 測試失敗：${await r.text()}`;
};

refresh();
setInterval(refresh, 3000);
