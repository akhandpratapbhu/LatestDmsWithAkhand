import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { MessageResponse } from '@dms/shared';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<MessageResponse>(
        '/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email }) },
        false,
      );
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
      <h1>Forgot password</h1>
      <p className="lede">We will email you a reset link if the account exists.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <label>
        Email
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      <button className="btn primary" type="submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      <div className="auth-links">
        <Link to="/login">Back to sign in</Link>
      </div>
    </form>
  );
}
