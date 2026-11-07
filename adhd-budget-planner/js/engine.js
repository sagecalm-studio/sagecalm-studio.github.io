/**
 * ADHD Budget Planner - Financial Calculation & Simulation Engine
 * Pure, high-performance financial math using integer cents and basis points.
 */

(function (global) {
  'use strict';

  const Engine = {};

  // --- 1. Currency & Formatting Helpers ---

  const CURRENCY_CONFIGS = {
    USD: { symbol: '$', decimals: 2, position: 'prefix' },
    CAD: { symbol: '$', decimals: 2, position: 'prefix' },
    GBP: { symbol: '£', decimals: 2, position: 'prefix' },
    EUR: { symbol: '€', decimals: 2, position: 'prefix' },
    AUD: { symbol: '$', decimals: 2, position: 'prefix' },
    JPY: { symbol: '¥', decimals: 0, position: 'prefix' }
  };

  /**
   * Parse any numeric input string or number into integer cents.
   * e.g. "45.99" -> 4599, "$1,250" -> 125000, 25.5 -> 2550
   */
  Engine.parseToCents = function (val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') {
      return Math.round(val * 100);
    }
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  /**
   * Format integer cents into formatted string.
   * e.g. 4599, 'USD' -> "$45.99"
   */
  Engine.formatCents = function (cents, currency = 'USD', showSign = false) {
    const isNegative = cents < 0;
    const absCents = Math.abs(cents || 0);
    const cfg = CURRENCY_CONFIGS[currency] || CURRENCY_CONFIGS.USD;
    
    let formattedNum;
    if (cfg.decimals === 0) {
      formattedNum = Math.round(absCents / 100).toLocaleString();
    } else {
      const dollars = (absCents / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      formattedNum = dollars;
    }

    const withSymbol = cfg.position === 'prefix'
      ? `${cfg.symbol}${formattedNum}`
      : `${formattedNum} ${cfg.symbol}`;

    if (isNegative) return `-${withSymbol}`;
    if (showSign && cents > 0) return `+${withSymbol}`;
    return withSymbol;
  };

  // --- 2. Date Utilities ---

  Engine.toISODate = function (dateObj) {
    const d = dateObj || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  Engine.addDays = function (isoDateStr, days) {
    const [y, m, d] = isoDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return Engine.toISODate(date);
  };

  /**
   * Safely adds integer months without skipping months when day is 31st (clamps to month end).
   */
  Engine.addMonths = function (isoDateStr, months) {
    const [y, m, d] = (isoDateStr || Engine.toISODate()).split('-').map(Number);
    const targetMonthIndex = (m - 1) + months;
    const targetYear = y + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const validDay = Math.min(d, daysInTargetMonth);
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
  };

  Engine.diffDays = function (isoDateA, isoDateB) {
    const [yA, mA, dA] = isoDateA.split('-').map(Number);
    const [yB, mB, dB] = isoDateB.split('-').map(Number);
    const dateA = Date.UTC(yA, mA - 1, dA);
    const dateB = Date.UTC(yB, mB - 1, dB);
    return Math.round((dateB - dateA) / (1000 * 60 * 60 * 24));
  };

  Engine.formatDisplayDate = function (isoDateStr, format = 'short') {
    if (!isoDateStr) return '';
    const [y, m, d] = isoDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (format === 'short') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (format === 'weekday') {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  /**
   * Adjusts date to Friday if it falls on Saturday or Sunday
   */
  Engine.adjustWeekendEarly = function (isoDateStr) {
    const [y, m, d] = isoDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek === 6) { // Saturday -> move back 1 day to Friday
      return Engine.addDays(isoDateStr, -1);
    }
    if (dayOfWeek === 0) { // Sunday -> move back 2 days to Friday
      return Engine.addDays(isoDateStr, -2);
    }
    return isoDateStr;
  };

  // --- 3. Payday Projections ---

  /**
   * Calculate future paydays from anchor date up to a target horizon.
   */
  Engine.getPaydaysInRange = function (incomePlan, fromDate, toDate) {
    if (!incomePlan || !incomePlan.anchor) return [];
    const occurrences = [];
    const cycle = incomePlan.cycle || 'biweekly';
    const weekendEarly = incomePlan.weekendEarly === true;
    const adjustedAnchor = weekendEarly ? Engine.adjustWeekendEarly(incomePlan.anchor) : incomePlan.anchor;

    const stepMap = {
      weekly: 7,
      biweekly: 14,
      fourweekly: 28
    };

    if (stepMap[cycle]) {
      const step = stepMap[cycle];
      let current = incomePlan.anchor;

      // If anchor is in the past, advance forward in steps until reaching fromDate
      if (Engine.diffDays(current, fromDate) > 0) {
        const diff = Engine.diffDays(current, fromDate);
        const jumps = Math.floor(diff / step);
        current = Engine.addDays(current, jumps * step);
        while (Engine.diffDays(current, fromDate) > 0) {
          current = Engine.addDays(current, step);
        }
      }

      while (Engine.diffDays(current, toDate) >= 0) {
        const actualDate = weekendEarly ? Engine.adjustWeekendEarly(current) : current;
        // Never include occurrences before fromDate or before anchor when anchor is in the future
        const isBeforeAnchor = incomePlan.anchor && actualDate < adjustedAnchor && adjustedAnchor > fromDate;
        if (!isBeforeAnchor && (actualDate >= fromDate || current >= fromDate)) {
          occurrences.push({
            date: actualDate,
            rawDate: current,
            amountCents: incomePlan.amountCents || 0,
            label: incomePlan.label || 'Paycheck'
          });
        }
        current = Engine.addDays(current, step);
      }
    } else if (cycle === 'semimonthly') {
      let dayA = incomePlan.dayA;
      let dayB = incomePlan.dayB;

      if (!dayA || !dayB) {
        if (incomePlan.anchor) {
          const anchorDay = parseInt(incomePlan.anchor.split('-')[2], 10);
          if (anchorDay <= 15) {
            dayA = anchorDay;
            dayB = (anchorDay === 15) ? 31 : anchorDay + 15;
          } else {
            dayB = anchorDay;
            dayA = (anchorDay >= 30) ? 15 : anchorDay - 15;
          }
        } else {
          dayA = 1;
          dayB = 15;
        }
      }

      const minDate = incomePlan.anchor && incomePlan.anchor > fromDate ? incomePlan.anchor : fromDate;
      const [startYear, startMonth] = minDate.split('-').map(Number);
      const [endYear, endMonth] = toDate.split('-').map(Number);

      for (let y = startYear; y <= endYear; y++) {
        const mStart = (y === startYear) ? startMonth : 1;
        const mEnd = (y === endYear) ? endMonth : 12;
        for (let m = mStart; m <= mEnd; m++) {
          const daysInMonth = new Date(y, m, 0).getDate();
          const targetDays = [Math.min(dayA, daysInMonth), Math.min(dayB, daysInMonth)].sort((a, b) => a - b);

          targetDays.forEach(day => {
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const actualDate = weekendEarly ? Engine.adjustWeekendEarly(dateStr) : dateStr;

            // Never include occurrences before anchor when anchor is in the future
            if (incomePlan.anchor && actualDate < adjustedAnchor && adjustedAnchor > fromDate) {
              return;
            }
            if (Engine.diffDays(fromDate, actualDate) >= 0 && Engine.diffDays(actualDate, toDate) >= 0) {
              occurrences.push({
                date: actualDate,
                rawDate: dateStr,
                amountCents: incomePlan.amountCents || 0,
                label: incomePlan.label || 'Paycheck'
              });
            }
          });
        }
      }
    } else if (cycle === 'monthly') {
      const dueDay = incomePlan.dueDay || (incomePlan.anchor ? parseInt(incomePlan.anchor.split('-')[2], 10) : 1);
      const minDate = incomePlan.anchor && incomePlan.anchor > fromDate ? incomePlan.anchor : fromDate;
      const [startYear, startMonth] = minDate.split('-').map(Number);
      const [endYear, endMonth] = toDate.split('-').map(Number);

      for (let y = startYear; y <= endYear; y++) {
        const mStart = (y === startYear) ? startMonth : 1;
        const mEnd = (y === endYear) ? endMonth : 12;
        for (let m = mStart; m <= mEnd; m++) {
          const daysInMonth = new Date(y, m, 0).getDate();
          const validDay = Math.min(dueDay, daysInMonth);
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
          const actualDate = weekendEarly ? Engine.adjustWeekendEarly(dateStr) : dateStr;

          // Never include occurrences before anchor when anchor is in the future
          if (incomePlan.anchor && actualDate < adjustedAnchor && adjustedAnchor > fromDate) {
            continue;
          }
          if (Engine.diffDays(fromDate, actualDate) >= 0 && Engine.diffDays(actualDate, toDate) >= 0) {
            occurrences.push({
              date: actualDate,
              rawDate: dateStr,
              amountCents: incomePlan.amountCents || 0,
              label: incomePlan.label || 'Paycheck'
            });
          }
        }
      }
    }

    return occurrences.sort((a, b) => a.date.localeCompare(b.date));
  };

  /**
   * Find the primary next payday strictly after today.
   */
  Engine.getNextPayday = function (state, today) {
    const incomePlans = state.income || [];
    if (!incomePlans.length) {
      // Default fallback: 14 days from today
      return {
        date: Engine.addDays(today, 14),
        label: 'Payday',
        amountCents: 0,
        assumed: true
      };
    }

    const horizon = Engine.addDays(today, 60);
    const allUpcoming = [];

    incomePlans.forEach(plan => {
      const days = Engine.getPaydaysInRange(plan, today, horizon);
      days.forEach(d => {
        if (d.date > today) {
          allUpcoming.push(d);
        }
      });
    });

    allUpcoming.sort((a, b) => a.date.localeCompare(b.date));
    return allUpcoming[0] || {
      date: Engine.addDays(today, 14),
      label: 'Payday',
      amountCents: 0,
      assumed: true
    };
  };

  // --- 4. Bill Occurrences Engine ---

  Engine.getBillOccurrencesInRange = function (bill, fromDate, toDate) {
    if (!bill) return [];
    const occurrences = [];
    const weekendEarly = bill.weekendEarly === true;
    const recurrence = bill.recurrence || 'monthly';

    // Extend candidate scanning by 3 days before and after so weekend-adjusted dates at month boundaries are captured
    const rangeStart = Engine.addDays(fromDate, -3);
    const rangeEnd = Engine.addDays(toDate, 3);
    const [startY, startM] = rangeStart.split('-').map(Number);
    const [endY, endM] = rangeEnd.split('-').map(Number);

    for (let y = startY; y <= endY; y++) {
      const mStart = (y === startY) ? startM : 1;
      const mEnd = (y === endY) ? endM : 12;
      for (let m = mStart; m <= mEnd; m++) {
        const daysInMonth = new Date(y, m, 0).getDate();
        const targetDays = (recurrence === 'twiceday') ? [bill.dayA || 1, bill.dayB || 15] : [bill.dueDay || 1];

        targetDays.forEach(dueDay => {
          const validDay = Math.min(dueDay, daysInMonth);
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
          const actualDate = weekendEarly ? Engine.adjustWeekendEarly(dateStr) : dateStr;

          // The actual payment date must fall within the requested range
          if (actualDate >= fromDate && actualDate <= toDate) {
            const isPaid = bill.isPaid === true || (bill.paidDates || []).includes(dateStr);
            occurrences.push({
              billId: bill.id,
              name: bill.name,
              amountCents: bill.amountCents || 0,
              date: actualDate,
              rawDate: dateStr,
              isPaid,
              category: bill.category || 'Bills',
              isSpread: bill.isSpread === true
            });
          }
        });
      }
    }

    return occurrences.sort((a, b) => a.date.localeCompare(b.date));
  };

  // --- 5. The "Safe to Spend Today" Calculation Engine ---

  Engine.calculateSafeToSpend = function (state, today) {
    const todayStr = today || Engine.toISODate();
    const nextPay = Engine.getNextPayday(state, todayStr);
    const daysLeft = Math.max(1, Engine.diffDays(todayStr, nextPay.date));

    // 1. Available Checking Cash
    const mainAccount = (state.accounts || []).find(a => a.id === 'acct-main') ||
      (state.accounts && state.accounts[0]) || {
      balanceCents: 0,
      balanceAsOf: todayStr
    };
    const checkingBalance = mainAccount.balanceCents || 0;
    const balanceAsOf = mainAccount.balanceAsOf || todayStr;

    // 2. Spending logged *after* balance timestamp
    const balanceUpdatedAt = mainAccount.balanceUpdatedAt || 0;
    let spentThisPeriod = 0;
    let spentToday = 0;
    (state.transactions || []).forEach(tx => {
      const txTime = tx.timestamp || (typeof tx.id === 'string' && tx.id.startsWith('tx-') ? parseInt(tx.id.replace('tx-', ''), 10) : 0);
      let isAfterBalance = false;
      if (balanceUpdatedAt > 0 && txTime > 0) {
        isAfterBalance = txTime > balanceUpdatedAt;
      } else {
        isAfterBalance = tx.date >= balanceAsOf;
      }

      if (isAfterBalance && tx.date <= todayStr && tx.kind === 'spend') {
        spentThisPeriod += (tx.amountCents || 0);
      }
      if (tx.date === todayStr && tx.kind === 'spend') {
        spentToday += (tx.amountCents || 0);
      }
    });

    // 3. Unpaid bills between today and the day before next payday
    const dayBeforePay = Engine.addDays(nextPay.date, -1);
    let unpaidBillsTotal = 0;
    const upcomingBills = [];

    (state.bills || []).forEach(bill => {
      const occurrences = Engine.getBillOccurrencesInRange(bill, todayStr, dayBeforePay);
      occurrences.forEach(occ => {
        if (!occ.isPaid) {
          unpaidBillsTotal += occ.amountCents;
          upcomingBills.push(occ);
        }
      });
    });

    // 4. Sinking funds & locked goal reserves
    let monthlySinkingReserve = 0;
    (state.savings || []).forEach(goal => {
      if (goal.monthlyCents && goal.reserved === true) {
        monthlySinkingReserve += goal.monthlyCents;
      }
    });

    // 5. Credit card payments to hold
    let creditCardHolds = 0;
    (state.debts || []).forEach(debt => {
      if (debt.isCreditCard && debt.payInFull && debt.balanceCents > 0) {
        creditCardHolds += debt.balanceCents;
      } else if (debt.monthlyPaymentCents > 0 && debt.autoHold) {
        creditCardHolds += debt.monthlyPaymentCents;
      }
    });

    // 6. Oops Fund (Zero-guilt buffer)
    const oopsFundCents = state.profile && state.profile.oopsFundCents ? state.profile.oopsFundCents : 0;

    // 7. Core Net Spendable Pool Calculation
    const effectiveChecking = Math.max(0, checkingBalance - spentThisPeriod);
    const promisedMoney = unpaidBillsTotal + monthlySinkingReserve + creditCardHolds + oopsFundCents;
    const rawSpendablePool = effectiveChecking - promisedMoney;
    const spendablePool = Math.max(0, rawSpendablePool);

    // 8. Daily Allowance (computed against today's starting spendable pool)
    const startingPoolToday = Math.max(0, rawSpendablePool + spentToday);
    const baseDailyAllowance = Math.floor(startingPoolToday / daysLeft);

    // 9. Non-punitive absorption check:
    // Did user overspend today's starting daily allowance?
    const isOverToday = spentToday > baseDailyAllowance;
    const todayOverCents = isOverToday ? spentToday - baseDailyAllowance : 0;
    
    // Remaining allowance for today
    const leftTodayCents = isOverToday ? 0 : Math.max(0, baseDailyAllowance - spentToday);

    // 10. Cashflow Valley Simulation (Detect if bills cluster before incoming deposits)
    let minProjectedCash = effectiveChecking;
    let runningCash = effectiveChecking;
    let lowDay = todayStr;

    for (let i = 0; i < daysLeft; i++) {
      const testDate = Engine.addDays(todayStr, i);
      // Deduct bills due on testDate
      upcomingBills.forEach(b => {
        if (b.date === testDate) runningCash -= b.amountCents;
      });
      if (runningCash < minProjectedCash) {
        minProjectedCash = runningCash;
        lowDay = testDate;
      }
    }

    const hasValleyRisk = minProjectedCash < 0;
    const valleyDeficitCents = hasValleyRisk ? Math.abs(minProjectedCash) : 0;

    return {
      dailySafeCents: Math.max(0, baseDailyAllowance),
      leftTodayCents: leftTodayCents,
      spentTodayCents: spentToday,
      isOverToday: isOverToday,
      todayOverCents: todayOverCents,
      spendablePoolCents: spendablePool,
      rawPoolCents: rawSpendablePool,
      hasShortfall: rawSpendablePool < 0,
      shortfallCents: rawSpendablePool < 0 ? Math.abs(rawSpendablePool) : 0,
      daysLeft: daysLeft,
      isPaydayAssumed: !!nextPay.assumed,
      nextPayDate: nextPay.date,
      nextPayLabel: nextPay.label,
      checkingBalanceCents: effectiveChecking,
      effectiveCheckingCents: effectiveChecking,
      rawCheckingBalanceCents: checkingBalance,
      unpaidBillsCents: unpaidBillsTotal,
      sinkingReserveCents: monthlySinkingReserve,
      cardHoldsCents: creditCardHolds,
      oopsFundCents: oopsFundCents,
      upcomingBillsCount: upcomingBills.length,
      upcomingBills: upcomingBills,
      hasValleyRisk: hasValleyRisk,
      valleyDeficitCents: valleyDeficitCents,
      lowDay: lowDay
    };
  };

  // --- 6. Debt Payoff Engine (Snowball vs Avalanche) ---

  Engine.simulateDebtPayoff = function (debts, extraMonthlyCents = 0, strategy = 'snowball') {
    if (!debts || !debts.length) return null;

    // Deep clone debts for simulation
    const activeDebts = debts.map(d => ({
      id: d.id,
      name: d.name,
      balanceCents: Math.max(0, d.balanceCents || 0),
      aprBp: Math.max(0, d.aprBp || 0), // Basis points (1850 = 18.5%)
      minPaymentCents: Math.max(0, d.minPaymentCents || 2500),
      isPaid: false
    })).filter(d => d.balanceCents > 0);

    if (!activeDebts.length) return { months: 0, totalInterestCents: 0, debtFreeDate: Engine.toISODate() };

    let month = 0;
    let totalInterestPaid = 0;
    const maxMonths = 360; // 30-year safety ceiling

    while (activeDebts.some(d => !d.isPaid) && month < maxMonths) {
      month++;

      // 1. Accrue monthly interest
      activeDebts.forEach(debt => {
        if (!debt.isPaid) {
          const monthlyRate = (debt.aprBp / 10000) / 12;
          const interestCents = Math.round(debt.balanceCents * monthlyRate);
          debt.balanceCents += interestCents;
          totalInterestPaid += interestCents;
        }
      });

      // 2. Pay minimums
      let availableExtra = extraMonthlyCents;
      activeDebts.forEach(debt => {
        if (!debt.isPaid) {
          const payment = Math.min(debt.balanceCents, debt.minPaymentCents);
          debt.balanceCents -= payment;
          if (debt.balanceCents <= 0) {
            debt.isPaid = true;
            availableExtra += debt.minPaymentCents; // Rollover freed cash!
          }
        }
      });

      // 3. Sort debts according to strategy
      const unpaid = activeDebts.filter(d => !d.isPaid);
      if (unpaid.length > 0) {
        if (strategy === 'snowball') {
          // Lowest balance first
          unpaid.sort((a, b) => a.balanceCents - b.balanceCents);
        } else if (strategy === 'avalanche') {
          // Highest APR first
          unpaid.sort((a, b) => b.aprBp - a.aprBp);
        }

        // Apply extra snowball cash to top target debt
        const target = unpaid[0];
        const extraPayment = Math.min(target.balanceCents, availableExtra);
        target.balanceCents -= extraPayment;
        if (target.balanceCents <= 0) {
          target.isPaid = true;
          availableExtra += target.minPaymentCents;
        }
      }
    }

    const todayStr = Engine.toISODate();
    const debtFreeDate = Engine.addMonths(todayStr, month);
    const isUnderwater = activeDebts.some(d => !d.isPaid);

    return {
      months: month,
      totalInterestCents: totalInterestPaid,
      debtFreeDate: debtFreeDate,
      isUnderwater: isUnderwater,
      strategy: strategy
    };
  };

  // --- 7. Three Small Quests Engine (ADHD Daily Quest Generator) ---

  Engine.generateDailyQuests = function (state, todayStr) {
    const quests = [];
    const safeCalc = Engine.calculateSafeToSpend(state, todayStr);

    // Quest 1: Did a bill land or need confirmation today?
    const todayBills = (safeCalc.upcomingBills || []).filter(b => b.date === todayStr);
    if (todayBills.length > 0) {
      quests.push({
        id: `bill-${todayBills[0].billId}`,
        type: 'bill',
        title: `Pay or confirm ${todayBills[0].name}`,
        subtitle: `${Engine.formatCents(todayBills[0].amountCents, state.profile.currency)} due today`,
        billId: todayBills[0].billId,
        date: todayStr,
        isDone: false
      });
    }

    // Quest 2: Log one spend
    const hasLoggedToday = (state.transactions || []).some(tx => tx.date === todayStr);
    quests.push({
      id: 'log-spend',
      type: 'spend',
      title: hasLoggedToday ? 'You logged spending today!' : 'Log today\'s spending',
      subtitle: hasLoggedToday ? 'Great job keeping your numbers fresh' : 'Coffee, lunch, or groceries',
      isDone: hasLoggedToday
    });

    // Quest 3: Stay within today's allowance OR celebrate zero spend
    if (safeCalc.spentTodayCents === 0) {
      quests.push({
        id: 'no-spend',
        type: 'challenge',
        title: 'Zero-spend day so far',
        subtitle: `${Engine.formatCents(safeCalc.dailySafeCents, state.profile.currency)} safe for today`,
        isDone: false
      });
    } else if (!safeCalc.isOverToday) {
      quests.push({
        id: 'inside-allowance',
        type: 'challenge',
        title: 'Within today\'s allowance',
        subtitle: `${Engine.formatCents(safeCalc.leftTodayCents, state.profile.currency)} left for today`,
        isDone: true
      });
    } else {
      quests.push({
        id: 'reset-ready',
        type: 'absorbed',
        title: 'Today went over — tomorrow resets',
        subtitle: 'Absorbed smoothly into remaining days',
        isDone: true
      });
    }

    return quests.slice(0, 3);
  };

  // --- 8. Impulse Vault Cooldown & Timer Engine ---

  Engine.getImpulseStatus = function (item, nowMs) {
    if (!item) return { isReady: false, remainingHours: 48, status: 'cooling' };
    if (item.status === 'unlocked' || item.status === 'ready') {
      return { isReady: true, remainingHours: 0, status: 'unlocked' };
    }
    const now = nowMs || Date.now();
    let createdAt = item.createdAt;
    if (!createdAt) {
      if (typeof item.id === 'string' && item.id.startsWith('imp-')) {
        const parsed = parseInt(item.id.replace('imp-', ''), 10);
        if (!isNaN(parsed) && parsed > 1600000000000) {
          createdAt = parsed;
        }
      }
      if (!createdAt && item.dateAdded) {
        createdAt = new Date(item.dateAdded + 'T00:00:00').getTime();
      }
    }
    const elapsedMs = Math.max(0, now - (createdAt || now));
    const totalTimerHours = item.hoursTimer || 48;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const remainingHours = Math.max(0, Math.ceil(totalTimerHours - elapsedHours));
    const isReady = remainingHours <= 0;

    return {
      isReady: isReady,
      remainingHours: remainingHours,
      status: isReady ? 'unlocked' : 'cooling'
    };
  };

  global.FocusEngine = Engine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Engine;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
