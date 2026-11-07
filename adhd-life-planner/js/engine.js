/**
 * ADHD Life Planner — Pure Computational & Behavioral Logic Engine
 * 100% pure functions, zero DOM dependencies, fully testable in Node.js.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LifeEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function toISODate(d) {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function addDays(isoDate, n) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(y, m, d + n));
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function diffDays(d1, d2) {
    if (!d1 || !d2) return 0;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) || isNaN(t2)) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((t2 - t1) / msPerDay);
  }

  function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Filter active tasks based on current energy mode
   * @param {Array} tasks - List of task objects
   * @param {string} energyLevel - 'low', 'normal', or 'high'
   * @param {boolean} fogMode - Whether low-spoons fog mode is active
   */
  function calculateEnergyFilteredTasks(tasks, energyLevel, fogMode) {
    if (!Array.isArray(tasks)) return [];
    
    // If Fog Mode is active, restrict strictly to essential low-energy items
    if (fogMode || energyLevel === 'low') {
      return tasks.filter(t => t.energy === 'low' || t.isEssential === true);
    }
    
    if (energyLevel === 'normal') {
      return tasks.filter(t => t.energy === 'low' || t.energy === 'normal');
    }
    
    // High energy shows everything
    return tasks;
  }

  /**
   * Rule-based Task De-chunker (Breaks overwhelming tasks into bite-sized 3-5 min micro-steps)
   * @param {string} taskTitle - The overwhelming task
   */
  function dechunkTask(taskTitle) {
    const raw = (taskTitle || '').trim();
    if (!raw) return [];

    const lower = raw.toLowerCase();

    // Specific domain heuristics for common executive dysfunction tasks
    if (lower.includes('clean') || lower.includes('tidy') || lower.includes('room') || lower.includes('dishes')) {
      return [
        { title: 'Put on 1 favorite energetic song or brown noise', duration: '2 min', completed: false },
        { title: 'Pick up only 5 pieces of obvious trash or laundry', duration: '3 min', completed: false },
        { title: 'Clear 1 single flat surface (desk or counter)', duration: '5 min', completed: false },
        { title: 'Celebrate and stop (anything else is extra credit)', duration: '1 min', completed: false }
      ];
    }

    if (lower.includes('email') || lower.includes('inbox') || lower.includes('message') || lower.includes('text')) {
      return [
        { title: 'Open the app and find the 1 single most urgent message', duration: '2 min', completed: false },
        { title: 'Draft a short 2-sentence response (does not need to be perfect)', duration: '3 min', completed: false },
        { title: 'Press send without re-reading it 10 times', duration: '1 min', completed: false },
        { title: 'Close the inbox and take a deep breath', duration: '1 min', completed: false }
      ];
    }

    if (lower.includes('study') || lower.includes('read') || lower.includes('write') || lower.includes('paper') || lower.includes('work')) {
      return [
        { title: 'Open the document/book and set a 10-minute gentle timer', duration: '2 min', completed: false },
        { title: 'Write down 3 bullet points or read just 2 pages', duration: '5 min', completed: false },
        { title: 'Do a quick stretch break and drink some water', duration: '2 min', completed: false },
        { title: 'Decide if you want to keep flowing or park it for later', duration: '1 min', completed: false }
      ];
    }

    if (lower.includes('call') || lower.includes('doctor') || lower.includes('appointment')) {
      return [
        { title: 'Find the phone number and write it on a piece of paper', duration: '2 min', completed: false },
        { title: 'Jot down the 1 question or reason for calling', duration: '2 min', completed: false },
        { title: 'Dial the number (you only need to survive 60 seconds)', duration: '3 min', completed: false },
        { title: 'Log the confirmation and reward yourself with a treat', duration: '1 min', completed: false }
      ];
    }

    // Universal ADHD 3-Step Micro Breakdown
    return [
      { title: `Prep & Setup: Open or place materials for "${raw}"`, duration: '2 min', completed: false },
      { title: `The 5-Minute Sprint: Do just the very first piece without perfectionism`, duration: '5 min', completed: false },
      { title: `Gentle Landing: Put things away or leave a bookmark for next time`, duration: '3 min', completed: false }
    ];
  }

  /**
   * Guilt-Free Streak & Consistency Calculator
   * @param {Object} streakState - { currentStreak, graceDaysAvailable, totalActiveDays, lastActiveDate }
   * @param {string} todayISO - YYYY-MM-DD
   * @param {boolean} didLogToday - User checked off their daily anchor or routine
   */
  function updateGraceStreak(streakState, todayISO, didLogToday) {
    const state = Object.assign({
      currentStreak: 0,
      graceDaysAvailable: 2,
      totalActiveDays: 0,
      lastActiveDate: ''
    }, streakState || {});

    if (!todayISO) return state;

    if (!state.lastActiveDate) {
      if (didLogToday) {
        state.currentStreak = 1;
        state.totalActiveDays = 1;
        state.lastActiveDate = todayISO;
      }
      return state;
    }

    const dayGap = diffDays(state.lastActiveDate, todayISO);

    // Already logged today
    if (dayGap === 0) {
      return state;
    }

    // Consecutive day
    if (dayGap === 1) {
      if (didLogToday) {
        state.currentStreak += 1;
        state.totalActiveDays += 1;
        state.lastActiveDate = todayISO;
      }
      return state;
    }

    // Missed 1-2 days: Use Grace Days instead of punishing reset
    if (dayGap > 1 && dayGap <= 3 && state.graceDaysAvailable > 0) {
      const neededGrace = dayGap - 1;
      if (state.graceDaysAvailable >= neededGrace) {
        state.graceDaysAvailable -= neededGrace;
        if (didLogToday) {
          state.currentStreak += 1;
          state.totalActiveDays += 1;
          state.lastActiveDate = todayISO;
        }
        return state;
      }
    }

    // Beyond grace window: Soft Reset without shame (keeps total active days!)
    if (didLogToday) {
      state.currentStreak = 1;
      state.totalActiveDays += 1;
      state.lastActiveDate = todayISO;
      state.graceDaysAvailable = 2; // replenish grace pool
    }

    return state;
  }

  /**
   * Random Dopamine Item Picker
   * @param {Object} dopamineMenu - { appetizers, entrees, sides, desserts }
   * @param {string} category - 'appetizers', 'entrees', 'sides', 'desserts', or 'any'
   */
  function getDopamineRandomPick(dopamineMenu, category) {
    if (!dopamineMenu) return null;
    let pool = [];
    if (category && category !== 'any' && Array.isArray(dopamineMenu[category])) {
      pool = dopamineMenu[category];
    } else {
      ['appetizers', 'sides', 'desserts'].forEach(cat => {
        if (Array.isArray(dopamineMenu[cat])) {
          pool = pool.concat(dopamineMenu[cat]);
        }
      });
    }
    if (pool.length === 0) return null;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  /**
   * Calculate daily momentum percentage and low-pressure status
   */
  function calculateDailyProgress(anchor, vitals, routines, tasks) {
    let totalItems = 0;
    let completedItems = 0;

    // Anchor counts as 2x weight (Single Focus)
    if (anchor && anchor.text && anchor.text.trim()) {
      totalItems += 2;
      if (anchor.completed) completedItems += 2;
    }

    // Vitals (Water + Meds)
    if (vitals) {
      totalItems += 2;
      if (vitals.medsTaken) completedItems += 1;
      if (vitals.waterGlasses >= 4) completedItems += 1;
    }

    // Routines
    if (Array.isArray(routines)) {
      routines.forEach(r => {
        totalItems += 1;
        if (r.completed) completedItems += 1;
      });
    }

    // Active tasks
    if (Array.isArray(tasks)) {
      tasks.forEach(t => {
        totalItems += 1;
        if (t.completed) completedItems += 1;
      });
    }

    if (totalItems === 0) {
      return { percentage: 0, completedCount: 0, totalCount: 0, message: 'Ready when you are. Take your time.' };
    }

    const pct = Math.round((completedItems / totalItems) * 100);

    let message = 'Gentle start. Every small step counts.';
    if (pct >= 25 && pct < 50) message = 'Steady rhythm. You are doing great.';
    if (pct >= 50 && pct < 75) message = 'Beautiful momentum. Remember to breathe and hydrate.';
    if (pct >= 75 && pct < 100) message = 'Exceptional day. Be proud of this energy.';
    if (pct === 100) message = 'Radiant day! Fully achieved. Time to rest guilt-free.';

    return {
      percentage: pct,
      completedCount: completedItems,
      totalCount: totalItems,
      message: message
    };
  }

  return {
    toISODate: toISODate,
    addDays: addDays,
    diffDays: diffDays,
    sanitizeText: sanitizeText,
    calculateEnergyFilteredTasks: calculateEnergyFilteredTasks,
    dechunkTask: dechunkTask,
    updateGraceStreak: updateGraceStreak,
    getDopamineRandomPick: getDopamineRandomPick,
    calculateDailyProgress: calculateDailyProgress
  };
});