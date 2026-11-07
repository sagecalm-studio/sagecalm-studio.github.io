/**
 * ADHD Budget Planner - Contextual ADHD Help & Learning System
 * Provides 4-part low-cognitive-load explanations for every screen and concept.
 */

(function (global) {
  'use strict';

  const HelpContent = {
    'hero.safetospend': {
      title: 'Safe to Spend Today',
      what: 'The single most important number. This is what you can spend today without touching money promised to bills or goals.',
      todo: 'Check this number before buying something discretionary. If you spend, tap a Quick Log button or record the spend.',
      why: 'ADHD brains get overwhelmed by 15 budget envelopes. You only need to remember one number.',
      note: 'If you go over today, don\'t panic: tomorrow smoothly absorbs the difference across your remaining days. No day is ever "ruined".'
    },
    'hero.zombiemode': {
      title: 'Zombie Mode',
      what: 'An ultra-simplified view designed for high-stress, low-energy, or burnout days.',
      todo: 'Toggle Zombie Mode when looking at the whole planner feels like too much work. Use it just to ask: "Can I buy this right now?"',
      why: 'Executive dysfunction makes even opening an app feel exhausting. Zombie mode removes 90% of the screen so you stay in control with zero mental strain.',
      note: 'All your bills, debts, and math keep working silently in the background while Zombie Mode is on.'
    },
    'hero.quests': {
      title: 'Three Small Quests',
      what: 'A bite-sized daily checklist featuring a maximum of 3 real tasks from your budget.',
      todo: 'Pick one quest and complete it. When finished, check it off to clear it.',
      why: 'A to-do list with 10 items triggers analysis paralysis. Three small things is a list you can actually finish.',
      note: 'On quiet days with no bills due, quests will celebrate zero-spend days or remind you to take a breath.'
    },
    'hero.impulse': {
      title: '48-Hour Impulse Vault',
      what: 'A cooling-off holding tank for things you suddenly want to buy online or in stores.',
      todo: 'Instead of buying immediately, tap [Park an Impulse]. Put in the item and price. Let the 48-hour timer run.',
      why: 'Telling yourself "No, I can\'t have it" causes rebellion. Saying "I can have it in 48 hours if I still want it" satisfies your brain without the impulse spend.',
      note: '82% of impulse desires naturally vanish once 48 hours pass. If you still genuinely want it, buy it guilt-free!'
    },
    'hero.oops': {
      title: 'The Oops Fund',
      what: 'A small $25–$100 buffer pocket protected from your daily budget.',
      todo: 'Set your buffer in Settings. Minor miscalculations or forgotten parking meters are absorbed by this fund.',
      why: 'Rigid budgets break the moment you make one small mistake. The Oops Fund gives your budget room to bend without snapping.',
      note: 'You can increase or decrease this buffer whenever you like.'
    },
    'bills.soonest': {
      title: 'Soonest Bills First',
      what: 'Your bills sorted strictly in the order they will pull from your bank account.',
      todo: 'When a bill clears your bank account, tap [Mark Paid]. It automatically shifts to its next scheduled date.',
      why: 'Alphabetical lists hide what is urgent. Chronological order matches how real money flows.',
      note: 'Bills due after your next payday are hidden from today\'s hold list—they will be funded by that future paycheck.'
    },
    'bills.variable': {
      title: 'Past 12-Month Average',
      what: 'A tool to calculate the true average of fluctuating bills (like electricity or seasonal heating).',
      todo: 'Type what you paid over the past few months. Tap [Use Average] to set your monthly planning target.',
      why: 'Guessing too low leads to surprise shortfalls. Budgeting the average keeps your cashflow steady all year.',
      note: 'If a utility swings wildly, it\'s always safer to round up slightly.'
    },
    'income.runway': {
      title: 'Paycheck Runway',
      what: 'The timeline mapping out exactly how many days remain until your next money arrives.',
      todo: 'Notice your countdown. As payday approaches, your daily safe-to-spend naturally becomes more flexible.',
      why: 'Time blindness makes 2 weeks feel like an eternity or a blur. The runway turns invisible time into a visual bar.',
      note: 'If your payday falls on a weekend, turn on [Weekend Early] to automatically anchor pay on Friday.'
    },
    'debt.snowball': {
      title: 'Snowball vs. Avalanche',
      what: 'Two proven mathematical methods to crush debt and calculate your debt-free date.',
      todo: 'Toggle between Snowball (smallest balance first) and Avalanche (highest APR first) to see which fits your style.',
      why: 'Snowball gives fast psychological wins by eliminating small debts quickly. Avalanche mathematically saves the most interest.',
      note: 'For ADHD brains, Snowball is almost always better because quick wins provide crucial dopamine to keep going!'
    },
    'data.privacy': {
      title: '100% Offline Privacy & Safari Protection',
      what: 'How your data is stored completely privately inside your own device without servers.',
      todo: 'Tap [Add to Home Screen] on your phone and take a backup once a month with [Download Backup].',
      why: 'No bank logins, no passwords, and no subscription companies selling your spending habits.',
      note: 'Because Apple Safari can clear local cache after 7 days of non-use, adding the app to your Home Screen permanently immunizes it from cache deletion.'
    }
  };

  global.FocusHelp = HelpContent;

})(typeof window !== 'undefined' ? window : this);
