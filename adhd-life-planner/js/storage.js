/**
 * ADHD Life Planner — Storage & State Management
 * Pure client-side localStorage with auto-hydration, schema migration,
 * and JSON backup export/import safeguards.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LifeStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'adhd_life_planner_state_v1';
  const CURRENT_SCHEMA = 1;

  function getDefaultState() {
    const today = new Date().toISOString().split('T')[0];
    return {
      schema: CURRENT_SCHEMA,
      profile: {
        name: 'Friend',
        theme: 'sage-calm',
        soundEnabled: true,
        energyLevel: 'normal', // 'low' | 'normal' | 'high'
        fogMode: false,
        lastOpenedDate: today
      },
      anchor: {
        text: 'Drink a tall glass of water and stretch for 2 minutes',
        completed: false,
        date: today
      },
      vitals: {
        waterGlasses: 3,
        targetWater: 8,
        medsTaken: false,
        mood: 'grounded' // 'calm' | 'grounded' | 'scattered' | 'tired'
      },
      tasks: [
        {
          id: 'task-1',
          title: 'Reply to 1 urgent message with a quick 2-sentence note',
          energy: 'low',
          completed: false,
          isEssential: true,
          subtasks: []
        },
        {
          id: 'task-2',
          title: 'Clear one single surface on the desk',
          energy: 'normal',
          completed: false,
          isEssential: false,
          subtasks: []
        },
        {
          id: 'task-3',
          title: 'Organize project files into 1 clean folder',
          energy: 'high',
          completed: false,
          isEssential: false,
          subtasks: []
        }
      ],
      dopamineMenu: {
        appetizers: [
          { id: 'dop-1', title: 'Drink a cold glass of ice water with lemon', duration: '2 min', icon: 'glass' },
          { id: 'dop-2', title: 'Step outside and feel sunlight on your face', duration: '3 min', icon: 'sun' },
          { id: 'dop-3', title: 'Play 1 high-energy favorite dance track', duration: '4 min', icon: 'music' },
          { id: 'dop-4', title: 'Roll shoulders back and stretch neck', duration: '2 min', icon: 'heart' }
        ],
        entrees: [
          { id: 'dop-5', title: '25-minute uninterrupted creative sprint', duration: '25 min', icon: 'zap' },
          { id: 'dop-6', title: 'Deep clean and reorganize the kitchen counter', duration: '20 min', icon: 'sparkles' },
          { id: 'dop-7', title: 'Batch complete all tiny pending phone tasks', duration: '15 min', icon: 'check-circle' }
        ],
        sides: [
          { id: 'dop-8', title: 'Put on soft brown noise or rain sounds', duration: 'Passive', icon: 'headphones' },
          { id: 'dop-9', title: 'Light a calming cedarwood or lavender candle', duration: 'Passive', icon: 'flame' },
          { id: 'dop-10', title: 'Virtual body-doubling with a friend or YouTube study-with-me', duration: 'Passive', icon: 'users' }
        ],
        desserts: [
          { id: 'dop-11', title: 'Play favorite cozy video game for 30 minutes', duration: '30 min', icon: 'award' },
          { id: 'dop-12', title: 'Watch 1 episode of favorite show without multitasking', duration: '25 min', icon: 'tv' },
          { id: 'dop-13', title: 'Cozy guilt-free 20-minute power nap', duration: '20 min', icon: 'moon' }
        ]
      },
      brainDump: '• Remember to buy oat milk\n• Research comfortable desk chair\n• Idea for weekend walk at the botanical gardens',
      routines: [
        { id: 'rt-1', slot: 'morning', title: 'Drink water before looking at phone', completed: false, icon: 'sun' },
        { id: 'rt-2', slot: 'morning', title: 'Take morning vitamins / meds', completed: false, icon: 'heart' },
        { id: 'rt-3', slot: 'morning', title: 'Set 1 single daily focus anchor', completed: false, icon: 'target' },
        { id: 'rt-4', slot: 'afternoon', title: 'Midday screen break & walk 5 minutes', completed: false, icon: 'coffee' },
        { id: 'rt-5', slot: 'afternoon', title: 'Hydrate & quick stretch', completed: false, icon: 'droplet' },
        { id: 'rt-6', slot: 'evening', title: 'Work shutdown: Close all browser tabs', completed: false, icon: 'power' },
        { id: 'rt-7', slot: 'evening', title: 'Brain dump tomorrow to unburden mind', completed: false, icon: 'edit-3' },
        { id: 'rt-8', slot: 'evening', title: 'Dim lights & phone on night shield', completed: false, icon: 'moon' }
      ],
      streaks: {
        currentStreak: 4,
        graceDaysAvailable: 2,
        totalActiveDays: 12,
        lastActiveDate: today
      }
    };
  }

  function migrateState(raw) {
    if (!raw || typeof raw !== 'object') {
      return getDefaultState();
    }

    const state = Object.assign({}, raw);

    if (!state.schema || state.schema < CURRENT_SCHEMA) {
      state.schema = CURRENT_SCHEMA;
    }

    // Hydrate profile
    state.profile = Object.assign({
      name: 'Friend',
      theme: 'sage-calm',
      soundEnabled: true,
      energyLevel: 'normal',
      fogMode: false,
      lastOpenedDate: new Date().toISOString().split('T')[0]
    }, state.profile || {});

    // Hydrate anchor
    state.anchor = Object.assign({
      text: 'Drink a tall glass of water and stretch for 2 minutes',
      completed: false,
      date: new Date().toISOString().split('T')[0]
    }, state.anchor || {});

    // Hydrate vitals
    state.vitals = Object.assign({
      waterGlasses: 0,
      targetWater: 8,
      medsTaken: false,
      mood: 'grounded'
    }, state.vitals || {});

    // Hydrate arrays
    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.routines)) state.routines = [];
    if (typeof state.brainDump !== 'string') state.brainDump = '';

    // Hydrate dopamine menu
    if (!state.dopamineMenu || typeof state.dopamineMenu !== 'object') {
      state.dopamineMenu = { appetizers: [], entrees: [], sides: [], desserts: [] };
    } else {
      ['appetizers', 'entrees', 'sides', 'desserts'].forEach(cat => {
        if (!Array.isArray(state.dopamineMenu[cat])) state.dopamineMenu[cat] = [];
      });
    }

    // Hydrate streaks
    state.streaks = Object.assign({
      currentStreak: 1,
      graceDaysAvailable: 2,
      totalActiveDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0]
    }, state.streaks || {});

    return state;
  }

  function loadState() {
    try {
      if (typeof localStorage === 'undefined') {
        return getDefaultState();
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = getDefaultState();
        saveState(initial);
        return initial;
      }
      const parsed = JSON.parse(raw);
      return migrateState(parsed);
    } catch (e) {
      console.warn('Error loading state from localStorage:', e);
      return getDefaultState();
    }
  }

  function saveState(state) {
    try {
      if (typeof localStorage === 'undefined') {
        return true; // Mock success in headless/Node test environments
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
      return false;
    }
  }

  function resetToDefault() {
    const fresh = getDefaultState();
    saveState(fresh);
    return fresh;
  }

  function exportStateJSON() {
    const state = loadState();
    return JSON.stringify(state, null, 2);
  }

  function importStateJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON data format');
      }
      const migrated = migrateState(parsed);
      saveState(migrated);
      return { success: true, state: migrated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    CURRENT_SCHEMA: CURRENT_SCHEMA,
    getDefaultState: getDefaultState,
    migrateState: migrateState,
    loadState: loadState,
    saveState: saveState,
    resetToDefault: resetToDefault,
    exportStateJSON: exportStateJSON,
    importStateJSON: importStateJSON
  };
});