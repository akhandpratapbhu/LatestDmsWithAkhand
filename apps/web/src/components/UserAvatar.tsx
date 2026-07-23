import { useState } from 'react';
import { resolveMediaUrl } from '../lib/media';

type UserAvatarProps = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export function UserAvatar({
  firstName,
  lastName,
  avatarUrl,
  className = '',
  size = 'sm',
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || 'U';
  const src = resolveMediaUrl(avatarUrl);

  if (src && !broken) {
    return (
      <img
        className={`user-avatar img ${size} ${className}`.trim()}
        src={src}
        alt=""
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span className={`user-avatar fallback ${size} ${className}`.trim()} aria-hidden>
      {initials}
    </span>
  );
}
