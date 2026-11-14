/**
 * Homework Planner — State, Validation, Migration & Mutations.
 * Pure functions over a plain data object; localStorage is injected so tests can run in Node.
 * Shared byte-for-byte between both editions (logic parity). Storage key comes from config.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./engine.js'));
  } else {
    root.HPStorage = factory(root.HPEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var STATUSES = ['todo', 'doing', 'done', 'dropped'];
  var COURSE_COLORS = ['#5b8f77', '#6b8fb5', '#c08a5a', '#9a7bb0', '#b5657a', '#7a9a45'];

  function defaultSettings() {
    return { theme: '', dailyCapacityMin: 90, skipWeekends: false, sound: true, onboarded: false, fog: false };
  }

  function defaultData() {
    return { version: SCHEMA_VERSION, settings: defaultSettings(), courses: [], routines: [], assignments: [], sprints: [] };
  }

  function clampInt(v, min, max, fallback) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function cleanText(v, max) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  }

  function sanitizeSteps(steps) {
    if (!Array.isArray(steps)) return [];
    return steps.filter(function (s) { return s && cleanText(s.text, 200); }).map(function (s) {
      return { id: cleanText(s.id, 60) || E.uid('st'), text: cleanText(s.text, 200), done: !!s.done };
    }).slice(0, 60);
  }

  // Validate + migrate arbitrary input into a safe data object. Never throws.
  function sanitize(raw) {
    var data = defaultData();
    if (!raw || typeof raw !== 'object') return data;
    var s = raw.settings || {};
    data.settings.theme = cleanText(s.theme, 30);
    data.settings.dailyCapacityMin = clampInt(s.dailyCapacityMin, 15, 720, 90);
    data.settings.skipWeekends = !!s.skipWeekends;
    data.settings.sound = s.sound === undefined ? true : !!s.sound;
    data.settings.onboarded = !!s.onboarded;
    data.settings.fog = !!s.fog;

    var courseIds = {};
    (Array.isArray(raw.courses) ? raw.courses : []).forEach(function (c, i) {
      if (!c || !cleanText(c.name, 60)) return;
      var id = cleanText(c.id, 60) || E.uid('c');
      if (courseIds[id]) return;
      courseIds[id] = true;
      data.courses.push({ id: id, name: cleanText(c.name, 60), color: cleanText(c.color, 9) || COURSE_COLORS[i % COURSE_COLORS.length] });
    });

    var rIds = {};
    (Array.isArray(raw.routines) ? raw.routines : []).forEach(function (r) {
      if (!r || !cleanText(r.title, 120)) return;
      var id = cleanText(r.id, 60) || E.uid('rt');
      if (rIds[id]) return;
      rIds[id] = true;
      var tmpl = cleanText(r.template, 30);
      data.routines.push({
        id: id,
        title: cleanText(r.title, 120),
        courseId: courseIds[r.courseId] ? r.courseId : '',
        weekday: clampInt(r.weekday, 0, 6, 1),
        estMin: clampInt(r.estMin, 5, 600, 30),
        template: E.STEP_TEMPLATES[tmpl] ? tmpl : ''
      });
    });

    var aIds = {};
    (Array.isArray(raw.assignments) ? raw.assignments : []).forEach(function (a) {
      if (!a || !cleanText(a.title, 120) || !E.isValidDate(a.due)) return;
      var id = cleanText(a.id, 60) || E.uid('a');
      if (aIds[id]) return;
      aIds[id] = true;
      var status = STATUSES.indexOf(a.status) >= 0 ? a.status : 'todo';
      data.assignments.push({
        id: id,
        courseId: courseIds[a.courseId] ? a.courseId : '',
        routineId: cleanText(a.routineId, 60),
        title: cleanText(a.title, 120),
        due: a.due,
        weight: clampInt(a.weight, 0, 100, 0),
        estMin: clampInt(a.estMin, 0, 6000, 45),
        manualMin: clampInt(a.manualMin, 0, 6000, 0),
        packed: !!a.packed,
        steps: sanitizeSteps(a.steps),
        status: status,
        rescue: ['now', 'extension', 'letgo'].indexOf(a.rescue) >= 0 ? a.rescue : '',
        createdAt: cleanText(a.createdAt, 30),
        completedAt: status === 'done' ? cleanText(a.completedAt, 30) : ''
      });
    });

    var sIds = {};
    (Array.isArray(raw.sprints) ? raw.sprints : []).forEach(function (sp) {
      if (!sp || !aIds[sp.assignmentId]) return;
      var id = cleanText(sp.id, 60) || E.uid('sp');
      if (sIds[id]) return; // duplicate sprint ids are dropped (anti-double-counting)
      sIds[id] = true;
      data.sprints.push({ id: id, assignmentId: sp.assignmentId, date: E.isValidDate(sp.date) ? sp.date : '', minutes: clampInt(sp.minutes, 0, 600, 0) });
    });
    return data;
  }

  // ---------- Persistence ----------
  function load(backend, key) {
    try {
      var txt = backend.getItem(key);
      if (!txt) return defaultData();
      return sanitize(JSON.parse(txt));
    } catch (e) {
      return defaultData();
    }
  }
  function save(backend, key, data) {
    try { backend.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; }
  }
  function exportJSON(data) {
    return JSON.stringify(data, null, 2);
  }
  function importJSON(text) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.assignments)) throw new Error('Not a Homework Planner backup');
    return sanitize(parsed);
  }

  function stamp(now) {
    var d = now || new Date();
    var hh = d.getHours(); var mm = d.getMinutes();
    return E.todayStr(d) + 'T' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  // ---------- Mutations ----------
  function findA(data, id) {
    for (var i = 0; i < data.assignments.length; i++) if (data.assignments[i].id === id) return data.assignments[i];
    return null;
  }

  function addCourse(data, name) {
    var n = cleanText(name, 60);
    if (!n) return null;
    var existing = data.courses.filter(function (c) { return c.name.toLowerCase() === n.toLowerCase(); })[0];
    if (existing) return existing;
    var c = { id: E.uid('c'), name: n, color: COURSE_COLORS[data.courses.length % COURSE_COLORS.length] };
    data.courses.push(c);
    return c;
  }

  function deleteCourse(data, id) {
    data.courses = data.courses.filter(function (c) { return c.id !== id; });
    data.assignments.forEach(function (a) { if (a.courseId === id) a.courseId = ''; });
    data.routines.forEach(function (r) { if (r.courseId === id) r.courseId = ''; });
  }

  function addRoutine(data, f) {
    var title = cleanText(f && f.title, 120);
    if (!title) return null;
    var tmpl = cleanText(f.template, 30);
    var r = {
      id: E.uid('rt'),
      title: title,
      courseId: data.courses.some(function (c) { return c.id === f.courseId; }) ? f.courseId : '',
      weekday: clampInt(f.weekday, 0, 6, 1),
      estMin: clampInt(f.estMin, 5, 600, 30),
      template: E.STEP_TEMPLATES[tmpl] ? tmpl : ''
    };
    data.routines.push(r);
    return r;
  }

  function deleteRoutine(data, id) {
    data.routines = data.routines.filter(function (r) { return r.id !== id; });
  }

  // Idempotent weekly routine generator: creates missing homework in [today .. today+6] once per routineId+due.
  function spawnWeekRoutines(data, todayStr, stampStr) {
    if (!E.isValidDate(todayStr)) return [];
    var created = [];
    var prevDay = E.addDays(todayStr, -1);
    (data.routines || []).forEach(function (r) {
      var targetDue = E.nextWeekday(prevDay, r.weekday);
      var exists = data.assignments.some(function (a) {
        return a.routineId === r.id && a.due === targetDue;
      });
      if (!exists) {
        var a = addAssignment(data, {
          title: r.title,
          due: targetDue,
          courseId: r.courseId,
          estMin: r.estMin,
          weight: 10,
          template: r.template,
          routineId: r.id
        }, stampStr || '');
        if (a) created.push(a);
      }
    });
    return created;
  }

  // fields: {title, due, courseId, weight, estMin, template, routineId, packed}
  function addAssignment(data, f, stampStr) {
    var title = cleanText(f.title, 120);
    if (!title || !E.isValidDate(f.due)) return null;
    var a = {
      id: E.uid('a'),
      courseId: data.courses.some(function (c) { return c.id === f.courseId; }) ? f.courseId : '',
      routineId: cleanText(f.routineId, 60),
      title: title,
      due: f.due,
      weight: clampInt(f.weight, 0, 100, 0),
      estMin: clampInt(f.estMin, 0, 6000, 45),
      manualMin: 0,
      packed: !!f.packed,
      steps: f.template ? E.makeSteps(f.template) : [],
      status: 'todo',
      rescue: '',
      createdAt: stampStr || '',
      completedAt: ''
    };
    data.assignments.push(a);
    return a;
  }

  function updateAssignment(data, id, f) {
    var a = findA(data, id);
    if (!a) return false;
    if (f.title !== undefined) { var t = cleanText(f.title, 120); if (t) a.title = t; }
    if (f.due !== undefined && E.isValidDate(f.due)) a.due = f.due;
    if (f.weight !== undefined) a.weight = clampInt(f.weight, 0, 100, a.weight);
    if (f.estMin !== undefined) a.estMin = clampInt(f.estMin, 0, 6000, a.estMin);
    if (f.courseId !== undefined) a.courseId = data.courses.some(function (c) { return c.id === f.courseId; }) ? f.courseId : '';
    if (f.packed !== undefined) a.packed = !!f.packed;
    return true;
  }

  function togglePacked(data, id) {
    var a = findA(data, id);
    if (!a) return null;
    a.packed = !a.packed;
    return a.packed;
  }

  function deleteAssignment(data, id) {
    data.assignments = data.assignments.filter(function (a) { return a.id !== id; });
    data.sprints = data.sprints.filter(function (s) { return s.assignmentId !== id; });
  }

  function addStep(data, id, text) {
    var a = findA(data, id); var t = cleanText(text, 200);
    if (!a || !t) return null;
    var s = { id: E.uid('st'), text: t, done: false };
    a.steps.push(s);
    return s;
  }

  function toggleStep(data, aid, sid) {
    var a = findA(data, aid);
    if (!a) return false;
    var changed = false;
    a.steps.forEach(function (s) { if (s.id === sid) { s.done = !s.done; changed = true; } });
    if (changed && a.status === 'todo') a.status = 'doing';
    return changed;
  }

  function completeAssignment(data, id, stampStr) {
    var a = findA(data, id);
    if (!a || a.status === 'done') return false; // completing twice never re-stamps
    a.status = 'done';
    a.completedAt = stampStr;
    a.steps.forEach(function (s) { s.done = true; });
    return true;
  }

  function reopenAssignment(data, id) {
    var a = findA(data, id);
    if (!a || a.status !== 'done') return false;
    a.status = 'todo';
    a.completedAt = '';
    a.packed = false;
    return true;
  }

  // Idempotent by sprint id: logging the same sprint twice never double-counts.
  function logSprint(data, assignmentId, minutes, sprintId, date) {
    var a = findA(data, assignmentId);
    var m = clampInt(minutes, 0, 600, 0);
    if (!a || m <= 0) return null;
    var id = sprintId || E.uid('sp');
    for (var i = 0; i < data.sprints.length; i++) if (data.sprints[i].id === id) return data.sprints[i];
    var sp = { id: id, assignmentId: assignmentId, date: date, minutes: m };
    data.sprints.push(sp);
    if (a.status === 'todo') a.status = 'doing';
    return sp;
  }

  // Manual adjustment is stored separately from sprints, so editing it never touches sprint minutes.
  function setManualMinutes(data, id, minutes) {
    var a = findA(data, id);
    if (!a) return false;
    a.manualMin = clampInt(minutes, 0, 6000, 0);
    return true;
  }

  // action: 'now' | 'extension' | 'letgo'; newDue is required for 'extension'.
  function setRescue(data, id, action, newDue) {
    var a = findA(data, id);
    if (!a) return false;
    if (action === 'now') { a.rescue = 'now'; return true; }
    if (action === 'extension') {
      if (!E.isValidDate(newDue)) return false;
      a.due = newDue; a.rescue = 'extension'; return true;
    }
    if (action === 'letgo') { a.status = 'dropped'; a.rescue = 'letgo'; return true; }
    return false;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION, COURSE_COLORS: COURSE_COLORS,
    defaultData: defaultData, defaultSettings: defaultSettings, sanitize: sanitize,
    load: load, save: save, exportJSON: exportJSON, importJSON: importJSON, stamp: stamp, findA: findA,
    addCourse: addCourse, deleteCourse: deleteCourse,
    addRoutine: addRoutine, deleteRoutine: deleteRoutine, spawnWeekRoutines: spawnWeekRoutines,
    addAssignment: addAssignment, updateAssignment: updateAssignment, togglePacked: togglePacked,
    deleteAssignment: deleteAssignment, addStep: addStep, toggleStep: toggleStep,
    completeAssignment: completeAssignment, reopenAssignment: reopenAssignment,
    logSprint: logSprint, setManualMinutes: setManualMinutes, setRescue: setRescue
  };
});
