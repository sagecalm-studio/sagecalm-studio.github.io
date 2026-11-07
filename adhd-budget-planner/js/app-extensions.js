/**
 * ADHD Budget Planner - App Extensions
 * Calendar/Planner rendering, Savings goals, Toast system, Confetti, Data Health Banner.
 * This file is appended AFTER app.js logic runs (or merged into app.js at build time).
 * For now: attaches to window.onload to extend the running app.
 */

(function () {
  'use strict';

  // === TOAST NOTIFICATION SYSTEM ===
  window.showToast = function (message, emoji) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = (emoji ? emoji + ' ' : '') + message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  // === CONFETTI CELEBRATION ===
  window.launchConfetti = function () {
    const colors = ['#10b981', '#f59e0b', '#6366f1', '#f43f5e', '#3b82f6'];
    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.cssText = [
        `left: ${Math.random() * 100}vw`,
        `background: ${colors[Math.floor(Math.random() * colors.length)]}`,
        `animation-delay: ${Math.random() * 0.8}s`,
        `animation-duration: ${1.4 + Math.random() * 0.8}s`,
        `transform: rotate(${Math.random() * 360}deg)`,
        `border-radius: ${Math.random() > 0.5 ? '50%' : '2px'}`
      ].join(';');
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 3000);
    }
  };

  // === CALENDAR / PLANNER RENDERER ===
  let plannerViewYear = null;
  let plannerViewMonth = null;

  function renderPlannerCalendar(state) {
    if (!state) return;
    const today = FocusEngine.toISODate();
    const todayD = new Date(today + 'T00:00:00');
    if (!plannerViewYear) plannerViewYear = todayD.getFullYear();
    if (plannerViewMonth === null) plannerViewMonth = todayD.getMonth();

    const currency = state.profile.currency || 'USD';
    const y = plannerViewYear;
    const m = plannerViewMonth;

    // Update month title
    const titleEl = document.getElementById('planner-month-title');
    if (titleEl) {
      titleEl.textContent = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    // Build calendar days
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();

    // Collect payday dates for this month
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const monthEnd   = `${y}-${String(m + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const paydayDates = new Set();
    (state.income || []).forEach(inc => {
      const days = FocusEngine.getPaydaysInRange(inc, monthStart, monthEnd);
      days.forEach(p => paydayDates.add(p.date));
    });

    // Collect bill dates for this month
    const billDates = {};
    (state.bills || []).forEach(bill => {
      const occs = FocusEngine.getBillOccurrencesInRange(bill, monthStart, monthEnd);
      occs.forEach(o => {
        if (!billDates[o.date]) billDates[o.date] = [];
        billDates[o.date].push(o.name);
      });
    });

    // Collect spent dates
    const spentDates = {};
    (state.transactions || []).forEach(tx => {
      if (tx.kind === 'spend' && tx.date >= monthStart && tx.date <= monthEnd) {
        if (!spentDates[tx.date]) spentDates[tx.date] = 0;
        spentDates[tx.date] += (tx.amountCents || 0);
      }
    });

    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;

    let html = '';

    // Prev month fill
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const isPayday = paydayDates.has(dateStr);
      const hasBill = !!billDates[dateStr];
      const billNames = billDates[dateStr] ? billDates[dateStr].join(', ') : '';

      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (isPayday) classes += ' payday';
      if (hasBill) classes += ' has-bill';

      const title = [
        isPayday ? 'Payday!' : '',
        hasBill ? 'Bills: ' + billNames : ''
      ].filter(Boolean).join(' | ');

      html += `<div class="${classes}" title="${title}" data-cal-date="${dateStr}">${d}${isPayday ? '<br><span style="font-size:8px">★</span>' : ''}</div>`;
    }

    // Next month fill
    const totalCells = html.split('calendar-day').length - 1;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="calendar-day other-month">${i}</div>`;
    }

    grid.innerHTML = html;

    // Month totals
    let monthIncome = 0;
    (state.income || []).forEach(inc => {
      const days = FocusEngine.getPaydaysInRange(inc, monthStart, monthEnd);
      monthIncome += days.reduce((sum, p) => sum + p.amountCents, 0);
    });

    let monthBills = 0;
    (state.bills || []).forEach(bill => {
      const occs = FocusEngine.getBillOccurrencesInRange(bill, monthStart, monthEnd);
      monthBills += occs.reduce((sum, o) => sum + o.amountCents, 0);
    });

    const monthSpent = Object.values(spentDates).reduce((a, b) => a + b, 0);

    const elInc = document.getElementById('planner-income-total');
    const elBills = document.getElementById('planner-bills-total');
    const elSpent = document.getElementById('planner-spent-total');
    if (elInc) elInc.textContent = FocusEngine.formatCents(monthIncome, currency);
    if (elBills) elBills.textContent = FocusEngine.formatCents(monthBills, currency);
    if (elSpent) elSpent.textContent = FocusEngine.formatCents(monthSpent, currency);

    // Recent Transactions (last 10)
    const txList = document.getElementById('recent-tx-list');
    if (txList) {
      const recentTxs = (state.transactions || [])
        .filter(t => t.date >= monthStart && t.date <= monthEnd)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 15);

      const categoryEmoji = {
        'Coffee': '☕', 'Food & Dining': '🍽️', 'Groceries': '🛒',
        'Dining': '🍜', 'Shopping': '🛍️', 'Transit': '🚌', 'Fun': '🎮',
        'Health': '💊', 'Social': '🎉', 'General': '💳',
        'Impulse Vault (Guilt-Free)': '🎁'
      };

      if (!recentTxs.length) {
        txList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No spending logged this month</div><div class="empty-state-sub">Use the quick log buttons on the Today screen to track purchases.</div></div>`;
      } else {
        txList.innerHTML = recentTxs.map(tx => `
          <div class="tx-item">
            <div class="tx-icon">${categoryEmoji[tx.category] || '💳'}</div>
            <div class="tx-info">
              <div class="tx-note">${tx.note || tx.category}</div>
              <div class="tx-meta">${FocusEngine.formatDisplayDate(tx.date, 'weekday')} · ${tx.category}</div>
            </div>
            <div class="tx-amount">-${FocusEngine.formatCents(tx.amountCents, currency)}</div>
            <button class="btn-pill" data-action="delete-tx" data-id="${tx.id}" style="color: var(--text-dim); padding: 4px 8px; font-size: 11px;">✕</button>
          </div>
        `).join('');
      }
    }
  }

  // === SAVINGS GOALS RENDERER ===
  function renderSavingsGoals(state) {
    if (!state) return;
    const list = document.getElementById('savings-goals-list');
    if (!list) return;
    const currency = state.profile.currency || 'USD';
    const goals = state.savings || [];

    if (!goals.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏦</div><div class="empty-state-title">No savings goals yet</div><div class="empty-state-sub">Add an emergency fund, vacation goal, or any sinking fund to start building forward.</div></div>`;
      return;
    }

    list.innerHTML = goals.map(goal => {
      const pct = goal.targetCents > 0 ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100)) : 0;
      const remaining = Math.max(0, goal.targetCents - goal.savedCents);
      const monthsLeft = goal.monthlyCents > 0 ? Math.ceil(remaining / goal.monthlyCents) : null;
      const isComplete = pct >= 100;

      return `
        <div class="goal-card">
          <div class="goal-header">
            <div>
              <div class="goal-name">${goal.name} ${isComplete ? '🎉' : ''}</div>
              <div class="goal-amounts">
                ${FocusEngine.formatCents(goal.savedCents, currency)} saved
                of ${FocusEngine.formatCents(goal.targetCents, currency)} goal
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="text-align: right;">
                <div style="font-size: 22px; font-weight: 800; color: var(--accent-primary);">${pct}%</div>
                ${monthsLeft ? `<div style="font-size: 11px; color: var(--text-dim);">${monthsLeft} months left</div>` : ''}
              </div>
              <button type="button" class="btn-pill" data-action="delete-goal" data-id="${goal.id}" style="color: var(--accent-warn); padding: 4px 8px; font-size: 12px;" aria-label="Delete Goal">✕</button>
            </div>
          </div>
          <div class="goal-progress-track">
            <div class="goal-progress-fill ${isComplete ? 'complete' : ''}" style="width: ${pct}%;"></div>
          </div>
          <div class="goal-meta">
            <span>${FocusEngine.formatCents(remaining, currency)} remaining</span>
            ${goal.monthlyCents ? `<span>+${FocusEngine.formatCents(goal.monthlyCents, currency)}/mo</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Expose renderers globally so main renderApp() can trigger them on any data change
  window.renderPlannerCalendar = renderPlannerCalendar;
  window.renderSavingsGoals = renderSavingsGoals;

  // === DATA HEALTH CHECK (iOS Safari 7-day warning) ===
  function checkDataHealth() {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = ('standalone' in navigator && navigator.standalone) ||
                         window.matchMedia('(display-mode: standalone)').matches;
    const bannerEl = document.getElementById('data-health-banner');
    if (bannerEl && isSafari && !isStandalone) {
      // Show if not dismissed
      const dismissed = localStorage.getItem('adhd_budget_health_dismissed') || localStorage.getItem('focusbudget_health_dismissed');
      if (!dismissed) {
        bannerEl.classList.add('visible');
        // Insert before main content
        const main = document.querySelector('.main-wrapper');
        if (main) main.insertAdjacentElement('afterbegin', bannerEl);
      }
    }
    const dismissBtn = document.getElementById('btn-dismiss-health');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        if (bannerEl) bannerEl.classList.remove('visible');
        localStorage.setItem('adhd_budget_health_dismissed', '1');
      });
    }
  }

  // === CALENDAR MONTH NAV ===
  function bindPlannerNav() {
    const btnPrev = document.getElementById('btn-prev-month');
    const btnNext = document.getElementById('btn-next-month');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        plannerViewMonth--;
        if (plannerViewMonth < 0) { plannerViewMonth = 11; plannerViewYear--; }
        const s = window._focusState;
        if (s) renderPlannerCalendar(s);
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        plannerViewMonth++;
        if (plannerViewMonth > 11) { plannerViewMonth = 0; plannerViewYear++; }
        const s = window._focusState;
        if (s) renderPlannerCalendar(s);
      });
    }
  }

  // === ADD SAVINGS GOAL FORM ===
  function bindGoalForm() {
    const form = document.getElementById('form-add-goal');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = window._focusState;
      if (!s) return;

      const name       = document.getElementById('goal-name').value.trim();
      const target     = FocusEngine.parseToCents(document.getElementById('goal-target').value);
      const saved      = FocusEngine.parseToCents(document.getElementById('goal-saved').value);
      const monthly    = FocusEngine.parseToCents(document.getElementById('goal-monthly').value);

      if (name && target > 0) {
        s.savings.push({
          id: 'sv-' + Date.now(),
          name,
          targetCents: target,
          savedCents: saved,
          monthlyCents: monthly,
          reserved: false
        });
        form.reset();
        document.getElementById('modal-add-goal').classList.remove('open');
        FocusStorage.saveState(s);
        if (window.renderApp) window.renderApp();
        else renderSavingsGoals(s);
        window.showToast('Goal added!', '🎯');
      }
    });
  }

  // === DELETE TRANSACTION & GOAL DELEGATE ===
  document.addEventListener('click', (e) => {
    const btnTx = e.target.closest('[data-action="delete-tx"]');
    if (btnTx) {
      const s = window._focusState;
      if (!s) return;
      const id = btnTx.dataset.id;
      s.transactions = s.transactions.filter(t => t.id !== id);
      FocusStorage.saveState(s);
      if (window.renderApp) window.renderApp();
      else renderPlannerCalendar(s);
      if (window.showToast) window.showToast('Transaction removed', '🗑️');
      return;
    }

    const btnGoal = e.target.closest('[data-action="delete-goal"]');
    if (btnGoal) {
      const s = window._focusState;
      if (!s) return;
      const id = btnGoal.dataset.id;
      s.savings = (s.savings || []).filter(g => g.id !== id);
      FocusStorage.saveState(s);
      if (window.renderApp) window.renderApp();
      else renderSavingsGoals(s);
      if (window.showToast) window.showToast('Savings goal removed', '🗑️');
      return;
    }
  });

  // === PATCH renderApp to also call new renderers ===
  // We hook into the nav tab clicks to trigger planner/savings renders and Maya's contextual side-pop
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab[data-nav]');
    if (tab) {
      const nav = tab.dataset.nav;
      const s = window._focusState;
      if (s) {
        if (nav === 'planner') renderPlannerCalendar(s);
        if (nav === 'savings') renderSavingsGoals(s);
      }
      if (window.FocusTutorials && typeof window.FocusTutorials.checkTabSidePop === 'function') {
        window.FocusTutorials.checkTabSidePop(nav);
      }
    }
  });

  // === EXPOSE STATE GLOBALLY SO EXTENSIONS CAN ACCESS IT ===
  // Patch storage so we grab state after boot
  const origSave = FocusStorage.saveState;
  FocusStorage.saveState = async function (state) {
    window._focusState = state;
    return origSave.call(FocusStorage, state);
  };

  // === MAYA'S GUIDED TOUR EVENT HANDLERS ===
  const btnOpenTut = document.getElementById('btn-open-tutorials');
  if (btnOpenTut) {
    btnOpenTut.addEventListener('click', () => {
      const welcome = document.getElementById('modal-welcome-tour');
      if (welcome) {
        welcome.classList.add('open');
      } else if (window.FocusTutorials && typeof window.FocusTutorials.startSetupTour === 'function') {
        window.FocusTutorials.startSetupTour();
      }
    });
  }

  // First tour start from welcome modal
  const btnStartFirstTour = document.getElementById('btn-start-first-tour');
  if (btnStartFirstTour) {
    btnStartFirstTour.addEventListener('click', () => {
      const welcome = document.getElementById('modal-welcome-tour');
      if (welcome) welcome.classList.remove('open');
      if (window.FocusTutorials && typeof window.FocusTutorials.startSetupTour === 'function') {
        window.FocusTutorials.startSetupTour();
      }
    });
  }

  // Dismiss welcome modal for current session
  const btnWelcomeDismiss = document.getElementById('btn-welcome-dismiss');
  if (btnWelcomeDismiss) {
    btnWelcomeDismiss.addEventListener('click', () => {
      const welcome = document.getElementById('modal-welcome-tour');
      if (welcome) welcome.classList.remove('open');
      sessionStorage.setItem('focus_welcome_dismissed', 'true');
    });
  }

  // === INIT ===
  window.addEventListener('load', () => {
    setTimeout(() => {
      // Pick up state from storage after boot
      FocusStorage.loadState().then(s => {
        window._focusState = s;
        checkDataHealth();
        bindPlannerNav();
        bindGoalForm();
        if (s) {
          renderPlannerCalendar(s);
          renderSavingsGoals(s);
        }
      });
    }, 400);
  });

})();
