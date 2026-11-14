/**
 * Homework Planner — Edition 1 UI controller (Sage Calm, bottom-tab layout).
 * All math lives in HPEngine, all state changes in HPStorage. This file only renders and wires events.
 */
(function () {
  'use strict';

  var E = window.HPEngine;
  var S = window.HPStorage;
  var CFG = window.HPConfig;
  var T = window.HPTutorial;

  var data = S.load(window.localStorage, CFG.storageKey);
  var activeTab = CFG.defaultTab;
  var taskFilter = 'open';
  var detailId = null;
  var confirmAction = null;
  var qa = { due: 'tomorrow', est: 45 };
  var sprint = null; // { assignmentId, id, totalSec, elapsedSec, running, timer }
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function today() { return E.todayStr(new Date()); }
  function esc(s) { return E.escapeHtml(s); }
  function commit() { S.save(window.localStorage, CFG.storageKey, data); }
  function courseOf(a) { for (var i = 0; i < data.courses.length; i++) if (data.courses[i].id === a.courseId) return data.courses[i]; return null; }
  function ctxNow() { return E.buildCtx(data, today()); }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function beep(freq, ms) {
    if (!data.settings.sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.frequency.value = freq || 660;
      g.gain.value = 0.08;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(function () { o.stop(); ctx.close(); }, ms || 180);
    } catch (e) { /* audio is optional */ }
  }

  // ---------- Navigation ----------
  function switchTab(tab) {
    if (CFG.tabs.indexOf(tab) < 0) tab = CFG.defaultTab;
    activeTab = tab;
    CFG.tabs.forEach(function (t) {
      var s = $('screen-' + t);
      if (s) s.classList.toggle('active', t === tab);
    });
    var btns = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].getAttribute('data-tab') === tab);
    renderAll();
  }
  window.switchTab = switchTab;

  // ---------- Modals ----------
  function openModal(id) {
    var m = $(id);
    if (m) m.classList.add('open');
  }
  function closeModal(id) {
    var m = $(id);
    if (!m || !m.classList.contains('open')) return;
    m.classList.remove('open');
    if (id === 'modal-assignment-detail') detailId = null;
    renderAll();
    T.emit('modal-closed');
  }

  // ---------- Rendering ----------
  function startByInfo(a) {
    var c = ctxNow();
    var sb = E.startBy(a, c);
    var diff = E.daysBetween(c.today, sb);
    if (diff < 0) return { text: 'Start-By date passed. A quick 15-min sprint gets you moving.', now: true };
    if (diff === 0) return { text: 'Start tonight. A short sprint is plenty to begin.', now: true };
    return { text: 'Start by ' + E.prettyDate(sb) + ' (in ' + E.plural(diff, 'day') + ')', now: false };
  }

  function dueTag(a) {
    var lbl = E.dueLabel(a.due, today());
    var overdue = E.daysBetween(today(), a.due) < 0;
    return '<span class="tag ' + (overdue ? 'overdue' : '') + '">' + esc(lbl) + '</span>';
  }

  function courseTag(a) {
    var c = courseOf(a);
    return c ? '<span class="tag"><span class="dot" style="background:' + esc(c.color) + '"></span>' + esc(c.name) + '</span>' : '';
  }

  function renderHero() {
    var host = $('hero-next');
    var a = E.doThisNext(data, today());
    if (!a) {
      host.innerHTML = '<div class="empty"><strong>Nothing needs you tonight.</strong>' +
        (data.assignments.length ? 'All homework is finished or handled. Take a real break.' : 'Add your first homework item below. Just a title is enough.') + '</div>';
      return;
    }
    var sbi = startByInfo(a);
    var actual = E.actualMinutes(a, data.sprints);
    var rem = E.remainingMinutes(a, data.sprints);
    var step = E.nextStepOf(a);
    var prog = E.stepProgress(a);
    host.innerHTML =
      '<div class="hero-eyebrow"><span>Up first tonight</span>' + (a.steps.length ? '<span>' + prog + '% done</span>' : '') + '</div>' +
      '<div class="hero-title">' + esc(a.title) + '</div>' +
      '<div class="hero-meta">' + dueTag(a) + courseTag(a) + (a.weight ? '<span class="tag">Impact ' + a.weight + '%</span>' : '') + '</div>' +
      '<div class="hero-startby ' + (sbi.now ? 'now' : '') + '">' + esc(sbi.text) + '</div>' +
      '<div class="hero-times">Guess ' + E.fmtMin(a.estMin) + ' · Logged ' + E.fmtMin(actual) + ' · About ' + E.fmtMin(rem) + ' left</div>' +
      (a.steps.length ? '<div class="progress" aria-label="Progress ' + prog + ' percent"><i style="width:' + prog + '%"></i></div>' : '') +
      (step ? '<div class="next-step"><button id="btn-hero-step" class="check" type="button" data-act="hero-step" data-id="' + a.id + '" data-step="' + step.id + '" aria-label="Mark step done"></button><div><div class="label">Tiny next step</div><div class="text">' + esc(step.text) + '</div></div></div>' : '') +
      '<div class="hero-actions">' +
      '<button id="btn-hero-sprint" class="btn btn-primary" type="button" data-act="sprint" data-id="' + a.id + '" data-min="15">15-min sprint</button>' +
      '<button class="btn btn-secondary" type="button" data-act="sprint" data-id="' + a.id + '" data-min="25">25-min</button>' +
      '<button id="btn-hero-done" class="btn btn-ghost" type="button" data-act="complete" data-id="' + a.id + '">Finished</button>' +
      '<button id="btn-hero-detail" class="btn btn-ghost" type="button" data-act="detail" data-id="' + a.id + '">Details</button>' +
      '</div>';
  }

  function renderBackpack() {
    var host = $('backpack-bar');
    var bp = E.backpackStatus(data, today());
    if (!bp.totalDoneDueSoon) { host.style.display = 'none'; host.innerHTML = ''; return; }
    host.style.display = 'block';
    if (!bp.needPack.length) {
      host.innerHTML = '<div class="card-title" style="margin-bottom:4px;"><span>Backpack ready check</span><span class="tag ok">All ' + bp.packedCount + ' packed</span></div>' +
        '<p class="muted" style="font-size:0.86rem;">Every finished homework item for today or tomorrow is packed and ready to turn in.</p>';
      return;
    }
    host.innerHTML = '<div class="card-title"><span>Backpack ready check</span><span class="tag overdue">' + E.plural(bp.needPack.length, 'item') + ' to pack</span></div>' +
      bp.needPack.map(function (a) {
        return '<div class="pack-row"><div class="pack-info"><div class="pack-title">' + esc(a.title) + '</div><div class="row-sub">' + esc(E.dueLabel(a.due, today())) + ' · Finished, not packed yet</div></div>' +
          '<button class="btn btn-secondary btn-sm" type="button" data-act="toggle-packed" data-id="' + a.id + '">Pack in bag</button></div>';
      }).join('');
  }

  function rowHtml(a) {
    var sb = E.startBy(a, ctxNow());
    var sub = a.status === 'done'
      ? ('Finished ' + esc(String(a.completedAt).slice(0, 10)) + (a.packed ? ' · Packed' : ''))
      : ('Start by ' + E.prettyDate(sb));
    var rightBadge = '';
    if (a.status === 'done') {
      if (E.daysBetween(today(), a.due) >= 0) {
        rightBadge = '<button class="tag ' + (a.packed ? 'ok' : '') + '" style="border:0;cursor:pointer;" type="button" data-act="toggle-packed" data-id="' + a.id + '">' + (a.packed ? 'Packed ✓' : 'Pack?') + '</button>';
      }
    } else {
      rightBadge = dueTag(a);
    }
    return '<div class="row" tabindex="0" role="button" data-act="detail" data-id="' + a.id + '">' +
      '<button class="check ' + (a.status === 'done' ? 'done' : '') + '" type="button" data-act="' + (a.status === 'done' ? 'reopen' : 'complete') + '" data-id="' + a.id + '" aria-label="' + (a.status === 'done' ? 'Reopen' : 'Mark finished') + '">' + (a.status === 'done' ? '✓' : '') + '</button>' +
      '<div class="row-main"><div class="row-title">' + esc(a.title) + '</div><div class="row-sub">' + esc(sub) + '</div></div>' +
      rightBadge + '</div>';
  }

  function renderUpcoming() {
    var ranked = E.rankOpen(data, today());
    var hero = ranked[0];
    var rest = ranked.slice(1, 5);
    var load = E.tonightMinutes(data, today());
    var cap = data.settings.dailyCapacityMin;
    var loadEl = $('tonight-load');
    loadEl.textContent = E.fmtMin(load) + ' / ' + E.fmtMin(cap) + ' tonight';
    loadEl.className = 'tag ' + (load > cap ? 'overdue' : 'ok');
    var host = $('upcoming-list');
    if (!hero) { host.innerHTML = '<div class="empty">Nothing queued for tonight.</div>'; return; }
    host.innerHTML = rest.length ? rest.map(rowHtml).join('') : '<div class="empty">That is your only open homework. You have this.</div>';
  }

  function renderStats() {
    var st = E.stats(data, today());
    $('stat-open').textContent = st.open;
    $('stat-week').textContent = st.thisWeek;
    $('stat-done').textContent = st.done;
    var streak = E.completionStreak(data, today());
    $('badge-streak').textContent = streak + '-day streak';
  }

  function renderNudge() {
    var n = E.rescueCandidates(data, today()).length;
    var host = $('rescue-nudge');
    if (!n) { host.style.display = 'none'; return; }
    host.style.display = 'flex';
    host.innerHTML = '<span>' + E.plural(n, 'homework item') + ' slipped. No stress. Catch-Up Mode can sort it in a minute.</span>' +
      '<button class="btn btn-sm btn-secondary" type="button" data-act="goto" data-tab="rescue">Open</button>';
  }

  function renderTasks() {
    var host = $('task-list');
    var chips = document.querySelectorAll('#task-filter .chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('selected', chips[i].getAttribute('data-filter') === taskFilter);
    if (taskFilter === 'done') {
      var done = data.assignments.filter(function (a) { return a.status === 'done'; })
        .sort(function (x, y) { return String(y.completedAt).localeCompare(String(x.completedAt)); });
      host.innerHTML = done.length ? '<div class="list">' + done.map(rowHtml).join('') + '</div>' : '<div class="empty"><strong>No finished homework yet.</strong>Your first win will show up here.</div>';
      return;
    }
    var ranked = E.rankOpen(data, today());
    if (!ranked.length) { host.innerHTML = '<div class="empty"><strong>All clear.</strong>Add homework to get started.</div>'; return; }
    var groups = [['overdue', 'Slipped (no stress)'], ['today', 'Due today'], ['week', 'This week'], ['later', 'Later']];
    var html = '';
    groups.forEach(function (g) {
      var items = ranked.filter(function (a) { return E.bucketOf(a, today()) === g[0]; });
      if (items.length) html += '<div class="group-title">' + g[1] + '</div><div class="list">' + items.map(rowHtml).join('') + '</div>';
    });
    host.innerHTML = html;
  }

  function renderSubjects() {
    var host = $('course-list');
    if (!data.courses.length) {
      host.innerHTML = '<div class="empty card"><strong>No subjects yet.</strong>Add a class above to color-code your homework.</div>';
    } else {
      host.innerHTML = data.courses.map(function (c) {
        var mine = data.assignments.filter(function (a) { return a.courseId === c.id; });
        var open = mine.filter(E.isOpen).length;
        var done = mine.filter(function (a) { return a.status === 'done'; }).length;
        return '<div class="card course-card"><span class="dot" style="background:' + esc(c.color) + ';width:14px;height:14px"></span>' +
          '<div class="row-main"><div class="row-title">' + esc(c.name) + '</div><div class="row-sub">' + open + ' open · ' + done + ' finished</div></div>' +
          '<button class="btn btn-sm btn-ghost" type="button" data-act="del-course" data-id="' + c.id + '">Remove</button></div>';
      }).join('');
    }

    $('routine-course').innerHTML = '<option value="">No subject</option>' + data.courses.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    }).join('');
    $('routine-template').innerHTML = '<option value="">No steps (single item)</option>' + Object.keys(E.STEP_TEMPLATES).map(function (k) {
      return '<option value="' + k + '">' + esc(E.STEP_TEMPLATES[k].label) + '</option>';
    }).join('');

    var rHost = $('routine-list');
    if (!data.routines.length) {
      rHost.innerHTML = '<div class="muted" style="font-size:0.85rem;">No weekly routines saved yet.</div>';
    } else {
      rHost.innerHTML = data.routines.map(function (r) {
        var c = courseOf(r);
        var cname = c ? c.name + ' · ' : '';
        return '<div class="routine-row"><div class="row-main"><div class="row-title">' + esc(r.title) + '</div>' +
          '<div class="row-sub">' + esc(cname) + 'Every ' + esc(E.weekdayName(r.weekday)) + ' · ' + E.fmtMin(r.estMin) + '</div></div>' +
          '<button class="btn btn-sm btn-ghost" type="button" data-act="del-routine" data-id="' + r.id + '">Remove</button></div>';
      }).join('');
    }
  }

  function renderRescue() {
    var host = $('rescue-list');
    var list = E.rescueCandidates(data, today());
    if (!list.length) { host.innerHTML = '<div class="empty card"><strong>All caught up.</strong>Nothing is behind. Catch-Up Mode waits quietly here if you ever need it.</div>'; return; }
    host.innerHTML = list.map(function (a) {
      var defDue = E.addDays(today(), 3);
      return '<div class="card rescue-card"><div class="rescue-title">' + esc(a.title) + '</div>' +
        '<div class="row-sub">' + esc(E.dueLabel(a.due, today())) + ' · about ' + E.fmtMin(E.remainingMinutes(a, data.sprints)) + ' left</div>' +
        '<div class="rescue-actions">' +
        '<button class="btn btn-primary" type="button" data-act="rescue-now" data-id="' + a.id + '">Do tonight</button>' +
        '<button class="btn btn-secondary" type="button" data-act="rescue-ext" data-id="' + a.id + '">Ask extension</button>' +
        '<button class="btn btn-ghost" type="button" data-act="rescue-letgo" data-id="' + a.id + '">Use late pass</button></div>' +
        '<div class="rescue-ext"><span class="row-sub">New due date:</span><input class="input" type="date" id="resc-date-' + a.id + '" value="' + defDue + '"></div></div>';
    }).join('');
  }

  function renderSettings() {
    $('set-capacity').value = data.settings.dailyCapacityMin;
    $('set-weekends').checked = !!data.settings.skipWeekends;
    $('set-sound').checked = !!data.settings.sound;
    var f = E.fudgeFactor(data.assignments, data.sprints);
    $('fudge-note').textContent = 'Reality check: your time guesses are multiplied by ' + f.toFixed(2) + ' when planning Start-By dates. It calibrates automatically as you finish homework.';
    var host = $('theme-picker');
    var current = data.settings.theme || CFG.themes[0].id;
    host.innerHTML = CFG.themes.map(function (t) {
      return '<button type="button" class="chip ' + (t.id === current ? 'selected' : '') + '" data-act="theme" data-theme-id="' + t.id + '">' + esc(t.label) + '</button>';
    }).join('');
  }

  function renderDetail() {
    var host = $('detail-body');
    var a = detailId ? S.findA(data, detailId) : null;
    if (!a) { host.innerHTML = ''; return; }
    var actual = E.actualMinutes(a, data.sprints);
    var sbi = startByInfo(a);
    $('detail-title-h').textContent = a.title;
    var courseOpts = '<option value="">No subject</option>' + data.courses.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === a.courseId ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var tmplOpts = '<option value="">Add steps from a template...</option>' + Object.keys(E.STEP_TEMPLATES).map(function (k) {
      return '<option value="' + k + '">' + esc(E.STEP_TEMPLATES[k].label) + '</option>';
    }).join('');
    var steps = a.steps.length ? a.steps.map(function (s) {
      return '<div class="step-row ' + (s.done ? 'done' : '') + '"><button class="check sm ' + (s.done ? 'done' : '') + '" type="button" data-act="toggle-step" data-id="' + a.id + '" data-step="' + s.id + '" aria-label="Toggle step">' + (s.done ? '✓' : '') + '</button><div class="text">' + esc(s.text) + '</div></div>';
    }).join('') : '<p class="muted">No steps yet. Big homework feels lighter when broken into 2-minute steps.</p>';
    host.innerHTML =
      '<div class="detail-block"><div class="hero-meta">' + dueTag(a) + courseTag(a) + '<span class="tag">' + esc(a.status) + '</span>' + (a.status === 'done' ? '<span class="tag ' + (a.packed ? 'ok' : '') + '">' + (a.packed ? 'Packed in bag' : 'Not packed yet') + '</span>' : '') + '</div>' +
      '<div class="hero-startby ' + (sbi.now ? 'now' : '') + '">' + esc(a.status === 'done' ? 'Finished. Nicely done.' : sbi.text) + '</div></div>' +
      '<div class="detail-block"><h4>Steps · ' + E.stepProgress(a) + '%</h4>' + steps +
      '<div class="inline-form" style="margin-top:8px"><input id="detail-new-step" class="input" type="text" maxlength="200" placeholder="Add a small step"><button class="btn btn-secondary" type="button" data-act="add-step" data-id="' + a.id + '">Add</button></div>' +
      '<div class="inline-form" style="margin-top:8px"><select id="detail-template" class="input">' + tmplOpts + '</select><button class="btn btn-secondary" type="button" data-act="apply-template" data-id="' + a.id + '">Apply</button></div></div>' +
      '<div class="detail-block"><h4>Reality check</h4><div class="reality">Guess ' + E.fmtMin(a.estMin) + ' · Logged ' + E.fmtMin(actual) + ' (' + E.fmtMin(E.sprintMinutes(a.id, data.sprints)) + ' in sprints + ' + E.fmtMin(a.manualMin) + ' added by hand)</div>' +
      '<div class="inline-form" style="margin-top:8px"><input id="detail-manual" class="input" type="number" min="0" max="6000" step="5" value="' + a.manualMin + '" aria-label="Minutes added by hand"><button class="btn btn-secondary" type="button" data-act="save-manual" data-id="' + a.id + '">Save minutes</button></div></div>' +
      '<div class="detail-block"><h4>Edit</h4>' +
      '<label class="field"><span>Title</span><input id="detail-edit-title" class="input" type="text" maxlength="120" value="' + esc(a.title) + '"></label>' +
      '<div class="grid-2"><label class="field"><span>Due date</span><input id="detail-edit-due" class="input" type="date" value="' + a.due + '"></label>' +
      '<label class="field"><span>Estimate (min)</span><input id="detail-edit-est" class="input" type="number" min="0" max="6000" step="5" value="' + a.estMin + '"></label></div>' +
      '<div class="grid-2"><label class="field"><span>Subject</span><select id="detail-edit-course" class="input">' + courseOpts + '</select></label>' +
      '<label class="field"><span>Grade impact (%)</span><input id="detail-edit-weight" class="input" type="number" min="0" max="100" value="' + a.weight + '"></label></div>' +
      '<div class="row-actions wrap"><button class="btn btn-primary" type="button" data-act="save-edit" data-id="' + a.id + '">Save changes</button>' +
      (a.status === 'done'
        ? '<button class="btn btn-secondary" type="button" data-act="toggle-packed" data-id="' + a.id + '">' + (a.packed ? 'Mark unpacked' : 'Pack in bag') + '</button><button class="btn btn-secondary" type="button" data-act="reopen" data-id="' + a.id + '">Reopen</button>'
        : '<button class="btn btn-secondary" type="button" data-act="complete" data-id="' + a.id + '">Mark finished</button><button class="btn btn-secondary" type="button" data-act="sprint" data-id="' + a.id + '" data-min="15">Sprint 15</button>') +
      '<button class="btn btn-danger-soft" type="button" data-act="delete" data-id="' + a.id + '">Delete</button></div></div>';
  }

  function renderAll() {
    renderStats();
    if (activeTab === 'tonight') { renderHero(); renderBackpack(); renderUpcoming(); renderNudge(); }
    if (activeTab === 'tasks') renderTasks();
    if (activeTab === 'subjects') renderSubjects();
    if (activeTab === 'rescue') renderRescue();
    if (activeTab === 'settings') renderSettings();
    if (detailId) renderDetail();
    document.body.classList.toggle('fog', !!data.settings.fog);
    var fb = $('btn-toggle-fog');
    fb.setAttribute('aria-pressed', data.settings.fog ? 'true' : 'false');
    fb.textContent = data.settings.fog ? 'Fog Mode: on' : 'Fog Mode';
    document.body.setAttribute('data-theme', data.settings.theme || CFG.themes[0].id);
  }

  // ---------- Form helpers ----------
  function resolveQuickDue(key) {
    var t = today();
    if (key === 'today') return t;
    if (key === 'tomorrow') return E.addDays(t, 1);
    if (key === 'friday') return E.nextWeekday(E.addDays(t, -1), 5);
    return E.addDays(t, 7);
  }

  function fillAddModal() {
    $('add-title').value = '';
    $('add-due').value = E.addDays(today(), 2);
    $('add-est').value = 45;
    $('add-weight').value = 10;
    $('add-error').textContent = '';
    $('add-course').innerHTML = '<option value="">No subject</option>' + data.courses.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    }).join('');
    $('add-template').innerHTML = '<option value="">No, keep as one task</option>' + Object.keys(E.STEP_TEMPLATES).map(function (k) {
      return '<option value="' + k + '">' + esc(E.STEP_TEMPLATES[k].label) + '</option>';
    }).join('');
  }

  function afterAdd(a) {
    commit();
    toast('Added "' + a.title + '". Ready when you are.');
    T.emit('assignment-added');
    renderAll();
  }

  function quickAdd() {
    var title = $('qa-title').value;
    var a = S.addAssignment(data, { title: title, due: resolveQuickDue(qa.due), estMin: qa.est, weight: 10 }, S.stamp());
    if (!a) { toast('Type a homework title first.'); $('qa-title').focus(); return; }
    $('qa-title').value = '';
    afterAdd(a);
  }

  function saveFromModal() {
    var a = S.addAssignment(data, {
      title: $('add-title').value, due: $('add-due').value, estMin: $('add-est').value,
      courseId: $('add-course').value, weight: $('add-weight').value, template: $('add-template').value
    }, S.stamp());
    if (!a) {
      $('add-error').textContent = !String($('add-title').value).trim() ? 'Please give it a name.' : 'Please pick a valid due date.';
      return;
    }
    closeModal('modal-add-assignment');
    afterAdd(a);
  }

  // ---------- Sprint ----------
  function fmtClock(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function startSprint(id, minutes) {
    var a = S.findA(data, id);
    if (!a) return;
    if (sprint) { toast('A sprint is already running. Finish it first.'); return; }
    sprint = { assignmentId: id, id: E.uid('sp'), totalSec: minutes * 60, elapsedSec: 0, running: true, timer: null };
    $('sprint-title').textContent = a.title;
    $('hud-sprint').style.display = 'flex';
    $('btn-pause-sprint').textContent = 'Pause';
    sprint.timer = setInterval(tickSprint, 1000);
    paintSprint();
    beep(520, 120);
  }

  function paintSprint() {
    if (!sprint) return;
    var left = Math.max(0, sprint.totalSec - sprint.elapsedSec);
    $('sprint-digits').textContent = fmtClock(left);
    $('sprint-bar').style.width = (sprint.totalSec > 0 ? (left / sprint.totalSec) * 100 : 0) + '%';
  }

  function tickSprint() {
    if (!sprint || !sprint.running) return;
    sprint.elapsedSec++;
    paintSprint();
    if (sprint.elapsedSec >= sprint.totalSec) endSprint(true);
  }

  function endSprint(natural) {
    if (!sprint) return;
    clearInterval(sprint.timer);
    var s = sprint;
    sprint = null; // cleared first => a sprint can never be logged twice
    $('hud-sprint').style.display = 'none';
    var minutes = Math.round(s.elapsedSec / 60);
    if (minutes < 1 && s.elapsedSec >= 30) minutes = 1;
    if (minutes >= 1) {
      S.logSprint(data, s.assignmentId, minutes, s.id, today());
      commit();
      toast((natural ? 'Sprint complete! ' : 'Logged ') + E.fmtMin(minutes) + '. Real progress.');
      if (natural) beep(880, 300);
    } else {
      toast('Too short to log. Try again when ready.');
    }
    renderAll();
  }

  // ---------- Actions ----------
  function doComplete(id) {
    if (S.completeAssignment(data, id, S.stamp())) {
      commit();
      beep(740, 160);
      toast('Finished! Remember to pack or upload it.');
      renderAll();
    }
  }

  function askConfirm(text, fn) {
    $('confirm-text').textContent = text;
    confirmAction = fn;
    openModal('modal-confirm');
  }

  function handleAction(node) {
    var act = node.getAttribute('data-act');
    var id = node.getAttribute('data-id');
    switch (act) {
      case 'detail': detailId = id; renderDetail(); openModal('modal-assignment-detail'); break;
      case 'complete': doComplete(id); break;
      case 'reopen': S.reopenAssignment(data, id); commit(); renderAll(); break;
      case 'toggle-packed': {
        var packed = S.togglePacked(data, id);
        if (packed !== null) {
          commit();
          beep(680, 90);
          toast(packed ? 'Packed in bag and ready.' : 'Moved back to unpack list.');
          renderAll();
        }
        break;
      }
      case 'hero-step':
      case 'toggle-step': S.toggleStep(data, id, node.getAttribute('data-step')); commit(); renderAll(); break;
      case 'sprint': startSprint(id, parseInt(node.getAttribute('data-min'), 10) || 15); break;
      case 'goto': switchTab(node.getAttribute('data-tab')); break;
      case 'theme': data.settings.theme = node.getAttribute('data-theme-id'); commit(); renderAll(); break;
      case 'add-step': {
        var inp = $('detail-new-step');
        if (S.addStep(data, id, inp.value)) { commit(); renderAll(); $('detail-new-step').focus(); } else { toast('Type the step first.'); }
        break;
      }
      case 'apply-template': {
        var key = $('detail-template').value;
        var a = S.findA(data, id);
        if (a && key) { E.makeSteps(key).forEach(function (st) { a.steps.push(st); }); commit(); renderAll(); toast('Steps added.'); }
        break;
      }
      case 'save-manual': S.setManualMinutes(data, id, $('detail-manual').value); commit(); renderAll(); toast('Minutes saved.'); break;
      case 'save-edit':
        if (S.updateAssignment(data, id, { title: $('detail-edit-title').value, due: $('detail-edit-due').value, estMin: $('detail-edit-est').value, courseId: $('detail-edit-course').value, weight: $('detail-edit-weight').value })) {
          commit(); renderAll(); toast('Saved.');
        }
        break;
      case 'delete':
        askConfirm('This removes the homework item and its logged sprints from this device.', function () {
          S.deleteAssignment(data, id); commit(); closeModal('modal-assignment-detail'); toast('Deleted.');
        });
        break;
      case 'del-course':
        askConfirm('Remove this subject? Existing homework stays, just without a subject tag.', function () { S.deleteCourse(data, id); commit(); renderAll(); });
        break;
      case 'del-routine':
        S.deleteRoutine(data, id); commit(); renderAll(); toast('Routine removed.');
        break;
      case 'rescue-now': S.setRescue(data, id, 'now'); commit(); toast('Moved to top of Tonight.'); switchTab('tonight'); break;
      case 'rescue-ext': {
        var d = $('resc-date-' + id);
        if (d && S.setRescue(data, id, 'extension', d.value)) { commit(); toast('New due date saved.'); renderAll(); }
        else toast('Pick a valid new date first.');
        break;
      }
      case 'rescue-letgo':
        askConfirm('Use a late pass or drop this item? It moves out of your open homework list.', function () { S.setRescue(data, id, 'letgo'); commit(); renderAll(); toast('Handled kindly. Keep moving forward.'); });
        break;
      default: break;
    }
  }

  // ---------- Wiring ----------
  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      var closer = t.closest('[data-close-modal]');
      if (closer) { closeModal(closer.getAttribute('data-close-modal')); return; }
      var opener = t.closest('[data-open-modal]');
      if (opener) {
        var mid = opener.getAttribute('data-open-modal');
        if (mid === 'modal-add-assignment') fillAddModal();
        openModal(mid);
        return;
      }
      if (t.classList && t.classList.contains('app-modal')) { closeModal(t.id); return; }
      var tab = t.closest('.nav-btn');
      if (tab) { switchTab(tab.getAttribute('data-tab')); return; }
      var due = t.closest('#qa-due .chip');
      if (due) { qa.due = due.getAttribute('data-due'); markChips('qa-due', due); return; }
      var est = t.closest('#qa-est .chip');
      if (est) { qa.est = parseInt(est.getAttribute('data-est'), 10); markChips('qa-est', est); return; }
      var filt = t.closest('#task-filter .chip');
      if (filt) { taskFilter = filt.getAttribute('data-filter'); renderTasks(); return; }
      var actNode = t.closest('[data-act]');
      if (actNode) {
        e.stopPropagation();
        handleAction(actNode);
      }
    });

    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('row')) {
        e.preventDefault();
        handleAction(e.target);
      }
      if (e.key === 'Enter' && e.target.id === 'qa-title') quickAdd();
      if (e.key === 'Escape') {
        var open = document.querySelector('.app-modal.open');
        if (open && !T.isActive()) closeModal(open.id);
      }
    });

    $('btn-qa-add').addEventListener('click', quickAdd);
    $('btn-save-assignment').addEventListener('click', saveFromModal);
    $('btn-confirm-yes').addEventListener('click', function () {
      var fn = confirmAction; confirmAction = null;
      closeModal('modal-confirm');
      if (fn) fn();
    });
    $('btn-toggle-fog').addEventListener('click', function () {
      data.settings.fog = !data.settings.fog; commit(); renderAll(); T.emit('fog-toggled');
    });
    $('btn-pause-sprint').addEventListener('click', function () {
      if (!sprint) return;
      sprint.running = !sprint.running;
      $('btn-pause-sprint').textContent = sprint.running ? 'Pause' : 'Resume';
    });
    $('btn-stop-sprint').addEventListener('click', function () { endSprint(false); });

    $('btn-add-course').addEventListener('click', function () {
      var c = S.addCourse(data, $('course-name').value);
      if (c) { $('course-name').value = ''; commit(); renderAll(); toast('Subject added.'); } else { toast('Type a subject name first.'); }
    });
    $('course-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('btn-add-course').click(); });

    $('btn-add-routine').addEventListener('click', function () {
      var r = S.addRoutine(data, {
        title: $('routine-title').value,
        courseId: $('routine-course').value,
        weekday: $('routine-day').value,
        estMin: $('routine-est').value,
        template: $('routine-template').value
      });
      if (r) { $('routine-title').value = ''; commit(); renderAll(); toast('Weekly routine saved.'); }
      else { toast('Type a homework title for the routine.'); $('routine-title').focus(); }
    });
    $('btn-spawn-routines').addEventListener('click', function () {
      if (!data.routines.length) { toast('Save a weekly routine below first.'); return; }
      var created = S.spawnWeekRoutines(data, today(), S.stamp());
      commit();
      renderAll();
      toast(created.length ? 'Added ' + E.plural(created.length, 'homework item') + ' for this week.' : 'This week is already loaded.');
    });

    $('set-capacity').addEventListener('change', function () {
      var n = Math.round(Number($('set-capacity').value));
      data.settings.dailyCapacityMin = isFinite(n) ? Math.min(720, Math.max(15, n)) : 90;
      commit(); renderAll();
    });
    $('set-weekends').addEventListener('change', function () { data.settings.skipWeekends = $('set-weekends').checked; commit(); renderAll(); });
    $('set-sound').addEventListener('change', function () { data.settings.sound = $('set-sound').checked; commit(); });

    $('btn-export-json').addEventListener('click', function () {
      var blob = new Blob([S.exportJSON(data)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url; link.download = 'homework-planner-backup-' + today() + '.json';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      toast('Backup downloaded.');
    });
    $('btn-import-json').addEventListener('click', function () { $('file-import').click(); });
    $('file-import').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { data = S.importJSON(String(reader.result)); commit(); renderAll(); toast('Backup restored.'); }
        catch (err) { toast('That file is not a Homework Planner backup.'); }
      };
      reader.readAsText(f);
      e.target.value = '';
    });
    $('btn-reset-data').addEventListener('click', function () {
      askConfirm('This erases every homework item, subject, routine and sprint on this device. Export a backup first if unsure.', function () {
        data = S.defaultData(); commit(); renderAll(); toast('All data erased.');
      });
    });
    $('btn-restart-tour').addEventListener('click', function () { switchTab('tonight'); T.start(); });

    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderAll(); });
  }

  function markChips(groupId, node) {
    var chips = document.querySelectorAll('#' + groupId + ' .chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('selected', chips[i] === node);
  }

  function init() {
    T.init({
      config: CFG,
      switchTab: switchTab,
      onEnd: function () { data.settings.onboarded = true; commit(); switchTab('tonight'); }
    });
    wire();
    switchTab(CFG.defaultTab);
    if (!data.settings.onboarded) setTimeout(function () { if (!T.isActive()) T.start(); }, 600);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
    }
  }

  window.HPApp = { getData: function () { return data; }, commit: commit, renderAll: renderAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
