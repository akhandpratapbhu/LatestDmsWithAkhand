import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { PageHeader } from '../../../components/PageHeader';

type HospitalMe = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
  patientProfile: {
    id: string;
    dateOfBirth: string | null;
    gender: string | null;
    bloodGroup: string | null;
    address: string | null;
  } | null;
};

export function PatientProfilePage() {
  const href = useWorkspaceHref();
  const [data, setData] = useState<HospitalMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void orgApi<HospitalMe>('/hospital/me')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile'));
  }, []);

  const u = data?.user;
  const p = data?.patientProfile;

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Your patient record for this hospital."
        actions={
          <Link className="btn secondary" to={href('/app/hospital/book')}>
            Book Appointment
          </Link>
        }
      />

      {error && <div className="alert error">{error}</div>}

      {u && (
        <dl className="hospital-confirm-dl">
          <div>
            <dt>Name</dt>
            <dd>
              {u.firstName} {u.lastName}
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{u.email}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{u.phone || '—'}</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{p?.gender || '—'}</dd>
          </div>
          <div>
            <dt>Blood group</dt>
            <dd>{p?.bloodGroup || '—'}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{p?.address || '—'}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
