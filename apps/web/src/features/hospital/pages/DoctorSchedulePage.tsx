import { useCallback, useEffect, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { PageHeader } from '../../../components/PageHeader';

type AppointmentRow = {
  id: string;
  specialty: string;
  chiefComplaint: string | null;
  status: string;
  patient: { name: string; email: string };
  slot: { startAt: string; endAt: string };
};

function formatSlot(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Doctor schedule — list own appointments; optional complete. */
export function DoctorSchedulePage() {
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await orgApi<AppointmentRow[]>('/hospital/appointments/mine');
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await orgApi(`/hospital/appointments/${id}/complete`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark complete');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="My Schedule"
        description="Your upcoming patient appointments."
      />

      {error && <div className="alert error">{error}</div>}

      {!rows.length ? (
        <div className="empty-state">
          <strong>No appointments on your schedule</strong>
          Patients booking Cardiology / Orthopedics / General Medicine will show here.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Patient</th>
                <th>Specialty</th>
                <th>Complaint</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatSlot(r.slot.startAt)}</td>
                  <td>
                    <div>{r.patient.name}</div>
                    <div className="muted small">{r.patient.email}</div>
                  </td>
                  <td>{r.specialty}</td>
                  <td>{r.chiefComplaint || '—'}</td>
                  <td>
                    <span className={`pill status-${r.status.toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td className="table-actions">
                    {r.status === 'BOOKED' ? (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={busyId === r.id}
                        onClick={() => void complete(r.id)}
                      >
                        Mark complete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
