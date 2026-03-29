// ═══════════════════════════════════════════════════════════════════
// config.js  —  Клиентская конфигурация Trading Journal
// Подключается ко всем web-формам: index.html, daily.html, deal.html, backtest.html
// ═══════════════════════════════════════════════════════════════════
// УСТАНОВКА:
//   1. Разверните code.gs как Web App (см. инструкцию внутри code.gs)
//   2. Скопируйте URL развёртывания в переменную GAS_URL ниже
//   3. Добавьте <script src="config.js"></script> в каждый HTML файл
//      перед закрывающим </body> (после всех inline-скриптов)
//   4. Замените пароль: функция hashPassword внизу файла
// ═══════════════════════════════════════════════════════════════════

window.CONFIG = {
  // ──────────────────────────────────────────────────────
  // ГЛАВНАЯ НАСТРОЙКА: URL вашего Google Apps Script
  // Вставьте сюда URL после деплоя code.gs
  // ──────────────────────────────────────────────────────
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwpgCeGd3pi0EV6JP9eecVOt-jXg2xISidwxJBiezN02PEGJxDk7vnXhHCTBBuM8lPaOw/exec',  // ← ВСТАВЬТЕ СЮДА: https://script.google.com/macros/s/YOUR_ID/exec

  // Google Spreadsheet ID (только для прямых ссылок)
  SHEET_ID: '1pTmXMWpOHhNMcFS71umrTqz3HIzhm7l_TpE3utKHr9k',

  // Пароль для index.html (SHA-256 хеш)
  // Дефолт: "123"  →  замените через hashPassword('ваш_пароль') в консоли
  PWD_HASH: '4913d9b91b263d8112306b784e7aa1f722bc5ca5bab56c231d52f9979d260402',

  // LocalStorage ключи (должны совпадать в HTML файлах)
  KEYS: {
    DAILY:     'daily_records',
    DEALS:     'deal_recs',
    BACKTESTS: 'bt_records',
    TICKERS:   'deal_tickers',
    ACCOUNTS:  'deal_accs',
    THEME:     'tj_theme',
  },

  // Синхронизация: true = отправлять данные в Sheets при каждом сохранении
  SYNC_ENABLED: true,

  // Синхронизация: true = загружать данные из Sheets при открытии форм
  SYNC_ON_LOAD: true,

  // Интервал фоновой синхронизации (мс), 0 = отключить
  SYNC_INTERVAL: 0,
};

// ═══════════════════════════════════════════════════════════════════
// API — единый слой для всех запросов к Google Apps Script
// ═══════════════════════════════════════════════════════════════════
window.API = {

  // ── Базовый GET запрос ──
  async get(action, params = {}) {
    if (!CONFIG.GAS_URL) return null;
    const url = new URL(CONFIG.GAS_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
      return await res.json();
    } catch (e) {
      console.warn('[API.get]', action, e.message);
      return null;
    }
  },

  // ── Базовый POST запрос ──
  async post(action, data = {}) {
    if (!CONFIG.GAS_URL) return null;
    try {
      const res = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
        signal: AbortSignal.timeout(15000),
      });
      return await res.json();
    } catch (e) {
      console.warn('[API.post]', action, e.message);
      return null;
    }
  },

  // ── Daily ──
  async saveDaily(data)    { return this.post('saveDaily',    { data }); },
  async getDailyHistory()  { return this.get('getDailyHistory'); },
  async getLastAccounts()  { return this.get('getLastAccounts'); },
  async getLastDeals()     { return this.get('getLastDeals'); },

  // ── Deals ──
  async saveDeal(data)     { return this.post('saveDeal',     { data }); },
  async getDealsAll()      { return this.get('getDealsAll'); },

  // ── Backtests ──
  async saveBacktest(data) { return this.post('saveBacktest', { data }); },
  async getBacktestsAll()  { return this.get('getBacktestsAll'); },

  // ── Tickers ──
  async saveTicker(name, step) { return this.post('saveTicker', { name, step }); },
  async getTickers()           { return this.get('getTickers'); },

  // ── Общие ──
  async updateRow(sheet, row, data) { return this.post('updateRow', { sheet, row, data }); },
  async deleteRow(sheet, row)       { return this.post('deleteRow', { sheet, row }); },
  async addAccountColumn(name, currency) {
    return this.post('addAccountColumn', { name, currency });
  },
  async renameColumn(sheet, col, name) {
    return this.post('renameColumn', { sheet, col, name });
  },
};

// ═══════════════════════════════════════════════════════════════════
// SYNC — синхронизация localStorage ↔ Google Sheets
// ═══════════════════════════════════════════════════════════════════
window.SYNC = {

  // ── Загрузить данные из Sheets в localStorage (при открытии страницы) ──
  async pullAll() {
    if (!CONFIG.GAS_URL || !CONFIG.SYNC_ON_LOAD) return;

    // Daily
    const dailyData = await API.getDailyHistory();
    if (dailyData?.records?.length) {
      this._mergeDaily(dailyData.records, dailyData.headers);
    }

    // Deals
    const dealsData = await API.getDealsAll();
    if (dealsData?.records?.length) {
      this._mergeDeals(dealsData.records, dealsData.headers);
    }

    // Backtests
    const btData = await API.getBacktestsAll();
    if (btData?.records?.length) {
      this._mergeBacktests(btData.records, btData.headers);
    }

    // Tickers
    const tickersData = await API.getTickers();
    if (tickersData?.tickers?.length) {
      localStorage.setItem(CONFIG.KEYS.TICKERS, JSON.stringify(tickersData.tickers));
    }

    // Accounts
    const accsData = await API.getLastAccounts();
    if (accsData?.accounts?.length) {
      localStorage.setItem(CONFIG.KEYS.ACCOUNTS, JSON.stringify(accsData.accounts));
    }
  },

  // Конвертировать строку Sheets → объект Daily
  _mergeDaily(rows, headers) {
    const existing = this._load(CONFIG.KEYS.DAILY);
    const merged = [...existing];

    rows.forEach(row => {
      const dt = row['Дата и время'] || '';
      if (!dt) return;
      const exists = merged.find(r => r.datetime === dt && r.type === 'daily');
      if (!exists) {
        merged.push({
          type: 'daily',
          datetime: dt,
          weekday: row['День недели'] || '',
          sleep: String(row['Качество сна'] || ''),
          sleepComment: row['Комментарий сна'] || '',
          feel: row['Самочувствие'] || '',
          feelComment: row['Комментарий самочувствие'] || '',
          mood: row['Настроение'] || '',
          moodComment: row['Комментарий настроение'] || '',
          act: row['Активность'] || '',
          actComment: row['Комментарий активность'] || '',
          plan: row['Есть план?'] || '',
          ri: row['PnL влияние'] || '',
          rw: row['Ради чего торгую'] || '',
          rp: row['Основная проблема'] || '',
          rs: row['Решение'] || '',
          af: String(row['А Финам'] || ''),
          sf: String(row['С Финам'] || ''),
          ab: String(row['A Bybit'] || ''),
          sb: String(row['C Bybit'] || ''),
          sforex: String(row['С Форекс'] || ''),
          ts: new Date().toISOString(),
        });
      }
    });

    localStorage.setItem(CONFIG.KEYS.DAILY, JSON.stringify(merged));
  },

  _mergeDeals(rows, headers) {
    const existing = this._load(CONFIG.KEYS.DEALS);
    const merged = [...existing];

    rows.forEach(row => {
      const dt = row['Время входа'] || '';
      const asset = row['Актив'] || '';
      if (!dt && !asset) return;
      const exists = merged.find(r =>
        r.entryDt === dt && r.asset === asset
      );
      if (!exists) {
        const pnl = row['PnL (R)'];
        merged.push({
          type: pnl ? 'full' : 'entry',
          asset: row['Актив'] || '',
          account: row['Счёт'] || '',
          ticker: row['Тикер'] || '',
          news: row['Важные новости?'] || '',
          byPlan: row['Сделка по плану?'] || '',
          struct: row['Структура'] || '',
          htfPoi: row['HTF POI'] || '',
          planRR: row['Планируемый RR'] || '',
          matchTS: row['Соответствует ТС?'] || '',
          feel: row['Эмоции'] || '',
          entryDt: dt,
          entryDay: row['День входа'] || '',
          sess: row['Сессия'] || '',
          ltfEntry: row['LTF Entry'] || '',
          bos: row['BoS'] || '',
          sl: String(row['Stop Loss'] || ''),
          entry: String(row['Entry Price'] || ''),
          target: String(row['Target'] || ''),
          risk: row['Риск %'] || '',
          dir: row['Направление'] || '',
          lot: String(row['Lot Size'] || ''),
          rr: row['Risk Reward'] || '',
          htfUrl: row['HTF График Entry'] || '',
          ltfUrl: row['LTF График Entry'] || '',
          closeDt: row['Дата закрытия'] || '',
          closeDay: row['День закрытия'] || '',
          result: row['Результат'] || '',
          closedPlan: row['Закрыта по плану?'] || '',
          avgPrice: String(row['Closed Price'] || ''),
          pnl: String(pnl || ''),
          closeHtf: row['HTF Close График'] || '',
          closeLtf: row['LTF Close График'] || '',
          reflectWhy: row['Что привело к результату?'] || '',
          reflectHow: row['Как вести себя в будущем?'] || '',
          ts: new Date().toISOString(),
        });
      }
    });

    localStorage.setItem(CONFIG.KEYS.DEALS, JSON.stringify(merged));
  },

  _mergeBacktests(rows, headers) {
    const existing = this._load(CONFIG.KEYS.BACKTESTS);
    const merged = [...existing];

    rows.forEach(row => {
      const dt = row['Дата и время сделки'] || '';
      if (!dt) return;
      const exists = merged.find(r => r.entryDt === dt);
      if (!exists) {
        merged.push({
          type: row['PnL (R)'] ? 'full' : 'entry',
          btDatetime: row['Дата бэктеста'] || '',
          entryDt: dt,
          entryDay: row['День сделки'] || '',
          session: row['Сессия'] || '',
          asset: row['Актив'] || '',
          struct: row['Структура'] || '',
          htfpoi: row['HTF POI'] || '',
          ltfentry: row['LTF Entry'] || '',
          bos: row['BoS'] || '',
          sl: String(row['Stop Loss'] || ''),
          entry: String(row['Entry Price'] || ''),
          target: String(row['Target'] || ''),
          rr: row['Risk Reward'] || '',
          direction: row['Направление'] || '',
          closeDt: row['Дата закрытия'] || '',
          closeDay: row['День закрытия'] || '',
          result: row['Результат'] || '',
          closedPrice: String(row['Closed Price'] || ''),
          pnl: String(row['PnL (R)'] || ''),
          reflectWhy: row['Что привело к результату?'] || '',
          reflectHow: row['Как надо было действовать?'] || '',
          ts: new Date().toISOString(),
        });
      }
    });

    localStorage.setItem(CONFIG.KEYS.BACKTESTS, JSON.stringify(merged));
  },

  _load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (e) { return []; }
  },
};

// ═══════════════════════════════════════════════════════════════════
// ОПРЕДЕЛЕНИЕ ТЕКУЩЕЙ СТРАНИЦЫ
// ═══════════════════════════════════════════════════════════════════
window.PAGE = (() => {
  const path = location.pathname.toLowerCase();
  if (path.includes('daily'))     return 'daily';
  if (path.includes('deal'))      return 'deal';
  if (path.includes('backtest'))  return 'backtest';
  if (path.includes('index') || path === '/' || path.endsWith('/')) return 'index';
  return 'unknown';
})();

// ═══════════════════════════════════════════════════════════════════
// PATCH — автоматически патчит функции сохранения в HTML формах
// ═══════════════════════════════════════════════════════════════════
(function patchForms() {
  document.addEventListener('DOMContentLoaded', async () => {

    // ── Синхронизация при старте ──
    if (CONFIG.SYNC_ON_LOAD && CONFIG.GAS_URL) {
      // Не блокируем UI — тянем в фоне
      SYNC.pullAll().catch(e => console.warn('[SYNC.pullAll]', e));
    }

    // ─────────────────────────────────────────────
    // DAILY
    // ─────────────────────────────────────────────
    if (PAGE === 'daily' && typeof save === 'function') {
      const _orig = window.save;
      window.save = async function() {
        _orig(); // сначала локально
        if (!CONFIG.SYNC_ENABLED || !CONFIG.GAS_URL) return;
        const recs = _loadKey(CONFIG.KEYS.DAILY);
        const last = [...recs].reverse().find(r => r.type === 'daily');
        if (!last) return;
        const res = await API.saveDaily(last);
        if (res?.row) {
          last.sheetRow = res.row;
          last.editLink = res.editLink || '';
          localStorage.setItem(CONFIG.KEYS.DAILY, JSON.stringify(recs));
          console.log('[Daily] ✅ Сохранено в Sheets, строка', res.row);
        }
      };
    }

    // ─────────────────────────────────────────────
    // DEAL — Entry
    // ─────────────────────────────────────────────
    if (PAGE === 'deal' && typeof saveEntry === 'function') {
      const _origEntry = window.saveEntry;
      window.saveEntry = async function() {
        _origEntry();
        if (!CONFIG.SYNC_ENABLED || !CONFIG.GAS_URL) return;
        const recs = _loadKey(CONFIG.KEYS.DEALS);
        const last = [...recs].reverse().find(r => r.type === 'entry' && !r.sheetRow);
        if (!last) return;
        const res = await API.saveDeal(last);
        if (res?.row) {
          last.sheetRow = res.row;
          last.editLink = res.editLink || '';
          localStorage.setItem(CONFIG.KEYS.DEALS, JSON.stringify(recs));
          console.log('[Deal Entry] ✅ Строка', res.row);
        }
      };
    }

    // DEAL — Close
    if (PAGE === 'deal' && typeof saveClose === 'function') {
      const _origClose = window.saveClose;
      window.saveClose = async function() {
        _origClose();
        if (!CONFIG.SYNC_ENABLED || !CONFIG.GAS_URL) return;
        const recs = _loadKey(CONFIG.KEYS.DEALS);
        const last = [...recs].reverse().find(r => r.type === 'full');
        if (!last) return;
        // Если уже есть sheetRow — обновляем, иначе создаём
        const res = await API.saveDeal({ ...last, editLink: last.editLink || null });
        if (res?.row) {
          last.sheetRow = res.row;
          last.editLink = res.editLink || last.editLink;
          localStorage.setItem(CONFIG.KEYS.DEALS, JSON.stringify(recs));
          console.log('[Deal Close] ✅ Строка', res.row);
        }
      };
    }

    // DEAL — Удалить
    if (PAGE === 'deal' && typeof confirmDel === 'function') {
      const _origDel = window.confirmDel;
      window.confirmDel = async function() {
        const idx = typeof delIdx !== 'undefined' ? delIdx : null;
        let sheetRow = null;
        if (idx !== null) {
          const recs = _loadKey(CONFIG.KEYS.DEALS);
          sheetRow = recs[idx]?.sheetRow || null;
        }
        _origDel();
        if (CONFIG.SYNC_ENABLED && CONFIG.GAS_URL && sheetRow) {
          await API.deleteRow('Deals', sheetRow);
          console.log('[Deal Delete] ✅ Удалено из Sheets строка', sheetRow);
        }
      };
    }

    // DEAL — Тикеры
    if (PAGE === 'deal' && typeof saveTicker === 'function') {
      const _origTk = window.saveTicker;
      window.saveTicker = async function() {
        _origTk();
        if (!CONFIG.SYNC_ENABLED || !CONFIG.GAS_URL) return;
        const tickers = _loadKey(CONFIG.KEYS.TICKERS);
        const last = tickers[tickers.length - 1];
        if (last) await API.saveTicker(last.name, last.step);
      };
    }

    // DEAL — Добавить счёт
    if (PAGE === 'daily' && typeof saveAddAccount === 'function') {
      const _origAdd = window.saveAddAccount;
      window.saveAddAccount = async function() {
        _origAdd();
        if (!CONFIG.SYNC_ENABLED || !CONFIG.GAS_URL) return;
        const n = document.getElementById('an2')?.value?.trim() ||
                  document.getElementById('add-name')?.value?.trim();
        const c = document.getElementById('ac2')?.value ||
                  document.getElementById('add-currency')?.value || '₽';
        if (n) {
          await API.addAccountColumn(n, c);
          console.log('[Daily] ✅ Столбец счёта добавлен:', n);
        }
      };
    }

    // ─────────────────────────────────────────────
    // BACKTEST — Entry
    // ─────────────────────────────────────────────
    if (PAGE === 'backtest' && typeof saveEntry === 'function') {
      const _origBtEntry = window.saveEntry;
      window.saveEntry = async function() {
        _origBtEntry();
        if (!CONFIG.SYNC_ENABLED || !CONFIG.GAS_URL) return;
        const recs = _loadKey(CONFIG.KEYS.BACKTESTS);
        const last = [...recs].reverse().find(r => r.type === 'entry' && !r.sheetRow);
        if (!last) return;
        const res = await API.saveBacktest(last);
        if (res?.row) {
          last.sheetRow = res.row;
          last.editLink = res.editLink || '';
          localStorage.setItem(CONFIG.KEYS.BACKTESTS, JSON.stringify(recs));
          console.log('[Backtest Entry] ✅ Строка', res.row);
        }
      };
    }

    // BACKTEST — Close
    if (PAGE === 'backtest' && typeof saveClose === 'function') {
      const _origBtClose = window.saveClose;
      window.saveClose = async function() {
        _origBtClose();
        if (!CONFIG.SYNC_ENABLED || !CONFIG.GAS_URL) return;
        const recs = _loadKey(CONFIG.KEYS.BACKTESTS);
        const last = [...recs].reverse().find(r => r.type === 'full');
        if (!last) return;
        const res = await API.saveBacktest({ ...last, editLink: last.editLink || null });
        if (res?.row) {
          last.sheetRow = res.row;
          last.editLink = res.editLink || last.editLink;
          localStorage.setItem(CONFIG.KEYS.BACKTESTS, JSON.stringify(recs));
          console.log('[Backtest Close] ✅ Строка', res.row);
        }
      };
    }

    // BACKTEST — Удалить
    if (PAGE === 'backtest' && typeof confirmDelete === 'function') {
      const _origBtDel = window.confirmDelete;
      window.confirmDelete = async function() {
        const idx = typeof deleteIdx !== 'undefined' ? deleteIdx : null;
        let sheetRow = null;
        if (idx !== null) {
          const recs = _loadKey(CONFIG.KEYS.BACKTESTS);
          sheetRow = recs[idx]?.sheetRow || null;
        }
        _origBtDel();
        if (CONFIG.SYNC_ENABLED && CONFIG.GAS_URL && sheetRow) {
          await API.deleteRow('Backtests', sheetRow);
          console.log('[Backtest Delete] ✅ Удалено строка', sheetRow);
        }
      };
    }

    // ─────────────────────────────────────────────
    // INDEX — загрузка балансов из Sheets для графиков
    // ─────────────────────────────────────────────
    if (PAGE === 'index' && typeof drawAllCharts === 'function') {
      if (CONFIG.SYNC_ON_LOAD && CONFIG.GAS_URL) {
        const dailyData = await API.getDailyHistory();
        if (dailyData?.records?.length) {
          SYNC._mergeDaily(dailyData.records, dailyData.headers);
          drawAllCharts(); // перерисовать после загрузки
        }
      }
    }

  });
})();

// ═══════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════
window._loadKey = function(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch (e) { return []; }
}

// Хеширование нового пароля (запустить в консоли браузера)
window.hashPassword = async function(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('Новый PWD_HASH:', hash);
  console.log('Вставьте в CONFIG.PWD_HASH (config.js) и PWD_HASH (index.html)');
  return hash;
}

// Статус соединения
window.checkConnection = async function() {
  if (!CONFIG.GAS_URL) {
    console.warn('[config.js] ⚠️  GAS_URL не задан. Синхронизация отключена.');
    return false;
  }
  const res = await API.get('getTickers');
  if (res && !res.error) {
    console.log('[config.js] ✅ Google Apps Script подключён');
    return true;
  }
  console.warn('[config.js] ❌ Не удалось подключиться к Apps Script');
  return false;
}
