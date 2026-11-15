/**
 * Assignment Tracker — Pure Logic Engine (no DOM, no storage).
 * All dates are local calendar strings "YYYY-MM-DD". All durations are integer minutes.
 * Shared byte-for-byte between Edition 1 and Edition 2 (logic parity).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ATEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 86400000;

  // ---------- Date helpers (UTC midnight math => immune to DST, month ends, leap years) ----------
  function toUTC(s) {
    var p = String(s).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function toISO(ms) {
    var d = new Date(ms);
    var m = d.getUTCMonth() + 1;
    var day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return toISO(toUTC(s)) === s;
  }
  function todayStr(now) {
    var d = now || new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function daysBetween(a, b) {
    return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
  }
  function addDays(s, n) {
    return toISO(toUTC(s) + n * DAY_MS);
  }
  function isWeekend(s) {
    var wd = new Date(toUTC(s)).getUTCDay();
    return wd === 0 || wd === 6;
  }
  function weekdayShort(s) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(toUTC(s)).getUTCDay()];
  }
  function nextWeekday(from, targetDow) {
    // Next occurrence strictly after `from` of weekday targetDow (0=Sun..6=Sat)
    var d = addDays(from, 1);
    while (new Date(toUTC(d)).getUTCDay() !== targetDow) d = addDays(d, 1);
    return d;
  }
  function prettyDate(s) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var p = s.split('-');
    return weekdayShort(s) + ' ' + months[+p[1] - 1] + ' ' + (+p[2]);
  }

  // Step back `n` working days from `due` (weekends skipped only when skipWeekends).
  function workingDaysBefore(due, n, skipWeekends) {
    var d = due;
    var count = 0;
    var guard = 0;
    while (count < n && guard < 4000) {
      d = addDays(d, -1);
      if (!skipWeekends || !isWeekend(d)) count++;
      guard++;
    }
    return d;
  }

  // ---------- Formatting ----------
  function fmtMin(m) {
    var num = Number(m);
    if (!isFinite(num) || isNaN(num) || num <= 0) return '0m';
    m = Math.max(0, Math.round(num));
    if (m < 60) return m + 'm';
    var h = Math.floor(m / 60);
    var r = m % 60;
    return r === 0 ? h + 'h' : h + 'h ' + r + 'm';
  }
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  // ---------- Core assignment math ----------
  function isOpen(a) {
    return a.status === 'todo' || a.status === 'doing';
  }

  function sprintMinutes(assignmentId, sprints) {
    var total = 0;
    var seen = {};
    (sprints || []).forEach(function (s) {
      if (s.assignmentId === assignmentId && !seen[s.id]) {
        seen[s.id] = true; // anti-double-counting: a sprint id counts once
        total += Math.max(0, Math.round(Number(s.minutes) || 0));
      }
    });
    return total;
  }

  // actualMin = manual adjustment + sprint minutes (single source of truth)
  function actualMinutes(a, sprints) {
    return Math.max(0, Math.round(Number(a.manualMin) || 0)) + sprintMinutes(a.id, sprints);
  }

  // Personal "fudge factor": avg(actual/est) of last 10 completed, clamped 1.0..3.0. <3 samples => 1.25.
  function fudgeFactor(assignments, sprints) {
    var done = (assignments || []).filter(function (a) {
      return a.status === 'done' && a.estMin > 0 && actualMinutes(a, sprints) > 0;
    });
    if (done.length < 3) return 1.25;
    done.sort(function (x, y) { return String(y.completedAt || '').localeCompare(String(x.completedAt || '')); });
    var recent = done.slice(0, 10);
    var sum = 0;
    recent.forEach(function (a) { sum += actualMinutes(a, sprints) / a.estMin; });
    var f = sum / recent.length;
    if (!isFinite(f)) return 1.25;
    return Math.round(Math.min(3, Math.max(1, f)) * 100) / 100;
  }

  function neededWorkDays(remainingMin, fudge, capacityMin) {
    if (!(capacityMin > 0)) return 1;
    if (!(remainingMin > 0)) return 1;
    var f = Number(fudge);
    if (!isFinite(f) || f <= 0) f = 1;
    var res = Math.ceil((remainingMin * f) / capacityMin);
    return (isFinite(res) && res >= 1) ? res : 1;
  }

  function remainingMinutes(a, sprints) {
    return Math.max(0, (a.estMin || 0) - actualMinutes(a, sprints));
  }

  // The date by which you should START so you finish before the due date.
  function startBy(a, ctx) {
    var rem = remainingMinutes(a, ctx.sprints);
    var n = neededWorkDays(rem, ctx.fudge, ctx.settings.dailyCapacityMin);
    return workingDaysBefore(a.due, n, !!ctx.settings.skipWeekends);
  }

  function bucketOf(a, today) {
    var d = daysBetween(today, a.due);
    if (d < 0) return 'overdue';
    if (d === 0) return 'today';
    if (d <= 6) return 'week';
    return 'later';
  }

  function dueLabel(due, today) {
    var d = daysBetween(today, due);
    if (d < 0) return 'Overdue by ' + plural(-d, 'day');
    if (d === 0) return 'Due today';
    if (d === 1) return 'Due tomorrow';
    return 'Due in ' + plural(d, 'day');
  }

  function weightOf(a) {
    var w = Number(a.weight);
    if (!isFinite(w)) return 0;
    return Math.min(100, Math.max(0, w));
  }

  // priority = urgency x (1 + weight/100); rescue "do now" doubles it.
  function priority(a, ctx) {
    var today = ctx.today;
    var dueIn = daysBetween(today, a.due);
    var urgency;
    if (dueIn < 0) {
      urgency = 10 + Math.min(30, -dueIn) / 100;
    } else {
      var sbIn = daysBetween(today, startBy(a, ctx));
      urgency = 1 / Math.max(1, sbIn + 1) + 0.5 / (dueIn + 1);
    }
    var p = urgency * (1 + weightOf(a) / 100);
    if (a.rescue === 'now') p *= 2;
    return Math.round(p * 10000) / 10000;
  }

  function buildCtx(data, today) {
    var fudge = fudgeFactor(data.assignments, data.sprints);
    return { today: today, settings: data.settings, sprints: data.sprints, fudge: fudge };
  }

  function rankOpen(data, today) {
    var ctx = buildCtx(data, today);
    var open = data.assignments.filter(isOpen);
    var scored = open.map(function (a) { return { a: a, p: priority(a, ctx) }; });
    scored.sort(function (x, y) {
      if (y.p !== x.p) return y.p - x.p;
      if (x.a.due !== y.a.due) return x.a.due < y.a.due ? -1 : 1;
      return String(x.a.title).localeCompare(String(y.a.title));
    });
    return scored.map(function (s) { return s.a; });
  }

  function doThisNext(data, today) {
    var ranked = rankOpen(data, today);
    return ranked.length ? ranked[0] : null;
  }

  // ---------- Steps ----------
  function stepProgress(a) {
    var steps = a.steps || [];
    if (!steps.length) return 0;
    var done = steps.filter(function (s) { return s.done; }).length;
    return Math.round((done / steps.length) * 100);
  }
  function nextStepOf(a) {
    var steps = a.steps || [];
    for (var i = 0; i < steps.length; i++) if (!steps[i].done) return steps[i];
    return null;
  }

  var STEP_TEMPLATES = {
    essay: { label: 'Essay / Paper', steps: ['Open a blank document and title it', 'Write 3 bullet points of your argument', 'Gather 3 sources', 'Draft the introduction', 'Draft the body paragraphs', 'Draft the conclusion', 'Read it aloud and fix the roughest parts', 'Format citations and submit'] },
    exam: { label: 'Exam / Quiz', steps: ['List every topic the exam covers', 'Gather notes and past questions', 'Review topic 1 for 15 minutes', 'Do 5 practice questions', 'Review your weakest topic', 'Do a timed mini practice test', 'Pack your bag and sleep early'] },
    lab: { label: 'Lab Report', steps: ['Open the lab handout and template', 'Paste in your raw data', 'Write the method in 5 sentences', 'Make the main chart or table', 'Write results and discussion', 'Proofread and submit'] },
    presentation: { label: 'Presentation', steps: ['Write the one-sentence message', 'Outline 3 to 5 slides', 'Build the slides with rough content', 'Add visuals', 'Write short speaker notes', 'Rehearse once out loud'] },
    reading: { label: 'Reading', steps: ['Skim headings and summary first', 'Read the first section and jot one note', 'Read the next section and jot one note', 'Write a 3-sentence summary'] },
    problemset: { label: 'Problem Set', steps: ['Read all questions once', 'Do the easiest question first', 'Do the next two questions', 'Mark the hard ones and note what is stuck', 'Ask for help or review notes on stuck ones', 'Check answers and submit'] },
    quick: { label: 'Quick Task (single step)', steps: ['Do it and hand it in'] }
  };

  function makeSteps(templateKey, idFn) {
    var t = STEP_TEMPLATES[templateKey];
    if (!t) return [];
    var gen = idFn || function () { return uid('st'); };
    return t.steps.map(function (text) { return { id: gen(), text: text, done: false }; });
  }

  // ---------- Rescue Mode ----------
  // Open assignments that are overdue or whose start-by date has passed.
  function rescueCandidates(data, today) {
    var ctx = buildCtx(data, today);
    return data.assignments.filter(function (a) {
      if (!isOpen(a) || a.rescue === 'extension') return false;
      if (daysBetween(today, a.due) < 0) return true;
      return daysBetween(today, startBy(a, ctx)) < 0;
    }).sort(function (x, y) { return x.due < y.due ? -1 : x.due > y.due ? 1 : 0; });
  }

  // ---------- Capacity heatmap ----------
  function levelOf(ratio) {
    if (ratio <= 0) return 'none';
    if (ratio < 0.5) return 'light';
    if (ratio <= 1) return 'ok';
    if (ratio <= 1.5) return 'heavy';
    return 'over';
  }

  function capacityHeatmap(data, today, days) {
    var horizon = days || 14;
    var ctx = buildCtx(data, today);
    var cap = data.settings.dailyCapacityMin > 0 ? data.settings.dailyCapacityMin : 0;
    var skip = !!data.settings.skipWeekends;
    var cells = [];
    for (var i = 0; i < horizon; i++) cells.push({ date: addDays(today, i), minutes: 0 });
    var index = {};
    cells.forEach(function (c, i) { index[c.date] = i; });

    data.assignments.filter(isOpen).forEach(function (a) {
      var rem = remainingMinutes(a, data.sprints);
      if (rem <= 0) return;
      var sb = startBy(a, ctx);
      var start = daysBetween(today, sb) > 0 ? sb : today;
      var end = daysBetween(today, a.due) <= 0 ? today : addDays(a.due, -1);
      if (daysBetween(start, end) < 0) end = start;
      var window = [];
      var d = start;
      var guard = 0;
      while (daysBetween(d, end) >= 0 && guard < 4000) {
        if (!skip || !isWeekend(d)) window.push(d);
        d = addDays(d, 1);
        guard++;
      }
      if (!window.length) window = [start];
      var base = Math.floor(rem / window.length);
      var extra = rem - base * window.length;
      window.forEach(function (day, k) {
        var share = base + (k < extra ? 1 : 0);
        if (index[day] !== undefined) cells[index[day]].minutes += share;
      });
    });

    return cells.map(function (c) {
      var ratio = cap > 0 ? c.minutes / cap : 0;
      return { date: c.date, minutes: c.minutes, ratio: Math.round(ratio * 100) / 100, level: levelOf(ratio) };
    });
  }

  // ---------- Stats ----------
  function stats(data, today) {
    var open = data.assignments.filter(isOpen);
    var done = data.assignments.filter(function (a) { return a.status === 'done'; });
    var overdue = open.filter(function (a) { return daysBetween(today, a.due) < 0; }).length;
    var thisWeek = open.filter(function (a) { var d = daysBetween(today, a.due); return d >= 0 && d <= 6; }).length;
    return { open: open.length, done: done.length, overdue: overdue, thisWeek: thisWeek };
  }

  // Win streak: consecutive days (ending today or yesterday) with at least one completion. Each day counts once.
  function completionStreak(data, today) {
    var days = {};
    data.assignments.forEach(function (a) {
      if (a.status === 'done' && a.completedAt) days[String(a.completedAt).slice(0, 10)] = true;
    });
    var d = days[today] ? today : addDays(today, -1);
    var n = 0;
    while (days[d]) { n++; d = addDays(d, -1); }
    return n;
  }

  return {
    toUTC: toUTC, toISO: toISO, isValidDate: isValidDate, todayStr: todayStr, daysBetween: daysBetween,
    addDays: addDays, isWeekend: isWeekend, weekdayShort: weekdayShort, nextWeekday: nextWeekday, prettyDate: prettyDate,
    workingDaysBefore: workingDaysBefore, fmtMin: fmtMin, escapeHtml: escapeHtml, uid: uid, plural: plural,
    isOpen: isOpen, sprintMinutes: sprintMinutes, actualMinutes: actualMinutes, fudgeFactor: fudgeFactor,
    neededWorkDays: neededWorkDays, remainingMinutes: remainingMinutes, startBy: startBy, bucketOf: bucketOf,
    dueLabel: dueLabel, priority: priority, buildCtx: buildCtx, rankOpen: rankOpen, doThisNext: doThisNext,
    stepProgress: stepProgress, nextStepOf: nextStepOf, STEP_TEMPLATES: STEP_TEMPLATES, makeSteps: makeSteps,
    rescueCandidates: rescueCandidates, capacityHeatmap: capacityHeatmap, levelOf: levelOf,
    stats: stats, completionStreak: completionStreak
  };
});
