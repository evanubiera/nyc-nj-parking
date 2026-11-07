// Helpers for sources that are web pages rather than datasets.

const EMAIL_ADDRESS = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi;

/**
 * ING-2: a page's email addresses, such as staff contacts, are removed before the page is stored. We have no use for
 * them, and a snapshot is kept (ADR-0015).
 */
export function withoutEmailAddresses(body: Uint8Array): Uint8Array {
  return new TextEncoder().encode(new TextDecoder().decode(body).replace(EMAIL_ADDRESS, '[email address removed]'));
}

/** The text of an HTML fragment, such as a table cell: tags removed, common entities decoded, spaces collapsed. */
export function fragmentText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#x27;|&#39;|&#8217;|&rsquo;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
