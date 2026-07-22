import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAuth } from '../auth-context';
import type { MessageResponse } from '@dms/shared';

export function OtpLoginPage() {
  const { loginWithOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<MessageResponse>(
        '/auth/otp/request',
        { method: 'POST', body: JSON.stringify({ email }) },
        false,
      );
      setInfo(res.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithOtp(email, otp, 'Web Browser (OTP)');
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(e) => void (sent ? verify(e) : requestOtp(e))}>
      <h1>OTP sign in</h1>
      <p className="lede">Receive a one-time code by email (logged in console in dev).</p>

      {error && <div className="alert error">{error}</div>}
      {info && <div className="alert success">{info}</div>}

      <label>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sent}
        />
      </label>

      {sent && (
        <label>
          OTP code
          <input
            inputMode="numeric"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
        </label>
      )}

      <button className="btn primary" type="submit" disabled={loading}>
        {loading ? 'Please wait…' : sent ? 'Verify & sign in' : 'Send OTP'}
      </button>

      <div className="auth-links">
        <Link to="/login">Password sign in</Link>
      </div>
    </form>
  );
}
