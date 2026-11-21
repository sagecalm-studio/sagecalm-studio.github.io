/**
 * ADHD Finance Planner — Guided Tour Engine (Rules 01, 02, 11, 16, 17, 18, 20, 22, 23).
 * - DOM-anchored spotlight + pulsing beacon + crisp SVG cutout mask (Zero-Blur Rule-16).
 * - Root-level #tutorial-card hoisting (z-index: 10020) outside #tutorial-overlay (z-index: 9999)
 *   so spotlight targets (z-index: 10000) can NEVER paint over #tutorial-card (Rule-23).
 * - Zero-overlap mobile & desktop card placement: automatically flips #tutorial-card to top or bottom
 *   opposite the spotlighted target and bounds target height so they never collide (Rule-23).
 * - Dual-trigger: advances on Next button OR user action gate (Rule-02).
 * - Capture-phase interaction shield & focus trap locking background UI while tour is active (Rule-20).
 * - Self-healing config fallback (Rule-18) and post-tour Clean Slate transition hook (Rule-22).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FPTutorial = factory();
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
  var shieldBound = false;

  var SHIELD_EVENTS = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];

  function el(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }

  /**
   * Rule-23: Hoists #tutorial-card to document.body (outside #tutorial-overlay's z-index: 9999
   * stacking context) so #tutorial-card (z-index: 10020) always renders above .tutorial-target-active (z-index: 10000).
   */
  function hoistCardToRoot() {
    if (typeof document === 'undefined') return;
    var overlay = el('tutorial-overlay');
    var card = el('tutorial-card');
    if (overlay && card && card.parentNode === overlay && overlay.parentNode) {
      overlay.parentNode.insertBefore(card, overlay.nextSibling);
    }
  }

  // ---------- Dynamic Zero-Blur SVG Cutout Mask (Rule-16) ----------
  function ensureOverlayMask(overlay) {
    if (!overlay || typeof document === 'undefined') return null;
    hoistCardToRoot();
    var rect = el('tutorial-cutout-rect');
    if (rect) return rect;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('id', 'tutorial-svg-mask');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;';
    svg.innerHTML =
      '<defs>' +
        '<mask id="tutorial-spotlight-mask">' +
          '<rect x="0" y="0" width="100%" height="100%" fill="white"/>' +
          '<rect id="tutorial-cutout-rect" x="0" y="0" width="0" height="0" rx="16" ry="16" fill="black"/>' +
        '</mask>' +
      '</defs>' +
      '<rect x="0" y="0" width="100%" height="100%" fill="rgba(10, 16, 14, 0.62)" mask="url(#tutorial-spotlight-mask)"/>';
    overlay.insertBefore(svg, overlay.firstChild);
    return el('tutorial-cutout-rect');
  }

  function updateSpotlightCutout(target) {
    var overlay = el('tutorial-overlay');
    if (!overlay) return;
    var rect = ensureOverlayMask(overlay);
    if (!rect) return;
    if (!target || typeof target.getBoundingClientRect !== 'function') {
      rect.setAttribute('width', '0');
      rect.setAttribute('height', '0');
      return;
    }
    var r = target.getBoundingClientRect();
    var pad = 5;
    rect.setAttribute('x', String(Math.max(0, Math.round(r.left - pad))));
    rect.setAttribute('y', String(Math.max(0, Math.round(r.top - pad))));
    rect.setAttribute('width', String(Math.max(0, Math.round(r.width + pad * 2))));
    rect.setAttribute('height', String(Math.max(0, Math.round(r.height + pad * 2))));
  }

  // ---------- Two-Layer Capture-Phase Interactivity Shield (Rule-20) ----------
  function isAllowedTourTarget(node) {
    if (!node) return false;
    var card = el('tutorial-card');
    if (card && (card === node || (card.contains && card.contains(node)))) return true;
    if (spotlight && (spotlight === node || (spotlight.contains && spotlight.contains(node)))) return true;
    return false;
  }

  function onCapturePointerEvent(e) {
    if (!active) return;
    if (isAllowedTourTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  function onCaptureFocus(e) {
    if (!active) return;
    if (isAllowedTourTarget(e.target)) return;
    e.preventDefault();
    var nextBtn = el('tutorial-btn-next');
    if (nextBtn && typeof nextBtn.focus === 'function') {
      nextBtn.focus();
    }
  }

  function onCaptureKeyDown(e) {
    if (!active) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      end(false);
      return;
    }
    if (e.key === 'Tab') {
      var card = el('tutorial-card');
      var focusable = [];
      if (card && card.querySelectorAll) {
        var cNodes = card.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        for (var i = 0; i < cNodes.length; i++) focusable.push(cNodes[i]);
      }
      if (spotlight && spotlight.querySelectorAll) {
        if (spotlight.matches && spotlight.matches('button, input, select, textarea, [href], [tabindex]')) {
          focusable.push(spotlight);
        }
        var sNodes = spotlight.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        for (var j = 0; j < sNodes.length; j++) focusable.push(sNodes[j]);
      }
      if (focusable.length > 0) {
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (isAllowedTourTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  function bindShield() {
    if (shieldBound || typeof document === 'undefined') return;
    shieldBound = true;
    SHIELD_EVENTS.forEach(function (ev) {
      document.addEventListener(ev, onCapturePointerEvent, true);
    });
    document.addEventListener('focusin', onCaptureFocus, true);
    document.addEventListener('keydown', onCaptureKeyDown, true);
    if (document.body) document.body.classList.add('tutorial-active');
  }

  function unbindShield() {
    if (!shieldBound || typeof document === 'undefined') return;
    shieldBound = false;
    SHIELD_EVENTS.forEach(function (ev) {
      document.removeEventListener(ev, onCapturePointerEvent, true);
    });
    document.removeEventListener('focusin', onCaptureFocus, true);
    document.removeEventListener('keydown', onCaptureKeyDown, true);
    if (document.body) document.body.classList.remove('tutorial-active');
  }

  function clearSpotlight() {
    if (spotlight) {
      spotlight.classList.remove('tutorial-target-active');
      spotlight = null;
    }
    if (typeof document !== 'undefined') {
      var beacons = document.querySelectorAll('.tutorial-beacon');
      for (var i = 0; i < beacons.length; i++) {
        if (beacons[i].parentNode) beacons[i].parentNode.removeChild(beacons[i]);
      }
    }
    updateSpotlightCutout(null);
  }

  function clearGates() {
    pendingApp = null;
    if (domGate && typeof document !== 'undefined') {
      document.removeEventListener(domGate.event, domGate.fn, true);
      domGate = null;
    }
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function overlap(a, b) {
    return !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right);
  }

  /**
   * Rule-11 & Rule-23: Positions #tutorial-card on the opposite vertical side of the spotlighted target
   * without scrolling the header off-screen when the target is already in view.
   */
  function positionCard(target, card) {
    if (typeof window === 'undefined' || !target || !card) return;
    hoistCardToRoot();
    var vh = window.innerHeight || 800;
    var vw = window.innerWidth || 1024;
    var nav = el('bottom-nav') || (typeof document !== 'undefined' && document.querySelector('.zen-island-nav'));
    var navH = 0;
    if (nav && nav.getBoundingClientRect) {
      var nr = nav.getBoundingClientRect();
      if (nr.height > 0 && nr.top > vh / 2 && nr.width >= vw * 0.5) navH = vh - nr.top;
    }
    var narrow = vw <= 700;
    var mobileNavClearance = navH + 84; // Rule-11 reference token
    // On mobile, bottom nav is hidden while body.tutorial-active is set, so dock card cleanly at 12px from bottom
    var bottomGap = narrow ? Math.min(12, mobileNavClearance) : 24;
    var topGap = narrow ? 12 : 24;

    function place(where) {
      card.style.top = where === 'top' ? topGap + 'px' : 'auto';
      card.style.bottom = where === 'bottom' ? bottomGap + 'px' : 'auto';
    }

    var tr = target.getBoundingClientRect();
    var center = tr.top + tr.height / 2;
    var first = center > vh * 0.52 ? 'top' : 'bottom';
    place(first);
    var cr = card.getBoundingClientRect();

    if (overlap(tr, cr)) {
      var second = first === 'top' ? 'bottom' : 'top';
      place(second);
      var cr2 = card.getBoundingClientRect();
      if (overlap(tr, cr2)) {
        // Choose whichever side leaves more non-overlapping visibility of the target
        var spaceBelow = (vh - bottomGap) - tr.bottom;
        var spaceAbove = tr.top - topGap;
        place(spaceBelow >= spaceAbove ? 'bottom' : 'top');
      }
    }

    updateSpotlightCutout(target);
  }

  function addBeacon(target) {
    if (!target || typeof document === 'undefined') return;
    var b = document.createElement('span');
    b.className = 'tutorial-beacon';
    b.setAttribute('aria-hidden', 'true');
    target.appendChild(b);
  }

  function gateTest(test, node) {
    if (test === 'value-min-2') return node && String(node.value || '').trim().length >= 2;
    if (test === 'value-min-3') return node && String(node.value || '').trim().length >= 3;
    return true;
  }

  function bindGate(step) {
    clearGates();
    if (!step.gate) return;
    if (step.gate.type === 'app') {
      pendingApp = step.gate.name;
    } else if (step.gate.type === 'dom' && typeof document !== 'undefined') {
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
    if (!cfg && typeof window !== 'undefined' && window.FPConfig) {
      cfg = window.FPConfig;
    }
    if (!cfg || !Array.isArray(cfg.tour)) return;
    if (i < 0) i = 0;
    if (i >= cfg.tour.length) {
      end(true);
      return;
    }
    current = i;
    var step = cfg.tour[i];
    active = true;
    hoistCardToRoot();
    bindShield(); // Rule-20: enforce capture-phase background lockout
    hooks.switchTab(step.tabId); // Rule-11: always synchronize screen tab first

    var overlay = el('tutorial-overlay');
    var card = el('tutorial-card');
    if (!overlay || !card) return;

    overlay.style.display = 'block';
    card.style.display = 'flex'; // Rule-02: synchronous & delayed re-assertion

    setTimeout(function () {
      if (!active || current !== i) return;
      hoistCardToRoot();
      overlay.style.display = 'block';
      card.style.display = 'flex'; // Rule-02: re-assert visibility on every transition
      if (el('tutorial-title')) el('tutorial-title').textContent = step.title;
      if (el('tutorial-message')) el('tutorial-message').textContent = step.message;
      if (el('tutorial-hint')) el('tutorial-hint').textContent = step.hint || '';
      if (el('tutorial-section-tag')) el('tutorial-section-tag').textContent = step.section || '';
      if (el('tutorial-step-count')) el('tutorial-step-count').textContent = (i + 1) + ' / ' + cfg.tour.length;
      if (el('tutorial-btn-prev')) el('tutorial-btn-prev').style.visibility = i === 0 ? 'hidden' : 'visible';
      if (el('tutorial-btn-next')) el('tutorial-btn-next').textContent = i === cfg.tour.length - 1 ? 'Done' : 'Next';
      var av = card.querySelector ? card.querySelector('.tour-avatar') : null;
      if (av && cfg.persona) av.textContent = cfg.persona.initial;

      clearSpotlight();
      var target = el(step.targetId);
      if (target) {
        spotlight = target;
        target.classList.add('tutorial-target-active');
        addBeacon(target);
        positionCard(target, card);
      }
      bindGate(step);
    }, 60);
  }

  function next() { if (active) render(current + 1); }
  function prev() { if (active) render(current - 1); }

  function end(completed) {
    active = false;
    unbindShield();
    clearGates();
    clearSpotlight();
    var overlay = el('tutorial-overlay');
    var card = el('tutorial-card');
    if (overlay) overlay.style.display = 'none';
    if (card) card.style.display = 'none';
    if (typeof window !== 'undefined' && typeof window.setCleanSlateState === 'function') {
      window.setCleanSlateState(false);
    }
    hooks.onEnd(!!completed);
  }

  function emit(name) {
    if (active && pendingApp === name) {
      pendingApp = null;
      advanceLater();
    }
  }

  function start() {
    if (!cfg && typeof window !== 'undefined' && window.FPConfig) {
      cfg = window.FPConfig;
    }
    render(0);
  }

  function init(options) {
    var opts = options || {};
    cfg = opts.config || (typeof window !== 'undefined' ? window.FPConfig : null);
    hooks.switchTab = opts.switchTab || hooks.switchTab;
    hooks.onEnd = opts.onEnd || hooks.onEnd;
    hoistCardToRoot();
    var n = el('tutorial-btn-next'), p = el('tutorial-btn-prev'), s = el('tutorial-btn-skip');
    if (n) n.addEventListener('click', function (e) { e.stopPropagation(); next(); });
    if (p) p.addEventListener('click', function (e) { e.stopPropagation(); prev(); });
    if (s) s.addEventListener('click', function (e) { e.stopPropagation(); end(false); });
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', function () {
        if (active && spotlight) positionCard(spotlight, el('tutorial-card'));
      });
      window.addEventListener('scroll', function () {
        if (active && spotlight) updateSpotlightCutout(spotlight);
      }, true);
    }
  }

  return {
    init: init,
    start: start,
    next: next,
    prev: prev,
    end: end,
    emit: emit,
    hoistCardToRoot: hoistCardToRoot,
    ensureOverlayMask: ensureOverlayMask,
    updateSpotlightCutout: updateSpotlightCutout,
    isActive: function () { return active; },
    getCurrentStep: function () { return current; }
  };
});
