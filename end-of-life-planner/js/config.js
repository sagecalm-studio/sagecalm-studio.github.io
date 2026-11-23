/**
 * End of Life Planner — Edition 1 (Sage Calm Studio / Maya) Configuration
 * Brand DNA: Light Sage (#f4f7f5), Deep Sage (#2d5a44), Soft Gold (#d97706).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EOLConfig = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    edition: 1,
    brand: 'Sage Calm Studio',
    toolName: 'End of Life Planner',
    defaultTab: 'overview',
    tabs: ['overview', 'contacts', 'vault', 'digital', 'wishes', 'settings'],
    persona: {
      name: 'Maya',
      initial: 'M',
      role: 'Calm Legacy Guide'
    },
    themes: [
      { id: 'sage-calm', label: 'Sage Calm', swatch: '#2d5a44' },
      { id: 'warm-linen', label: 'Warm Linen', swatch: '#92623a' },
      { id: 'mist-slate', label: 'Mist Slate', swatch: '#335c67' },
      { id: 'high-contrast', label: 'High Contrast', swatch: '#111827' }
    ],
    tour: [
      {
        tabId: 'overview',
        targetId: 'hero-readiness',
        section: 'SECTION: Readiness · Peace of Mind Score',
        title: 'Hi, I am Maya — One Tiny Step at a Time',
        message: 'End-of-life planning feels heavy when it looks like a 150-page binder. Here, we focus on one calm Legacy Readiness Score and a single 5-minute next step.',
        hint: 'Tap Next to explore your quick-capture card.'
      },
      {
        tabId: 'overview',
        targetId: 'quick-capture-card',
        section: 'SECTION: Readiness · 10-Second Quick Capture',
        title: 'Log Anything in 10 Seconds',
        message: 'Whenever you remember a bank account, document folder, or key contact, drop it here without hunting through menus. Try typing a short note or tap Next.',
        hint: 'Action gate: Type at least 3 letters in the quick input (or tap Next).',
        gate: { type: 'dom', event: 'input', selector: '#qa-title', test: 'value-min-3' }
      },
      {
        tabId: 'overview',
        targetId: 'btn-toggle-fog',
        section: 'SECTION: Header · Gentle Mode Shield',
        title: 'Overwhelmed? Turn On Gentle Mode',
        message: 'If today feels emotionally heavy, tap Gentle Mode to hide every list and form — leaving only your Readiness Score and one reassuring next step.',
        hint: 'Action gate: Tap Gentle Mode to feel how calm the screen gets (or tap Next).',
        gate: { type: 'app', name: 'fog-toggled' }
      },
      {
        tabId: 'contacts',
        targetId: 'contacts-firstcall-card',
        section: 'SECTION: People & Care · First-Call Circle',
        title: 'Who Should Be Called First?',
        message: 'Store your executor, estate attorney, doctor, and pet or dependent caregivers in one calm list so your family never has to search your phone.',
        hint: 'Tap Next to open your Legal & Estate Vault.'
      },
      {
        tabId: 'vault',
        targetId: 'vault-docs-card',
        section: 'SECTION: Legal & Estate · Document Map',
        title: 'Map Where Essential Papers Live',
        message: 'This planner points your family to your real signed Will, Directives, and safe keys. Tap any document status pill to toggle between Missing, Drafting, and Signed.',
        hint: 'Action gate: Tap a document status badge to cycle its status (or tap Next).',
        gate: { type: 'app', name: 'doc-toggled' }
      },
      {
        tabId: 'vault',
        targetId: 'vault-estate-card',
        section: 'SECTION: Legal & Estate · Net Estate & Policies',
        title: 'Private Net Estate & Last-4 Security',
        message: 'Track bank accounts, life insurance policies, and mortgages using only institution names and last-4 digits. Updating a balance never double-counts.',
        hint: 'Tap Next to see your Digital Legacy Keys.'
      },
      {
        tabId: 'digital',
        targetId: 'digital-manager-card',
        section: 'SECTION: Digital Legacy · Safe Vault Pointer',
        title: 'Zero Plain-Text Passwords',
        message: 'Never write raw passwords on paper. Point loved ones to your password manager and mark each online account to Memorialize, Transfer, or Close.',
        hint: 'Tap Next to review Final Wishes & Executor Steps.'
      },
      {
        tabId: 'wishes',
        targetId: 'executor-checklist-card',
        section: 'SECTION: Wishes & Executor · Sequential Guide',
        title: 'A Clear Roadmap for Your Executor',
        message: 'Your final wishes, personal letters, and a step-by-step 24-Hour, First-Week, and First-Month executor checklist live right here.',
        hint: 'Action gate: Check off any executor checklist step (or tap Next).',
        gate: { type: 'app', name: 'checklist-toggled' }
      },
      {
        tabId: 'settings',
        targetId: 'packet-export-card',
        section: 'SECTION: Packet & Settings · 100% Private & Printable',
        title: 'Print Your Executor Packet Anytime',
        message: 'Everything stays 100% offline on your device. Print a clean Executor Emergency Brief or export a JSON backup anytime. Finishing this tour clears sample items into a fresh Clean Slate!',
        hint: 'Tap Done to begin your own private End of Life Planner.'
      }
    ]
  };
});
