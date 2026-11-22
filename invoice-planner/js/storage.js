/**
 * Invoice Planner — State, Validation, Sanitization, Anti-Double-Counting & Clean-Slate Storage Engine
 * Pure functions over a plain data object; localStorage is injected so Node tests run deterministically.
 * Shared byte-for-byte across all 3 editions for strict logic parity.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./engine.js'));
  } else {
    root.IPStorage = factory(root.IPEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var ACCOUNT_TYPES = ['checking', 'tax', 'reserve'];
  var INVOICE_STATUSES = ['draft', 'sent', 'paid'];
  var RETAINER_STATUSES = ['active', 'paused'];
  var CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'];
  var TERMS = ['receipt', 'net7', 'net14', 'net30'];

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
      businessName: 'Studio Creative',
      payoutPreset: 'standard',
      defaultTerms: 'net14',
      defaultTaxPct: 25,
      monthlyTargetCents: 500000,
      nextInvoiceSeq: 104,
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
          name: 'Business Checking',
          type: 'checking',
          balanceCents: 0,
          balanceAsOf: t,
          updatedSeq: 1
        },
        {
          id: 'acct_tax',
          name: 'Tax Shield Vault',
          type: 'tax',
          balanceCents: 0,
          balanceAsOf: t,
          updatedSeq: 1
        }
      ],
      invoices: [],
      workItems: [],
      retainers: [],
      transactions: [],
      payouts: []
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
    d.settings.businessName = 'Sage Creative Studio';
    d.settings.defaultTaxPct = 25;
    d.settings.monthlyTargetCents = 500000;

    d.accounts = [
      { id: 'acct_main', name: 'Business Checking', type: 'checking', balanceCents: 340000, balanceAsOf: t, updatedSeq: 2, isSample: true },
      { id: 'acct_tax', name: 'Tax Shield Vault', type: 'tax', balanceCents: 85000, balanceAsOf: t, updatedSeq: 2, isSample: true }
    ];

    d.invoices = [
      {
        id: 'inv_101',
        number: 'INV-101',
        client: 'Northstar Wellness Co.',
        title: 'Brand Identity & Packaging System',
        issueDate: E.addDays(t, -18),
        dueDate: E.addDays(t, -4),
        terms: 'net14',
        weekendEarly: true,
        status: 'sent',
        amountCents: 145000,
        discountPct: 0,
        taxPct: 0,
        depositCents: 0,
        items: [
          { desc: 'Core Brand Strategy & Visual Identity', qty: 1, unitCents: 95000 },
          { desc: 'Packaging Die-Line & Print Prep', qty: 1, unitCents: 50000 }
        ],
        notes: 'Thank you for your collaboration!',
        paidAt: '',
        isSample: true
      },
      {
        id: 'inv_102',
        number: 'INV-102',
        client: 'Lumen Botanicals',
        title: 'Shopify Landing Page & Conversion Audit',
        issueDate: E.addDays(t, -9),
        dueDate: E.addDays(t, 5),
        terms: 'net14',
        weekendEarly: true,
        status: 'sent',
        amountCents: 120000,
        discountPct: 0,
        taxPct: 0,
        depositCents: 30000,
        items: [
          { desc: 'UX Wireframe & High-Converting Product Page', qty: 1, unitCents: 120000 }
        ],
        notes: '25% deposit received; balance due Net 14.',
        paidAt: '',
        isSample: true
      },
      {
        id: 'inv_103',
        number: 'INV-103',
        client: 'Kindred Coffee Roasters',
        title: 'Monthly Social & Email Retainer',
        issueDate: t,
        dueDate: E.addDays(t, 7),
        terms: 'net7',
        weekendEarly: true,
        status: 'draft',
        amountCents: 85000,
        discountPct: 0,
        taxPct: 0,
        depositCents: 0,
        items: [
          { desc: 'Monthly Content Calendar & 4 Newsletter Campaigns', qty: 1, unitCents: 85000 }
        ],
        notes: 'Draft ready for client review.',
        paidAt: '',
        isSample: true
      },
      {
        id: 'inv_100',
        number: 'INV-100',
        client: 'Aether Audio Labs',
        title: 'UI Icon Suite & Design Tokens',
        issueDate: E.addDays(t, -25),
        dueDate: E.addDays(t, -11),
        terms: 'net14',
        weekendEarly: true,
        status: 'paid',
        amountCents: 160000,
        discountPct: 0,
        taxPct: 0,
        depositCents: 160000,
        items: [
          { desc: 'Custom SVG Icon System (40 Icons)', qty: 1, unitCents: 160000 }
        ],
        notes: 'Paid in full via ACH.',
        paidAt: E.addDays(t, -12),
        isSample: true
      }
    ];

    d.workItems = [
      { id: 'wi_1', client: 'Lumen Botanicals', title: 'Homepage Copy Polish & Mobile QA (3 hrs)', amountCents: 36000, date: t, billed: false, isSample: true },
      { id: 'wi_2', client: 'Northstar Wellness Co.', title: 'Extra Social Launch Banner Resize', amountCents: 18000, date: t, billed: false, isSample: true }
    ];

    d.retainers = [
      { id: 'ret_1', client: 'Kindred Coffee Roasters', title: 'Monthly Growth & Email Retainer', amountCents: 85000, cycle: 'monthly', nextDate: E.addDays(t, 4), status: 'active', isSample: true },
      { id: 'ret_2', client: 'Aether Audio Labs', title: 'Product Design Advisory Retainer', amountCents: 120000, cycle: 'monthly', nextDate: E.addDays(t, 11), status: 'active', isSample: true }
    ];

    d.transactions = [
      { id: 'tx_sample_1', accountId: 'acct_main', title: 'Paid Invoice INV-100 (Aether Audio Labs)', amountCents: 160000, kind: 'inflow', category: 'Invoice Payment', date: E.addDays(t, -12), seq: 2, isSample: true }
    ];

    d.payouts = [];
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

    data.invoices = (Array.isArray(data.invoices) ? data.invoices : []).filter(function (inv) { return inv && !inv.isSample; });
    data.workItems = (Array.isArray(data.workItems) ? data.workItems : []).filter(function (w) { return w && !w.isSample; });
    data.retainers = (Array.isArray(data.retainers) ? data.retainers : []).filter(function (r) { return r && !r.isSample; });
    data.transactions = (Array.isArray(data.transactions) ? data.transactions : []).filter(function (tx) { return tx && !tx.isSample; });
    data.payouts = (Array.isArray(data.payouts) ? data.payouts : []).filter(function (p) { return p && !p.isSample; });
    data.accounts = (Array.isArray(data.accounts) ? data.accounts : []).filter(function (a) { return a && !a.isSample; });

    var hasMain = data.accounts.some(function (a) { return a.id === 'acct_main'; });
    var hasTax = data.accounts.some(function (a) { return a.id === 'acct_tax'; });
    if (!hasMain) {
      data.accounts.unshift({
        id: 'acct_main',
        name: 'Business Checking',
        type: 'checking',
        balanceCents: 0,
        balanceAsOf: t,
        updatedSeq: ++data.settings.seqCounter
      });
    }
    if (!hasTax) {
      data.accounts.push({
        id: 'acct_tax',
        name: 'Tax Shield Vault',
        type: 'tax',
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
    data.settings.businessName = cleanText(s.businessName, 80) || 'Studio Creative';
    data.settings.payoutPreset = E.PAYOUT_PRESETS[s.payoutPreset] ? s.payoutPreset : 'standard';
    data.settings.defaultTerms = TERMS.indexOf(s.defaultTerms) >= 0 ? s.defaultTerms : 'net14';
    data.settings.defaultTaxPct = E.clampNum(s.defaultTaxPct, 0, 60, 25);
    data.settings.monthlyTargetCents = E.clampNum(s.monthlyTargetCents, 10000, 1000000000, 500000);
    data.settings.nextInvoiceSeq = E.clampNum(s.nextInvoiceSeq, 1, 999999, 104);
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
      cleanAccounts = data.accounts.slice();
      cleanAccounts.forEach(function (a) { acctIds[a.id] = true; });
    }
    data.accounts = cleanAccounts;

    var invIds = {};
    (Array.isArray(raw.invoices) ? raw.invoices : []).forEach(function (inv) {
      if (!inv || !cleanText(inv.client, 100) || !E.isValidDate(inv.dueDate)) return;
      var id = cleanText(inv.id, 60) || E.uid('inv');
      if (invIds[id]) return;
      invIds[id] = true;
      var status = INVOICE_STATUSES.indexOf(inv.status) >= 0 ? inv.status : 'draft';
      var cleanItems = [];
      if (Array.isArray(inv.items)) {
        inv.items.forEach(function (it) {
          if (!it || !cleanText(it.desc, 120)) return;
          cleanItems.push({
            desc: cleanText(it.desc, 120),
            qty: E.clampNum(it.qty, 1, 10000, 1),
            unitCents: E.clampNum(it.unitCents, 0, 1000000000, 0)
          });
        });
      }
      var amt = E.clampNum(inv.amountCents, 0, 1000000000, 0);
      if (cleanItems.length === 0 && amt > 0) {
        cleanItems.push({ desc: cleanText(inv.title, 120) || 'Professional Services', qty: 1, unitCents: amt });
      }
      data.invoices.push({
        id: id,
        number: cleanText(inv.number, 30) || 'INV-101',
        client: cleanText(inv.client, 100),
        title: cleanText(inv.title, 120) || 'Client Services',
        issueDate: E.isValidDate(inv.issueDate) ? inv.issueDate : t,
        dueDate: inv.dueDate,
        terms: TERMS.indexOf(inv.terms) >= 0 ? inv.terms : 'net14',
        weekendEarly: inv.weekendEarly !== undefined ? !!inv.weekendEarly : true,
        status: status,
        amountCents: amt,
        discountPct: E.clampNum(inv.discountPct, 0, 100, 0),
        taxPct: E.clampNum(inv.taxPct, 0, 100, 0),
        depositCents: E.clampNum(inv.depositCents, 0, 1000000000, 0),
        items: cleanItems,
        notes: cleanText(inv.notes, 240),
        paidAt: status === 'paid' ? cleanText(inv.paidAt, 30) : '',
        isSample: !!inv.isSample
      });
    });

    var wiIds = {};
    (Array.isArray(raw.workItems) ? raw.workItems : []).forEach(function (w) {
      if (!w || !cleanText(w.title, 120)) return;
      var id = cleanText(w.id, 60) || E.uid('wi');
      if (wiIds[id]) return;
      wiIds[id] = true;
      data.workItems.push({
        id: id,
        client: cleanText(w.client, 100) || 'General Client',
        title: cleanText(w.title, 120),
        amountCents: E.clampNum(w.amountCents, 0, 1000000000, 0),
        date: E.isValidDate(w.date) ? w.date : t,
        billed: !!w.billed,
        isSample: !!w.isSample
      });
    });

    var retIds = {};
    (Array.isArray(raw.retainers) ? raw.retainers : []).forEach(function (r) {
      if (!r || !cleanText(r.client, 100) || !E.isValidDate(r.nextDate)) return;
      var id = cleanText(r.id, 60) || E.uid('ret');
      if (retIds[id]) return;
      retIds[id] = true;
      data.retainers.push({
        id: id,
        client: cleanText(r.client, 100),
        title: cleanText(r.title, 120) || 'Monthly Retainer',
        amountCents: E.clampNum(r.amountCents, 0, 1000000000, 0),
        cycle: CYCLES.indexOf(r.cycle) >= 0 ? r.cycle : 'monthly',
        nextDate: r.nextDate,
        status: RETAINER_STATUSES.indexOf(r.status) >= 0 ? r.status : 'active',
        isSample: !!r.isSample
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
        kind: tx.kind === 'outflow' ? 'outflow' : 'inflow',
        category: cleanText(tx.category, 40) || 'Invoice Payment',
        date: tx.date,
        seq: E.clampNum(tx.seq, 0, 1000000000, 0),
        isSample: !!tx.isSample
      });
    });

    var payIds = {};
    (Array.isArray(raw.payouts) ? raw.payouts : []).forEach(function (p) {
      if (!p || !E.isValidDate(p.date)) return;
      var id = cleanText(p.id, 60) || E.uid('pay');
      if (payIds[id]) return;
      payIds[id] = true;
      data.payouts.push({
        id: id,
        label: cleanText(p.label, 80) || 'Invoice Payout',
        amountCents: E.clampNum(p.amountCents, 0, 1000000000, 0),
        preset: E.PAYOUT_PRESETS[p.preset] ? p.preset : 'standard',
        taxCents: E.clampNum(p.taxCents, 0, 1000000000, 0),
        opsCents: E.clampNum(p.opsCents, 0, 1000000000, 0),
        bufferCents: E.clampNum(p.bufferCents, 0, 1000000000, 0),
        ownerCents: E.clampNum(p.ownerCents, 0, 1000000000, 0),
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
    if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.invoices) && !Array.isArray(parsed.accounts))) {
      throw new Error('Invalid Invoice Planner backup file');
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
   * Increments updatedSeq past all previously logged transactions so earlier payments/outflows
   * on the same day are NEVER double-counted.
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
        name: 'Business Checking',
        type: 'checking',
        balanceCents: 0,
        balanceAsOf: E.todayStr(),
        updatedSeq: nextSeq(data)
      });
    }
    return true;
  }

  // ---------- Ledger Transaction Mutations (Idempotent) ----------
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
      kind: f.kind === 'outflow' ? 'outflow' : 'inflow',
      category: cleanText(f.category, 40) || 'Invoice Payment',
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

  // ---------- Unbilled Work Item Drawer Mutations ----------
  function findWorkItem(data, id) {
    for (var i = 0; i < data.workItems.length; i++) if (data.workItems[i].id === id) return data.workItems[i];
    return null;
  }

  function addWorkItem(data, f) {
    if (!f || typeof f !== 'object') return null;
    var title = cleanText(f.title, 120);
    var amt = E.clampNum(f.amountCents, 0, 1000000000, 0);
    if (!title || amt <= 0) return null;
    var wi = {
      id: cleanText(f.id, 60) || E.uid('wi'),
      client: cleanText(f.client, 100) || 'Client Project',
      title: title,
      amountCents: amt,
      date: E.isValidDate(f.date) ? f.date : E.todayStr(),
      billed: false,
      isSample: false
    };
    data.workItems.unshift(wi);
    return wi;
  }

  function deleteWorkItem(data, id) {
    var before = data.workItems.length;
    data.workItems = data.workItems.filter(function (w) { return w.id !== id; });
    return data.workItems.length < before;
  }

  // ---------- Invoice Studio & Status Mutations (Two-Way Completion) ----------
  function findInvoice(data, id) {
    for (var i = 0; i < data.invoices.length; i++) if (data.invoices[i].id === id) return data.invoices[i];
    return null;
  }

  function nextInvoiceNumber(data) {
    if (!data.settings) data.settings = defaultSettings();
    var seq = E.clampNum(data.settings.nextInvoiceSeq, 1, 999999, 104);
    data.settings.nextInvoiceSeq = seq + 1;
    return 'INV-' + seq;
  }

  function addInvoice(data, f) {
    if (!f || typeof f !== 'object') return null;
    var client = cleanText(f.client, 100);
    var title = cleanText(f.title, 120) || 'Professional Services';
    var issueDate = E.isValidDate(f.issueDate) ? f.issueDate : E.todayStr();
    var terms = TERMS.indexOf(f.terms) >= 0 ? f.terms : (data.settings && data.settings.defaultTerms) || 'net14';
    var weekendEarly = f.weekendEarly !== undefined ? !!f.weekendEarly : true;
    var dueDate = E.isValidDate(f.dueDate) ? f.dueDate : E.computeDueDate(issueDate, terms, weekendEarly);

    var items = [];
    if (Array.isArray(f.items) && f.items.length > 0) {
      f.items.forEach(function (it) {
        if (!it || !cleanText(it.desc, 120)) return;
        var q = E.clampNum(it.qty, 1, 10000, 1);
        var u = E.clampNum(it.unitCents, 0, 1000000000, 0);
        if (u > 0) items.push({ desc: cleanText(it.desc, 120), qty: q, unitCents: u });
      });
    }
    var amt = E.clampNum(f.amountCents, 0, 1000000000, 0);
    if (items.length === 0 && amt > 0) {
      items.push({ desc: title, qty: 1, unitCents: amt });
    }
    if (!client || items.length === 0) return null;

    var subtotal = 0;
    for (var i = 0; i < items.length; i++) subtotal += items[i].qty * items[i].unitCents;

    var inv = {
      id: cleanText(f.id, 60) || E.uid('inv'),
      number: cleanText(f.number, 30) || nextInvoiceNumber(data),
      client: client,
      title: title,
      issueDate: issueDate,
      dueDate: dueDate,
      terms: terms,
      weekendEarly: weekendEarly,
      status: INVOICE_STATUSES.indexOf(f.status) >= 0 ? f.status : 'sent',
      amountCents: subtotal,
      discountPct: E.clampNum(f.discountPct, 0, 100, 0),
      taxPct: E.clampNum(f.taxPct, 0, 100, 0),
      depositCents: E.clampNum(f.depositCents, 0, subtotal, 0),
      items: items,
      notes: cleanText(f.notes, 240),
      paidAt: '',
      isSample: false
    };
    data.invoices.unshift(inv);
    return inv;
  }

  /**
   * Converts an unbilled work item into a formal sent invoice in 1 tap.
   */
  function convertWorkItemToInvoice(data, workItemId, today) {
    var wi = findWorkItem(data, workItemId);
    if (!wi) return null;
    var t = E.isValidDate(today) ? today : E.todayStr();
    var inv = addInvoice(data, {
      client: wi.client,
      title: wi.title,
      issueDate: t,
      terms: (data.settings && data.settings.defaultTerms) || 'net14',
      weekendEarly: true,
      status: 'sent',
      amountCents: wi.amountCents,
      items: [{ desc: wi.title, qty: 1, unitCents: wi.amountCents }]
    });
    if (inv) {
      deleteWorkItem(data, workItemId);
    }
    return inv;
  }

  function markInvoiceSent(data, id) {
    var inv = findInvoice(data, id);
    if (!inv || inv.status === 'paid') return false;
    inv.status = 'sent';
    return true;
  }

  function markInvoicePaid(data, id, stampStr) {
    var inv = findInvoice(data, id);
    if (!inv || inv.status === 'paid') return false;
    var totals = E.calculateInvoiceTotals(inv);
    var date = E.isValidDate(stampStr) ? stampStr : E.todayStr();
    inv.status = 'paid';
    inv.paidAt = date;
    if (totals.balanceDueCents > 0) {
      logTransaction(data, {
        id: 'tx_inv_' + inv.id,
        accountId: 'acct_main',
        title: 'Paid ' + inv.number + ' (' + inv.client + ')',
        amountCents: totals.balanceDueCents,
        kind: 'inflow',
        category: 'Invoice Payment',
        date: date
      });
    }
    return true;
  }

  function reopenInvoice(data, id) {
    var inv = findInvoice(data, id);
    if (!inv || inv.status !== 'paid') return false;
    inv.status = 'sent';
    inv.paidAt = '';
    deleteTransaction(data, 'tx_inv_' + inv.id);
    return true;
  }

  function rescheduleInvoice(data, id, newDueDateStr) {
    var inv = findInvoice(data, id);
    if (!inv || !E.isValidDate(newDueDateStr)) return false;
    inv.dueDate = newDueDateStr;
    if (inv.status === 'draft') inv.status = 'sent';
    return true;
  }

  function deleteInvoice(data, id) {
    var before = data.invoices.length;
    data.invoices = data.invoices.filter(function (inv) { return inv.id !== id; });
    deleteTransaction(data, 'tx_inv_' + id);
    return data.invoices.length < before;
  }

  // ---------- 1-Tap Paid Payout Autopilot Allocation (Idempotent by payoutId) ----------
  function applyPayoutSplit(data, f) {
    if (!f || typeof f !== 'object') return null;
    var amt = E.clampNum(f.amountCents, 0, 1000000000, 0);
    if (amt <= 0) return null;
    var date = E.isValidDate(f.date) ? f.date : E.todayStr();
    var id = cleanText(f.id, 60) || E.uid('pay');

    for (var i = 0; i < data.payouts.length; i++) {
      if (data.payouts[i].id === id) return data.payouts[i];
    }

    var presetKey = E.PAYOUT_PRESETS[f.preset] ? f.preset : ((data.settings && data.settings.payoutPreset) || 'standard');
    var split = E.splitPayout(amt, presetKey);

    var record = {
      id: id,
      label: cleanText(f.label, 80) || 'Client Invoice Payout',
      amountCents: amt,
      preset: presetKey,
      taxCents: split.taxCents,
      opsCents: split.opsCents,
      bufferCents: split.bufferCents,
      ownerCents: split.ownerCents,
      date: date,
      isSample: false
    };
    data.payouts.unshift(record);

    // Credit taxCents into Tax Shield Vault account
    var taxAcct = findAccount(data, 'acct_tax');
    if (taxAcct && split.taxCents > 0) {
      logTransaction(data, {
        id: 'tx_tax_' + id,
        accountId: 'acct_tax',
        title: 'Tax Shield Reserve · ' + record.label,
        amountCents: split.taxCents,
        kind: 'inflow',
        category: 'Tax Shield',
        date: date
      });
    }

    return record;
  }

  // ---------- Client Retainers & Recurring Billing Mutations ----------
  function findRetainer(data, id) {
    for (var i = 0; i < data.retainers.length; i++) if (data.retainers[i].id === id) return data.retainers[i];
    return null;
  }

  function addRetainer(data, f) {
    if (!f || typeof f !== 'object') return null;
    var client = cleanText(f.client, 100);
    var amt = E.clampNum(f.amountCents, 0, 1000000000, 0);
    if (!client || !E.isValidDate(f.nextDate) || amt <= 0) return null;
    var ret = {
      id: cleanText(f.id, 60) || E.uid('ret'),
      client: client,
      title: cleanText(f.title, 120) || 'Recurring Retainer',
      amountCents: amt,
      cycle: CYCLES.indexOf(f.cycle) >= 0 ? f.cycle : 'monthly',
      nextDate: f.nextDate,
      status: 'active',
      isSample: false
    };
    data.retainers.push(ret);
    return ret;
  }

  function toggleRetainerStatus(data, id) {
    var ret = findRetainer(data, id);
    if (!ret) return false;
    ret.status = ret.status === 'paused' ? 'active' : 'paused';
    return true;
  }

  function deleteRetainer(data, id) {
    var before = data.retainers.length;
    data.retainers = data.retainers.filter(function (r) { return r.id !== id; });
    return data.retainers.length < before;
  }

  function generateRetainerInvoice(data, retainerId, today) {
    var ret = findRetainer(data, retainerId);
    if (!ret) return null;
    var issue = E.isValidDate(today) ? today : E.todayStr();
    var inv = addInvoice(data, {
      client: ret.client,
      title: ret.title,
      issueDate: issue,
      terms: (data.settings && data.settings.defaultTerms) || 'net14',
      weekendEarly: true,
      status: 'sent',
      amountCents: ret.amountCents,
      items: [{ desc: ret.title + ' (' + ret.cycle + ' cycle)', qty: 1, unitCents: ret.amountCents }]
    });
    if (inv) {
      if (ret.cycle === 'weekly') ret.nextDate = E.addDays(ret.nextDate, 7);
      else if (ret.cycle === 'quarterly') ret.nextDate = E.addMonths(ret.nextDate, 3);
      else if (ret.cycle === 'yearly') ret.nextDate = E.addMonths(ret.nextDate, 12);
      else ret.nextDate = E.addMonths(ret.nextDate, 1);
    }
    return inv;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
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
    findWorkItem: findWorkItem,
    addWorkItem: addWorkItem,
    deleteWorkItem: deleteWorkItem,
    findInvoice: findInvoice,
    nextInvoiceNumber: nextInvoiceNumber,
    addInvoice: addInvoice,
    convertWorkItemToInvoice: convertWorkItemToInvoice,
    markInvoiceSent: markInvoiceSent,
    markInvoicePaid: markInvoicePaid,
    reopenInvoice: reopenInvoice,
    rescheduleInvoice: rescheduleInvoice,
    deleteInvoice: deleteInvoice,
    applyPayoutSplit: applyPayoutSplit,
    findRetainer: findRetainer,
    addRetainer: addRetainer,
    toggleRetainerStatus: toggleRetainerStatus,
    deleteRetainer: deleteRetainer,
    generateRetainerInvoice: generateRetainerInvoice
  };
});
