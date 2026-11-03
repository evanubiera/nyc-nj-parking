// The English message catalog (WEB-1). Every string people see or hear comes from here.
// Text marked [Placeholder, …] waits on the open question it names (docs/open-questions.md).
export const en = {
  'app.title': 'NYC and NJ public parking',
  'app.name': 'NYC and NJ public parking',
  'skipLink.label': 'Skip to main content',

  'home.heading': 'Find public parking near you',
  'home.intro':
    'Garages, lots, and fields run by cities, counties, the state, and transit agencies in New York City and New Jersey.',
  'home.comingSoon':
    'Search arrives in the next release, starting with NYC Department of Transportation garages and fields.',

  'status.checking': 'Checking the service…',
  'status.ok': 'The service is running.',
  'status.unavailable': "The service isn't available right now.",

  // ATT-1. The wording must come from a lawyer (PRD-2). Don't replace it with our own.
  'disclaimer.text': '[Placeholder, PRD-2] The accuracy disclaimer will appear here once a lawyer has written it.',
} as const;

export type MessageId = keyof typeof en;

// Makes react-intl check message IDs against this catalog at compile time.
declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId;
    }
  }
}
