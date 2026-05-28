import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shirt } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    // TODO: connect to auth API
    setTimeout(() => navigate('/onboarding'), 1000);
  }

  return (
    <div className="min-h-screen-safe flex flex-col items-center justify-center bg-gradient-to-b from-cream to-linen px-4 py-12">
      {/* Brand */}
      <div className="mb-10 text-center">
        <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-terracotta shadow-lg">
          <Shirt className="h-8 w-8 text-cream" />
        </div>
        <h1 className="mb-2 text-espresso">TheThinker</h1>
        <p className="text-muted-foreground">
          Stop wasting time Thinking on what to wear.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="card space-y-5 p-8 shadow-md">
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
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="password">
                Password
              </label>
              <button type="button" className="btn-link text-xs text-muted-foreground">
                Forgot password?
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

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="divider" />
          <span className="whitespace-nowrap text-xs text-muted-foreground">or</span>
          <div className="divider" />
        </div>

        {/* Sign up */}
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <button className="btn-link font-semibold text-terracotta">Sign up</button>
        </p>
      </div>
    </div>
  );
}
