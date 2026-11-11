import { useId, type Ref } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

/** WEB-13: how a person searches. A town or address is the default (WEB-11). */
export type SearchMode = 'place' | 'city' | 'area' | 'location';
export const SEARCH_MODES: readonly SearchMode[] = ['place', 'city', 'area', 'location'];

export function SearchBy({ value, onChange, ref }: { value: SearchMode; onChange: (mode: SearchMode) => void; ref?: Ref<HTMLSelectElement> }) {
  const intl = useIntl();
  const id = useId();
  return (
    <div className="search-by">
      <label htmlFor={id}>
        <FormattedMessage id="searchBy.label" />
      </label>
      <select ref={ref} id={id} value={value} onChange={(event) => onChange(event.target.value as SearchMode)}>
        {SEARCH_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {intl.formatMessage({ id: `searchBy.${mode}` })}
          </option>
        ))}
      </select>
    </div>
  );
}
