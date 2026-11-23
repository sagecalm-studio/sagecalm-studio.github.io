/**
 * End of Life Planner (Edition 1: Sage Calm Studio / Maya) — Demo Sandbox Guard
 * Isolates demo state into sessionStorage, seeds sample legacy data with onboarded: false (Rule-18),
 * disables service worker registration in demo mode, and gates backup export & packet print with Etsy CTA.
 */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve();
    };
  }

  var DEMO_STORE_KEY = 'end_of_life_planner_data_v1';

  var origGetItem = localStorage.getItem.bind(localStorage);
  var origSetItem = localStorage.setItem.bind(localStorage);
  var origRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.getItem = function (k) {
    if (k === DEMO_STORE_KEY) return sessionStorage.getItem(k);
    return origGetItem(k);
  };
  localStorage.setItem = function (k, v) {
    if (k === DEMO_STORE_KEY) return sessionStorage.setItem(k, v);
    return origSetItem(k, v);
  };
  localStorage.removeItem = function (k) {
    if (k === DEMO_STORE_KEY) return sessionStorage.removeItem(k);
    return origRemoveItem(k);
  };

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  if (!sessionStorage.getItem(DEMO_STORE_KEY)) {
    var today = todayISO();
    var demoData = {
      version: 1,
      settings: {
        theme: 'sage-calm',
        currency: 'USD',
        ownerName: 'Alex Morgan (Live Demo)',
        safeLocation: 'Fireproof Safe — Master Closet Top Shelf',
        reviewCadenceMonths: 12,
        lastReviewed: today,
        shiftWeekendReview: true,
        sound: true,
        onboarded: false,
        fog: false,
        isSampleSeed: true,
        seqCounter: 10
      },
      vaultMeta: {
        passwordManager: 'Bitwarden Family Vault',
        recoveryKitLocation: 'Sealed Emergency Sheet in Home Fireproof Safe',
        legacyContactNote: 'Apple Legacy Contact set to Elena Morgan'
      },
      wishes: {
        disposition: 'Cremation with ashes scattered at Pine Ridge Lake',
        organDonation: 'Yes — registered organ & tissue donor',
        serviceTone: 'Warm outdoor celebration of life',
        musicReadings: 'Acoustic playlist & Mary Oliver poem',
        serviceNotes: 'Keep flowers minimal; donations to Local Animal Rescue welcome.',
        obituaryNotes: ''
      },
      contacts: [
        { id: 'cnt_1', name: 'Elena Morgan', relation: 'Spouse & Primary Executor', role: 'executor', phone: '(555) 210-4812', email: 'elena.demo@example.com', isFirstCall: true, notes: 'Holds safe access & house keys.', isSample: true },
        { id: 'cnt_2', name: 'David Chen, Esq.', relation: 'Estate Attorney', role: 'legal', phone: '(555) 394-7720', email: 'dchen.demo@example.com', isFirstCall: false, notes: 'Holds signed Will & POA.', isSample: true }
      ],
      dependents: [
        { id: 'dep_1', name: 'Milo (Golden Retriever)', type: 'pet', guardianContactId: 'cnt_1', careNotes: '1 cup salmon kibble AM/PM; Oak Creek Vet.', isSample: true }
      ],
      documents: [
        { id: 'doc_1', title: 'Last Will & Testament (Notarized)', category: 'Legal', status: 'signed', location: 'Fireproof Safe — Blue Folder #1', custodianContactId: 'cnt_2', updatedAt: today, isSample: true },
        { id: 'doc_2', title: 'Advance Healthcare Directive', category: 'Medical', status: 'signed', location: 'Fireproof Safe + Clinic Portal', custodianContactId: 'cnt_1', updatedAt: today, isSample: true },
        { id: 'doc_3', title: 'Durable Financial POA', category: 'Legal', status: 'drafting', location: 'Pending notary signing', custodianContactId: 'cnt_1', updatedAt: today, isSample: true }
      ],
      accounts: [
        { id: 'acc_1', name: 'Primary Joint Checking', institution: 'Summit Credit Union', last4: '4821', kind: 'asset', balanceCents: 1850000, balanceAsOf: today, updatedSeq: 2, beneficiaryContactId: 'cnt_1', locationHint: 'Joint survivor access', isSample: true },
        { id: 'acc_2', name: '20-Year Term Life Insurance', institution: 'MassMutual', last4: '7710', kind: 'policy', balanceCents: 50000000, balanceAsOf: today, updatedSeq: 2, beneficiaryContactId: 'cnt_1', locationHint: 'Policy in Safe Folder #2', isSample: true },
        { id: 'acc_3', name: 'Home Mortgage Balance', institution: 'First Horizon', last4: '1102', kind: 'debt', balanceCents: 18500000, balanceAsOf: today, updatedSeq: 2, beneficiaryContactId: '', locationHint: 'Auto-draft from Checking #4821', isSample: true }
      ],
      adjustments: [],
      autopays: [
        { id: 'ap_1', title: 'Home Utilities & Fiber Internet', amountCents: 21500, cycle: 'monthly', paymentMethod: 'Checking #4821', actionNote: 'Keep until home transfer', status: 'active', isSample: true }
      ],
      digital: [
        { id: 'dig_1', service: 'Primary Email (Gmail)', handle: 'alex.demo@example.com', directive: 'archive', accessHint: 'Bitwarden Vault + Inactive Manager', isSample: true },
        { id: 'dig_2', service: 'iCloud Family Photo Library', handle: 'Apple ID', directive: 'transfer', accessHint: 'Apple Legacy Contact key in Safe', isSample: true }
      ],
      letters: [
        { id: 'let_1', recipientName: 'Elena & Family', recipientContactId: 'cnt_1', title: 'Open When Ready', body: 'Everything practical is organized here so you can rest and care for each other.', updatedAt: today, isSample: true }
      ],
      checklist: [
        { id: 'chk_1', phase: '24h', title: 'Notify immediate family & primary executor', notes: 'See First-Call Circle', completed: true, isSample: true },
        { id: 'chk_2', phase: '24h', title: 'Arrange immediate care for dependents & pets', notes: 'Check care protocols', completed: false, isSample: true },
        { id: 'chk_3', phase: 'week1', title: 'Order 8–10 certified Death Certificates', notes: 'Via funeral director', completed: false, isSample: true },
        { id: 'chk_4', phase: 'month1', title: 'File life insurance claims & cancel auto-pays', notes: 'See Estate Vault', completed: false, isSample: true }
      ]
    };
    sessionStorage.setItem(DEMO_STORE_KEY, JSON.stringify(demoData));
  }

  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.createElement('div');
    banner.className = 'etsy-demo-banner';
    banner.innerHTML =
      '<div><strong>Live Interactive Demo:</strong> End of Life Planner (Sage Calm Edition) · Data resets on refresh</div>' +
      '<a href="https://sagecalm-studio.github.io/end-of-life-planner/" target="_blank" class="etsy-demo-cta">Unlock Lifetime App on Etsy ($9.00)</a>';
    document.body.prepend(banner);

    var modal = document.createElement('div');
    modal.className = 'etsy-demo-modal-overlay';
    modal.id = 'etsy-demo-modal';
    modal.innerHTML =
      '<div class="etsy-demo-modal-card">' +
        '<h3>Own Your Private Legacy Vault Forever</h3>' +
        '<p>You are test-driving the interactive demo sandbox. Unlock the full lifetime edition on Etsy for permanent offline storage, printable Executor Packet PDFs, and zero subscriptions.</p>' +
        '<a href="https://sagecalm-studio.github.io/end-of-life-planner/" target="_blank" class="etsy-gate-btn-buy">Get Instant Access on Etsy — $9.00</a>' +
        '<br>' +
        '<button type="button" class="etsy-gate-btn-close" id="btn-close-demo-modal">Continue Test Drive</button>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('btn-close-demo-modal').addEventListener('click', function () {
      modal.classList.remove('active');
    });

    setTimeout(function () {
      ['btn-export-json', 'btn-print-packet'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) {
          btn.addEventListener('click', function (e) {
            e.stopImmediatePropagation();
            modal.classList.add('active');
          }, true);
        }
      });
    }, 450);
  });
})();
