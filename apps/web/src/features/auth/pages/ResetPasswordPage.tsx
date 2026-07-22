import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { MessageResponse } from '@dms/shared';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<MessageResponse>(
        '/auth/reset-password',
        { method: 'POST', body: JSON.stringify({ token, password }) },
        false,
      );
      setMessage(res.message);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
      <h1>Reset password</h1>
      <p className="lede">Choose a new password for your account.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {!token && <div className="alert error">Missing reset token in URL.</div>}

      <label>
        New password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!token}
        />
      </label>

      <button className="btn primary" type="submit" disabled={loading || !token}>
        {loading ? 'Saving…' : 'Update password'}
      </button>

      <div className="auth-links">
        <Link to="/login">Back to sign in</Link>
      </div>
    </form>
  );
}
