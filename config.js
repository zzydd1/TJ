// ═══════════════════════════════════════════════════════
// config.js — Trading Journal  (загружать на GitHub Pages)
// Подключить в каждый HTML перед </body>:
//   <script src="config.js"></script>
// ═══════════════════════════════════════════════════════

var TJ = {
  GAS:      'https://script.google.com/macros/s/AKfycbyexg03_EiDgsy7r58K7-r02ZROOxdzA2Rf2bZTTVHP2UsGSnWUUsh5uKPh_ZoAVP5D_g/exec',
  SHEET_ID: '1pTmXMWpOHhNMcFS71umrTqz3HIzhm7l_TpE3utKHr9k',
  PWD_HASH: '4913d9b91b263d8112306b784e7aa1f722bc5ca5bab56c231d52f9979d260402',
  KEYS: {
    DAILY:    'daily_records',
    DEALS:    'deal_recs',
    BT:       'bt_records',
    TICKERS:  'deal_tickers',
    ACCOUNTS: 'deal_accs',
    THEME:    'tj_theme',
  },
};

// Обратная совместимость — старый код читает CONFIG.GAS_URL
var CONFIG = { GAS_URL: TJ.GAS };

// ── GET / POST ─────────────────────────────────────────
async function tjGet(action, params) {
  var url = TJ.GAS + '?action=' + action;
  if (params) Object.keys(params).forEach(function(k){
    url += '&' + k + '=' + encodeURIComponent(params[k]);
  });
  try {
    var r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return await r.json();
  } catch(e) { console.warn('[TJ GET]', action, e.message); return null; }
}

async function tjPost(action, data) {
  try {
    const formData = new URLSearchParams();
    formData.append('action', action);
    formData.append('data', JSON.stringify(data));

    const r = await fetch(TJ.GAS, {
      method: 'POST',
      body: formData
    });

    const text = await r.text();

    try {
      const json = JSON.parse(text);

      if (json.error) {
        console.error('[GAS ERROR]', json.error);
        return null;
      }

      return json;

    } catch (e) {
      console.error('[INVALID JSON]', text);
      return null;
    }

  } catch(e) {
    console.error('[POST FAILED]', e.message);
    return null;
  }
}
// ── localStorage ───────────────────────────────────────
function tjLoad(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch(e) { return []; }
}
function tjSave(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ── ПОЛНАЯ СИНХРОНИЗАЦИЯ (вызов из index.html при входе) ──
async function tjSyncAll() {
  console.log('[TJ] Синхронизация...');
  await Promise.all([
    tjSyncDaily(), tjSyncDeals(), tjSyncBacktests(),
    tjSyncTickers(), tjSyncAccounts(),
  ]);
  console.log('[TJ] Готово');
}

// ── DAILY ──────────────────────────────────────────────
async function tjSyncDaily() {
  var res = await tjGet('getDailyHistory');
  if (!res || !res.records) return;
  var ex = tjLoad(TJ.KEYS.DAILY), added = 0;
  res.records.forEach(function(row) {
    var dt = row['Дата и время'] || '';
    if (!dt || ex.find(function(r){ return r.datetime === dt && r.type==='daily'; })) return;
    ex.push({
      type:'daily', datetime:dt,
      weekday: row['День недели']||'',
      sleep:   String(row['Качество сна']||''),
      sleepC:  row['Комментарий сна']||'',
      feel:    row['Самочувствие']||'',
      feelC:   row['Комментарий самочувствие']||'',
      mood:    row['Настроение']||'',
      moodC:   row['Комментарий настроение']||'',
      act:     row['Активность']||'',
      actC:    row['Комментарий активность']||'',
      plan:    row['Есть план?']||'',
      ri:      row['PnL влияние']||'',
      rw:      row['Ради чего торгую']||'',
      rp:      row['Основная проблема']||'',
      rs:      row['Решение']||'',
      af:      String(row['А Финам']||''),
      sf:      String(row['С Финам']||''),
      ab:      String(row['A Bybit']||''),
      sb:      String(row['C Bybit']||''),
      sforex:  String(row['С Форекс']||''),
      ts:      new Date().toISOString(),
    });
    added++;
  });
  if (added) tjSave(TJ.KEYS.DAILY, ex);
  console.log('[TJ Daily]', res.records.length, 'строк, новых:', added);
}

async function tjSaveDaily(data) {
  var res = await tjPost('saveDaily', data);
  if (res) console.log('[TJ] Daily →', res.status, 'строка', res.row);
  return res;
}

async function tjGetLastDeals() {
  var res = await tjGet('getLastDeals');
  return (res && res.deals) ? res.deals : [];
}

// ── DEALS ──────────────────────────────────────────────
async function tjSyncDeals() {
  var res = await tjGet('getDealsAll');
  if (!res || !res.records) return;
  var ex = tjLoad(TJ.KEYS.DEALS), added = 0;
  res.records.forEach(function(row) {
    var dt = row['Время входа']||'', asset = row['Актив']||'';
    if (!dt && !asset) return;
    if (ex.find(function(r){ return r.entryDt===dt && r.asset===asset; })) return;
    ex.push({
      type:       row['PnL (R)'] ? 'full' : 'entry',
      asset:      asset,
      account:    row['Счёт']||'',
      ticker:     row['Тикер']||'',
      news:       row['Важные новости?']||'',
      byPlan:     row['Сделка по плану?']||'',
      struct:     row['Структура']||'',
      htfPoi:     row['HTF POI']||'',
      planRR:     String(row['Планируемый RR']||''),
      matchTS:    row['Соответствует ТС?']||'',
      feel:       row['Эмоции']||'',
      entryDt:    dt,
      entryDay:   row['День входа']||'',
      sess:       row['Сессия']||'',
      ltfEntry:   row['LTF Entry']||'',
      bos:        row['BoS']||'',
      sl:         String(row['Stop Loss']||''),
      entry:      String(row['Entry Price']||''),
      target:     String(row['Target']||''),
      risk:       String(row['Риск %']||''),
      dir:        row['Направление']||'',
      lot:        String(row['Lot Size']||''),
      rr:         String(row['Risk Reward']||''),
      htfUrl:     row['HTF График Entry']||'',
      ltfUrl:     row['LTF График Entry']||'',
      closeDt:    row['Дата закрытия']||'',
      closeDay:   row['День закрытия']||'',
      result:     row['Результат']||'',
      closedPlan: row['Закрыта по плану?']||'',
      avgPrice:   String(row['Closed Price']||''),
      pnl:        String(row['PnL (R)']||''),
      closeHtf:   row['HTF Close График']||'',
      closeLtf:   row['LTF Close График']||'',
      reflectWhy: row['Что привело к результату?']||'',
      reflectHow: row['Как вести себя в будущем?']||'',
      ts:         new Date().toISOString(),
    });
    added++;
  });
  if (added) tjSave(TJ.KEYS.DEALS, ex);
  console.log('[TJ Deals]', res.records.length, 'строк, новых:', added);
}

async function tjSaveDeal(data) {
  var res = await tjPost('saveDeal', data);
  if (res) console.log('[TJ] Deal →', res.status, 'строка', res.row);
  return res;
}

// ── BACKTESTS ──────────────────────────────────────────
async function tjSyncBacktests() {
  var res = await tjGet('getBacktestsAll');
  if (!res || !res.records) return;
  var ex = tjLoad(TJ.KEYS.BT), added = 0;
  res.records.forEach(function(row) {
    var dt = row['Дата и время сделки']||'';
    if (!dt || ex.find(function(r){ return r.entryDt===dt; })) return;
    ex.push({
      type:        row['PnL (R)'] ? 'full' : 'entry',
      entryDt:     dt,
      entryDay:    row['День сделки']||'',
      session:     row['Сессия']||'',
      asset:       row['Актив']||'',
      struct:      row['Структура']||'',
      htfpoi:      row['HTF POI']||'',
      ltfentry:    row['LTF Entry']||'',
      bos:         row['BoS']||'',
      sl:          String(row['Stop Loss']||''),
      entry:       String(row['Entry Price']||''),
      target:      String(row['Target']||''),
      rr:          String(row['Risk Reward']||''),
      direction:   row['Направление']||'',
      closeDt:     row['Дата закрытия']||'',
      closeDay:    row['День закрытия']||'',
      result:      row['Результат']||'',
      closedPrice: String(row['Closed Price']||''),
      pnl:         String(row['PnL (R)']||''),
      reflectWhy:  row['Что привело к результату?']||'',
      reflectHow:  row['Как надо было действовать?']||'',
      ts:          new Date().toISOString(),
    });
    added++;
  });
  if (added) tjSave(TJ.KEYS.BT, ex);
  console.log('[TJ BT]', res.records.length, 'строк, новых:', added);
}

async function tjSaveBacktest(data) {
  var res = await tjPost('saveBacktest', data);
  if (res) console.log('[TJ] Backtest →', res.status, 'строка', res.row);
  return res;
}

// ── TICKERS & ACCOUNTS ─────────────────────────────────
async function tjSyncTickers() {
  var res = await tjGet('getTickers');
  if (!res || !res.tickers) return;
  tjSave(TJ.KEYS.TICKERS, res.tickers);
  console.log('[TJ Tickers]', res.tickers.length);
}

async function tjSyncAccounts() {
  var res = await tjGet('getLastAccounts');
  if (!res || !res.accounts) return;
  tjSave(TJ.KEYS.ACCOUNTS, res.accounts);
  console.log('[TJ Accounts]', res.accounts.length);
}

async function tjSaveTicker(name, step) {
  return await tjPost('saveTicker', { name: name, step: step });
}

async function tjDeleteRow(sheet, row) {
  return await tjPost('deleteRow', { sheet: sheet, row: row });
}

// ── Утилита смены пароля (запускать в консоли браузера) ──
async function hashPassword(pwd) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  var hash = Array.from(new Uint8Array(buf))
    .map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  console.log('Новый PWD_HASH:', hash);
  return hash;
}

console.log('[TJ] config.js загружен, GAS:', TJ.GAS ? 'OK' : 'НЕ ЗАДАН');
