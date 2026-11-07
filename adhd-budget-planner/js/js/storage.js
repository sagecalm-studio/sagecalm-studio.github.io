/**
 * ADHD Budget Planner - Storage, Persistence & Data Integrity Engine
 * Handles IndexedDB with LocalStorage fallback, automated backups, and schema migrations.
 */

(function (global) {
  'use strict';

  const Storage = {};
  const DB_NAME = 'FocusBudgetDB';
  const DB_STORE = 'app_state';
  const LS_KEY = 'focusbudget_state_v1';
  const CURRENT_SCHEMA = 1;

  // --- 1. Default State Model ---

  Storage.createDefaultState = function () {
    const today = (global.FocusEngine && global.FocusEngine.toISODate) 
      ? global.FocusEngine.toISODate() 
      : new Date().toISOString().split('T')[0];

    return {
      schema: CURRENT_SCHEMA,
      isDemo: false,
      activePersona: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile: {
        preferredName: '',
        currency: 'USD',
        oopsFundCents: 5000 // $50 zero-guilt buffer
      },
      accounts: [
        {
          id: 'acct-main',
          name: 'Primary Checking',
          kind: 'checking',
          balanceCents: 0,
          balanceAsOf: today
        }
      ],
      income: [],
      bills: [],
      debts: [],
      savings: [],
      envelopes: [],
      transactions: [],
      impulseVault: [], // 48-Hour Dopamine Buffer items
      brainDump: [],    // ADHD quick thought capture
      quickSpends: [
        { id: 'qs-1', label: 'Coffee', amountCents: 525, icon: '☕', category: 'Coffee' },
        { id: 'qs-2', label: 'Lunch', amountCents: 1250, icon: '🥗', category: 'Food' },
        { id: 'qs-3', label: 'Groceries', amountCents: 4500, icon: '🛒', category: 'Groceries' }
      ],
      ui: {
        theme: 'sage-calm', // 'sage-calm' | 'oled-dark' | 'warm-earth' | 'high-contrast'
        zombieMode: false,
        soundEnabled: true,
        lastBackupPromptAt: null
      }
    };
  };

  // --- 2. IndexedDB & LocalStorage Hybrid Adapter ---

  let dbInstance = null;

  function openIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        resolve(null);
        return;
      }
      const req = global.indexedDB.open(DB_NAME, CURRENT_SCHEMA);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = () => {
        resolve(null); // Gracefully fall back to LocalStorage
      };
    });
  }

  Storage.init = async function () {
    // Request persistent storage if supported (protects against iOS 7-day Safari purge)
    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch (err) {
        // Non-blocking
      }
    }
    return await openIndexedDB();
  };

  Storage.loadState = async function () {
    // 1. Try IndexedDB first
    try {
      const db = dbInstance || (await openIndexedDB());
      if (db) {
        const idbData = await new Promise((resolve) => {
          const tx = db.transaction(DB_STORE, 'readonly');
          const store = tx.objectStore(DB_STORE);
          const req = store.get('current');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
        if (idbData && idbData.schema) {
          return Storage.migrateState(idbData);
        }
      }
    } catch (e) {
      console.warn('ADHD Budget Planner: IndexedDB read error, falling back to LocalStorage', e);
    }

    // 2. Fallback to LocalStorage
    try {
      const raw = global.localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schema) {
          return Storage.migrateState(parsed);
        }
      }
    } catch (e) {
      console.warn('ADHD Budget Planner: LocalStorage read error', e);
    }

    // 3. Return brand new clean state
    const cleanState = Storage.createDefaultState();
    return cleanState;
  };

  // Helper: Sanitize state so tutorial artifacts are never treated as real user data
  function sanitizeTutorialState(state) {
    if (!state) return Storage.createDefaultState();

    const isTutorialData = state.isTutorial === true ||
      (!state.isDemo && state.income && state.income.some(i => i.label === "Maya's Paycheck")) ||
      (!state.isDemo && state.bills && state.bills.some(b => b.name === "Apartment Rent" && b.amountCents === 85000));

    if (isTutorialData) {
      // Check if user state snapshot exists in sessionStorage
      try {
        const snapRaw = global.sessionStorage.getItem('focus_user_snapshot');
        if (snapRaw) {
          const snap = JSON.parse(snapRaw);
          if (snap && snap.schema && !snap.isTutorial) {
            return snap;
          }
        }
      } catch (e) {}

      // Reset to pristine empty user state
      const clean = Storage.createDefaultState();
      clean.initialized = true;
      return clean;
    }

    return state;
  }

  const origLoadState = Storage.loadState;
  Storage.loadState = async function () {
    let loaded = await origLoadState.call(Storage);
    const sanitized = sanitizeTutorialState(loaded);
    if (sanitized !== loaded) {
      // Tutorial data was purged, persist the clean state immediately
      await Storage.saveState(sanitized);
    }
    return sanitized;
  };

  Storage.saveState = async function (state) {
    if (!state) return false;

    // NEVER persist tutorial or demo sandbox state to permanent storage!
    if (state.isTutorial === true || (global.FocusTutorials && typeof global.FocusTutorials.isActive === 'function' && global.FocusTutorials.isActive())) {
      return true; // Ignore disk write during tutorial
    }

    state.updatedAt = new Date().toISOString();

    // Mirror to LocalStorage synchronously for immediate reliability
    try {
      global.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('ADHD Budget Planner: LocalStorage write warning', e);
    }

    // Async write to IndexedDB in background
    try {
      const db = dbInstance || (await openIndexedDB());
      if (db) {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.put(state, 'current');
      }
    } catch (e) {
      console.warn('ADHD Budget Planner: IndexedDB write warning', e);
    }

    return true;
  };

  // --- 3. Schema Migration Pipeline ---

  Storage.migrateState = function (state) {
    if (!state || typeof state !== 'object') {
      return Storage.createDefaultState();
    }
    // Ensure all critical arrays exist
    const base = Storage.createDefaultState();
    const migrated = Object.assign({}, base, state);
    migrated.schema = CURRENT_SCHEMA;

    migrated.profile = Object.assign({}, base.profile, state.profile || {});
    migrated.ui = Object.assign({}, base.ui, state.ui || {});
    migrated.accounts = Array.isArray(state.accounts) ? state.accounts : base.accounts;
    migrated.income = Array.isArray(state.income) ? state.income.map(inc => {
      if (inc && inc.anchor && !inc.dueDay) {
        return Object.assign({}, inc, { dueDay: parseInt(inc.anchor.split('-')[2], 10) || 1 });
      }
      return inc;
    }) : [];
    migrated.bills = Array.isArray(state.bills) ? state.bills : [];
    migrated.debts = Array.isArray(state.debts) ? state.debts : [];
    migrated.savings = Array.isArray(state.savings) ? state.savings : [];
    migrated.envelopes = Array.isArray(state.envelopes) ? state.envelopes : [];
    migrated.transactions = Array.isArray(state.transactions) ? state.transactions : [];
    migrated.impulseVault = Array.isArray(state.impulseVault) ? state.impulseVault : [];
    migrated.brainDump = Array.isArray(state.brainDump) ? state.brainDump : [];
    migrated.quickSpends = Array.isArray(state.quickSpends) && state.quickSpends.length > 0
      ? state.quickSpends.slice(0, 3)
      : base.quickSpends;

    return migrated;
  };

  // --- 4. Backup & Export Utilities ---

  Storage.exportJSONBackup = function (state) {
    const today = (global.FocusEngine && global.FocusEngine.toISODate)
      ? global.FocusEngine.toISODate()
      : new Date().toISOString().split('T')[0];
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `ADHD-Budget-Planner-Backup-${today}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  Storage.importJSONBackup = function (jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON format.');
      }
      return Storage.migrateState(parsed);
    } catch (err) {
      throw new Error('Failed to restore backup: ' + err.message);
    }
  };

  Storage.exportCSV = function (state) {
    const txs = state.transactions || [];
    const headers = ['Date', 'Category', 'Note', 'Amount', 'Type'];
    const rows = txs.map(t => {
      const amount = ((t.amountCents || 0) / 100).toFixed(2);
      return [
        `"${t.date || ''}"`,
        `"${t.category || 'General'}"`,
        `"${(t.note || '').replace(/"/g, '""')}"`,
        `"${amount}"`,
        `"${t.kind || 'spend'}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), ...rows].join('\n'));
    const dlAnchor = document.createElement('a');
    const today = (global.FocusEngine && global.FocusEngine.toISODate)
      ? global.FocusEngine.toISODate()
      : 'export';
    dlAnchor.setAttribute('href', csvContent);
    dlAnchor.setAttribute('download', `ADHD-Budget-Planner-Spending-${today}.csv`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  // --- 5. Ephemeral Zero-Server QR Device Sync ---

  Storage.generateTransferPayload = function (state) {
    // Create compact payload without demo artifacts
    const cleanState = Object.assign({}, state, { isDemo: false, activePersona: null });
    const json = JSON.stringify(cleanState);
    // Base64 encode string for QR or direct copy-paste transfer
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(json)));
    }
    return json;
  };

  Storage.importTransferPayload = function (transferStr) {
    try {
      let json = transferStr;
      if (typeof atob !== 'undefined') {
        try {
          json = decodeURIComponent(escape(atob(transferStr.trim())));
        } catch {
          json = transferStr;
        }
      }
      return Storage.importJSONBackup(json);
    } catch (err) {
      throw new Error('Invalid device transfer code.');
    }
  };

  Storage.clearAllData = async function () {
    try {
      global.localStorage.removeItem(LS_KEY);
      const db = dbInstance || (await openIndexedDB());
      if (db) {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).clear();
      }
    } catch (err) {
      console.warn('Error clearing data:', err);
    }
    return Storage.createDefaultState();
  };

  global.FocusStorage = Storage;

})(typeof window !== 'undefined' ? window : this);
