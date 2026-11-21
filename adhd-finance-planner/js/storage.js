/**
 * ADHD Finance Planner — State, Validation, Sanitization, Anti-Double-Counting & Clean-Slate Storage Engine
 * Pure functions over a plain data object; localStorage is injected so Node tests run deterministically.
 * Shared byte-for-byte across all 3 editions for strict logic parity.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./engine.js'));
  } else {
    root.FPStorage = factory(root.FPEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var ACCOUNT_TYPES = ['checking', 'savings', 'buffer', 'debt'];
  var BILL_STATUSES = ['open', 'paid', 'dropped'];
  var SUB_STATUSES = ['active', 'cancelled'];
  var CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'];
  var BUCKET_COLORS = ['#2d5a44', '#0284c7', '#d97706', '#8b5cf6', '#e11d48', '#0d9488'];

  function cleanText(v, max) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/[\u0000-\u001f]/g, ' ')
      .trim()
      .slice(0, max || 120);
  }

  function defaultSettings(today) {
    var t = E.isValidDate(today) ? today : E.todayStr();
    return {
      theme: '',
      currency: 'USD',
      splitPreset: 'balanced',
      nextPayday: E.addDays(t, 14),
      defaultPaycheckCents: 240000,
      monthlySurvivalCents: 220000,
      oopsBufferCents: 5000,
      sound: true,
      onboarded: false,
      fog: false,
      isSampleSeed: false,
      seqCounter: 10
    };
  }

  function getCleanSlateData(today) {
    var t = E.isValidDate(today) ? today : E.todayStr();
    return {
      version: SCHEMA_VERSION,
      settings: defaultSettings(t),
      accounts: [
        {
          id: 'acct_main',
          name: 'Primary Checking',
          type: 'checking',
          balanceCents: 0,
          balanceAsOf: t,
          updatedSeq: 1
        }
      ],
      bills: [],
      subscriptions: [],
      buckets: [],
      transactions: [],
      paychecks: []
    };
  }

  function defaultData(today) {
    return getCleanSlateData(today);
  }

  /**
   * Generates realistic sample data for interactive onboarding tours and demo exploration.
   * All sample records carry isSample: true so post-tour clean slate (Rule-22) can purge them cleanly.
   */
  function getSampleData(today) {
    var t = E.isValidDate(today) ? today : E.todayStr();
    var d = getCleanSlateData(t);
    d.settings.isSampleSeed = true;
    d.settings.nextPayday = E.addDays(t, 10);
    d.settings.defaultPaycheckCents = 240000;
    d.settings.monthlySurvivalCents = 220000;
    d.settings.oopsBufferCents = 5000;

    d.accounts = [
      { id: 'acct_main', name: 'Primary Checking', type: 'checking', balanceCents: 185000, balanceAsOf: t, updatedSeq: 2, isSample: true },
      { id: 'acct_save', name: 'High-Yield Safety Buffer', type: 'savings', balanceCents: 320000, balanceAsOf: t, updatedSeq: 2, isSample: true },
      { id: 'acct_card', name: ' Everyday Rewards Card', type: 'debt', balanceCents: 42000, balanceAsOf: t, updatedSeq: 2, isSample: true }
    ];

    d.bills = [
      { id: 'bill_1', title: 'Apartment Rent / Housing', amountCents: 95000, due: E.addDays(t, 5), category: 'Housing', weekendEarly: true, autopay: true, status: 'open', paidAt: '', isSample: true },
      { id: 'bill_2', title: 'Electric & Fiber Internet', amountCents: 11500, due: E.addDays(t, 2), category: 'Utilities', weekendEarly: false, autopay: false, status: 'open', paidAt: '', isSample: true },
      { id: 'bill_3', title: 'Mobile Phone Plan', amountCents: 6500, due: E.addDays(t, -1), category: 'Utilities', weekendEarly: false, autopay: false, status: 'open', paidAt: '', isSample: true }
    ];

    d.subscriptions = [
      { id: 'sub_1', name: 'AI Design Pro (7-Day Free Trial)', amountCents: 2900, cycle: 'monthly', nextDate: E.addDays(t, 2), leadDays: 3, isTrial: true, category: 'Software', status: 'active', cancelledAt: '', isSample: true },
      { id: 'sub_2', name: 'Streaming Bundle Ultra', amountCents: 2299, cycle: 'monthly', nextDate: E.addDays(t, 6), leadDays: 3, isTrial: false, category: 'Entertainment', status: 'active', cancelledAt: '', isSample: true },
      { id: 'sub_3', name: 'Unused Cloud Storage Box', amountCents: 1199, cycle: 'monthly', nextDate: E.addDays(t, 12), leadDays: 3, isTrial: false, category: 'Software', status: 'cancelled', cancelledAt: t, isSample: true }
    ];

    d.buckets = [
      { id: 'bkt_1', name: 'Car Repair & Tires Sinking Fund', targetCents: 120000, savedCents: 45000, monthlyHoldCents: 10000, autoHold: true, color: '#2d5a44', isSample: true },
      { id: 'bkt_2', name: 'Annual ADHD Tax & Renewals Cushion', targetCents: 60000, savedCents: 30000, monthlyHoldCents: 5000, autoHold: true, color: '#d97706', isSample: true },
      { id: 'bkt_3', name: 'Guilt-Free Cozy Weekend Getaway', targetCents: 80000, savedCents: 25000, monthlyHoldCents: 5000, autoHold: false, color: '#0284c7', isSample: true }
    ];

    d.transactions = [
      { id: 'tx_sample_1', accountId: 'acct_main', title: 'Iced Oat Latte & Breakfast Wrap', amountCents: 1150, kind: 'spend', category: 'Dopamine & Food', date: t, seq: 3, isSample: true }
    ];

    d.paychecks = [];
    return d;
  }

  /**
   * Transitions sample seed data to a clean empty slate upon tour completion/skip (Rule-22),
   * while preserving any custom non-sample records added by the user during the tour.
   */
  function cleanSlate(data, today, forceWipeAll) {
    var t = E.isValidDate(today) ? today : E.todayStr();
    if (forceWipeAll || !data || typeof data !== 'object') {
      var fresh = getCleanSlateData(t);
      if (data && data.settings) {
        fresh.settings.theme = data.settings.theme || '';
        fresh.settings.sound = data.settings.sound !== false;
        fresh.settings.onboarded = true;
      }
      return fresh;
    }

    data.bills = (Array.isArray(data.bills) ? data.bills : []).filter(function (b) { return b && !b.isSample; });
    data.subscriptions = (Array.isArray(data.subscriptions) ? data.subscriptions : []).filter(function (s) { return s && !s.isSample; });
    data.buckets = (Array.isArray(data.buckets) ? data.buckets : []).filter(function (b) { return b && !b.isSample; });
    data.transactions = (Array.isArray(data.transactions) ? data.transactions : []).filter(function (tx) { return tx && !tx.isSample; });
    data.paychecks = (Array.isArray(data.paychecks) ? data.paychecks : []).filter(function (p) { return p && !p.isSample; });
    data.accounts = (Array.isArray(data.accounts) ? data.accounts : []).filter(function (a) { return a && !a.isSample; });

    if (data.accounts.length === 0) {
      data.accounts.push({
        id: 'acct_main',
        name: 'Primary Checking',
        type: 'checking',
        balanceCents: 0,
        balanceAsOf: t,
        updatedSeq: ++data.settings.seqCounter
      });
    }
    data.settings.isSampleSeed = false;
    data.settings.onboarded = true;
    return data;
  }

  // ---------- Sanitization & Schema Migration ----------
  function sanitize(raw, today) {
    var t = E.isValidDate(today) ? today : E.todayStr();
    var data = getCleanSlateData(t);
    if (!raw || typeof raw !== 'object') return data;

    var s = raw.settings || {};
    data.settings.theme = cleanText(s.theme, 30);
    data.settings.currency = E.CURRENCY_SYMBOLS[s.currency] ? s.currency : 'USD';
    data.settings.splitPreset = E.SPLIT_PRESETS[s.splitPreset] ? s.splitPreset : 'balanced';
    data.settings.nextPayday = E.isValidDate(s.nextPayday) ? s.nextPayday : E.addDays(t, 14);
    data.settings.defaultPaycheckCents = E.clampNum(s.defaultPaycheckCents, 0, 1000000000, 240000);
    data.settings.monthlySurvivalCents = E.clampNum(s.monthlySurvivalCents, 10000, 1000000000, 220000);
    data.settings.oopsBufferCents = E.clampNum(s.oopsBufferCents, 0, 100000000, 5000);
    data.settings.sound = s.sound === undefined ? true : !!s.sound;
    data.settings.onboarded = !!s.onboarded;
    data.settings.fog = !!s.fog;
    data.settings.isSampleSeed = !!s.isSampleSeed;
    data.settings.seqCounter = E.clampNum(s.seqCounter, 1, 1000000000, 10);

    var acctIds = {};
    var cleanAccounts = [];
    (Array.isArray(raw.accounts) ? raw.accounts : []).forEach(function (a) {
      if (!a || !cleanText(a.name, 60)) return;
      var id = cleanText(a.id, 60) || E.uid('acct');
      if (acctIds[id]) return;
      acctIds[id] = true;
      var type = ACCOUNT_TYPES.indexOf(a.type) >= 0 ? a.type : 'checking';
      cleanAccounts.push({
        id: id,
        name: cleanText(a.name, 60),
        type: type,
        balanceCents: E.clampNum(a.balanceCents, -1000000000, 1000000000, 0),
        balanceAsOf: E.isValidDate(a.balanceAsOf) ? a.balanceAsOf : t,
        updatedSeq: E.clampNum(a.updatedSeq, 0, 1000000000, 1),
        isSample: !!a.isSample
      });
    });

    if (cleanAccounts.length === 0) {
      cleanAccounts.push(data.accounts[0]);
      acctIds[data.accounts[0].id] = true;
    }
    data.accounts = cleanAccounts;

    var billIds = {};
    (Array.isArray(raw.bills) ? raw.bills : []).forEach(function (b) {
      if (!b || !cleanText(b.title, 120) || !E.isValidDate(b.due)) return;
      var id = cleanText(b.id, 60) || E.uid('bill');
      if (billIds[id]) return;
      billIds[id] = true;
      var status = BILL_STATUSES.indexOf(b.status) >= 0 ? b.status : 'open';
      data.bills.push({
        id: id,
        title: cleanText(b.title, 120),
        amountCents: E.clampNum(b.amountCents, 0, 1000000000, 0),
        due: b.due,
        category: cleanText(b.category, 40) || 'Bills',
        weekendEarly: !!b.weekendEarly,
        autopay: !!b.autopay,
        status: status,
        paidAt: status === 'paid' ? cleanText(b.paidAt, 30) : '',
        isSample: !!b.isSample
      });
    });

    var subIds = {};
    (Array.isArray(raw.subscriptions) ? raw.subscriptions : []).forEach(function (sub) {
      if (!sub || !cleanText(sub.name, 120) || !E.isValidDate(sub.nextDate)) return;
      var id = cleanText(sub.id, 60) || E.uid('sub');
      if (subIds[id]) return;
      subIds[id] = true;
      var cycle = CYCLES.indexOf(sub.cycle) >= 0 ? sub.cycle : 'monthly';
      var status = SUB_STATUSES.indexOf(sub.status) >= 0 ? sub.status : 'active';
      data.subscriptions.push({
        id: id,
        name: cleanText(sub.name, 120),
        amountCents: E.clampNum(sub.amountCents, 0, 1000000000, 0),
        cycle: cycle,
        nextDate: sub.nextDate,
        leadDays: E.clampNum(sub.leadDays, 1, 30, 3),
        isTrial: !!sub.isTrial,
        category: cleanText(sub.category, 40) || 'Subscriptions',
        status: status,
        cancelledAt: status === 'cancelled' ? cleanText(sub.cancelledAt, 30) : '',
        isSample: !!sub.isSample
      });
    });

    var bktIds = {};
    (Array.isArray(raw.buckets) ? raw.buckets : []).forEach(function (bk, idx) {
      if (!bk || !cleanText(bk.name, 80)) return;
      var id = cleanText(bk.id, 60) || E.uid('bkt');
      if (bktIds[id]) return;
      bktIds[id] = true;
      data.buckets.push({
        id: id,
        name: cleanText(bk.name, 80),
        targetCents: E.clampNum(bk.targetCents, 0, 1000000000, 50000),
        savedCents: E.clampNum(bk.savedCents, 0, 1000000000, 0),
        monthlyHoldCents: E.clampNum(bk.monthlyHoldCents, 0, 1000000000, 0),
        autoHold: !!bk.autoHold,
        color: cleanText(bk.color, 12) || BUCKET_COLORS[idx % BUCKET_COLORS.length],
        isSample: !!bk.isSample
      });
    });

    var txIds = {};
    (Array.isArray(raw.transactions) ? raw.transactions : []).forEach(function (tx) {
      if (!tx || !cleanText(tx.title, 120) || !E.isValidDate(tx.date)) return;
      var id = cleanText(tx.id, 60) || E.uid('tx');
      if (txIds[id]) return;
      if (tx.accountId && !acctIds[tx.accountId]) return;
      txIds[id] = true;
      data.transactions.push({
        id: id,
        accountId: tx.accountId || data.accounts[0].id,
        title: cleanText(tx.title, 120),
        amountCents: E.clampNum(tx.amountCents, 0, 1000000000, 0),
        kind: tx.kind === 'income' ? 'income' : 'spend',
        category: cleanText(tx.category, 40) || 'Dopamine',
        date: tx.date,
        seq: E.clampNum(tx.seq, 0, 1000000000, 0),
        isSample: !!tx.isSample
      });
    });

    var payIds = {};
    (Array.isArray(raw.paychecks) ? raw.paychecks : []).forEach(function (p) {
      if (!p || !E.isValidDate(p.date)) return;
      var id = cleanText(p.id, 60) || E.uid('pay');
      if (payIds[id]) return;
      payIds[id] = true;
      data.paychecks.push({
        id: id,
        label: cleanText(p.label, 80) || 'Paycheck',
        amountCents: E.clampNum(p.amountCents, 0, 1000000000, 0),
        preset: E.SPLIT_PRESETS[p.preset] ? p.preset : 'balanced',
        billsCents: E.clampNum(p.billsCents, 0, 1000000000, 0),
        bucketsCents: E.clampNum(p.bucketsCents, 0, 1000000000, 0),
        bufferCents: E.clampNum(p.bufferCents, 0, 1000000000, 0),
        dopamineCents: E.clampNum(p.dopamineCents, 0, 1000000000, 0),
        date: p.date,
        isSample: !!p.isSample
      });
    });

    return data;
  }

  // ---------- Persistence ----------
  function load(backend, key, today) {
    try {
      var raw = backend.getItem(key);
      if (!raw) return defaultData(today);
      return sanitize(JSON.parse(raw), today);
    } catch (e) {
      return defaultData(today);
    }
  }

  function save(backend, key, data) {
    try {
      backend.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function exportJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(text, today) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.bills) && !Array.isArray(parsed.accounts))) {
      throw new Error('Invalid ADHD Finance Planner backup file');
    }
    return sanitize(parsed, today);
  }

  function nextSeq(data) {
    if (!data.settings) data.settings = defaultSettings();
    data.settings.seqCounter = E.clampNum(data.settings.seqCounter, 1, 1000000000, 10) + 1;
    return data.settings.seqCounter;
  }

  // ---------- Account Mutations & Anti-Double-Counting ----------
  function findAccount(data, id) {
    var list = data.accounts || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /**
   * Sets an account's baseline balance as of dateStr.
   * Increments updatedSeq past all previously logged transactions so earlier transactions
   * on the same day are NEVER double-deducted.
   */
  function setAccountBalance(data, accountId, amountCents, dateStr) {
    var acct = findAccount(data, accountId || 'acct_main') || (data.accounts && data.accounts[0]);
    if (!acct) return null;
    acct.balanceCents = E.clampNum(amountCents, -1000000000, 1000000000, 0);
    if (E.isValidDate(dateStr)) acct.balanceAsOf = dateStr;
    acct.updatedSeq = nextSeq(data);
    acct.isSample = false;
    return acct;
  }

  function addAccount(data, f, today) {
    var name = cleanText(f && f.name, 60);
    if (!name) return null;
    var type = ACCOUNT_TYPES.indexOf(f.type) >= 0 ? f.type : 'checking';
    var t = E.isValidDate(today) ? today : E.todayStr();
    var a = {
      id: cleanText(f.id, 60) || E.uid('acct'),
      name: name,
      type: type,
      balanceCents: E.clampNum(f.balanceCents, -1000000000, 1000000000, 0),
      balanceAsOf: E.isValidDate(f.balanceAsOf) ? f.balanceAsOf : t,
      updatedSeq: nextSeq(data),
      isSample: false
    };
    data.accounts.push(a);
    return a;
  }

  function deleteAccount(data, id) {
    if (!data || !Array.isArray(data.accounts)) return false;
    data.accounts = data.accounts.filter(function (a) { return a.id !== id; });
    data.transactions = (data.transactions || []).filter(function (tx) { return tx.accountId !== id; });
    if (data.accounts.length === 0) {
      data.accounts.push({
        id: 'acct_main',
        name: 'Primary Checking',
        type: 'checking',
        balanceCents: 0,
        balanceAsOf: E.todayStr(),
        updatedSeq: nextSeq(data)
      });
    }
    return true;
  }

  // ---------- Transaction Mutations (Idempotent) ----------
  function logTransaction(data, f) {
    if (!f || typeof f !== 'object') return null;
    var title = cleanText(f.title, 120);
    var amt = E.clampNum(f.amountCents, 0, 1000000000, 0);
    var date = E.isValidDate(f.date) ? f.date : E.todayStr();
    if (!title || amt <= 0) return null;

    var id = cleanText(f.id, 60) || E.uid('tx');
    for (var i = 0; i < data.transactions.length; i++) {
      if (data.transactions[i].id === id) return data.transactions[i];
    }

    var acctId = (f.accountId && findAccount(data, f.accountId))
      ? f.accountId
      : (data.accounts[0] ? data.accounts[0].id : 'acct_main');

    var tx = {
      id: id,
      accountId: acctId,
      title: title,
      amountCents: amt,
      kind: f.kind === 'income' ? 'income' : 'spend',
      category: cleanText(f.category, 40) || 'Dopamine',
      date: date,
      seq: nextSeq(data),
      isSample: false
    };
    data.transactions.unshift(tx);
    return tx;
  }

  function deleteTransaction(data, id) {
    var before = data.transactions.length;
    data.transactions = data.transactions.filter(function (tx) { return tx.id !== id; });
    return data.transactions.length < before;
  }

  // ---------- Bill Mutations (Two-Way Completion) ----------
  function findBill(data, id) {
    for (var i = 0; i < data.bills.length; i++) if (data.bills[i].id === id) return data.bills[i];
    return null;
  }

  function addBill(data, f) {
    if (!f || typeof f !== 'object') return null;
    var title = cleanText(f.title, 120);
    var amt = E.clampNum(f.amountCents, 0, 1000000000, 0);
    if (!title || !E.isValidDate(f.due) || amt <= 0) return null;
    var b = {
      id: cleanText(f.id, 60) || E.uid('bill'),
      title: title,
      amountCents: amt,
      due: f.due,
      category: cleanText(f.category, 40) || 'Bills',
      weekendEarly: !!f.weekendEarly,
      autopay: !!f.autopay,
      status: 'open',
      paidAt: '',
      isSample: false
    };
    data.bills.push(b);
    return b;
  }

  function markBillPaid(data, id, stampStr) {
    var b = findBill(data, id);
    if (!b || b.status === 'paid') return false;
    b.status = 'paid';
    b.paidAt = cleanText(stampStr, 30) || E.todayStr();
    return true;
  }

  function reopenBill(data, id) {
    var b = findBill(data, id);
    if (!b || b.status === 'open') return false;
    b.status = 'open';
    b.paidAt = '';
    return true;
  }

  function deleteBill(data, id) {
    var before = data.bills.length;
    data.bills = data.bills.filter(function (b) { return b.id !== id; });
    return data.bills.length < before;
  }

  // ---------- Subscription & ADHD Tax Mutations ----------
  function findSubscription(data, id) {
    for (var i = 0; i < data.subscriptions.length; i++) if (data.subscriptions[i].id === id) return data.subscriptions[i];
    return null;
  }

  function addSubscription(data, f) {
    if (!f || typeof f !== 'object') return null;
    var name = cleanText(f.name, 120);
    var amt = E.clampNum(f.amountCents, 0, 1000000000, 0);
    if (!name || !E.isValidDate(f.nextDate) || amt <= 0) return null;
    var sub = {
      id: cleanText(f.id, 60) || E.uid('sub'),
      name: name,
      amountCents: amt,
      cycle: CYCLES.indexOf(f.cycle) >= 0 ? f.cycle : 'monthly',
      nextDate: f.nextDate,
      leadDays: E.clampNum(f.leadDays, 1, 30, 3),
      isTrial: !!f.isTrial,
      category: cleanText(f.category, 40) || 'Subscriptions',
      status: 'active',
      cancelledAt: '',
      isSample: false
    };
    data.subscriptions.push(sub);
    return sub;
  }

  function cancelSubscription(data, id, stampStr) {
    var sub = findSubscription(data, id);
    if (!sub || sub.status === 'cancelled') return false;
    sub.status = 'cancelled';
    sub.cancelledAt = cleanText(stampStr, 30) || E.todayStr();
    return true;
  }

  function reactivateSubscription(data, id) {
    var sub = findSubscription(data, id);
    if (!sub || sub.status !== 'cancelled') return false;
    sub.status = 'active';
    sub.cancelledAt = '';
    return true;
  }

  function deleteSubscription(data, id) {
    var before = data.subscriptions.length;
    data.subscriptions = data.subscriptions.filter(function (s) { return s.id !== id; });
    return data.subscriptions.length < before;
  }

  // ---------- Sinking Bucket Mutations ----------
  function findBucket(data, id) {
    for (var i = 0; i < data.buckets.length; i++) if (data.buckets[i].id === id) return data.buckets[i];
    return null;
  }

  function addBucket(data, f) {
    if (!f || typeof f !== 'object') return null;
    var name = cleanText(f.name, 80);
    var target = E.clampNum(f.targetCents, 100, 1000000000, 50000);
    if (!name) return null;
    var b = {
      id: cleanText(f.id, 60) || E.uid('bkt'),
      name: name,
      targetCents: target,
      savedCents: E.clampNum(f.savedCents, 0, 1000000000, 0),
      monthlyHoldCents: E.clampNum(f.monthlyHoldCents, 0, 1000000000, 0),
      autoHold: f.autoHold !== undefined ? !!f.autoHold : true,
      color: cleanText(f.color, 12) || BUCKET_COLORS[data.buckets.length % BUCKET_COLORS.length],
      isSample: false
    };
    data.buckets.push(b);
    return b;
  }

  function fundBucket(data, id, deltaCents) {
    var b = findBucket(data, id);
    if (!b) return null;
    var d = E.clampNum(deltaCents, -1000000000, 1000000000, 0);
    b.savedCents = Math.max(0, b.savedCents + d);
    return b.savedCents;
  }

  function deleteBucket(data, id) {
    var before = data.buckets.length;
    data.buckets = data.buckets.filter(function (b) { return b.id !== id; });
    return data.buckets.length < before;
  }

  // ---------- Paycheck Autopilot Allocation (Idempotent by paycheckId) ----------
  function applyPaycheckSplit(data, f) {
    if (!f || typeof f !== 'object') return null;
    var amt = E.clampNum(f.amountCents, 0, 1000000000, 0);
    if (amt <= 0) return null;
    var date = E.isValidDate(f.date) ? f.date : E.todayStr();
    var id = cleanText(f.id, 60) || E.uid('pay');

    for (var i = 0; i < data.paychecks.length; i++) {
      if (data.paychecks[i].id === id) return data.paychecks[i];
    }

    var presetKey = E.SPLIT_PRESETS[f.preset] ? f.preset : (data.settings.splitPreset || 'balanced');
    var pulse = E.financePulse(data, date);
    var split = E.splitPaycheck(amt, presetKey, pulse.upcomingObligationsCents);

    var record = {
      id: id,
      label: cleanText(f.label, 80) || 'Paycheck Deposit',
      amountCents: amt,
      preset: presetKey,
      billsCents: split.billsCents,
      bucketsCents: split.bucketsCents,
      bufferCents: split.bufferCents,
      dopamineCents: split.dopamineCents,
      date: date,
      isSample: false
    };
    data.paychecks.unshift(record);

    // Log income to primary checking
    logTransaction(data, {
      id: 'tx_' + id,
      accountId: data.accounts[0] ? data.accounts[0].id : 'acct_main',
      title: record.label,
      amountCents: amt,
      kind: 'income',
      category: 'Paycheck',
      date: date
    });

    // Distribute bucketsCents across existing sinking buckets if any
    if (data.buckets.length > 0 && split.bucketsCents > 0) {
      var perBucket = Math.floor(split.bucketsCents / data.buckets.length);
      var rem = split.bucketsCents - (perBucket * data.buckets.length);
      for (var k = 0; k < data.buckets.length; k++) {
        data.buckets[k].savedCents += perBucket + (k === 0 ? rem : 0);
      }
    }

    return record;
  }

  // ---------- Calm Financial Triage (Catch-Up Mode) ----------
  function triageItem(data, kind, id, action, newDateStr) {
    if (kind === 'subscription') {
      var sub = findSubscription(data, id);
      if (!sub) return false;
      if (action === 'cancel') return cancelSubscription(data, id, E.todayStr());
      if (action === 'reschedule') {
        if (!E.isValidDate(newDateStr)) return false;
        sub.nextDate = newDateStr;
        sub.isTrial = false;
        return true;
      }
      if (action === 'cover') {
        sub.nextDate = sub.cycle === 'weekly' ? E.addDays(sub.nextDate, 7) : E.addMonths(sub.nextDate, 1);
        sub.isTrial = false;
        return true;
      }
      return false;
    }

    if (kind === 'bill') {
      var bill = findBill(data, id);
      if (!bill) return false;
      if (action === 'cover') return markBillPaid(data, id, E.todayStr());
      if (action === 'reschedule') {
        if (!E.isValidDate(newDateStr)) return false;
        bill.due = newDateStr;
        return true;
      }
      if (action === 'cancel') {
        bill.status = 'dropped';
        return true;
      }
      return false;
    }
    return false;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    BUCKET_COLORS: BUCKET_COLORS,
    defaultSettings: defaultSettings,
    getCleanSlateData: getCleanSlateData,
    defaultData: defaultData,
    getSampleData: getSampleData,
    cleanSlate: cleanSlate,
    sanitize: sanitize,
    load: load,
    save: save,
    exportJSON: exportJSON,
    importJSON: importJSON,
    nextSeq: nextSeq,
    findAccount: findAccount,
    setAccountBalance: setAccountBalance,
    addAccount: addAccount,
    deleteAccount: deleteAccount,
    logTransaction: logTransaction,
    deleteTransaction: deleteTransaction,
    findBill: findBill,
    addBill: addBill,
    markBillPaid: markBillPaid,
    reopenBill: reopenBill,
    deleteBill: deleteBill,
    findSubscription: findSubscription,
    addSubscription: addSubscription,
    cancelSubscription: cancelSubscription,
    reactivateSubscription: reactivateSubscription,
    deleteSubscription: deleteSubscription,
    findBucket: findBucket,
    addBucket: addBucket,
    fundBucket: fundBucket,
    deleteBucket: deleteBucket,
    applyPaycheckSplit: applyPaycheckSplit,
    triageItem: triageItem
  };
});
