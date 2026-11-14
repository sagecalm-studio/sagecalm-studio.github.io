/**
 * Homework Planner (Base Edition) — Demo Sandbox Guard
 * Isolates demo state into sessionStorage, seeds realistic homework demo data,
 * disables service workers, and injects Etsy conversion prompts.
 */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve();
    };
  }

  const DEMO_STORE_KEY = 'homework_planner_data_v1';

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

  function relDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Seed realistic homework demo data if fresh session
  if (!sessionStorage.getItem(DEMO_STORE_KEY)) {
    const today = relDate(0);
    const demoData = {
      version: 1,
      settings: { theme: 'sage-calm', dailyCapacityMin: 90, skipWeekends: true, sound: true, onboarded: true, fog: false },
      courses: [
        { id: 'c1', name: 'Algebra II', color: '#5b8f77' },
        { id: 'c2', name: 'English Literature', color: '#6b8fb5' },
        { id: 'c3', name: 'Biology', color: '#c08a5a' },
        { id: 'c4', name: 'Spanish II', color: '#8f6fb0' }
      ],
      routines: [
        { id: 'r1', title: 'Spanish Vocab Practice Sheet', courseId: 'c4', weekday: 5, estMin: 25, template: 'vocab' },
        { id: 'r2', title: 'Algebra II Weekly Problem Set', courseId: 'c1', weekday: 1, estMin: 45, template: 'worksheet' }
      ],
      assignments: [
        {
          id: 'hw1', courseId: 'c1', routineId: '', title: 'Chapter 5 Quadratic Functions Worksheet', due: relDate(1), weight: 25, estMin: 45, manualMin: 0, packed: false,
          steps: [
            { id: 's1', text: 'Skim example problems 1-3 & set up scratch paper', done: true },
            { id: 's2', text: 'Work odd-numbered problems first', done: false },
            { id: 's3', text: 'Check answers & mark any tricky ones', done: false },
            { id: 's4', text: 'Put completed sheet in homework folder', done: false }
          ],
          status: 'doing', rescue: '', createdAt: relDate(-1) + 'T16:00', completedAt: ''
        },
        {
          id: 'hw2', courseId: 'c2', routineId: '', title: 'To Kill a Mockingbird Ch. 12-14 Reading', due: relDate(2), weight: 20, estMin: 40, manualMin: 0, packed: false,
          steps: [
            { id: 's5', text: 'Read pages 150-168 with 3 sticky notes', done: false },
            { id: 's6', text: 'Jot 3 short takeaway bullets', done: false }
          ],
          status: 'todo', rescue: '', createdAt: relDate(-1) + 'T17:00', completedAt: ''
        },
        {
          id: 'hw3', courseId: 'c3', routineId: '', title: 'Cell Mitosis Lab Diagram', due: relDate(-1), weight: 15, estMin: 30, manualMin: 0, packed: false,
          steps: [
            { id: 's7', text: 'Sketch 4 phases & label organelles', done: false },
            { id: 's8', text: 'Write 2-sentence reflection', done: false }
          ],
          status: 'todo', rescue: '', createdAt: relDate(-3) + 'T15:00', completedAt: ''
        },
        {
          id: 'hw4', courseId: 'c4', routineId: '', title: 'Verb Conjugation Drill Sheet', due: today, weight: 10, estMin: 20, manualMin: 20, packed: false,
          steps: [
            { id: 's9', text: 'Complete sections A-C', done: true },
            { id: 's10', text: 'Read answers aloud once', done: true }
          ],
          status: 'done', rescue: '', createdAt: relDate(-2) + 'T16:00', completedAt: today + 'T17:30'
        }
      ],
      sprints: [
        { id: 'sp1', assignmentId: 'hw1', date: today, minutes: 15 }
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
        <span>🌿 <strong>Live Interactive Demo:</strong> Homework Planner (Sage Calm Edition)</span>
      </div>
      <div>
        <a href="https://sagecalm-studio.github.io/homework-planner/" target="_blank" class="etsy-demo-cta">
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
        <h3>✨ Take Your Evening Homework Sanctuary With You</h3>
        <p>
          You are currently test-driving the live demo sandbox. Get the complete lifetime edition on Etsy for instant offline access, PDF guides, and printable homework sheets across your phone, tablet, and laptop.
        </p>
        <a href="https://sagecalm-studio.github.io/homework-planner/" target="_blank" class="etsy-gate-btn-buy">
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
