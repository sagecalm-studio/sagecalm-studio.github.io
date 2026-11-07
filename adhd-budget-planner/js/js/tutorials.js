/**
 * ADHD Budget Planner - Maya's Conversational Guided Tour System
 * Complete hand-holding: user-driven tab navigation, field-by-field form guidance,
 * zero modal collision, DOM-anchored indicators, gentle ADHD guardrails.
 */

(function (global) {
  'use strict';

  const Maya = {};
  let currentStepIndex = 0;
  let userStateSnapshot = null;
  let isTourActive = false;
  let currentTargetEl = null;
  const visitedTabs = new Set();

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // Helper: Find visible nav tab (mobile nav-dock or desktop sidebar)
  function getVisibleNavTab(navKey) {
    const tabs = document.querySelectorAll(`[data-nav="${navKey}"]`);
    for (const t of tabs) {
      if (t.offsetParent !== null) return t;
    }
    return tabs[0];
  }

  // ========================================================
  // 1. DOM-ANCHORED TARGET HIGHLIGHT & BADGE
  // Physically attached to the element so it NEVER gets lost on resize/scroll!
  // ========================================================
  function highlightTarget(target, badgeText = '👩‍💼 Tap here') {
    clearHighlight();
    if (!target) return null;

    const el = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!el) return null;

    currentTargetEl = el;

    // Smoothly scroll into view if needed
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    el.classList.add('tutorial-target-active');

    // Create DOM-anchored badge
    const badge = document.createElement('span');
    badge.className = 'maya-target-badge';
    badge.id = 'maya-target-badge';
    badge.innerHTML = `<span>${badgeText}</span>`;

    // Handle void elements (<input>, <select>) where appending children is invalid HTML
    const isVoidEl = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
    const hostEl = isVoidEl ? el.parentElement : el;

    if (hostEl) {
      const computed = window.getComputedStyle(hostEl).position;
      if (computed === 'static') {
        hostEl.dataset.origPosition = 'static';
        hostEl.style.position = 'relative';
      }
      if (isVoidEl) {
        badge.style.top = '-10px';
        badge.style.right = '4px';
      }
      hostEl.appendChild(badge);
    }

    return el;
  }

  function clearHighlight() {
    if (currentTargetEl) {
      currentTargetEl.classList.remove('tutorial-target-active');
      if (currentTargetEl.dataset.origPosition === 'static') {
        currentTargetEl.style.position = '';
        delete currentTargetEl.dataset.origPosition;
      }
      const b = currentTargetEl.querySelector('#maya-target-badge');
      if (b) b.remove();
      if (currentTargetEl.parentElement) {
        const pb = currentTargetEl.parentElement.querySelector('#maya-target-badge');
        if (pb) pb.remove();
      }
      currentTargetEl = null;
    }

    document.querySelectorAll('.tutorial-target-active').forEach(el => {
      el.classList.remove('tutorial-target-active');
      const b = el.querySelector('#maya-target-badge');
      if (b) b.remove();
      if (el.parentElement) {
        const pb = el.parentElement.querySelector('#maya-target-badge');
        if (pb) pb.remove();
      }
    });
  }

  // Helper: Realistic Human Typing Animation
  async function typeIntoField(element, text, speed = 25) {
    if (!element) return;
    element.focus();
    element.value = '';
    element.classList.add('typing-active');

    // For type="number", intermediate decimal points like "2100." cause HTML5 number
    // inputs to reject and wipe value to empty string, leading to "00".
    // We clean trailing decimal zeros for number inputs and use an in-memory accumulator.
    const cleanText = (element.type === 'number' && text.endsWith('.00')) ? text.slice(0, -3) : text;

    return new Promise((resolve) => {
      let currentVal = '';
      let idx = 0;
      const interval = setInterval(() => {
        currentVal += cleanText[idx];
        idx++;
        element.value = currentVal;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        if (idx >= cleanText.length) {
          clearInterval(interval);
          element.value = cleanText; // ensure exact value
          element.classList.remove('typing-active');
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          setTimeout(resolve, 150);
        }
      }, speed);
    });
  }

  // ========================================================
  // 2. EMBEDDED MODAL GUIDE BANNER (ZERO MODAL OVERLAP)
  // Injected directly into the modal dialog so it never overlaps forms!
  // ========================================================
  function showModalGuideBanner(modalSelector, { message, actionText, actionHandler }) {
    hideGuideCard();

    const modal = document.querySelector(modalSelector);
    if (!modal) return;

    const dialog = modal.querySelector('.modal-dialog');
    if (!dialog) return;

    // Remove any existing banner
    const existing = dialog.querySelector('.maya-modal-guide-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'maya-modal-guide-banner';
    banner.id = 'maya-modal-banner';
    banner.innerHTML = `
      <div class="maya-modal-guide-top">
        <div class="maya-modal-guide-profile">
          <span>👩‍💼</span>
          <span>Maya's Step-by-Step Guide</span>
          <span class="maya-online-dot"></span>
        </div>
      </div>
      <div class="maya-modal-guide-msg">${message}</div>
      ${actionText ? `
        <button type="button" class="maya-modal-guide-btn pulse" id="btn-modal-guide-act">
          ${actionText}
        </button>
      ` : ''}
    `;

    const form = dialog.querySelector('form');
    if (form) {
      dialog.insertBefore(banner, form);
    } else {
      dialog.prepend(banner);
    }

    const actBtn = banner.querySelector('#btn-modal-guide-act');
    if (actBtn && typeof actionHandler === 'function') {
      actBtn.addEventListener('click', async () => {
        actBtn.disabled = true;
        actBtn.classList.remove('pulse');
        actBtn.style.opacity = '0.6';
        await actionHandler((newOpts) => {
          showModalGuideBanner(modalSelector, newOpts);
        });
      });
    }
  }

  function removeModalGuideBanner() {
    const banner = document.getElementById('maya-modal-banner');
    if (banner) banner.remove();
    showGuideCard();
  }

  function hideGuideCard() {
    const card = document.getElementById('tutorial-guide-card');
    if (card) card.style.display = 'none';
  }

  function showGuideCard() {
    const card = document.getElementById('tutorial-guide-card');
    if (card) card.style.display = '';
  }

  // Fail-Safe: MutationObserver to ensure Maya's guide card is NEVER left hidden if a modal closes
  let modalObserver = null;
  function setupModalFailSafe() {
    if (modalObserver) return;
    if (typeof MutationObserver !== 'undefined') {
      modalObserver = new MutationObserver((mutations) => {
        if (!isTourActive) return;
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            const el = m.target;
            if (el.classList.contains('modal-overlay') && !el.classList.contains('open')) {
              setTimeout(() => {
                if (isTourActive) showGuideCard();
              }, 120);
            }
          }
        }
      });
      document.querySelectorAll('.modal-overlay').forEach(m => {
        modalObserver.observe(m, { attributes: true });
      });
    }
  }

  // ========================================================
  // 3. UX GUARDRAILS (RESTRICT CONTROL & ENCOURAGE)
  // ========================================================
  function handleTourClickGuard(e) {
    if (!isTourActive) return;

    // Allowed areas:
    // 0. Programmatic/synthetic events generated by app/tour scripts (!e.isTrusted)
    // 1. Inside Maya's guide card
    // 2. Inside the HUD top bar (e.g. Exit button)
    // 3. Inside the active modal dialog
    // 4. The current target element being highlighted or its children
    if (!e.isTrusted) return; // Never block programmatic actions

    const isGuide = e.target.closest('#tutorial-guide-card');
    const isHUD = e.target.closest('#tutorial-hud-bar');
    const isModal = e.target.closest('.modal-overlay.open .modal-dialog');
    const isTarget = currentTargetEl && (currentTargetEl === e.target || currentTargetEl.contains(e.target));

    if (isGuide || isHUD || isModal || isTarget) {
      return; // Allowed interaction!
    }

    // Intercept accidental clicks outside the active step!
    e.preventDefault();
    e.stopPropagation();

    triggerEncouragementNudge();
  }

  function triggerEncouragementNudge() {
    const card = document.getElementById('tutorial-guide-card');
    if (card && card.style.display !== 'none') {
      card.classList.remove('nudge');
      void card.offsetWidth; // trigger reflow
      card.classList.add('nudge');

      let toast = card.querySelector('.maya-nudge-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'maya-nudge-toast';
        toast.textContent = "✨ Follow Maya's highlighted step to move forward!";
        const msg = card.querySelector('.maya-bubble-message');
        if (msg) msg.parentNode.insertBefore(toast, msg.nextSibling);

        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
      }

      const promptBtn = card.querySelector('.maya-bubble-prompt-btn');
      if (promptBtn) {
        promptBtn.classList.add('pulse');
      }
    } else {
      const banner = document.getElementById('maya-modal-banner');
      if (banner) {
        const btn = banner.querySelector('.maya-modal-guide-btn');
        if (btn) btn.classList.add('pulse');
      }
    }
  }

  // ========================================================
  // 4. MASTER INTERACTIVE SETUP STORY WITH REAL HAND-HOLDING
  // ========================================================
  const MASTER_STORY = {
    title: "Maya's Hand-Holding Setup Guide",
    steps: [
      // STEP 1: Paycheck
      {
        stepNum: 1,
        title: "When Does Pay Land?",
        init: async () => {
          clearHighlight();

          // Check if already in settings tab
          const activeTab = document.querySelector('.nav-tab.active');
          const isSettings = activeTab && activeTab.dataset.nav === 'settings';

          if (!isSettings) {
            // Hand-hold: Point directly to Settings tab first!
            const setTab = getVisibleNavTab('settings');
            highlightTarget(setTab, '👉 1. Tap Settings Tab');

            let advanced = false;
            const goToSettings = () => {
              if (advanced) return;
              advanced = true;
              if (window.setScreen) window.setScreen('settings');
              else if (setTab) setTab.click();
              setTimeout(startStep1B, 250);
            };

            renderChatBubble({
              message: "Every budget begins with money coming in! First, let's open the <strong>Settings ⚙️</strong> tab in the navigation bar to configure your paycheck:",
              actionText: "👉 Open Settings Tab ⚙️",
              actionHandler: goToSettings
            });

            if (setTab) {
              setTab.addEventListener('click', goToSettings, { once: true });
            }
          } else {
            startStep1B();
          }
        }
      },

      // STEP 2: Bills
      {
        stepNum: 2,
        title: "Locking Away Rent & Bills",
        init: async () => {
          clearHighlight();

          // Hand-hold: Point directly to Bills tab first!
          const billsTab = getVisibleNavTab('bills');
          highlightTarget(billsTab, '👉 1. Tap Bills Tab');

          let advanced = false;
          const goToBills = () => {
            if (advanced) return;
            advanced = true;
            if (window.setScreen) window.setScreen('bills');
            else if (billsTab) billsTab.click();
            setTimeout(startStep2B, 250);
          };

          renderChatBubble({
            message: "Essentials like rent must be locked away so you never accidentally spend rent money! Tap the <strong>Bills 📅</strong> tab in the navigation bar:",
            actionText: "👉 Open Bills Tab 📅",
            actionHandler: goToBills
          });

          if (billsTab) {
            billsTab.addEventListener('click', goToBills, { once: true });
          }
        }
      },

      // STEP 3: Checking Balance
      {
        stepNum: 3,
        title: "What's in Checking Today?",
        init: async () => {
          clearHighlight();

          // Hand-hold: Point directly back to Settings tab!
          const setTab = getVisibleNavTab('settings');
          highlightTarget(setTab, '👉 1. Tap Settings Tab');

          let advanced = false;
          const goToSettings = () => {
            if (advanced) return;
            advanced = true;
            if (window.setScreen) window.setScreen('settings');
            else if (setTab) setTab.click();
            setTimeout(startStep3B, 250);
          };

          renderChatBubble({
            message: "Now check your real bank app. Let's return to the <strong>Settings ⚙️</strong> tab to enter your current checking balance:",
            actionText: "👉 Open Settings Tab ⚙️",
            actionHandler: goToSettings
          });

          if (setTab) {
            setTab.addEventListener('click', goToSettings, { once: true });
          }
        }
      },

      // STEP 4: The Hero Reveal (Today Dashboard)
      {
        stepNum: 4,
        title: "Your Daily Safe Number!",
        init: async () => {
          clearHighlight();

          // Hand-hold: Point directly to Today tab!
          const todayTab = getVisibleNavTab('today');
          highlightTarget(todayTab, '👉 1. Tap Today Tab');

          let advanced = false;
          const goToToday = () => {
            if (advanced) return;
            advanced = true;
            if (window.setScreen) window.setScreen('today');
            else if (todayTab) todayTab.click();
            setTimeout(startStep4B, 250);
          };

          renderChatBubble({
            message: "All 3 numbers are connected! Tap the <strong>Today ☀️</strong> tab in the navigation bar to see your daily safe spending number:",
            actionText: "👉 Open Today Dashboard ☀️",
            actionHandler: goToToday
          });

          if (todayTab) {
            todayTab.addEventListener('click', goToToday, { once: true });
          }
        }
      },

      // STEP 5: Impulse Vault & Zombie Mode
      {
        stepNum: 5,
        title: "Impulse Vault & Zombie Mode",
        init: async () => {
          clearHighlight();
          const tab = getVisibleNavTab('today');
          if (tab) tab.click();
          await wait(200);

          highlightTarget('#btn-toggle-zombie', '👉 Zombie Mode');

          renderChatBubble({
            message: "Two ADHD superpowers keep your budget alive:<br><br>" +
                     "1. <strong>48-Hour Vault:</strong> Urge to buy? Park it for 48 hours. 82% of urges vanish on their own!<br>" +
                     "2. <strong>Zombie Mode:</strong> For low-energy burnout days. Tap below to test it:",
            actionText: "🧟 Try Zombie Mode (Turn ON)",
            actionHandler: async () => {
              const btnZombie = document.getElementById('btn-toggle-zombie');
              if (btnZombie) btnZombie.click();

              renderChatBubble({
                message: "Notice how 90% of clutter vanishes, leaving only: <em>'Can I afford this dinner right now?'</em>",
                actionText: "☀️ Turn Zombie Mode OFF",
                actionHandler: async () => {
                  if (btnZombie) btnZombie.click();
                  clearHighlight();

                  renderChatBubble({
                    message: "🎉 <strong>You've completed Maya's tour!</strong> You now know how ADHD Budget Planner protects your money without shame or complex math.",
                    actionText: "Start Entering My Own Numbers 🎉",
                    isComplete: true,
                    actionHandler: () => {
                      Maya.exitTour();
                      const setTab = getVisibleNavTab('settings');
                      if (setTab) setTab.click();
                    }
                  });
                }
              });
            }
          });
        }
      }
    ]
  };

  // --- Step 1 Sub-steps (Paycheck) ---
  function startStep1B() {
    clearHighlight();
    highlightTarget('#btn-open-add-income', '👉 2. Tap \'+ Add Pay\'');

    let opened = false;
    const openIncomeModal = async () => {
      if (opened) return;
      opened = true;
      const modal = document.getElementById('modal-add-income');
      if (modal) modal.classList.add('open');
      clearHighlight();
      await wait(300);
      startStep1ModalGuidance();
    };

    renderChatBubble({
      message: "Great! You are in the <strong>Settings</strong> tab.<br><br>Now tap the <strong>'+ Add Pay'</strong> button below to open the scheduler:",
      actionText: "👉 Open '+ Add Pay'",
      actionHandler: openIncomeModal
    });

    const btn = document.getElementById('btn-open-add-income');
    if (btn) {
      btn.addEventListener('click', openIncomeModal, { once: true });
    }
  }

  function startStep1ModalGuidance() {
    // Micro-Step 1: Label
    highlightTarget('#income-label', '👉 Field 1: Income Name');
    showModalGuideBanner('#modal-add-income', {
      message: "<strong>Field 1: Income Label</strong><br>Give this paycheck a name (e.g. <em>'Maya's Paycheck'</em>):",
      actionText: "✨ Type Name (\"Maya's Paycheck\")",
      actionHandler: async () => {
        const lbl = document.getElementById('income-label');
        if (lbl) await typeIntoField(lbl, "Maya's Paycheck", 20);

        // Micro-Step 2: Amount
        clearHighlight();
        highlightTarget('#income-amount', '👉 Field 2: Take-Home ($)');
        showModalGuideBanner('#modal-add-income', {
          message: "<strong>Field 2: Net Amount Landing</strong><br>This is the actual take-home pay that hits your bank account ($2,100.00):",
          actionText: "✨ Type Amount ($2,100.00)",
          actionHandler: async () => {
            const amt = document.getElementById('income-amount');
            if (amt) await typeIntoField(amt, "2100", 25);

            // Micro-Step 3: Schedule & Next Payday
            clearHighlight();
            highlightTarget('#income-cycle', '👉 Field 3: Pay Cycle');
            showModalGuideBanner('#modal-add-income', {
              message: "<strong>Field 3 & 4: Pay Schedule</strong><br>I get paid every 2 weeks on Friday. Watch me select Bi-weekly and next payday:",
              actionText: "✨ Set Bi-Weekly & Next Friday",
              actionHandler: async () => {
                const cycle = document.getElementById('income-cycle');
                const anchor = document.getElementById('income-anchor');
                if (cycle) {
                  cycle.value = 'biweekly';
                  cycle.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (anchor) {
                  anchor.value = FocusEngine.addDays(FocusEngine.toISODate(), 7);
                  anchor.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Micro-Step 4: Save
                clearHighlight();
                const saveBtn = document.querySelector('#form-add-income button[type="submit"]');
                highlightTarget(saveBtn, '👉 Tap Save');
                const form = document.getElementById('form-add-income');

                let incomeDone = false;
                const onIncomeDone = async () => {
                  if (incomeDone) return;
                  incomeDone = true;
                  removeModalGuideBanner();
                  clearHighlight();
                  await wait(400);

                  highlightTarget('#income-list', '🎉 Runway Active');
                  renderChatBubble({
                    message: "🎉 <strong>Paycheck Runway created!</strong> Notice how ADHD Budget Planner now knows your exact pay horizon. Ready for bills?",
                    actionText: "Next: Lock Rent & Bills →",
                    isComplete: true,
                    actionHandler: () => Maya.nextStep()
                  });
                };

                // Unified listener: if user clicks native form button on desktop
                if (form) {
                  form.addEventListener('submit', () => {
                    setTimeout(onIncomeDone, 300);
                  }, { once: true });
                }

                showModalGuideBanner('#modal-add-income', {
                  message: "All fields are entered! Now tap <strong>[Save Income]</strong> below to lock it into your runway:",
                  actionText: "💾 Save Income Now",
                  actionHandler: async () => {
                    if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    onIncomeDone();
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  // --- Step 2 Sub-steps (Bills) ---
  function startStep2B() {
    clearHighlight();
    highlightTarget('#btn-open-add-bill', '👉 2. Tap \'+ Add Bill\'');

    let opened = false;
    const openBillModal = async () => {
      if (opened) return;
      opened = true;
      const modal = document.getElementById('modal-add-bill');
      if (modal) modal.classList.add('open');
      const btn = document.getElementById('btn-open-add-bill');
      if (btn && !modal?.classList.contains('open')) btn.click();
      clearHighlight();
      await wait(300);
      startStep2RentGuidance();
    };

    renderChatBubble({
      message: "Great! You are in the <strong>Bills 📅</strong> tab.<br><br>Now tap <strong>'+ Add Bill'</strong> to protect your Apartment Rent:",
      actionText: "👉 Open '+ Add Bill'",
      actionHandler: openBillModal
    });

    const btn = document.getElementById('btn-open-add-bill');
    if (btn) {
      btn.addEventListener('click', openBillModal, { once: true });
    }
  }

  function startStep2RentGuidance() {
    // Micro-Step 1: Rent Name & Amount
    highlightTarget('#bill-name', '👉 Bill Name: Rent');
    showModalGuideBanner('#modal-add-bill', {
      message: "<strong>Bill 1: Apartment Rent ($850.00)</strong><br>Due on the 3rd before payday. Tap to enter details:",
      actionText: "✨ Type Rent ($850 due on 3rd)",
      actionHandler: async () => {
        const nameEl = document.getElementById('bill-name');
        const amtEl = document.getElementById('bill-amount');
        const dayEl = document.getElementById('bill-day');
        const today = FocusEngine.toISODate();

        if (nameEl) await typeIntoField(nameEl, "Apartment Rent", 20);
        if (amtEl) await typeIntoField(amtEl, "850", 25);
        if (dayEl) {
          dayEl.value = parseInt(FocusEngine.addDays(today, 3).split('-')[2], 10);
          dayEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        clearHighlight();
        const saveBtn = document.querySelector('#form-add-bill button[type="submit"]');
        highlightTarget(saveBtn, '👉 Tap Add Bill');
        const form = document.getElementById('form-add-bill');

        let rentDone = false;
        const onRentDone = async () => {
          if (rentDone) return;
          rentDone = true;
          clearHighlight();
          await wait(400);

          // Re-open for Phone Bill directly
          const modalBill = document.getElementById('modal-add-bill');
          if (modalBill) modalBill.classList.add('open');
          await wait(300);
          startStep2PhoneGuidance();
        };

        if (form) {
          form.addEventListener('submit', () => {
            setTimeout(onRentDone, 300);
          }, { once: true });
        }

        showModalGuideBanner('#modal-add-bill', {
          message: "Rent details filled! Now tap <strong>[Add Bill]</strong> below:",
          actionText: "💾 Save Rent Bill",
          actionHandler: async () => {
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            onRentDone();
          }
        });
      }
    });
  }

  function startStep2PhoneGuidance() {
    highlightTarget('#bill-name', '👉 Bill 2: Phone Bill');
    showModalGuideBanner('#modal-add-bill', {
      message: "<strong>Bill 2: Phone Bill ($65.00)</strong><br>Due on the 4th. Let's protect this bill too:",
      actionText: "✨ Type Phone Bill ($65 due on 4th)",
      actionHandler: async () => {
        const nameEl = document.getElementById('bill-name');
        const amtEl = document.getElementById('bill-amount');
        const dayEl = document.getElementById('bill-day');
        const today = FocusEngine.toISODate();

        if (nameEl) await typeIntoField(nameEl, "Phone Bill", 20);
        if (amtEl) await typeIntoField(amtEl, "65", 25);
        if (dayEl) {
          dayEl.value = parseInt(FocusEngine.addDays(today, 4).split('-')[2], 10);
          dayEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        clearHighlight();
        const saveBtn = document.querySelector('#form-add-bill button[type="submit"]');
        highlightTarget(saveBtn, '👉 Tap Add Bill');
        const form = document.getElementById('form-add-bill');

        let phoneDone = false;
        const onPhoneDone = async () => {
          if (phoneDone) return;
          phoneDone = true;
          removeModalGuideBanner();
          clearHighlight();
          await wait(400);

          highlightTarget('#bills-list', '🔒 Protected Soonest First');
          renderChatBubble({
            message: "🔒 <strong>Both bills locked away!</strong> Notice they automatically sort 'Soonest First'. Ready to sync checking balance?",
            actionText: "Next: Checking Balance →",
            isComplete: true,
            actionHandler: () => Maya.nextStep()
          });
        };

        if (form) {
          form.addEventListener('submit', () => {
            setTimeout(onPhoneDone, 300);
          }, { once: true });
        }

        showModalGuideBanner('#modal-add-bill', {
          message: "Phone bill entered! Tap <strong>[Add Bill]</strong> to lock it in:",
          actionText: "💾 Save Phone Bill",
          actionHandler: async () => {
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            onPhoneDone();
          }
        });
      }
    });
  }

  // --- Step 3 Sub-steps (Checking Balance) ---
  function startStep3B() {
    clearHighlight();
    highlightTarget('#settings-balance-input', '👉 Balance Input');

    renderChatBubble({
      message: "You're in <strong>Settings</strong>! Check your real bank app. I currently have <strong>$1,500.00</strong> in checking today.<br><br>👉 Tap below to enter it into the balance box:",
      actionText: "✨ Type $1,500.00 Checking",
      actionHandler: async () => {
        const balInput = document.getElementById('settings-balance-input');
        if (balInput) await typeIntoField(balInput, "1500", 25);
        await wait(200);

        clearHighlight();
        const updateBtn = document.querySelector('#form-update-balance button[type="submit"]');
        highlightTarget(updateBtn, '👉 Tap Update');
        const form = document.getElementById('form-update-balance');

        let balDone = false;
        const onBalDone = async () => {
          if (balDone) return;
          balDone = true;
          clearHighlight();
          await wait(400);

          renderChatBubble({
            message: "💳 <strong>Balance synced!</strong> All numbers are in. Tap below for the big reveal!",
            actionText: "See My Daily Safe Number! ✨",
            isComplete: true,
            actionHandler: () => Maya.nextStep()
          });
        };

        if (form) {
          form.addEventListener('submit', () => {
            setTimeout(onBalDone, 300);
          }, { once: true });
        }

        renderChatBubble({
          message: "Balance entered! Now tap <strong>[Update]</strong> to sync with the math engine:",
          actionText: "💾 Update Checking Balance",
          actionHandler: async () => {
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            onBalDone();
          }
        });
      }
    });
  }

  // --- Step 4 Sub-steps (Hero Reveal) ---
  async function startStep4B() {
    clearHighlight();

    // Read live numbers dynamically from calculation engine and DOM
    const state = window._focusState;
    const safeCalc = (typeof FocusEngine !== 'undefined' && state) ? FocusEngine.calculateSafeToSpend(state) : null;
    const currency = (state && state.profile && state.profile.currency) || 'USD';

    const checkingStr = safeCalc ? FocusEngine.formatCents(safeCalc.checkingBalanceCents, currency) : '$1,500.00';
    const billsStr = safeCalc ? FocusEngine.formatCents(safeCalc.unpaidBillsCents, currency) : '$915.00';
    const bufferCents = (state && state.profile && state.profile.oopsFundCents != null) ? state.profile.oopsFundCents : 5000;
    const bufferStr = FocusEngine.formatCents(bufferCents, currency);
    const daysLeft = safeCalc ? safeCalc.daysLeft : 6;
    const dailySafeStr = safeCalc ? FocusEngine.formatCents(safeCalc.leftTodayCents, currency) : '$89.16';
    const poolStr = safeCalc ? FocusEngine.formatCents(safeCalc.spendablePoolCents, currency) : '$535.00';

    highlightTarget('#stat-checking', `${checkingStr} Checking`);
    await wait(900);
    highlightTarget('#stat-bills-due', `-${billsStr} Bills`);
    await wait(900);
    highlightTarget('#stat-days-left', `${daysLeft} Days Runway`);
    await wait(900);
    highlightTarget('#hero-safe-num', `→ ${dailySafeStr} Available Today`);

    renderChatBubble({
      message: "Here is your transparent math breakdown!<br><br>" +
               "<div style=\"background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.6;\">" +
               `• In Checking: <strong>${checkingStr}</strong><br>` +
               `• Minus Bills: <strong>-${billsStr}</strong> (Rent + Phone)<br>` +
               `• Minus Buffer: <strong>-${bufferStr}</strong> (Oops Fund Cushion)<br>` +
               `• Left: <strong>${poolStr} ÷ ${daysLeft} days</strong><br>` +
               `<strong style=\"color:#059669; font-size: 16px;\">→ ${dailySafeStr} Available Today!</strong><br>` +
               `<span style=\"color:#64748b; font-size: 12px;\">(Your daily safe-to-spend allowance)</span>` +
               "</div>",
      actionText: "Next: 2 ADHD Superpowers →",
      isComplete: true,
      actionHandler: () => Maya.nextStep()
    });
  }

  // ========================================================
  // 5. CHAT BUBBLE RENDERING
  // ========================================================
  function renderChatBubble(stepData) {
    let card = document.getElementById('tutorial-guide-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'tutorial-guide-card';
      card.className = 'tutorial-guide-card';
      document.body.appendChild(card);
    }

    card.style.display = '';

    const totalSteps = MASTER_STORY.steps.length;
    const currentStep = MASTER_STORY.steps[currentStepIndex];

    card.innerHTML = `
      <div class="maya-bubble-header">
        <div class="maya-bubble-profile">
          <div class="maya-bubble-avatar">👩‍💼</div>
          <div class="maya-bubble-name">Maya <span class="maya-online-dot"></span></div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="maya-bubble-step">Step ${currentStep.stepNum} of ${totalSteps}</span>
          <button type="button" class="btn-tut-ghost" id="btn-tut-close" title="Exit Tour">✕</button>
        </div>
      </div>

      <div class="maya-bubble-message">${stepData.message}</div>

      <div class="maya-bubble-actions">
        ${stepData.actionText ? `
          <button type="button" class="maya-bubble-prompt-btn pulse" id="btn-bubble-action">
            ${stepData.actionText}
          </button>
        ` : ''}
      </div>

      <div class="maya-bubble-nav">
        <button type="button" class="btn-bubble-nav" id="btn-bubble-prev" ${currentStepIndex === 0 ? 'disabled' : ''}>
          ← Back
        </button>
        <button type="button" class="btn-bubble-nav btn-bubble-next" id="btn-bubble-next">
          ${currentStepIndex === totalSteps - 1 ? 'Finish 🎉' : 'Next Step →'}
        </button>
      </div>
    `;

    document.getElementById('btn-tut-close').addEventListener('click', Maya.exitTour);
    document.getElementById('btn-bubble-prev').addEventListener('click', Maya.prevStep);
    document.getElementById('btn-bubble-next').addEventListener('click', () => {
      if (stepData.isComplete && currentStepIndex === totalSteps - 1) {
        Maya.exitTour();
        const setTab = getVisibleNavTab('settings');
        if (setTab) setTab.click();
      } else {
        Maya.nextStep();
      }
    });

    const actBtn = document.getElementById('btn-bubble-action');
    if (actBtn && typeof stepData.actionHandler === 'function') {
      actBtn.addEventListener('click', async () => {
        actBtn.disabled = true;
        actBtn.classList.remove('pulse');
        actBtn.style.opacity = '0.6';
        await stepData.actionHandler(renderChatBubble);
      });
    }
  }

  async function renderStep() {
    const step = MASTER_STORY.steps[currentStepIndex];
    if (!step) return;

    if (typeof step.init === 'function') {
      try {
        await step.init();
      } catch (e) {
        console.warn(e);
      }
    }
  }

  // ========================================================
  // 6. TOUR LIFECYCLE & HUD
  // ========================================================
  Maya.isActive = function () {
    return isTourActive;
  };

  Maya.startSetupTour = function () {
    if (window._focusState && !window._focusState.isTutorial) {
      userStateSnapshot = JSON.parse(JSON.stringify(window._focusState));
      try {
        sessionStorage.setItem('focus_user_snapshot', JSON.stringify(userStateSnapshot));
      } catch (e) {}
    }

    isTourActive = true;
    currentStepIndex = 0;
    document.body.classList.add('tutorial-active');

    // Enable fail-safe modal observer so Maya is never lost if a modal closes
    setupModalFailSafe();

    // Register UX Guardrail Click Listener (capture phase)
    document.addEventListener('click', handleTourClickGuard, true);

    // Load clean demo state for Maya
    const today = FocusEngine.toISODate();
    window._focusState = {
      schema: 1,
      isTutorial: true,
      profile: { preferredName: 'Maya', currency: 'USD', oopsFundCents: 5000 },
      accounts: [{ id: 'acct-main', name: 'Checking', balanceCents: 0, balanceAsOf: today }],
      income: [],
      bills: [],
      debts: [],
      savings: [],
      transactions: [],
      impulseVault: [],
      brainDump: [],
      ui: { theme: 'sage-calm', zombieMode: false, soundEnabled: true }
    };

    if (window.renderApp) window.renderApp();

    showTheaterMask();
    showTutorialHUD();
    renderStep();
  };

  Maya.exitTour = function () {
    isTourActive = false;
    document.body.classList.remove('tutorial-active');
    document.removeEventListener('click', handleTourClickGuard, true);

    clearHighlight();
    removeModalGuideBanner();
    hideTheaterMask();
    removeTutorialHUD();

    try {
      sessionStorage.removeItem('focus_user_snapshot');
    } catch (e) {}

    if (userStateSnapshot) {
      delete userStateSnapshot.isTutorial;
      window._focusState = userStateSnapshot;
      if (typeof FocusStorage !== 'undefined') {
        FocusStorage.saveState(userStateSnapshot);
      }
      userStateSnapshot = null;
    }

    currentStepIndex = 0;

    if (window.setScreen) window.setScreen('today');
    else {
      const todayTab = getVisibleNavTab('today');
      if (todayTab) todayTab.click();
    }
    if (window.renderApp) window.renderApp();

    if (window.showToast) {
      window.showToast('Returned to your personal budget! Data is 100% safe.', '🔒');
    }
  };

  Maya.nextStep = function () {
    currentStepIndex++;
    if (currentStepIndex >= MASTER_STORY.steps.length) {
      if (window.launchConfetti) window.launchConfetti();
      showCompletionCard();
    } else {
      renderStep();
    }
  };

  Maya.prevStep = function () {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      renderStep();
    }
  };

  function showTheaterMask() {
    let mask = document.getElementById('tutorial-theater-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'tutorial-theater-mask';
      mask.className = 'tutorial-mask-overlay';
      document.body.appendChild(mask);
    }
    setTimeout(() => mask.classList.add('active'), 20);
  }

  function hideTheaterMask() {
    const mask = document.getElementById('tutorial-theater-mask');
    if (mask) {
      mask.classList.remove('active');
      setTimeout(() => mask.remove(), 250);
    }
  }

  function showTutorialHUD() {
    let hud = document.getElementById('tutorial-hud-bar');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'tutorial-hud-bar';
      hud.className = 'tutorial-hud-bar';
      document.body.prepend(hud);
    }

    hud.innerHTML = `
      <div class="tutorial-hud-title">
        <span style="font-size: 18px;">👩‍💼</span>
        <span>Maya's Setup Walkthrough</span>
        <span style="color: #64748b; font-size: 11px; margin-left: 4px;">(Real budget safely paused)</span>
      </div>
      <button type="button" class="tutorial-hud-exit" id="btn-exit-tutorial">
        Exit to My Budget
      </button>
    `;

    document.getElementById('btn-exit-tutorial').addEventListener('click', Maya.exitTour);
  }

  function removeTutorialHUD() {
    const hud = document.getElementById('tutorial-hud-bar');
    if (hud) hud.remove();
    const card = document.getElementById('tutorial-guide-card');
    if (card) card.remove();
  }

  function showCompletionCard() {
    clearHighlight();
    removeModalGuideBanner();

    let card = document.getElementById('tutorial-guide-card');
    if (!card) return;

    card.innerHTML = `
      <div style="text-align: center; padding: 12px 6px;">
        <div style="font-size: 42px; margin-bottom: 10px;">🎉</div>
        <h3 class="tutorial-title" style="font-size: 19px; margin-bottom: 8px;">
          You're Ready to Begin!
        </h3>
        <p class="tutorial-body" style="margin-bottom: 18px; font-size: 13px;">
          Now you've seen how the math works from start to finish.<br>
          Ready to enter your own numbers? It takes less than 2 minutes!
        </p>

        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <button type="button" class="btn-tut-action btn-tut-secondary" id="btn-replay-tour" style="font-size: 12px;">
            🔁 Replay Tour
          </button>
          <button type="button" class="btn-tut-action btn-tut-primary" id="btn-start-my-budget" style="font-size: 13px; padding: 10px 18px;">
            Start Entering My Own Numbers →
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-replay-tour').addEventListener('click', Maya.startSetupTour);
    document.getElementById('btn-start-my-budget').addEventListener('click', () => {
      Maya.exitTour();
      if (window.setScreen) window.setScreen('settings');
      else {
        const setTab = getVisibleNavTab('settings');
        if (setTab) setTab.click();
      }
    });
  }

  // ========================================================
  // 7. MAYA'S GENTLE SIDE-POPS (ON SECONDARY TABS)
  // ========================================================
  const SIDE_POPS = {
    'braindump': {
      title: "Maya's Scratchpad Tip",
      body: "I use this scratchpad to dump random reminders before my ADHD brain forgets. Watch — I just dumped a reminder for you!",
      demoAction: () => {
        const s = window._focusState;
        if (s && !s.brainDump.some(b => b.text.includes('Cancel gym'))) {
          s.brainDump.unshift({
            id: 'bd-maya-demo',
            text: '💡 Example: Cancel gym membership before Friday',
            done: false,
            createdAt: FocusEngine.toISODate()
          });
          if (window.renderApp) window.renderApp();
        }
      },
      encouragement: "Now you try dumping a thought or reminder in the box above!"
    },
    'planner': {
      title: "Maya's Calendar Rhythm",
      body: "Time blindness makes 2 weeks feel like a blur. I use this calendar to see my bill dots ● and payday stars ★ so nothing catches me off guard.",
      encouragement: "Check the calendar above to see your spending pace!"
    },
    'savings': {
      title: "Maya's Sinking Funds",
      body: "I break big future costs into small monthly cushions so unexpected costs never shock my bank account.",
      encouragement: "Tap [+ Add Goal] above to start a small emergency cushion!"
    },
    'debt': {
      title: "Maya's Debt Snowball Tip",
      body: "If you have credit cards or loans, we use the Snowball method to crush your smallest debt first. That fast win gives your brain the dopamine to keep going!",
      encouragement: "Tap [+ Add Debt] above to see your projected debt-free finish line."
    }
  };

  Maya.checkTabSidePop = function (tabName) {
    if (isTourActive || userStateSnapshot) return;

    const oldPop = document.getElementById('maya-side-pop');
    if (oldPop) oldPop.remove();

    const info = SIDE_POPS[tabName];
    if (!info) return;

    if (visitedTabs.has(tabName)) return;
    visitedTabs.add(tabName);

    const pop = document.createElement('div');
    pop.id = 'maya-side-pop';
    pop.className = 'maya-side-pop';
    pop.innerHTML = `
      <div class="maya-side-pop-header">
        <div class="maya-side-pop-title">
          <span>👩‍💼</span>
          <span>${info.title}</span>
        </div>
        <button type="button" class="btn-tut-ghost" id="btn-dismiss-side-pop" style="font-size: 12px; padding: 2px 6px;">✕</button>
      </div>
      <div class="maya-side-pop-body">${info.body}</div>
      <div style="font-size: 12px; color: #059669; font-weight: 700;">${info.encouragement}</div>
      <div class="maya-side-pop-actions">
        <button type="button" class="btn-tut-primary" id="btn-side-pop-ok" style="padding: 4px 12px; font-size: 11px;">Got it!</button>
      </div>
    `;

    document.body.appendChild(pop);

    if (typeof info.demoAction === 'function') {
      try { info.demoAction(); } catch (e) { console.warn(e); }
    }

    const dismiss = () => pop.remove();
    document.getElementById('btn-dismiss-side-pop').addEventListener('click', dismiss);
    document.getElementById('btn-side-pop-ok').addEventListener('click', dismiss);

    setTimeout(() => { if (pop.parentNode) pop.remove(); }, 9000);
  };

  // Compatibility aliases
  Maya.start = Maya.startSetupTour;
  Maya.openHub = Maya.startSetupTour;
  Maya.renderTabCompanion = Maya.checkTabSidePop;

  global.FocusTutorials = Maya;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
