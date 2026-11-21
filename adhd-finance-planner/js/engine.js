/**
 * ADHD Finance Planner — Pure Financial Calculation, Autopilot Splitter & Subscription Radar Engine
 * 100% integer-cent arithmetic, UTC calendar math, non-finite immunity (G-12), and anti-double-counting.
 * Shared byte-for-byte across all 3 editions for strict logic parity.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FPEngine = factory();
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
   * e.g. "45.99" -> 4599, "$1,250.50" -> 125050, 25 -> 2500.
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

  // ---------- 2. UTC Calendar & Date Arithmetic ----------
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
   * Shifts Saturday (-1) or Sunday (-2) backwards to Friday early.
   */
  function adjustWeekendEarly(str) {
    if (!isValidDate(str)) return todayStr();
    var w = weekdayIndex(str);
    if (w === 6) return addDays(str, -1);
    if (w === 0) return addDays(str, -2);
    return str;
  }

  function nextWeekday(fromStr, targetDow) {
    var base = isValidDate(fromStr) ? fromStr : todayStr();
    var dow = clampNum(targetDow, 0, 6, 5);
    for (var i = 1; i <= 7; i++) {
      var cand = addDays(base, i);
      if (weekdayIndex(cand) === dow) return cand;
    }
    return addDays(base, 7);
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

  // ---------- 3. Paycheck Autopilot Splitter Engine ----------
  var SPLIT_PRESETS = {
    balanced:  { id: 'balanced',  label: 'Calm 50 / 20 / 10 / 20 (Balanced)',   billsPct: 50, bucketsPct: 20, bufferPct: 10, dopaminePct: 20 },
    catchup:   { id: 'catchup',   label: 'Bill Catch-Up 60 / 15 / 15 / 10',     billsPct: 60, bucketsPct: 15, bufferPct: 15, dopaminePct: 10 },
    freelance: { id: 'freelance', label: 'Variable / Tax Shield 45 / 25 / 15 / 15', billsPct: 45, bucketsPct: 25, bufferPct: 15, dopaminePct: 15 },
    gentle:    { id: 'gentle',    label: 'High-Spoons 50 / 15 / 10 / 25',       billsPct: 50, bucketsPct: 15, bufferPct: 10, dopaminePct: 25 }
  };

  /**
   * Deterministically splits an incoming paycheck in integer cents across 4 buckets.
   * Guarantees: billsCents + bucketsCents + bufferCents + dopamineCents === amountCents.
   */
  function splitPaycheck(amountCents, ruleOrKey, upcomingBillsCents) {
    var total = clampNum(amountCents, 0, 10000000000, 0);
    var billsNeed = clampNum(upcomingBillsCents, 0, 10000000000, 0);
    var preset = (typeof ruleOrKey === 'string' && SPLIT_PRESETS[ruleOrKey])
      ? SPLIT_PRESETS[ruleOrKey]
      : (ruleOrKey && typeof ruleOrKey === 'object' ? ruleOrKey : SPLIT_PRESETS.balanced);

    var pBills = clampNum(preset.billsPct, 0, 100, 50);
    var pBuckets = clampNum(preset.bucketsPct, 0, 100, 20);
    var pBuffer = clampNum(preset.bufferPct, 0, 100, 10);
    var pDopamine = clampNum(preset.dopaminePct, 0, 100, 20);
    var sumPct = pBills + pBuckets + pBuffer + pDopamine;
    if (sumPct <= 0) {
      pBills = 50; pBuckets = 20; pBuffer = 10; pDopamine = 20; sumPct = 100;
    }

    var billsCents = Math.floor((total * pBills) / sumPct);
    var bucketsCents = Math.floor((total * pBuckets) / sumPct);
    var bufferCents = Math.floor((total * pBuffer) / sumPct);
    var dopamineCents = Math.max(0, total - billsCents - bucketsCents - bufferCents);

    var billGapCents = Math.max(0, billsNeed - billsCents);

    return {
      totalCents: total,
      billsCents: billsCents,
      bucketsCents: bucketsCents,
      bufferCents: bufferCents,
      dopamineCents: dopamineCents,
      billsPct: Math.round((pBills * 100) / sumPct),
      bucketsPct: Math.round((pBuckets * 100) / sumPct),
      bufferPct: Math.round((pBuffer * 100) / sumPct),
      dopaminePct: Math.max(0, 100 - Math.round((pBills * 100) / sumPct) - Math.round((pBuckets * 100) / sumPct) - Math.round((pBuffer * 100) / sumPct)),
      upcomingBillsCents: billsNeed,
      billGapCents: billGapCents,
      coversUpcomingBills: billsCents >= billsNeed
    };
  }

  // ---------- 4. ADHD Tax & Subscription Radar Engine ----------
  var BILLING_CYCLES = {
    weekly:    { label: 'Weekly',    perYear: 52 },
    monthly:   { label: 'Monthly',   perYear: 12 },
    quarterly: { label: 'Quarterly', perYear: 4 },
    yearly:    { label: 'Yearly',    perYear: 1 }
  };

  function annualCostCents(sub) {
    if (!sub || typeof sub !== 'object') return 0;
    var amt = clampNum(sub.amountCents, 0, 1000000000, 0);
    var cyc = BILLING_CYCLES[sub.cycle] || BILLING_CYCLES.monthly;
    return amt * cyc.perYear;
  }

  function monthlyEquivalentCents(sub) {
    return Math.round(annualCostCents(sub) / 12);
  }

  function cancelByDate(sub, fallbackToday) {
    var base = (sub && isValidDate(sub.nextDate)) ? sub.nextDate : (isValidDate(fallbackToday) ? fallbackToday : todayStr());
    var lead = clampNum(sub && sub.leadDays, 1, 30, 3);
    return addDays(base, -lead);
  }

  function subscriptionBucket(sub, today) {
    var t = isValidDate(today) ? today : todayStr();
    if (!sub || typeof sub !== 'object') return 'active';
    if (sub.status === 'cancelled') return 'cancelled';
    var cDate = cancelByDate(sub, t);
    var daysToCancel = daysBetween(t, cDate);
    var daysToRenew = isValidDate(sub.nextDate) ? daysBetween(t, sub.nextDate) : 30;
    if (sub.isTrial || daysToCancel <= 2) return 'warning';
    if (daysToRenew <= 7) return 'soon';
    return 'active';
  }

  function adhdTaxSummary(data, today) {
    var t = isValidDate(today) ? today : todayStr();
    var subs = (data && Array.isArray(data.subscriptions)) ? data.subscriptions : [];
    var activeMonthlyCents = 0;
    var activeAnnualCents = 0;
    var savedAnnualCents = 0;
    var trialAlertCount = 0;
    var activeCount = 0;
    var cancelledCount = 0;

    for (var i = 0; i < subs.length; i++) {
      var s = subs[i];
      if (!s) continue;
      var ann = annualCostCents(s);
      if (s.status === 'cancelled') {
        savedAnnualCents += ann;
        cancelledCount++;
      } else {
        activeCount++;
        activeAnnualCents += ann;
        activeMonthlyCents += monthlyEquivalentCents(s);
        var b = subscriptionBucket(s, t);
        if (b === 'warning') trialAlertCount++;
      }
    }

    return {
      activeCount: activeCount,
      cancelledCount: cancelledCount,
      trialAlertCount: trialAlertCount,
      activeMonthlyCents: activeMonthlyCents,
      activeAnnualCents: activeAnnualCents,
      savedAnnualCents: savedAnnualCents
    };
  }

  // ---------- 5. Sinking Buckets & Net Worth Engine ----------
  function bucketProgress(bucket) {
    if (!bucket || typeof bucket !== 'object') return 0;
    var saved = clampNum(bucket.savedCents, 0, 10000000000, 0);
    var target = clampNum(bucket.targetCents, 0, 10000000000, 0);
    if (target <= 0) return 0;
    return clampNum(Math.round((saved / target) * 100), 0, 100, 0);
  }

  /**
   * Computes effective balance of a checking/savings account with strict anti-double-counting.
   * Only transactions with seq > account.updatedSeq (or date > account.balanceAsOf when seq is 0)
   * modify the snapshot balance.
   */
  function effectiveAccountBalanceCents(account, transactions) {
    if (!account || typeof account !== 'object') return 0;
    var base = clampNum(account.balanceCents, -10000000000, 10000000000, 0);
    if (account.type === 'debt') return Math.max(0, base);
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
        if (tx.kind === 'income') delta += amt;
        else delta -= amt;
      }
    }
    return base + delta;
  }

  function netWorthSummary(data) {
    var accounts = (data && Array.isArray(data.accounts)) ? data.accounts : [];
    var buckets = (data && Array.isArray(data.buckets)) ? data.buckets : [];
    var txs = (data && Array.isArray(data.transactions)) ? data.transactions : [];
    var settings = (data && data.settings) ? data.settings : {};

    var checkingCents = 0;
    var savingsCents = 0;
    var debtCents = 0;

    for (var i = 0; i < accounts.length; i++) {
      var a = accounts[i];
      if (!a) continue;
      var eff = effectiveAccountBalanceCents(a, txs);
      if (a.type === 'checking') checkingCents += eff;
      else if (a.type === 'savings' || a.type === 'buffer') savingsCents += eff;
      else if (a.type === 'debt') debtCents += Math.max(0, eff);
    }

    var bucketsSavedCents = 0;
    var bucketsTargetCents = 0;
    for (var j = 0; j < buckets.length; j++) {
      var b = buckets[j];
      if (!b) continue;
      bucketsSavedCents += clampNum(b.savedCents, 0, 10000000000, 0);
      bucketsTargetCents += clampNum(b.targetCents, 0, 10000000000, 0);
    }

    var liquidCashCents = Math.max(0, checkingCents) + Math.max(0, savingsCents) + bucketsSavedCents;
    var totalAssetsCents = checkingCents + savingsCents + bucketsSavedCents;
    var netWorthCents = totalAssetsCents - debtCents;
    var survivalFloorCents = clampNum(settings.monthlySurvivalCents, 10000, 1000000000, 220000);
    var runwayDays = survivalFloorCents > 0
      ? clampNum(Math.round((Math.max(0, liquidCashCents) / survivalFloorCents) * 30), 0, 36500, 0)
      : 0;
    var runwayMonths = Number((runwayDays / 30).toFixed(1));

    return {
      checkingCents: checkingCents,
      savingsCents: savingsCents,
      bucketsSavedCents: bucketsSavedCents,
      bucketsTargetCents: bucketsTargetCents,
      liquidCashCents: liquidCashCents,
      totalAssetsCents: totalAssetsCents,
      totalDebtsCents: debtCents,
      netWorthCents: netWorthCents,
      survivalFloorCents: survivalFloorCents,
      runwayDays: runwayDays,
      runwayMonths: Number.isFinite(runwayMonths) ? runwayMonths : 0
    };
  }

  // ---------- 6. Safe Dopamine Wallet & Finance Pulse ----------
  function financePulse(data, today) {
    var t = isValidDate(today) ? today : todayStr();
    var settings = (data && data.settings) ? data.settings : {};
    var accounts = (data && Array.isArray(data.accounts)) ? data.accounts : [];
    var bills = (data && Array.isArray(data.bills)) ? data.bills : [];
    var subs = (data && Array.isArray(data.subscriptions)) ? data.subscriptions : [];
    var buckets = (data && Array.isArray(data.buckets)) ? data.buckets : [];
    var txs = (data && Array.isArray(data.transactions)) ? data.transactions : [];

    var nextPayday = isValidDate(settings.nextPayday) && daysBetween(t, settings.nextPayday) > 0
      ? settings.nextPayday
      : addDays(t, 14);
    var daysToPayday = clampNum(daysBetween(t, nextPayday), 1, 60, 14);

    // 1. Effective Checking Cash (anti-double-counting)
    var checkingCents = 0;
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i] && accounts[i].type === 'checking') {
        checkingCents += effectiveAccountBalanceCents(accounts[i], txs);
      }
    }

    // 2. Unpaid Bills due before next payday (or overdue)
    var windowEnd = addDays(nextPayday, -1);
    if (daysBetween(t, windowEnd) < 0) windowEnd = t;
    var upcomingBillsCents = 0;
    var upcomingBillsCount = 0;
    var overdueCount = 0;

    for (var bIdx = 0; bIdx < bills.length; bIdx++) {
      var bill = bills[bIdx];
      if (!bill || bill.status === 'paid' || bill.status === 'dropped') continue;
      var effDue = bill.weekendEarly ? adjustWeekendEarly(bill.due) : bill.due;
      if (!isValidDate(effDue)) continue;
      if (daysBetween(t, effDue) < 0) overdueCount++;
      if (daysBetween(effDue, windowEnd) >= 0) {
        upcomingBillsCents += clampNum(bill.amountCents, 0, 1000000000, 0);
        upcomingBillsCount++;
      }
    }

    // 3. Active Subscriptions renewing before next payday
    var upcomingSubsCents = 0;
    for (var sIdx = 0; sIdx < subs.length; sIdx++) {
      var sub = subs[sIdx];
      if (!sub || sub.status === 'cancelled') continue;
      if (isValidDate(sub.nextDate) && daysBetween(t, sub.nextDate) >= 0 && daysBetween(sub.nextDate, windowEnd) >= 0) {
        upcomingSubsCents += clampNum(sub.amountCents, 0, 1000000000, 0);
      }
    }

    // 4. Auto-held Sinking Bucket contributions
    var reservedBucketsCents = 0;
    for (var k = 0; k < buckets.length; k++) {
      if (buckets[k] && buckets[k].autoHold) {
        reservedBucketsCents += clampNum(buckets[k].monthlyHoldCents, 0, 1000000000, 0);
      }
    }

    // 5. Oops Buffer (Zero-guilt ADHD cushion)
    var oopsBufferCents = clampNum(settings.oopsBufferCents, 0, 100000000, 5000);

    // 6. Spent Today
    var spentTodayCents = 0;
    var seenTx = {};
    for (var x = 0; x < txs.length; x++) {
      var tx = txs[x];
      if (!tx || (tx.id && seenTx[tx.id])) continue;
      if (tx.id) seenTx[tx.id] = true;
      if (tx.date === t && tx.kind !== 'income') {
        spentTodayCents += clampNum(tx.amountCents, 0, 1000000000, 0);
      }
    }

    var promisedCents = upcomingBillsCents + upcomingSubsCents + reservedBucketsCents + oopsBufferCents;
    var rawDopaminePoolCents = checkingCents - promisedCents;
    var safeDopamineCents = Math.max(0, rawDopaminePoolCents);
    var shortfallCents = rawDopaminePoolCents < 0 ? Math.abs(rawDopaminePoolCents) : 0;

    var startingTodayPool = Math.max(0, rawDopaminePoolCents + spentTodayCents);
    var dailyAllowanceCents = Math.floor(startingTodayPool / daysToPayday);
    var leftTodayCents = Math.max(0, dailyAllowanceCents - spentTodayCents);

    var tax = adhdTaxSummary(data, t);
    var nw = netWorthSummary(data);

    return {
      today: t,
      nextPayday: nextPayday,
      daysToPayday: daysToPayday,
      checkingCents: checkingCents,
      upcomingBillsCents: upcomingBillsCents,
      upcomingSubsCents: upcomingSubsCents,
      upcomingObligationsCents: upcomingBillsCents + upcomingSubsCents,
      upcomingBillsCount: upcomingBillsCount,
      overdueCount: overdueCount,
      reservedBucketsCents: reservedBucketsCents,
      oopsBufferCents: oopsBufferCents,
      promisedCents: promisedCents,
      rawDopaminePoolCents: rawDopaminePoolCents,
      safeDopamineCents: safeDopamineCents,
      shortfallCents: shortfallCents,
      hasShortfall: rawDopaminePoolCents < 0,
      dailyAllowanceCents: dailyAllowanceCents,
      spentTodayCents: spentTodayCents,
      leftTodayCents: leftTodayCents,
      savedAnnualTaxCents: tax.savedAnnualCents,
      trialAlertCount: tax.trialAlertCount,
      netWorthCents: nw.netWorthCents,
      runwayDays: nw.runwayDays
    };
  }

  // ---------- 7. Single-Focus Next Money Move & Triage Candidates ----------
  function triageCandidates(data, today) {
    var t = isValidDate(today) ? today : todayStr();
    var items = [];
    var bills = (data && Array.isArray(data.bills)) ? data.bills : [];
    var subs = (data && Array.isArray(data.subscriptions)) ? data.subscriptions : [];

    for (var i = 0; i < subs.length; i++) {
      var s = subs[i];
      if (!s || s.status === 'cancelled') continue;
      var bucket = subscriptionBucket(s, t);
      if (bucket === 'warning') {
        items.push({
          kind: 'subscription',
          id: s.id,
          title: s.name,
          amountCents: clampNum(s.amountCents, 0, 1000000000, 0),
          annualCents: annualCostCents(s),
          date: s.nextDate,
          cancelBy: cancelByDate(s, t),
          isTrial: !!s.isTrial,
          badge: s.isTrial ? 'Free Trial Ending' : 'Cancel-By Alert',
          urgencyScore: 200 - daysBetween(t, cancelByDate(s, t))
        });
      }
    }

    for (var j = 0; j < bills.length; j++) {
      var b = bills[j];
      if (!b || b.status === 'paid' || b.status === 'dropped') continue;
      var effDue = b.weekendEarly ? adjustWeekendEarly(b.due) : b.due;
      var diff = daysBetween(t, effDue);
      if (diff <= 2) {
        items.push({
          kind: 'bill',
          id: b.id,
          title: b.title,
          amountCents: clampNum(b.amountCents, 0, 1000000000, 0),
          annualCents: clampNum(b.amountCents, 0, 1000000000, 0) * 12,
          date: effDue,
          cancelBy: effDue,
          isTrial: false,
          badge: diff < 0 ? 'Past Due (No Shame)' : (diff === 0 ? 'Due Today' : 'Due Soon'),
          urgencyScore: 100 - diff
        });
      }
    }

    items.sort(function (a, b) {
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
      return String(a.title).localeCompare(String(b.title));
    });
    return items;
  }

  function nextMoneyMove(data, today) {
    var t = isValidDate(today) ? today : todayStr();
    var candidates = triageCandidates(data, t);
    if (candidates.length > 0) {
      return candidates[0];
    }
    var bills = (data && Array.isArray(data.bills)) ? data.bills : [];
    var openBills = bills.filter(function (b) { return b && b.status === 'open' && isValidDate(b.due); });
    openBills.sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); });
    if (openBills.length > 0) {
      var nextB = openBills[0];
      var eff = nextB.weekendEarly ? adjustWeekendEarly(nextB.due) : nextB.due;
      return {
        kind: 'bill',
        id: nextB.id,
        title: nextB.title,
        amountCents: clampNum(nextB.amountCents, 0, 1000000000, 0),
        annualCents: clampNum(nextB.amountCents, 0, 1000000000, 0) * 12,
        date: eff,
        cancelBy: eff,
        isTrial: false,
        badge: dueLabel(eff, t),
        urgencyScore: 50 - daysBetween(t, eff)
      };
    }
    return null;
  }

  // ---------- 8. 14-Day Cashflow Weather & Liquidity Heatmap ----------
  function cashflowForecast14(data, today, numDays) {
    var t = isValidDate(today) ? today : todayStr();
    var count = clampNum(numDays, 1, 31, 14);
    var pulse = financePulse(data, t);
    var bills = (data && Array.isArray(data.bills)) ? data.bills : [];
    var subs = (data && Array.isArray(data.subscriptions)) ? data.subscriptions : [];
    var dailyBase = Math.max(2500, pulse.dailyAllowanceCents || 5000);
    var runningCash = pulse.checkingCents;
    var cells = [];

    for (var i = 0; i < count; i++) {
      var d = addDays(t, i);
      var dayOutflowCents = 0;
      var labels = [];

      for (var b = 0; b < bills.length; b++) {
        var bill = bills[b];
        if (!bill || bill.status === 'paid' || bill.status === 'dropped') continue;
        var effDue = bill.weekendEarly ? adjustWeekendEarly(bill.due) : bill.due;
        if (effDue === d) {
          dayOutflowCents += clampNum(bill.amountCents, 0, 1000000000, 0);
          labels.push(bill.title);
        }
      }

      for (var s = 0; s < subs.length; s++) {
        var sub = subs[s];
        if (!sub || sub.status === 'cancelled') continue;
        if (sub.nextDate === d) {
          dayOutflowCents += clampNum(sub.amountCents, 0, 1000000000, 0);
          labels.push(sub.name);
        }
      }

      if (d === pulse.nextPayday) {
        var payAmt = clampNum(data && data.settings && data.settings.defaultPaycheckCents, 0, 1000000000, 0);
        runningCash += payAmt;
      }

      runningCash -= dayOutflowCents;
      var ratio = dailyBase > 0 ? (dayOutflowCents / (dailyBase * 2)) : 0;
      if (!Number.isFinite(ratio) || ratio < 0) ratio = 0;

      cells.push({
        date: d,
        dayShort: weekdayShort(d),
        pretty: prettyDate(d),
        outflowCents: dayOutflowCents,
        projectedCashCents: runningCash,
        isPayday: d === pulse.nextPayday,
        itemsCount: labels.length,
        labels: labels,
        ratio: Number(ratio.toFixed(2)),
        level: runningCash < 0 ? 'over' : levelOf(ratio)
      });
    }

    return cells;
  }

  return {
    CURRENCY_SYMBOLS: CURRENCY_SYMBOLS,
    SPLIT_PRESETS: SPLIT_PRESETS,
    BILLING_CYCLES: BILLING_CYCLES,
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
    nextWeekday: nextWeekday,
    prettyDate: prettyDate,
    dueLabel: dueLabel,
    splitPaycheck: splitPaycheck,
    annualCostCents: annualCostCents,
    monthlyEquivalentCents: monthlyEquivalentCents,
    cancelByDate: cancelByDate,
    subscriptionBucket: subscriptionBucket,
    adhdTaxSummary: adhdTaxSummary,
    bucketProgress: bucketProgress,
    effectiveAccountBalanceCents: effectiveAccountBalanceCents,
    netWorthSummary: netWorthSummary,
    financePulse: financePulse,
    triageCandidates: triageCandidates,
    nextMoneyMove: nextMoneyMove,
    cashflowForecast14: cashflowForecast14
  };
});
