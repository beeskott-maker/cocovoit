import { useId, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: string;
  error?: string | null;
  hint?: string;
  /** Champ obligatoire : astérisque rouge après le label. */
  required?: boolean;
}

/** Champ texte « outlined » Material 3, comme dans la maquette. */
export function TextField({ label, icon, error, hint, required, disabled, className, ...input }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const classes = ['text-field', disabled && 'text-field--disabled', error && 'text-field--error', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div>
      <div className={classes}>
        <label htmlFor={id} className="text-field__label">
          {label}
          {required && (
            <span className="text-field__required" aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
        {icon && <img className="text-field__icon" src={icon} alt="" width={24} height={24} />}
        <input
          id={id}
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? hintId : undefined}
          {...input}
        />
      </div>
      {(error || hint) && (
        <p id={hintId} className={error ? 'field-hint field-hint--error' : 'field-hint'}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
