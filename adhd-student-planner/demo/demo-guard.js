/**
 * ADHD Student Planner (Base Edition) — Demo Sandbox Guard
 * Isolates demo state into sessionStorage, seeds realistic academic demo data,
 * disables service workers, and injects Etsy conversion prompts.
 */
(function () {
  'use strict';

  // 1. Disable ServiceWorker in demo mode
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve();
    };
  }

  // 2. Redirect localStorage to sessionStorage
  const DEMO_STORE_KEY = 'adhd_student_planner_data_v1';

  const origGetItem = localStorage.getItem.bind(localStorage);
  const origSetItem = localStorage.setItem.bind(localStorage);
  const origRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.getItem = function (k) {
    if (k === DEMO_STORE_KEY || k === 'adhd_student_tour_seen') {
      return sessionStorage.getItem(k);
    }
    return origGetItem(k);
  };

  localStorage.setItem = function (k, v) {
    if (k === DEMO_STORE_KEY || k === 'adhd_student_tour_seen') {
      return sessionStorage.setItem(k, v);
    }
    return origSetItem(k, v);
  };

  localStorage.removeItem = function (k) {
    if (k === DEMO_STORE_KEY || k === 'adhd_student_tour_seen') {
      return sessionStorage.removeItem(k);
    }
    return origRemoveItem(k);
  };

  // 3. Inject Demo Top Banner
  document.addEventListener('DOMContentLoaded', function () {
    const banner = document.createElement('div');
    banner.className = 'etsy-demo-banner';
    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>🎓 <strong>Live Interactive Demo:</strong> ADHD Student Planner (Sage Calm Edition)</span>
      </div>
      <div>
        <a href="https://sagecalm-studio.github.io/adhd-student-planner/" target="_blank" class="etsy-demo-cta">
          ⚡ Unlock Full Lifetime App ($9.00)
        </a>
      </div>
    `;
    document.body.prepend(banner);

    // 4. Inject Etsy Gate Modal
    const modal = document.createElement('div');
    modal.className = 'etsy-demo-modal-overlay';
    modal.id = 'etsy-demo-modal';
    modal.innerHTML = `
      <div class="etsy-demo-modal-card">
        <h3>✨ Take Your Academic Sanctuary With You</h3>
        <p>
          You are currently test-driving the demo sandbox. Get the complete lifetime edition on Etsy for instant offline access on your phone, tablet, and laptop.
        </p>
        <a href="https://sagecalm-studio.github.io/adhd-student-planner/" target="_blank" class="etsy-gate-btn-buy">
          Get Instant Access on Etsy — $9.00
        </a>
        <br>
        <button type="button" class="etsy-gate-btn-close" id="btn-close-demo-modal">
          Continue Test Drive
        </button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-close-demo-modal').addEventListener('click', function () {
      modal.classList.remove('active');
    });

    // Intercept export buttons to trigger modal
    setTimeout(function () {
      const btnExport = document.getElementById('btn-export-json');
      if (btnExport) {
        btnExport.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          modal.classList.add('active');
        }, true);
      }
    }, 500);
  });
})();
