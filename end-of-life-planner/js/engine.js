/**
 * End of Life Planner — Pure Calculation, Date, Readiness & Integrity Engine
 * Zero DOM dependencies. Shared 100% identically across Editions 1, 2, and 3.
 * Enforces: Integer-cent math, anti-double-counting sync, UTC leap-year/weekend dates,
 * weighted readiness scoring, cascade contact unlinking, and non-finite immunity (Gate G-12).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EOLEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '\u20ac',
    GBP: '\u00a3',
    CAD: 'CA$',
    AUD: 'A$'
  };

  var MAX_SAFE_CENTS = 90000000000000; // $900B safety cap

  function safeNumber(v, fallback) {
    var fb = typeof fallback === 'number' && isFinite(fallback) ? fallback : 0;
    if (v === null || v === undefined || v === '') return fb;
    if (typeof v === 'number') return isFinite(v) ? v : fb;
    var cleaned = String(v).replace(/[^0-9.\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return fb;
    var n = Number(cleaned);
    return isFinite(n) ? n : fb;
  }

  function clamp(n, min, max) {
    var v = safeNumber(n, min);
    var lo = safeNumber(min, 0);
    var hi = safeNumber(max, lo);
    if (lo > hi) { var t = lo; lo = hi; hi = t; }
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  /**
   * Parse currency string or number into exact integer cents.
   */
  function parseToCents(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') {
      if (!isFinite(val)) return 0;
      return clamp(Math.round(val * 100), -MAX_SAFE_CENTS, MAX_SAFE_CENTS);
    }
    var str = String(val).trim();
    if (!str) return 0;
    var negative = str.charAt(0) === '-' || (str.charAt(0) === '(' && str.charAt(str.length - 1) === ')');
    var cleaned = str.replace(/[^0-9.]/g, '');
    if (!cleaned) return 0;
    var parts = cleaned.split('.');
    var whole = parseInt(parts[0] || '0', 10);
    if (!isFinite(whole)) return 0;
    var fracStr = (parts[1] || '').slice(0, 3);
    var frac = 0;
    if (fracStr.length === 1) frac = parseInt(fracStr, 10) * 10;
    else if (fracStr.length === 2) frac = parseInt(fracStr, 10);
    else if (fracStr.length >= 3) frac = Math.round(parseInt(fracStr, 10) / 10);
    if (!isFinite(frac)) frac = 0;
    var total = whole * 100 + frac;
    if (negative) total = -total;
    return clamp(total, -MAX_SAFE_CENTS, MAX_SAFE_CENTS);
  }

  /**
   * Format integer cents to clean currency string.
   */
  function formatCents(cents, currency, compact) {
    var sym = CURRENCY_SYMBOLS[currency] || '$';
    var n = safeNumber(cents, 0);
    n = clamp(Math.round(n), -MAX_SAFE_CENTS, MAX_SAFE_CENTS);
    var neg = n < 0;
    var abs = Math.abs(n);
    var dollars = Math.floor(abs / 100);
    var rem = abs % 100;
    var wholeStr = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var body = compact && rem === 0 ? wholeStr : wholeStr + '.' + (rem < 10 ? '0' + rem : String(rem));
    return (neg ? '-' : '') + sym + body;
  }

  function formatPercent(val) {
    var n = clamp(Math.round(safeNumber(val, 0)), 0, 100);
    return n + '%';
  }

  function formatDays(days) {
    var n = safeNumber(days, 0);
    if (!isFinite(n)) return '0 days';
    var r = Math.round(n);
    if (r === 1 || r === -1) return r + ' day';
    return r + ' days';
  }

  // ---------- UTC Calendar & Leap-Year Arithmetic ----------
  function isLeapYear(year) {
    var y = Math.floor(safeNumber(year, 2026));
    return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  }

  function daysInMonthUTC(year, month1Based) {
    var y = Math.floor(safeNumber(year, 2026));
    var m = clamp(Math.floor(safeNumber(month1Based, 1)), 1, 12);
    var table = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return table[m - 1];
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function toISODate(dateObj) {
    var d = dateObj instanceof Date && isFinite(dateObj.getTime()) ? dateObj : new Date();
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function todayLocalISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseISODate(str) {
    if (typeof str !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var da = parseInt(m[3], 10);
    if (mo < 1 || mo > 12) return null;
    var maxD = daysInMonthUTC(y, mo);
    if (da < 1 || da > maxD) return null;
    return Date.UTC(y, mo - 1, da);
  }

  function formatUTCFromMs(ms) {
    if (!isFinite(ms)) return toISODate(new Date());
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function addDaysUTC(iso, days) {
    var base = parseISODate(iso);
    if (base === null) base = parseISODate(todayLocalISO());
    var offset = Math.round(safeNumber(days, 0));
    offset = clamp(offset, -36500, 36500);
    return formatUTCFromMs(base + offset * 86400000);
  }

  function addMonthsUTC(iso, months) {
    var base = parseISODate(iso);
    if (base === null) base = parseISODate(todayLocalISO());
    var d = new Date(base);
    var add = Math.round(safeNumber(months, 0));
    add = clamp(add, -1200, 1200);
    var totalMonths = d.getUTCFullYear() * 12 + d.getUTCMonth() + add;
    var ny = Math.floor(totalMonths / 12);
    var nm = ((totalMonths % 12) + 12) % 12; // 0-based
    var maxD = daysInMonthUTC(ny, nm + 1);
    var nd = Math.min(d.getUTCDate(), maxD);
    return formatUTCFromMs(Date.UTC(ny, nm, nd));
  }

  function daysBetweenUTC(isoA, isoB) {
    var a = parseISODate(isoA);
    var b = parseISODate(isoB);
    if (a === null || b === null) return 0;
    return Math.round((b - a) / 86400000);
  }

  /**
   * Shift Saturday or Sunday backwards to Friday (for business-day estate/review schedules).
   */
  function shiftWeekendToFriday(iso) {
    var ms = parseISODate(iso);
    if (ms === null) return iso;
    var day = new Date(ms).getUTCDay(); // 0=Sun, 6=Sat
    if (day === 6) return formatUTCFromMs(ms - 86400000);
    if (day === 0) return formatUTCFromMs(ms - 2 * 86400000);
    return iso;
  }

  /**
   * Compute next annual/semi-annual vault review date and countdown.
   */
  function calculateReviewSchedule(lastReviewedISO, cadenceMonths, shiftWeekend, todayISO) {
    var today = parseISODate(todayISO) !== null ? todayISO : todayLocalISO();
    var last = parseISODate(lastReviewedISO) !== null ? lastReviewedISO : today;
    var cadence = clamp(Math.round(safeNumber(cadenceMonths, 12)), 1, 60);
    var rawNext = addMonthsUTC(last, cadence);
    var nextDate = shiftWeekend ? shiftWeekendToFriday(rawNext) : rawNext;
    var daysUntil = daysBetweenUTC(today, nextDate);
    var status = daysUntil < 0 ? 'overdue' : daysUntil <= 30 ? 'due-soon' : 'on-track';
    return {
      lastReviewed: last,
      cadenceMonths: cadence,
      rawNextDate: rawNext,
      nextReviewDate: nextDate,
      daysUntil: daysUntil,
      status: status
    };
  }

  // ---------- Anti-Double-Counting Estate & Obligation Engine ----------
  /**
   * Computes exact integer-cent estate totals while enforcing Anti-Double-Counting:
   * When an account balance is explicitly synced/verified on date `balanceAsOf` at sequence `updatedSeq`,
   * any same-day or earlier adjustment with `seq <= updatedSeq` is ALREADY reflected in `balanceCents`
   * and will NOT be double-counted. Only adjustments occurring AFTER the sync (`date > balanceAsOf`,
   * or `date === balanceAsOf && seq > updatedSeq`) apply to the running account estimate.
   */
  function computeEffectiveAccountCents(account, adjustments) {
    if (!account || typeof account !== 'object') return 0;
    var base = Math.round(safeNumber(account.balanceCents, 0));
    var list = Array.isArray(adjustments) ? adjustments : [];
    var asOf = parseISODate(account.balanceAsOf);
    var updSeq = safeNumber(account.updatedSeq, 0);
    var delta = 0;

    for (var i = 0; i < list.length; i++) {
      var adj = list[i];
      if (!adj || adj.accountId !== account.id) continue;
      var amt = Math.round(safeNumber(adj.deltaCents, 0));
      var adjDate = parseISODate(adj.date);
      var adjSeq = safeNumber(adj.seq, 0);
      if (asOf !== null && adjDate !== null) {
        if (adjDate < asOf) continue;
        if (adjDate === asOf && adjSeq <= updSeq) continue;
      } else if (adjSeq <= updSeq) {
        continue;
      }
      delta += amt;
    }
    return clamp(base + delta, -MAX_SAFE_CENTS, MAX_SAFE_CENTS);
  }

  function calculateEstateSummary(accounts, adjustments, autopays) {
    var accts = Array.isArray(accounts) ? accounts : [];
    var adjs = Array.isArray(adjustments) ? adjustments : [];
    var bills = Array.isArray(autopays) ? autopays : [];

    var totalAssetsCents = 0;
    var totalPoliciesCents = 0;
    var totalDebtsCents = 0;
    var accountBreakdown = [];

    for (var i = 0; i < accts.length; i++) {
      var a = accts[i];
      if (!a || typeof a !== 'object') continue;
      var eff = computeEffectiveAccountCents(a, adjs);
      var kind = String(a.kind || 'asset').toLowerCase();
      if (kind === 'debt' || kind === 'liability') {
        var debtAmt = Math.abs(eff);
        totalDebtsCents = clamp(totalDebtsCents + debtAmt, 0, MAX_SAFE_CENTS);
      } else if (kind === 'policy' || kind === 'insurance') {
        var polAmt = Math.max(0, eff);
        totalPoliciesCents = clamp(totalPoliciesCents + polAmt, 0, MAX_SAFE_CENTS);
      } else {
        totalAssetsCents = clamp(totalAssetsCents + eff, -MAX_SAFE_CENTS, MAX_SAFE_CENTS);
      }
      accountBreakdown.push({
        id: a.id || '',
        name: a.name || 'Account',
        kind: kind,
        effectiveCents: eff
      });
    }

    var netEstateCents = clamp(totalAssetsCents + totalPoliciesCents - totalDebtsCents, -MAX_SAFE_CENTS, MAX_SAFE_CENTS);

    var monthlyAutopayCents = 0;
    var activeAutopayCount = 0;
    for (var j = 0; j < bills.length; j++) {
      var b = bills[j];
      if (!b || b.status === 'cancelled') continue;
      activeAutopayCount++;
      var c = Math.max(0, Math.round(safeNumber(b.amountCents, 0)));
      var cycle = String(b.cycle || 'monthly').toLowerCase();
      var monthly = cycle === 'yearly' ? Math.round(c / 12) : cycle === 'quarterly' ? Math.round(c / 3) : cycle === 'weekly' ? Math.round((c * 52) / 12) : c;
      monthlyAutopayCents = clamp(monthlyAutopayCents + monthly, 0, MAX_SAFE_CENTS);
    }

    return {
      totalAssetsCents: totalAssetsCents,
      totalPoliciesCents: totalPoliciesCents,
      totalDebtsCents: totalDebtsCents,
      netEstateCents: netEstateCents,
      monthlyAutopayCents: monthlyAutopayCents,
      annualAutopayCents: clamp(monthlyAutopayCents * 12, 0, MAX_SAFE_CENTS),
      activeAutopayCount: activeAutopayCount,
      accountCount: accts.length,
      accountBreakdown: accountBreakdown
    };
  }

  // ---------- Digital Legacy Tally ----------
  function summarizeDigitalLegacy(digitalAccounts) {
    var list = Array.isArray(digitalAccounts) ? digitalAccounts : [];
    var counts = { total: 0, memorialize: 0, delete: 0, transfer: 0, archive: 0 };
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      counts.total++;
      var action = String(item.directive || 'archive').toLowerCase();
      if (action === 'memorialize') counts.memorialize++;
      else if (action === 'delete') counts.delete++;
      else if (action === 'transfer') counts.transfer++;
      else counts.archive++;
    }
    return counts;
  }

  // ---------- Executor Checklist Progress ----------
  function summarizeExecutorChecklist(tasks) {
    var list = Array.isArray(tasks) ? tasks : [];
    var phases = {
      '24h': { total: 0, done: 0 },
      'week1': { total: 0, done: 0 },
      'month1': { total: 0, done: 0 }
    };
    var total = 0;
    var done = 0;
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (!t) continue;
      total++;
      if (t.completed) done++;
      var p = phases[t.phase] ? t.phase : 'month1';
      phases[p].total++;
      if (t.completed) phases[p].done++;
    }
    var percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total: total, done: done, percent: clamp(percent, 0, 100), phases: phases };
  }

  // ---------- Weighted Readiness Score & Next 5-Minute Micro-Step ----------
  function calculateReadiness(data) {
    var d = data && typeof data === 'object' ? data : {};
    var contacts = Array.isArray(d.contacts) ? d.contacts : [];
    var dependents = Array.isArray(d.dependents) ? d.dependents : [];
    var documents = Array.isArray(d.documents) ? d.documents : [];
    var accounts = Array.isArray(d.accounts) ? d.accounts : [];
    var digital = Array.isArray(d.digital) ? d.digital : [];
    var letters = Array.isArray(d.letters) ? d.letters : [];
    var checklist = Array.isArray(d.checklist) ? d.checklist : [];
    var wishes = d.wishes && typeof d.wishes === 'object' ? d.wishes : {};
    var vaultMeta = d.vaultMeta && typeof d.vaultMeta === 'object' ? d.vaultMeta : {};

    // Pillar 1: Contacts & Care (20 pts)
    var hasExecutor = contacts.some(function (c) { return c && (c.role === 'executor' || c.isFirstCall); });
    var contactsPts = 0;
    if (contacts.length >= 1) contactsPts += 8;
    if (contacts.length >= 2) contactsPts += 6;
    if (hasExecutor) contactsPts += 4;
    if (dependents.length >= 1 || contacts.length >= 3) contactsPts += 2;
    contactsPts = clamp(contactsPts, 0, 20);

    // Pillar 2: Legal Document Map (25 pts)
    var locatedDocs = documents.filter(function (doc) {
      return doc && (doc.status === 'signed' || doc.status === 'located');
    }).length;
    var docRatio = documents.length > 0 ? Math.min(1, locatedDocs / Math.max(4, documents.length)) : 0;
    var docsPts = clamp(Math.round(docRatio * 25), 0, 25);

    // Pillar 3: Estate & Policies (20 pts)
    var hasBankOrAsset = accounts.some(function (a) { return a && a.kind === 'asset'; });
    var hasPolicy = accounts.some(function (a) { return a && a.kind === 'policy'; });
    var estatePts = 0;
    if (accounts.length >= 1) estatePts += 8;
    if (accounts.length >= 3) estatePts += 6;
    if (hasBankOrAsset) estatePts += 3;
    if (hasPolicy) estatePts += 3;
    estatePts = clamp(estatePts, 0, 20);

    // Pillar 4: Digital Legacy (15 pts)
    var hasPwManager = !!(vaultMeta.passwordManager && String(vaultMeta.passwordManager).trim().length >= 2);
    var digitalPts = 0;
    if (hasPwManager) digitalPts += 7;
    if (digital.length >= 1) digitalPts += 4;
    if (digital.length >= 3) digitalPts += 4;
    digitalPts = clamp(digitalPts, 0, 15);

    // Pillar 5: Final Wishes & Letters (10 pts)
    var hasDisposition = !!(wishes.disposition && String(wishes.disposition).trim().length >= 2);
    var hasServiceNotes = !!(wishes.serviceNotes && String(wishes.serviceNotes).trim().length >= 4);
    var wishesPts = 0;
    if (hasDisposition) wishesPts += 4;
    if (hasServiceNotes) wishesPts += 3;
    if (letters.length >= 1) wishesPts += 3;
    wishesPts = clamp(wishesPts, 0, 10);

    // Pillar 6: Executor Preparation (10 pts)
    var execSummary = summarizeExecutorChecklist(checklist);
    var execPts = checklist.length > 0 ? clamp(Math.round((execSummary.done / checklist.length) * 10), 0, 10) : 0;
    if (execPts === 0 && checklist.length > 0 && (locatedDocs > 0 || contacts.length > 0)) {
      // Partial credit for having a customized executor plan initialized
      execPts = Math.min(2, execSummary.done > 0 ? execPts : 0);
    }

    var score = clamp(contactsPts + docsPts + estatePts + digitalPts + wishesPts + execPts, 0, 100);
    var tier = score >= 85 ? 'Peace of Mind Ready' :
               score >= 60 ? 'Well Prepared' :
               score >= 30 ? 'Building Clarity' :
               'Just Starting';

    var pillars = [
      { id: 'contacts', label: 'People & First Calls', points: contactsPts, max: 20, percent: Math.round((contactsPts / 20) * 100), tabId: 'contacts' },
      { id: 'documents', label: 'Legal Document Map', points: docsPts, max: 25, percent: Math.round((docsPts / 25) * 100), tabId: 'vault' },
      { id: 'estate', label: 'Financial & Policies', points: estatePts, max: 20, percent: Math.round((estatePts / 20) * 100), tabId: 'vault' },
      { id: 'digital', label: 'Digital Legacy Keys', points: digitalPts, max: 15, percent: Math.round((digitalPts / 15) * 100), tabId: 'digital' },
      { id: 'wishes', label: 'Final Wishes & Letters', points: wishesPts, max: 10, percent: Math.round((wishesPts / 10) * 100), tabId: 'wishes' },
      { id: 'executor', label: 'Executor Readiness', points: execPts, max: 10, percent: Math.round((execPts / 10) * 100), tabId: 'wishes' }
    ];

    // Determine single gentlest Next 5-Minute Micro-Step
    var nextMicroStep;
    if (contacts.length === 0) {
      nextMicroStep = {
        tabId: 'contacts',
        modalId: 'modal-add-contact',
        title: 'Add 1 First-Call Person (Your Executor or Spouse)',
        reason: 'Start small: naming one trusted person immediately lifts 80% of emergency guesswork.',
        actionLabel: '+ Add First Contact',
        estMinutes: 2
      };
    } else if (locatedDocs === 0) {
      nextMicroStep = {
        tabId: 'vault',
        modalId: 'modal-add-document',
        title: 'Log Where 1 Essential Document Is Stored',
        reason: 'Tell your family where your Will, ID, or House Safe key lives — no legal jargon needed.',
        actionLabel: '+ Map a Document',
        estMinutes: 3
      };
    } else if (accounts.length === 0) {
      nextMicroStep = {
        tabId: 'vault',
        modalId: 'modal-add-account',
        title: 'Record Your Primary Bank or Insurance Provider',
        reason: 'Just the institution name and last 4 digits — never full account numbers or PINs.',
        actionLabel: '+ Add Account / Policy',
        estMinutes: 3
      };
    } else if (!hasPwManager && digital.length === 0) {
      nextMicroStep = {
        tabId: 'digital',
        modalId: 'modal-add-digital',
        title: 'Note Your Password Manager or Primary Email',
        reason: 'Prevent loved ones from being locked out of family photos and critical bills.',
        actionLabel: '+ Add Digital Key',
        estMinutes: 3
      };
    } else if (!hasDisposition) {
      nextMicroStep = {
        tabId: 'wishes',
        modalId: '',
        title: 'Choose Your Burial, Cremation, or Service Preference',
        reason: 'One clear preference spares your family difficult guessing during grief.',
        actionLabel: 'Open Final Wishes',
        estMinutes: 4
      };
    } else if (letters.length === 0) {
      nextMicroStep = {
        tabId: 'wishes',
        modalId: 'modal-add-letter',
        title: 'Write a Short Legacy Note or Heirloom Wish',
        reason: 'Even three warm sentences become a lifelong treasure for someone you love.',
        actionLabel: '+ Write Legacy Note',
        estMinutes: 5
      };
    } else {
      nextMicroStep = {
        tabId: 'settings',
        modalId: '',
        title: 'Print or Save Your Executor Emergency Packet',
        reason: 'Your vault is strong! Keep a fresh printed copy in your safe and tell your executor.',
        actionLabel: 'Open Executor Packet',
        estMinutes: 2
      };
    }

    return {
      score: score,
      tier: tier,
      locatedDocs: locatedDocs,
      totalDocs: documents.length,
      pillars: pillars,
      nextMicroStep: nextMicroStep
    };
  }

  // ---------- Cascade Deletion Integrity (Gate G-12) ----------
  /**
   * Deleting a contact cleanly removes the contact and unlinks any custodian/guardian/beneficiary
   * foreign keys across documents, accounts, dependents, and letters so zero dangling IDs remain.
   */
  function pruneDeletedContact(data, contactId) {
    if (!data || typeof data !== 'object' || !contactId) return data;
    var cid = String(contactId);
    if (Array.isArray(data.contacts)) {
      data.contacts = data.contacts.filter(function (c) { return c && c.id !== cid; });
    }
    if (Array.isArray(data.documents)) {
      data.documents.forEach(function (doc) {
        if (doc && doc.custodianContactId === cid) doc.custodianContactId = '';
      });
    }
    if (Array.isArray(data.accounts)) {
      data.accounts.forEach(function (acc) {
        if (acc && acc.beneficiaryContactId === cid) acc.beneficiaryContactId = '';
      });
    }
    if (Array.isArray(data.dependents)) {
      data.dependents.forEach(function (dep) {
        if (dep && dep.guardianContactId === cid) dep.guardianContactId = '';
      });
    }
    if (Array.isArray(data.letters)) {
      data.letters.forEach(function (letItem) {
        if (letItem && letItem.recipientContactId === cid) letItem.recipientContactId = '';
      });
    }
    return data;
  }

  /**
   * Deleting an account also purges orphaned balance adjustments belonging to that account.
   */
  function pruneDeletedAccount(data, accountId) {
    if (!data || typeof data !== 'object' || !accountId) return data;
    var aid = String(accountId);
    if (Array.isArray(data.accounts)) {
      data.accounts = data.accounts.filter(function (a) { return a && a.id !== aid; });
    }
    if (Array.isArray(data.adjustments)) {
      data.adjustments = data.adjustments.filter(function (adj) { return adj && adj.accountId !== aid; });
    }
    return data;
  }

  return {
    safeNumber: safeNumber,
    clamp: clamp,
    parseToCents: parseToCents,
    formatCents: formatCents,
    formatPercent: formatPercent,
    formatDays: formatDays,
    isLeapYear: isLeapYear,
    daysInMonthUTC: daysInMonthUTC,
    toISODate: toISODate,
    todayLocalISO: todayLocalISO,
    parseISODate: parseISODate,
    addDaysUTC: addDaysUTC,
    addMonthsUTC: addMonthsUTC,
    daysBetweenUTC: daysBetweenUTC,
    shiftWeekendToFriday: shiftWeekendToFriday,
    calculateReviewSchedule: calculateReviewSchedule,
    computeEffectiveAccountCents: computeEffectiveAccountCents,
    calculateEstateSummary: calculateEstateSummary,
    summarizeDigitalLegacy: summarizeDigitalLegacy,
    summarizeExecutorChecklist: summarizeExecutorChecklist,
    calculateReadiness: calculateReadiness,
    pruneDeletedContact: pruneDeletedContact,
    pruneDeletedAccount: pruneDeletedAccount
  };
});
