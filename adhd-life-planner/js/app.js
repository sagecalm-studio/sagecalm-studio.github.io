/**
 * ADHD Life Planner — Main Application Controller
 * DOM event management, Web Audio synthesizer, state bindings, and screen orchestration.
 */

(function () {
  'use strict';

  let state = null;
  let audioCtx = null;

  // Web Audio Dopamine Chimes (No external audio files needed!)
  function playSound(type) {
    if (!state || !state.profile.soundEnabled) return;
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;

      if (type === 'pop') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'chord') {
        // Pentatonic celebration chord (C5, E5, G5, C6)
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          gain.gain.setValueAtTime(0.12, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.4);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.45);
        });
      } else if (type === 'water') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } catch (e) {
      // Audio autoplay restrictions silent fallback
    }
  }

  function init() {
    state = LifeStorage.loadState();
    applyTheme(state.profile.theme);
    applyFogMode(state.profile.fogMode);

    bindNavigation();
    bindHeaderControls();
    bindEnergyDial();
    bindDailyAnchor();
    bindVitals();
    bindTasks();
    bindDopamineMenu();
    bindBrainDump();
    bindRoutines();
    bindSettings();
    bindModals();

    renderAll();

    // Check first-time tour
    if (!localStorage.getItem('adhd_life_tour_completed') && window.LifeTutorials) {
      setTimeout(() => {
        LifeTutorials.startTour(true);
      }, 350);
    }

    // Register service worker
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function renderAll() {
    renderGreeting();
    renderDailyAnchor();
    renderVitals();
    renderTasks();
    renderDopamineMenu();
    renderBrainDump();
    renderRoutines();
    renderStreaks();
    renderDailyProgress();
  }

  function applyTheme(themeName) {
    document.body.classList.remove('theme-sage-calm', 'theme-oled-dark', 'theme-oled-dusk', 'theme-warm-earth', 'theme-high-contrast');
    const validTheme = themeName || 'sage-calm';
    document.body.classList.add(`theme-${validTheme}`);
    document.body.setAttribute('data-theme', validTheme);
    const themeSelect = document.getElementById('setting-theme-select');
    if (themeSelect) themeSelect.value = validTheme;
  }

  function applyFogMode(isActive) {
    if (isActive) {
      document.body.classList.add('fog-mode-active');
      const fogBtn = document.getElementById('btn-toggle-fog');
      if (fogBtn) {
        fogBtn.classList.add('active');
        fogBtn.setAttribute('title', 'Fog Mode is ON: Non-essentials hidden');
      }
    } else {
      document.body.classList.remove('fog-mode-active');
      const fogBtn = document.getElementById('btn-toggle-fog');
      if (fogBtn) {
        fogBtn.classList.remove('active');
        fogBtn.setAttribute('title', 'Toggle Low-Spoons Fog Mode');
      }
    }
  }

  function bindNavigation() {
    const navButtons = document.querySelectorAll('[data-tab]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });
  }

  function switchTab(tabName) {
    const navButtons = document.querySelectorAll('[data-tab]');
    navButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
    });

    const screens = document.querySelectorAll('.app-screen');
    screens.forEach(screen => {
      const match = screen.id === `screen-${tabName}`;
      screen.classList.toggle('active', match);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindHeaderControls() {
    const fogBtn = document.getElementById('btn-toggle-fog');
    if (fogBtn) {
      fogBtn.addEventListener('click', () => {
        state.profile.fogMode = !state.profile.fogMode;
        LifeStorage.saveState(state);
        applyFogMode(state.profile.fogMode);
        playSound('pop');
        renderTasks();
      });
    }

    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        state.profile.soundEnabled = !state.profile.soundEnabled;
        LifeStorage.saveState(state);
        soundBtn.classList.toggle('muted', !state.profile.soundEnabled);
        soundBtn.textContent = state.profile.soundEnabled ? '🔊' : '🔇';
        if (state.profile.soundEnabled) playSound('pop');
      });
      soundBtn.textContent = state.profile.soundEnabled ? '🔊' : '🔇';
      soundBtn.classList.toggle('muted', !state.profile.soundEnabled);
    }
  }

  function bindEnergyDial() {
    const energyPills = document.querySelectorAll('.energy-pill');
    energyPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const lvl = pill.getAttribute('data-energy');
        state.profile.energyLevel = lvl;
        LifeStorage.saveState(state);
        playSound('pop');
        renderEnergyDial();
        renderTasks();
        renderGreeting();
      });
    });
    renderEnergyDial();
  }

  function renderEnergyDial() {
    const energyPills = document.querySelectorAll('.energy-pill');
    energyPills.forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-energy') === state.profile.energyLevel);
    });
  }

  function renderGreeting() {
    const greetingEl = document.getElementById('maya-greeting-text');
    if (!greetingEl || !window.LifePersonas) return;

    const hour = new Date().getHours();
    let slot = 'morning';
    if (hour >= 12 && hour < 17) slot = 'afternoon';
    if (hour >= 17) slot = 'evening';

    const p = LifePersonas.currentPersona;
    let msg = p.greetings[slot];
    if (state.profile.energyLevel === 'low' || state.profile.fogMode) {
      msg = p.energyMessages.low;
    }

    greetingEl.textContent = msg;
  }

  function bindDailyAnchor() {
    const checkEl = document.getElementById('anchor-checkbox');
    const inputEl = document.getElementById('anchor-input');

    if (checkEl) {
      checkEl.addEventListener('change', () => {
        state.anchor.completed = checkEl.checked;
        if (checkEl.checked) {
          playSound('chord');
          const today = LifeEngine.toISODate(new Date());
          state.streaks = LifeEngine.updateGraceStreak(state.streaks, today, true);
        } else {
          playSound('pop');
        }
        LifeStorage.saveState(state);
        renderDailyAnchor();
        renderStreaks();
        renderDailyProgress();
      });
    }

    if (inputEl) {
      inputEl.addEventListener('input', () => {
        state.anchor.text = inputEl.value;
        LifeStorage.saveState(state);
        renderDailyProgress();
      });
    }
  }

  function renderDailyAnchor() {
    const checkEl = document.getElementById('anchor-checkbox');
    const inputEl = document.getElementById('anchor-input');
    const cardEl = document.getElementById('daily-anchor-card');

    if (checkEl) checkEl.checked = !!state.anchor.completed;
    if (inputEl && inputEl.value !== state.anchor.text) {
      inputEl.value = state.anchor.text || '';
    }
    if (cardEl) {
      cardEl.classList.toggle('completed', !!state.anchor.completed);
    }
  }

  function bindVitals() {
    const waterAdd = document.getElementById('btn-water-add');
    const waterSub = document.getElementById('btn-water-sub');
    const medsCheck = document.getElementById('meds-checkbox');

    if (waterAdd) {
      waterAdd.addEventListener('click', () => {
        state.vitals.waterGlasses = Math.min(16, (state.vitals.waterGlasses || 0) + 1);
        LifeStorage.saveState(state);
        playSound('water');
        renderVitals();
        renderDailyProgress();
      });
    }

    if (waterSub) {
      waterSub.addEventListener('click', () => {
        state.vitals.waterGlasses = Math.max(0, (state.vitals.waterGlasses || 0) - 1);
        LifeStorage.saveState(state);
        playSound('pop');
        renderVitals();
        renderDailyProgress();
      });
    }

    if (medsCheck) {
      medsCheck.addEventListener('change', () => {
        state.vitals.medsTaken = medsCheck.checked;
        LifeStorage.saveState(state);
        playSound(medsCheck.checked ? 'pop' : 'pop');
        renderVitals();
        renderDailyProgress();
      });
    }
  }

  function renderVitals() {
    const waterCountEl = document.getElementById('water-count-display');
    const waterPillsContainer = document.getElementById('water-pills-row');
    const medsCheck = document.getElementById('meds-checkbox');

    const count = state.vitals.waterGlasses || 0;
    const target = state.vitals.targetWater || 8;

    if (waterCountEl) {
      waterCountEl.textContent = `${count}/${target} glasses`;
    }

    if (waterPillsContainer) {
      let html = '';
      for (let i = 1; i <= target; i++) {
        const filled = i <= count;
        html += `<span class="water-glass-dot ${filled ? 'filled' : ''}" title="Glass ${i}">💧</span>`;
      }
      waterPillsContainer.innerHTML = html;
    }

    if (medsCheck) {
      medsCheck.checked = !!state.vitals.medsTaken;
    }
  }

  function bindTasks() {
    const addTaskBtn = document.getElementById('btn-open-add-task');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => {
        openModal('modal-add-task');
      });
    }

    const form = document.getElementById('form-add-task');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('input-task-title');
        const energySelect = document.getElementById('select-task-energy');
        const title = (titleInput.value || '').trim();
        const energy = energySelect.value || 'normal';

        if (!title) return;

        const newTask = {
          id: 'task-' + Date.now(),
          title: title,
          energy: energy,
          completed: false,
          isEssential: energy === 'low',
          subtasks: []
        };

        state.tasks.push(newTask);
        LifeStorage.saveState(state);
        playSound('pop');

        titleInput.value = '';
        closeModal('modal-add-task');
        renderTasks();
        renderDailyProgress();
      });
    }
  }

  function renderTasks() {
    const listEl = document.getElementById('active-tasks-list');
    if (!listEl) return;

    const filtered = LifeEngine.calculateEnergyFilteredTasks(
      state.tasks,
      state.profile.energyLevel,
      state.profile.fogMode
    );

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state-card">
          <p class="empty-title">🌱 All clear for this energy level.</p>
          <p class="empty-sub">Take a deep breath or add a 1-tap micro-task when you are ready.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(task => {
      const isDone = !!task.completed;
      const energyBadge = task.energy === 'low' ? '🟢 Low Energy' : (task.energy === 'high' ? '⚡ High Focus' : '🟡 Normal');

      html += `
        <div class="task-card ${isDone ? 'completed' : ''}" data-task-id="${task.id}">
          <label class="custom-check-label">
            <input type="checkbox" class="task-item-check" data-id="${task.id}" ${isDone ? 'checked' : ''} />
            <span class="custom-check-box"></span>
          </label>
          <div class="task-card-content">
            <span class="task-title-text">${LifeEngine.sanitizeText(task.title)}</span>
            <div class="task-tags-row">
              <span class="badge badge-energy badge-${task.energy}">${energyBadge}</span>
              ${task.subtasks && task.subtasks.length > 0 ? `<span class="badge badge-subtasks">${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length} steps</span>` : ''}
            </div>
            ${renderSubtasksList(task)}
          </div>
          <div class="task-card-actions">
            <button class="btn-icon btn-dechunk" data-id="${task.id}" title="Break into 3 micro-steps">✂️</button>
            <button class="btn-icon btn-delete-task" data-id="${task.id}" title="Delete task">🗑️</button>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    // Attach listeners
    listEl.querySelectorAll('.task-item-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-id');
        const task = state.tasks.find(t => t.id === id);
        if (task) {
          task.completed = chk.checked;
          if (chk.checked) playSound('pop');
          LifeStorage.saveState(state);
          renderTasks();
          renderDailyProgress();
        }
      });
    });

    listEl.querySelectorAll('.btn-dechunk').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const task = state.tasks.find(t => t.id === id);
        if (task) {
          task.subtasks = LifeEngine.dechunkTask(task.title);
          LifeStorage.saveState(state);
          playSound('pop');
          renderTasks();
        }
      });
    });

    listEl.querySelectorAll('.btn-delete-task').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.tasks = state.tasks.filter(t => t.id !== id);
        LifeStorage.saveState(state);
        playSound('pop');
        renderTasks();
        renderDailyProgress();
      });
    });

    listEl.querySelectorAll('.subtask-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const taskId = chk.getAttribute('data-task-id');
        const subIndex = parseInt(chk.getAttribute('data-sub-idx'), 10);
        const task = state.tasks.find(t => t.id === taskId);
        if (task && task.subtasks && task.subtasks[subIndex]) {
          task.subtasks[subIndex].completed = chk.checked;
          if (chk.checked) playSound('pop');
          LifeStorage.saveState(state);
          renderTasks();
        }
      });
    });
  }

  function renderSubtasksList(task) {
    if (!task.subtasks || task.subtasks.length === 0) return '';
    let subHtml = '<div class="subtasks-container">';
    task.subtasks.forEach((sub, idx) => {
      subHtml += `
        <label class="subtask-row ${sub.completed ? 'completed' : ''}">
          <input type="checkbox" class="subtask-check" data-task-id="${task.id}" data-sub-idx="${idx}" ${sub.completed ? 'checked' : ''} />
          <span class="subtask-title">${LifeEngine.sanitizeText(sub.title)}</span>
          <span class="subtask-time">${sub.duration || '2 min'}</span>
        </label>
      `;
    });
    subHtml += '</div>';
    return subHtml;
  }

  function bindDopamineMenu() {
    const surpriseBtn = document.getElementById('btn-dopamine-surprise');
    if (surpriseBtn) {
      surpriseBtn.addEventListener('click', () => {
        const pick = LifeEngine.getDopamineRandomPick(state.dopamineMenu, 'any');
        if (pick) {
          playSound('chord');
          showNotification(`✨ Dopamine Suggestion: ${pick.title} (${pick.duration})`);
        }
      });
    }

    const addDopamineBtn = document.getElementById('btn-open-add-dopamine');
    if (addDopamineBtn) {
      addDopamineBtn.addEventListener('click', () => {
        openModal('modal-add-dopamine');
      });
    }

    const form = document.getElementById('form-add-dopamine');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = (document.getElementById('input-dopamine-title').value || '').trim();
        const duration = (document.getElementById('input-dopamine-duration').value || '5 min').trim();
        const category = document.getElementById('select-dopamine-category').value || 'appetizers';

        if (!title) return;

        const item = {
          id: 'dop-' + Date.now(),
          title: title,
          duration: duration,
          icon: 'sparkles'
        };

        if (!Array.isArray(state.dopamineMenu[category])) {
          state.dopamineMenu[category] = [];
        }
        state.dopamineMenu[category].push(item);
        LifeStorage.saveState(state);
        playSound('pop');

        document.getElementById('input-dopamine-title').value = '';
        closeModal('modal-add-dopamine');
        renderDopamineMenu();
      });
    }
  }

  function renderDopamineMenu() {
    const categories = ['appetizers', 'entrees', 'sides', 'desserts'];
    categories.forEach(cat => {
      const container = document.getElementById(`dopamine-list-${cat}`);
      if (!container) return;
      const items = (state.dopamineMenu && state.dopamineMenu[cat]) || [];

      if (items.length === 0) {
        container.innerHTML = `<p class="empty-sub">No items in this section yet.</p>`;
        return;
      }

      let html = '';
      items.forEach(item => {
        html += `
          <div class="dopamine-item-card" data-id="${item.id}">
            <div class="dopamine-item-left">
              <span class="dopamine-item-title">${LifeEngine.sanitizeText(item.title)}</span>
              <span class="dopamine-item-time">${LifeEngine.sanitizeText(item.duration)}</span>
            </div>
            <button class="btn-icon btn-delete-dopamine" data-cat="${cat}" data-id="${item.id}" title="Remove">×</button>
          </div>
        `;
      });
      container.innerHTML = html;

      container.querySelectorAll('.btn-delete-dopamine').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.getAttribute('data-cat');
          const id = btn.getAttribute('data-id');
          state.dopamineMenu[cat] = state.dopamineMenu[cat].filter(i => i.id !== id);
          LifeStorage.saveState(state);
          playSound('pop');
          renderDopamineMenu();
        });
      });
    });
  }

  function bindBrainDump() {
    const textarea = document.getElementById('brain-dump-textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        state.brainDump = textarea.value;
        LifeStorage.saveState(state);
      });
    }

    const clearBtn = document.getElementById('btn-clear-braindump');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear the brain dump scratchpad?')) {
          state.brainDump = '';
          textarea.value = '';
          LifeStorage.saveState(state);
          playSound('pop');
        }
      });
    }
  }

  function renderBrainDump() {
    const textarea = document.getElementById('brain-dump-textarea');
    if (textarea && textarea.value !== state.brainDump) {
      textarea.value = state.brainDump || '';
    }
  }

  function bindRoutines() {
    // Handled in renderRoutines via delegation
  }

  function renderRoutines() {
    const morningContainer = document.getElementById('routine-list-morning');
    const afternoonContainer = document.getElementById('routine-list-afternoon');
    const eveningContainer = document.getElementById('routine-list-evening');

    const containers = {
      morning: morningContainer,
      afternoon: afternoonContainer,
      evening: eveningContainer
    };

    ['morning', 'afternoon', 'evening'].forEach(slot => {
      const c = containers[slot];
      if (!c) return;

      const items = (state.routines || []).filter(r => r.slot === slot);
      if (items.length === 0) {
        c.innerHTML = `<p class="empty-sub">No routine items here.</p>`;
        return;
      }

      let html = '';
      items.forEach(item => {
        html += `
          <label class="routine-check-row ${item.completed ? 'completed' : ''}">
            <input type="checkbox" class="routine-item-check" data-id="${item.id}" ${item.completed ? 'checked' : ''} />
            <span class="custom-check-box"></span>
            <span class="routine-title-text">${LifeEngine.sanitizeText(item.title)}</span>
          </label>
        `;
      });
      c.innerHTML = html;

      c.querySelectorAll('.routine-item-check').forEach(chk => {
        chk.addEventListener('change', () => {
          const id = chk.getAttribute('data-id');
          const item = state.routines.find(r => r.id === id);
          if (item) {
            item.completed = chk.checked;
            playSound('pop');
            LifeStorage.saveState(state);
            renderRoutines();
            renderDailyProgress();
          }
        });
      });
    });
  }

  function renderStreaks() {
    const streakDisplay = document.getElementById('grace-streak-count');
    const gracePoolDisplay = document.getElementById('grace-pool-count');

    if (streakDisplay) {
      streakDisplay.textContent = state.streaks.currentStreak || 0;
    }
    if (gracePoolDisplay) {
      gracePoolDisplay.textContent = `${state.streaks.graceDaysAvailable || 0} Grace Days active`;
    }
  }

  function renderDailyProgress() {
    const res = LifeEngine.calculateDailyProgress(
      state.anchor,
      state.vitals,
      state.routines,
      state.tasks
    );

    const barEl = document.getElementById('daily-progress-bar-fill');
    const pctEl = document.getElementById('daily-progress-percent');
    const msgEl = document.getElementById('daily-progress-message');

    if (barEl) barEl.style.width = `${res.percentage}%`;
    if (pctEl) pctEl.textContent = `${res.percentage}%`;
    if (msgEl) msgEl.textContent = res.message;
  }

  function bindSettings() {
    const themeSelect = document.getElementById('setting-theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        state.profile.theme = themeSelect.value;
        LifeStorage.saveState(state);
        applyTheme(state.profile.theme);
        playSound('pop');
      });
    }

    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = LifeStorage.exportStateJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `adhd-life-backup-${LifeEngine.toISODate(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        playSound('chord');
      });
    }

    const importInput = document.getElementById('input-import-backup');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const res = LifeStorage.importStateJSON(evt.target.result);
          if (res.success) {
            state = res.state;
            applyTheme(state.profile.theme);
            applyFogMode(state.profile.fogMode);
            renderAll();
            playSound('chord');
            alert('Backup imported successfully!');
          } else {
            alert('Failed to import backup: ' + res.error);
          }
        };
        reader.readAsText(file);
      });
    }

    const resetBtn = document.getElementById('btn-reset-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset to default example data? This will clear your current changes.')) {
          state = LifeStorage.resetToDefault();
          applyTheme(state.profile.theme);
          applyFogMode(state.profile.fogMode);
          renderAll();
          playSound('pop');
        }
      });
    }

    const startTourBtn = document.getElementById('btn-restart-tour');
    if (startTourBtn) {
      startTourBtn.addEventListener('click', () => {
        if (window.LifeTutorials) {
          LifeTutorials.startTour(true);
        }
      });
    }
  }

  function bindModals() {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close-modal');
        closeModal(targetId);
      });
    });

    // Close on backdrop click
    document.querySelectorAll('.app-modal').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) {
          closeModal(m.id);
        }
      });
    });

    // Help triggers
    document.querySelectorAll('[data-help]').forEach(btn => {
      btn.addEventListener('click', () => {
        const topicKey = btn.getAttribute('data-help');
        const topic = window.LifeHelp && LifeHelp.topics[topicKey];
        if (topic) {
          const titleEl = document.getElementById('help-modal-title');
          const bodyEl = document.getElementById('help-modal-body');
          if (titleEl) titleEl.textContent = topic.title;
          if (bodyEl) bodyEl.textContent = topic.body;
          openModal('modal-maya-help');
        }
      });
    });
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  function showNotification(text) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Export to global for testing or debugging if needed
  window.LifeApp = {
    init: init,
    openModal: openModal,
    closeModal: closeModal,
    switchTab: switchTab,
    getState: () => state
  };

  document.addEventListener('DOMContentLoaded', init);
})();