// The 12 FBLA events that are "hybrid" — scored on both an objective test
// AND a Role Play performance (per vye-fbla-roleplay-generator/START-HERE.md).
// Keyed by the study-materials/fbla/ directory slug (what `events`/
// `activeEvent` actually hold throughout App.jsx) to the human display name
// data/roleplay_config.json's events use — the two naming conventions don't
// match ("banking-and-financial-systems" vs "Banking & Financial Systems"),
// so this map is the one place that translation happens. Only 3 of the 12
// have a built roleplay_config.json entry so far (see its own
// `remaining_events_to_add` list); RolePlayPage checks live against
// /api/roleplay-events and shows a "coming soon" state for the rest rather
// than trusting a hardcoded built/not-built flag here that could drift.
export const HYBRID_EVENT_ROLEPLAY_NAME = {
  'banking-and-financial-systems': 'Banking & Financial Systems',
  'business-management': 'Business Management',
  'customer-service': 'Customer Service',
  'entrepreneurship': 'Entrepreneurship',
  'hospitality-and-event-management': 'Hospitality & Event Management',
  'international-business': 'International Business',
  'management-information-systems': 'Management Information Systems',
  'marketing': 'Marketing',
  'network-design': 'Network Design',
  'parliamentary-procedure': 'Parliamentary Procedure',
  'sports-and-entertainment-management': 'Sports & Entertainment Management',
  'technology-support-and-services': 'Technology Support & Services',
}

export const HYBRID_EVENT_SLUGS = Object.keys(HYBRID_EVENT_ROLEPLAY_NAME)

export function isHybridEvent(slug) {
  return HYBRID_EVENT_SLUGS.includes(slug)
}
