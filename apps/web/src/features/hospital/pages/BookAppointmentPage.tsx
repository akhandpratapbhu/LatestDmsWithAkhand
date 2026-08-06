import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { PageHeader } from '../../../components/PageHeader';

type SpecialtyCategory = {
  id: string;
  label: string;
  description: string;
  specialty: string;
};

type DoctorRow = {
  id: string;
  name: string;
  specialty: string;
  department: string | null;
  bio: string | null;
  email: string;
};

type SlotRow = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
};

type Step = 1 | 2 | 3 | 4;

function formatSlot(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function BookAppointmentPage() {
  const href = useWorkspaceHref();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [categories, setCategories] = useState<SpecialtyCategory[]>([]);
  const [category, setCategory] = useState<SpecialtyCategory | null>(null);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [doctor, setDoctor] = useState<DoctorRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [complaint, setComplaint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void orgApi<SpecialtyCategory[]>('/hospital/specialties')
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load specialties'))
      .finally(() => setLoading(false));
  }, []);

  const stepLabel = useMemo(() => {
    switch (step) {
      case 1:
        return 'Choose what you need help with';
      case 2:
        return 'Pick a doctor';
      case 3:
        return 'Select an available slot';
      case 4:
        return 'Confirm booking';
      default:
        return '';
    }
  }, [step]);

  async function selectCategory(c: SpecialtyCategory) {
    setError(null);
    setCategory(c);
    setDoctor(null);
    setSlot(null);
    setBusy(true);
    try {
      const list = await orgApi<DoctorRow[]>(
        `/hospital/doctors?specialty=${encodeURIComponent(c.specialty)}`,
      );
      setDoctors(list);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load doctors');
    } finally {
      setBusy(false);
    }
  }

  async function selectDoctor(d: DoctorRow) {
    setError(null);
    setDoctor(d);
    setSlot(null);
    setBusy(true);
    try {
      const list = await orgApi<SlotRow[]>(`/hospital/doctors/${d.id}/slots`);
      setSlots(list);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load slots');
    } finally {
      setBusy(false);
    }
  }

  function selectSlot(s: SlotRow) {
    setSlot(s);
    setStep(4);
  }

  async function confirmBook() {
    if (!category || !doctor || !slot) return;
    setBusy(true);
    setError(null);
    try {
      await orgApi('/hospital/appointments', {
        method: 'POST',
        body: JSON.stringify({
          slotId: slot.id,
          specialty: category.specialty,
          chiefComplaint: complaint.trim() || category.label,
        }),
      });
      navigate(href('/app/hospital/my-appointments'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hospital-booking">
      <PageHeader
        title="Book Appointment"
        description={stepLabel}
        actions={
          <Link className="btn secondary" to={href('/app/hospital/my-appointments')}>
            My Appointments
          </Link>
        }
      />

      <div className="hospital-steps" aria-label="Booking steps">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`hospital-step${step === n ? ' active' : ''}${step > n ? ' done' : ''}`}>
            {n}. {n === 1 ? 'Specialty' : n === 2 ? 'Doctor' : n === 3 ? 'Slot' : 'Confirm'}
          </span>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {step === 1 && !loading && (
        <div className="hospital-choice-grid">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="hospital-choice"
              disabled={busy}
              onClick={() => void selectCategory(c)}
            >
              <strong>{c.label}</strong>
              <span>{c.description}</span>
              <em>{c.specialty}</em>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div>
          <button type="button" className="btn ghost" onClick={() => setStep(1)}>
            ← Back
          </button>
          {doctors.length === 0 ? (
            <div className="empty-state">
              <strong>No doctors for {category?.specialty}</strong>
              Ask an admin to seed hospital appointments.
            </div>
          ) : (
            <div className="hospital-choice-grid">
              {doctors.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="hospital-choice"
                  disabled={busy}
                  onClick={() => void selectDoctor(d)}
                >
                  <strong>{d.name}</strong>
                  <span>{d.department || d.specialty}</span>
                  {d.bio ? <em>{d.bio}</em> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <button type="button" className="btn ghost" onClick={() => setStep(2)}>
            ← Back
          </button>
          {slots.length === 0 ? (
            <div className="empty-state">
              <strong>No open slots</strong>
              Try another doctor or check back later.
            </div>
          ) : (
            <div className="hospital-slot-list">
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="hospital-slot"
                  disabled={busy}
                  onClick={() => selectSlot(s)}
                >
                  {formatSlot(s.startAt)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 4 && category && doctor && slot && (
        <div className="hospital-confirm">
          <button type="button" className="btn ghost" onClick={() => setStep(3)}>
            ← Back
          </button>
          <dl className="hospital-confirm-dl">
            <div>
              <dt>Specialty</dt>
              <dd>{category.specialty}</dd>
            </div>
            <div>
              <dt>Doctor</dt>
              <dd>{doctor.name}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{formatSlot(slot.startAt)}</dd>
            </div>
          </dl>
          <label className="field">
            <span>Chief complaint (optional)</span>
            <textarea
              rows={3}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Briefly describe your symptoms"
            />
          </label>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void confirmBook()}>
            {busy ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      )}
    </div>
  );
}
