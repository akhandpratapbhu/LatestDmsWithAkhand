import type { DashboardDataSource, DashboardWidgetConfig } from '@dms/shared';

export type HospitalDashboardStats = {
  scope: 'admin' | 'doctor' | 'patient' | 'none';
  stats: {
    pendingAppointments: number;
    todayAppointments: number;
    totalAppointments: number;
    completedAppointments: number;
    doctorsCount: number;
    patientsCount: number;
  };
  upcoming: Array<{
    id: string;
    startAt: string;
    endAt: string;
    specialty: string;
    status: string;
    doctorName: string;
    patientName: string;
  }>;
};

export type SchoolDashboardStats = {
  forms: Record<string, { name: string; count: number }>;
  totals: {
    forms: number;
    submissions: number;
    students: number;
    teachers: number;
    classes: number;
    attendanceRecords: number;
    feeCollections: number;
    examResults: number;
  };
};

export type LiveDashboardContext = {
  hospital?: HospitalDashboardStats | null;
  school?: SchoolDashboardStats | null;
};

export const HOSPITAL_DATA_SOURCES: Array<{
  value: DashboardDataSource;
  label: string;
  kind: 'stat' | 'list';
}> = [
  { value: 'hospital.pendingAppointments', label: 'Pending appointments', kind: 'stat' },
  { value: 'hospital.todayAppointments', label: "Today's appointments", kind: 'stat' },
  { value: 'hospital.totalAppointments', label: 'Total appointments', kind: 'stat' },
  { value: 'hospital.completedAppointments', label: 'Completed appointments', kind: 'stat' },
  { value: 'hospital.doctorsCount', label: 'Doctors count', kind: 'stat' },
  { value: 'hospital.patientsCount', label: 'Patients count', kind: 'stat' },
  { value: 'hospital.upcomingAppointments', label: 'Upcoming appointments (list)', kind: 'list' },
];

export const SCHOOL_DATA_SOURCES: Array<{
  value: DashboardDataSource;
  label: string;
  kind: 'stat' | 'list';
}> = [
  { value: 'school.students', label: 'Students (registrations)', kind: 'stat' },
  { value: 'school.teachers', label: 'Teachers / staff', kind: 'stat' },
  { value: 'school.classes', label: 'Classes / sections', kind: 'stat' },
  { value: 'school.attendanceRecords', label: 'Attendance records', kind: 'stat' },
  { value: 'school.feeCollections', label: 'Fee collections', kind: 'stat' },
  { value: 'school.examResults', label: 'Exam results', kind: 'stat' },
  { value: 'school.submissionsTotal', label: 'All form submissions', kind: 'stat' },
  { value: 'school.formCount', label: 'Single form count (set form code)', kind: 'stat' },
];

export function resolveWidgetValue(
  config: DashboardWidgetConfig | Record<string, unknown>,
  live: LiveDashboardContext,
): { display: string; rows?: Array<{ primary: string; secondary?: string }> } {
  const cfg = config as DashboardWidgetConfig;
  const source = cfg.dataSource;

  if (!source) {
    return {
      display: String(cfg.valueLabel || cfg.body || '—'),
      rows: Array.isArray(cfg.series)
        ? undefined
        : undefined,
    };
  }

  if (source.startsWith('hospital.') && live.hospital) {
    const s = live.hospital.stats;
    switch (source) {
      case 'hospital.pendingAppointments':
        return { display: String(s.pendingAppointments) };
      case 'hospital.todayAppointments':
        return { display: String(s.todayAppointments) };
      case 'hospital.totalAppointments':
        return { display: String(s.totalAppointments) };
      case 'hospital.completedAppointments':
        return { display: String(s.completedAppointments) };
      case 'hospital.doctorsCount':
        return { display: String(s.doctorsCount) };
      case 'hospital.patientsCount':
        return { display: String(s.patientsCount) };
      case 'hospital.upcomingAppointments': {
        const limit = cfg.limit ?? 5;
        const rows = live.hospital.upcoming.slice(0, limit).map((a) => {
          const when = new Date(a.startAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          return {
            primary: `${when} · ${a.specialty}`,
            secondary: `${a.patientName} · ${a.doctorName}`,
          };
        });
        return {
          display: rows.length ? `${rows.length} upcoming` : 'No upcoming appointments',
          rows,
        };
      }
      default:
        break;
    }
  }

  if (source.startsWith('school.') && live.school) {
    const t = live.school.totals;
    switch (source) {
      case 'school.students':
        return { display: String(t.students) };
      case 'school.teachers':
        return { display: String(t.teachers) };
      case 'school.classes':
        return { display: String(t.classes) };
      case 'school.attendanceRecords':
        return { display: String(t.attendanceRecords) };
      case 'school.feeCollections':
        return { display: String(t.feeCollections) };
      case 'school.examResults':
        return { display: String(t.examResults) };
      case 'school.submissionsTotal':
        return { display: String(t.submissions) };
      case 'school.formCount': {
        const code = cfg.formCode;
        if (code && live.school.forms[code]) {
          return { display: String(live.school.forms[code].count) };
        }
        return { display: String(cfg.valueLabel || '0') };
      }
      default:
        break;
    }
  }

  return { display: String(cfg.valueLabel || cfg.body || '—') };
}
