import { useId, useState, type KeyboardEvent } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { pointFor, useAddressSuggestions, type Suggestion } from '../hooks/useAddressSuggestions.ts';
import type { Point } from '../utils/location.ts';

/**
 * WEB-11: type a town or an address and choose a suggestion, by keyboard (arrows, Enter, Escape) or touch.
 * Follows the ARIA combobox pattern: the input owns a listbox, and the active option is announced.
 */
export function AddressSearch({ onSelect }: { onSelect: (point: Point, label: string) => void }) {
  const intl = useIntl();
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [failed, setFailed] = useState(false);
  // The chosen suggestion's label fills the box; it isn't looked up again (PRIV-5).
  const [chosen, setChosen] = useState<string | null>(null);
  const suggestions = useAddressSuggestions(text === chosen ? '' : text);
  const items = suggestions.data ?? [];
  const showList = open && items.length > 0;
  const showEmpty = open && suggestions.isSuccess && items.length === 0 && text.trim().length >= 3;

  const choose = async (suggestion: Suggestion) => {
    setOpen(false);
    setActive(-1);
    setChosen(suggestion.label);
    setText(suggestion.label);
    const point = await pointFor(suggestion);
    setFailed(point === null);
    if (point) onSelect(point, suggestion.label);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault();
      setActive((index) => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === 'Enter' && showList) {
      event.preventDefault();
      void choose(items[Math.max(active, 0)]!);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="address">
      <label htmlFor={id}>
        <FormattedMessage id="address.label" />
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={intl.formatMessage({ id: 'address.placeholder' })}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActive(-1);
          setFailed(false);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
      />
      <ul id={listId} role="listbox" className="address__list" hidden={!showList} aria-label={intl.formatMessage({ id: 'address.suggestions' })}>
        {items.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            className="address__option"
            // Choose on mousedown, before the input's blur closes the list.
            onMouseDown={(event) => {
              event.preventDefault();
              void choose(suggestion);
            }}
          >
            <span className="address__name">{suggestion.label}</span>
            {suggestion.area && (
              <span className="address__area">
                <FormattedMessage id="address.area" values={{ area: suggestion.area, state: suggestion.state }} />
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="address__status" role="status" aria-live="polite">
        {showEmpty && <FormattedMessage id="address.none" />}
        {failed && <FormattedMessage id="address.notFound" />}
        {showList && (
          <span className="visually-hidden">
            <FormattedMessage id="address.count" values={{ count: items.length }} />
          </span>
        )}
      </p>
      <p className="address__credit">
        <FormattedMessage id="address.credit" />
      </p>
    </div>
  );
}
