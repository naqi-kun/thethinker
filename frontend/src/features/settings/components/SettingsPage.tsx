import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Download, Trash2, AlertTriangle, Plus, X } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';
import { getWorkSchedule, updateWorkSchedule } from '../api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? 'bg-primary' : 'bg-border'
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            value === opt
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h6 className="mb-3 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h6>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
      {children}
    </div>
  );
}

function RowLabel({
  label,
  description,
  htmlFor,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-0.5 cursor-pointer">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </label>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TempUnit = 'Celsius' | 'Fahrenheit';
type StylePref = 'Minimal' | 'Classic' | 'Streetwear' | 'Sporty' | 'Formal';
type FitPref = 'Slim' | 'Regular' | 'Relaxed' | 'Oversized';

export default function SettingsPage() {
  const navigate = useNavigate();

  // Account
  const [name] = useState('Alex Rivera');
  const [email] = useState('alex.rivera@example.com');

  // Preferences
  const [tempUnit, setTempUnit] = useState<TempUnit>('Celsius');
  const [location, setLocation] = useState('');
  const [style, setStyle] = useState<StylePref>('Classic');
  const [fit, setFit] = useState<FitPref>('Regular');

  // Work schedule (KAN-49)
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);

  useEffect(() => {
    getWorkSchedule()
      .then((s) => {
        setWorkingDays(s.working_days ?? []);
        setWorkStart(s.work_start);
        setWorkEnd(s.work_end);
        setHolidays(s.holidays ?? []);
      })
      .catch(() => setScheduleStatus('Failed to load work schedule.'));
  }, []);

  function toggleWorkingDay(day: number) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function addHoliday() {
    if (!newHoliday || holidays.includes(newHoliday)) return;
    setHolidays((prev) => [...prev, newHoliday].sort());
    setNewHoliday('');
  }

  async function saveSchedule() {
    setSavingSchedule(true);
    setScheduleStatus(null);
    try {
      await updateWorkSchedule({
        working_days: workingDays,
        work_start: workStart,
        work_end: workEnd,
        holidays,
      });
      setScheduleStatus('Saved!');
    } catch {
      setScheduleStatus('Could not save. Please try again.');
    } finally {
      setSavingSchedule(false);
    }
  }

  // Recommendation rules
  const [recTime, setRecTime] = useState('08:00');
  const [avoidRecentlyWorn, setAvoidRecentlyWorn] = useState(true);
  const [includeAccessories, setIncludeAccessories] = useState(true);
  const [weatherAware, setWeatherAware] = useState(true);
  const [calendarAware, setCalendarAware] = useState(true);

  // Notifications
  const [dailyReminder, setDailyReminder] = useState(true);
  const [weatherAlert, setWeatherAlert] = useState(false);
  const [eventReminder, setEventReminder] = useState(true);

  return (
    <div className="min-h-screen-safe bg-background pb-12">
      <TopNav />

      <main className="mx-auto max-w-xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h2 className="mb-1">Settings</h2>
          <p className="helper-text">Manage your account and preferences.</p>
        </div>

        {/* ── Account ── */}
        <Section title="Account">
          <Row>
            <RowLabel label="Name" />
            <span className="text-sm text-muted-foreground">{name}</span>
          </Row>
          <Row>
            <RowLabel label="Email" />
            <span className="truncate text-sm text-muted-foreground">{email}</span>
          </Row>
          <Row>
            <RowLabel
              label="Sign out"
              description="You'll be returned to the home screen."
            />
            <button
              onClick={() => navigate('/')}
              className="btn-outline btn-sm shrink-0 gap-1.5 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </Row>
        </Section>

        {/* ── Preferences ── */}
        <Section title="Preferences">
          <Row>
            <RowLabel label="Temperature unit" />
            <Segmented<TempUnit>
              options={['Celsius', 'Fahrenheit']}
              value={tempUnit}
              onChange={setTempUnit}
            />
          </Row>
          <Row>
            <RowLabel
              label="Default location"
              description="Used for weather context."
              htmlFor="location-input"
            />
            <input
              id="location-input"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or ZIP"
              className="input w-36 text-sm"
            />
          </Row>
          <div className="border-b border-border px-4 py-3.5 last:border-b-0">
            <p className="mb-2.5 text-sm font-medium text-foreground">
              Style preference
            </p>
            <Segmented<StylePref>
              options={['Minimal', 'Classic', 'Streetwear', 'Sporty', 'Formal']}
              value={style}
              onChange={setStyle}
            />
          </div>
          <div className="px-4 py-3.5">
            <p className="mb-2.5 text-sm font-medium text-foreground">Fit preference</p>
            <Segmented<FitPref>
              options={['Slim', 'Regular', 'Relaxed', 'Oversized']}
              value={fit}
              onChange={setFit}
            />
          </div>
        </Section>

        {/* ── Work schedule (KAN-49) ── */}
        <Section title="Work Schedule">
          <div className="border-b border-border px-4 py-3.5">
            <p className="mb-2.5 text-sm font-medium text-foreground">Working days</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((label, day) => {
                const active = workingDays.includes(day);
                return (
                  <button
                    key={label}
                    onClick={() => toggleWorkingDay(day)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <Row>
            <RowLabel
              label="Working time"
              description="Used to recommend work outfits."
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="input w-28 text-sm"
                aria-label="Work start time"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="input w-28 text-sm"
                aria-label="Work end time"
              />
            </div>
          </Row>
          <div className="border-b border-border px-4 py-3.5">
            <p className="mb-2.5 text-sm font-medium text-foreground">Holidays</p>
            {holidays.length > 0 && (
              <ul className="mb-3 space-y-2">
                {holidays.map((h) => (
                  <li
                    key={h}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{h}</span>
                    <button
                      onClick={() => setHolidays((prev) => prev.filter((d) => d !== h))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove holiday ${h}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="input flex-1 text-sm"
                aria-label="New holiday date"
              />
              <button
                onClick={addHoliday}
                disabled={!newHoliday}
                className="btn-secondary btn-sm shrink-0 gap-1.5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            {scheduleStatus ? (
              <span className="text-xs text-muted-foreground">{scheduleStatus}</span>
            ) : (
              <span />
            )}
            <button
              onClick={saveSchedule}
              disabled={savingSchedule}
              className="btn-primary btn-sm shrink-0 disabled:opacity-50"
            >
              {savingSchedule ? 'Saving…' : 'Save schedule'}
            </button>
          </div>
        </Section>

        {/* ── Recommendation rules ── */}
        <Section title="Recommendation Rules">
          <Row>
            <RowLabel
              label="Daily recommendation time"
              description="When to receive your daily outfit."
              htmlFor="rec-time"
            />
            <input
              id="rec-time"
              type="time"
              value={recTime}
              onChange={(e) => setRecTime(e.target.value)}
              className="input w-32 text-sm"
            />
          </Row>
          <Row>
            <RowLabel
              label="Avoid recently worn items"
              description="Skip items worn in the last 3 days."
              htmlFor="toggle-recent"
            />
            <Toggle
              id="toggle-recent"
              checked={avoidRecentlyWorn}
              onChange={setAvoidRecentlyWorn}
            />
          </Row>
          <Row>
            <RowLabel
              label="Include accessories"
              description="Add watches, bags, and belts to outfits."
              htmlFor="toggle-accessories"
            />
            <Toggle
              id="toggle-accessories"
              checked={includeAccessories}
              onChange={setIncludeAccessories}
            />
          </Row>
          <Row>
            <RowLabel
              label="Weather-aware recommendations"
              description="Adjust outfits based on local forecast."
              htmlFor="toggle-weather"
            />
            <Toggle
              id="toggle-weather"
              checked={weatherAware}
              onChange={setWeatherAware}
            />
          </Row>
          <Row>
            <RowLabel
              label="Calendar-aware recommendations"
              description="Match outfits to your upcoming events."
              htmlFor="toggle-calendar"
            />
            <Toggle
              id="toggle-calendar"
              checked={calendarAware}
              onChange={setCalendarAware}
            />
          </Row>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <Row>
            <RowLabel
              label="Daily outfit reminder"
              description="Get notified with your morning recommendation."
              htmlFor="toggle-daily"
            />
            <Toggle
              id="toggle-daily"
              checked={dailyReminder}
              onChange={setDailyReminder}
            />
          </Row>
          <Row>
            <RowLabel
              label="Weather alerts"
              description="Notify when forecast changes affect your outfit."
              htmlFor="toggle-weather-alert"
            />
            <Toggle
              id="toggle-weather-alert"
              checked={weatherAlert}
              onChange={setWeatherAlert}
            />
          </Row>
          <Row>
            <RowLabel
              label="Event reminders"
              description="Get outfit ideas before calendar events."
              htmlFor="toggle-event"
            />
            <Toggle
              id="toggle-event"
              checked={eventReminder}
              onChange={setEventReminder}
            />
          </Row>
        </Section>

        {/* ── Privacy ── */}
        <Section title="Privacy">
          <Row>
            <RowLabel
              label="Export data"
              description="Download your wardrobe and preferences."
            />
            <button className="btn-secondary btn-sm w-24 shrink-0 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </Row>
          <Row>
            <RowLabel
              label="Clear outfit history"
              description="Remove all past outfit records."
            />
            <button className="btn-secondary btn-sm w-24 shrink-0 gap-1.5 text-warning border-warning/50 hover:bg-warning/10">
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </Row>
          <Row>
            <RowLabel
              label="Delete account"
              description="Permanently remove your account and all data."
            />
            <button className="btn-secondary btn-sm w-24 shrink-0 gap-1.5 text-destructive border-destructive/50 hover:bg-destructive/10">
              <AlertTriangle className="h-3.5 w-3.5" />
              Delete
            </button>
          </Row>
        </Section>
      </main>
    </div>
  );
}
