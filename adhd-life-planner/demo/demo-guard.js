/**
 * ADHD Life Planner (Base Edition) — Demo Sandbox Guard
 * Isolates demo state into sessionStorage, seeds realistic ADHD demo data,
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
  const DEMO_STORE_KEY = 'adhd_life_planner_state_v1';

  if (!sessionStorage.getItem(DEMO_STORE_KEY)) {
    const today = new Date().toISOString().split('T')[0];
    const seedDemoState = {
      schema: 1,
      isDemo: true,
      profile: {
        name: 'Alex',
        theme: 'sage-calm',
        soundEnabled: true,
        energyLevel: 'normal',
        fogMode: false,
        lastOpenedDate: today
      },
      anchor: {
        text: 'Drink water, stretch shoulders, and finish 1 work sprint',
        completed: false,
        date: today
      },
      vitals: {
        waterGlasses: 4,
        targetWater: 8,
        medsTaken: true,
        mood: 'grounded'
      },
      tasks: [
        {
          id: 'demo-task-1',
          title: 'Reply to landlord email with confirmation',
          energy: 'low',
          completed: true,
          isEssential: true,
          subtasks: [
            { title: 'Open email app', duration: '1 min', completed: true },
            { title: 'Type 2 sentence response', duration: '2 min', completed: true },
            { title: 'Click send', duration: '1 min', completed: true }
          ]
        },
        {
          id: 'demo-task-2',
          title: 'Clear desk surface of empty mugs and papers',
          energy: 'normal',
          completed: false,
          isEssential: false,
          subtasks: [
            { title: 'Take mugs to kitchen', duration: '2 min', completed: false },
            { title: 'Wipe flat surface with cloth', duration: '3 min', completed: false }
          ]
        },
        {
          id: 'demo-task-3',
          title: 'Organize research notes for upcoming presentation',
          energy: 'high',
          completed: false,
          isEssential: false,
          subtasks: []
        }
      ],
      dopamineMenu: {
        appetizers: [
          { id: 'd-1', title: 'Ice water with fresh lemon', duration: '2 min', icon: 'glass' },
          { id: 'd-2', title: 'Step out on balcony for 2 mins of fresh air', duration: '2 min', icon: 'sun' },
          { id: 'd-3', title: 'Listen to 1 favorite upbeat song', duration: '3 min', icon: 'music' }
        ],
        entrees: [
          { id: 'd-4', title: '25-minute Pomodoro creative focus sprint', duration: '25 min', icon: 'zap' },
          { id: 'd-5', title: 'Tidy up bedroom and make bed', duration: '15 min', icon: 'sparkles' }
        ],
        sides: [
          { id: 'd-6', title: 'Gentle brown noise / rain audio', duration: 'Passive', icon: 'headphones' },
          { id: 'd-7', title: 'Light calming lavender candle', duration: 'Passive', icon: 'flame' }
        ],
        desserts: [
          { id: 'd-8', title: 'Play cozy simulation video game for 30 mins', duration: '30 min', icon: 'award' },
          { id: 'd-9', title: 'Cozy guilt-free 20-minute power nap', duration: '20 min', icon: 'moon' }
        ]
      },
      brainDump: '• Remember to pick up prescription on Thursday\n• Check botanical garden weekend hours\n• Idea: Meal prep chicken burrito bowls for next week',
      routines: [
        { id: 'r-1', slot: 'morning', title: 'Hydrate before looking at social media', completed: true, icon: 'sun' },
        { id: 'r-2', slot: 'morning', title: 'Take daily medication with breakfast', completed: true, icon: 'heart' },
        { id: 'r-3', slot: 'morning', title: 'Choose 1 single priority anchor for today', completed: true, icon: 'target' },
        { id: 'r-4', slot: 'afternoon', title: 'Midday standup, walk around room', completed: false, icon: 'coffee' },
        { id: 'r-5', slot: 'evening', title: 'Work shutdown: close browser tabs', completed: false, icon: 'power' },
        { id: 'r-6', slot: 'evening', title: 'Brain dump thoughts for tomorrow', completed: false, icon: 'edit-3' }
      ],
      streaks: {
        currentStreak: 5,
        graceDaysAvailable: 2,
        totalActiveDays: 14,
        lastActiveDate: today
      }
    };

    sessionStorage.setItem(DEMO_STORE_KEY, JSON.stringify(seedDemoState));
  }

  // Intercept localStorage methods for DEMO_STORE_KEY
  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.getItem = function (key) {
    if (key === DEMO_STORE_KEY) {
      return sessionStorage.getItem(DEMO_STORE_KEY);
    }
    return originalGetItem(key);
  };

  localStorage.setItem = function (key, value) {
    if (key === DEMO_STORE_KEY) {
      sessionStorage.setItem(DEMO_STORE_KEY, value);
      return;
    }
    originalSetItem(key, value);
  };

  localStorage.removeItem = function (key) {
    if (key === DEMO_STORE_KEY) {
      sessionStorage.removeItem(DEMO_STORE_KEY);
      return;
    }
    originalRemoveItem(key);
  };

  // 3. Purchase Conversion Modal
  window.openDemoGate = function (featureName) {
    const modal = document.getElementById('etsy-demo-gate-modal');
    if (modal) {
      const title = document.getElementById('etsy-gate-modal-title');
      if (title && featureName) title.textContent = featureName;
      modal.classList.add('active');
    }
  };

  window.closeDemoGate = function () {
    const modal = document.getElementById('etsy-demo-gate-modal');
    if (modal) modal.classList.remove('active');
  };

  document.addEventListener('DOMContentLoaded', function () {
    // Inject floating demo banner
    const banner = document.createElement('div');
    banner.className = 'demo-top-banner';
    banner.innerHTML = `
      <div class="demo-banner-content">
        <span>⚡ <strong>Interactive Live Demo</strong> — Changes reset on refresh.</span>
        <a href="https://sagecalmstudio.etsy.com" target="_blank" class="demo-banner-cta">Unlock Lifetime App ($9.00) 🌿</a>
      </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);

    // Gate backup export/import in demo
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
      exportBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.openDemoGate('Data Export & Personal Backups');
      };
    }
  });
})();