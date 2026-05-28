import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Download, Trash2, AlertTriangle } from 'lucide-react';
import TopNav from '../../../shared/components/TopNav';

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
      className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? 'bg-primary' : 'bg-border'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
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
            <button className="btn-secondary btn-sm shrink-0 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </Row>
          <Row>
            <RowLabel
              label="Clear outfit history"
              description="Remove all past outfit records."
            />
            <button className="btn-sm shrink-0 gap-1.5 rounded-xl border border-warning/50 bg-warning/10 px-4 text-warning hover:bg-warning/20">
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </Row>
          <Row>
            <RowLabel
              label="Delete account"
              description="Permanently remove your account and all data."
            />
            <button className="btn-sm shrink-0 gap-1.5 rounded-xl border border-destructive/50 bg-destructive/10 px-4 text-destructive hover:bg-destructive/20">
              <AlertTriangle className="h-3.5 w-3.5" />
              Delete
            </button>
          </Row>
        </Section>
      </main>
    </div>
  );
}
