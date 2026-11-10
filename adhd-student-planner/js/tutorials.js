/**
 * ADHD Student Planner — Deep Conversational Onboarding Tour Engine
 * Persona: Maya (Sage Calm Studio) — Warm, encouraging, sensory-friendly guidance.
 * Implements Rule-01 (DOM spotlights & beacons) and Rule-02 (Dual-trigger self-healing architecture).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudentTutorial = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let currentStep = 0;
  let isActive = false;
  let activeSpotlightElement = null;

  const TOUR_STEPS = [
    {
      targetId: 'card-focus-hero',
      title: 'Hi, I’m Maya! Welcome to Your Sanctuary',
      message: 'Syllabus paralysis stops here. We never stare at 20 assignments at once. This hero card surfaces your single most urgent micro-step right now.',
      actionHint: 'Notice the single focus goal and current urgency badge.',
      beaconPosition: 'top-right'
    },
    {
      targetId: 'section-milestones-preview',
      title: 'Smart Assignment De-Chunker',
      message: '10-page papers and big exams cause executive freeze. Our de-chunker breaks any giant task into 15 to 20-minute micro-commitments with zero friction.',
      actionHint: 'Tap any milestone checkbox when complete for instant dopamine.',
      beaconPosition: 'bottom-left'
    },
    {
      targetId: 'btn-toggle-fog',
      title: 'Low-Spoons "Fog Mode"',
      message: 'Having a high-sensory or low-spoons day? Tap this button to immediately filter out all distant deadlines and show only today’s essential deliverable.',
      actionHint: 'Try toggling Fog Mode on and off to see your workspace declutter.',
      beaconPosition: 'top-left'
    },
    {
      targetId: 'screen-courses',
      title: 'Stress-Free GPA & Grade Radar',
      message: 'Track your weighted grades automatically. Midterms, quizzes, and homework calculate their exact impact with zero broken formulas.',
      actionHint: 'Switch to Courses to view your active classes and target GPAs.',
      beaconPosition: 'top-right'
    },
    {
      targetId: 'btn-hero-sprint',
      title: 'Guilt-Free Focus Sprints',
      message: 'Commit to just 20 minutes. If you lose focus, your Grace Shields protect your streak. No shame, no guilt—just steady momentum.',
      actionHint: 'Tap Done to start your semester with calm clarity!',
      beaconPosition: 'bottom-right'
    }
  ];

  function getTourElements() {
    return {
      overlay: document.getElementById('tutorial-overlay'),
      card: document.getElementById('tutorial-card'),
      title: document.getElementById('tutorial-title'),
      message: document.getElementById('tutorial-message'),
      hint: document.getElementById('tutorial-hint'),
      stepCount: document.getElementById('tutorial-step-count'),
      btnNext: document.getElementById('tutorial-btn-next'),
      btnPrev: document.getElementById('tutorial-btn-prev'),
      btnSkip: document.getElementById('tutorial-btn-skip')
    };
  }

  function clearSpotlight() {
    if (activeSpotlightElement) {
      activeSpotlightElement.classList.remove('tutorial-target-active');
      activeSpotlightElement = null;
    }
    const beacons = document.querySelectorAll('.tutorial-beacon');
    beacons.forEach(b => b.remove());
  }

  function renderStep(index) {
    const els = getTourElements();
    if (!els.overlay || !els.card) return;

    if (index < 0 || index >= TOUR_STEPS.length) {
      endTour();
      return;
    }

    currentStep = index;
    const step = TOUR_STEPS[currentStep];

    // Explicit self-healing display reset (RULE-02)
    els.overlay.style.display = 'block';
    els.card.style.display = 'flex';
    els.card.style.opacity = '1';

    clearSpotlight();

    // Find and spotlight target element
    const targetEl = document.getElementById(step.targetId);
    if (targetEl) {
      activeSpotlightElement = targetEl;
      targetEl.classList.add('tutorial-target-active');

      // Scroll into view smoothly
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add pulsing beacon
      const beacon = document.createElement('div');
      beacon.className = `tutorial-beacon beacon-${step.beaconPosition || 'top-right'}`;
      beacon.innerHTML = '<span class="beacon-ring"></span><span class="beacon-dot"></span>';
      targetEl.style.position = targetEl.style.position || 'relative';
      targetEl.appendChild(beacon);
    }

    // Populate dialogue
    els.title.textContent = step.title;
    els.message.textContent = step.message;
    els.hint.textContent = step.actionHint;
    els.stepCount.textContent = `Step ${currentStep + 1} of ${TOUR_STEPS.length}`;

    // Update buttons
    els.btnPrev.style.display = currentStep === 0 ? 'none' : 'inline-block';
    els.btnNext.textContent = currentStep === TOUR_STEPS.length - 1 ? 'Finish Tour ✨' : 'Next Step →';

    // Position guide card appropriately
    positionGuideCard(targetEl, els.card);
  }

  function positionGuideCard(targetEl, card) {
    if (!card) return;
    if (!targetEl) {
      card.style.top = '50%';
      card.style.left = '50%';
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;

    if (isMobile) {
      card.style.top = 'auto';
      card.style.bottom = '20px';
      card.style.left = '50%';
      card.style.transform = 'translateX(-50%)';
      card.style.width = 'calc(100% - 32px)';
    } else {
      // Desktop positioning
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow > 260) {
        card.style.top = `${rect.bottom + 16}px`;
        card.style.bottom = 'auto';
        card.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 420))}px`;
        card.style.transform = 'none';
      } else {
        card.style.bottom = `${window.innerHeight - rect.top + 16}px`;
        card.style.top = 'auto';
        card.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 420))}px`;
        card.style.transform = 'none';
      }
      card.style.width = '380px';
    }
  }

  function startTour(force) {
    const hasSeen = localStorage.getItem('adhd_student_tour_seen');
    if (hasSeen && !force) return;

    isActive = true;
    currentStep = 0;
    renderStep(0);
  }

  function nextStep() {
    if (!isActive) return;
    if (currentStep < TOUR_STEPS.length - 1) {
      renderStep(currentStep + 1);
    } else {
      endTour();
    }
  }

  function prevStep() {
    if (!isActive) return;
    if (currentStep > 0) {
      renderStep(currentStep - 1);
    }
  }

  function endTour() {
    isActive = false;
    clearSpotlight();
    const els = getTourElements();
    if (els.overlay) els.overlay.style.display = 'none';
    if (els.card) els.card.style.display = 'none';
    localStorage.setItem('adhd_student_tour_seen', 'true');
  }

  function initTourHandlers() {
    const els = getTourElements();
    if (!els.card) return;

    if (els.btnNext) {
      els.btnNext.addEventListener('click', function (e) {
        e.stopPropagation();
        nextStep();
      });
    }

    if (els.btnPrev) {
      els.btnPrev.addEventListener('click', function (e) {
        e.stopPropagation();
        prevStep();
      });
    }

    if (els.btnSkip) {
      els.btnSkip.addEventListener('click', function (e) {
        e.stopPropagation();
        endTour();
      });
    }

    // Dual-trigger event bindings (RULE-02)
    // Interaction on active targets automatically advances or recovers the tour
    window.addEventListener('resize', function () {
      if (isActive && activeSpotlightElement && els.card) {
        positionGuideCard(activeSpotlightElement, els.card);
      }
    });

    // Close on overlay backdrop click outside card
    if (els.overlay) {
      els.overlay.addEventListener('click', function (e) {
        if (e.target === els.overlay) {
          nextStep();
        }
      });
    }
  }

  return {
    startTour: startTour,
    nextStep: nextStep,
    prevStep: prevStep,
    endTour: endTour,
    initTourHandlers: initTourHandlers,
    isActive: function () { return isActive; },
    getCurrentStep: function () { return currentStep; }
  };
});
