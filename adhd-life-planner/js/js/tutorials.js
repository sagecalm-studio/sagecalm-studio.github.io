/**
 * ADHD Life Planner — Maya's Conversational Guided Tour System
 * Complete hand-holding: DOM-anchored target beacons, zero modal collision,
 * realistic typing animations, and gentle ADHD guardrails.
 */

(function (global) {
  'use strict';

  const Maya = {};
  let currentStepIndex = 0;
  let isTourActive = false;
  let currentTargetEl = null;

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  function getVisibleNavTab(tabName) {
    return document.querySelector(`[data-tab="${tabName}"]`);
  }

  // ========================================================
  // 1. DOM-ANCHORED TARGET HIGHLIGHT & BEACON
  // Physically attached to the element so it never shifts on resize/scroll!
  // ========================================================
  function highlightTarget(target, badgeText = '🌿 Tap here') {
    clearHighlight();
    if (!target) return null;

    const el = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!el) return null;

    currentTargetEl = el;

    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    el.classList.add('tutorial-target-active');

    // Create DOM-anchored badge
    const badge = document.createElement('span');
    badge.className = 'maya-target-badge';
    badge.id = 'maya-target-badge';
    badge.innerHTML = `<span>${badgeText}</span>`;

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

  // Realistic Human Typing Animation
  async function typeIntoField(element, text, speed = 25) {
    if (!element) return;
    element.focus();
    element.value = '';
    element.classList.add('typing-active');

    return new Promise((resolve) => {
      let currentVal = '';
      let idx = 0;
      const interval = setInterval(() => {
        currentVal += text[idx];
        idx++;
        element.value = currentVal;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        if (idx >= text.length) {
          clearInterval(interval);
          element.value = text;
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
  // Injected directly into the modal dialog above forms
  // ========================================================
  function showModalGuideBanner(modalSelector, { message, actionText, actionHandler }) {
    hideGuideCard();

    const modal = document.querySelector(modalSelector);
    if (!modal) return;

    const dialog = modal.querySelector('.modal-dialog');
    if (!dialog) return;

    const existing = dialog.querySelector('.maya-modal-guide-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'maya-modal-guide-banner';
    banner.id = 'maya-modal-banner';
    banner.innerHTML = `
      <div class="maya-modal-guide-top">
        <div class="maya-modal-guide-profile">
          <span>🌿</span>
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

  let modalObserver = null;
  function setupModalFailSafe() {
    if (modalObserver) return;
    if (typeof MutationObserver !== 'undefined') {
      modalObserver = new MutationObserver((mutations) => {
        if (!isTourActive) return;
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            const el = m.target;
            if (el.classList.contains('app-modal') && !el.classList.contains('active')) {
              setTimeout(() => {
                if (isTourActive) showGuideCard();
              }, 120);
            }
          }
        }
      });
      document.querySelectorAll('.app-modal').forEach(m => {
        modalObserver.observe(m, { attributes: true });
      });
    }
  }

  // ========================================================
  // 3. UX GUARDRAILS (GENTLE ADHD ENCOURAGEMENT)
  // ========================================================
  function handleTourClickGuard(e) {
    if (!isTourActive) return;
    if (!e.isTrusted) return;

    const isGuide = e.target.closest('#tutorial-guide-card');
    const isHUD = e.target.closest('#tutorial-hud-bar');
    const isModal = e.target.closest('.app-modal.active .modal-dialog');
    const isTarget = currentTargetEl && (currentTargetEl === e.target || currentTargetEl.contains(e.target));

    if (isGuide || isHUD || isModal || isTarget) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    triggerEncouragementNudge();
  }

  function triggerEncouragementNudge() {
    const card = document.getElementById('tutorial-guide-card');
    if (card && card.style.display !== 'none') {
      card.classList.remove('nudge');
      void card.offsetWidth;
      card.classList.add('nudge');

      let toast = card.querySelector('.maya-nudge-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'maya-nudge-toast';
        toast.textContent = "✨ Follow Maya's highlighted step to move forward!";
        const msg = card.querySelector('.maya-bubble-message');
        if (msg) msg.parentNode.insertBefore(toast, msg.nextSibling);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2800);
      }
    }
  }

  // ========================================================
  // 4. FLOATING CHAT BUBBLE RENDERER
  // ========================================================
  function renderChatBubble({ message, actionText, actionHandler, isComplete, canSkip = true }) {
    let card = document.getElementById('tutorial-guide-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'tutorial-guide-card';
      card.className = 'tutorial-guide-card';
      document.body.appendChild(card);
    }

    card.innerHTML = `
      <div class="maya-bubble-top">
        <div class="maya-bubble-profile">
          <span class="maya-bubble-avatar">🌿</span>
          <div>
            <div class="maya-bubble-name">Maya • Your Calm Companion</div>
            <span style="font-size: 10.5px; color: var(--accent-primary); font-weight: 700;">Step ${currentStepIndex + 1} of ${MASTER_STORY.steps.length}</span>
          </div>
        </div>
        <span class="maya-online-dot"></span>
      </div>
      <div class="maya-bubble-message">${message}</div>
      <div class="maya-bubble-actions">
        ${canSkip && !isComplete ? `<button class="btn btn-link btn-sm" id="btn-tour-skip">Skip Tour</button>` : `<div></div>`}
        ${actionText ? `
          <button class="maya-bubble-prompt-btn pulse" id="btn-bubble-act">
            ${actionText}
          </button>
        ` : ''}
      </div>
    `;

    const actBtn = card.querySelector('#btn-bubble-act');
    if (actBtn && typeof actionHandler === 'function') {
      actBtn.addEventListener('click', async () => {
        actBtn.disabled = true;
        actBtn.classList.remove('pulse');
        await actionHandler();
      });
    }

    const skipBtn = card.querySelector('#btn-tour-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        Maya.exitTour();
      });
    }

    updateHUD();
  }

  function renderHUD() {
    let hud = document.getElementById('tutorial-hud-bar');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'tutorial-hud-bar';
      hud.className = 'tutorial-hud-bar';
      document.body.appendChild(hud);
    }
    updateHUD();
  }

  function updateHUD() {
    const hud = document.getElementById('tutorial-hud-bar');
    if (!hud) return;
    const currentStep = MASTER_STORY.steps[currentStepIndex];
    hud.innerHTML = `
      <div class="tutorial-hud-left">
        <span class="tutorial-hud-step-pill">Step ${currentStepIndex + 1}/${MASTER_STORY.steps.length}</span>
        <span class="tutorial-hud-title">${currentStep.title}</span>
      </div>
      <div class="tutorial-hud-right">
        <button class="btn-hud-exit" id="btn-hud-exit-tour">✕ Exit Guide</button>
      </div>
    `;

    const exitBtn = hud.querySelector('#btn-hud-exit-tour');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => Maya.exitTour());
    }
  }

  // ========================================================
  // 5. MASTER 5-STEP HAND-HOLDING STORY
  // ========================================================
  const MASTER_STORY = {
    steps: [
      // STEP 1: The Daily Anchor (Single Win Rule)
      {
        stepNum: 1,
        title: "The Daily Focus Anchor",
        init: async () => {
          clearHighlight();
          if (window.LifeApp) window.LifeApp.switchTab('today');
          await wait(200);

          highlightTarget('#daily-anchor-card', '👉 1. Daily Anchor Card');

          renderChatBubble({
            message: "Welcome! I am <strong>Maya</strong> 🌿. Traditional to-do lists overwhelm ADHD brains with 30 items. Here, we follow the <strong>Single Win Rule</strong>: choose just 1 focus anchor.",
            actionText: "✨ Type Example Focus Anchor",
            actionHandler: async () => {
              const input = document.getElementById('anchor-input');
              if (input) {
                await typeIntoField(input, "Drink tall glass of water & stretch for 2 minutes", 20);
              }

              clearHighlight();
              highlightTarget('#anchor-checkbox', '👉 Check Anchor');

              renderChatBubble({
                message: "Now tap the checkmark to mark it done. Listen for the celebratory sound chord!",
                actionText: "🎉 Complete Anchor Win",
                actionHandler: async () => {
                  const chk = document.getElementById('anchor-checkbox');
                  if (chk) {
                    chk.checked = true;
                    chk.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                  clearHighlight();
                  await wait(400);

                  highlightTarget('#daily-progress-bar-fill', '🌿 Momentum 100%');
                  renderChatBubble({
                    message: "🎉 Notice how your day's momentum bar instantly fills up! You've already won today. Ready to see the Energy Dial?",
                    actionText: "Next: Energy Dial & Fog Mode →",
                    actionHandler: () => Maya.nextStep()
                  });
                }
              });
            }
          });
        }
      },

      // STEP 2: The Energy Dial & Low-Spoons Fog Mode
      {
        stepNum: 2,
        title: "Energy Dial & Fog Mode",
        init: async () => {
          clearHighlight();
          highlightTarget('#energy-dial-bar', '👉 2. Energy Dial');

          renderChatBubble({
            message: "Your executive function changes daily. Some days you have 100% battery, other days 15%. Watch what happens when we switch to <strong>Low Spoons</strong> mode:",
            actionText: "🌧️ Try 'Low Spoons' Energy",
            actionHandler: async () => {
              const lowPill = document.querySelector('.energy-pill[data-energy="low"]');
              if (lowPill) lowPill.click();
              await wait(300);

              clearHighlight();
              highlightTarget('#btn-toggle-fog', '👉 Fog Mode Toggle');

              renderChatBubble({
                message: "When in burnout, tap the <strong>Fog Mode 🌫️</strong> icon in the header. It dims non-essential chores and displays ONLY survival essentials:",
                actionText: "🌫️ Turn Fog Mode ON",
                actionHandler: async () => {
                  const fogBtn = document.getElementById('btn-toggle-fog');
                  if (fogBtn) fogBtn.click();
                  await wait(300);

                  renderChatBubble({
                    message: "Notice the calm blue banner and reduced visual noise. No guilt, no shame. Tap below to turn Fog Mode off and continue:",
                    actionText: "☀️ Turn Fog Mode OFF",
                    actionHandler: async () => {
                      if (fogBtn) fogBtn.click();
                      const normalPill = document.querySelector('.energy-pill[data-energy="normal"]');
                      if (normalPill) normalPill.click();
                      clearHighlight();
                      await wait(200);

                      renderChatBubble({
                        message: "Beautiful! Now let me show you the secret weapon against ADHD task paralysis: the <strong>Task De-chunker</strong>.",
                        actionText: "Next: Task De-chunker →",
                        actionHandler: () => Maya.nextStep()
                      });
                    }
                  });
                }
              });
            }
          });
        }
      },

      // STEP 3: Breaking Task Paralysis with the De-chunker
      {
        stepNum: 3,
        title: "Task De-chunker (Paralysis Breaker)",
        init: async () => {
          clearHighlight();
          highlightTarget('#btn-open-add-task', '👉 3. Tap \'+ Add Task\'');

          let taskOpened = false;
          const openTaskModal = async () => {
            if (taskOpened) return;
            taskOpened = true;
            if (window.LifeApp) window.LifeApp.openModal('modal-add-task');
            clearHighlight();
            await wait(250);

            highlightTarget('#input-task-title', '👉 Task Name');
            showModalGuideBanner('#modal-add-task', {
              message: "Let's add a scary, overwhelming task like <em>'Clean the messy bedroom'</em>:",
              actionText: "✨ Type \"Clean the messy bedroom\"",
              actionHandler: async () => {
                const titleInput = document.getElementById('input-task-title');
                if (titleInput) await typeIntoField(titleInput, "Clean the messy bedroom", 20);

                clearHighlight();
                const saveBtn = document.querySelector('#form-add-task button[type="submit"]');
                highlightTarget(saveBtn, '👉 Save Task');

                showModalGuideBanner('#modal-add-task', {
                  message: "Now tap <strong>Add Task</strong> below:",
                  actionText: "💾 Save Task Now",
                  actionHandler: async () => {
                    const form = document.getElementById('form-add-task');
                    if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    removeModalGuideBanner();
                    clearHighlight();
                    await wait(300);

                    // Find the newly added task and highlight its scissors icon!
                    const dechunkBtn = document.querySelector('.btn-dechunk');
                    highlightTarget(dechunkBtn, '👉 4. Tap ✂️ to De-chunk!');

                    renderChatBubble({
                      message: "Here is the superpower! A 2-hour cleaning task feels impossible. Tap the <strong>✂️ De-chunk icon</strong> to split it into 3-minute steps:",
                      actionText: "✂️ De-chunk This Task Now",
                      actionHandler: async () => {
                        if (dechunkBtn) dechunkBtn.click();
                        clearHighlight();
                        await wait(300);

                        highlightTarget('.subtasks-container', '🎉 Micro-Steps Ready');
                        renderChatBubble({
                          message: "🎉 Look! It chopped the overwhelming project into 4 tiny 3-minute micro-steps. Starting takes almost zero executive effort now!",
                          actionText: "Next: The Dopamine Menu →",
                          actionHandler: () => Maya.nextStep()
                        });
                      }
                    });
                  }
                });
              }
            });
          };

          renderChatBubble({
            message: "When an ADHD brain sees a big task, working memory freezes. Tap <strong>'+ Add Task'</strong> to see how we bypass this:",
            actionText: "👉 Open '+ Add Task'",
            actionHandler: openTaskModal
          });

          const btn = document.getElementById('btn-open-add-task');
          if (btn) btn.addEventListener('click', openTaskModal, { once: true });
        }
      },

      // STEP 4: The Dopamine Menu & Surprise Me Button
      {
        stepNum: 4,
        title: "The Dopamine Menu",
        init: async () => {
          clearHighlight();
          const dopTab = getVisibleNavTab('dopamine');
          highlightTarget(dopTab, '👉 5. Tap Dopamine Tab');

          let tabOpened = false;
          const openDopamineTab = async () => {
            if (tabOpened) return;
            tabOpened = true;
            if (window.LifeApp) window.LifeApp.switchTab('dopamine');
            clearHighlight();
            await wait(250);

            highlightTarget('#btn-dopamine-surprise', '👉 Surprise Me Button');

            renderChatBubble({
              message: "When you are stuck in freeze mode, looking for stimulation can lead to doom-scrolling. Tap <strong>'Surprise Me'</strong> for an instant healthy dopamine reset:",
              actionText: "✨ Tap 'Surprise Me'",
              actionHandler: async () => {
                const sBtn = document.getElementById('btn-dopamine-surprise');
                if (sBtn) sBtn.click();
                clearHighlight();
                await wait(400);

                renderChatBubble({
                  message: "The menu is structured like a restaurant: <strong>Appetizers</strong> (2-min quick hits), <strong>Sides</strong> (brown noise / candles), and <strong>Desserts</strong> (guilt-free gaming/nap rewards)!",
                  actionText: "Next: Grace Streaks (No Guilt) →",
                  actionHandler: () => Maya.nextStep()
                });
              }
            });
          };

          renderChatBubble({
            message: "Now let's explore your motivation engine. Tap the <strong>Dopamine 🍽️</strong> tab in the navigation bar:",
            actionText: "👉 Open Dopamine Menu 🍽️",
            actionHandler: openDopamineTab
          });

          if (dopTab) dopTab.addEventListener('click', openDopamineTab, { once: true });
        }
      },

      // STEP 5: Grace Streaks & Routines (Zero Shame)
      {
        stepNum: 5,
        title: "Grace Streaks (Zero Shame)",
        init: async () => {
          clearHighlight();
          const rTab = getVisibleNavTab('routines');
          highlightTarget(rTab, '👉 6. Tap Routines Tab');

          let routinesOpened = false;
          const openRoutinesTab = async () => {
            if (routinesOpened) return;
            routinesOpened = true;
            if (window.LifeApp) window.LifeApp.switchTab('routines');
            clearHighlight();
            await wait(250);

            highlightTarget('.streak-banner-card', '🌿 Grace Streaks');

            renderChatBubble({
              message: "Most apps reset your streak to 0 if you miss a day, creating shame spirals. In this planner, you get built-in <strong>Grace Days</strong>. If you miss a day, your momentum is preserved without guilt!",
              actionText: "🎉 Complete Maya's Tour!",
              isComplete: true,
              actionHandler: () => {
                clearHighlight();
                renderChatBubble({
                  message: "🎉 <strong>You're fully ready!</strong> You now know how ADHD Life Planner works with your brain. Tap below to start your calm journey:",
                  actionText: "🌿 Start Using My Planner",
                  isComplete: true,
                  actionHandler: () => {
                    Maya.exitTour();
                    if (window.LifeApp) window.LifeApp.switchTab('today');
                  }
                });
              }
            });
          };

          renderChatBubble({
            message: "Finally, let's look at habits. Tap the <strong>Routines 🌿</strong> tab in the navigation bar:",
            actionText: "👉 Open Routines Tab 🌿",
            actionHandler: openRoutinesTab
          });

          if (rTab) rTab.addEventListener('click', openRoutinesTab, { once: true });
        }
      }
    ]
  };

  // ========================================================
  // 6. PUBLIC TOUR CONTROLLER API
  // ========================================================
  Maya.startTour = function (fromBeginning = true) {
    if (fromBeginning) currentStepIndex = 0;
    isTourActive = true;
    document.body.classList.add('tutorial-active');

    setupModalFailSafe();
    document.addEventListener('click', handleTourClickGuard, true);

    renderHUD();
    MASTER_STORY.steps[currentStepIndex].init();
  };

  Maya.nextStep = function () {
    if (currentStepIndex < MASTER_STORY.steps.length - 1) {
      currentStepIndex++;
      MASTER_STORY.steps[currentStepIndex].init();
    } else {
      Maya.exitTour();
    }
  };

  Maya.prevStep = function () {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      MASTER_STORY.steps[currentStepIndex].init();
    }
  };

  Maya.exitTour = function () {
    isTourActive = false;
    clearHighlight();
    document.body.classList.remove('tutorial-active');
    document.removeEventListener('click', handleTourClickGuard, true);

    const card = document.getElementById('tutorial-guide-card');
    if (card) card.remove();

    const hud = document.getElementById('tutorial-hud-bar');
    if (hud) hud.remove();

    const banner = document.getElementById('maya-modal-banner');
    if (banner) banner.remove();

    localStorage.setItem('adhd_life_tour_completed', 'true');
  };

  global.LifeTutorials = Maya;
})(typeof window !== 'undefined' ? window : this);