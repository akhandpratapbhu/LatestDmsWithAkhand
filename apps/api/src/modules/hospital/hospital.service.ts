import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient as ProjectPrismaClient } from '@dms/project-client';
import { ProjectDbService } from '../project-db/project-db.service';
import { BookAppointmentDto } from './dto/hospital.dto';

/** Symptom category → specialty mapping used by the booking wizard. */
export const SPECIALTY_CATEGORIES = [
  {
    id: 'heart',
    label: 'Heart / Chest',
    description: 'Chest pain, palpitations, blood pressure',
    specialty: 'Cardiology',
  },
  {
    id: 'bone',
    label: 'Bone / Joint',
    description: 'Fractures, back pain, sports injuries',
    specialty: 'Orthopedics',
  },
  {
    id: 'general',
    label: 'General / Fever',
    description: 'Fever, cold, check-up, other concerns',
    specialty: 'General Medicine',
  },
] as const;

type RoleCodes = {
  isAdmin: boolean;
  isDoctor: boolean;
  isPatient: boolean;
  codes: string[];
};

@Injectable()
export class HospitalService {
  constructor(private readonly projectDb: ProjectDbService) {}

  private async requireProjectDb(organizationId: string): Promise<ProjectPrismaClient> {
    const client = await this.projectDb.getClient(organizationId);
    if (!client) {
      throw new BadRequestException('Hospital project database is not provisioned');
    }
    return client;
  }

  private async resolveRoles(
    db: ProjectPrismaClient,
    organizationId: string,
    userId: string,
  ): Promise<RoleCodes> {
    const member = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: {
        memberRoles: { include: { role: { select: { code: true, isSystem: true } } } },
      },
    });

    const codes = (member?.memberRoles ?? []).map((mr) => mr.role.code);
    const orgRole = member?.role;
    const isAdmin =
      orgRole === 'OWNER' ||
      orgRole === 'ADMIN' ||
      codes.includes('HOSPITAL_ADMIN') ||
      codes.includes('ADMIN');

    return {
      isAdmin,
      isDoctor: codes.includes('DOCTOR'),
      isPatient: codes.includes('PATIENT'),
      codes,
    };
  }

  listSpecialties() {
    return SPECIALTY_CATEGORIES.map((c) => ({ ...c }));
  }

  async listDoctors(organizationId: string, specialty?: string) {
    const db = await this.requireProjectDb(organizationId);
    const doctors = await db.doctorProfile.findMany({
      where: {
        active: true,
        ...(specialty ? { specialty: { equals: specialty, mode: 'insensitive' } } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ specialty: 'asc' }, { createdAt: 'asc' }],
    });

    return doctors.map((d) => ({
      id: d.id,
      userId: d.userId,
      specialty: d.specialty,
      department: d.department,
      bio: d.bio,
      name: `Dr. ${d.user.firstName} ${d.user.lastName}`.trim(),
      email: d.user.email,
    }));
  }

  async listAvailableSlots(organizationId: string, doctorId: string) {
    const db = await this.requireProjectDb(organizationId);
    const doctor = await db.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctor || !doctor.active) {
      throw new NotFoundException('Doctor not found');
    }

    const now = new Date();
    const slots = await db.appointmentSlot.findMany({
      where: {
        doctorId,
        status: 'AVAILABLE',
        startAt: { gte: now },
      },
      orderBy: { startAt: 'asc' },
      take: 100,
    });

    return slots.map((s) => ({
      id: s.id,
      doctorId: s.doctorId,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      status: s.status,
    }));
  }

  async getMyContext(organizationId: string, userId: string) {
    const db = await this.requireProjectDb(organizationId);
    const roles = await this.resolveRoles(db, organizationId, userId);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        doctorProfile: true,
        patientProfile: true,
      },
    });

    return {
      roles: roles.codes,
      isAdmin: roles.isAdmin,
      isDoctor: roles.isDoctor,
      isPatient: roles.isPatient,
      user: user
        ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
          }
        : null,
      doctorProfile: user?.doctorProfile
        ? {
            id: user.doctorProfile.id,
            specialty: user.doctorProfile.specialty,
            department: user.doctorProfile.department,
            bio: user.doctorProfile.bio,
            active: user.doctorProfile.active,
          }
        : null,
      patientProfile: user?.patientProfile
        ? {
            id: user.patientProfile.id,
            dateOfBirth: user.patientProfile.dateOfBirth?.toISOString() ?? null,
            gender: user.patientProfile.gender,
            bloodGroup: user.patientProfile.bloodGroup,
            address: user.patientProfile.address,
          }
        : null,
    };
  }

  async bookAppointment(organizationId: string, userId: string, dto: BookAppointmentDto) {
    const db = await this.requireProjectDb(organizationId);
    const roles = await this.resolveRoles(db, organizationId, userId);

    if (!roles.isPatient && !roles.isAdmin) {
      throw new ForbiddenException('Only patients can book appointments');
    }

    let patient = await db.patientProfile.findUnique({ where: { userId } });
    if (!patient) {
      if (!roles.isAdmin) {
        // Auto-create a minimal profile so demo patients can book immediately.
        patient = await db.patientProfile.create({ data: { userId } });
      } else {
        throw new BadRequestException('Patient profile required to book');
      }
    }

    return db.$transaction(async (tx) => {
      const slot = await tx.appointmentSlot.findUnique({
        where: { id: dto.slotId },
        include: { doctor: true },
      });
      if (!slot) throw new NotFoundException('Slot not found');
      if (slot.status !== 'AVAILABLE') {
        throw new BadRequestException('Slot is no longer available');
      }
      if (slot.startAt < new Date()) {
        throw new BadRequestException('Cannot book a past slot');
      }
      if (!slot.doctor.active) {
        throw new BadRequestException('Doctor is not accepting appointments');
      }

      await tx.appointmentSlot.update({
        where: { id: slot.id },
        data: { status: 'BOOKED' },
      });

      const appointment = await tx.appointment.create({
        data: {
          patientId: patient!.id,
          doctorId: slot.doctorId,
          slotId: slot.id,
          specialty: dto.specialty || slot.doctor.specialty,
          chiefComplaint: dto.chiefComplaint?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: 'BOOKED',
        },
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          patient: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          slot: true,
        },
      });

      return this.mapAppointment(appointment);
    });
  }

  async listMyAppointments(organizationId: string, userId: string) {
    const db = await this.requireProjectDb(organizationId);
    const roles = await this.resolveRoles(db, organizationId, userId);

    if (roles.isAdmin) {
      const all = await db.appointment.findMany({
        include: this.appointmentInclude(),
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return all.map((a) => this.mapAppointment(a));
    }

    if (roles.isDoctor) {
      const doctor = await db.doctorProfile.findUnique({ where: { userId } });
      if (!doctor) return [];
      const list = await db.appointment.findMany({
        where: { doctorId: doctor.id, status: { in: ['BOOKED', 'COMPLETED'] } },
        include: this.appointmentInclude(),
        orderBy: { slot: { startAt: 'asc' } },
      });
      return list.map((a) => this.mapAppointment(a));
    }

    if (roles.isPatient) {
      const patient = await db.patientProfile.findUnique({ where: { userId } });
      if (!patient) return [];
      const list = await db.appointment.findMany({
        where: { patientId: patient.id },
        include: this.appointmentInclude(),
        orderBy: { slot: { startAt: 'asc' } },
      });
      return list.map((a) => this.mapAppointment(a));
    }

    throw new ForbiddenException('No hospital role assigned');
  }

  /**
   * Role-scoped metrics + upcoming list for dashboard widgets.
   * Doctor → own schedule; Patient → own appointments; Admin → org-wide.
   */
  async getDashboardStats(organizationId: string, userId: string) {
    const db = await this.requireProjectDb(organizationId);
    const roles = await this.resolveRoles(db, organizationId, userId);

    const scope: 'admin' | 'doctor' | 'patient' | 'none' = roles.isAdmin
      ? 'admin'
      : roles.isDoctor
        ? 'doctor'
        : roles.isPatient
          ? 'patient'
          : 'none';

    if (scope === 'none') {
      return {
        scope,
        stats: {
          pendingAppointments: 0,
          todayAppointments: 0,
          totalAppointments: 0,
          completedAppointments: 0,
          doctorsCount: 0,
          patientsCount: 0,
        },
        upcoming: [] as Array<{
          id: string;
          startAt: string;
          endAt: string;
          specialty: string;
          status: string;
          doctorName: string;
          patientName: string;
        }>,
      };
    }

    const doctor =
      scope === 'doctor'
        ? await db.doctorProfile.findUnique({ where: { userId } })
        : null;
    const patient =
      scope === 'patient'
        ? await db.patientProfile.findUnique({ where: { userId } })
        : null;

    const where =
      scope === 'admin'
        ? {}
        : scope === 'doctor' && doctor
          ? { doctorId: doctor.id }
          : scope === 'patient' && patient
            ? { patientId: patient.id }
            : { id: '__none__' };

    const appointments = await db.appointment.findMany({
      where,
      include: this.appointmentInclude(),
      orderBy: { slot: { startAt: 'asc' } },
      take: 500,
    });

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const pending = appointments.filter(
      (a) => a.status === 'BOOKED' && a.slot.startAt >= now,
    );
    const today = appointments.filter(
      (a) =>
        a.status === 'BOOKED' &&
        a.slot.startAt >= startOfDay &&
        a.slot.startAt <= endOfDay,
    );
    const completed = appointments.filter((a) => a.status === 'COMPLETED');

    const doctorsCount =
      scope === 'admin'
        ? await db.doctorProfile.count({ where: { active: true } })
        : doctor
          ? 1
          : 0;

    let patientsCount = 0;
    if (scope === 'admin') {
      patientsCount = await db.patientProfile.count();
    } else if (scope === 'doctor' && doctor) {
      const distinct = await db.appointment.findMany({
        where: { doctorId: doctor.id, status: { in: ['BOOKED', 'COMPLETED'] } },
        select: { patientId: true },
        distinct: ['patientId'],
      });
      patientsCount = distinct.length;
    } else if (scope === 'patient') {
      patientsCount = patient ? 1 : 0;
    }

    const upcoming = pending.slice(0, 8).map((a) => ({
      id: a.id,
      startAt: a.slot.startAt.toISOString(),
      endAt: a.slot.endAt.toISOString(),
      specialty: a.specialty,
      status: a.status,
      doctorName: `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName}`.trim(),
      patientName: `${a.patient.user.firstName} ${a.patient.user.lastName}`.trim(),
    }));

    return {
      scope,
      stats: {
        pendingAppointments: pending.length,
        todayAppointments: today.length,
        totalAppointments: appointments.length,
        completedAppointments: completed.length,
        doctorsCount,
        patientsCount,
      },
      upcoming,
    };
  }

  async listMyPatients(organizationId: string, userId: string) {
    const db = await this.requireProjectDb(organizationId);
    const roles = await this.resolveRoles(db, organizationId, userId);

    if (!roles.isDoctor && !roles.isAdmin) {
      throw new ForbiddenException('Only doctors can view patient lists');
    }

    const doctor = roles.isAdmin
      ? null
      : await db.doctorProfile.findUnique({ where: { userId } });

    if (!roles.isAdmin && !doctor) return [];

    const appointments = await db.appointment.findMany({
      where: {
        ...(doctor ? { doctorId: doctor.id } : {}),
        status: { in: ['BOOKED', 'COMPLETED'] },
      },
      include: {
        patient: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byPatient = new Map<
      string,
      {
        patientId: string;
        name: string;
        email: string;
        phone: string | null;
        appointmentCount: number;
        lastSpecialty: string;
      }
    >();

    for (const a of appointments) {
      const existing = byPatient.get(a.patientId);
      if (existing) {
        existing.appointmentCount += 1;
        continue;
      }
      byPatient.set(a.patientId, {
        patientId: a.patientId,
        name: `${a.patient.user.firstName} ${a.patient.user.lastName}`.trim(),
        email: a.patient.user.email,
        phone: a.patient.user.phone,
        appointmentCount: 1,
        lastSpecialty: a.specialty,
      });
    }

    return [...byPatient.values()];
  }

  async cancelAppointment(organizationId: string, userId: string, appointmentId: string) {
    const db = await this.requireProjectDb(organizationId);
    const roles = await this.resolveRoles(db, organizationId, userId);

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true, slot: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('Appointment is already cancelled');
    }

    const ownsAsPatient = roles.isPatient && appointment.patient.userId === userId;
    const ownsAsDoctor = roles.isDoctor && appointment.doctor.userId === userId;
    if (!roles.isAdmin && !ownsAsPatient && !ownsAsDoctor) {
      throw new ForbiddenException('You cannot cancel this appointment');
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CANCELLED' },
        include: this.appointmentInclude(),
      });

      if (appointment.slot.status === 'BOOKED') {
        await tx.appointmentSlot.update({
          where: { id: appointment.slotId },
          data: { status: 'AVAILABLE' },
        });
      }

      return this.mapAppointment(updated);
    });
  }

  async completeAppointment(organizationId: string, userId: string, appointmentId: string) {
    const db = await this.requireProjectDb(organizationId);
    const roles = await this.resolveRoles(db, organizationId, userId);

    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.status !== 'BOOKED') {
      throw new BadRequestException('Only booked appointments can be completed');
    }

    const ownsAsDoctor = roles.isDoctor && appointment.doctor.userId === userId;
    if (!roles.isAdmin && !ownsAsDoctor) {
      throw new ForbiddenException('Only the assigned doctor can complete this appointment');
    }

    const updated = await db.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
      include: this.appointmentInclude(),
    });
    return this.mapAppointment(updated);
  }

  private appointmentInclude() {
    return {
      doctor: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      patient: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      slot: true,
    } as const;
  }

  private mapAppointment(a: {
    id: string;
    specialty: string;
    chiefComplaint: string | null;
    status: string;
    notes: string | null;
    createdAt: Date;
    doctor: {
      id: string;
      specialty: string;
      user: { firstName: string; lastName: string; email: string };
    };
    patient: {
      id: string;
      user: { firstName: string; lastName: string; email: string };
    };
    slot: { id: string; startAt: Date; endAt: Date; status: string };
  }) {
    return {
      id: a.id,
      specialty: a.specialty,
      chiefComplaint: a.chiefComplaint,
      status: a.status,
      notes: a.notes,
      createdAt: a.createdAt.toISOString(),
      doctor: {
        id: a.doctor.id,
        specialty: a.doctor.specialty,
        name: `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName}`.trim(),
        email: a.doctor.user.email,
      },
      patient: {
        id: a.patient.id,
        name: `${a.patient.user.firstName} ${a.patient.user.lastName}`.trim(),
        email: a.patient.user.email,
      },
      slot: {
        id: a.slot.id,
        startAt: a.slot.startAt.toISOString(),
        endAt: a.slot.endAt.toISOString(),
        status: a.slot.status,
      },
    };
  }
}
