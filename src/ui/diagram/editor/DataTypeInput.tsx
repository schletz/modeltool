import { forwardRef, useState, type KeyboardEvent } from 'react';
import { DATA_TYPE_SUGGESTIONS } from '../../../domain/dataTypes';

interface DataTypeInputProps {
  value: string;
  onChange(value: string): void;
  onFocus(): void;
  disabled: boolean;
  className: string;
  'aria-label': string;
}

/** Matching suggestions for what has been typed so far (before any parameters). */
function suggestionsFor(value: string): string[] {
  const typed = value.trim().toUpperCase();
  if (!typed || typed.includes('(')) return [];
  const matches = DATA_TYPE_SUGGESTIONS.filter((s) => s.startsWith(typed));
  return matches.length === 1 && matches[0] === typed ? [] : matches;
}

/**
 * Combobox for SQL data types. While the suggestion list is open, arrow keys and Enter
 * operate the list; otherwise they bubble to the editor's row navigation. Choosing a type
 * with parameters selects the placeholder ("n", "p,s") so the user can type over it.
 */
export const DataTypeInput = forwardRef<HTMLInputElement, DataTypeInputProps>(function DataTypeInput(props, ref) {
  const { value, onChange, onFocus, disabled, className } = props;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = open ? suggestionsFor(value) : [];

  const choose = (input: HTMLInputElement, suggestion: string): void => {
    onChange(suggestion);
    setOpen(false);
    const start = suggestion.indexOf('(');
    if (start >= 0) {
      // Wait until React has written the new value into the input.
      requestAnimationFrame(() => input.setSelectionRange(start + 1, suggestion.length - 1));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + delta + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      choose(e.currentTarget, suggestions[Math.min(active, suggestions.length - 1)] as string);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="datatype-input">
      <input
        ref={ref}
        type="text"
        value={value}
        disabled={disabled}
        className={className}
        aria-label={props['aria-label']}
        spellCheck={false}
        onFocus={onFocus}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {suggestions.length > 0 && (
        <ul className="datatype-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                const input = e.currentTarget.closest('.datatype-input')?.querySelector('input');
                if (input) choose(input, s);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
