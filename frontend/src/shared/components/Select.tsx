import { ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn';

export type SelectOption<T extends string> = { value: T; label: string };

type SelectProps<T extends string> = {
  value: T | '';
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  id?: string;
  className?: string;
};

/**
 * Thin wrapper over a native <select> styled with the shared `.input` class.
 * Native select keeps accessibility and mobile pickers for free; the chevron is
 * a decorative overlay (the native arrow is hidden via `appearance-none`).
 */
export default function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  id,
  className,
}: SelectProps<T>) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn('input cursor-pointer appearance-none pr-9', className)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
