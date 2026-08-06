import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { PageHeader } from '../../../components/PageHeader';

type AppointmentRow = {
  id: string;
  specialty: string;
  chiefComplaint: string | null;
  status: string;
  doctor: { name: string; specialty: string };
  patient: { name: string; email: string };
  slot: { startAt: string; endAt: string };
};

type HospitalMe = {
  isDoctor: boolean;
  isPatient: boolean;
  isAdmin: boolean;
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

export function MyAppointmentsPage() {
  const href = useWorkspaceHref();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [me, setMe] = useState<HospitalMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, ctx] = await Promise.all([
        orgApi<AppointmentRow[]>('/hospital/appointments/mine'),
        orgApi<HospitalMe>('/hospital/me'),
      ]);
      setRows(list);
      setMe(ctx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load appointments');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(id: string) {
    if (!window.confirm('Cancel this appointment? The slot will open again.')) return;
    setBusyId(id);
    setError(null);
    try {
      await orgApi(`/hospital/appointments/${id}/cancel`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  const title = me?.isDoctor && !me.isPatient ? 'My Schedule' : 'My Appointments';

  return (
    <div>
      <PageHeader
        title={title}
        description="Upcoming and recent appointments for your hospital role."
        actions={
          me?.isPatient || me?.isAdmin ? (
            <Link className="btn primary" to={href('/app/hospital/book')}>
              Book Appointment
            </Link>
          ) : null
        }
      />

      {error && <div className="alert error">{error}</div>}

      {!rows.length ? (
        <div className="empty-state">
          <strong>No appointments yet</strong>
          {me?.isPatient ? 'Book a visit from the patient portal.' : 'Patients will appear here when they book.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Specialty</th>
                {(me?.isDoctor || me?.isAdmin) && <th>Patient</th>}
                {(me?.isPatient || me?.isAdmin) && <th>Doctor</th>}
                <th>Status</th>
                <th>Complaint</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatSlot(r.slot.startAt)}</td>
                  <td>{r.specialty}</td>
                  {(me?.isDoctor || me?.isAdmin) && <td>{r.patient.name}</td>}
                  {(me?.isPatient || me?.isAdmin) && <td>{r.doctor.name}</td>}
                  <td>
                    <span className={`pill status-${r.status.toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td>{r.chiefComplaint || '—'}</td>
                  <td className="table-actions">
                    {r.status === 'BOOKED' && (me?.isPatient || me?.isAdmin) ? (
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={busyId === r.id}
                        onClick={() => void cancel(r.id)}
                      >
                        Cancel
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
