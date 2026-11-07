import type { Money } from '@parking/api-client';
import type { IntlShape } from 'react-intl';

/** Money in the locale, from minor units (CLAUDE.md rule 11): 75 USD minor units is "$0.75". Never "$" + amount. */
export function formatMoney(intl: IntlShape, { amountMinor, currency }: Money): string {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return intl.formatNumber(amountMinor / 10 ** digits, { style: 'currency', currency });
}
