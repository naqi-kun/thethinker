import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { register } from '../api';
import { startGoogleSignIn, isGoogleConfigured } from '../google';
import { token } from '../../../shared/api/token';
import { ApiError } from '../../../shared/api/httpClient';
import BrandLogo from '../../../shared/components/BrandLogo';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (token.get()) return <Navigate to="/wardrobe" replace />;

  async function handleSubmit() {
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      className="min-h-screen-safe flex flex-col items-center bg-cream px-4 py-12"
    >
      {/* Brand */}
      <div className="mb-8 text-center">
        <BrandLogo className="mx-auto mb-3 w-52" />
        <p className="text-sm text-muted-foreground">Your digital atelier await.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <div className="card p-8 shadow-sm">
          <h2 className="mb-6 text-center font-serif text-2xl text-espresso">
            Join the Atelier
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-5"
          >
            <AnimatePresence>
              {error && (
                <motion.p
                  key={error}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

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
              <label
                className="block text-xs font-medium uppercase tracking-widest text-espresso"
                htmlFor="password"
              >
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
              <label
                className="block text-xs font-medium uppercase tracking-widest text-espresso"
                htmlFor="confirmPassword"
              >
                Confirm Password
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

          <div className="my-5 flex items-center gap-3">
            <div className="divider" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">or</span>
            <div className="divider" />
          </div>

          <button
            type="button"
            onClick={startGoogleSignIn}
            disabled={!isGoogleConfigured()}
            className="btn-secondary btn-lg w-full flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-terracotta hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
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
