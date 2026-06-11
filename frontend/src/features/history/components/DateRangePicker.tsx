import { useState } from 'react';
import { CalendarRange, ChevronDown } from 'lucide-react';
import type { DateRange as CalendarRangeValue } from 'react-day-picker';
import { Calendar } from '@/shared/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/utils/cn';

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// react-day-picker works in local `Date`s; the rest of the app speaks ISO
// `YYYY-MM-DD` strings. Convert at this boundary so the contract is unchanged.
function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toCalendarValue(value: DateRange | null): CalendarRangeValue | undefined {
  if (!value) return undefined;
  return { from: fromISO(value.from), to: fromISO(value.to) };
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarRangeValue | undefined>(
    toCalendarValue(value),
  );

  const canApply = Boolean(draft?.from && draft?.to);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Reset the in-flight selection to the committed value each time the
        // popover opens so an abandoned selection doesn't linger.
        if (next) setDraft(toCalendarValue(value));
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs font-semibold text-terracotta">
          <CalendarRange className="h-3.5 w-3.5" />
          {value ? `${formatShort(value.from)} – ${formatShort(value.to)}` : 'Custom'}
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-auto rounded-2xl border-sand p-0">
        <Calendar
          mode="range"
          autoFocus
          numberOfMonths={1}
          defaultMonth={draft?.from ?? (value ? fromISO(value.from) : undefined)}
          selected={draft}
          onSelect={setDraft}
          disabled={{ after: new Date() }}
        />
        <div className="flex gap-2 border-t border-sand p-3">
          <button
            onClick={() => {
              setDraft(undefined);
              onChange(null);
              setOpen(false);
            }}
            className="btn-outline btn-sm flex-1"
          >
            Clear
          </button>
          <button
            onClick={() => {
              if (!draft?.from || !draft?.to) return;
              onChange({ from: toISO(draft.from), to: toISO(draft.to) });
              setOpen(false);
            }}
            disabled={!canApply}
            className="btn-primary btn-sm flex-1 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
