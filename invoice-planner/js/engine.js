/**
 * Invoice Planner — Pure Invoicing, Tax Payout Splitter, Aging Radar & Retainer Calculation Engine
 * 100% integer-cent arithmetic, UTC calendar math, non-finite immunity (G-12), and anti-double-counting.
 * Shared byte-for-byte across all 3 editions for strict logic parity.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IPEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var _idCounter = 1;
  function uid(prefix) {
    _idCounter = (_idCounter + 1) % 1000000;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + _idCounter.toString(36);
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function plural(n, word) {
    var count = Number.isFinite(Number(n)) ? Math.abs(Math.round(Number(n))) : 0;
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function clampNum(v, min, max, fallback) {
    var n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    var r = Math.round(n);
    if (r < min) return min;
    if (r > max) return max;
    return r;
  }

  // ---------- 1. Integer Cent Currency Engine ----------
  var CURRENCY_SYMBOLS = {
    USD: '$',
    CAD: 'CA$',
    GBP: '£',
    EUR: '€',
    AUD: 'A$'
  };

  /**
   * Parses dollars/strings into integer cents.
   * e.g. "145.99" -> 14599, "$1,250.50" -> 125050, 25 -> 2500.
   * Non-finite, NaN, Infinity, null, booleans return 0.
   */
  function parseCents(val) {
    if (val === null || val === undefined || val === '' || typeof val === 'boolean') return 0;
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) return 0;
      return clampNum(Math.round(val * 100), -10000000000, 10000000000, 0);
    }
    var raw = String(val).trim();
    if (!raw || /infinity|nan/i.test(raw)) return 0;
    var cleaned = raw.replace(/[^0-9.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return 0;
    var num = parseFloat(cleaned);
    if (!Number.isFinite(num)) return 0;
    return clampNum(Math.round(num * 100), -10000000000, 10000000000, 0);
  }

  /**
   * Formats integer cents into a human-readable currency string.
   * Never produces NaN, Infinity, or undefined.
   */
  function fmtCents(cents, currency, signed) {
    var n = Number(cents);
    var safeCents = Number.isFinite(n) ? Math.round(n) : 0;
    var isNeg = safeCents < 0;
    var abs = Math.abs(safeCents);
    var sym = CURRENCY_SYMBOLS[currency] || '$';
    var whole = Math.floor(abs / 100);
    var rem = abs % 100;
    var wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var decStr = (rem < 10 ? '0' : '') + rem;
    var core = sym + wholeStr + '.' + decStr;
    if (isNeg) return '-' + core;
    if (signed && safeCents > 0) return '+' + core;
    return core;
  }

  function fmtMin(m) {
    var n = Number(m);
    if (!Number.isFinite(n) || n <= 0) return '0m';
    var total = Math.round(n);
    var h = Math.floor(total / 60);
    var rem = total % 60;
    if (h === 0) return rem + 'm';
    if (rem === 0) return h + 'h';
    return h + 'h ' + rem + 'm';
  }

  function levelOf(ratio) {
    var r = Number(ratio);
    if (!Number.isFinite(r) || r <= 0) return 'none';
    if (r <= 0.5) return 'light';
    if (r <= 0.85) return 'ok';
    if (r <= 1.0) return 'heavy';
    return 'over';
  }

  // ---------- 2. UTC Calendar, Net Payment Terms & Weekend Shift Arithmetic ----------
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var PAYMENT_TERMS = {
    receipt: { id: 'receipt', label: 'Due on Receipt', days: 0 },
    net7:    { id: 'net7',    label: 'Net 7 Days',     days: 7 },
    net14:   { id: 'net14',   label: 'Net 14 Days',    days: 14 },
    net30:   { id: 'net30',   label: 'Net 30 Days',    days: 30 }
  };

  function todayStr(now) {
    var d = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function isValidDate(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    var parts = str.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === m && dt.getUTCDate() === d;
  }

  function parseUTC(str) {
    if (!isValidDate(str)) return null;
    var p = str.split('-');
    return Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function formatUTC(ms) {
    var dt = new Date(ms);
    var y = dt.getUTCFullYear();
    var m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    var d = String(dt.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function daysBetween(a, b) {
    var msA = parseUTC(a);
    var msB = parseUTC(b);
    if (msA === null || msB === null) return 0;
    return Math.round((msB - msA) / 86400000);
  }

  function addDays(str, delta) {
    var ms = parseUTC(str);
    if (ms === null) ms = parseUTC(todayStr());
    var d = Number.isFinite(Number(delta)) ? Math.round(Number(delta)) : 0;
    return formatUTC(ms + d * 86400000);
  }

  function addMonths(str, months) {
    var valid = isValidDate(str) ? str : todayStr();
    var p = valid.split('-');
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10);
    var d = parseInt(p[2], 10);
    var delta = Number.isFinite(Number(months)) ? Math.round(Number(months)) : 0;
    var targetIdx = (m - 1) + delta;
    var ty = y + Math.floor(targetIdx / 12);
    var tm = ((targetIdx % 12) + 12) % 12 + 1;
    var maxDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    var td = Math.min(d, maxDay);
    return ty + '-' + String(tm).padStart(2, '0') + '-' + String(td).padStart(2, '0');
  }

  function weekdayIndex(str) {
    var ms = parseUTC(str);
    if (ms === null) return 0;
    return new Date(ms).getUTCDay();
  }

  function weekdayShort(str) {
    return WEEKDAYS_SHORT[weekdayIndex(str)] || 'Sun';
  }

  function weekdayName(idx) {
    var i = clampNum(idx, 0, 6, 1);
    return WEEKDAYS_LONG[i];
  }

  function isWeekend(str) {
    var w = weekdayIndex(str);
    return w === 0 || w === 6;
  }

  /**
   * Shifts Saturday (-1) or Sunday (-2) backwards to Friday early so invoices clear before weekends.
   */
  function adjustWeekendEarly(str) {
    if (!isValidDate(str)) return todayStr();
    var w = weekdayIndex(str);
    if (w === 6) return addDays(str, -1);
    if (w === 0) return addDays(str, -2);
    return str;
  }

  function computeDueDate(issueDateStr, termsKey, weekendEarly) {
    var base = isValidDate(issueDateStr) ? issueDateStr : todayStr();
    var term = PAYMENT_TERMS[termsKey] || PAYMENT_TERMS.net14;
    var rawDue = addDays(base, term.days);
    return weekendEarly ? adjustWeekendEarly(rawDue) : rawDue;
  }

  function prettyDate(str) {
    if (!isValidDate(str)) return '';
    var p = str.split('-');
    var m = parseInt(p[1], 10) - 1;
    var d = parseInt(p[2], 10);
    return weekdayShort(str) + ' ' + MONTHS_SHORT[m] + ' ' + d;
  }

  function dueLabel(dueStr, today) {
    if (!isValidDate(dueStr) || !isValidDate(today)) return 'Scheduled';
    var diff = daysBetween(today, dueStr);
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    if (diff > 1) return 'Due in ' + diff + ' days';
    if (diff === -1) return 'Overdue by 1 day';
    return 'Overdue by ' + Math.abs(diff) + ' days';
  }

  // ---------- 3. Invoice Line-Item, Discount, Tax & Balance Engine ----------
  /**
   * Computes exact integer-cent invoice totals:
   * subtotalCents, discountCents, taxableCents, taxCents, totalCents, paidCents, balanceDueCents.
   */
  function calculateInvoiceTotals(inv) {
    if (!inv || typeof inv !== 'object') {
      return {
        subtotalCents: 0,
        discountPct: 0,
        discountCents: 0,
        taxableCents: 0,
        taxPct: 0,
        taxCents: 0,
        totalCents: 0,
        paidCents: 0,
        balanceDueCents: 0
      };
    }

    var subtotalCents = 0;
    if (Array.isArray(inv.items) && inv.items.length > 0) {
      for (var i = 0; i < inv.items.length; i++) {
        var it = inv.items[i];
        if (!it) continue;
        var qty = clampNum(it.qty, 1, 100000, 1);
        var unit = clampNum(it.unitCents, 0, 1000000000, 0);
        subtotalCents += qty * unit;
      }
    } else {
      subtotalCents = clampNum(inv.amountCents, 0, 1000000000, 0);
    }

    var discountPct = clampNum(inv.discountPct, 0, 100, 0);
    var discountCents = Math.round((subtotalCents * discountPct) / 100);
    var taxableCents = Math.max(0, subtotalCents - discountCents);
    var taxPct = clampNum(inv.taxPct, 0, 100, 0);
    var taxCents = Math.round((taxableCents * taxPct) / 100);
    var totalCents = taxableCents + taxCents;

    var depositCents = clampNum(inv.depositCents, 0, totalCents, 0);
    var paidCents = inv.status === 'paid' ? totalCents : depositCents;
    var balanceDueCents = Math.max(0, totalCents - paidCents);

    return {
      subtotalCents: subtotalCents,
      discountPct: discountPct,
      discountCents: discountCents,
      taxableCents: taxableCents,
      taxPct: taxPct,
      taxCents: taxCents,
      totalCents: totalCents,
      paidCents: paidCents,
      balanceDueCents: balanceDueCents
    };
  }

  /**
   * Classifies an invoice into one of 4 deterministic aging buckets:
   * 'draft', 'sent', 'overdue', or 'paid'.
   */
  function invoiceBucket(inv, today) {
    var t = isValidDate(today) ? today : todayStr();
    if (!inv || typeof inv !== 'object') return 'draft';
    if (inv.status === 'paid') return 'paid';
    if (inv.status === 'draft') return 'draft';
    var effDue = inv.weekendEarly ? adjustWeekendEarly(inv.dueDate) : inv.dueDate;
    if (isValidDate(effDue) && daysBetween(t, effDue) < 0) return 'overdue';
    return 'sent';
  }

  /**
   * Computes optional late fee in integer cents for overdue invoices.
   */
  function calculateLateFeeCents(inv, today, monthlyRatePct) {
    var t = isValidDate(today) ? today : todayStr();
    if (!inv || typeof inv !== 'object' || inv.status === 'paid' || inv.status === 'draft') return 0;
    var effDue = inv.weekendEarly ? adjustWeekendEarly(inv.dueDate) : inv.dueDate;
    if (!isValidDate(effDue)) return 0;
    var daysOver = daysBetween(effDue, t);
    if (daysOver <= 0) return 0;
    var totals = calculateInvoiceTotals(inv);
    var rate = clampNum(monthlyRatePct, 0, 25, 2);
    return Math.round((totals.balanceDueCents * rate * Math.min(daysOver, 365)) / (100 * 30));
  }

  // ---------- 4. 1-Tap Paid Payout Autopilot Splitter Engine ----------
  var PAYOUT_PRESETS = {
    standard: { id: 'standard', label: 'Calm Freelancer 25 / 15 / 10 / 50', taxPct: 25, opsPct: 15, bufferPct: 10, ownerPct: 50 },
    taxheavy: { id: 'taxheavy', label: 'High-Tax Shield 30 / 15 / 15 / 40', taxPct: 30, opsPct: 15, bufferPct: 15, ownerPct: 40 },
    lean:     { id: 'lean',     label: 'Solo Creator 20 / 10 / 15 / 55',    taxPct: 20, opsPct: 10, bufferPct: 15, ownerPct: 55 },
    growth:   { id: 'growth',   label: 'Studio Scale 25 / 25 / 15 / 35',    taxPct: 25, opsPct: 25, bufferPct: 15, ownerPct: 35 }
  };

  /**
   * Deterministically splits an invoice payout in integer cents across 4 buckets:
   * 1. Tax Shield Vault (taxCents)
   * 2. Business Ops & Tools (opsCents)
   * 3. Safety Runway Buffer (bufferCents)
   * 4. Owner Take-Home Pay (ownerCents)
   * Guarantees 100% penny conservation: taxCents + opsCents + bufferCents + ownerCents === totalCents.
   */
  function splitPayout(amountCents, ruleOrKey) {
    var total = clampNum(amountCents, 0, 10000000000, 0);
    var preset = (typeof ruleOrKey === 'string' && PAYOUT_PRESETS[ruleOrKey])
      ? PAYOUT_PRESETS[ruleOrKey]
      : (ruleOrKey && typeof ruleOrKey === 'object' ? ruleOrKey : PAYOUT_PRESETS.standard);

    var pTax = clampNum(preset.taxPct, 0, 100, 25);
    var pOps = clampNum(preset.opsPct, 0, 100, 15);
    var pBuffer = clampNum(preset.bufferPct, 0, 100, 10);
    var pOwner = clampNum(preset.ownerPct, 0, 100, 50);
    var sumPct = pTax + pOps + pBuffer + pOwner;
    if (sumPct <= 0) {
      pTax = 25; pOps = 15; pBuffer = 10; pOwner = 50; sumPct = 100;
    }

    var taxCents = Math.floor((total * pTax) / sumPct);
    var opsCents = Math.floor((total * pOps) / sumPct);
    var bufferCents = Math.floor((total * pBuffer) / sumPct);
    var ownerCents = Math.max(0, total - taxCents - opsCents - bufferCents);

    var rTax = Math.round((pTax * 100) / sumPct);
    var rOps = Math.round((pOps * 100) / sumPct);
    var rBuf = Math.round((pBuffer * 100) / sumPct);
    var rOwn = Math.max(0, 100 - rTax - rOps - rBuf);

    return {
      totalCents: total,
      taxCents: taxCents,
      opsCents: opsCents,
      bufferCents: bufferCents,
      ownerCents: ownerCents,
      taxPct: rTax,
      opsPct: rOps,
      bufferPct: rBuf,
      ownerPct: rOwn
    };
  }

  // ---------- 5. Client Retainers & Recurring Billing Engine ----------
  var RETAINER_CYCLES = {
    weekly:    { label: 'Weekly',    perYear: 52 },
    monthly:   { label: 'Monthly',   perYear: 12 },
    quarterly: { label: 'Quarterly', perYear: 4 },
    yearly:    { label: 'Yearly',    perYear: 1 }
  };

  function annualRetainerCents(ret) {
    if (!ret || typeof ret !== 'object') return 0;
    var amt = clampNum(ret.amountCents, 0, 1000000000, 0);
    var cyc = RETAINER_CYCLES[ret.cycle] || RETAINER_CYCLES.monthly;
    return amt * cyc.perYear;
  }

  function monthlyRetainerCents(ret) {
    return Math.round(annualRetainerCents(ret) / 12);
  }

  function retainerSummary(data, today) {
    var t = isValidDate(today) ? today : todayStr();
    var list = (data && Array.isArray(data.retainers)) ? data.retainers : [];
    var activeCount = 0;
    var pausedCount = 0;
    var dueSoonCount = 0;
    var monthlyRecurringCents = 0;
    var annualRecurringCents = 0;

    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r) continue;
      if (r.status === 'paused') {
        pausedCount++;
      } else {
        activeCount++;
        var ann = annualRetainerCents(r);
        annualRecurringCents += ann;
        monthlyRecurringCents += monthlyRetainerCents(r);
        if (isValidDate(r.nextDate) && daysBetween(t, r.nextDate) <= 5) {
          dueSoonCount++;
        }
      }
    }

    return {
      activeCount: activeCount,
      pausedCount: pausedCount,
      dueSoonCount: dueSoonCount,
      monthlyRecurringCents: monthlyRecurringCents,
      annualRecurringCents: annualRecurringCents
    };
  }

  // ---------- 6. Anti-Double-Counting Business Checking & Tax Vault Engine ----------
  /**
   * Computes effective balance of a business checking or tax vault account with strict anti-double-counting.
   * Only ledger transactions with seq > account.updatedSeq modify the snapshot balance.
   */
  function effectiveAccountBalanceCents(account, transactions) {
    if (!account || typeof account !== 'object') return 0;
    var base = clampNum(account.balanceCents, -10000000000, 10000000000, 0);
    var acctSeq = clampNum(account.updatedSeq, 0, 1000000000, 0);
    var asOf = isValidDate(account.balanceAsOf) ? account.balanceAsOf : '';
    var txs = Array.isArray(transactions) ? transactions : [];
    var seenIds = {};
    var delta = 0;

    for (var i = 0; i < txs.length; i++) {
      var tx = txs[i];
      if (!tx || tx.accountId !== account.id) continue;
      if (tx.id && seenIds[tx.id]) continue;
      if (tx.id) seenIds[tx.id] = true;

      var txSeq = clampNum(tx.seq, 0, 1000000000, 0);
      var isAfterSnapshot = false;
      if (acctSeq > 0 && txSeq > 0) {
        isAfterSnapshot = txSeq > acctSeq;
      } else if (asOf && isValidDate(tx.date)) {
        isAfterSnapshot = tx.date > asOf;
      } else {
        isAfterSnapshot = true;
      }

      if (isAfterSnapshot) {
        var amt = clampNum(tx.amountCents, 0, 10000000000, 0);
        if (tx.kind === 'outflow') delta -= amt;
        else delta += amt;
      }
    }
    return base + delta;
  }

  // ---------- 7. Invoice Pipeline Pulse, Follow-Up Scripts & Next Billing Move ----------
  function invoicePulse(data, today) {
    var t = isValidDate(today) ? today : todayStr();
    var settings = (data && data.settings) ? data.settings : {};
    var invoices = (data && Array.isArray(data.invoices)) ? data.invoices : [];
    var workItems = (data && Array.isArray(data.workItems)) ? data.workItems : [];
    var accounts = (data && Array.isArray(data.accounts)) ? data.accounts : [];
    var txs = (data && Array.isArray(data.transactions)) ? data.transactions : [];

    var awaitingCents = 0;
    var sentCents = 0;
    var sentCount = 0;
    var overdueCents = 0;
    var overdueCount = 0;
    var draftCents = 0;
    var draftCount = 0;
    var collectedCents = 0;
    var paidCount = 0;

    for (var i = 0; i < invoices.length; i++) {
      var inv = invoices[i];
      if (!inv) continue;
      var totals = calculateInvoiceTotals(inv);
      var bucket = invoiceBucket(inv, t);
      if (bucket === 'paid') {
        collectedCents += totals.totalCents;
        paidCount++;
      } else if (bucket === 'overdue') {
        overdueCents += totals.balanceDueCents;
        awaitingCents += totals.balanceDueCents;
        overdueCount++;
        if (totals.paidCents > 0) collectedCents += totals.paidCents;
      } else if (bucket === 'sent') {
        sentCents += totals.balanceDueCents;
        awaitingCents += totals.balanceDueCents;
        sentCount++;
        if (totals.paidCents > 0) collectedCents += totals.paidCents;
      } else {
        draftCents += totals.balanceDueCents;
        draftCount++;
      }
    }

    var unbilledWorkCents = 0;
    var unbilledCount = 0;
    for (var w = 0; w < workItems.length; w++) {
      var wi = workItems[w];
      if (!wi || wi.billed) continue;
      unbilledWorkCents += clampNum(wi.amountCents, 0, 1000000000, 0);
      unbilledCount++;
    }

    var checkingCents = 0;
    var taxVaultCents = 0;
    for (var a = 0; a < accounts.length; a++) {
      var acct = accounts[a];
      if (!acct) continue;
      var eff = effectiveAccountBalanceCents(acct, txs);
      if (acct.type === 'checking') checkingCents += eff;
      else if (acct.type === 'tax') taxVaultCents += Math.max(0, eff);
    }

    var defaultTaxPct = clampNum(settings.defaultTaxPct, 0, 60, 25);
    var recommendedTaxHoldCents = Math.round((collectedCents * defaultTaxPct) / 100);
    var effectiveTaxHoldCents = Math.max(taxVaultCents, recommendedTaxHoldCents);
    var safeOwnerCashCents = Math.max(0, checkingCents - taxVaultCents);

    var readyPipelineCents = awaitingCents + draftCents + unbilledWorkCents;
    var totalPipelineAndCollected = readyPipelineCents + collectedCents;
    var collectionRatePct = totalPipelineAndCollected > 0
      ? clampNum(Math.round((collectedCents / totalPipelineAndCollected) * 100), 0, 100, 0)
      : 0;

    var monthlyTargetCents = clampNum(settings.monthlyTargetCents, 10000, 1000000000, 500000);
    var targetProgressPct = monthlyTargetCents > 0
      ? clampNum(Math.round((collectedCents / monthlyTargetCents) * 100), 0, 100, 0)
      : 0;
    var runwayDays = monthlyTargetCents > 0
      ? clampNum(Math.round((Math.max(0, checkingCents) / monthlyTargetCents) * 30), 0, 36500, 0)
      : 0;

    var ret = retainerSummary(data, t);

    return {
      today: t,
      awaitingCents: awaitingCents,
      sentCents: sentCents,
      sentCount: sentCount,
      overdueCents: overdueCents,
      overdueCount: overdueCount,
      draftCents: draftCents,
      draftCount: draftCount,
      unbilledWorkCents: unbilledWorkCents,
      unbilledCount: unbilledCount,
      readyPipelineCents: readyPipelineCents,
      collectedCents: collectedCents,
      paidCount: paidCount,
      checkingCents: checkingCents,
      taxVaultCents: taxVaultCents,
      effectiveTaxHoldCents: effectiveTaxHoldCents,
      safeOwnerCashCents: safeOwnerCashCents,
      collectionRatePct: collectionRatePct,
      monthlyTargetCents: monthlyTargetCents,
      targetProgressPct: targetProgressPct,
      runwayDays: runwayDays,
      monthlyRecurringCents: ret.monthlyRecurringCents,
      annualRecurringCents: ret.annualRecurringCents
    };
  }

  function followupCandidates(data, today) {
    var t = isValidDate(today) ? today : todayStr();
    var invoices = (data && Array.isArray(data.invoices)) ? data.invoices : [];
    var items = [];

    for (var i = 0; i < invoices.length; i++) {
      var inv = invoices[i];
      if (!inv || inv.status === 'paid') continue;
      var totals = calculateInvoiceTotals(inv);
      var effDue = inv.weekendEarly ? adjustWeekendEarly(inv.dueDate) : inv.dueDate;
      var bucket = invoiceBucket(inv, t);
      var diff = isValidDate(effDue) ? daysBetween(t, effDue) : 14;

      if (bucket === 'overdue') {
        items.push({
          id: inv.id,
          number: inv.number,
          client: inv.client,
          title: inv.title,
          status: inv.status,
          bucket: 'overdue',
          balanceDueCents: totals.balanceDueCents,
          dueDate: effDue,
          daysDiff: diff,
          badge: 'Overdue (' + Math.abs(diff) + 'd)',
          recommendedTone: Math.abs(diff) >= 14 ? 'firm' : 'gentle',
          urgencyScore: 300 - diff
        });
      } else if (bucket === 'sent' && diff <= 3) {
        items.push({
          id: inv.id,
          number: inv.number,
          client: inv.client,
          title: inv.title,
          status: inv.status,
          bucket: 'sent',
          balanceDueCents: totals.balanceDueCents,
          dueDate: effDue,
          daysDiff: diff,
          badge: diff === 0 ? 'Due Today' : 'Due in ' + diff + 'd',
          recommendedTone: 'warm',
          urgencyScore: 200 - diff
        });
      } else if (bucket === 'draft') {
        items.push({
          id: inv.id,
          number: inv.number,
          client: inv.client,
          title: inv.title,
          status: inv.status,
          bucket: 'draft',
          balanceDueCents: totals.balanceDueCents,
          dueDate: effDue,
          daysDiff: diff,
          badge: 'Draft Ready to Send',
          recommendedTone: 'warm',
          urgencyScore: 100
        });
      }
    }

    items.sort(function (a, b) {
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
      return String(a.number).localeCompare(String(b.number));
    });
    return items;
  }

  function nextBillingMove(data, today) {
    var t = isValidDate(today) ? today : todayStr();
    var cands = followupCandidates(data, t);
    if (cands.length > 0) return cands[0];

    var invoices = (data && Array.isArray(data.invoices)) ? data.invoices : [];
    var openList = invoices.filter(function (inv) { return inv && inv.status !== 'paid'; });
    if (openList.length > 0) {
      var first = openList[0];
      var totals = calculateInvoiceTotals(first);
      var eff = first.weekendEarly ? adjustWeekendEarly(first.dueDate) : first.dueDate;
      return {
        id: first.id,
        number: first.number,
        client: first.client,
        title: first.title,
        status: first.status,
        bucket: invoiceBucket(first, t),
        balanceDueCents: totals.balanceDueCents,
        dueDate: eff,
        daysDiff: daysBetween(t, eff),
        badge: dueLabel(eff, t),
        recommendedTone: 'warm',
        urgencyScore: 50
      };
    }
    return null;
  }

  /**
   * Generates a shame-free, copy-ready client follow-up message in 3 tones:
   * 'warm' (Pre-Due / Friendly), 'gentle' (Overdue Kind Nudge), 'firm' (Past-Due Final Notice).
   */
  function generateFollowupScript(inv, tone, currency, senderName) {
    if (!inv || typeof inv !== 'object') return '';
    var totals = calculateInvoiceTotals(inv);
    var amtStr = fmtCents(totals.balanceDueCents, currency || 'USD');
    var client = inv.client || 'there';
    var num = inv.number || 'INV-101';
    var proj = inv.title || 'recent project work';
    var due = isValidDate(inv.dueDate) ? prettyDate(inv.dueDate) : 'the scheduled due date';
    var sender = senderName || 'Best regards';

    if (tone === 'firm') {
      return 'Hi ' + client + ',\n\n' +
        'I hope your week is going well. Following up on Invoice ' + num + ' (' + amtStr + ') for ' + proj + ', which was due on ' + due + '.\n\n' +
        'Could you please confirm the payment status or expected transfer date today so I can keep our account schedule up to date?\n\n' +
        'Thank you,\n' + sender;
    }
    if (tone === 'gentle') {
      return 'Hi ' + client + ',\n\n' +
        'Hope everything is going smoothly on your end! Sending a quick, friendly nudge on Invoice ' + num + ' (' + amtStr + ') for ' + proj + ' (due ' + due + ').\n\n' +
        'I have attached/linked the invoice details again below for convenience. Let me know if you need anything else from my side!\n\n' +
        'Warmly,\n' + sender;
    }
    return 'Hi ' + client + ',\n\n' +
      'It has been a pleasure working on ' + proj + '! Just a warm heads-up that Invoice ' + num + ' for ' + amtStr + ' is scheduled for ' + due + '.\n\n' +
      'Please let me know if you have any questions about the line items. Thank you so much for your partnership!\n\n' +
      'Warmly,\n' + sender;
  }

  // ---------- 8. 14-Day Inflow & Billing Horizon Weather ----------
  function inflowForecast14(data, today, numDays) {
    var t = isValidDate(today) ? today : todayStr();
    var count = clampNum(numDays, 1, 31, 14);
    var invoices = (data && Array.isArray(data.invoices)) ? data.invoices : [];
    var retainers = (data && Array.isArray(data.retainers)) ? data.retainers : [];
    var cells = [];

    for (var i = 0; i < count; i++) {
      var d = addDays(t, i);
      var expectedInflowCents = 0;
      var labels = [];
      var hasRetainer = false;

      for (var j = 0; j < invoices.length; j++) {
        var inv = invoices[j];
        if (!inv || inv.status === 'paid') continue;
        var effDue = inv.weekendEarly ? adjustWeekendEarly(inv.dueDate) : inv.dueDate;
        if (effDue === d) {
          var totals = calculateInvoiceTotals(inv);
          expectedInflowCents += totals.balanceDueCents;
          labels.push(inv.number + ' (' + inv.client + ')');
        }
      }

      for (var r = 0; r < retainers.length; r++) {
        var ret = retainers[r];
        if (!ret || ret.status === 'paused') continue;
        if (ret.nextDate === d) {
          expectedInflowCents += clampNum(ret.amountCents, 0, 1000000000, 0);
          labels.push(ret.client + ' Retainer');
          hasRetainer = true;
        }
      }

      var ratio = expectedInflowCents > 0 ? Math.min(1.0, expectedInflowCents / 150000) : 0;
      if (!Number.isFinite(ratio) || ratio < 0) ratio = 0;

      cells.push({
        date: d,
        dayShort: weekdayShort(d),
        pretty: prettyDate(d),
        inflowCents: expectedInflowCents,
        hasRetainer: hasRetainer,
        itemsCount: labels.length,
        labels: labels,
        ratio: Number(ratio.toFixed(2)),
        level: expectedInflowCents > 0 ? (ratio > 0.75 ? 'ok' : 'light') : 'none'
      });
    }

    return cells;
  }

  return {
    CURRENCY_SYMBOLS: CURRENCY_SYMBOLS,
    PAYMENT_TERMS: PAYMENT_TERMS,
    PAYOUT_PRESETS: PAYOUT_PRESETS,
    RETAINER_CYCLES: RETAINER_CYCLES,
    uid: uid,
    escapeHtml: escapeHtml,
    plural: plural,
    clampNum: clampNum,
    parseCents: parseCents,
    fmtCents: fmtCents,
    fmtMin: fmtMin,
    levelOf: levelOf,
    todayStr: todayStr,
    isValidDate: isValidDate,
    parseUTC: parseUTC,
    daysBetween: daysBetween,
    addDays: addDays,
    addMonths: addMonths,
    weekdayIndex: weekdayIndex,
    weekdayShort: weekdayShort,
    weekdayName: weekdayName,
    isWeekend: isWeekend,
    adjustWeekendEarly: adjustWeekendEarly,
    computeDueDate: computeDueDate,
    prettyDate: prettyDate,
    dueLabel: dueLabel,
    calculateInvoiceTotals: calculateInvoiceTotals,
    invoiceBucket: invoiceBucket,
    calculateLateFeeCents: calculateLateFeeCents,
    splitPayout: splitPayout,
    annualRetainerCents: annualRetainerCents,
    monthlyRetainerCents: monthlyRetainerCents,
    retainerSummary: retainerSummary,
    effectiveAccountBalanceCents: effectiveAccountBalanceCents,
    invoicePulse: invoicePulse,
    followupCandidates: followupCandidates,
    nextBillingMove: nextBillingMove,
    generateFollowupScript: generateFollowupScript,
    inflowForecast14: inflowForecast14
  };
});
