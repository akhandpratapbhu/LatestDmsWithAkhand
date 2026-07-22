import { useAuth } from '../auth-context';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <section className="panel"> 
    {/* //test comment */}
      <h1>Welcome, {user?.firstName}</h1>
      <p className="lede">
        You are signed in as <strong>{user?.email}</strong>. Email verified:{' '}
        {user?.emailVerified ? 'yes' : 'no'}.
      </p>

      <div className="action-row">
        <Link className="btn secondary" to="/app/sessions">
          Manage sessions
        </Link>
        <button className="btn ghost" type="button" onClick={() => void logout(true)}>
          Log out all devices
        </button>
      </div>
    </section>
  );
}
