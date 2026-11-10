/**
 * ADHD Student Planner — Application Controller & DOM Orchestration
 * Sensory-friendly, low-friction interactions, audio dopamine cues, and live recalculations.
 */

(function () {
  'use strict';

  let state = null;
  let activeCourseFilter = 'all';
  let sprintInterval = null;
  let sprintRemainingSeconds = 20 * 60;
  let sprintIsRunning = false;
  let activeSprintAssignmentId = null;

  // Web Audio Context for sensory-friendly sound cues
  let audioCtx = null;
  function playGentleBell(type) {
    if (!state.settings.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const now = audioCtx.currentTime;
      if (type === 'milestone') {
        // High harmonic soft harp chime (F#5 -> A#5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(739.99, now);
        osc.frequency.exponentialRampToValueAtTime(932.33, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'sprint') {
        // Calming singing bowl tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.2);
      }
    } catch (e) {
      // Audio autoplay gracefully suppressed if not interacted
    }
  }

  function getTodayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function init() {
    state = window.StudentStorage.load();

    // Check & update streak
    const today = getTodayISO();
    const streakResult = window.StudentEngine.calculateStreak(
      state.profile.lastActiveDate,
      today,
      state.profile.studyStreak,
      state.profile.graceTokens
    );
    state.profile.studyStreak = streakResult.streak;
    state.profile.graceTokens = streakResult.graceTokens;
    state.profile.lastActiveDate = today;
    window.StudentStorage.save(state);

    applyTheme(state.settings.theme || 'sage-calm');
    setupEventListeners();
    setupNavigation();
    setupModals();
    renderAll();

    // Initialize onboarding
    if (window.StudentTutorial) {
      window.StudentTutorial.initTourHandlers();
      window.StudentTutorial.startTour(false);
    }
  }

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const select = document.getElementById('select-theme');
    if (select) select.value = theme;
  }

  function setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', function (e) {
        e.preventDefault();
        const targetTab = this.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });
  }

  function switchTab(tabId) {
    // Update active tab button
    document.querySelectorAll('.nav-tab').forEach(t => {
      if (t.getAttribute('data-tab') === tabId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    // Update active screen section
    document.querySelectorAll('.app-screen').forEach(s => {
      if (s.id === `screen-${tabId}`) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Expose switchTab globally for tour synchronization
  window.switchStudentTab = switchTab;

  function setupEventListeners() {
    // Fog Mode Toggle in Header
    const btnFog = document.getElementById('btn-toggle-fog');
    if (btnFog) {
      btnFog.addEventListener('click', function () {
        state.settings.fogMode = !state.settings.fogMode;
        window.StudentStorage.save(state);
        renderHeader();
        renderFocusHero();
        renderAssignments();
      });
    }

    // Restart Tour Button
    const btnRestartTour = document.getElementById('btn-restart-tour');
    if (btnRestartTour) {
      btnRestartTour.addEventListener('click', function () {
        switchTab('dashboard');
        if (window.StudentTutorial) {
          window.StudentTutorial.startTour(true);
        }
      });
    }

    // Theme selector
    const selectTheme = document.getElementById('select-theme');
    if (selectTheme) {
      selectTheme.addEventListener('change', function () {
        state.settings.theme = this.value;
        applyTheme(this.value);
        window.StudentStorage.save(state);
      });
    }

    // Sound toggle
    const chkSound = document.getElementById('chk-sound-enabled');
    if (chkSound) {
      chkSound.checked = state.settings.soundEnabled;
      chkSound.addEventListener('change', function () {
        state.settings.soundEnabled = this.checked;
        window.StudentStorage.save(state);
      });
    }

    // Focus Sprint Controls
    const btnHeroSprint = document.getElementById('btn-hero-sprint');
    if (btnHeroSprint) {
      btnHeroSprint.addEventListener('click', function () {
        const today = getTodayISO();
        const focus = window.StudentEngine.getSingleFocusAction(state.assignments, today, state.settings.fogMode);
        startSprint(focus.hasTask ? focus.assignmentId : null, 20);
      });
    }

    const btnPauseSprint = document.getElementById('btn-pause-sprint');
    if (btnPauseSprint) {
      btnPauseSprint.addEventListener('click', toggleSprintTimer);
    }

    const btnStopSprint = document.getElementById('btn-stop-sprint');
    if (btnStopSprint) {
      btnStopSprint.addEventListener('click', resetSprintTimer);
    }

    // Data Export & Import
    const btnExport = document.getElementById('btn-export-json');
    if (btnExport) {
      btnExport.addEventListener('click', function () {
        const json = window.StudentStorage.exportJSON(state);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `adhd-student-planner-backup-${getTodayISO()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    const inputImport = document.getElementById('input-import-file');
    if (inputImport) {
      inputImport.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (evt) {
          try {
            state = window.StudentStorage.importJSON(evt.target.result);
            renderAll();
            alert('Study planner restored successfully!');
          } catch (err) {
            alert('Invalid backup file. Please verify JSON format.');
          }
        };
        reader.readAsText(file);
      });
    }

    const btnResetData = document.getElementById('btn-reset-data');
    if (btnResetData) {
      btnResetData.addEventListener('click', function () {
        if (confirm('Reset to clean initial semester template? Your custom courses and tasks will be reset.')) {
          state = window.StudentStorage.reset();
          renderAll();
        }
      });
    }
  }

  function setupModals() {
    // Open modal buttons
    document.querySelectorAll('[data-open-modal]').forEach(btn => {
      btn.addEventListener('click', function () {
        const modalId = this.getAttribute('data-open-modal');
        openModal(modalId);
      });
    });

    // Close modal buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', function () {
        const modalId = this.getAttribute('data-close-modal');
        closeModal(modalId);
      });
    });

    // Modal background click
    document.querySelectorAll('.app-modal').forEach(modal => {
      modal.addEventListener('click', function (e) {
        if (e.target === this) {
          closeModal(this.id);
        }
      });
    });

    // Form Submissions
    setupFormAddAssignment();
    setupFormAddCourse();
    setupFormAddExam();
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  function setupFormAddAssignment() {
    const form = document.getElementById('form-add-assignment');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const title = document.getElementById('input-asg-title').value.trim();
      const courseId = document.getElementById('select-asg-course').value;
      const category = document.getElementById('select-asg-category').value;
      const dueDate = document.getElementById('input-asg-date').value;
      const isEssential = document.getElementById('chk-asg-essential').checked;
      const autoDechunk = document.getElementById('chk-asg-dechunk').checked;

      if (!title || !dueDate) {
        alert('Please provide assignment title and due date.');
        return;
      }

      let milestones = [];
      if (autoDechunk) {
        milestones = window.StudentEngine.dechunkAssignment(category, title);
      }

      const newAsg = {
        id: 'asg-' + Date.now(),
        courseId: courseId,
        title: title,
        category: category,
        dueDate: dueDate,
        dueTime: '23:59',
        score: null,
        maxScore: 100,
        isEssential: isEssential,
        completed: false,
        completedDate: null,
        dechunkedMilestones: milestones
      };

      state.assignments.push(newAsg);
      window.StudentStorage.save(state);
      form.reset();
      closeModal('modal-add-assignment');
      renderAll();
      playGentleBell('milestone');
    });
  }

  function setupFormAddCourse() {
    const form = document.getElementById('form-add-course');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const code = document.getElementById('input-course-code').value.trim();
      const name = document.getElementById('input-course-name').value.trim();
      const instructor = document.getElementById('input-course-instructor').value.trim();
      const schedule = document.getElementById('input-course-schedule').value.trim();
      const targetGrade = Number(document.getElementById('input-course-target').value) || 90;

      if (!code || !name) {
        alert('Please enter Course Code and Course Name.');
        return;
      }

      const colors = ['#2d5a44', '#3b82f6', '#d97706', '#7c3aed', '#059669', '#dc2626'];
      const chosenColor = colors[state.courses.length % colors.length];

      const newCourse = {
        id: 'course-' + Date.now(),
        code: code,
        name: name,
        color: chosenColor,
        instructor: instructor || 'Staff',
        room: '',
        scheduleDays: [],
        scheduleTime: schedule || 'TBD',
        targetGrade: targetGrade,
        weights: { assignments: 40, quizzes: 20, midterm: 20, final: 20 }
      };

      state.courses.push(newCourse);
      window.StudentStorage.save(state);
      form.reset();
      closeModal('modal-add-course');
      renderAll();
      playGentleBell('milestone');
    });
  }

  function setupFormAddExam() {
    const form = document.getElementById('form-add-exam');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const courseId = document.getElementById('select-exam-course').value;
      const title = document.getElementById('input-exam-title').value.trim();
      const date = document.getElementById('input-exam-date').value;
      const time = document.getElementById('input-exam-time').value.trim() || 'TBD';
      const location = document.getElementById('input-exam-location').value.trim() || 'Main Hall';

      if (!title || !date) {
        alert('Please enter exam title and date.');
        return;
      }

      const newExam = {
        id: 'exam-' + Date.now(),
        courseId: courseId,
        title: title,
        examDate: date,
        examTime: time,
        location: location,
        targetScore: 90,
        actualScore: null,
        checklist: [
          { id: 'c-' + Date.now() + '-1', text: 'Gather study notes & formula sheet', done: false },
          { id: 'c-' + Date.now() + '-2', text: 'Complete 1 timed practice test', done: false }
        ]
      };

      state.exams.push(newExam);
      window.StudentStorage.save(state);
      form.reset();
      closeModal('modal-add-exam');
      renderAll();
      playGentleBell('milestone');
    });
  }

  function renderAll() {
    renderHeader();
    renderFocusHero();
    renderAssignments();
    renderCourses();
    renderExams();
    renderSettings();
    populateCourseSelects();
  }

  function renderHeader() {
    // Fog mode indicator
    const btnFog = document.getElementById('btn-toggle-fog');
    if (btnFog) {
      if (state.settings.fogMode) {
        btnFog.classList.add('active');
        btnFog.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg> Fog Mode Active';
      } else {
        btnFog.classList.remove('active');
        btnFog.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Fog Mode';
      }
    }

    // Streak badge
    const badgeStreak = document.getElementById('badge-study-streak');
    if (badgeStreak) {
      badgeStreak.textContent = `🔥 ${state.profile.studyStreak}d Streak`;
    }

    // Grace tokens in header
    const badgeGrace = document.getElementById('badge-grace-tokens');
    if (badgeGrace) {
      badgeGrace.textContent = `🛡️ ${state.profile.graceTokens} Grace`;
    }
  }

  function renderFocusHero() {
    const today = getTodayISO();
    const hero = window.StudentEngine.getSingleFocusAction(state.assignments, today, state.settings.fogMode);
    const container = document.getElementById('card-focus-hero');
    if (!container) return;

    if (!hero.hasTask) {
      container.innerHTML = `
        <div class="hero-tagline">✨ Daily Sanctuary</div>
        <div class="hero-task-title">${hero.message}</div>
        <p style="color: var(--text-secondary); font-size: 0.9rem;">
          Your cognitive spoons are preserved. Recharge, drink water, or review your courses at your own pace.
        </p>
      `;
      return;
    }

    const course = state.courses.find(c => c.id === hero.courseId) || { code: 'ACADEMIC', color: '#2d5a44' };
    const assignment = state.assignments.find(a => a.id === hero.assignmentId);

    let milestonesHtml = '';
    if (assignment && assignment.dechunkedMilestones && assignment.dechunkedMilestones.length > 0) {
      milestonesHtml = `
        <div id="section-milestones-preview" class="mt-md">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">
            Micro-Milestones (${hero.milestonesDone}/${hero.milestonesTotal} Completed)
          </div>
          ${assignment.dechunkedMilestones.map(m => `
            <div class="milestone-item ${m.done ? 'done' : ''}" data-milestone-id="${m.id}" data-assignment-id="${assignment.id}">
              <div class="milestone-left">
                <div class="milestone-checkbox" role="checkbox" aria-checked="${m.done ? 'true' : 'false'}">
                  ${m.done ? '✓' : ''}
                </div>
                <span class="milestone-text">${window.StudentEngine.sanitizeText(m.text)}</span>
              </div>
              <span class="milestone-time">${m.minutes}m</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="flex-between">
        <div class="hero-tagline">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Single Focus Right Now
        </div>
        <span class="badge ${hero.urgency.class}">${hero.urgency.label}</span>
      </div>

      <div class="hero-task-title">${window.StudentEngine.sanitizeText(hero.title)}</div>
      
      <div>
        <span class="hero-course-pill">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${course.color}; display: inline-block;"></span>
          ${course.code}
        </span>
        ${hero.isEssential ? '<span class="badge badge-accent" style="margin-left: 6px;">Essential Deliverable</span>' : ''}
      </div>

      <div class="hero-step-box">
        <div class="hero-step-info">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <div>
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Immediate Next Micro-Step</div>
            <div class="hero-step-text">${window.StudentEngine.sanitizeText(hero.nextStepText)}</div>
          </div>
        </div>
        <span class="hero-step-badge">~${hero.nextStepMinutes} min</span>
      </div>

      ${milestonesHtml}

      <div class="hero-action-row">
        <button id="btn-hero-sprint" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start 20-Min Focus Sprint
        </button>
        <button class="btn btn-secondary btn-complete-asg" data-assignment-id="${hero.assignmentId}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Mark Completed
        </button>
        ${(!assignment.dechunkedMilestones || assignment.dechunkedMilestones.length === 0) ? `
          <button class="btn btn-secondary btn-dechunk-asg" data-assignment-id="${hero.assignmentId}">
            🪄 De-Chunk into 4 Steps
          </button>
        ` : ''}
      </div>
    `;

    bindHeroMilestoneClicks(container);
  }

  function bindHeroMilestoneClicks(container) {
    container.querySelectorAll('.milestone-item').forEach(item => {
      item.addEventListener('click', function () {
        const asgId = this.getAttribute('data-assignment-id');
        const mId = this.getAttribute('data-milestone-id');
        toggleMilestone(asgId, mId);
      });
    });

    container.querySelectorAll('.btn-complete-asg').forEach(btn => {
      btn.addEventListener('click', function () {
        const asgId = this.getAttribute('data-assignment-id');
        markAssignmentComplete(asgId);
      });
    });

    container.querySelectorAll('.btn-dechunk-asg').forEach(btn => {
      btn.addEventListener('click', function () {
        const asgId = this.getAttribute('data-assignment-id');
        dechunkExistingAssignment(asgId);
      });
    });
  }

  function toggleMilestone(asgId, milestoneId) {
    const asg = state.assignments.find(a => a.id === asgId);
    if (!asg || !asg.dechunkedMilestones) return;
    const m = asg.dechunkedMilestones.find(item => item.id === milestoneId);
    if (!m) return;

    m.done = !m.done;
    if (m.done) {
      playGentleBell('milestone');
    }

    // Check if all milestones done
    const allDone = asg.dechunkedMilestones.every(item => item.done);
    if (allDone) {
      asg.completed = true;
      asg.completedDate = getTodayISO();
      playGentleBell('sprint');
    }

    window.StudentStorage.save(state);
    renderFocusHero();
    renderAssignments();
  }

  function markAssignmentComplete(asgId) {
    const asg = state.assignments.find(a => a.id === asgId);
    if (!asg) return;
    asg.completed = true;
    asg.completedDate = getTodayISO();
    if (asg.dechunkedMilestones) {
      asg.dechunkedMilestones.forEach(m => { m.done = true; });
    }
    playGentleBell('sprint');
    window.StudentStorage.save(state);
    renderAll();
  }

  function dechunkExistingAssignment(asgId) {
    const asg = state.assignments.find(a => a.id === asgId);
    if (!asg) return;
    asg.dechunkedMilestones = window.StudentEngine.dechunkAssignment(asg.category, asg.title);
    playGentleBell('milestone');
    window.StudentStorage.save(state);
    renderAll();
  }

  function renderAssignments() {
    const today = getTodayISO();
    const container = document.getElementById('list-assignments');
    if (!container) return;

    const filtered = window.StudentEngine.filterAssignments(state.assignments, {
      courseId: activeCourseFilter,
      fogMode: state.settings.fogMode,
      showCompleted: false,
      todayStr: today
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">🌱</div>
          <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 6px;">Zero Academic Friction</h3>
          <p style="color: var(--text-secondary); font-size: 0.88rem;">
            ${state.settings.fogMode ? 'Fog Mode is active: all non-urgent assignments are hidden.' : 'No assignments found in this view.'}
          </p>
        </div>
      `;
      return;
    }

    // Sort by due date
    filtered.sort((a, b) => {
      const daysA = window.StudentEngine.diffDays(today, a.dueDate);
      const daysB = window.StudentEngine.diffDays(today, b.dueDate);
      return daysA - daysB;
    });

    container.innerHTML = filtered.map(a => {
      const course = state.courses.find(c => c.id === a.courseId) || { code: 'COURSE', color: '#2d5a44' };
      const urgency = window.StudentEngine.calculateUrgency(a.dueDate, today);
      const milestoneCount = (a.dechunkedMilestones || []).length;
      const doneCount = (a.dechunkedMilestones || []).filter(m => m.done).length;

      return `
        <div class="card mb-sm" style="padding: 16px;">
          <div class="flex-between">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="hero-course-pill" style="font-size: 0.75rem;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${course.color}; display: inline-block;"></span>
                ${course.code}
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${a.category}</span>
            </div>
            <span class="badge ${urgency.class}">${urgency.label}</span>
          </div>

          <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 8px 0;">
            ${window.StudentEngine.sanitizeText(a.title)}
          </div>

          ${milestoneCount > 0 ? `
            <div style="margin: 8px 0; font-size: 0.8rem; color: var(--text-secondary);">
              Progress: <strong>${doneCount}/${milestoneCount}</strong> micro-milestones
              <div style="width: 100%; height: 6px; background: var(--border-subtle); border-radius: 4px; overflow: hidden; margin-top: 4px;">
                <div style="width: ${(doneCount / milestoneCount) * 100}%; height: 100%; background: var(--color-primary); transition: width 200ms ease;"></div>
              </div>
            </div>
          ` : ''}

          <div class="flex-between mt-sm">
            <span style="font-size: 0.78rem; color: var(--text-muted);">Due: ${a.dueDate}</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-secondary btn-complete-asg" data-assignment-id="${a.id}">✓ Complete</button>
              ${milestoneCount === 0 ? `<button class="btn btn-sm btn-secondary btn-dechunk-asg" data-assignment-id="${a.id}">🪄 De-Chunk</button>` : ''}
              <button class="btn btn-sm btn-secondary btn-delete-asg" data-assignment-id="${a.id}">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    bindAssignmentActions(container);
  }

  function bindAssignmentActions(container) {
    container.querySelectorAll('.btn-complete-asg').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-assignment-id');
        markAssignmentComplete(id);
      });
    });

    container.querySelectorAll('.btn-dechunk-asg').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-assignment-id');
        dechunkExistingAssignment(id);
      });
    });

    container.querySelectorAll('.btn-delete-asg').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-assignment-id');
        state.assignments = state.assignments.filter(a => a.id !== id);
        window.StudentStorage.save(state);
        renderAll();
      });
    });
  }

  function renderCourses() {
    const container = document.getElementById('grid-courses');
    if (!container) return;

    const overallGpa = window.StudentEngine.calculateOverallGPA(state.courses, state.assignments);
    const gpaDisplay = document.getElementById('display-overall-gpa');
    if (gpaDisplay) {
      gpaDisplay.textContent = overallGpa.gpa;
    }

    if (state.courses.length === 0) {
      container.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
          <p style="color: var(--text-secondary);">No courses added yet. Click "+ Add Course" to get started.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.courses.map(course => {
      const grade = window.StudentEngine.calculateCourseGrade(course, state.assignments);
      const gradePercent = grade.currentPercentage !== null ? `${grade.currentPercentage}%` : 'In Progress';

      return `
        <div class="course-card">
          <div class="course-header">
            <div>
              <span class="course-code-tag" style="background: ${course.color};">${course.code}</span>
              <div class="course-title">${window.StudentEngine.sanitizeText(course.name)}</div>
              <div class="course-meta">Prof. ${window.StudentEngine.sanitizeText(course.instructor)} • ${window.StudentEngine.sanitizeText(course.scheduleTime)}</div>
            </div>
            <div style="text-align: right;">
              <div class="course-grade-badge">${gradePercent}</div>
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">${grade.letter}</div>
            </div>
          </div>

          <div style="background: var(--bg-surface-soft); padding: 10px 12px; border-radius: var(--radius-sm); font-size: 0.8rem;">
            <div class="flex-between">
              <span style="color: var(--text-secondary);">Graded Items:</span>
              <strong>${grade.gradedCount} / ${grade.totalCount}</strong>
            </div>
            <div class="flex-between mt-sm">
              <span style="color: var(--text-secondary);">Target:</span>
              <strong>${course.targetGrade}%</strong>
            </div>
          </div>

          <div class="flex-between">
            <button class="btn btn-sm btn-secondary btn-log-grade" data-course-id="${course.id}">+ Log Grade</button>
            <button class="btn btn-sm btn-secondary btn-delete-course" data-course-id="${course.id}" style="color: var(--color-danger);">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    bindCourseActions(container);
  }

  function bindCourseActions(container) {
    container.querySelectorAll('.btn-delete-course').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-course-id');
        if (confirm('Delete this course and its assignments?')) {
          state.courses = state.courses.filter(c => c.id !== id);
          state.assignments = state.assignments.filter(a => a.courseId !== id);
          state.exams = state.exams.filter(e => e.courseId !== id);
          window.StudentStorage.save(state);
          renderAll();
        }
      });
    });

    container.querySelectorAll('.btn-log-grade').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-course-id');
        const course = state.courses.find(c => c.id === id);
        if (!course) return;
        const score = prompt(`Enter graded percentage for ${course.code} (e.g. 92):`);
        if (score !== null && !isNaN(Number(score))) {
          state.assignments.push({
            id: 'asg-' + Date.now(),
            courseId: id,
            title: `Score Log (${getTodayISO()})`,
            category: 'quizzes',
            dueDate: getTodayISO(),
            dueTime: '12:00',
            score: Number(score),
            maxScore: 100,
            isEssential: false,
            completed: true,
            completedDate: getTodayISO(),
            dechunkedMilestones: []
          });
          window.StudentStorage.save(state);
          renderAll();
          playGentleBell('milestone');
        }
      });
    });
  }

  function renderExams() {
    const today = getTodayISO();
    const container = document.getElementById('list-exams');
    if (!container) return;

    if (state.exams.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <p style="color: var(--text-secondary);">No exams scheduled yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.exams.map(exam => {
      const course = state.courses.find(c => c.id === exam.courseId) || { code: 'COURSE', color: '#2d5a44' };
      const cd = window.StudentEngine.calculateExamCountdown(exam.examDate, today);

      return `
        <div class="card mb-md">
          <div class="flex-between">
            <span class="hero-course-pill">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${course.color}; display: inline-block;"></span>
              ${course.code}
            </span>
            <span class="badge ${cd.status === 'critical' ? 'badge-danger' : cd.status === 'urgent' ? 'badge-warning' : 'badge-info'}">
              ${cd.label}
            </span>
          </div>

          <div style="font-size: 1.15rem; font-weight: 700; margin: 8px 0;">
            ${window.StudentEngine.sanitizeText(exam.title)}
          </div>

          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
            📅 ${exam.examDate} at ${exam.examTime} • 📍 ${window.StudentEngine.sanitizeText(exam.location)}
          </div>

          ${(exam.checklist || []).length > 0 ? `
            <div style="background: var(--bg-surface-soft); padding: 12px; border-radius: var(--radius-md);">
              <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
                Study Checklist
              </div>
              ${exam.checklist.map(item => `
                <div class="milestone-item ${item.done ? 'done' : ''}" data-exam-id="${exam.id}" data-item-id="${item.id}">
                  <div class="milestone-left">
                    <div class="milestone-checkbox" role="checkbox" aria-checked="${item.done ? 'true' : 'false'}">
                      ${item.done ? '✓' : ''}
                    </div>
                    <span class="milestone-text">${window.StudentEngine.sanitizeText(item.text)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="flex-between mt-sm">
            <span></span>
            <button class="btn btn-sm btn-secondary btn-delete-exam" data-exam-id="${exam.id}">✕ Remove Exam</button>
          </div>
        </div>
      `;
    }).join('');

    bindExamActions(container);
  }

  function bindExamActions(container) {
    container.querySelectorAll('.milestone-item').forEach(item => {
      item.addEventListener('click', function () {
        const examId = this.getAttribute('data-exam-id');
        const itemId = this.getAttribute('data-item-id');
        const exam = state.exams.find(e => e.id === examId);
        if (!exam || !exam.checklist) return;
        const target = exam.checklist.find(i => i.id === itemId);
        if (target) {
          target.done = !target.done;
          if (target.done) playGentleBell('milestone');
          window.StudentStorage.save(state);
          renderExams();
        }
      });
    });

    container.querySelectorAll('.btn-delete-exam').forEach(btn => {
      btn.addEventListener('click', function () {
        const examId = this.getAttribute('data-exam-id');
        state.exams = state.exams.filter(e => e.id !== examId);
        window.StudentStorage.save(state);
        renderExams();
      });
    });
  }

  function renderSettings() {
    const streakStats = document.getElementById('stats-streak-display');
    if (streakStats) {
      streakStats.textContent = `${state.profile.studyStreak} Days Active`;
    }

    const graceStats = document.getElementById('stats-grace-display');
    if (graceStats) {
      graceStats.textContent = `${state.profile.graceTokens} Shields Remaining`;
    }
  }

  function populateCourseSelects() {
    const asgSelect = document.getElementById('select-asg-course');
    const examSelect = document.getElementById('select-exam-course');

    const options = state.courses.map(c => `
      <option value="${c.id}">${c.code} — ${window.StudentEngine.sanitizeText(c.name)}</option>
    `).join('');

    if (asgSelect) asgSelect.innerHTML = options;
    if (examSelect) examSelect.innerHTML = options;
  }

  // Focus Sprint Timer
  function startSprint(assignmentId, minutes) {
    activeSprintAssignmentId = assignmentId;
    sprintRemainingSeconds = (minutes || 20) * 60;
    sprintIsRunning = true;

    const hud = document.getElementById('hud-sprint-timer');
    if (hud) hud.style.display = 'flex';

    updateSprintDisplay();
    clearInterval(sprintInterval);
    sprintInterval = setInterval(tickSprintTimer, 1000);
  }

  function tickSprintTimer() {
    if (!sprintIsRunning) return;
    sprintRemainingSeconds--;

    if (sprintRemainingSeconds <= 0) {
      clearInterval(sprintInterval);
      sprintIsRunning = false;
      playGentleBell('sprint');
      state.profile.totalStudyMinutes += 20;
      window.StudentStorage.save(state);
      alert('🌟 Focus Sprint Complete! You gave your brain 20 minutes of momentum. Great work!');
      resetSprintTimer();
      renderAll();
    } else {
      updateSprintDisplay();
    }
  }

  function toggleSprintTimer() {
    sprintIsRunning = !sprintIsRunning;
    const btn = document.getElementById('btn-pause-sprint');
    if (btn) {
      btn.textContent = sprintIsRunning ? 'Pause' : 'Resume';
    }
  }

  function resetSprintTimer() {
    clearInterval(sprintInterval);
    sprintIsRunning = false;
    const hud = document.getElementById('hud-sprint-timer');
    if (hud) hud.style.display = 'none';
  }

  function updateSprintDisplay() {
    const mins = Math.floor(sprintRemainingSeconds / 60);
    const secs = sprintRemainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const display = document.getElementById('sprint-digits');
    if (display) display.textContent = formatted;
  }

  // Boot on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
