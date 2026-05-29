import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shirt } from 'lucide-react';
import { register } from '../api';
import { token } from '../../../shared/api/token';
import { ApiError } from '../../../shared/api/httpClient';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (token.get()) return <Navigate to="/onboarding" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await register({ email, password });
      token.set(result.token);
      navigate('/onboarding');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('An account with this email already exists.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen-safe flex flex-col items-center justify-center bg-gradient-to-b from-cream to-linen px-4 py-12">
      {/* Brand */}
      <div className="mb-10 text-center">
        <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-terracotta shadow-lg">
          <Shirt className="h-8 w-8 text-cream" />
        </div>
        <h1 className="mb-2 text-espresso">TheThinker</h1>
        <p className="text-muted-foreground">Create your account to get started.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="card space-y-5 p-8 shadow-md">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="label" htmlFor="password">
              Password
            </label>
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

          <div className="space-y-1.5">
            <label className="label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              className="input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary btn-lg w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="divider" />
          <span className="whitespace-nowrap text-xs text-muted-foreground">or</span>
          <div className="divider" />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="btn-link font-semibold text-terracotta">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
