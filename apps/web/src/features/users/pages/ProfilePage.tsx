import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../auth/auth-context';
import type { AuthUser } from '@dms/shared';
import { UserAvatar } from '../../../components/UserAvatar';
import { PageHeader } from '../../../components/PageHeader';

export function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  async function uploadAvatar(file: File) {
    setError(null);
    setUploading(true);
    const body = new FormData();
    body.append('file', file);
    try {
      await api<AuthUser>('/users/me/avatar', { method: 'POST', body });
      await refreshMe();
      setMessage('Profile picture updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadAvatar(file);
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Click your photo to change it. Header updates right after upload."
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="section-card">
        <div className="section-card-body profile-layout">
          <div className="profile-avatar-block">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={onAvatarChange}
            />
            <button
              type="button"
              className="avatar-picker"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              aria-label="Change profile picture"
              title="Click to change photo"
            >
              <UserAvatar
                firstName={user?.firstName}
                lastName={user?.lastName}
                avatarUrl={user?.avatarUrl}
                size="lg"
              />
              <span className="avatar-picker-hint">{uploading ? 'Uploading…' : 'Change photo'}</span>
            </button>
          </div>

          <form className="auth-form compact" onSubmit={(e) => void onSave(e)}>
            <h2>Account details</h2>
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
        </div>
      </section>
    </div>
  );
}
