/**
 * Invoice Planner — Edition 1 UI Controller (Sage Calm Studio / Maya).
 * All invoicing math lives in IPEngine, all state mutations in IPStorage.
 * Enforces Rules 01-23 (try/catch init isolation, post-tour clean slate, data-active-tab binding, zero undefined).
 */
(function () {
  'use strict';

  var E = window.IPEngine;
  var S = window.IPStorage;
  var CFG = window.IPConfig;
  var T = window.IPTutorial;

  function today() { return E.todayStr(new Date()); }

  var rawStored = null;
  try { rawStored = window.localStorage.getItem(CFG.storageKey); } catch (e) {}
  var data = S.load(window.localStorage, CFG.storageKey, today());

  // Seed tutorial sample data ONLY on a brand-new first visit before onboarding completes
  if (!rawStored && !data.settings.onboarded) {
    data = S.getSampleData(today());
    data.settings.onboarded = false;
  }

  var activeTab = CFG.defaultTab;
  var invFilter = 'all';
  var selectedPreset = data.settings.payoutPreset || 'standard';
  var selectedTone = 'warm';
  var selectedFollowupId = '';
  var previewInvoiceId = '';
  var confirmAction = null;
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return E.escapeHtml(s); }
  function cur() { return (data && data.settings && data.settings.currency) || 'USD'; }
  function fmt(cents, signed) { return E.fmtCents(cents, cur(), signed); }
  function commit() { S.save(window.localStorage, CFG.storageKey, data); }

  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function beep(freq, ms) {
    if (!data.settings || !data.settings.sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.frequency.value = freq || 640;
      g.gain.value = 0.06;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(function () { o.stop(); ctx.close(); }, ms || 150);
    } catch (e) {}
  }

  // ---------- Clean Slate Transition (Rule-22) ----------
  function setCleanSlateState(forceWipe) {
    if (forceWipe || (data && data.settings && data.settings.isSampleSeed)) {
      data = S.cleanSlate(data, today(), !!forceWipe);
      commit();
      renderAll();
    }
  }
  window.setCleanSlateState = setCleanSlateState;

  function loadSampleData() {
    data = S.getSampleData(today());
    data.settings.onboarded = true;
    commit();
    renderAll();
    toast('Sample client & invoice data loaded.');
  }

  // ---------- Navigation (Rule-11, Rule-15) ----------
  function switchTab(tab) {
    if (CFG.tabs.indexOf(tab) < 0) tab = CFG.defaultTab;
    activeTab = tab;
    if (document.body) {
      document.body.setAttribute('data-active-tab', tab);
    }
    CFG.tabs.forEach(function (t) {
      var s = $('screen-' + t);
      if (s) s.classList.toggle('active', t === tab);
    });
    var btns = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-tab') === tab);
    }
    renderAll();
  }
  window.switchTab = switchTab;

  // ---------- Modals ----------
  function openModal(id) {
    var m = $(id);
    if (!m) return;
    if (id === 'modal-add-invoice') {
      $('inv-client').value = '';
      $('inv-title').value = '';
      $('inv-amount').value = '850.00';
      $('inv-terms').value = data.settings.defaultTerms || 'net14';
      $('inv-tax').value = '0';
      $('inv-discount').value = '0';
      $('inv-deposit').value = '0';
      $('inv-status').value = 'sent';
      $('inv-weekend').checked = true;
      $('inv-error').textContent = '';
    } else if (id === 'modal-add-retainer') {
      $('ret-client').value = '';
      $('ret-title').value = '';
      $('ret-amount').value = '950.00';
      $('ret-cycle').value = 'monthly';
      $('ret-next-date').value = E.addDays(today(), 14);
      $('ret-error').textContent = '';
    }
    m.classList.add('open');
  }

  function closeModal(id) {
    var m = $(id);
    if (m) m.classList.remove('open');
  }

  function askConfirm(text, fn) {
    $('confirm-text').textContent = text;
    confirmAction = fn;
    openModal('modal-confirm');
  }

  function openInvoicePreview(id) {
    var inv = S.findInvoice(data, id);
    if (!inv) return;
    previewInvoiceId = inv.id;
    var totals = E.calculateInvoiceTotals(inv);
    var effDue = inv.weekendEarly ? E.adjustWeekendEarly(inv.dueDate) : inv.dueDate;
    var itemsRows = (inv.items || []).map(function (it) {
      var line = E.clampNum(it.qty, 1, 10000, 1) * E.clampNum(it.unitCents, 0, 1000000000, 0);
      return '<tr><td>' + esc(it.desc) + '</td><td>' + it.qty + '</td><td>' + fmt(it.unitCents) + '</td><td style="text-align:right;font-weight:700;">' + fmt(line) + '</td></tr>';
    }).join('');

    var host = $('invoice-preview-body');
    if (host) {
      host.innerHTML =
        '<div class="invoice-preview-head">' +
          '<div>' +
            '<div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;color:var(--accent);">' + esc(data.settings.businessName || 'Studio Creative') + '</div>' +
            '<div style="font-size:1.15rem;font-weight:900;">Invoice ' + esc(inv.number) + '</div>' +
            '<div class="row-sub">Billed to: <strong>' + esc(inv.client) + '</strong> · ' + esc(inv.title) + '</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<span class="tag ' + (inv.status === 'paid' ? 'ok' : 'warn') + '">' + esc(inv.status.toUpperCase()) + '</span>' +
            '<div class="row-sub" style="margin-top:4px;">Issued: ' + esc(E.prettyDate(inv.issueDate)) + '</div>' +
            '<div class="row-sub">Due: <strong>' + esc(E.prettyDate(effDue)) + '</strong></div>' +
          '</div>' +
        '</div>' +
        '<table class="invoice-preview-table">' +
          '<thead><tr><th>Deliverable / Line Item</th><th>Qty</th><th>Rate</th><th style="text-align:right;">Total</th></tr></thead>' +
          '<tbody>' + itemsRows + '</tbody>' +
        '</table>' +
        '<div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-top:6px;"><span>Subtotal:</span><strong>' + fmt(totals.subtotalCents) + '</strong></div>' +
        (totals.discountCents > 0 ? '<div style="display:flex;justify-content:space-between;font-size:0.82rem;"><span>Discount (' + totals.discountPct + '%):</span><strong>-' + fmt(totals.discountCents) + '</strong></div>' : '') +
        (totals.taxCents > 0 ? '<div style="display:flex;justify-content:space-between;font-size:0.82rem;"><span>Tax (' + totals.taxPct + '%):</span><strong>+' + fmt(totals.taxCents) + '</strong></div>' : '') +
        (totals.paidCents > 0 && inv.status !== 'paid' ? '<div style="display:flex;justify-content:space-between;font-size:0.82rem;"><span>Deposit Received:</span><strong>-' + fmt(totals.paidCents) + '</strong></div>' : '') +
        '<div style="display:flex;justify-content:space-between;font-size:1rem;font-weight:900;color:var(--accent);border-top:1px solid var(--border);padding-top:8px;margin-top:8px;">' +
          '<span>Balance Due:</span><span>' + fmt(totals.balanceDueCents) + '</span>' +
        '</div>';
    }
    openModal('modal-preview-invoice');
  }

  // ---------- Screen 1: Pulse Rendering ----------
  function renderHero() {
    var host = $('hero-pulse');
    if (!host) return;
    var p = E.invoicePulse(data, today());
    var move = E.nextBillingMove(data, today());

    var moveHtml = '';
    if (move) {
      var actBtns = '';
      if (move.status === 'draft') {
        actBtns = '<button class="btn btn-sm btn-primary" type="button" data-act="send-inv" data-id="' + esc(move.id) + '">Send Invoice (' + fmt(move.balanceDueCents) + ')</button>';
      } else {
        actBtns =
          '<div class="row-actions" style="margin-top:0;">' +
            '<button class="btn btn-sm btn-primary" type="button" data-act="pay-inv" data-id="' + esc(move.id) + '">✓ Mark Paid (' + fmt(move.balanceDueCents) + ')</button>' +
            '<button class="btn btn-sm btn-secondary" type="button" data-act="nudge-inv" data-id="' + esc(move.id) + '">✉ Kind Nudge</button>' +
          '</div>';
      }
      moveHtml =
        '<div class="next-move-box">' +
          '<div>' +
            '<span class="tag warn">' + esc(move.badge) + '</span>' +
            '<div class="next-move-title" style="margin-top:4px;">Next Billing Move: ' + esc(move.number) + ' · ' + esc(move.client) + '</div>' +
            '<div class="row-sub">' + esc(move.title) + ' · ' + fmt(move.balanceDueCents) + ' due ' + esc(E.prettyDate(move.dueDate)) + '</div>' +
          '</div>' +
          actBtns +
        '</div>';
    } else {
      moveHtml =
        '<div class="next-move-box">' +
          '<div>' +
            '<span class="tag ok">All Clear</span>' +
            '<div class="next-move-title" style="margin-top:4px;">No overdue or pending invoices right now.</div>' +
            '<div class="row-sub">Log billable work below, draft a new client invoice, or load sample studio data.</div>' +
          '</div>' +
          '<div class="row-actions" style="margin-top:0;">' +
            '<button class="btn btn-sm btn-primary" type="button" data-open-modal="modal-add-invoice">+ New Invoice</button>' +
            '<button class="btn btn-sm btn-secondary" type="button" data-act="load-sample">🌱 Load Sample Data</button>' +
          '</div>' +
        '</div>';
    }

    var subline = p.overdueCount > 0
      ? E.plural(p.overdueCount, 'overdue invoice') + ' (' + fmt(p.overdueCents) + ') ready for a 1-tap kind follow-up nudge.'
      : 'Collected ' + fmt(p.collectedCents) + ' (' + p.targetProgressPct + '% of ' + fmt(p.monthlyTargetCents) + ' monthly studio goal) · Recurring retainers: ' + fmt(p.monthlyRecurringCents) + '/mo.';

    host.innerHTML =
      '<div class="hero-eyebrow">' +
        '<span>Ready &amp; Awaiting Revenue Pipeline</span>' +
        '<span>Collection Rate: ' + p.collectionRatePct + '%</span>' +
      '</div>' +
      '<div class="hero-amount">' + fmt(p.readyPipelineCents) + '</div>' +
      '<div class="hero-sub">' + esc(subline) + '</div>' +
      '<div class="hero-meta-grid">' +
        '<div class="meta-item"><div class="meta-label">Awaiting Payment</div><div class="meta-val">' + fmt(p.awaitingCents) + '</div></div>' +
        '<div class="meta-item"><div class="meta-label">Unbilled Work Drawer</div><div class="meta-val">' + fmt(p.unbilledWorkCents + p.draftCents) + '</div></div>' +
        '<div class="meta-item"><div class="meta-label">Safe Owner Cash</div><div class="meta-val">' + fmt(p.safeOwnerCashCents) + '</div></div>' +
      '</div>' +
      moveHtml;
  }

  function renderUnbilledWork() {
    var host = $('unbilled-work-list');
    if (!host) return;
    var list = (data.workItems || []).filter(function (w) { return w && !w.billed; });
    if (!list.length) {
      host.innerHTML =
        '<div class="empty">' +
          '<strong>Unbilled Work Drawer is empty.</strong>' +
          'Use the 5-second capture bar above whenever you finish a client call, revision, or sprint so zero billable work slips through the cracks.' +
          '<div class="row-actions" style="justify-content:center;margin-top:10px;">' +
            '<button class="btn btn-primary btn-sm" type="button" data-open-modal="modal-add-invoice">+ Create Direct Invoice</button>' +
            '<button class="btn btn-secondary btn-sm" type="button" data-act="load-sample">🌱 Load Sample Data</button>' +
          '</div>' +
        '</div>';
      return;
    }
    host.innerHTML = list.map(function (w) {
      return '<div class="row">' +
        '<div class="row-main">' +
          '<div class="row-title">' + esc(w.title) + ' <span class="tag">' + esc(w.client) + '</span></div>' +
          '<div class="row-sub">Logged ' + esc(E.prettyDate(w.date)) + ' · Unbilled deliverable</div>' +
        '</div>' +
        '<div style="font-weight:800;">' + fmt(w.amountCents) + '</div>' +
        '<div class="row-actions" style="margin-top:0;">' +
          '<button class="btn btn-sm btn-primary" type="button" data-act="convert-work" data-id="' + esc(w.id) + '">⚡ Convert to Invoice</button>' +
          '<button class="btn btn-sm btn-ghost" type="button" data-act="del-work" data-id="' + esc(w.id) + '">×</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderWeather() {
    var host = $('weather-ribbon');
    if (!host) return;
    var cells = E.inflowForecast14(data, today(), 14);
    var total14 = cells.reduce(function (acc, c) { return acc + c.inflowCents; }, 0);
    var tag = $('weather-status-tag');
    if (tag) {
      tag.textContent = total14 > 0 ? (fmt(total14) + ' Scheduled in 14d') : 'Calm 14-Day Horizon';
      tag.className = 'tag ' + (total14 > 0 ? 'ok' : '');
    }
    host.innerHTML = cells.map(function (c) {
      var marker = c.inflowCents > 0 ? fmt(c.inflowCents) : (c.hasRetainer ? '↻ Retainer' : 'Calm');
      return '<div class="weather-cell lv-' + esc(c.level) + '">' +
        '<strong>' + esc(c.dayShort) + '</strong>' +
        '<div>' + esc(c.date.slice(5)) + '</div>' +
        '<div style="font-weight:700;margin-top:2px;">' + esc(marker) + '</div>' +
      '</div>';
    }).join('');
  }

  // ---------- Screen 2: Invoices Studio Rendering ----------
  function renderInvoices() {
    var filterChips = document.querySelectorAll('#invoice-filter .chip');
    for (var i = 0; i < filterChips.length; i++) {
      filterChips[i].classList.toggle('selected', filterChips[i].getAttribute('data-inv-filter') === invFilter);
    }

    var host = $('invoices-list');
    if (!host) return;
    var all = (data.invoices || []).slice();
    var filtered = all.filter(function (inv) {
      var b = E.invoiceBucket(inv, today());
      if (invFilter === 'open') return b === 'sent' || b === 'overdue';
      if (invFilter === 'draft') return b === 'draft';
      if (invFilter === 'paid') return b === 'paid';
      return true;
    });

    if (!filtered.length) {
      host.innerHTML =
        '<div class="empty">' +
          '<strong>No client invoices in this view.</strong>' +
          'Create an invoice with automatic Friday Early weekend shift or load sample data to test-drive the studio.' +
          '<div class="row-actions" style="justify-content:center;margin-top:10px;">' +
            '<button class="btn btn-primary btn-sm" type="button" data-open-modal="modal-add-invoice">+ Draft First Invoice</button>' +
            '<button class="btn btn-secondary btn-sm" type="button" data-act="load-sample">🌱 Load Sample Data</button>' +
          '</div>' +
        '</div>';
      return;
    }

    host.innerHTML = filtered.map(function (inv) {
      var totals = E.calculateInvoiceTotals(inv);
      var bkt = E.invoiceBucket(inv, today());
      var effDue = inv.weekendEarly ? E.adjustWeekendEarly(inv.dueDate) : inv.dueDate;
      var lateFee = E.calculateLateFeeCents(inv, today(), 2);

      var badgeHtml = '';
      if (bkt === 'paid') badgeHtml = '<span class="tag ok">Paid ' + esc(inv.paidAt) + '</span>';
      else if (bkt === 'overdue') badgeHtml = '<span class="tag warn">' + esc(E.dueLabel(effDue, today())) + '</span>';
      else if (bkt === 'draft') badgeHtml = '<span class="tag">Draft</span>';
      else badgeHtml = '<span class="tag ok">' + esc(E.dueLabel(effDue, today())) + '</span>';

      var primaryBtn = '';
      if (bkt === 'paid') {
        primaryBtn = '<button class="btn btn-sm btn-ghost" type="button" data-act="reopen-inv" data-id="' + esc(inv.id) + '">↺ Reopen</button>';
      } else if (bkt === 'draft') {
        primaryBtn = '<button class="btn btn-sm btn-primary" type="button" data-act="send-inv" data-id="' + esc(inv.id) + '">Send Invoice</button>';
      } else {
        primaryBtn = '<button class="btn btn-sm btn-primary" type="button" data-act="pay-inv" data-id="' + esc(inv.id) + '">✓ Mark Paid</button>';
      }

      return '<div class="row">' +
        '<div class="row-main">' +
          '<div class="row-title">' + esc(inv.number) + ' · ' + esc(inv.client) + ' ' + badgeHtml + ' ' + (inv.weekendEarly ? '<span class="tag">Fri Early Shift</span>' : '') + '</div>' +
          '<div class="row-sub">' + esc(inv.title) + ' · Total ' + fmt(totals.totalCents) + (totals.paidCents > 0 && bkt !== 'paid' ? (' (Deposit ' + fmt(totals.paidCents) + ' paid)') : '') + ' · Due ' + esc(E.prettyDate(effDue)) + (lateFee > 0 ? (' · Est. 2% late fee: ' + fmt(lateFee)) : '') + '</div>' +
        '</div>' +
        '<div style="font-weight:900;">' + fmt(bkt === 'paid' ? totals.totalCents : totals.balanceDueCents) + '</div>' +
        '<div class="row-actions" style="margin-top:0;">' +
          primaryBtn +
          '<button class="btn btn-sm btn-secondary" type="button" data-act="preview-inv" data-id="' + esc(inv.id) + '">Preview</button>' +
          (bkt !== 'paid' ? '<button class="btn btn-sm btn-ghost" type="button" data-act="nudge-inv" data-id="' + esc(inv.id) + '">✉</button>' : '') +
          '<button class="btn btn-sm btn-ghost" type="button" data-act="del-inv" data-id="' + esc(inv.id) + '">×</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ---------- Screen 3: Payout Splitter Rendering ----------
  function renderPayout() {
    var amtInput = $('pay-amount');
    var cents = amtInput ? E.parseCents(amtInput.value) : 160000;
    if (cents <= 0) cents = 160000;
    var split = E.splitPayout(cents, selectedPreset);

    var chips = document.querySelectorAll('#pay-preset-chips .chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('selected', chips[i].getAttribute('data-preset') === selectedPreset);
    }

    var preview = $('payout-preview');
    if (preview) {
      preview.innerHTML =
        '<div class="split-box">' +
          '<div class="split-box-title">1. Tax Shield Vault (' + split.taxPct + '%)</div>' +
          '<div class="split-box-amt">' + fmt(split.taxCents) + '</div>' +
          '<div class="row-sub">Protected for quarterly self-employment &amp; income taxes</div>' +
        '</div>' +
        '<div class="split-box">' +
          '<div class="split-box-title">2. Business Ops &amp; Tools (' + split.opsPct + '%)</div>' +
          '<div class="split-box-amt">' + fmt(split.opsCents) + '</div>' +
          '<div class="row-sub">Covers software, gear, contractors &amp; studio overhead</div>' +
        '</div>' +
        '<div class="split-box">' +
          '<div class="split-box-title">3. Safety Runway Buffer (' + split.bufferPct + '%)</div>' +
          '<div class="split-box-amt">' + fmt(split.bufferCents) + '</div>' +
          '<div class="row-sub">Smooths out feast-or-famine freelance months</div>' +
        '</div>' +
        '<div class="split-box">' +
          '<div class="split-box-title">4. Owner Take-Home Pay (' + split.ownerPct + '%)</div>' +
          '<div class="split-box-amt">' + fmt(split.ownerCents) + '</div>' +
          '<div class="row-sub">100% guilt-free personal owner paycheck</div>' +
        '</div>';
    }

    var hist = $('payout-history-list');
    if (hist) {
      if (!data.payouts || !data.payouts.length) {
        hist.innerHTML = '<div class="empty"><strong>No payout splits logged yet.</strong>Tap Apply Payout Split above whenever a client invoice clears.</div>';
      } else {
        hist.innerHTML = data.payouts.map(function (p) {
          return '<div class="row">' +
            '<div class="row-main">' +
              '<div class="row-title">' + esc(p.label) + ' (' + fmt(p.amountCents) + ')</div>' +
              '<div class="row-sub">' + esc(E.prettyDate(p.date)) + ' · Tax Vault ' + fmt(p.taxCents) + ' · Ops ' + fmt(p.opsCents) + ' · Buffer ' + fmt(p.bufferCents) + ' · Owner Pay ' + fmt(p.ownerCents) + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }
  }

  // ---------- Screen 4: Kind Follow-Up & Triage Rendering ----------
  function renderFollowup() {
    var sel = $('followup-invoice-select');
    var openInvs = (data.invoices || []).filter(function (inv) { return inv && inv.status !== 'paid'; });

    if (sel) {
      if (!openInvs.length) {
        sel.innerHTML = '<option value="">No open invoices — all caught up!</option>';
        selectedFollowupId = '';
      } else {
        if (!selectedFollowupId || !openInvs.some(function (x) { return x.id === selectedFollowupId; })) {
          selectedFollowupId = openInvs[0].id;
        }
        sel.innerHTML = openInvs.map(function (inv) {
          var t = E.calculateInvoiceTotals(inv);
          return '<option value="' + esc(inv.id) + '"' + (inv.id === selectedFollowupId ? ' selected' : '') + '>' +
            esc(inv.number) + ' — ' + esc(inv.client) + ' (' + fmt(t.balanceDueCents) + ')' +
          '</option>';
        }).join('');
      }
    }

    var toneChips = document.querySelectorAll('#followup-tone-chips .chip');
    for (var i = 0; i < toneChips.length; i++) {
      toneChips[i].classList.toggle('selected', toneChips[i].getAttribute('data-tone') === selectedTone);
    }

    var box = $('followup-script-box');
    if (box) {
      var targetInv = S.findInvoice(data, selectedFollowupId) || openInvs[0];
      if (targetInv) {
        box.value = E.generateFollowupScript(targetInv, selectedTone, cur(), data.settings.businessName);
      } else {
        box.value = 'All invoices are settled! Add or select an open invoice to generate a custom client follow-up message.';
      }
    }

    var triageHost = $('triage-list');
    if (triageHost) {
      var cands = E.followupCandidates(data, today());
      if (!cands.length) {
        triageHost.innerHTML = '<div class="empty"><strong>Zero invoices need triage.</strong>No overdue invoices or pending drafts right now.</div>';
      } else {
        var nextDateDefault = E.addDays(today(), 7);
        triageHost.innerHTML = cands.map(function (c) {
          return '<div class="row">' +
            '<div class="row-main">' +
              '<div class="row-title">' + esc(c.number) + ' · ' + esc(c.client) + ' <span class="tag warn">' + esc(c.badge) + '</span></div>' +
              '<div class="row-sub">' + esc(c.title) + ' · ' + fmt(c.balanceDueCents) + ' · Target due ' + esc(E.prettyDate(c.dueDate)) + '</div>' +
            '</div>' +
            '<div class="row-actions" style="margin-top:0;">' +
              '<button class="btn btn-sm btn-primary" type="button" data-act="pay-inv" data-id="' + esc(c.id) + '">✓ Mark Paid</button>' +
              '<input id="triage-date-' + esc(c.id) + '" class="input" type="date" value="' + nextDateDefault + '" style="max-width:140px;" aria-label="New due date">' +
              '<button class="btn btn-sm btn-secondary" type="button" data-act="shift-inv" data-id="' + esc(c.id) + '">Shift Due Date</button>' +
              '<button class="btn btn-sm btn-ghost" type="button" data-act="load-script" data-id="' + esc(c.id) + '" data-tone="' + esc(c.recommendedTone) + '">Load Script</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }
  }

  // ---------- Screen 5: Retainers & Cash Vault Rendering ----------
  function renderRetainers() {
    var retSum = E.retainerSummary(data, today());
    var pulse = E.invoicePulse(data, today());
    var sumHost = $('retainers-summary-card');
    if (sumHost) {
      sumHost.innerHTML =
        '<div class="hero-eyebrow"><span>Recurring Retainer Baseline &amp; Tax Vault</span><span>' + E.plural(retSum.activeCount, 'active retainer') + '</span></div>' +
        '<div class="hero-amount">' + fmt(retSum.monthlyRecurringCents) + '<span style="font-size:1rem;font-weight:700;color:var(--text-muted);"> / month recurring (' + fmt(retSum.annualRecurringCents) + '/yr)</span></div>' +
        '<div class="hero-meta-grid" style="margin-top:10px;margin-bottom:0;">' +
          '<div class="meta-item"><div class="meta-label">Business Checking</div><div class="meta-val">' + fmt(pulse.checkingCents) + '</div></div>' +
          '<div class="meta-item"><div class="meta-label">Tax Shield Vault</div><div class="meta-val">' + fmt(pulse.taxVaultCents) + '</div></div>' +
          '<div class="meta-item"><div class="meta-label">Safe Owner Cash</div><div class="meta-val">' + fmt(pulse.safeOwnerCashCents) + '</div></div>' +
        '</div>';
    }

    var listHost = $('retainers-list');
    if (listHost) {
      var list = data.retainers || [];
      if (!list.length) {
        listHost.innerHTML =
          '<div class="empty">' +
            '<strong>No recurring client retainers tracked yet.</strong>' +
            'Add monthly or quarterly retainer clients to generate their next invoice in one tap.' +
            '<div class="row-actions" style="justify-content:center;margin-top:10px;">' +
              '<button class="btn btn-primary btn-sm" type="button" data-open-modal="modal-add-retainer">+ Add First Retainer</button>' +
              '<button class="btn btn-secondary btn-sm" type="button" data-act="load-sample">🌱 Load Sample Data</button>' +
            '</div>' +
          '</div>';
      } else {
        listHost.innerHTML = list.map(function (r) {
          var ann = E.annualRetainerCents(r);
          var isPaused = r.status === 'paused';
          return '<div class="row">' +
            '<div class="row-main">' +
              '<div class="row-title">' + esc(r.client) + ' · ' + esc(r.title) + ' <span class="tag ' + (isPaused ? '' : 'ok') + '">' + esc(isPaused ? 'Paused' : r.cycle) + '</span></div>' +
              '<div class="row-sub">' + fmt(r.amountCents) + ' / ' + esc(r.cycle) + ' (' + fmt(ann) + '/yr) · Next invoice date: ' + esc(E.prettyDate(r.nextDate)) + '</div>' +
            '</div>' +
            '<div class="row-actions" style="margin-top:0;">' +
              (!isPaused ? '<button class="btn btn-sm btn-primary" type="button" data-act="bill-retainer" data-id="' + esc(r.id) + '">⚡ Generate Invoice</button>' : '') +
              '<button class="btn btn-sm btn-secondary" type="button" data-act="toggle-retainer" data-id="' + esc(r.id) + '">' + (isPaused ? 'Resume' : 'Pause') + '</button>' +
              '<button class="btn btn-sm btn-ghost" type="button" data-act="del-retainer" data-id="' + esc(r.id) + '">×</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    var acctHost = $('accounts-list');
    if (acctHost) {
      acctHost.innerHTML = (data.accounts || []).map(function (a) {
        var eff = E.effectiveAccountBalanceCents(a, data.transactions);
        var typeTag = a.type === 'tax' ? '<span class="tag warn">Tax Shield Vault</span>' : '<span class="tag ok">Checking</span>';
        return '<div class="row">' +
          '<div class="row-main">' +
            '<div class="row-title">' + esc(a.name) + ' ' + typeTag + '</div>' +
            '<div class="row-sub">Snapshot synced as of ' + esc(E.prettyDate(a.balanceAsOf)) + '</div>' +
          '</div>' +
          '<div style="font-weight:800;">' + fmt(eff) + '</div>' +
        '</div>';
      }).join('');
    }
  }

  // ---------- Screen 6: Settings Rendering ----------
  function renderSettings() {
    var s = data.settings;
    if ($('set-sound')) $('set-sound').checked = !!s.sound;
    if ($('set-business-name')) $('set-business-name').value = s.businessName || 'Sage Creative Studio';
    if ($('set-default-terms')) $('set-default-terms').value = s.defaultTerms || 'net14';
    if ($('set-monthly-target')) $('set-monthly-target').value = (s.monthlyTargetCents / 100).toFixed(0);
    if ($('set-currency')) $('set-currency').value = s.currency || 'USD';

    var host = $('theme-picker');
    if (host) {
      var curTheme = s.theme || CFG.themes[0].id;
      host.innerHTML = CFG.themes.map(function (t) {
        return '<button type="button" class="chip ' + (t.id === curTheme ? 'selected' : '') + '" data-act="theme" data-theme-id="' + esc(t.id) + '">' + esc(t.label) + '</button>';
      }).join('');
    }
  }

  function renderHeaderAndStats() {
    var p = E.invoicePulse(data, today());
    if ($('badge-collected')) $('badge-collected').textContent = fmt(p.collectedCents) + ' collected';
    if ($('stat-awaiting')) $('stat-awaiting').textContent = fmt(p.awaitingCents);
    if ($('stat-tax-vault')) $('stat-tax-vault').textContent = fmt(p.taxVaultCents);
    if ($('stat-owner-safe')) $('stat-owner-safe').textContent = fmt(p.safeOwnerCashCents);

    document.body.classList.toggle('fog', !!data.settings.fog);
    var fb = $('btn-toggle-fog');
    if (fb) {
      fb.setAttribute('aria-pressed', data.settings.fog ? 'true' : 'false');
      fb.textContent = data.settings.fog ? 'Fog Mode: ON' : 'Fog Mode';
    }
    document.body.setAttribute('data-theme', data.settings.theme || CFG.themes[0].id);
  }

  function renderAll() {
    renderHeaderAndStats();
    renderHero();
    renderUnbilledWork();
    renderWeather();
    renderInvoices();
    renderPayout();
    renderFollowup();
    renderRetainers();
    renderSettings();
  }

  // ---------- User Actions ----------
  function quickLogWork() {
    var clientInput = $('qa-work-client');
    var titleInput = $('qa-work-title');
    var amtInput = $('qa-work-amount');
    var client = clientInput && clientInput.value.trim() ? clientInput.value.trim() : 'Client Project';
    var title = titleInput ? titleInput.value.trim() : '';
    var cents = amtInput ? E.parseCents(amtInput.value) : 15000;
    if (!title) title = 'Billable Consulting & Design Session';
    if (cents <= 0) {
      toast('Enter a positive billable amount.');
      return;
    }
    var wi = S.addWorkItem(data, {
      client: client,
      title: title,
      amountCents: cents,
      date: today()
    });
    if (wi) {
      if (titleInput) titleInput.value = '';
      commit();
      beep(660, 120);
      toast('Added "' + wi.title + '" (' + fmt(wi.amountCents) + ') to Unbilled Work Drawer.');
      T.emit('work-logged');
      renderAll();
    }
  }

  function runPayoutSplit() {
    var lbl = $('pay-label') ? $('pay-label').value : 'Client Invoice Payout';
    var cents = $('pay-amount') ? E.parseCents($('pay-amount').value) : 160000;
    if (cents <= 0) {
      toast('Enter a valid payout amount first.');
      return;
    }
    data.settings.payoutPreset = selectedPreset;
    var rec = S.applyPayoutSplit(data, {
      label: lbl,
      amountCents: cents,
      preset: selectedPreset,
      date: today()
    });
    if (rec) {
      commit();
      beep(780, 180);
      toast('Split ' + fmt(rec.amountCents) + ' across Tax Vault, Ops, Buffer & Owner Pay!');
      T.emit('payout-applied');
      renderAll();
    }
  }

  function copyTextToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(successMsg);
      }).catch(function () {
        toast(successMsg);
      });
    } else {
      toast(successMsg);
    }
  }

  function handleAction(node) {
    var act = node.getAttribute('data-act');
    var id = node.getAttribute('data-id');
    switch (act) {
      case 'load-sample':
        loadSampleData();
        break;
      case 'convert-work': {
        var inv = S.convertWorkItemToInvoice(data, id, today());
        if (inv) {
          commit(); beep(740, 140); toast('Converted to Invoice ' + inv.number + '!'); renderAll();
        }
        break;
      }
      case 'del-work':
        S.deleteWorkItem(data, id); commit(); toast('Unbilled item removed.'); renderAll();
        break;
      case 'send-inv':
        if (S.markInvoiceSent(data, id)) {
          commit(); beep(700, 120); toast('Invoice marked as Sent!'); renderAll();
        }
        break;
      case 'pay-inv':
        if (S.markInvoicePaid(data, id, today())) {
          commit(); beep(820, 180); toast('Invoice marked Paid! Revenue added to Business Checking.'); renderAll();
        }
        break;
      case 'reopen-inv':
        if (S.reopenInvoice(data, id)) {
          commit(); toast('Invoice reopened.'); renderAll();
        }
        break;
      case 'del-inv':
        S.deleteInvoice(data, id); commit(); toast('Invoice deleted.'); renderAll();
        break;
      case 'preview-inv':
        openInvoicePreview(id);
        break;
      case 'nudge-inv':
        selectedFollowupId = id;
        switchTab('followup');
        break;
      case 'load-script':
        selectedFollowupId = id;
        selectedTone = node.getAttribute('data-tone') || 'gentle';
        renderFollowup();
        toast('Follow-up script loaded above.');
        break;
      case 'shift-inv': {
        var dInp = $('triage-date-' + id);
        if (dInp && S.rescheduleInvoice(data, id, dInp.value)) {
          commit(); toast('Due date shifted to ' + E.prettyDate(dInp.value) + '.'); renderAll();
        } else {
          toast('Pick a valid due date first.');
        }
        break;
      }
      case 'bill-retainer': {
        var rInv = S.generateRetainerInvoice(data, id, today());
        if (rInv) {
          commit(); beep(760, 150); toast('Generated Invoice ' + rInv.number + ' and advanced retainer cycle!'); renderAll();
        }
        break;
      }
      case 'toggle-retainer':
        S.toggleRetainerStatus(data, id); commit(); toast('Retainer status updated.'); renderAll();
        break;
      case 'del-retainer':
        S.deleteRetainer(data, id); commit(); toast('Retainer removed.'); renderAll();
        break;
      case 'theme':
        data.settings.theme = node.getAttribute('data-theme-id');
        commit(); renderAll();
        break;
      default:
        break;
    }
  }

  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var closer = t.closest('[data-close-modal]');
      if (closer) { closeModal(closer.getAttribute('data-close-modal')); return; }

      var opener = t.closest('[data-open-modal]');
      if (opener) { openModal(opener.getAttribute('data-open-modal')); return; }

      if (t.classList && t.classList.contains('app-modal')) { closeModal(t.id); return; }

      var navBtn = t.closest('.nav-btn');
      if (navBtn) { switchTab(navBtn.getAttribute('data-tab')); return; }

      var amtChip = t.closest('#qa-amount-chips .chip');
      if (amtChip) {
        var c = parseInt(amtChip.getAttribute('data-cents'), 10) || 15000;
        if ($('qa-work-amount')) $('qa-work-amount').value = (c / 100).toFixed(2);
        if ($('qa-work-title') && !$('qa-work-title').value.trim()) {
          $('qa-work-title').value = amtChip.getAttribute('data-label') || '';
        }
        var allAmt = document.querySelectorAll('#qa-amount-chips .chip');
        for (var i = 0; i < allAmt.length; i++) allAmt[i].classList.toggle('selected', allAmt[i] === amtChip);
        return;
      }

      var invChip = t.closest('#invoice-filter .chip');
      if (invChip) {
        invFilter = invChip.getAttribute('data-inv-filter') || 'all';
        renderInvoices();
        return;
      }

      var presetChip = t.closest('#pay-preset-chips .chip');
      if (presetChip) {
        selectedPreset = presetChip.getAttribute('data-preset') || 'standard';
        renderPayout();
        return;
      }

      var toneChip = t.closest('#followup-tone-chips .chip');
      if (toneChip) {
        selectedTone = toneChip.getAttribute('data-tone') || 'warm';
        renderFollowup();
        return;
      }

      var actNode = t.closest('[data-act]');
      if (actNode) {
        e.stopPropagation();
        handleAction(actNode);
      }
    });

    if ($('btn-qa-work')) $('btn-qa-work').addEventListener('click', quickLogWork);
    if ($('qa-work-title')) {
      $('qa-work-title').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') quickLogWork();
      });
    }
    if ($('pay-amount')) $('pay-amount').addEventListener('input', renderPayout);
    if ($('btn-run-payout')) $('btn-run-payout').addEventListener('click', runPayoutSplit);

    if ($('followup-invoice-select')) {
      $('followup-invoice-select').addEventListener('change', function () {
        selectedFollowupId = this.value;
        renderFollowup();
      });
    }

    if ($('btn-copy-script')) {
      $('btn-copy-script').addEventListener('click', function () {
        var box = $('followup-script-box');
        copyTextToClipboard(box ? box.value : '', 'Follow-up script copied to clipboard!');
      });
    }

    if ($('btn-print-invoice')) {
      $('btn-print-invoice').addEventListener('click', function () {
        window.print();
      });
    }

    if ($('btn-copy-invoice')) {
      $('btn-copy-invoice').addEventListener('click', function () {
        var inv = S.findInvoice(data, previewInvoiceId);
        if (!inv) return;
        var totals = E.calculateInvoiceTotals(inv);
        var summary = 'INVOICE ' + inv.number + ' — ' + (data.settings.businessName || 'Studio Creative') + '\n' +
          'Client: ' + inv.client + '\n' +
          'Project: ' + inv.title + '\n' +
          'Due Date: ' + E.prettyDate(inv.dueDate) + '\n' +
          'Balance Due: ' + fmt(totals.balanceDueCents);
        copyTextToClipboard(summary, 'Invoice summary copied to clipboard!');
      });
    }

    if ($('btn-toggle-fog')) {
      $('btn-toggle-fog').addEventListener('click', function () {
        data.settings.fog = !data.settings.fog;
        commit();
        renderAll();
        T.emit('fog-toggled');
      });
    }

    if ($('btn-launch-tour')) {
      $('btn-launch-tour').addEventListener('click', function () {
        T.start();
      });
    }

    if ($('btn-save-invoice')) {
      $('btn-save-invoice').addEventListener('click', function () {
        var inv = S.addInvoice(data, {
          client: $('inv-client').value,
          title: $('inv-title').value || 'Professional Services',
          amountCents: E.parseCents($('inv-amount').value),
          terms: $('inv-terms').value,
          taxPct: parseInt($('inv-tax').value, 10) || 0,
          discountPct: parseInt($('inv-discount').value, 10) || 0,
          depositCents: E.parseCents($('inv-deposit').value),
          status: $('inv-status').value,
          weekendEarly: $('inv-weekend').checked,
          issueDate: today()
        });
        if (!inv) {
          $('inv-error').textContent = 'Please enter a client name and a positive subtotal amount.';
          return;
        }
        commit(); closeModal('modal-add-invoice'); beep(740, 140); toast('Invoice ' + inv.number + ' saved!'); renderAll();
      });
    }

    if ($('btn-save-retainer')) {
      $('btn-save-retainer').addEventListener('click', function () {
        var ret = S.addRetainer(data, {
          client: $('ret-client').value,
          title: $('ret-title').value || 'Monthly Retainer',
          amountCents: E.parseCents($('ret-amount').value),
          cycle: $('ret-cycle').value,
          nextDate: $('ret-next-date').value
        });
        if (!ret) {
          $('ret-error').textContent = 'Please enter a client name, positive fee, and valid next billing date.';
          return;
        }
        commit(); closeModal('modal-add-retainer'); toast('Retainer added.'); renderAll();
      });
    }

    if ($('btn-sync-balance')) {
      $('btn-sync-balance').addEventListener('click', function () {
        var raw = $('sync-balance-input').value;
        if (raw === '') { toast('Enter your current business checking balance first.'); return; }
        S.setAccountBalance(data, 'acct_main', E.parseCents(raw), today());
        $('sync-balance-input').value = '';
        commit(); beep(720, 140); toast('Business checking synced without double-counting!'); renderAll();
      });
    }

    if ($('btn-save-settings')) {
      $('btn-save-settings').addEventListener('click', function () {
        data.settings.businessName = ($('set-business-name').value || '').trim() || 'Sage Creative Studio';
        data.settings.defaultTerms = $('set-default-terms').value || 'net14';
        data.settings.monthlyTargetCents = E.clampNum(E.parseCents($('set-monthly-target').value), 10000, 1000000000, 500000);
        data.settings.currency = $('set-currency').value || 'USD';
        commit();
        toast('Studio calibration saved.');
        renderAll();
      });
    }

    if ($('set-sound')) {
      $('set-sound').addEventListener('change', function () {
        data.settings.sound = $('set-sound').checked;
        commit();
      });
    }

    if ($('btn-clean-slate')) {
      $('btn-clean-slate').addEventListener('click', function () {
        askConfirm('Start a clean empty slate? All sample and current records will be cleared.', function () {
          setCleanSlateState(true);
          toast('Clean empty slate ready.');
        });
      });
    }

    if ($('btn-load-sample')) {
      $('btn-load-sample').addEventListener('click', function () {
        loadSampleData();
      });
    }

    if ($('btn-restart-tour')) {
      $('btn-restart-tour').addEventListener('click', function () {
        T.start();
      });
    }

    if ($('btn-export-json')) {
      $('btn-export-json').addEventListener('click', function () {
        var blob = new Blob([S.exportJSON(data)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'invoice-planner-backup-' + today() + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        toast('Backup exported.');
      });
    }

    if ($('btn-import-json')) {
      $('btn-import-json').addEventListener('click', function () {
        if ($('file-import')) $('file-import').click();
      });
    }

    if ($('file-import')) {
      $('file-import').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            data = S.importJSON(String(reader.result || ''), today());
            commit();
            renderAll();
            toast('Backup restored.');
          } catch (err) {
            toast('Could not restore backup: invalid JSON file.');
          }
        };
        reader.readAsText(f);
        e.target.value = '';
      });
    }

    if ($('btn-reset-data')) {
      $('btn-reset-data').addEventListener('click', function () {
        askConfirm('Permanently erase all invoices and reset to a blank slate?', function () {
          setCleanSlateState(true);
          toast('All data erased.');
        });
      });
    }

    if ($('btn-confirm-yes')) {
      $('btn-confirm-yes').addEventListener('click', function () {
        var fn = confirmAction;
        confirmAction = null;
        closeModal('modal-confirm');
        if (typeof fn === 'function') fn();
      });
    }
  }

  // ---------- Resilient Bootstrap Isolation (Rule-18) ----------
  function init() {
    try {
      wire();
      switchTab(CFG.defaultTab);
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) console.error('Render init error isolated:', err);
    }

    T.init({
      config: CFG,
      switchTab: switchTab,
      onEnd: function () {
        if (data.settings.isSampleSeed) {
          data = S.cleanSlate(data, today(), false);
        } else {
          data.settings.onboarded = true;
        }
        commit();
        renderAll();
      }
    });

    if (!data.settings.onboarded) {
      setTimeout(function () { T.start(); }, 250);
    }

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').then(function (reg) {
          if (reg && typeof reg.update === 'function') reg.update();
        }).catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
