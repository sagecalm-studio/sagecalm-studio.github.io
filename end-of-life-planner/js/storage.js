/**
 * End of Life Planner — Offline Storage, Schema Sanitizer & Clean-Slate State Manager
 * Enforces: 100% localStorage privacy, corrupt JSON recovery (G-12),
 * anti-double-counting sequence counters, and post-tour Clean Slate transition (G-22).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./engine.js'));
  } else {
    root.EOLStorage = factory(root.EOLEngine);
  }
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var STORAGE_KEY = 'end_of_life_planner_data_v1';
  var SCHEMA_VERSION = 1;

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  function defaultChecklist(isSample) {
    return [
      { id: 'chk_1', phase: '24h', title: 'Notify immediate family & primary executor', notes: 'See First-Call Circle', completed: !!isSample, isSample: !!isSample },
      { id: 'chk_2', phase: '24h', title: 'Arrange immediate care for dependents & pets', notes: 'Check feeding/med protocols', completed: false, isSample: !!isSample },
      { id: 'chk_3', phase: '24h', title: 'Secure residence, vehicles, keys & incoming mail', notes: 'Lock doors, pause deliveries', completed: false, isSample: !!isSample },
      { id: 'chk_4', phase: 'week1', title: 'Order 8–10 certified Death Certificates', notes: 'Usually ordered via funeral home', completed: false, isSample: !!isSample },
      { id: 'chk_5', phase: 'week1', title: 'Locate signed Will & contact Estate Attorney', notes: 'See Legal Document Map', completed: false, isSample: !!isSample },
      { id: 'chk_6', phase: 'week1', title: 'Review burial/cremation wishes & notify employer HR', notes: 'Check workplace life benefits', completed: false, isSample: !!isSample },
      { id: 'chk_7', phase: 'month1', title: 'File life insurance claims & notify banks', notes: 'Use Estate & Policies tab', completed: false, isSample: !!isSample },
      { id: 'chk_8', phase: 'month1', title: 'Cancel/transfer recurring auto-pay bills & subscriptions', notes: 'Check Auto-Pay Register', completed: false, isSample: !!isSample },
      { id: 'chk_9', phase: 'month1', title: 'Execute Digital Legacy directives (memorialize/close)', notes: 'See Digital Legacy Keys', completed: false, isSample: !!isSample }
    ];
  }

  function getCleanSlateData(themeId) {
    var today = E ? E.todayLocalISO() : '2026-11-23';
    return {
      version: SCHEMA_VERSION,
      settings: {
        theme: themeId || 'sage-calm',
        currency: 'USD',
        ownerName: '',
        safeLocation: '',
        reviewCadenceMonths: 12,
        lastReviewed: today,
        shiftWeekendReview: true,
        sound: true,
        onboarded: true,
        fog: false,
        isSampleSeed: false,
        seqCounter: 1
      },
      vaultMeta: {
        passwordManager: '',
        recoveryKitLocation: '',
        legacyContactNote: ''
      },
      wishes: {
        disposition: '',
        organDonation: '',
        serviceTone: '',
        musicReadings: '',
        serviceNotes: '',
        obituaryNotes: ''
      },
      contacts: [],
      dependents: [],
      documents: [],
      accounts: [],
      adjustments: [],
      autopays: [],
      digital: [],
      letters: [],
      checklist: defaultChecklist(false)
    };
  }

  function getSampleData(themeId, onboardedFlag) {
    var today = E ? E.todayLocalISO() : '2026-11-23';
    var lastRev = E ? E.addMonthsUTC(today, -10) : today;
    return {
      version: SCHEMA_VERSION,
      settings: {
        theme: themeId || 'sage-calm',
        currency: 'USD',
        ownerName: 'Alex Morgan (Sample)',
        safeLocation: 'Fireproof Safe — Master Closet Top Shelf (Code in Password Manager)',
        reviewCadenceMonths: 12,
        lastReviewed: lastRev,
        shiftWeekendReview: true,
        sound: true,
        onboarded: !!onboardedFlag,
        fog: false,
        isSampleSeed: true,
        seqCounter: 10
      },
      vaultMeta: {
        passwordManager: 'Bitwarden Family Vault',
        recoveryKitLocation: 'Sealed Emergency Sheet in Home Fireproof Safe',
        legacyContactNote: 'Apple Legacy Contact & Google Inactive Account set to Elena Morgan'
      },
      wishes: {
        disposition: 'Cremation with ashes scattered at Pine Ridge Lake',
        organDonation: 'Yes — registered organ & tissue donor',
        serviceTone: 'Warm outdoor celebration of life (casual attire, no formal wake)',
        musicReadings: 'Acoustic playlist "Sunday Morning" & Mary Oliver poem',
        serviceNotes: 'Please keep flowers minimal; donations to Local Animal Rescue welcome.',
        obituaryNotes: 'Loved hiking, baking sourdough, rescuing senior dogs, and Sunday family dinners.'
      },
      contacts: [
        { id: 'cnt_1', name: 'Elena Morgan', relation: 'Spouse & Primary Executor', role: 'executor', phone: '(555) 210-4812', email: 'elena.sample@example.com', isFirstCall: true, notes: 'Knows safe code and holds backup house key.', isSample: true },
        { id: 'cnt_2', name: 'David Chen, Esq.', relation: 'Estate Attorney', role: 'legal', phone: '(555) 394-7720', email: 'dchen.law@example.com', isFirstCall: false, notes: 'Holds original notarized Will & Medical POA.', isSample: true },
        { id: 'cnt_3', name: 'Dr. Priya Nair', relation: 'Primary Care Physician', role: 'medical', phone: '(555) 602-1194', email: 'clinic@example.com', isFirstCall: false, notes: 'Has Advance Healthcare Directive on file.', isSample: true }
      ],
      dependents: [
        { id: 'dep_1', name: 'Milo (Golden Retriever, 8 yrs)', type: 'pet', guardianContactId: 'cnt_1', careNotes: '1 cup salmon kibble AM/PM; joint chew every morning. Vet: Oak Creek Vet (555-881-2240).', isSample: true }
      ],
      documents: [
        { id: 'doc_1', title: 'Last Will & Testament (Notarized)', category: 'Legal', status: 'signed', location: 'Fireproof Safe (Blue Folder) + Copy with David Chen, Esq.', custodianContactId: 'cnt_2', updatedAt: today, isSample: true },
        { id: 'doc_2', title: 'Advance Healthcare Directive & Medical POA', category: 'Medical', status: 'signed', location: 'Fireproof Safe + Oak Creek Clinic Portal', custodianContactId: 'cnt_3', updatedAt: today, isSample: true },
        { id: 'doc_3', title: 'Durable Financial Power of Attorney', category: 'Legal', status: 'drafting', location: 'Pending notary signing next month', custodianContactId: 'cnt_1', updatedAt: today, isSample: true },
        { id: 'doc_4', title: 'Birth Certificate, Passport & Marriage License', category: 'Vital', status: 'located', location: 'Fireproof Safe — Clear Sleeve #1', custodianContactId: 'cnt_1', updatedAt: today, isSample: true }
      ],
      accounts: [
        { id: 'acc_1', name: 'Primary Joint Checking', institution: 'Summit Credit Union', last4: '4821', kind: 'asset', balanceCents: 1850000, balanceAsOf: today, updatedSeq: 2, beneficiaryContactId: 'cnt_1', locationHint: 'Joint account — immediate survivor access', isSample: true },
        { id: 'acc_2', name: 'Retirement 401(k) & Index IRA', institution: 'Vanguard', last4: '9034', kind: 'asset', balanceCents: 14200000, balanceAsOf: today, updatedSeq: 2, beneficiaryContactId: 'cnt_1', locationHint: 'Primary beneficiary designated online', isSample: true },
        { id: 'acc_3', name: '20-Year Term Life Insurance Policy', institution: 'Haven / MassMutual', last4: '7710', kind: 'policy', balanceCents: 50000000, balanceAsOf: today, updatedSeq: 2, beneficiaryContactId: 'cnt_1', locationHint: 'Policy packet in Fireproof Safe — Folder #2', isSample: true },
        { id: 'acc_4', name: 'Home Mortgage Balance', institution: 'First Horizon Lending', last4: '1102', kind: 'debt', balanceCents: 18500000, balanceAsOf: today, updatedSeq: 2, beneficiaryContactId: '', locationHint: 'Auto-drafted on 1st of month from Checking #4821', isSample: true }
      ],
      adjustments: [],
      autopays: [
        { id: 'ap_1', title: 'Home Utilities & Fiber Internet', amountCents: 21500, cycle: 'monthly', paymentMethod: 'Checking #4821', actionNote: 'Keep active until home transfer', status: 'active', isSample: true },
        { id: 'ap_2', title: 'Streaming & Cloud Storage Bundles', amountCents: 4800, cycle: 'monthly', paymentMethod: 'Rewards Visa #3019', actionNote: 'Cancel within first month', status: 'active', isSample: true }
      ],
      digital: [
        { id: 'dig_1', service: 'Primary Email (Gmail)', handle: 'alex.morgan@example.com', directive: 'archive', accessHint: 'Bitwarden Vault + Google Inactive Account Manager', isSample: true },
        { id: 'dig_2', service: 'iCloud Family Photo Library', handle: 'Apple ID', directive: 'transfer', accessHint: 'Apple Legacy Contact key printed in Safe', isSample: true },
        { id: 'dig_3', service: 'Social Media Profiles (Instagram / LinkedIn)', handle: '@alexmorgan', directive: 'memorialize', accessHint: 'Submit certificate via platform legacy form', isSample: true }
      ],
      letters: [
        { id: 'let_1', recipientName: 'Elena & Family', recipientContactId: 'cnt_1', title: 'Open When You Need a Reminder', body: 'Thank you for filling every ordinary Tuesday with laughter. Everything practical is organized in this planner so you can rest and take care of each other.', updatedAt: today, isSample: true }
      ],
      checklist: defaultChecklist(true)
    };
  }

  function str(v, maxLen, fallback) {
    if (v === null || v === undefined) return fallback || '';
    var s = String(v).trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  function sanitize(raw, defaultTheme) {
    var base = getCleanSlateData(defaultTheme || 'sage-calm');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

    var s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    var today = E ? E.todayLocalISO() : '2026-11-23';
    base.settings = {
      theme: str(s.theme, 40, defaultTheme || 'sage-calm'),
      currency: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].indexOf(s.currency) >= 0 ? s.currency : 'USD',
      ownerName: str(s.ownerName, 100, ''),
      safeLocation: str(s.safeLocation, 240, ''),
      reviewCadenceMonths: E ? E.clamp(Math.round(E.safeNumber(s.reviewCadenceMonths, 12)), 1, 60) : 12,
      lastReviewed: (E && E.parseISODate(s.lastReviewed) !== null) ? s.lastReviewed : today,
      shiftWeekendReview: s.shiftWeekendReview !== false,
      sound: s.sound !== false,
      onboarded: !!s.onboarded,
      fog: !!s.fog,
      isSampleSeed: !!s.isSampleSeed,
      seqCounter: E ? Math.max(1, Math.round(E.safeNumber(s.seqCounter, 1))) : 1
    };

    var vm = raw.vaultMeta && typeof raw.vaultMeta === 'object' ? raw.vaultMeta : {};
    base.vaultMeta = {
      passwordManager: str(vm.passwordManager, 120, ''),
      recoveryKitLocation: str(vm.recoveryKitLocation, 220, ''),
      legacyContactNote: str(vm.legacyContactNote, 240, '')
    };

    var w = raw.wishes && typeof raw.wishes === 'object' ? raw.wishes : {};
    base.wishes = {
      disposition: str(w.disposition, 200, ''),
      organDonation: str(w.organDonation, 120, ''),
      serviceTone: str(w.serviceTone, 200, ''),
      musicReadings: str(w.musicReadings, 240, ''),
      serviceNotes: str(w.serviceNotes, 600, ''),
      obituaryNotes: str(w.obituaryNotes, 800, '')
    };

    base.contacts = Array.isArray(raw.contacts) ? raw.contacts.filter(Boolean).map(function (c) {
      return {
        id: str(c.id, 40, uid('cnt')),
        name: str(c.name, 100, 'Unnamed Contact'),
        relation: str(c.relation, 100, ''),
        role: ['executor', 'family', 'legal', 'medical', 'advisor', 'other'].indexOf(c.role) >= 0 ? c.role : 'family',
        phone: str(c.phone, 40, ''),
        email: str(c.email, 120, ''),
        isFirstCall: !!c.isFirstCall,
        notes: str(c.notes, 300, ''),
        isSample: !!c.isSample
      };
    }) : [];

    base.dependents = Array.isArray(raw.dependents) ? raw.dependents.filter(Boolean).map(function (dp) {
      return {
        id: str(dp.id, 40, uid('dep')),
        name: str(dp.name, 100, 'Dependent / Pet'),
        type: dp.type === 'child' || dp.type === 'adult' ? dp.type : 'pet',
        guardianContactId: str(dp.guardianContactId, 40, ''),
        careNotes: str(dp.careNotes, 400, ''),
        isSample: !!dp.isSample
      };
    }) : [];

    base.documents = Array.isArray(raw.documents) ? raw.documents.filter(Boolean).map(function (doc) {
      return {
        id: str(doc.id, 40, uid('doc')),
        title: str(doc.title, 120, 'Document'),
        category: str(doc.category, 40, 'Legal'),
        status: ['missing', 'drafting', 'located', 'signed'].indexOf(doc.status) >= 0 ? doc.status : 'missing',
        location: str(doc.location, 220, ''),
        custodianContactId: str(doc.custodianContactId, 40, ''),
        updatedAt: (E && E.parseISODate(doc.updatedAt) !== null) ? doc.updatedAt : today,
        isSample: !!doc.isSample
      };
    }) : [];

    base.accounts = Array.isArray(raw.accounts) ? raw.accounts.filter(Boolean).map(function (a) {
      return {
        id: str(a.id, 40, uid('acc')),
        name: str(a.name, 100, 'Account'),
        institution: str(a.institution, 100, ''),
        last4: str(a.last4, 10, ''),
        kind: ['asset', 'policy', 'debt'].indexOf(a.kind) >= 0 ? a.kind : 'asset',
        balanceCents: E ? Math.round(E.safeNumber(a.balanceCents, 0)) : 0,
        balanceAsOf: (E && E.parseISODate(a.balanceAsOf) !== null) ? a.balanceAsOf : today,
        updatedSeq: E ? Math.max(0, Math.round(E.safeNumber(a.updatedSeq, 0))) : 0,
        beneficiaryContactId: str(a.beneficiaryContactId, 40, ''),
        locationHint: str(a.locationHint, 220, ''),
        isSample: !!a.isSample
      };
    }) : [];

    base.adjustments = Array.isArray(raw.adjustments) ? raw.adjustments.filter(Boolean).map(function (adj) {
      return {
        id: str(adj.id, 40, uid('adj')),
        accountId: str(adj.accountId, 40, ''),
        deltaCents: E ? Math.round(E.safeNumber(adj.deltaCents, 0)) : 0,
        date: (E && E.parseISODate(adj.date) !== null) ? adj.date : today,
        seq: E ? Math.max(0, Math.round(E.safeNumber(adj.seq, 0))) : 0,
        note: str(adj.note, 140, '')
      };
    }) : [];

    base.autopays = Array.isArray(raw.autopays) ? raw.autopays.filter(Boolean).map(function (ap) {
      return {
        id: str(ap.id, 40, uid('ap')),
        title: str(ap.title, 100, 'Recurring Bill'),
        amountCents: E ? Math.max(0, Math.round(E.safeNumber(ap.amountCents, 0))) : 0,
        cycle: ['monthly', 'yearly', 'quarterly', 'weekly'].indexOf(ap.cycle) >= 0 ? ap.cycle : 'monthly',
        paymentMethod: str(ap.paymentMethod, 80, ''),
        actionNote: str(ap.actionNote, 180, ''),
        status: ap.status === 'cancelled' ? 'cancelled' : 'active',
        isSample: !!ap.isSample
      };
    }) : [];

    base.digital = Array.isArray(raw.digital) ? raw.digital.filter(Boolean).map(function (dg) {
      return {
        id: str(dg.id, 40, uid('dig')),
        service: str(dg.service, 100, 'Online Account'),
        handle: str(dg.handle, 120, ''),
        directive: ['memorialize', 'delete', 'transfer', 'archive'].indexOf(dg.directive) >= 0 ? dg.directive : 'archive',
        accessHint: str(dg.accessHint, 220, ''),
        isSample: !!dg.isSample
      };
    }) : [];

    base.letters = Array.isArray(raw.letters) ? raw.letters.filter(Boolean).map(function (lt) {
      return {
        id: str(lt.id, 40, uid('let')),
        recipientName: str(lt.recipientName, 100, 'Loved One'),
        recipientContactId: str(lt.recipientContactId, 40, ''),
        title: str(lt.title, 120, 'Personal Note'),
        body: str(lt.body, 2500, ''),
        updatedAt: (E && E.parseISODate(lt.updatedAt) !== null) ? lt.updatedAt : today,
        isSample: !!lt.isSample
      };
    }) : [];

    base.checklist = Array.isArray(raw.checklist) && raw.checklist.length > 0 ? raw.checklist.filter(Boolean).map(function (ck) {
      return {
        id: str(ck.id, 40, uid('chk')),
        phase: ['24h', 'week1', 'month1'].indexOf(ck.phase) >= 0 ? ck.phase : 'month1',
        title: str(ck.title, 160, 'Executor Step'),
        notes: str(ck.notes, 200, ''),
        completed: !!ck.completed,
        isSample: !!ck.isSample
      };
    }) : defaultChecklist(false);

    return base;
  }

  function hasCustomUserData(data) {
    if (!data || typeof data !== 'object') return false;
    var arrays = ['contacts', 'dependents', 'documents', 'accounts', 'autopays', 'digital', 'letters'];
    for (var i = 0; i < arrays.length; i++) {
      var arr = data[arrays[i]];
      if (Array.isArray(arr) && arr.some(function (item) { return item && !item.isSample; })) {
        return true;
      }
    }
    return false;
  }

  /**
   * Rule-22: Transitions default sample seed data to a welcoming Clean Slate after tour exit,
   * while strictly preserving any custom entries the user has added unless force=true.
   */
  function cleanSlate(currentData, force, defaultTheme) {
    var theme = (currentData && currentData.settings && currentData.settings.theme) || defaultTheme || 'sage-calm';
    var currency = (currentData && currentData.settings && currentData.settings.currency) || 'USD';
    if (!force && currentData && hasCustomUserData(currentData)) {
      currentData.settings.onboarded = true;
      currentData.settings.isSampleSeed = false;
      return currentData;
    }
    var fresh = getCleanSlateData(theme);
    fresh.settings.currency = currency;
    fresh.settings.onboarded = true;
    return fresh;
  }

  function load(defaultTheme) {
    try {
      if (typeof localStorage === 'undefined') return getSampleData(defaultTheme, false);
      var rawStr = localStorage.getItem(STORAGE_KEY);
      if (!rawStr) {
        var seed = getSampleData(defaultTheme, false);
        save(seed);
        return seed;
      }
      var parsed = JSON.parse(rawStr);
      var clean = sanitize(parsed, defaultTheme);
      // Rule-22 self-healing startup purge: if onboarded is already true and only sample seed remains, transition cleanly
      if (clean.settings.onboarded && clean.settings.isSampleSeed && !hasCustomUserData(clean)) {
        clean = cleanSlate(clean, true, defaultTheme);
        save(clean);
      }
      return clean;
    } catch (err) {
      return getCleanSlateData(defaultTheme);
    }
  }

  function save(data) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  function exportJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(jsonStr, defaultTheme) {
    try {
      var parsed = JSON.parse(jsonStr);
      var clean = sanitize(parsed, defaultTheme);
      clean.settings.isSampleSeed = false;
      clean.settings.onboarded = true;
      return { ok: true, data: clean };
    } catch (err) {
      return { ok: false, error: 'Invalid backup file format.' };
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    uid: uid,
    defaultChecklist: defaultChecklist,
    getCleanSlateData: getCleanSlateData,
    getSampleData: getSampleData,
    sanitize: sanitize,
    hasCustomUserData: hasCustomUserData,
    cleanSlate: cleanSlate,
    load: load,
    save: save,
    exportJSON: exportJSON,
    importJSON: importJSON
  };
});
