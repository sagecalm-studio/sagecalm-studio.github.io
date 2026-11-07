/**
 * ADHD Life Planner — Contextual Help & Guidance Content
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LifeHelp = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const topics = {
    fogMode: {
      title: 'What is Fog / Low-Spoons Mode?',
      body: 'When your executive function is completely depleted ("low spoons" or burnout), looking at a long list of tasks causes emotional paralysis. Fog Mode dims and hides non-essential routines, leaving only survival basics: water, medication, and one gentle win. Turn it on anytime you feel overwhelmed.'
    },
    dopamineMenu: {
      title: 'How to Use the Dopamine Menu',
      body: 'Coined by ADHD experts, a Dopamine Menu structures stimulation into healthy categories: \n\n• Appetizers: 2-5 min quick resets when you feel stuck (stretch, ice water, 1 upbeat song).\n• Entrees: High-engagement flow tasks (creative work, deep cleaning).\n• Sides: Background sensory boosters (brown noise, ambient lighting, body-doubling).\n• Desserts: Pure treats to enjoy guilt-free after showing up for yourself.'
    },
    dechunker: {
      title: 'The Task De-chunker Explained',
      body: 'ADHD brains often experience "Task Paralysis" because our working memory perceives a project like "Clean room" as 50 simultaneous problems. The De-chunker splits your task into 3 tiny, timed micro-steps of 2 to 5 minutes each, lowering the barrier to starting.'
    },
    graceStreak: {
      title: 'Why Streaks Don’t Reset to Zero (Grace Days)',
      body: 'Standard apps punish you when you miss a day, which triggers ADHD shame spirals and makes you abandon the app. In our planner, you get built-in Grace Days. If you miss a day, your momentum is preserved without punishment.'
    }
  };

  return {
    topics: topics
  };
});