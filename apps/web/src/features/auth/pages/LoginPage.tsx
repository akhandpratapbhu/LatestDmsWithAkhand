import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, 'Web Browser');
      navigate('/app/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
      <h1>Sign in</h1>
      <p className="lede">Access Configure System with email and password.</p>

      {error && <div className="alert error">{error}</div>}

      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <button className="btn primary" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="auth-links">
        <Link to="/otp-login">Sign in with OTP</Link>
        <Link to="/forgot-password">Forgot password?</Link>
        <Link to="/register">Create account</Link>
      </div>
    </form>
  );
}
