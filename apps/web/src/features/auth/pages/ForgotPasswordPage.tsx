import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { ForgotPasswordResetTokenResponse, MessageResponse } from '@dms/shared';

type Step = 'email' | 'otp' | 'password';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<MessageResponse>(
        '/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email }) },
        false,
      );
      setInfo(res.message);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<ForgotPasswordResetTokenResponse>(
        '/auth/forgot-password/verify-otp',
        { method: 'POST', body: JSON.stringify({ email, otp }) },
        false,
      );
      setResetToken(res.resetToken);
      setInfo(res.message);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api<MessageResponse>(
        '/auth/reset-password',
        { method: 'POST', body: JSON.stringify({ token: resetToken, password }) },
        false,
      );
      setInfo(res.message);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="auth-form"
      onSubmit={(e) =>
        void (step === 'email' ? sendOtp(e) : step === 'otp' ? verifyOtp(e) : updatePassword(e))
      }
    >
      <h1>Forgot password</h1>
      <p className="lede">
        {step === 'email' && 'Enter your email to receive a one-time code.'}
        {step === 'otp' && 'Enter the OTP sent to your email.'}
        {step === 'password' && 'OTP verified. Choose a new password.'}
      </p>

      {error && <div className="alert error">{error}</div>}
      {info && <div className="alert success">{info}</div>}

      {step === 'email' && (
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      )}

      {step === 'otp' && (
        <>
          <label>
            Email
            <input type="email" value={email} disabled />
          </label>
          <label>
            OTP code
            <input
              inputMode="numeric"
              required
              minLength={4}
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoFocus
            />
          </label>
        </>
      )}

      {step === 'password' && (
        <>
          <label>
            New password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        </>
      )}

      <button className="btn primary" type="submit" disabled={loading}>
        {loading
          ? 'Please wait…'
          : step === 'email'
            ? 'Send OTP'
            : step === 'otp'
              ? 'Verify OTP'
              : 'Update password'}
      </button>

      {step === 'otp' && (
        <button
          className="btn"
          type="button"
          disabled={loading}
          onClick={() => {
            setOtp('');
            setError(null);
            setStep('email');
            setInfo(null);
          }}
        >
          Change email
        </button>
      )}

      <div className="auth-links">
        <Link to="/login">Back to sign in</Link>
      </div>
    </form>
  );
}
