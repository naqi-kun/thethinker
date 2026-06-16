import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { loginWithGoogle } from '../api';
import { consumeState, googleRedirectUri } from '../google';
import { token } from '../../../shared/api/token';

// Landing route for Google's OAuth redirect. Validates the CSRF state, exchanges
// the authorization code via the backend, stores the session, and routes onward.
export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  // Guard against React 18 StrictMode double-invocation consuming the code twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get('code');
    const returnedState = params.get('state');
    const oauthError = params.get('error');

    if (oauthError) {
      setError('Google sign-in was cancelled.');
      return;
    }
    if (!code) {
      setError('Missing authorization code from Google.');
      return;
    }
    if (!consumeState(returnedState)) {
      setError('Sign-in could not be verified. Please try again.');
      return;
    }

    loginWithGoogle(code, googleRedirectUri())
      .then((result) => {
        token.set(result.token);
        navigate(result.is_new ? '/onboarding' : '/wardrobe', { replace: true });
      })
      .catch(() => {
        setError('Could not complete Google sign-in. Please try again.');
      });
  }, [params, navigate]);

  return (
    <div className="min-h-screen-safe flex flex-col items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <div className="card p-8 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl text-espresso">Sign-in failed</h2>
            <p className="mb-6 text-sm text-muted-foreground">{error}</p>
            <Link to="/login" className="btn-primary btn-lg w-full">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-terracotta border-t-transparent" />
            <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
          </>
        )}
      </div>
    </div>
  );
}
