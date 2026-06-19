import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { login } from '../api';
import { startGoogleSignIn, isGoogleConfigured } from '../google';
import { token } from '../../../shared/api/token';
import { ApiError } from '../../../shared/api/httpClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (token.get()) return <Navigate to="/wardrobe" replace />;

  async function handleSubmit() {
    setError('');
    setIsLoading(true);
    try {
      const result = await login({ email, password });
      token.set(result.token);
      navigate('/wardrobe');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Incorrect email or password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen-safe flex flex-col items-center bg-cream px-4 py-12">
      {/* Brand */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-terracotta shadow-md">
          <HangerIcon className="h-8 w-8 text-cream" />
        </div>
        <p className="font-serif text-2xl text-espresso">TheThinker</p>
        <p className="text-sm text-muted-foreground">Your digital atelier await.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <div className="card p-8 shadow-sm">
          <h2 className="mb-6 text-center font-serif text-2xl text-espresso">
            Welcome Back
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-5"
          >
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <label
                className="block text-xs font-medium uppercase tracking-widest text-espresso"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="your@style.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="block text-xs font-medium uppercase tracking-widest text-espresso"
                  htmlFor="password"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="btn-link text-xs text-muted-foreground"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary btn-lg w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="divider" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">or</span>
            <div className="divider" />
          </div>

          <button
            type="button"
            onClick={startGoogleSignIn}
            disabled={false}
            className="btn-secondary btn-lg w-full flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            New to the atelier?{' '}
            <Link
              to="/register"
              className="font-semibold text-terracotta hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* Mood images */}
      <div className="mt-10 grid w-full max-w-sm grid-cols-3 gap-3">
        <img
          src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=300&q=80"
          alt=""
          className="aspect-square rounded-xl object-cover"
        />
        <img
          src="https://images.unsplash.com/photo-1517842645767-c639042777db?w=300&q=80"
          alt=""
          className="aspect-square rounded-xl object-cover"
        />
        <img
          src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=300&q=80"
          alt=""
          className="aspect-square rounded-xl object-cover"
        />
      </div>
    </div>
  );
}

function HangerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5a1.5 1.5 0 0 1 1.5 1.5c0 .9-.75 1.6-1.5 2.2L3 16h18L12 7.2c-.75-.6-1.5-1.3-1.5-2.2A1.5 1.5 0 0 1 12 3.5z" />
      <line x1="3" y1="16" x2="21" y2="16" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
