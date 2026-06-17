// Google OAuth (KAN-97). A single consent grants both sign-in identity and
// Google Calendar read access; the backend exchanges the returned code for
// tokens, signs the user in, and syncs their calendar.

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

// openid/email/profile → identity for sign-in; calendar.readonly → event sync.
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const STATE_KEY = 'google_oauth_state';

export const GOOGLE_CALLBACK_PATH = '/auth/google/callback';

/** The redirect URI must exactly match one registered for the OAuth client. */
export function googleRedirectUri(): string {
  return `${window.location.origin}${GOOGLE_CALLBACK_PATH}`;
}

export function isGoogleConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

/** Generates and stores a CSRF state token, returning it for the auth request. */
function issueState(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  return state;
}

/** Verifies and clears the state returned on the callback. */
export function consumeState(returned: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return Boolean(returned) && returned === expected;
}

/** Redirects the browser to Google's consent screen. */
export function startGoogleSignIn(): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    // offline + consent so Google returns a refresh token for ongoing sync.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: issueState(),
  });

  window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
}
