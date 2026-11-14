/**
 * Assignment Tracker — Edition 1 (Sage Calm) configuration.
 * Persona, storage key, themes and guided-tour script. Logic lives in engine.js / storage.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ATConfig = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    edition: 1,
    storageKey: 'assignment_tracker_data_v1',
    persona: { name: 'Maya', initial: 'M' },
    themes: [
      { id: 'sage-calm', label: 'Sage Calm' },
      { id: 'lavender-mist', label: 'Lavender Mist' },
      { id: 'warm-sand', label: 'Warm Sand' },
      { id: 'high-contrast', label: 'High Contrast' }
    ],
    defaultTab: 'today',
    tabs: ['today', 'tasks', 'courses', 'rescue', 'settings'],
    // gate: advance automatically when the student does the thing. Next is ALWAYS available (no softlocks).
    tour: [
      {
        tabId: 'today', section: 'Today · Do This Next', targetId: 'hero-next',
        title: "Hi, I'm Maya. Let's keep this easy.",
        message: "Twenty deadlines on one screen is how overwhelm starts. So I only ever show you one: the assignment that deserves your next sprint.",
        hint: 'This card changes as deadlines and your progress change.'
      },
      {
        tabId: 'today', section: 'Today · Quick add', targetId: 'qa-title',
        title: 'Capture it before it floats away',
        message: 'Type any assignment name. Just a few letters is enough. I will fill in the rest with sensible defaults.',
        hint: 'Try it now: type a name for a real or pretend assignment.',
        gate: { type: 'dom', event: 'input', selector: '#qa-title', test: 'value-min-3' }
      },
      {
        tabId: 'today', section: 'Today · Quick add', targetId: 'btn-qa-add',
        title: 'One tap to save',
        message: 'Pick a due chip and a time guess if you like, then tap Add it. You can polish details later.',
        hint: 'Tap Add it to keep going.',
        gate: { type: 'app', name: 'assignment-added' }
      },
      {
        tabId: 'today', section: 'Today · Start-By date', targetId: 'hero-next',
        title: 'Start-By beats Due Date',
        message: 'A due date feels unreal until the last minute. The Start-By date shows when you need to begin, based on your time guess and your real study capacity.',
        hint: 'Look for the "Start by" line on your hero card.'
      },
      {
        tabId: 'today', section: 'Header · Fog Mode', targetId: 'btn-toggle-fog',
        title: 'Low-energy day? Fog Mode.',
        message: 'Fog Mode hides everything except the one thing to do. Nothing is deleted. Tap it again to bring it all back.',
        hint: 'Try switching Fog Mode on, then off again.',
        gate: { type: 'app', name: 'fog-toggled' }
      },
      {
        tabId: 'tasks', section: 'Tasks · The full list', targetId: 'task-list',
        title: 'Everything in one calm list',
        message: 'Grouped by Overdue, Today, This week and Later. Tap a row to open its steps, or tap the circle to finish it.',
        hint: 'Tap any assignment to peek inside. Close it when you are done.',
        gate: { type: 'app', name: 'modal-closed' }
      },
      {
        tabId: 'rescue', section: 'Rescue Mode', targetId: 'rescue-list',
        title: 'Fell behind? No shame here.',
        message: 'Rescue Mode sorts the pile into three kind choices: Do it now, Ask for an extension, or Let it go. Pick one move per item.',
        hint: 'You can come back here any time things slip.'
      },
      {
        tabId: 'settings', section: 'Settings · Your capacity', targetId: 'set-capacity',
        title: 'Be honest about your energy',
        message: 'How many minutes of real study can you do on a normal day? Smaller is fine. Realistic numbers make Start-By dates trustworthy.',
        hint: 'You can change this whenever life changes.'
      },
      {
        tabId: 'today', section: 'Today · Focus sprint', targetId: 'hero-next',
        title: 'Ready? Start a 15-minute sprint.',
        message: 'Tap a sprint button on the hero card. When it ends I log the minutes, so your next time guesses get smarter.',
        hint: 'Tap Done to start your semester calmly.'
      }
    ]
  };
});
