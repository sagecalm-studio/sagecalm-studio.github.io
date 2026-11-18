/**
 * Homework Planner — Guided Tour Engine (Rules 01, 02, 11).
 *  - DOM-anchored spotlight + pulsing beacon on the real element.
 *  - Dual-trigger: every step advances on the Next button OR on the student's real action (gate).
 *  - Next is never disabled and the overlay ignores pointer events, so the tour can never softlock.
 *  - Every step switches to the correct tab first and re-asserts the card's display (self-healing).
 *  - Card flips top/bottom to avoid the target and clears the mobile bottom nav / top rail.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HPTutorial = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var cfg = null;
  var hooks = { switchTab: function () {}, onEnd: function () {} };
  var current = 0;
  var active = false;
  var spotlight = null;
  var pendingApp = null;
  var domGate = null;
  var advanceTimer = null;

  function el(id) { return document.getElementById(id); }

  function clearSpotlight() {
    if (spotlight) { spotlight.classList.remove('tutorial-target-active'); spotlight = null; }
    var beacons = document.querySelectorAll('.tutorial-beacon');
    for (var i = 0; i < beacons.length; i++) beacons[i].parentNode.removeChild(beacons[i]);
  }

  function clearGates() {
    pendingApp = null;
    if (domGate) { document.removeEventListener(domGate.event, domGate.fn, true); domGate = null; }
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
  }

  function overlap(a, b) {
    return !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right);
  }

  function positionCard(target, card) {
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var nav = el('bottom-nav') || document.querySelector('.zen-island-nav');
    var navH = 0;
    if (nav) {
      var nr = nav.getBoundingClientRect();
      if (nr.height > 0 && nr.top > vh / 2 && nr.width >= vw * 0.6) navH = vh - nr.top;
    }
    var header = document.querySelector('.app-header') || document.querySelector('.rail');
    var headerH = header ? header.getBoundingClientRect().height : 0;
    var narrow = vw <= 700;
    var bottomGap = narrow ? navH + 84 : 24;
    var topGap = narrow ? Math.min(headerH + 12, Math.round(vh * 0.36)) : 24;

    function place(where) {
      card.style.top = where === 'top' ? topGap + 'px' : 'auto';
      card.style.bottom = where === 'bottom' ? bottomGap + 'px' : 'auto';
    }
    var tr = target.getBoundingClientRect();
    var center = tr.top + tr.height / 2;
    var first = center > vh / 2 ? 'top' : 'bottom';
    place(first);
    var cr = card.getBoundingClientRect();
    if (overlap(tr, cr)) {
      place(first === 'top' ? 'bottom' : 'top');
      cr = card.getBoundingClientRect();
      if (overlap(tr, cr)) {
        // Both sides collide (tall target): nudge the page so the target sits clear of the card.
        var shift = first === 'top' ? tr.top - (cr.bottom + 12) : tr.bottom - (cr.top - 12);
        window.scrollBy(0, shift);
      }
    }
  }

  function addBeacon(target) {
    var b = document.createElement('span');
    b.className = 'tutorial-beacon';
    b.setAttribute('aria-hidden', 'true');
    target.appendChild(b);
  }

  function gateTest(test, node) {
    if (test === 'value-min-3') return node && String(node.value || '').trim().length >= 3;
    return true;
  }

  function bindGate(step) {
    clearGates();
    if (!step.gate) return;
    if (step.gate.type === 'app') {
      pendingApp = step.gate.name;
    } else if (step.gate.type === 'dom') {
      var g = step.gate;
      var fn = function (e) {
        var t = e.target && e.target.closest ? e.target.closest(g.selector) : null;
        if (t && gateTest(g.test, t)) {
          document.removeEventListener(g.event, fn, true);
          domGate = null;
          advanceLater();
        }
      };
      domGate = { event: g.event, fn: fn };
      document.addEventListener(g.event, fn, true);
    }
  }

  function advanceLater() {
    if (advanceTimer) clearTimeout(advanceTimer);
    var from = current;
    advanceTimer = setTimeout(function () {
      advanceTimer = null;
      if (active && current === from) next();
    }, 450);
  }

  function render(i) {
    if (!cfg) return;
    if (i < 0) i = 0;
    if (i >= cfg.tour.length) { end(true); return; }
    current = i;
    var step = cfg.tour[i];
    active = true;
    hooks.switchTab(step.tabId); // Rule 11: always sync the screen first
    var overlay = el('tutorial-overlay');
    var card = el('tutorial-card');
    if (!overlay || !card) return;

    setTimeout(function () {
      if (!active || current !== i) return;
      overlay.style.display = 'block';
      card.style.display = 'flex'; // Rule 02: re-assert visibility on every transition
      el('tutorial-title').textContent = step.title;
      el('tutorial-message').textContent = step.message;
      el('tutorial-hint').textContent = step.hint || '';
      el('tutorial-section-tag').textContent = step.section || '';
      el('tutorial-step-count').textContent = (i + 1) + ' / ' + cfg.tour.length;
      el('tutorial-btn-prev').style.visibility = i === 0 ? 'hidden' : 'visible';
      el('tutorial-btn-next').textContent = i === cfg.tour.length - 1 ? 'Done' : 'Next';
      var av = card.querySelector('.tour-avatar');
      if (av) av.textContent = cfg.persona.initial;

      clearSpotlight();
      var target = el(step.targetId);
      if (target) {
        spotlight = target;
        target.classList.add('tutorial-target-active');
        addBeacon(target);
        if (target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'auto' });
        positionCard(target, card);
      }
      bindGate(step);
    }, 80);
  }

  function next() { if (active) render(current + 1); }
  function prev() { if (active) render(current - 1); }

  function end(completed) {
    active = false;
    clearGates();
    clearSpotlight();
    var overlay = el('tutorial-overlay');
    var card = el('tutorial-card');
    if (overlay) overlay.style.display = 'none';
    if (card) card.style.display = 'none';
    hooks.onEnd(!!completed);
  }

  // The app tells the tour about real actions: 'assignment-added', 'fog-toggled', 'modal-closed', ...
  function emit(name) {
    if (active && pendingApp === name) {
      pendingApp = null;
      advanceLater();
    }
  }

  function start() { render(0); }

  function init(options) {
    cfg = options.config;
    hooks.switchTab = options.switchTab || hooks.switchTab;
    hooks.onEnd = options.onEnd || hooks.onEnd;
    var n = el('tutorial-btn-next'), p = el('tutorial-btn-prev'), s = el('tutorial-btn-skip');
    if (n) n.addEventListener('click', function (e) { e.stopPropagation(); next(); });
    if (p) p.addEventListener('click', function (e) { e.stopPropagation(); prev(); });
    if (s) s.addEventListener('click', function (e) { e.stopPropagation(); end(false); });
    window.addEventListener('resize', function () {
      if (active && spotlight) positionCard(spotlight, el('tutorial-card'));
    });
    document.addEventListener('keydown', function (e) { if (active && e.key === 'Escape') end(false); });
  }

  return {
    init: init, start: start, next: next, prev: prev, end: end, emit: emit,
    isActive: function () { return active; },
    getCurrentStep: function () { return current; }
  };
});
