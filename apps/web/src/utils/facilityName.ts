import type { RecommendedFacility } from '@parking/api-client';
import type { IntlShape } from 'react-intl';

/** REC-8: the name, with the lot number when the source has several lots with this name. */
export function facilityName(intl: IntlShape, facility: Pick<RecommendedFacility, 'name' | 'lotNumber'>): string {
  return facility.lotNumber === null
    ? facility.name
    : intl.formatMessage({ id: 'facility.nameWithLot' }, { name: facility.name, lot: facility.lotNumber });
}
