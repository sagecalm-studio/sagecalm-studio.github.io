/**
 * ADHD Student Planner — Computational & Academic Executive Logic Engine
 * 100% pure functions, zero DOM dependencies, fully testable in Node.js and browser.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudentEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function toISODate(d) {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function addDays(isoDate, n) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(y, m, d + n));
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function diffDays(d1, d2) {
    if (!d1 || !d2) return 0;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) || isNaN(t2)) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((t2 - t1) / msPerDay);
  }

  function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function calculateUrgency(dueDate, todayStr) {
    if (!dueDate) return { key: 'later', label: 'No Deadline', daysLeft: 999, class: 'badge-muted' };
    const days = diffDays(todayStr, dueDate);
    if (days < 0) {
      return { key: 'overdue', label: `${Math.abs(days)}d Overdue`, daysLeft: days, class: 'badge-danger' };
    }
    if (days === 0) {
      return { key: 'today', label: 'Due Today', daysLeft: 0, class: 'badge-warning' };
    }
    if (days === 1) {
      return { key: 'tomorrow', label: 'Due Tomorrow', daysLeft: 1, class: 'badge-warning' };
    }
    if (days <= 3) {
      return { key: 'urgent', label: `In ${days} days`, daysLeft: days, class: 'badge-accent' };
    }
    if (days <= 7) {
      return { key: 'upcoming', label: `In ${days} days`, daysLeft: days, class: 'badge-info' };
    }
    return { key: 'later', label: `In ${days} days`, daysLeft: days, class: 'badge-muted' };
  }

  function percentageToLetter(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return { letter: 'N/A', gpa: 0.0 };
    if (pct >= 93) return { letter: 'A', gpa: 4.0 };
    if (pct >= 90) return { letter: 'A-', gpa: 3.7 };
    if (pct >= 87) return { letter: 'B+', gpa: 3.3 };
    if (pct >= 83) return { letter: 'B', gpa: 3.0 };
    if (pct >= 80) return { letter: 'B-', gpa: 2.7 };
    if (pct >= 77) return { letter: 'C+', gpa: 2.3 };
    if (pct >= 73) return { letter: 'C', gpa: 2.0 };
    if (pct >= 70) return { letter: 'C-', gpa: 1.7 };
    if (pct >= 67) return { letter: 'D+', gpa: 1.3 };
    if (pct >= 60) return { letter: 'D', gpa: 1.0 };
    return { letter: 'F', gpa: 0.0 };
  }

  function calculateCourseGrade(course, assignments) {
    if (!course) return { currentPercentage: null, letter: 'N/A', gpa: 0.0, gradedCount: 0, totalCount: 0 };
    const courseAssignments = (assignments || []).filter(a => a.courseId === course.id);
    const graded = courseAssignments.filter(a => a.score !== null && a.score !== undefined && !isNaN(Number(a.score)));

    if (graded.length === 0) {
      return {
        currentPercentage: null,
        letter: 'In Progress',
        gpa: 0.0,
        gradedCount: 0,
        totalCount: courseAssignments.length,
        breakdown: {}
      };
    }

    const weights = course.weights || { assignments: 40, quizzes: 20, midterm: 20, final: 20 };
    const catScores = {};
    const catCounts = {};

    graded.forEach(a => {
      const cat = a.category || 'assignments';
      const maxScore = Number(a.maxScore) > 0 ? Number(a.maxScore) : 100;
      const pct = (Number(a.score) / maxScore) * 100;
      if (!catScores[cat]) {
        catScores[cat] = 0;
        catCounts[cat] = 0;
      }
      catScores[cat] += pct;
      catCounts[cat] += 1;
    });

    let totalWeightedScore = 0;
    let totalActiveWeight = 0;
    const breakdown = {};

    Object.keys(weights).forEach(cat => {
      const weight = Number(weights[cat]) || 0;
      if (catCounts[cat] && catCounts[cat] > 0) {
        const avg = catScores[cat] / catCounts[cat];
        totalWeightedScore += (avg * (weight / 100));
        totalActiveWeight += (weight / 100);
        breakdown[cat] = {
          average: Math.round(avg * 10) / 10,
          weight: weight,
          count: catCounts[cat]
        };
      }
    });

    let currentPercentage = null;
    if (totalActiveWeight > 0) {
      currentPercentage = Math.round((totalWeightedScore / totalActiveWeight) * 10) / 10;
    } else {
      // Simple arithmetic mean fallback
      const sum = graded.reduce((acc, a) => {
        const maxScore = Number(a.maxScore) > 0 ? Number(a.maxScore) : 100;
        return acc + ((Number(a.score) / maxScore) * 100);
      }, 0);
      currentPercentage = Math.round((sum / graded.length) * 10) / 10;
    }

    const gradeInfo = percentageToLetter(currentPercentage);

    return {
      currentPercentage: currentPercentage,
      letter: gradeInfo.letter,
      gpa: gradeInfo.gpa,
      gradedCount: graded.length,
      totalCount: courseAssignments.length,
      breakdown: breakdown
    };
  }

  function calculateOverallGPA(courses, assignments) {
    if (!courses || courses.length === 0) return { gpa: '0.00', letter: 'N/A', activeCourses: 0 };
    let gpaSum = 0;
    let gradedCourses = 0;

    courses.forEach(course => {
      const grade = calculateCourseGrade(course, assignments);
      if (grade.currentPercentage !== null) {
        gpaSum += grade.gpa;
        gradedCourses++;
      }
    });

    if (gradedCourses === 0) {
      return { gpa: 'N/A', letter: 'No Grades Yet', activeCourses: courses.length };
    }

    const avgGpa = Math.round((gpaSum / gradedCourses) * 100) / 100;
    const letterObj = percentageToLetter(avgGpa * 25); // rough proxy for letter display
    return {
      gpa: avgGpa.toFixed(2),
      letter: letterObj.letter,
      activeCourses: courses.length,
      gradedCourses: gradedCourses
    };
  }

  function dechunkAssignment(type, title) {
    const cleanTitle = (title || 'Assignment').trim();
    const t = (type || 'paper').toLowerCase();

    if (t === 'paper' || t === 'essay') {
      return [
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: `Define 3 main arguments & thesis for ${cleanTitle}`, minutes: 15, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Gather 3-5 verified primary sources or quotes', minutes: 20, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Draft rough bullet points for each body section', minutes: 25, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Polish transitions & verify bibliography citations', minutes: 20, done: false }
      ];
    }

    if (t === 'exam' || t === 'quiz' || t === 'test') {
      return [
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: `Consolidate key formulas & study guide for ${cleanTitle}`, minutes: 15, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Active Recall: Test 10 high-frequency definitions', minutes: 20, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Solve 3 practice problems under timed conditions', minutes: 25, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Review tricky flashcards and rest your brain', minutes: 10, done: false }
      ];
    }

    if (t === 'lab' || t === 'project') {
      return [
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: `Set up raw figures and section headers for ${cleanTitle}`, minutes: 15, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Analyze primary data & write methodology bullets', minutes: 25, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Draft discussion, observations, and key takeaways', minutes: 20, done: false },
        { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Format charts, run spellcheck, and export final PDF', minutes: 15, done: false }
      ];
    }

    // Default reading / homework dechunk
    return [
      { id: 'm-' + Math.random().toString(36).substr(2, 9), text: `Preview section headings & summary for ${cleanTitle}`, minutes: 10, done: false },
      { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Read first half and note 3 important concepts', minutes: 20, done: false },
      { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Read second half and jot down questions or notes', minutes: 20, done: false },
      { id: 'm-' + Math.random().toString(36).substr(2, 9), text: 'Write a quick 3-sentence summary in your own words', minutes: 10, done: false }
    ];
  }

  function getSingleFocusAction(assignments, todayStr, fogMode) {
    if (!assignments || assignments.length === 0) {
      return {
        hasTask: false,
        message: 'No pending assignments! You are all caught up.'
      };
    }

    const pending = assignments.filter(a => !a.completed);
    if (pending.length === 0) {
      return {
        hasTask: false,
        message: 'All assignments completed! Take a well-deserved guilt-free break.'
      };
    }

    // Filter for fogMode if enabled
    let candidates = pending;
    if (fogMode) {
      candidates = pending.filter(a => {
        const days = diffDays(todayStr, a.dueDate);
        return days <= 1 || a.isEssential;
      });
      if (candidates.length === 0) {
        // Fallback to closest if no strict fog matches
        candidates = [pending[0]];
      }
    }

    // Sort by: overdue first, then closest due date, then essential status
    candidates.sort((a, b) => {
      const daysA = diffDays(todayStr, a.dueDate);
      const daysB = diffDays(todayStr, b.dueDate);
      if (daysA !== daysB) return daysA - daysB;
      if (a.isEssential && !b.isEssential) return -1;
      if (!a.isEssential && b.isEssential) return 1;
      return 0;
    });

    const chosen = candidates[0];
    const urgency = calculateUrgency(chosen.dueDate, todayStr);

    // Look for first uncompleted milestone if dechunked
    let nextStepText = 'Get started with the first 15-minute chunk';
    let nextStepMinutes = 15;
    let nextStepId = null;

    if (chosen.dechunkedMilestones && chosen.dechunkedMilestones.length > 0) {
      const nextMilestone = chosen.dechunkedMilestones.find(m => !m.done);
      if (nextMilestone) {
        nextStepText = nextMilestone.text;
        nextStepMinutes = nextMilestone.minutes || 15;
        nextStepId = nextMilestone.id;
      }
    }

    return {
      hasTask: true,
      assignmentId: chosen.id,
      courseId: chosen.courseId,
      title: chosen.title,
      dueDate: chosen.dueDate,
      urgency: urgency,
      nextStepText: nextStepText,
      nextStepMinutes: nextStepMinutes,
      nextStepId: nextStepId,
      isEssential: !!chosen.isEssential,
      milestonesTotal: (chosen.dechunkedMilestones || []).length,
      milestonesDone: (chosen.dechunkedMilestones || []).filter(m => m.done).length
    };
  }

  function calculateStreak(lastActiveDate, todayStr, currentStreak, graceTokens) {
    const cur = Number(currentStreak) || 0;
    const tokens = Number(graceTokens) || 0;

    if (!lastActiveDate) {
      return { streak: 1, graceTokens: tokens, usedGrace: false, message: 'Welcome to your first study session!' };
    }

    if (lastActiveDate === todayStr) {
      return { streak: Math.max(1, cur), graceTokens: tokens, usedGrace: false, message: 'Streak active today!' };
    }

    const gap = diffDays(lastActiveDate, todayStr);

    if (gap === 1) {
      // Consecutive day!
      return {
        streak: cur + 1,
        graceTokens: tokens,
        usedGrace: false,
        message: `🔥 Streak increased to ${cur + 1} days!`
      };
    }

    if (gap === 2) {
      // Missed exactly 1 day
      if (tokens > 0) {
        return {
          streak: cur + 1,
          graceTokens: tokens - 1,
          usedGrace: true,
          message: `🛡️ Grace Shield protected your ${cur + 1}-day streak!`
        };
      }
      return {
        streak: 1,
        graceTokens: 1, // grant fresh token
        usedGrace: false,
        message: 'Fresh start today! No guilt, your brain is ready.'
      };
    }

    // Gap > 2
    if (tokens >= 2) {
      return {
        streak: cur + 1,
        graceTokens: tokens - 2,
        usedGrace: true,
        message: `🛡️ 2 Grace Shields preserved your ${cur + 1}-day streak!`
      };
    }

    return {
      streak: 1,
      graceTokens: 2,
      usedGrace: false,
      message: 'New beginning! Clean slate activated.'
    };
  }

  function filterAssignments(assignments, options) {
    if (!assignments) return [];
    const opts = options || {};
    const { courseId, fogMode, showCompleted, todayStr } = opts;

    return assignments.filter(a => {
      if (courseId && courseId !== 'all' && a.courseId !== courseId) {
        return false;
      }
      if (!showCompleted && a.completed) {
        return false;
      }
      if (fogMode) {
        const days = diffDays(todayStr, a.dueDate);
        const isUrgent = days <= 1;
        if (!isUrgent && !a.isEssential) {
          return false;
        }
      }
      return true;
    });
  }

  function calculateExamCountdown(examDate, todayStr) {
    if (!examDate) return { days: 0, label: 'Date pending', status: 'normal' };
    const days = diffDays(todayStr, examDate);
    if (days < 0) return { days: days, label: 'Exam completed', status: 'completed' };
    if (days === 0) return { days: 0, label: 'EXAM TODAY', status: 'critical' };
    if (days === 1) return { days: 1, label: 'Exam Tomorrow', status: 'urgent' };
    if (days <= 3) return { days: days, label: `${days} days left`, status: 'warning' };
    if (days <= 7) return { days: days, label: `${days} days left`, status: 'notice' };
    return { days: days, label: `${days} days left`, status: 'normal' };
  }

  return {
    toISODate: toISODate,
    addDays: addDays,
    diffDays: diffDays,
    sanitizeText: sanitizeText,
    calculateUrgency: calculateUrgency,
    percentageToLetter: percentageToLetter,
    calculateCourseGrade: calculateCourseGrade,
    calculateOverallGPA: calculateOverallGPA,
    dechunkAssignment: dechunkAssignment,
    getSingleFocusAction: getSingleFocusAction,
    calculateStreak: calculateStreak,
    filterAssignments: filterAssignments,
    calculateExamCountdown: calculateExamCountdown
  };
});
