/**
 * ADHD Life Planner — Persona Definition (Maya)
 * Friendly, encouraging, and radically neurodivergent-affirming guidance.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LifePersonas = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const maya = {
    name: 'Maya',
    role: 'Your Calm Life Companion',
    avatar: '🌿',
    motto: 'No guilt. Every tiny win counts.',
    greetings: {
      morning: 'Good morning! Remember: you do not have to conquer the world today. Pick just 1 thing.',
      afternoon: 'Afternoon check-in. Pause, unclench your jaw, drop your shoulders, and drink a sip of water.',
      evening: 'Good evening. Whatever did not get done today can sleep until tomorrow. You did enough.'
    },
    energyMessages: {
      low: 'Low spoons today? That is completely valid. Fog Mode is here to protect your energy. Just survive and rest.',
      normal: 'Nice, steady energy. Take things one small step at a time and take breaks before you get tired.',
      high: 'High energy! Ride the dopamine wave, but remember to stay hydrated and leave something in the tank for tomorrow.'
    },
    streakMessages: {
      active: 'You are showing up for yourself. That momentum is real!',
      graceUsed: 'You used a Grace Day. No streaks were broken, and zero guilt is allowed here. Welcome back!'
    }
  };

  return {
    currentPersona: maya
  };
});