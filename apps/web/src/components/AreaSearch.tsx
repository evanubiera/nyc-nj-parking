import { useId, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useAreas } from '../hooks/useAreas.ts';
import type { AreaOption } from '../services/areas.ts';
import type { Point } from '../utils/location.ts';

/**
 * WEB-13: a dropdown of New Jersey's counties and New York City's boroughs. To search around a city, a second dropdown
 * then lists the chosen area's towns (NJ) or neighbourhoods (NYC). Native selects, so they work by keyboard, touch,
 * and screen reader as the platform does.
 */
export function AreaSearch({
  withPlaces,
  onArea,
  onPlace,
}: {
  /** True to choose a city in the area; false to search the whole area. */
  withPlaces: boolean;
  onArea?: (area: AreaOption) => void;
  onPlace?: (point: Point, label: string) => void;
}) {
  const intl = useIntl();
  const areaId = useId();
  const placeId = useId();
  const areas = useAreas(true);
  const [chosenArea, setChosenArea] = useState('');
  const [chosenPlace, setChosenPlace] = useState('');
  const options = areas.data ?? [];
  const area = options.find((option) => option.id === chosenArea);
  const groups = (['NJ', 'NY'] as const).map((state) => ({ state, areas: options.filter((option) => option.state === state) }));

  return (
    <div className="area-search">
      <div className="area-search__field">
        <label htmlFor={areaId}>
          <FormattedMessage id="area.label" />
        </label>
        <select
          id={areaId}
          value={chosenArea}
          disabled={!areas.isSuccess}
          onChange={(event) => {
            setChosenArea(event.target.value);
            setChosenPlace('');
            const next = options.find((option) => option.id === event.target.value);
            if (next && !withPlaces) onArea?.(next);
          }}
        >
          <option value="">{intl.formatMessage({ id: areas.isSuccess ? 'area.placeholder' : 'area.loading' })}</option>
          {groups.map(({ state, areas: inState }) => (
            <optgroup key={state} label={intl.formatMessage({ id: `area.group.${state}` })}>
              {inState.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {withPlaces && (
        <div className="area-search__field">
          <label htmlFor={placeId}>
            <FormattedMessage id={area?.state === 'NY' ? 'city.labelNeighbourhood' : 'city.label'} />
          </label>
          <select
            id={placeId}
            value={chosenPlace}
            disabled={!area}
            onChange={(event) => {
              setChosenPlace(event.target.value);
              const place = area?.places.find((option) => option.name === event.target.value);
              if (place) onPlace?.(place.point, place.name);
            }}
          >
            <option value="">{intl.formatMessage({ id: area ? 'city.placeholder' : 'city.chooseAreaFirst' })}</option>
            {area?.places.map((place) => (
              <option key={place.name} value={place.name}>
                {place.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
