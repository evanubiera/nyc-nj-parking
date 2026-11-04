import type { OperatorType } from '@parking/api-client';
import { FormattedMessage } from 'react-intl';
import { OPERATOR_TYPES, RUN_BY_TYPES } from '../utils/operatorTypes.ts';

/**
 * WEB-8, WEB-9: which kinds of operator to search, and whether to include unconfirmed sites from tax records
 * (operator type `unknown`), as a checkbox of their own. Everything is chosen at first.
 */
export function OperatorFilter({ value, onChange }: { value: readonly OperatorType[]; onChange: (types: OperatorType[]) => void }) {
  const toggle = (type: OperatorType, on: boolean) =>
    onChange(OPERATOR_TYPES.filter((option) => (option === type ? on : value.includes(option))));

  return (
    <>
      <fieldset className="operators">
        <legend>
          <FormattedMessage id="search.operators.legend" />
        </legend>
        <ul className="operators__list">
          {RUN_BY_TYPES.map((type) => (
            <li key={type}>
              <label className="operators__option">
                <input type="checkbox" checked={value.includes(type)} onChange={(event) => toggle(type, event.target.checked)} />
                <FormattedMessage id={`facility.operatorType.${type}`} />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className="operators__option operators__unconfirmed">
        <input type="checkbox" checked={value.includes('unknown')} onChange={(event) => toggle('unknown', event.target.checked)} />
        <FormattedMessage id="search.unconfirmed.toggle" />
      </label>
    </>
  );
}
