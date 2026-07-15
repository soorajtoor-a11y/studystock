// Shared organization metadata — used by both App.jsx (org picker, sidebar
// switcher) and Landing.jsx (marketing page org showcase, event ticker).
// Lives outside App.jsx to avoid a circular import (App.jsx renders Landing).
// Icon-badge gradient pairs match each org's --signal-hue override in
// index.css (fbla:85 gold, deca:253 blue, hosa:26 maroon) so the picker
// card previews the exact vibe the app shifts into once that org is chosen.
export const ORG_META = {
  fbla: { name: 'FBLA', tagline: 'Business, technology, and leadership competitive events.', colors: ['#794f00', '#b98a00'], icon: '💼', unit: 'events' },
  deca: { name: 'DECA', tagline: 'Marketing, finance, hospitality, and entrepreneurship.', colors: ['#00539b', '#4283cb'], icon: '📈', unit: 'clusters' },
  hosa:  { name: 'HOSA', tagline: 'Health science and future health professionals.', colors: ['#841619', '#af3d38'], icon: '🩺', unit: 'events' },
}
export const ORG_ORDER = ['fbla', 'deca', 'hosa']
