/**
 * Assignment Tracker (Base Edition) — Demo Sandbox Guard
 * Isolates demo state into sessionStorage, seeds realistic academic demo data,
 * disables service workers, and injects Etsy conversion prompts.
 */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve();
    };
  }

  const DEMO_STORE_KEY = 'assignment_tracker_data_v1';

  const origGetItem = localStorage.getItem.bind(localStorage);
  const origSetItem = localStorage.setItem.bind(localStorage);
  const origRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.getItem = function (k) {
    if (k === DEMO_STORE_KEY) return sessionStorage.getItem(k);
    return origGetItem(k);
  };
  localStorage.setItem = function (k, v) {
    if (k === DEMO_STORE_KEY) return sessionStorage.setItem(k, v);
    return origSetItem(k, v);
  };
  localStorage.removeItem = function (k) {
    if (k === DEMO_STORE_KEY) return sessionStorage.removeItem(k);
    return origRemoveItem(k);
  };

  // Seed realistic demo data if fresh session
  if (!sessionStorage.getItem(DEMO_STORE_KEY)) {
    const demoData = {
      version: 1,
      settings: { theme: 'sage-calm', dailyCapacityMin: 120, skipWeekends: true, sound: true, onboarded: true, fog: false },
      courses: [
        { id: 'c1', name: 'Cognitive Neuroscience', color: '#5b8f77' },
        { id: 'c2', name: 'World History', color: '#6b8fb5' },
        { id: 'c3', name: 'Calculus II', color: '#c08a5a' }
      ],
      assignments: [
        {
          id: 'a1', courseId: 'c1', title: 'Neuroscience Research Review', due: '2026-11-17', weight: 30, estMin: 180, manualMin: 0,
          steps: [
            { id: 's1', text: 'Gather 3 research papers on executive dysfunction', done: true },
            { id: 's2', text: 'Outline methodology analysis section', done: false },
            { id: 's3', text: 'Draft literature synthesis', done: false }
          ],
          status: 'doing', rescue: '', createdAt: '2026-11-13T10:00', completedAt: ''
        },
        {
          id: 'a2', courseId: 'c2', title: 'History Primary Source Essay', due: '2026-11-19', weight: 20, estMin: 90, manualMin: 0,
          steps: [
            { id: 's4', text: 'Select 2 primary documents', done: true },
            { id: 's5', text: 'Write 3 comparative bullet points', done: false }
          ],
          status: 'todo', rescue: '', createdAt: '2026-11-14T14:00', completedAt: ''
        },
        {
          id: 'a3', courseId: 'c3', title: 'Calculus Problem Set 6', due: '2026-11-16', weight: 15, estMin: 60, manualMin: 0,
          steps: [{ id: 's6', text: 'Work problems 1 through 10', done: false }],
          status: 'todo', rescue: '', createdAt: '2026-11-14T09:00', completedAt: ''
        },
        {
          id: 'a4', courseId: 'c1', title: 'Lab 1 Neuro-imaging Quiz', due: '2026-11-14', weight: 10, estMin: 45, manualMin: 45,
          steps: [], status: 'done', rescue: '', createdAt: '2026-11-11T11:00', completedAt: '2026-11-14T16:00'
        }
      ],
      sprints: [
        { id: 'sp1', assignmentId: 'a1', date: '2026-11-14', minutes: 25 }
      ]
    };
    sessionStorage.setItem(DEMO_STORE_KEY, JSON.stringify(demoData));
  }

  // Inject Demo Banner & Conversion Modal
  document.addEventListener('DOMContentLoaded', function () {
    const banner = document.createElement('div');
    banner.className = 'etsy-demo-banner';
    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>🌿 <strong>Live Interactive Demo:</strong> Assignment Tracker (Sage Calm Edition)</span>
      </div>
      <div>
        <a href="https://sagecalm-studio.github.io/assignment-tracker/" target="_blank" class="etsy-demo-cta">
          ⚡ Unlock Full Lifetime App ($9.00)
        </a>
      </div>
    `;
    document.body.prepend(banner);

    const modal = document.createElement('div');
    modal.className = 'etsy-demo-modal-overlay';
    modal.id = 'etsy-demo-modal';
    modal.innerHTML = `
      <div class="etsy-demo-modal-card">
        <h3>✨ Take Your Academic Sanctuary With You</h3>
        <p>
          You are currently test-driving the demo sandbox. Get the complete lifetime edition on Etsy for instant offline access on your phone, tablet, and laptop.
        </p>
        <a href="https://sagecalm-studio.github.io/assignment-tracker/" target="_blank" class="etsy-gate-btn-buy">
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
