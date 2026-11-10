/**
 * ADHD Student Planner — Deep Conversational Onboarding Tour Engine
 * Persona: Maya (Sage Calm Studio) — Warm, encouraging, sensory-friendly guidance.
 * Implements Rule-01 (DOM spotlights), Rule-02 (Crash-proof architecture),
 * and Rule-11 (Screen-Synchronized Guided Navigation & Viewport Adaptive Positioning).
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
      tabId: 'dashboard',
      sectionName: 'Dashboard • Single Focus Hero',
      targetId: 'card-focus-hero',
      title: 'Hi, I’m Maya! Welcome to Your Sanctuary',
      message: 'Syllabus paralysis stops here. We never stare at 20 assignments at once. This hero card surfaces your single most urgent micro-step right now.',
      actionHint: 'Notice the single focus goal and current urgency badge.',
      beaconPosition: 'top-right'
    },
    {
      tabId: 'dashboard',
      sectionName: 'Dashboard • Smart De-Chunker',
      targetId: 'card-focus-hero',
      subTargetSelector: '.hero-step-box',
      title: 'Smart Assignment De-Chunker',
      message: '10-page papers and big exams cause executive freeze. Our de-chunker decomposes giant intimidating tasks into 15 to 20-minute micro-milestones with instant dopamine check-offs.',
      actionHint: 'Check off micro-milestones one by one with zero pressure.',
      beaconPosition: 'bottom-left'
    },
    {
      tabId: 'dashboard',
      sectionName: 'Header • Low-Spoons Fog Mode',
      targetId: 'btn-toggle-fog',
      title: 'Low-Spoons "Fog Mode"',
      message: 'Having a high-sensory or low-spoons day? Tap this button to immediately filter out all distant deadlines and show only today’s essential deliverable.',
      actionHint: 'Try toggling Fog Mode on and off to see your workspace declutter.',
      beaconPosition: 'top-left'
    },
    {
      tabId: 'courses',
      sectionName: 'Curriculum • Automated Weighted Grades',
      targetId: 'grid-courses',
      title: 'Stress-Free GPA & Grade Radar',
      message: 'We are now in your Courses tab! Track weighted percentages (Midterm 20%, Quizzes 20%, Assignments 40%) automatically as you log grades—with zero broken spreadsheet formulas.',
      actionHint: 'View your active enrolled courses and live projected GPAs.',
      beaconPosition: 'top-right'
    },
    {
      tabId: 'dashboard',
      sectionName: 'Dashboard • 20-Min Focus Sprint',
      targetId: 'card-focus-hero',
      subTargetSelector: '#btn-hero-sprint',
      title: 'Guilt-Free Focus Sprints',
      message: 'Back on Dashboard: commit to just 20 minutes. If you lose focus, your Grace Shields protect your streak. No shame, no guilt—just steady momentum.',
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
      sectionTag: document.getElementById('tutorial-section-tag'),
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

    // RULE-11: Programmatically switch active tab before rendering step!
    if (step.tabId && typeof window.switchStudentTab === 'function') {
      window.switchStudentTab(step.tabId);
    }

    // Allow browser 60ms to complete layout transition before measuring target
    setTimeout(() => {
      // Explicit self-healing display reset (RULE-02)
      els.overlay.style.display = 'block';
      els.card.style.display = 'flex';
      els.card.style.opacity = '1';

      clearSpotlight();

      // Find target element with fallback
      let targetEl = null;
      if (step.subTargetSelector) {
        targetEl = document.querySelector(step.subTargetSelector);
      }
      if (!targetEl && step.targetId) {
        targetEl = document.getElementById(step.targetId);
      }
      if (!targetEl) {
        targetEl = document.getElementById(`screen-${step.tabId}`) || document.body;
      }

      activeSpotlightElement = targetEl;
      targetEl.classList.add('tutorial-target-active');

      // Smooth scroll target into view
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Add pulsing beacon
      const beacon = document.createElement('div');
      beacon.className = `tutorial-beacon beacon-${step.beaconPosition || 'top-right'}`;
      beacon.innerHTML = '<span class="beacon-ring"></span><span class="beacon-dot"></span>';
      targetEl.style.position = targetEl.style.position || 'relative';
      targetEl.appendChild(beacon);

      // Populate dialogue & section breadcrumb
      if (els.sectionTag) {
        els.sectionTag.textContent = `📍 ${step.sectionName}`;
      }
      els.title.textContent = step.title;
      els.message.textContent = step.message;
      els.hint.textContent = step.actionHint;
      els.stepCount.textContent = `Step ${currentStep + 1} of ${TOUR_STEPS.length}`;

      // Update buttons
      els.btnPrev.style.display = currentStep === 0 ? 'none' : 'inline-block';
      els.btnNext.textContent = currentStep === TOUR_STEPS.length - 1 ? 'Finish Tour ✨' : 'Next Step →';

      // Adaptive positioning that prevents overlapping bottom navigation or spotlight target
      positionGuideCard(targetEl, els.card);
    }, 60);
  }

  function positionGuideCard(targetEl, card) {
    if (!card) return;
    if (!targetEl) {
      card.style.top = '50%';
      card.style.bottom = 'auto';
      card.style.left = '50%';
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;

    if (isMobile) {
      // RULE-11 Mobile Resilience: Never overlap fixed bottom navigation bar (height ~65px)
      // Check if target is in the top or bottom half of the viewport
      const targetMidY = rect.top + (rect.height / 2);
      const screenMidY = window.innerHeight / 2;

      if (targetMidY > screenMidY) {
        // Target is in the lower half -> Place guide card at top
        card.style.top = '16px';
        card.style.bottom = 'auto';
      } else {
        // Target is in the upper half -> Place guide card above bottom nav
        card.style.top = 'auto';
        card.style.bottom = '85px';
      }

      card.style.left = '12px';
      card.style.right = '12px';
      card.style.width = 'calc(100% - 24px)';
      card.style.transform = 'none';
    } else {
      // Desktop positioning
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const cardWidth = 400;

      if (spaceBelow >= 240) {
        card.style.top = `${rect.bottom + 14}px`;
        card.style.bottom = 'auto';
      } else if (spaceAbove >= 240) {
        card.style.bottom = `${window.innerHeight - rect.top + 14}px`;
        card.style.top = 'auto';
      } else {
        card.style.top = '50%';
        card.style.bottom = 'auto';
        card.style.transform = 'translateY(-50%)';
      }

      const leftPos = Math.max(16, Math.min(rect.left, window.innerWidth - cardWidth - 20));
      card.style.left = `${leftPos}px`;
      card.style.right = 'auto';
      card.style.width = `${cardWidth}px`;
      if (!card.style.transform.includes('translateY')) {
        card.style.transform = 'none';
      }
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
    // Ensure back to dashboard on end
    if (typeof window.switchStudentTab === 'function') {
      window.switchStudentTab('dashboard');
    }
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

    window.addEventListener('resize', function () {
      if (isActive && activeSpotlightElement && els.card) {
        positionGuideCard(activeSpotlightElement, els.card);
      }
    });

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
