import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, Pencil, MapPin } from 'lucide-react';
import { searchCities } from '../../../shared/geocode';
import { token } from '../../../shared/api/token';
import {
  AESTHETICS,
  DEFAULT_AESTHETIC,
  normalizeAesthetic,
  type Aesthetic,
} from '../../../shared/aesthetics';
import { getPreferences, getProfile, updatePreferences, updateProfile } from '../api';

// Derive a friendly display name from an email's local-part, since the backend
// stores no separate name field — e.g. "alex.rivera@example.com" → "Alex Rivera".
function displayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const name = localPart
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return name || email;
}

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

// Vertical variant of Row — label stacked above its control. Shares Row's
// padding and divider semantics so every row in a Section lines up identically.
function StackedRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-3.5 last:border-b-0">{children}</div>
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
type FitPref = 'Slim' | 'Regular' | 'Relaxed' | 'Oversized';

export default function SettingsPage() {
  const navigate = useNavigate();

  // Account — fetched from the authenticated user's profile
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  // Preferences
  const [tempUnit, setTempUnit] = useState<TempUnit>('Celsius');
  const [location, setLocation] = useState('');
  const [savedLocation, setSavedLocation] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [locationQuery, setLocationQuery] = useState('');
  const [style, setStyle] = useState<Aesthetic>(DEFAULT_AESTHETIC);
  const [savedStyle, setSavedStyle] = useState<Aesthetic>(DEFAULT_AESTHETIC);
  const [savingStyle, setSavingStyle] = useState(false);
  const [styleStatus, setStyleStatus] = useState<string | null>(null);
  const [fit, setFit] = useState<FitPref>('Regular');

  useEffect(() => {
    getProfile()
      .then((p) => {
        setEmail(p.email);
        // Use the stored name; fall back to an email-derived name when unset.
        const display = p.name?.trim() ? p.name : displayNameFromEmail(p.email);
        setName(display);
        setSavedName(display);
      })
      .catch(() => {
        /* best-effort; account fields stay empty */
      });
  }, []);

  function startEditName() {
    setNameStatus(null);
    setEditingName(true);
  }

  function cancelEditName() {
    setName(savedName);
    setNameStatus(null);
    setEditingName(false);
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavingName(true);
    setNameStatus(null);
    try {
      const updated = await updateProfile(trimmed);
      const display = updated.name?.trim() ? updated.name : trimmed;
      setName(display);
      setSavedName(display);
      setEditingName(false);
      setNameStatus('Saved!');
    } catch {
      setNameStatus('Could not save. Please try again.');
    } finally {
      setSavingName(false);
      setTimeout(() => setNameStatus(null), 3000);
    }
  }

  useEffect(() => {
    getPreferences()
      .then((p) => {
        const loc = p.answers?.['location'] ?? '';
        setLocation(loc);
        setSavedLocation(loc);
        const aesthetic = normalizeAesthetic(p.answers?.['aesthetic']);
        setStyle(aesthetic);
        setSavedStyle(aesthetic);
      })
      .catch(() => {
        /* best-effort; location stays empty */
      });
  }, []);

  useEffect(() => {
    if (locationQuery.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }
    let cancelled = false;
    searchCities(locationQuery).then((results) => {
      if (!cancelled) setLocationSuggestions(results);
    });
    return () => {
      cancelled = true;
    };
  }, [locationQuery]);

  // Selecting an aesthetic only stages the choice; nothing persists until the
  // user taps Save (mirrors the Default location row). Saving is the only thing
  // that starts a fresh AI session, so we don't want every tap to reshuffle.
  async function saveStyle() {
    if (style === savedStyle) return;
    const previous = savedStyle;
    setStyleStatus(null);
    setSavingStyle(true);
    try {
      // answers are replaced wholesale on save, so merge into the current map.
      const current = await getPreferences();
      await updatePreferences({
        styles: current.styles ?? [],
        answers: { ...(current.answers ?? {}), aesthetic: style },
        use_ai: current.use_ai ?? true,
      });
      setSavedStyle(style);
      setStyleStatus('Saved!');
    } catch {
      setStyle(previous); // revert the staged choice on error
      setStyleStatus('Could not save. Please try again.');
    } finally {
      setSavingStyle(false);
      setTimeout(() => setStyleStatus(null), 3000);
    }
  }

  async function saveLocation() {
    if (!location.trim()) return;
    setSavingLocation(true);
    setLocationStatus(null);
    try {
      const current = await getPreferences();
      await updatePreferences({
        styles: current.styles ?? [],
        answers: { ...(current.answers ?? {}), location: location.trim() },
        use_ai: current.use_ai ?? true,
      });
      setSavedLocation(location.trim());
      setLocationStatus('Saved!');
    } catch {
      setLocationStatus('Could not save. Please try again.');
    } finally {
      setSavingLocation(false);
      setTimeout(() => setLocationStatus(null), 3000);
    }
  }

  const [recTime, setRecTime] = useState('08:00');
  const [dailyReminder, setDailyReminder] = useState(true);

  return (
    <div className="pb-28 md:pb-8">
      <main className="mx-auto max-w-xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h2 className="mb-1">Settings</h2>
          <p className="helper-text">Manage your account and preferences.</p>
        </div>

        {/* ── Account ── */}
        <Section title="Account">
          {editingName ? (
            <StackedRow>
              <div className="flex items-center justify-between gap-4">
                <RowLabel label="Name" htmlFor="name-input" />
                <input
                  id="name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') cancelEditName();
                  }}
                  placeholder="Your name"
                  maxLength={100}
                  autoFocus
                  className="input w-40 text-sm"
                />
              </div>
              <div className="mt-2.5 flex items-center justify-end gap-3">
                <AnimatePresence>
                  {nameStatus && (
                    <motion.span
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-muted-foreground"
                    >
                      {nameStatus}
                    </motion.span>
                  )}
                </AnimatePresence>
                <button
                  onClick={cancelEditName}
                  disabled={savingName}
                  className="btn-secondary btn-sm shrink-0"
                >
                  Cancel
                </button>
                <button
                  onClick={saveName}
                  disabled={savingName || !name.trim()}
                  className="btn-primary btn-sm shrink-0 disabled:opacity-50"
                >
                  {savingName ? 'Saving…' : 'Save'}
                </button>
              </div>
            </StackedRow>
          ) : (
            <Row>
              <RowLabel label="Name" />
              <div className="flex items-center gap-3">
                <AnimatePresence>
                  {nameStatus && (
                    <motion.span
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-muted-foreground"
                    >
                      {nameStatus}
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="text-sm text-muted-foreground">
                  {savedName || '—'}
                </span>
                <button
                  onClick={startEditName}
                  aria-label="Edit name"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </Row>
          )}
          <Row>
            <RowLabel label="Email" />
            <span className="truncate text-sm text-muted-foreground">
              {email || '—'}
            </span>
          </Row>
          <Row>
            <RowLabel
              label="Sign out"
              description="You'll be returned to the home screen."
            />
            <button
              onClick={() => {
                token.clear();
                navigate('/');
              }}
              className="btn-secondary btn-sm shrink-0 gap-1.5 text-destructive border-destructive/50 hover:bg-destructive/10"
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
          <StackedRow>
            <div className="flex items-center justify-between gap-4">
              <RowLabel
                label="Default location"
                description="City or postcode used for weather."
                htmlFor="location-input"
              />
              <div className="relative">
                <input
                  id="location-input"
                  type="text"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setLocationQuery(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && saveLocation()}
                  onBlur={() => setLocationSuggestions([])}
                  placeholder="e.g. London"
                  className="input w-32 text-sm"
                />
                <AnimatePresence>
                  {locationSuggestions.length > 0 && (
                    <motion.ul
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-full z-10 mt-1 min-w-52 rounded-xl border border-border bg-card shadow-md"
                    >
                      {locationSuggestions.map((city) => (
                        <li key={city}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setLocation(city);
                              setLocationQuery('');
                              setLocationSuggestions([]);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {city}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {(location !== savedLocation || locationStatus) && (
              <div className="mt-2.5 flex items-center justify-end gap-3">
                <AnimatePresence>
                  {locationStatus && (
                    <motion.span
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-muted-foreground"
                    >
                      {locationStatus}
                    </motion.span>
                  )}
                </AnimatePresence>
                {location !== savedLocation && (
                  <button
                    onClick={saveLocation}
                    disabled={savingLocation || !location.trim()}
                    className="btn-primary btn-sm shrink-0 disabled:opacity-50"
                  >
                    {savingLocation ? 'Saving…' : 'Save location'}
                  </button>
                )}
              </div>
            )}
          </StackedRow>
          <StackedRow>
            <div className="mb-2.5">
              <p className="text-sm font-medium text-foreground">Aesthetic</p>
            </div>
            <Segmented<Aesthetic>
              options={[...AESTHETICS]}
              value={style}
              onChange={setStyle}
            />
            {(style !== savedStyle || styleStatus) && (
              <div className="mt-2.5 flex items-center justify-end gap-3">
                <AnimatePresence>
                  {styleStatus && (
                    <motion.span
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-muted-foreground"
                    >
                      {styleStatus}
                    </motion.span>
                  )}
                </AnimatePresence>
                {style !== savedStyle && (
                  <button
                    onClick={saveStyle}
                    disabled={savingStyle}
                    className="btn-primary btn-sm shrink-0 disabled:opacity-50"
                  >
                    {savingStyle ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
            )}
          </StackedRow>
          <StackedRow>
            <p className="mb-2.5 text-sm font-medium text-foreground">Fit preference</p>
            <Segmented<FitPref>
              options={['Slim', 'Regular', 'Relaxed', 'Oversized']}
              value={fit}
              onChange={setFit}
            />
          </StackedRow>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
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
        </Section>
      </main>
    </div>
  );
}
