/**
 * Homework Planner — Edition 1 (Sage Calm) configuration.
 * Persona, storage key, themes and guided-tour script. Logic lives in engine.js / storage.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HPConfig = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    edition: 1,
    storageKey: 'homework_planner_data_v1',
    persona: { name: 'Maya', initial: 'M' },
    themes: [
      { id: 'sage-calm', label: 'Sage Calm' },
      { id: 'lavender-mist', label: 'Lavender Mist' },
      { id: 'warm-sand', label: 'Warm Sand' },
      { id: 'high-contrast', label: 'High Contrast' }
    ],
    defaultTab: 'tonight',
    tabs: ['tonight', 'tasks', 'subjects', 'rescue', 'settings'],
    // gate: advance automatically when the student does the thing. Next is ALWAYS available (no softlocks).
    tour: [
      {
        tabId: 'tonight', section: '📍 SECTION: Tonight • Up First', targetId: 'hero-next',
        title: "Hi, I'm Maya. Let's make homework feel lighter.",
        message: 'Staring at ten homework sheets at once causes instant freeze. I only put one item in front of you: the one that deserves your next short sprint.',
        hint: 'This card updates automatically as due dates and your progress change.'
      },
      {
        tabId: 'tonight', section: '📍 SECTION: Tonight • Quick Add', targetId: 'qa-title',
        title: 'Capture homework in 5 seconds',
        message: 'Type the homework name right after class. Even three letters is enough — I will apply calm defaults so nothing slips your mind.',
        hint: 'Try it now: type a real or practice homework item.',
        gate: { type: 'dom', event: 'input', selector: '#qa-title', test: 'value-min-3' }
      },
      {
        tabId: 'tonight', section: '📍 SECTION: Tonight • Quick Add', targetId: 'btn-qa-add',
        title: 'Save with one tap',
        message: 'Pick when it is due and roughly how long it might take, then tap Add it. You can add steps or subject tags anytime.',
        hint: 'Tap Add it to continue.',
        gate: { type: 'app', name: 'assignment-added' }
      },
      {
        tabId: 'tonight', section: '📍 SECTION: Tonight • Start-By Date', targetId: 'hero-next',
        title: 'Start-By beats Due Date',
        message: 'Waiting until the night before creates panic. Start-By tells you when to begin based on your evening study budget and your past sprint pace.',
        hint: 'Check the "Start by" line on your hero card.'
      },
      {
        tabId: 'tonight', section: '📍 SECTION: Header • Fog Mode', targetId: 'btn-toggle-fog',
        title: 'Tired brain? Turn on Fog Mode.',
        message: 'Fog Mode hides the queue, stats, and capture bar so only your single next homework item remains on screen. Nothing is ever deleted.',
        hint: 'Try toggling Fog Mode on, then back off.',
        gate: { type: 'app', name: 'fog-toggled' }
      },
      {
        tabId: 'tasks', section: '📍 SECTION: Homework • Full List', targetId: 'task-list',
        title: 'Your calm homework list',
        message: 'Organized by Overdue, Due today, This week, and Later. Tap any row to check off 2-minute micro-steps, or tap the circle when finished.',
        hint: 'Tap a homework row to peek inside, then close it to continue.',
        gate: { type: 'app', name: 'modal-closed' }
      },
      {
        tabId: 'subjects', section: '📍 SECTION: Subjects • Weekly Routines', targetId: 'routine-card',
        title: 'Never re-type weekly homework',
        message: 'Have a math sheet every Monday or vocab quiz every Friday? Save it once as a Weekly Routine and load the week in one tap.',
        hint: 'Add your classes and repeating homework right here.'
      },
      {
        tabId: 'rescue', section: '📍 SECTION: Catch-Up • Rescue Mode', targetId: 'rescue-list',
        title: 'Fell behind? Zero shame here.',
        message: 'Catch-Up Mode turns missed homework into three calm choices: Do it tonight, Ask for an extension, or Use a late pass.',
        hint: 'Come here anytime your evening gets derailed.'
      },
      {
        tabId: 'settings', section: '📍 SECTION: Settings • Evening Budget', targetId: 'set-capacity',
        title: 'Set an honest evening budget',
        message: 'How many minutes of real homework can you focus on after school? Honest numbers make every Start-By date realistic.',
        hint: 'Tap Done to start your homework calmly.'
      }
    ]
  };
});
