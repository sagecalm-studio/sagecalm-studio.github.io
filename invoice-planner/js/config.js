/**
 * Invoice Planner — Edition 1 (Sage Calm Studio / Maya) Configuration.
 * Persona, storage key, 4 themes, 6 symmetric tabs, and 8-step interactive guided tour.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IPConfig = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    edition: 1,
    storageKey: 'invoice_planner_data_v1',
    persona: { name: 'Maya', initial: 'M' },
    themes: [
      { id: 'sage-calm', label: 'Sage Calm' },
      { id: 'lavender-mist', label: 'Lavender Mist' },
      { id: 'warm-sand', label: 'Warm Sand' },
      { id: 'high-contrast', label: 'High Contrast' }
    ],
    defaultTab: 'pulse',
    tabs: ['pulse', 'invoices', 'payout', 'followup', 'retainers', 'settings'],
    tour: [
      {
        tabId: 'pulse',
        section: '📍 SECTION: Revenue Pulse • Ready Pipeline & Next Billing Move',
        targetId: 'hero-pulse',
        title: "Hi, I'm Maya. Welcome to your calm invoicing sanctuary.",
        message: 'Freelancers lose thousands every year to the "Invoicing Procrastination Tax" — doing great work, forgetting to log unbilled hours, or feeling awkward following up. Here you see your Awaiting Payments, Unbilled Work Drawer, and Safe Collected Cash at a glance.',
        hint: '100% offline in your browser — zero monthly SaaS subscriptions.'
      },
      {
        tabId: 'pulse',
        section: '📍 SECTION: Revenue Pulse • 5-Second Unbilled Work Capture',
        targetId: 'qa-work-title',
        title: 'Capture billable work in 5 seconds',
        message: 'Finished a quick client call, revision, or milestone? Type what you did right here so you never forget to bill for it.',
        hint: 'Try it now: type at least 3 letters into the work description box.',
        gate: { type: 'dom', event: 'input', selector: '#qa-work-title', test: 'value-min-3' }
      },
      {
        tabId: 'pulse',
        section: '📍 SECTION: Revenue Pulse • Save Unbilled Item',
        targetId: 'btn-qa-work',
        title: 'Drop it into your Unbilled Work Drawer',
        message: 'Pick a quick rate preset or enter a custom dollar amount, then tap Log Billable Work. You can convert any item into a formal client invoice in one tap.',
        hint: 'Tap Log Billable Work (or Next) to continue.',
        gate: { type: 'app', name: 'work-logged' }
      },
      {
        tabId: 'pulse',
        section: '📍 SECTION: Header • Billing Fog Mode',
        targetId: 'btn-toggle-fog',
        title: 'Feeling admin overwhelm? Turn on Fog Mode.',
        message: 'On low-energy days, Fog Mode hides every secondary list, forecast, and table — leaving only your Revenue Pipeline Hero and single Next Billing Move.',
        hint: 'Try toggling Fog Mode now.',
        gate: { type: 'app', name: 'fog-toggled' }
      },
      {
        tabId: 'invoices',
        section: '📍 SECTION: Invoice Studio • Client Invoices & Printable Preview',
        targetId: 'invoices-card',
        title: 'Clean Client Invoices with Friday Early Shift',
        message: 'Track Draft, Sent, Overdue, and Paid invoices with integer-cent tax and discount math. When Net-14 or Net-30 lands on a weekend, I shift the due date to Friday early so you get paid before Monday.',
        hint: 'Tap Preview on any invoice to open a print-ready client invoice sheet.'
      },
      {
        tabId: 'payout',
        section: '📍 SECTION: Payout Splitter • Freelance Tax & Profit Shield',
        targetId: 'payout-card',
        title: '1-Tap Paid Payout Autopilot Splitter',
        message: 'When a client pays an invoice, never accidentally spend your tax money. Split any payment across your Tax Shield Vault, Business Ops, Safety Buffer, and Guilt-Free Owner Take-Home Pay.',
        hint: 'Tap Apply Payout Split to test-drive a client payment allocation.',
        gate: { type: 'app', name: 'payout-applied' }
      },
      {
        tabId: 'followup',
        section: '📍 SECTION: Kind Follow-Up • Shame-Free Overdue Scripts',
        targetId: 'followup-card',
        title: 'Zero-Anxiety Overdue Follow-Up Script Generator',
        message: 'Chasing overdue invoices does not have to feel awkward. Choose Warm Reminder, Gentle Overdue Nudge, or Firm Final Notice — pre-filled with your invoice number, amount, and due date.',
        hint: 'Copy any follow-up note to your clipboard in one tap.'
      },
      {
        tabId: 'retainers',
        section: '📍 SECTION: Retainers & Vault • Recurring Clients & Balance Sync',
        targetId: 'retainers-card',
        title: 'Recurring Client Retainers & Anti-Double-Counting Sync',
        message: 'Track monthly or quarterly client retainers and generate their next invoice in one tap. When we finish this tour, I will clear the sample clients so you start on a fresh clean slate!',
        hint: 'Click Done to start on your clean invoicing slate.'
      }
    ]
  };
});
