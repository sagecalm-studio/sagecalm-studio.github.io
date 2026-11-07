/**
 * ADHD Budget Planner (Base Edition) - Minimalist Sage Demo Guard
 * Isolates demo to temporary sessionStorage, seeds realistic ADHD demo data,
 * and handles Etsy purchase conversion modals.
 */
(function () {
  'use strict';

  // 1. Disable ServiceWorker registration in demo mode
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve();
    };
  }

  // 2. Redirect localStorage calls to sessionStorage for store key
  const DEMO_STORE_KEY = 'focusbudget_state_v1';
  
  if (!sessionStorage.getItem(DEMO_STORE_KEY)) {
    const now = Date.now();
    const inFourDays = new Date(now + 4 * 86400000).toISOString().slice(0, 10);
    const inThreeDays = new Date(now + 3 * 86400000).toISOString().slice(0, 10);
    const todayStr = new Date(now).toISOString().slice(0, 10);

    const seedDemoState = {
      schema: 1,
      isDemo: true,
      activePersona: 'debt-crusher',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile: {
        preferredName: 'Alex',
        currency: 'USD',
        oopsFundCents: 5000
      },
      accounts: [
        {
          id: 'acct-main',
          name: 'Primary Checking',
          kind: 'checking',
          balanceCents: 152000, // $1,520.00
          balanceAsOf: todayStr
        }
      ],
      income: [
        {
          id: 'inc-1',
          source: 'Primary Paycheck',
          amountCents: 240000,
          frequency: 'biweekly',
          nextPayday: inFourDays
        }
      ],
      bills: [
        { id: 'b-1', name: 'Apartment Rent', amountCents: 75000, dueDate: inThreeDays, paid: false, category: 'housing' },
        { id: 'b-2', name: 'Electric & Wi-Fi', amountCents: 8500, dueDate: inThreeDays, paid: false, category: 'utilities' }
      ],
      debts: [
        { id: 'd-1', name: 'Visa Card Payoff', balanceCents: 180000, minPaymentCents: 6500, aprPercent: 19.99 }
      ],
      savings: [],
      envelopes: [],
      transactions: [
        { id: 'tx-1', date: todayStr, title: 'Groceries', amountCents: 3450, category: 'essentials' },
        { id: 'tx-2', date: todayStr, title: 'Coffee & Snack', amountCents: 550, category: 'fun' }
      ],
      impulseVault: [
        { id: 'iv-1', name: 'Smart Ring Tracker', amountCents: 12900, parkedAt: now - 3600000 * 25 }
      ],
      brainDump: [
        { id: 'bd-1', text: 'Check car insurance renewal before Friday', done: false, createdAt: todayStr }
      ],
      quickSpends: [
        { id: 'qs-1', label: 'Coffee', icon: '☕', amountCents: 450, category: 'fun' },
        { id: 'qs-2', label: 'Takeout', icon: '🥡', amountCents: 1600, category: 'food' },
        { id: 'qs-3', label: 'Pharmacy', icon: '💊', amountCents: 2000, category: 'health' }
      ],
      ui: {
        currentScreen: 'today',
        activeTheme: 'sage-calm',
        soundMuted: false
      }
    };

    sessionStorage.setItem(DEMO_STORE_KEY, JSON.stringify(seedDemoState));
  }

  // Intercept localStorage methods for DEMO_STORE_KEY
  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.getItem = function (key) {
    if (key === DEMO_STORE_KEY) {
      return sessionStorage.getItem(DEMO_STORE_KEY);
    }
    return originalGetItem(key);
  };

  localStorage.setItem = function (key, value) {
    if (key === DEMO_STORE_KEY) {
      sessionStorage.setItem(DEMO_STORE_KEY, value);
      return;
    }
    originalSetItem(key, value);
  };

  localStorage.removeItem = function (key) {
    if (key === DEMO_STORE_KEY) {
      sessionStorage.removeItem(DEMO_STORE_KEY);
      return;
    }
    originalRemoveItem(key);
  };

  // 3. Conversion Modal Logic for gated features (Backup export/import)
  window.openDemoGate = function (featureName) {
    const modal = document.getElementById('etsy-demo-gate-modal');
    if (modal) {
      const title = document.getElementById('etsy-gate-modal-title');
      if (title && featureName) title.textContent = featureName;
      modal.classList.add('active');
    }
  };

  window.closeDemoGate = function () {
    const modal = document.getElementById('etsy-demo-gate-modal');
    if (modal) modal.classList.remove('active');
  };

  document.addEventListener('DOMContentLoaded', function () {
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
      exportBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.openDemoGate('Data Export & Personal Backups');
      };
    }

    const restoreBtn = document.getElementById('btn-import-backup');
    if (restoreBtn) {
      restoreBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.openDemoGate('Cloud/Local Backup Restoration');
      };
    }
  });
})();
