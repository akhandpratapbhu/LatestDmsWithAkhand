import { useEffect, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { PageHeader } from '../../../components/PageHeader';

type PatientRow = {
  patientId: string;
  name: string;
  email: string;
  phone: string | null;
  appointmentCount: number;
  lastSpecialty: string;
};

export function DoctorPatientsPage() {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void orgApi<PatientRow[]>('/hospital/patients/mine')
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load patients'));
  }, []);

  return (
    <div>
      <PageHeader
        title="My Patients"
        description="Patients who have booked with you."
      />

      {error && <div className="alert error">{error}</div>}

      {!rows.length ? (
        <div className="empty-state">
          <strong>No patients yet</strong>
          Bookings against your specialty will appear here.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Visits</th>
                <th>Last specialty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.patientId}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.appointmentCount}</td>
                  <td>{r.lastSpecialty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
