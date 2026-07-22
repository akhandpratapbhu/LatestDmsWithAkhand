import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { MessageResponse } from '@dms/shared';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing verification token.');
      return;
    }
    void (async () => {
      try {
        const res = await api<MessageResponse>(
          '/auth/verify-email',
          { method: 'POST', body: JSON.stringify({ token }) },
          false,
        );
        setMessage(res.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    })();
  }, [token]);

  async function resend() {
    setResendMsg(null);
    try {
      const res = await api<MessageResponse>(
        '/auth/resend-verification',
        { method: 'POST', body: JSON.stringify({ email }) },
        false,
      );
      setResendMsg(res.message);
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : 'Failed to resend');
    }
  }

  return (
    <div className="auth-form">
      <h1>Email verification</h1>
      <p className="lede">Confirming your email address.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <label>
        Resend verification
        <input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button
        className="btn secondary"
        type="button"
        onClick={() => void resend()}
        disabled={!email}
      >
        Resend link
      </button>
      {resendMsg && <p className="muted">{resendMsg}</p>}

      <div className="auth-links">
        <Link to="/login">Continue to sign in</Link>
      </div>
    </div>
  );
}
