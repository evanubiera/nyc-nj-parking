import { useId } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

/** REC-2: 2 km by default (PRD-5). */
export const RADIUS_OPTIONS = [1000, 2000, 5000, 10000] as const;
export const DEFAULT_RADIUS = 2000;

export function RadiusPicker({ value, onChange }: { value: number; onChange: (radius: number) => void }) {
  const intl = useIntl();
  const id = useId();
  return (
    <div className="radius">
      <label htmlFor={id}>
        <FormattedMessage id="search.radius.label" />
      </label>
      <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {RADIUS_OPTIONS.map((radius) => (
          <option key={radius} value={radius}>
            {intl.formatMessage({ id: 'search.radius.option' }, { km: radius / 1000 })}
          </option>
        ))}
      </select>
    </div>
  );
}
