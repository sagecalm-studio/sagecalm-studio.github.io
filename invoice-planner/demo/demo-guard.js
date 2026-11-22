/**
 * Invoice Planner (Edition 1: Sage Calm / Maya) — Demo Sandbox Guard
 * Isolates demo state into sessionStorage, seeds realistic invoice demo data with onboarded: false (Rule-18),
 * disables service workers in demo mode, and gates backup export with an Etsy conversion modal.
 */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = function () {
      return Promise.resolve();
    };
  }

  var DEMO_STORE_KEY = 'invoice_planner_data_v1';

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

  function relDate(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + offsetDays);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  if (!sessionStorage.getItem(DEMO_STORE_KEY)) {
    var today = relDate(0);
    var demoData = {
      version: 1,
      settings: {
        theme: 'sage-calm',
        currency: 'USD',
        businessName: 'Sage Creative Studio',
        payoutPreset: 'standard',
        defaultTerms: 'net14',
        defaultTaxPct: 25,
        monthlyTargetCents: 500000,
        nextInvoiceSeq: 104,
        sound: true,
        onboarded: false,
        fog: false,
        isSampleSeed: true,
        seqCounter: 10
      },
      accounts: [
        { id: 'acct_main', name: 'Business Checking', type: 'checking', balanceCents: 340000, balanceAsOf: today, updatedSeq: 2, isSample: true },
        { id: 'acct_tax', name: 'Tax Shield Vault', type: 'tax', balanceCents: 85000, balanceAsOf: today, updatedSeq: 2, isSample: true }
      ],
      invoices: [
        {
          id: 'inv_101',
          number: 'INV-101',
          client: 'Northstar Wellness Co.',
          title: 'Brand Identity & Packaging System',
          issueDate: relDate(-18),
          dueDate: relDate(-4),
          terms: 'net14',
          weekendEarly: true,
          status: 'sent',
          amountCents: 145000,
          discountPct: 0,
          taxPct: 0,
          depositCents: 0,
          items: [{ desc: 'Core Brand Strategy & Packaging Prep', qty: 1, unitCents: 145000 }],
          notes: 'Thank you for your collaboration!',
          paidAt: '',
          isSample: true
        },
        {
          id: 'inv_102',
          number: 'INV-102',
          client: 'Lumen Botanicals',
          title: 'Shopify Landing Page & Conversion Audit',
          issueDate: relDate(-9),
          dueDate: relDate(5),
          terms: 'net14',
          weekendEarly: true,
          status: 'sent',
          amountCents: 120000,
          discountPct: 0,
          taxPct: 0,
          depositCents: 30000,
          items: [{ desc: 'UX Wireframe & High-Converting Product Page', qty: 1, unitCents: 120000 }],
          notes: '25% deposit received.',
          paidAt: '',
          isSample: true
        },
        {
          id: 'inv_100',
          number: 'INV-100',
          client: 'Aether Audio Labs',
          title: 'UI Icon Suite & Design Tokens',
          issueDate: relDate(-25),
          dueDate: relDate(-11),
          terms: 'net14',
          weekendEarly: true,
          status: 'paid',
          amountCents: 160000,
          discountPct: 0,
          taxPct: 0,
          depositCents: 160000,
          items: [{ desc: 'Custom SVG Icon System (40 Icons)', qty: 1, unitCents: 160000 }],
          notes: 'Paid in full.',
          paidAt: relDate(-12),
          isSample: true
        }
      ],
      workItems: [
        { id: 'wi_1', client: 'Lumen Botanicals', title: 'Homepage Copy Polish & Mobile QA (3 hrs)', amountCents: 36000, date: today, billed: false, isSample: true }
      ],
      retainers: [
        { id: 'ret_1', client: 'Kindred Coffee Roasters', title: 'Monthly Growth & Email Retainer', amountCents: 85000, cycle: 'monthly', nextDate: relDate(4), status: 'active', isSample: true }
      ],
      transactions: [
        { id: 'tx_1', accountId: 'acct_main', title: 'Paid Invoice INV-100 (Aether Audio Labs)', amountCents: 160000, kind: 'inflow', category: 'Invoice Payment', date: relDate(-12), seq: 2, isSample: true }
      ],
      payouts: []
    };
    sessionStorage.setItem(DEMO_STORE_KEY, JSON.stringify(demoData));
  }

  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.createElement('div');
    banner.className = 'etsy-demo-banner';
    banner.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span>🌿 <strong>Live Interactive Demo:</strong> Invoice Planner (Sage Calm Edition)</span>' +
      '</div>' +
      '<div>' +
        '<a href="https://sagecalm-studio.github.io/invoice-planner/" target="_blank" class="etsy-demo-cta">' +
          '⚡ Unlock Full Lifetime App ($9.00)' +
        '</a>' +
      '</div>';
    document.body.prepend(banner);

    var modal = document.createElement('div');
    modal.className = 'etsy-demo-modal-overlay';
    modal.id = 'etsy-demo-modal';
    modal.innerHTML =
      '<div class="etsy-demo-modal-card">' +
        '<h3>✨ Own Your Calm Invoicing Sanctuary Forever</h3>' +
        '<p>You are test-driving the live demo sandbox. Get the complete lifetime edition on Etsy for permanent offline client storage, printable invoice worksheets, and zero subscriptions.</p>' +
        '<a href="https://sagecalm-studio.github.io/invoice-planner/" target="_blank" class="etsy-gate-btn-buy">' +
          'Get Instant Access on Etsy — $9.00' +
        '</a>' +
        '<br>' +
        '<button type="button" class="etsy-gate-btn-close" id="btn-close-demo-modal">Continue Test Drive</button>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('btn-close-demo-modal').addEventListener('click', function () {
      modal.classList.remove('active');
    });

    setTimeout(function () {
      var btnExport = document.getElementById('btn-export-json');
      if (btnExport) {
        btnExport.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          modal.classList.add('active');
        }, true);
      }
    }, 500);
  });
})();
