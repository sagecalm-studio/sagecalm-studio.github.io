/**
 * ADHD Budget Planner - Main Application Controller
 * Handles UI event bindings, reactive state updates, routing, and modal dialogs.
 */

(function () {
  'use strict';

  let state = null;
  let currentScreen = 'today';

  // --- 1. Sound / Tactile Haptic Feedback ---
  function playHapticBeep(freq = 440, duration = 0.05) {
    if (!state || !state.ui || !state.ui.soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext not allowed or not supported; fail silently
    }
  }

  // --- 2. Screen Routing ---
  function setScreen(screenId) {
    currentScreen = screenId;
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) targetScreen.classList.add('active');

    const targetTab = document.querySelector(`.nav-tab[data-nav="${screenId}"]`);
    if (targetTab) {
      targetTab.classList.add('active');
      if (typeof targetTab.scrollIntoView === 'function') {
        targetTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    // Always ensure fresh UI render on screen switch!
    renderApp();
  }

  // Expose routing globally for reliable navigation
  window.setScreen = setScreen;

  // --- 3. Reactive UI Renderer ---
  function renderApp() {
    if (!state) return;
    window._focusState = state; // Keep global reference in sync
    window.renderApp = renderApp;

    // Apply Theme & Zombie Mode
    document.body.dataset.theme = state.ui.theme || 'sage-calm';
    document.body.classList.toggle('zombie-mode-active', !!state.ui.zombieMode);

    const todayStr = FocusEngine.toISODate();
    const safeCalc = FocusEngine.calculateSafeToSpend(state, todayStr);
    const currency = state.profile.currency || 'USD';

    // 1. Render Hero Screen ("Today")
    const heroNum = document.getElementById('hero-safe-num');
    if (heroNum) {
      // The hero number displays what is currently available to spend today (updates live as expenses are logged)
      heroNum.textContent = FocusEngine.formatCents(safeCalc.leftTodayCents, currency);
    }

    const heroSub = document.getElementById('hero-sub-text');
    if (heroSub) {
      if (safeCalc.isPaydayAssumed) {
        heroSub.textContent = `No payday set yet · Tap Settings ⚙️ to enter your real schedule`;
        heroSub.style.color = 'var(--text-muted)';
      } else if (safeCalc.isOverToday) {
        heroSub.textContent = `Today went over by ${FocusEngine.formatCents(safeCalc.todayOverCents, currency)}. Absorbed — tomorrow resets.`;
        heroSub.style.color = 'var(--accent-warn)';
      } else if (safeCalc.spentTodayCents > 0) {
        heroSub.textContent = `${FocusEngine.formatCents(safeCalc.spentTodayCents, currency)} spent today of ${FocusEngine.formatCents(safeCalc.dailySafeCents, currency)} budget · ${FocusEngine.formatCents(safeCalc.spendablePoolCents, currency)} left until ${FocusEngine.formatDisplayDate(safeCalc.nextPayDate)}`;
        heroSub.style.color = 'var(--text-muted)';
      } else {
        heroSub.textContent = `${FocusEngine.formatCents(safeCalc.dailySafeCents, currency)} daily budget · ${FocusEngine.formatCents(safeCalc.spendablePoolCents, currency)} left until ${FocusEngine.formatDisplayDate(safeCalc.nextPayDate)}`;
        heroSub.style.color = 'var(--text-muted)';
      }
    }

    // Hero Stats
    const elChecking = document.getElementById('stat-checking');
    if (elChecking) elChecking.textContent = FocusEngine.formatCents(safeCalc.checkingBalanceCents, currency);

    const elBillsDue = document.getElementById('stat-bills-due');
    if (elBillsDue) elBillsDue.textContent = FocusEngine.formatCents(safeCalc.unpaidBillsCents, currency);

    const elDaysLeft = document.getElementById('stat-days-left');
    if (elDaysLeft) {
      elDaysLeft.textContent = safeCalc.isPaydayAssumed ? `${safeCalc.daysLeft}d (est)` : `${safeCalc.daysLeft} days`;
    }

    // Paycheck Runway Progress Bar
    const runwayFill = document.getElementById('runway-fill');
    const runwayLabel = document.getElementById('runway-label');
    if (runwayFill && runwayLabel) {
      if (safeCalc.isPaydayAssumed) {
        runwayFill.style.width = '100%';
        runwayLabel.textContent = `14-day default estimate · Add your payday in Settings`;
      } else {
        const elapsed = Math.max(0, 14 - safeCalc.daysLeft);
        const pct = Math.min(100, Math.round((elapsed / 14) * 100));
        runwayFill.style.width = `${pct}%`;
        runwayLabel.textContent = `${safeCalc.daysLeft} days until ${FocusEngine.formatDisplayDate(safeCalc.nextPayDate)}`;
      }
    }

    // 3. Render Three Small Quests
    const questsList = document.getElementById('quests-list');
    if (questsList) {
      const quests = FocusEngine.generateDailyQuests(state, todayStr);
      state.completedQuests = state.completedQuests || {};
      questsList.innerHTML = quests.map(q => {
        const isCompleted = q.isDone || !!state.completedQuests[`${todayStr}_${q.id}`];
        return `
        <div class="quest-item ${isCompleted ? 'done' : ''}" data-quest-id="${q.id}" style="cursor: pointer;">
          <div class="quest-checkbox ${isCompleted ? 'checked' : ''}">
            ${isCompleted ? '✓' : ''}
          </div>
          <div class="quest-text-wrap">
            <div class="quest-title" style="${isCompleted ? 'text-decoration: line-through; opacity: 0.7;' : ''}">${q.title}</div>
            <div class="quest-sub">${q.subtitle}</div>
          </div>
        </div>
      `;
      }).join('');
    }

    // 4. Render 48-Hour Impulse Vault Preview
    const vaultBadge = document.getElementById('vault-cooling-count');
    if (vaultBadge) {
      const coolingItems = (state.impulseVault || []).filter(i => !FocusEngine.getImpulseStatus(i).isReady);
      vaultBadge.textContent = coolingItems.length;
    }

    // 4b. Render Pinned Quick-Log Shortcuts
    renderQuickSpends(currency);

    // 5. Render Bills Screen
    renderBillsScreen(safeCalc, currency);

    // 6. Render Income Screen
    renderIncomeScreen(currency);

    // 7. Render Debt Payoff Screen
    renderDebtScreen(currency);

    // 8. Render Impulse Vault Screen
    renderImpulseScreen(currency);

    // 9. Render Brain Dump Screen
    renderBrainDumpScreen();

    // 10. Update Zombie Mode Widget Number
    const zombieNum = document.getElementById('zombie-avail-num');
    if (zombieNum) {
      zombieNum.textContent = FocusEngine.formatCents(safeCalc.leftTodayCents, currency);
    }

    // 11. Render Planner Calendar & Savings Goals (Extensions)
    if (typeof window.renderPlannerCalendar === 'function') {
      window.renderPlannerCalendar(state);
    }
    if (typeof window.renderSavingsGoals === 'function') {
      window.renderSavingsGoals(state);
    }

    // 12. Update Settings Screen Balance Placeholder
    const balInput = document.getElementById('settings-balance-input');
    if (balInput && !balInput.matches(':focus')) {
      const mainAcc = (state.accounts || []).find(a => a.id === 'acct-main') || (state.accounts && state.accounts[0]);
      if (mainAcc && typeof mainAcc.balanceCents === 'number') {
        balInput.placeholder = `Current: ${FocusEngine.formatCents(mainAcc.balanceCents, currency)}`;
      }
    }
  }

  // --- Sub-Renderers ---

  function renderQuickSpends(currency) {
    const grid = document.getElementById('quick-log-grid');
    if (!grid) return;

    const list = (state.quickSpends && state.quickSpends.length)
      ? state.quickSpends.slice(0, 3)
      : [
          { id: 'qs-1', label: 'Coffee', amountCents: 525, icon: '☕', category: 'Coffee' },
          { id: 'qs-2', label: 'Lunch', amountCents: 1250, icon: '🥗', category: 'Food' },
          { id: 'qs-3', label: 'Groceries', amountCents: 4500, icon: '🛒', category: 'Groceries' }
        ];

    let html = '';
    list.forEach(item => {
      html += `
        <button type="button" class="btn-quick" data-quick-spend="${item.amountCents}" data-quick-label="${item.label}" data-quick-category="${item.category || item.label}">
          <span class="btn-quick-icon">${item.icon || '💸'}</span>
          <span class="btn-quick-label">${item.label}</span>
          <span class="btn-quick-price">${FocusEngine.formatCents(item.amountCents, currency)}</span>
        </button>
      `;
    });

    if (list.length < 3) {
      for (let i = list.length; i < 3; i++) {
        html += `
          <button type="button" class="btn-quick" id="btn-add-quick-slot" style="border-style: dotted; opacity: 0.7;">
            <span class="btn-quick-icon">📌</span>
            <span class="btn-quick-label">Pin ${i + 1}</span>
            <span class="btn-quick-price">+ Add</span>
          </button>
        `;
      }
    }

    html += `
      <button type="button" class="btn-quick" id="btn-log-custom" style="border-style: dashed;">
        <span class="btn-quick-icon">➕</span>
        <span class="btn-quick-label">Custom</span>
        <span class="btn-quick-price">Log Spend</span>
      </button>
    `;

    grid.innerHTML = html;

    const settingsPreview = document.getElementById('settings-quick-preview');
    if (settingsPreview) {
      settingsPreview.innerHTML = list.map(item => `
        <div style="background: var(--surface-hover); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 6px 10px; display: flex; align-items: center; gap: 6px; font-size: 13px;">
          <span>${item.icon || '💸'}</span>
          <span style="font-weight: 600;">${item.label}</span>
          <span style="color: var(--accent-primary); font-weight: 700;">${FocusEngine.formatCents(item.amountCents, currency)}</span>
        </div>
      `).join('');
    }
  }

  function renderBillsScreen(safeCalc, currency) {
    const list = document.getElementById('bills-list');
    if (!list) return;

    if (!state.bills || !state.bills.length) {
      list.innerHTML = `<p style="padding: 16px; color: var(--text-dim);">No bills added yet. Tap [Add Bill] to add your rent or subscriptions.</p>`;
      return;
    }

    list.innerHTML = state.bills.map(b => `
      <div class="quest-item" style="background: var(--surface-card); border: 1px solid var(--border-subtle); margin-bottom: 8px;">
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 15px;">${b.name}</div>
          <div style="font-size: 12px; color: var(--text-muted);">Due on day ${b.dueDay || 1} · ${b.recurrence || 'monthly'}</div>
        </div>
        <div style="text-align: right; margin-right: 12px;">
          <div style="font-weight: 700; font-size: 16px;">${FocusEngine.formatCents(b.amountCents, currency)}</div>
        </div>
        <button class="btn-pill ${b.isPaid ? 'active' : ''}" data-action="toggle-bill-paid" data-id="${b.id}" style="${b.isPaid ? 'background: #059669; color: #fff; font-weight: 600;' : 'color: var(--text-muted);'}; margin-right: 6px;">${b.isPaid ? '✓ Paid' : 'Mark Paid'}</button>
        <button class="btn-pill" data-action="delete-bill" data-id="${b.id}" style="color: var(--accent-warn);">✕</button>
      </div>
    `).join('');
  }

  function renderIncomeScreen(currency) {
    const list = document.getElementById('income-list');
    if (!list) return;

    if (!state.income || !state.income.length) {
      list.innerHTML = `<p style="padding: 16px; color: var(--text-dim);">No income scheduled. Add your paycheck below.</p>`;
      return;
    }

    list.innerHTML = state.income.map(inc => `
      <div class="quest-item" style="background: var(--surface-card); border: 1px solid var(--border-subtle); margin-bottom: 8px;">
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 15px;">${inc.label || 'Paycheck'}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${inc.cycle || 'biweekly'} · Anchor: ${FocusEngine.formatDisplayDate(inc.anchor)}</div>
        </div>
        <div style="text-align: right; margin-right: 12px;">
          <div style="font-weight: 700; font-size: 16px; color: var(--accent-primary);">+${FocusEngine.formatCents(inc.amountCents, currency)}</div>
        </div>
        <button class="btn-pill" data-action="delete-income" data-id="${inc.id}" style="color: var(--accent-warn);">✕</button>
      </div>
    `).join('');
  }

  function renderDebtScreen(currency) {
    const list = document.getElementById('debts-list');
    const simulationResult = document.getElementById('debt-simulation-result');
    if (!list) return;

    if (!state.debts || !state.debts.length) {
      list.innerHTML = `<p style="padding: 16px; color: var(--text-dim);">No debts logged! You are debt-free or can add cards/loans below.</p>`;
      if (simulationResult) simulationResult.hidden = true;
      return;
    }

    list.innerHTML = state.debts.map(d => `
      <div class="quest-item" style="background: var(--surface-card); border: 1px solid var(--border-subtle); margin-bottom: 8px;">
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 15px;">${d.name}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${(d.aprBp / 100).toFixed(2)}% APR · Min Pay: ${FocusEngine.formatCents(d.minPaymentCents, currency)}</div>
        </div>
        <div style="text-align: right; margin-right: 12px;">
          <div style="font-weight: 700; font-size: 16px; color: var(--accent-warn);">${FocusEngine.formatCents(d.balanceCents, currency)}</div>
        </div>
        <button class="btn-pill" data-action="delete-debt" data-id="${d.id}" style="color: var(--accent-warn);">✕</button>
      </div>
    `).join('');

    // Run Simulation
    if (simulationResult) {
      const sim = FocusEngine.simulateDebtPayoff(state.debts, 5000, 'snowball');
      if (sim) {
        simulationResult.hidden = false;
        if (sim.isUnderwater) {
          document.getElementById('debt-free-date').textContent = '> 30 yrs (Payment below interest)';
          document.getElementById('debt-total-interest').textContent = FocusEngine.formatCents(sim.totalInterestCents, currency) + '+';
        } else {
          document.getElementById('debt-free-date').textContent = FocusEngine.formatDisplayDate(sim.debtFreeDate, 'full');
          document.getElementById('debt-total-interest').textContent = FocusEngine.formatCents(sim.totalInterestCents, currency);
        }
      }
    }
  }

  function renderImpulseScreen(currency) {
    const list = document.getElementById('vault-items-list');
    if (!list) return;

    const items = state.impulseVault || [];
    if (!items.length) {
      list.innerHTML = `<p style="padding: 16px; color: var(--text-dim);">No impulses parked. When you want to buy something impulsively, park it here for 48 hours!</p>`;
      return;
    }

    list.innerHTML = items.map(item => {
      const statusInfo = FocusEngine.getImpulseStatus(item);
      const isReady = statusInfo.isReady;
      const borderStyle = isReady ? 'border: 1.5px solid var(--accent-primary);' : 'border: 1px dashed var(--accent-gold);';
      const badgeText = isReady
        ? `🎉 48-Hour Cooldown Complete · Clear mind achieved!`
        : `⏳ ${statusInfo.remainingHours}h remaining in cooling period · Parked on ${FocusEngine.formatDisplayDate(item.dateAdded)}`;
      const badgeColor = isReady ? 'var(--accent-primary)' : 'var(--accent-gold)';

      return `
      <div class="quest-item" style="background: var(--surface-card); ${borderStyle} margin-bottom: 12px; padding: 16px;">
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 16px;">${item.title}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${item.notes || 'No notes'}</div>
          <div style="font-size: 11.5px; color: ${badgeColor}; font-weight: 600; margin-top: 6px;">
            ${badgeText}
          </div>
        </div>
        <div style="text-align: right; margin-left: 12px;">
          <div style="font-weight: 700; font-size: 17px; margin-bottom: 8px;">${FocusEngine.formatCents(item.priceCents, currency)}</div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-pill" data-action="vault-save" data-id="${item.id}" style="background: var(--accent-light); color: var(--accent-primary);">🎉 Let It Go!</button>
            <button class="btn-pill" data-action="vault-buy" data-id="${item.id}" style="${isReady ? 'background: var(--accent-primary); color: #fff; font-weight: 600;' : 'color: var(--text-muted);'}">${isReady ? 'Buy (Guilt-Free)' : 'Buy'}</button>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  function renderBrainDumpScreen() {
    const list = document.getElementById('braindump-list');
    if (!list) return;

    const items = state.brainDump || [];
    if (!items.length) {
      list.innerHTML = `<p style="padding: 16px; color: var(--text-dim);">Empty scratchpad. Dump random thoughts or things to remember here.</p>`;
      return;
    }

    list.innerHTML = items.map(bd => `
      <div class="quest-item" style="background: var(--surface-card); border: 1px solid var(--border-subtle); margin-bottom: 6px;">
        <button class="quest-checkbox ${bd.done ? 'checked' : ''}" data-action="toggle-braindump" data-id="${bd.id}">
          ${bd.done ? '✓' : ''}
        </button>
        <div class="quest-text-wrap">
          <div class="quest-title" style="${bd.done ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${bd.text}</div>
        </div>
        <button class="btn-pill" data-action="delete-braindump" data-id="${bd.id}" style="color: var(--text-dim); padding: 4px 8px;">✕</button>
      </div>
    `).join('');
  }

  // --- 4. Event Listeners & Actions ---

  function bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const screenId = e.currentTarget.dataset.nav;
        if (screenId) {
          playHapticBeep(520, 0.04);
          setScreen(screenId);
        }
      });
    });

    // Zombie Mode Toggle
    const btnZombie = document.getElementById('btn-toggle-zombie');
    if (btnZombie) {
      btnZombie.addEventListener('click', () => {
        state.ui.zombieMode = !state.ui.zombieMode;
        playHapticBeep(state.ui.zombieMode ? 350 : 600, 0.08);
        FocusStorage.saveState(state);
        renderApp();
      });
    }

    // Zombie Calculator Check
    const btnZombieCheck = document.getElementById('btn-zombie-calc');
    const inputZombieSpend = document.getElementById('zombie-spend-input');
    const zombieResult = document.getElementById('zombie-calc-result');
    if (btnZombieCheck && inputZombieSpend) {
      btnZombieCheck.addEventListener('click', () => {
        const valCents = FocusEngine.parseToCents(inputZombieSpend.value);
        if (valCents <= 0) return;

        const safeCalc = FocusEngine.calculateSafeToSpend(state);
        const currency = state.profile.currency || 'USD';
        if (valCents <= safeCalc.leftTodayCents) {
          const remaining = safeCalc.leftTodayCents - valCents;
          zombieResult.textContent = `✅ Yes! You can afford this and still have ${FocusEngine.formatCents(remaining, currency)} left today.`;
          zombieResult.style.color = 'var(--accent-vivid)';
        } else {
          const overBy = valCents - safeCalc.leftTodayCents;
          zombieResult.textContent = `⚠️ This is ${FocusEngine.formatCents(overBy, currency)} over today's available allowance. It will be smoothly absorbed tomorrow.`;
          zombieResult.style.color = 'var(--accent-gold)';
        }
      });
    }

    // Delegated click handler on quick-log-grid
    const quickGrid = document.getElementById('quick-log-grid');
    if (quickGrid) {
      quickGrid.addEventListener('click', (e) => {
        const btnSpend = e.target.closest('[data-quick-spend]');
        if (btnSpend) {
          const cents = parseInt(btnSpend.dataset.quickSpend, 10);
          const label = btnSpend.dataset.quickLabel || 'Spend';
          const cat = btnSpend.dataset.quickCategory || label;
          const todayStr = FocusEngine.toISODate();
          const now = Date.now();

          state.transactions.push({
            id: 'tx-' + now,
            timestamp: now,
            date: todayStr,
            category: cat,
            note: label,
            amountCents: cents,
            kind: 'spend'
          });

          playHapticBeep(580, 0.06);
          FocusStorage.saveState(state);
          renderApp();

          const iconEl = btnSpend.querySelector('.btn-quick-icon');
          const icon = iconEl ? iconEl.textContent.trim() : '💸';
          if (window.showToast) {
            window.showToast(`Logged ${label} (${FocusEngine.formatCents(cents, state.profile.currency)})`, icon);
          }
          return;
        }

        const btnCustom = e.target.closest('#btn-log-custom');
        if (btnCustom) {
          const modalSpend = document.getElementById('modal-custom-spend');
          if (modalSpend) modalSpend.classList.add('open');
          return;
        }

        const btnAddSlot = e.target.closest('#btn-add-quick-slot');
        if (btnAddSlot) {
          openCustomizeQuickModal();
          return;
        }
      });
    }

    // Modal openers for Customize Quick Spends
    function openCustomizeQuickModal() {
      const modal = document.getElementById('modal-customize-quick-spends');
      if (!modal) return;
      const list = (state.quickSpends && state.quickSpends.length)
        ? state.quickSpends
        : [
            { id: 'qs-1', label: 'Coffee', amountCents: 525, icon: '☕', category: 'Coffee' },
            { id: 'qs-2', label: 'Lunch', amountCents: 1250, icon: '🥗', category: 'Food' },
            { id: 'qs-3', label: 'Groceries', amountCents: 4500, icon: '🛒', category: 'Groceries' }
          ];

      for (let i = 0; i < 3; i++) {
        const item = list[i] || { icon: '', label: '', amountCents: 0 };
        const iconInput = document.getElementById(`quick-icon-${i}`);
        const labelInput = document.getElementById(`quick-label-${i}`);
        const amountInput = document.getElementById(`quick-amount-${i}`);

        if (iconInput) iconInput.value = item.icon || (i === 0 ? '☕' : i === 1 ? '🥗' : '🛒');
        if (labelInput) labelInput.value = item.label || '';
        if (amountInput) amountInput.value = item.amountCents ? (item.amountCents / 100).toFixed(2) : '';
      }
      modal.classList.add('open');
    }

    const btnEditQuick = document.getElementById('btn-edit-quick-spends');
    if (btnEditQuick) {
      btnEditQuick.addEventListener('click', openCustomizeQuickModal);
    }

    const btnOpenQuickSettings = document.getElementById('btn-open-quick-settings');
    if (btnOpenQuickSettings) {
      btnOpenQuickSettings.addEventListener('click', openCustomizeQuickModal);
    }

    // Preset emoji buttons inside customize modal
    document.querySelectorAll('.quick-emoji-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        const iconInput = document.getElementById(`quick-icon-${slot}`);
        const labelInput = document.getElementById(`quick-label-${slot}`);
        const amountInput = document.getElementById(`quick-amount-${slot}`);
        if (iconInput) iconInput.value = btn.dataset.emoji;
        if (labelInput) labelInput.value = btn.dataset.label;
        if (amountInput) amountInput.value = btn.dataset.amount;
      });
    });

    // Clear slot buttons inside customize modal
    document.querySelectorAll('.btn-clear-quick-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        const iconInput = document.getElementById(`quick-icon-${slot}`);
        const labelInput = document.getElementById(`quick-label-${slot}`);
        const amountInput = document.getElementById(`quick-amount-${slot}`);
        if (iconInput) iconInput.value = '';
        if (labelInput) labelInput.value = '';
        if (amountInput) amountInput.value = '';
      });
    });

    // Save Pinned Shortcuts form
    const formCustomizeQuick = document.getElementById('form-customize-quick-spends');
    if (formCustomizeQuick) {
      formCustomizeQuick.addEventListener('submit', (e) => {
        e.preventDefault();
        const updated = [];
        for (let i = 0; i < 3; i++) {
          const icon = (document.getElementById(`quick-icon-${i}`).value || '').trim() || '💸';
          const label = (document.getElementById(`quick-label-${i}`).value || '').trim();
          const amountVal = document.getElementById(`quick-amount-${i}`).value;
          const cents = FocusEngine.parseToCents(amountVal);

          if (label && cents > 0) {
            updated.push({
              id: 'qs-' + (i + 1),
              label: label,
              amountCents: cents,
              icon: icon,
              category: label
            });
          }
        }

        // If user left everything empty, default to coffee
        if (!updated.length) {
          updated.push({ id: 'qs-1', label: 'Coffee', amountCents: 525, icon: '☕', category: 'Coffee' });
        }

        state.quickSpends = updated;
        const modal = document.getElementById('modal-customize-quick-spends');
        if (modal) modal.classList.remove('open');
        playHapticBeep(640, 0.08);
        FocusStorage.saveState(state);
        renderApp();
        if (window.showToast) window.showToast('Pinned shortcuts updated!', '📌');
      });
    }

    // Custom Spend Modal
    const btnLogCustom = document.getElementById('btn-log-custom');
    const modalSpend = document.getElementById('modal-custom-spend');
    const formSpend = document.getElementById('form-custom-spend');
    if (btnLogCustom && modalSpend) {
      btnLogCustom.addEventListener('click', () => modalSpend.classList.add('open'));
    }
    if (formSpend) {
      formSpend.addEventListener('submit', (e) => {
        e.preventDefault();
        const amtInput = document.getElementById('spend-amount');
        const catInput = document.getElementById('spend-category');
        const noteInput = document.getElementById('spend-note');

        const cents = FocusEngine.parseToCents(amtInput.value);
        if (cents > 0) {
          const now = Date.now();
          state.transactions.push({
            id: 'tx-' + now,
            timestamp: now,
            date: FocusEngine.toISODate(),
            category: catInput.value || 'General',
            note: noteInput.value || 'Spend',
            amountCents: cents,
            kind: 'spend'
          });
          amtInput.value = '';
          noteInput.value = '';
          modalSpend.classList.remove('open');
          playHapticBeep(640, 0.08);
          FocusStorage.saveState(state);
          renderApp();
        }
      });
    }

    // Park an Impulse (48-Hour Vault)
    const btnParkImpulse = document.getElementById('btn-park-impulse');
    const modalImpulse = document.getElementById('modal-impulse-vault');
    const formImpulse = document.getElementById('form-impulse-vault');
    if (btnParkImpulse && modalImpulse) {
      btnParkImpulse.addEventListener('click', () => modalImpulse.classList.add('open'));
    }
    if (formImpulse) {
      formImpulse.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('impulse-title');
        const priceInput = document.getElementById('impulse-price');
        const notesInput = document.getElementById('impulse-notes');

        const cents = FocusEngine.parseToCents(priceInput.value);
        if (cents > 0 && titleInput.value.trim()) {
          const now = Date.now();
          state.impulseVault.push({
            id: 'imp-' + now,
            createdAt: now,
            title: titleInput.value.trim(),
            priceCents: cents,
            dateAdded: FocusEngine.toISODate(),
            hoursTimer: 48,
            status: 'cooling',
            notes: notesInput.value.trim()
          });
          titleInput.value = '';
          priceInput.value = '';
          notesInput.value = '';
          modalImpulse.classList.remove('open');
          playHapticBeep(520, 0.1);
          FocusStorage.saveState(state);
          renderApp();
        }
      });
    }

    // Contextual Help Badges Modal
    const modalHelp = document.getElementById('modal-help');
    document.addEventListener('click', (e) => {
      const badge = e.target.closest('[data-help]');
      if (badge && modalHelp) {
        const key = badge.dataset.help;
        const helpItem = FocusHelp[key];
        if (helpItem) {
          document.getElementById('help-modal-title').textContent = helpItem.title;
          document.getElementById('help-what').textContent = helpItem.what;
          document.getElementById('help-todo').textContent = helpItem.todo;
          document.getElementById('help-why').textContent = helpItem.why;
          document.getElementById('help-note').textContent = helpItem.note;
          modalHelp.classList.add('open');
        }
      }
    });

    // Close Modals on backdrop click or close button
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      });
    });

    // Close Modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });

    // Theme Selector in Settings
    document.querySelectorAll('[data-set-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.setTheme;
        state.ui.theme = theme;
        FocusStorage.saveState(state);
        renderApp();
      });
    });

    // Backup & Export Buttons
    const btnDlBackup = document.getElementById('btn-download-backup');
    if (btnDlBackup) {
      btnDlBackup.addEventListener('click', () => FocusStorage.exportJSONBackup(state));
    }

    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => FocusStorage.exportCSV(state));
    }

    const fileRestore = document.getElementById('file-restore-backup');
    if (fileRestore) {
      fileRestore.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              state = FocusStorage.importJSONBackup(event.target.result);
              FocusStorage.saveState(state);
              renderApp();
              alert('Backup restored successfully!');
            } catch (err) {
              alert('Error restoring backup: ' + err.message);
            }
          };
          reader.readAsText(file);
        }
      });
    }

    // Dynamic Delegate Clicks (delete bill, delete income, toggle brain dump)
    document.addEventListener('click', (e) => {
      const btnDelBill = e.target.closest('[data-action="delete-bill"]');
      if (btnDelBill) {
        const id = btnDelBill.dataset.id;
        state.bills = (state.bills || []).filter(b => b.id !== id);
        FocusStorage.saveState(state);
        renderApp();
        return;
      }

      const btnDelIncome = e.target.closest('[data-action="delete-income"]');
      if (btnDelIncome) {
        const id = btnDelIncome.dataset.id;
        state.income = (state.income || []).filter(i => i.id !== id);
        FocusStorage.saveState(state);
        renderApp();
        return;
      }

      const btnDelDebt = e.target.closest('[data-action="delete-debt"]');
      if (btnDelDebt) {
        const id = btnDelDebt.dataset.id;
        state.debts = (state.debts || []).filter(d => d.id !== id);
        FocusStorage.saveState(state);
        renderApp();
        return;
      }

      const btnToggleBill = e.target.closest('[data-action="toggle-bill-paid"]');
      if (btnToggleBill) {
        const id = btnToggleBill.dataset.id;
        const bill = (state.bills || []).find(b => b.id === id);
        if (bill) {
          bill.isPaid = !bill.isPaid;
          const today = FocusEngine.toISODate();
          bill.paidDates = bill.paidDates || [];
          if (bill.isPaid) {
            if (!bill.paidDates.includes(today)) bill.paidDates.push(today);
            playHapticBeep(660, 0.08);
            if (window.showToast) window.showToast(`Marked ${bill.name} as paid!`, '✅');
          } else {
            bill.paidDates = bill.paidDates.filter(d => d !== today);
            playHapticBeep(440, 0.05);
            if (window.showToast) window.showToast(`Marked ${bill.name} as unpaid`, 'ℹ️');
          }
          FocusStorage.saveState(state);
          renderApp();
        }
        return;
      }

      const btnVaultSave = e.target.closest('[data-action="vault-save"]');
      if (btnVaultSave) {
        const id = btnVaultSave.dataset.id;
        state.impulseVault = (state.impulseVault || []).filter(i => i.id !== id);
        playHapticBeep(880, 0.15);
        if (typeof window.launchConfetti === 'function') window.launchConfetti();
        if (window.showToast) {
          window.showToast('🎉 Victory! You let go of an impulse spend and protected your money!', '💰');
        }
        FocusStorage.saveState(state);
        renderApp();
        return;
      }

      const btnVaultBuy = e.target.closest('[data-action="vault-buy"]');
      if (btnVaultBuy) {
        const id = btnVaultBuy.dataset.id;
        const item = (state.impulseVault || []).find(i => i.id === id);
        if (item) {
          const statusInfo = FocusEngine.getImpulseStatus(item);
          if (!statusInfo.isReady) {
            const proceed = confirm(`⏳ Cooling period in progress (${statusInfo.remainingHours}h left).\n\nADHD Dopamine check: Are you sure you want to buy before the 48-hour reset?`);
            if (!proceed) return;
          }
          const now = Date.now();
          state.transactions.push({
            id: 'tx-' + now,
            timestamp: now,
            date: FocusEngine.toISODate(),
            category: statusInfo.isReady ? 'Impulse Vault (Guilt-Free)' : 'Impulse Spend',
            note: item.title,
            amountCents: item.priceCents,
            kind: 'spend'
          });
          state.impulseVault = state.impulseVault.filter(i => i.id !== id);
          playHapticBeep(600, 0.08);
          FocusStorage.saveState(state);
          renderApp();
          if (window.showToast) {
            window.showToast(statusInfo.isReady ? 'Bought guilt-free after cooling period!' : 'Purchase logged!', '🛍️');
          }
        }
        return;
      }

      const questItem = e.target.closest('[data-quest-id]');
      if (questItem) {
        const questId = questItem.dataset.questId;
        const today = FocusEngine.toISODate();
        state.completedQuests = state.completedQuests || {};
        const key = `${today}_${questId}`;
        state.completedQuests[key] = !state.completedQuests[key];
        playHapticBeep(720, 0.07);
        if (state.completedQuests[key]) {
          if (typeof window.launchConfetti === 'function') window.launchConfetti();
        }
        FocusStorage.saveState(state);
        renderApp();
        return;
      }

      const btnToggleBD = e.target.closest('[data-action="toggle-braindump"]');
      if (btnToggleBD) {
        const id = btnToggleBD.dataset.id;
        const item = (state.brainDump || []).find(i => i.id === id);
        if (item) item.done = !item.done;
        FocusStorage.saveState(state);
        renderApp();
        return;
      }

      const btnDelBD = e.target.closest('[data-action="delete-braindump"]');
      if (btnDelBD) {
        const id = btnDelBD.dataset.id;
        state.brainDump = (state.brainDump || []).filter(i => i.id !== id);
        FocusStorage.saveState(state);
        renderApp();
        return;
      }
    });

    // Add Brain Dump Form
    const formBD = document.getElementById('form-add-braindump');
    const inputBD = document.getElementById('input-braindump');
    if (formBD && inputBD) {
      formBD.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = inputBD.value.trim();
        if (text) {
          state.brainDump.unshift({
            id: 'bd-' + Date.now(),
            text: text,
            done: false,
            createdAt: FocusEngine.toISODate()
          });
          inputBD.value = '';
          playHapticBeep(520, 0.04);
          FocusStorage.saveState(state);
          renderApp();
        }
      });
    }

    // Add Bill Form
    const formAddBill = document.getElementById('form-add-bill');
    if (formAddBill) {
      formAddBill.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('bill-name').value.trim();
        const amount = FocusEngine.parseToCents(document.getElementById('bill-amount').value);
        const dueDay = parseInt(document.getElementById('bill-day').value, 10) || 1;
        const rec = document.getElementById('bill-recurrence').value;

        if (name && amount > 0) {
          state.bills.push({
            id: 'b-' + Date.now(),
            name: name,
            amountCents: amount,
            dueDay: dueDay,
            recurrence: rec,
            dayA: rec === 'twiceday' ? dueDay : undefined,
            dayB: rec === 'twiceday' ? (dueDay <= 15 ? dueDay + 15 : 15) : undefined,
            paidDates: [],
            weekendEarly: true
          });
          document.getElementById('bill-name').value = '';
          document.getElementById('bill-amount').value = '';
          document.getElementById('modal-add-bill').classList.remove('open');
          playHapticBeep(620, 0.06);
          FocusStorage.saveState(state);
          renderApp();
        }
      });
    }

    // Add Income Form
    const formAddIncome = document.getElementById('form-add-income');
    if (formAddIncome) {
      formAddIncome.addEventListener('submit', (e) => {
        e.preventDefault();
        const label = document.getElementById('income-label').value.trim();
        const amount = FocusEngine.parseToCents(document.getElementById('income-amount').value);
        const cycle = document.getElementById('income-cycle').value;
        const anchor = document.getElementById('income-anchor').value;

        if (amount > 0 && anchor) {
          const anchorDay = parseInt(anchor.split('-')[2], 10) || 1;
          let dayA, dayB;
          if (cycle === 'semimonthly') {
            if (anchorDay <= 15) {
              dayA = anchorDay;
              dayB = (anchorDay === 15) ? 31 : anchorDay + 15;
            } else {
              dayB = anchorDay;
              dayA = (anchorDay >= 30) ? 15 : anchorDay - 15;
            }
          }
          state.income.push({
            id: 'inc-' + Date.now(),
            label: label || 'Paycheck',
            amountCents: amount,
            cycle: cycle,
            anchor: anchor,
            dueDay: anchorDay,
            dayA: dayA,
            dayB: dayB,
            weekendEarly: true
          });
          document.getElementById('income-label').value = '';
          document.getElementById('income-amount').value = '';
          document.getElementById('modal-add-income').classList.remove('open');
          playHapticBeep(620, 0.06);
          FocusStorage.saveState(state);
          renderApp();
        }
      });
    }

    // Add Debt Form
    const formAddDebt = document.getElementById('form-add-debt');
    if (formAddDebt) {
      formAddDebt.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('debt-name').value.trim();
        const balance = FocusEngine.parseToCents(document.getElementById('debt-balance').value);
        const apr = Math.round(parseFloat(document.getElementById('debt-apr').value || 0) * 100); // bp
        const minPay = FocusEngine.parseToCents(document.getElementById('debt-minpay').value);

        if (name && balance > 0) {
          state.debts.push({
            id: 'd-' + Date.now(),
            name: name,
            balanceCents: balance,
            aprBp: apr,
            minPaymentCents: minPay || 2500,
            isCreditCard: true,
            payInFull: false,
            autoHold: true
          });
          document.getElementById('debt-name').value = '';
          document.getElementById('debt-balance').value = '';
          document.getElementById('modal-add-debt').classList.remove('open');
          playHapticBeep(620, 0.06);
          FocusStorage.saveState(state);
          renderApp();
        }
      });
    }

    // Update Checking Balance in Settings
    const formBalance = document.getElementById('form-update-balance');
    if (formBalance) {
      formBalance.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('settings-balance-input');
        const cents = FocusEngine.parseToCents(input.value);
        const mainAcc = (state.accounts || []).find(a => a.id === 'acct-main');
        if (mainAcc) {
          mainAcc.balanceCents = cents;
          mainAcc.balanceAsOf = FocusEngine.toISODate();
          mainAcc.balanceUpdatedAt = Date.now();
          playHapticBeep(640, 0.06);
          FocusStorage.saveState(state);
          renderApp();
          if (window.showToast) window.showToast('Checking balance updated to ' + FocusEngine.formatCents(cents, state.profile.currency), '💳');
        }
      });
    }
  }

  // --- 5. Application Bootstrapper ---
  async function boot() {
    await FocusStorage.init();
    state = await FocusStorage.loadState();

    // Ensure state has initialized flag so user empty data is NEVER wiped on refresh
    if (!state.initialized) {
      state.initialized = true;
      await FocusStorage.saveState(state);
    }

    bindEvents();
    renderApp();
    setScreen('today');
    window._focusState = state;

    // Cross-tab synchronization: Instant live update if user has multiple browser tabs open
    window.addEventListener('storage', async (e) => {
      if (e.key === 'focusbudget_state_v1' || e.key === 'focus_budget_state_v1' || e.key === 'focusbudget_state') {
        if (window.FocusTutorials && window.FocusTutorials.isActive && window.FocusTutorials.isActive()) return;
        const fresh = await FocusStorage.loadState();
        if (fresh) {
          state = fresh;
          window._focusState = state;
          renderApp();
        }
      }
    });

    // Clean up any stale legacy dismissal flag
    localStorage.removeItem('focus_starter_dismissed');

    // Show Maya's Welcome Modal on launch whenever income is not configured yet
    const hasIncome = state.income && state.income.length > 0;
    const sessionDismissed = sessionStorage.getItem('focus_welcome_dismissed') === 'true';

    if (!hasIncome && !sessionDismissed) {
      setTimeout(() => {
        const welcomeModal = document.getElementById('modal-welcome-tour');
        if (welcomeModal) welcomeModal.classList.add('open');
      }, 300);
    }

    // Register Service Worker for offline PWA functionality
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // Start app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
