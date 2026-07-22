import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { AuthUser } from '@dms/shared';

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api<AuthUser>(
        '/users/accept-invite',
        {
          method: 'POST',
          body: JSON.stringify({ token, password, firstName, lastName }),
        },
        false,
      );
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    }
  }

  return (
    <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
      <h1>Accept invite</h1>
      <p className="lede">Set your password to activate your account.</p>
      {error && <div className="alert error">{error}</div>}
      {!token && <div className="alert error">Missing invite token.</div>}
      <label>
        First name
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </label>
      <label>
        Last name
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!token}
        />
      </label>
      <button className="btn primary" type="submit" disabled={!token}>
        Activate account
      </button>
      <div className="auth-links">
        <Link to="/login">Back to sign in</Link>
      </div>
    </form>
  );
}
