/**
 * ADHD Budget Planner - Multi-Persona Demo Engine
 * Generates dynamic, realistic mock data relative to the current live date.
 */

(function (global) {
  'use strict';

  const Personas = {};

  function getToday() {
    return (global.FocusEngine && global.FocusEngine.toISODate)
      ? global.FocusEngine.toISODate()
      : new Date().toISOString().split('T')[0];
  }

  function addDays(days) {
    const today = getToday();
    return (global.FocusEngine && global.FocusEngine.addDays)
      ? global.FocusEngine.addDays(today, days)
      : today;
  }

  // --- Persona 1: The 9-to-5 Debt Crusher (Jordan) ---
  Personas.createDebtCrusher = function () {
    const today = getToday();
    return {
      schema: 1,
      isDemo: true,
      activePersona: 'crusher',
      createdAt: today,
      updatedAt: today,
      profile: {
        preferredName: 'Jordan',
        currency: 'USD',
        oopsFundCents: 5000 // $50.00
      },
      accounts: [
        {
          id: 'acct-main',
          name: 'Primary Checking',
          kind: 'checking',
          balanceCents: 184000, // $1,840.00
          balanceAsOf: addDays(-2)
        }
      ],
      income: [
        {
          id: 'inc-1',
          label: 'Primary Paycheck (Bi-weekly)',
          amountCents: 215000, // $2,150.00
          cycle: 'biweekly',
          anchor: addDays(4), // Lands in 4 days!
          weekendEarly: true
        }
      ],
      bills: [
        {
          id: 'b-1',
          name: 'Apartment Rent',
          amountCents: 85000, // $850.00
          recurrence: 'monthly',
          dueDay: 1,
          paidDates: [],
          category: 'Housing'
        },
        {
          id: 'b-2',
          name: 'Phone & Internet',
          amountCents: 11000, // $110.00
          recurrence: 'monthly',
          dueDay: 14,
          paidDates: [],
          category: 'Utilities'
        },
        {
          id: 'b-3',
          name: 'Electric Bill',
          amountCents: 7500, // $75.00
          recurrence: 'monthly',
          dueDay: 22,
          paidDates: [],
          category: 'Utilities'
        }
      ],
      debts: [
        {
          id: 'd-1',
          name: 'Chase Sapphire Card',
          balanceCents: 320000, // $3,200.00
          aprBp: 2399, // 23.99%
          minPaymentCents: 8500, // $85.00
          isCreditCard: true,
          payInFull: false,
          autoHold: true
        },
        {
          id: 'd-2',
          name: 'Used Car Loan',
          balanceCents: 540000, // $5,400.00
          aprBp: 549, // 5.49%
          minPaymentCents: 17500, // $175.00
          isCreditCard: false,
          payInFull: false,
          autoHold: true
        }
      ],
      savings: [
        {
          id: 's-1',
          name: 'Emergency Cushion',
          targetCents: 200000, // $2,000.00
          savedCents: 85000,   // $850.00
          monthlyCents: 10000, // $100.00
          reserved: true
        }
      ],
      envelopes: [
        { id: 'env-1', name: 'Groceries', category: 'Groceries', capCents: 35000 },
        { id: 'env-2', name: 'Guilt-Free Fun', category: 'Fun', capCents: 15000 }
      ],
      transactions: [
        { id: 't-1', date: today, category: 'Food', note: 'Morning Coffee', amountCents: 525, kind: 'spend' },
        { id: 't-2', date: addDays(-1), category: 'Groceries', note: 'Trader Joe’s haul', amountCents: 6420, kind: 'spend' }
      ],
      impulseVault: [
        {
          id: 'imp-1',
          title: 'Noise Cancelling Headphones',
          priceCents: 17900,
          dateAdded: addDays(-1),
          hoursTimer: 48,
          status: 'cooling',
          notes: 'Saw on TikTok sale. Do I actually need it?'
        }
      ],
      brainDump: [
        { id: 'bd-1', text: 'Cancel gym subscription before 28th', done: false, createdAt: today },
        { id: 'bd-2', text: 'Ask boss about dental reimbursement', done: true, createdAt: addDays(-2) }
      ],
      ui: {
        theme: 'sage-calm',
        zombieMode: false,
        soundEnabled: true
      }
    };
  };

  // --- Persona 2: The Freelancer / Irregular Income (Maya) ---
  Personas.createFreelancer = function () {
    const today = getToday();
    return {
      schema: 1,
      isDemo: true,
      activePersona: 'freelancer',
      createdAt: today,
      updatedAt: today,
      profile: {
        preferredName: 'Maya',
        currency: 'USD',
        oopsFundCents: 10000 // $100.00
      },
      accounts: [
        {
          id: 'acct-main',
          name: 'Business & Living Checking',
          kind: 'checking',
          balanceCents: 385000, // $3,850.00
          balanceAsOf: addDays(-1)
        }
      ],
      income: [
        {
          id: 'inc-f1',
          label: 'Client Retainer A',
          amountCents: 180000,
          cycle: 'monthly',
          dueDay: 5,
          anchor: addDays(5),
          weekendEarly: true
        },
        {
          id: 'inc-f2',
          label: 'Client Retainer B',
          amountCents: 140000,
          cycle: 'monthly',
          dueDay: 20,
          anchor: addDays(20),
          weekendEarly: true
        }
      ],
      bills: [
        { id: 'bf-1', name: 'Studio Workspace', amountCents: 62000, recurrence: 'monthly', dueDay: 1, paidDates: [], category: 'Business' },
        { id: 'bf-2', name: 'Adobe & Software Tools', amountCents: 8500, recurrence: 'monthly', dueDay: 15, paidDates: [], category: 'Subscriptions' },
        { id: 'bf-3', name: 'Health Insurance', amountCents: 31000, recurrence: 'monthly', dueDay: 25, paidDates: [], category: 'Health' }
      ],
      debts: [],
      savings: [
        { id: 'sf-1', name: 'Quarterly Tax Buffer', targetCents: 300000, savedCents: 190000, monthlyCents: 45000, reserved: true },
        { id: 'sf-2', name: 'New Camera Lens', targetCents: 90000, savedCents: 45000, monthlyCents: 15000, reserved: false }
      ],
      envelopes: [
        { id: 'env-f1', name: 'Dining & Cafes', category: 'Dining', capCents: 30000 },
        { id: 'env-f2', name: 'Self-Care', category: 'Health', capCents: 12000 }
      ],
      transactions: [
        { id: 'tf-1', date: today, category: 'Dining', note: 'Matcha Latte while working', amountCents: 675, kind: 'spend' }
      ],
      impulseVault: [
        {
          id: 'imp-f1',
          title: 'Ergonomic Desk Chair',
          priceCents: 35000,
          dateAdded: addDays(-2),
          hoursTimer: 48,
          status: 'unlocked', // 48 hours passed! Ready for decision
          notes: 'Back hurts, but do I want Herman Miller or generic?'
        }
      ],
      brainDump: [
        { id: 'bd-f1', text: 'Send invoice #104 to Client Acme', done: false, createdAt: today }
      ],
      ui: {
        theme: 'oled-dark',
        zombieMode: false,
        soundEnabled: true
      }
    };
  };

  // --- Persona 3: The College Student (Liam) ---
  Personas.createStudent = function () {
    const today = getToday();
    return {
      schema: 1,
      isDemo: true,
      activePersona: 'student',
      createdAt: today,
      updatedAt: today,
      profile: {
        preferredName: 'Liam',
        currency: 'USD',
        oopsFundCents: 2500 // $25.00
      },
      accounts: [
        {
          id: 'acct-main',
          name: 'Student Checking',
          kind: 'checking',
          balanceCents: 62000, // $620.00
          balanceAsOf: today
        }
      ],
      income: [
        {
          id: 'inc-s1',
          label: 'Campus Bookstore Wages',
          amountCents: 42000, // $420.00 weekly
          cycle: 'weekly',
          anchor: addDays(3),
          weekendEarly: true
        }
      ],
      bills: [
        { id: 'bs-1', name: 'Shared Room Rent', amountCents: 45000, recurrence: 'monthly', dueDay: 1, paidDates: [], category: 'Housing' },
        { id: 'bs-2', name: 'Spotify + Hulu Student', amountCents: 599, recurrence: 'monthly', dueDay: 12, paidDates: [], category: 'Subscriptions' },
        { id: 'bs-3', name: 'Transit Bus Pass', amountCents: 4500, recurrence: 'monthly', dueDay: 18, paidDates: [], category: 'Transit' }
      ],
      debts: [],
      savings: [
        { id: 'ss-1', name: 'Spring Break Roadtrip', targetCents: 40000, savedCents: 18000, monthlyCents: 5000, reserved: false }
      ],
      envelopes: [
        { id: 'env-s1', name: 'Groceries & Ramen', category: 'Food', capCents: 18000 },
        { id: 'env-s2', name: 'Weekend Outings', category: 'Social', capCents: 6000 }
      ],
      transactions: [
        { id: 'ts-1', date: today, category: 'Food', note: 'Chipotle Burrito Bowl', amountCents: 1150, kind: 'spend' }
      ],
      impulseVault: [],
      brainDump: [
        { id: 'bd-s1', text: 'Split electricity bill with roommate Sarah', done: false, createdAt: today }
      ],
      ui: {
        theme: 'warm-earth',
        zombieMode: false,
        soundEnabled: true
      }
    };
  };

  Personas.loadPersona = function (personaKey) {
    if (personaKey === 'freelancer') return Personas.createFreelancer();
    if (personaKey === 'student') return Personas.createStudent();
    return Personas.createDebtCrusher();
  };

  global.FocusPersonas = Personas;

})(typeof window !== 'undefined' ? window : this);
