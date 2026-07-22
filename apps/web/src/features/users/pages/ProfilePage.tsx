import { FormEvent, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../auth/auth-context';
import type { AuthUser } from '@dms/shared';

export function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api<AuthUser>('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName, lastName, phone: phone || null }),
      });
      await refreshMe();
      setMessage('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onAvatar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem('avatar') as HTMLInputElement) ?? null;
    const file = input?.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      await api<AuthUser>('/users/me/avatar', { method: 'POST', body });
      await refreshMe();
      setMessage('Profile picture updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <section className="panel">
      <h1>Profile</h1>
      <p className="lede">Update your name, phone, and profile picture.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {user?.avatarUrl && (
        <img
          className="avatar"
          src={
            user.avatarUrl.startsWith('http')
              ? user.avatarUrl
              : `http://localhost:3000${user.avatarUrl}`
          }
          alt="Profile"
        />
      )}

      <form className="auth-form compact" onSubmit={(e) => void onSave(e)}>
        <label>
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </label>
        <label>
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button className="btn primary" type="submit">
          Save profile
        </button>
      </form>

      <form className="auth-form compact" onSubmit={(e) => void onAvatar(e)}>
        <h2>Profile picture</h2>
        <label>
          Image
          <input name="avatar" type="file" accept="image/*" required />
        </label>
        <button className="btn secondary" type="submit">
          Upload
        </button>
      </form>
    </section>
  );
}
