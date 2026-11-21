/**
 * ADHD Finance Planner — Edition 1 (Sage Calm Studio / Maya) Configuration.
 * Persona, storage key, 4 themes, 6 symmetric tabs, and 8-step interactive guided tour.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FPConfig = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    edition: 1,
    storageKey: 'adhd_finance_planner_data_v1',
    persona: { name: 'Maya', initial: 'M' },
    themes: [
      { id: 'sage-calm', label: 'Sage Calm' },
      { id: 'lavender-mist', label: 'Lavender Mist' },
      { id: 'warm-sand', label: 'Warm Sand' },
      { id: 'high-contrast', label: 'High Contrast' }
    ],
    defaultTab: 'pulse',
    tabs: ['pulse', 'autopilot', 'radar', 'buckets', 'wealth', 'settings'],
    tour: [
      {
        tabId: 'pulse',
        section: '📍 SECTION: Money Pulse • Safe Dopamine Wallet',
        targetId: 'hero-pulse',
        title: "Hi, I'm Maya. Welcome to your calm money sanctuary.",
        message: 'Seeing one giant bank balance tricks our brains into thinking rent money is fun money. I subtract your upcoming bills, sinking buckets, and an Oops cushion first — so you only see what is 100% safe to spend today.',
        hint: 'Your Safe Dopamine Wallet updates automatically without bank logins.'
      },
      {
        tabId: 'pulse',
        section: '📍 SECTION: Money Pulse • 5-Second Spend Log',
        targetId: 'qa-spend-title',
        title: 'Log a dopamine spend in 5 seconds',
        message: 'Type what you bought — like "Iced Matcha" or "Target run". No complicated categories required.',
        hint: 'Try it now: type at least 3 letters into the box.',
        gate: { type: 'dom', event: 'input', selector: '#qa-spend-title', test: 'value-min-3' }
      },
      {
        tabId: 'pulse',
        section: '📍 SECTION: Money Pulse • Save Spend',
        targetId: 'btn-qa-spend',
        title: 'Tap Log Spend to update your daily allowance',
        message: 'Pick a quick dollar chip or enter an amount, then tap Log spend. I use integer-cent math and never double-count when you update your checking balance.',
        hint: 'Tap Log spend (or Next) to continue.',
        gate: { type: 'app', name: 'spend-logged' }
      },
      {
        tabId: 'pulse',
        section: '📍 SECTION: Header • Money Fog Mode',
        targetId: 'btn-toggle-fog',
        title: 'Overwhelmed by numbers? Turn on Fog Mode.',
        message: 'On low-energy days, Fog Mode hides every chart, table, and forecast — leaving only your Safe Dopamine Wallet and single Next Money Move.',
        hint: 'Try toggling Fog Mode now.',
        gate: { type: 'app', name: 'fog-toggled' }
      },
      {
        tabId: 'autopilot',
        section: '📍 SECTION: Payday Autopilot • 4-Bucket Splitter',
        targetId: 'autopilot-card',
        title: '1-Tap Paycheck Autopilot Splitter',
        message: 'When a paycheck lands, enter the amount and pick a preset (like Calm 50/20/10/20). I split every penny into Fixed Bills, Sinking Buckets, Future Buffer, and your Dopamine Wallet.',
        hint: 'Tap Apply Paycheck Split to test-drive a payday allocation.',
        gate: { type: 'app', name: 'autopilot-applied' }
      },
      {
        tabId: 'radar',
        section: '📍 SECTION: ADHD Tax Radar • Subscriptions & Free Trials',
        targetId: 'radar-trophy-card',
        title: 'Beat the "ADHD Tax" & celebrate cancelled drains',
        message: 'Forgotten free trials and zombie subscriptions cost hundreds a year. I flag trials 3 days before renewal — and every time you cancel one, your Annual ADHD Tax Saved Trophy grows!',
        hint: 'Every cancelled subscription becomes a visible win.'
      },
      {
        tabId: 'buckets',
        section: '📍 SECTION: Sinking Buckets • True Expenses',
        targetId: 'buckets-card',
        title: 'Visual Sinking Buckets for non-monthly surprises',
        message: 'Car repairs, vet visits, and annual renewals are not emergencies if we set aside a little each month. Tap +$25 on any bucket to build your cushion.',
        hint: 'Auto-held buckets are protected from your daily Dopamine Wallet.'
      },
      {
        tabId: 'wealth',
        section: '📍 SECTION: Net Worth & Runway • Big Picture',
        targetId: 'wealth-summary-card',
        title: 'Your Offline Net Worth & Safety Runway',
        message: 'See your checking, savings buffers, sinking buckets, and debts in one calm view — plus how many days of survival runway you have stored.',
        hint: 'When we finish this tour, I will clear the sample items so you start fresh!'
      }
    ]
  };
});
