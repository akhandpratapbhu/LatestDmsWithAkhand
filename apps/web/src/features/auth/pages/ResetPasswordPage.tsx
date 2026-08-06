import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

/** Legacy link-based reset redirects into the OTP forgot-password flow. */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  useEffect(() => {
    if (!token) {
      navigate('/forgot-password', { replace: true });
    }
  }, [navigate, token]);

  if (!token) {
    return null;
  }

  return (
    <div className="auth-form">
      <h1>Reset password</h1>
      <p className="lede">
        Password reset now uses an email OTP. Please start again from forgot password.
      </p>
      <div className="auth-links">
        <Link to="/forgot-password">Forgot password</Link>
        <Link to="/login">Back to sign in</Link>
      </div>
    </div>
  );
}
