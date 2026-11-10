/**
 * ADHD Student Planner — Data Persistence, State & Schema Management
 * Client-side localStorage engine with schema validation, anti-double-counting,
 * and seamless JSON backup export/import.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudentStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'adhd_student_planner_data_v1';
  const CURRENT_SCHEMA = 1;

  function getTodayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getDefaultData() {
    const today = getTodayISO();
    const parts = today.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);

    function offsetDays(n) {
      const dt = new Date(Date.UTC(y, m, d + n));
      const oy = dt.getUTCFullYear();
      const om = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const od = String(dt.getUTCDate()).padStart(2, '0');
      return `${oy}-${om}-${od}`;
    }

    return {
      schema: CURRENT_SCHEMA,
      profile: {
        name: 'Alex',
        schoolName: 'University Academic Term',
        currentTerm: 'Fall Semester',
        studyStreak: 4,
        lastActiveDate: today,
        graceTokens: 3,
        totalStudyMinutes: 280
      },
      settings: {
        fogMode: false,
        soundEnabled: true,
        hapticsEnabled: true,
        theme: 'sage-calm',
        defaultSprintMinutes: 20
      },
      courses: [
        {
          id: 'course-1',
          code: 'BIO 101',
          name: 'General Biology',
          color: '#2d5a44',
          instructor: 'Dr. Aris Thorne',
          room: 'Science Hall 204',
          scheduleDays: ['Mon', 'Wed', 'Fri'],
          scheduleTime: '10:00 - 11:15 AM',
          targetGrade: 90,
          weights: { assignments: 35, quizzes: 20, midterm: 20, final: 25 }
        },
        {
          id: 'course-2',
          code: 'PSYC 210',
          name: 'Cognitive Psychology',
          color: '#3b82f6',
          instructor: 'Prof. Elena Vance',
          room: 'Auditorium B',
          scheduleDays: ['Tue', 'Thu'],
          scheduleTime: '1:00 - 2:30 PM',
          targetGrade: 92,
          weights: { assignments: 30, quizzes: 25, midterm: 20, final: 25 }
        },
        {
          id: 'course-3',
          code: 'MATH 140',
          name: 'Applied Statistics',
          color: '#d97706',
          instructor: 'Dr. Marcus Webb',
          room: 'Math Lab 108',
          scheduleDays: ['Mon', 'Wed'],
          scheduleTime: '3:00 - 4:15 PM',
          targetGrade: 88,
          weights: { assignments: 40, quizzes: 20, midterm: 20, final: 20 }
        }
      ],
      assignments: [
        {
          id: 'asg-1',
          courseId: 'course-1',
          title: 'Cellular Energy Lab Report',
          category: 'assignments',
          dueDate: offsetDays(1),
          dueTime: '23:59',
          score: null,
          maxScore: 100,
          isEssential: true,
          completed: false,
          completedDate: null,
          dechunkedMilestones: [
            { id: 'm-101', text: 'Structure results and experimental charts', minutes: 15, done: true },
            { id: 'm-102', text: 'Write discussion section comparing hypotheses', minutes: 25, done: false },
            { id: 'm-103', text: 'Draft error analysis & conclusions', minutes: 20, done: false },
            { id: 'm-104', text: 'Run spellcheck and format citations', minutes: 15, done: false }
          ]
        },
        {
          id: 'asg-2',
          courseId: 'course-2',
          title: 'Working Memory Literature Summary',
          category: 'assignments',
          dueDate: offsetDays(3),
          dueTime: '17:00',
          score: null,
          maxScore: 100,
          isEssential: false,
          completed: false,
          completedDate: null,
          dechunkedMilestones: [
            { id: 'm-201', text: 'Read Baddeley (2000) paper summary', minutes: 20, done: false },
            { id: 'm-202', text: 'Highlight 3 core working memory models', minutes: 15, done: false },
            { id: 'm-203', text: 'Draft 2-page critical synthesis', minutes: 30, done: false },
            { id: 'm-204', text: 'Review APA citations and submit', minutes: 15, done: false }
          ]
        },
        {
          id: 'asg-3',
          courseId: 'course-3',
          title: 'Problem Set #4: Hypothesis Testing',
          category: 'assignments',
          dueDate: offsetDays(5),
          dueTime: '23:59',
          score: null,
          maxScore: 100,
          isEssential: true,
          completed: false,
          completedDate: null,
          dechunkedMilestones: [
            { id: 'm-301', text: 'Solve problems 1 through 3 (z-scores)', minutes: 20, done: false },
            { id: 'm-302', text: 'Solve problems 4 through 6 (t-tests)', minutes: 25, done: false },
            { id: 'm-303', text: 'Graph p-value distributions', minutes: 15, done: false },
            { id: 'm-304', text: 'Scan handwriting into clean PDF', minutes: 10, done: false }
          ]
        },
        {
          id: 'asg-4',
          courseId: 'course-1',
          title: 'Quiz 1: Cell Membrane Mechanics',
          category: 'quizzes',
          dueDate: offsetDays(-5),
          dueTime: '10:00',
          score: 94,
          maxScore: 100,
          isEssential: false,
          completed: true,
          completedDate: offsetDays(-5),
          dechunkedMilestones: []
        },
        {
          id: 'asg-5',
          courseId: 'course-2',
          title: 'Quiz 1: Sensory Perception',
          category: 'quizzes',
          dueDate: offsetDays(-3),
          dueTime: '13:00',
          score: 90,
          maxScore: 100,
          isEssential: false,
          completed: true,
          completedDate: offsetDays(-3),
          dechunkedMilestones: []
        }
      ],
      exams: [
        {
          id: 'exam-1',
          courseId: 'course-1',
          title: 'Midterm 1: Cellular & Molecular Foundations',
          examDate: offsetDays(8),
          examTime: '10:00 AM',
          location: 'Science Hall 204',
          targetScore: 90,
          actualScore: null,
          checklist: [
            { id: 'c-1', text: 'Review lecture slide decks 1-6', done: true },
            { id: 'c-2', text: 'Do flashcard speed run on membrane transport', done: false },
            { id: 'c-3', text: 'Complete practice exam under 50 min timer', done: false }
          ]
        },
        {
          id: 'exam-2',
          courseId: 'course-3',
          title: 'Midterm Exam: Inferential Statistics',
          examDate: offsetDays(14),
          examTime: '3:00 PM',
          location: 'Math Lab 108',
          targetScore: 88,
          actualScore: null,
          checklist: [
            { id: 'c-4', text: 'Prepare 1-page handwritten formula sheet', done: false },
            { id: 'c-5', text: 'Master two-tailed hypothesis testing steps', done: false }
          ]
        }
      ],
      sprints: [
        {
          id: 'spr-1',
          date: today,
          courseId: 'course-1',
          assignmentId: 'asg-1',
          minutes: 20,
          energyLevel: 'focused'
        }
      ]
    };
  }

  function validateAndMigrate(data) {
    if (!data || typeof data !== 'object') {
      return getDefaultData();
    }

    const defaultObj = getDefaultData();

    // Ensure schema version
    data.schema = CURRENT_SCHEMA;

    // Ensure all critical collections exist
    if (!data.profile || typeof data.profile !== 'object') data.profile = defaultObj.profile;
    if (!data.settings || typeof data.settings !== 'object') data.settings = defaultObj.settings;
    if (!Array.isArray(data.courses)) data.courses = defaultObj.courses;
    if (!Array.isArray(data.assignments)) data.assignments = defaultObj.assignments;
    if (!Array.isArray(data.exams)) data.exams = defaultObj.exams;
    if (!Array.isArray(data.sprints)) data.sprints = defaultObj.sprints;

    // Guard profile fields
    data.profile.graceTokens = typeof data.profile.graceTokens === 'number' ? data.profile.graceTokens : 3;
    data.profile.studyStreak = typeof data.profile.studyStreak === 'number' ? data.profile.studyStreak : 1;
    data.profile.totalStudyMinutes = typeof data.profile.totalStudyMinutes === 'number' ? data.profile.totalStudyMinutes : 0;

    return data;
  }

  function getStorageInstance() {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    // Node.js fallback or mock
    if (typeof global !== 'undefined' && global._mockLocalStorage) {
      return global._mockLocalStorage;
    }
    return null;
  }

  function load() {
    const store = getStorageInstance();
    if (!store) return getDefaultData();

    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) {
        const initData = getDefaultData();
        save(initData);
        return initData;
      }
      const parsed = JSON.parse(raw);
      return validateAndMigrate(parsed);
    } catch (e) {
      console.error('Failed to parse stored student planner data, resetting to defaults', e);
      const initData = getDefaultData();
      save(initData);
      return initData;
    }
  }

  function save(data) {
    const store = getStorageInstance();
    if (!store) return false;

    try {
      const sanitized = validateAndMigrate(data);
      store.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      return true;
    } catch (e) {
      console.error('Failed to save student planner data', e);
      return false;
    }
  }

  function reset() {
    const store = getStorageInstance();
    const fresh = getDefaultData();
    if (store) {
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(fresh));
      } catch (e) {
        console.error('Failed to reset storage', e);
      }
    }
    return fresh;
  }

  function exportJSON(data) {
    const safeData = data || load();
    return JSON.stringify(safeData, null, 2);
  }

  function importJSON(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new Error('Invalid JSON string');
    }
    const parsed = JSON.parse(jsonString);
    const validated = validateAndMigrate(parsed);
    save(validated);
    return validated;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    CURRENT_SCHEMA: CURRENT_SCHEMA,
    getDefaultData: getDefaultData,
    validateAndMigrate: validateAndMigrate,
    load: load,
    save: save,
    reset: reset,
    exportJSON: exportJSON,
    importJSON: importJSON
  };
});
