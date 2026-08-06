/**
 * Hospital patient ↔ doctor appointment demo seed.
 *
 * Idempotent: upserts users, roles, profiles, slots, and portal menus.
 *
 * Prerequisites:
 *   - hospital-management org with project DB
 *   - npm run prisma:seed:org-roles -w @dms/api  (or PATIENT role is created here)
 *   - npm run prisma:seed:hospital -w @dms/api   (forms/menus; optional but recommended)
 *   - Project schema pushed (doctor/patient/appointment tables)
 *
 * Run:
 *   npm run prisma:seed:hospital-appointments -w @dms/api
 *
 * Demo password for all accounts: Password1!
 */
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as ProjectClient } from '@dms/project-client';

const SLUG = 'hospital-management';
const PASSWORD = 'Password1!';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TenantDb = any;

type DemoUser = {
  email: string;
  firstName: string;
  lastName: string;
  roleCode: 'PATIENT' | 'DOCTOR' | 'NURSE';
  doctor?: { specialty: string; department: string; bio: string };
  patient?: { gender: string; bloodGroup: string; address: string };
};

const DEMO_USERS: DemoUser[] = [
  {
    email: 'patient1@hospital.local',
    firstName: 'Priya',
    lastName: 'Sharma',
    roleCode: 'PATIENT',
    patient: {
      gender: 'Female',
      bloodGroup: 'B+',
      address: '12 Lake View, Bengaluru',
    },
  },
  {
    email: 'patient2@hospital.local',
    firstName: 'Rahul',
    lastName: 'Mehta',
    roleCode: 'PATIENT',
    patient: {
      gender: 'Male',
      bloodGroup: 'O+',
      address: '88 MG Road, Bengaluru',
    },
  },
  {
    email: 'dr.heart@hospital.local',
    firstName: 'Ananya',
    lastName: 'Iyer',
    roleCode: 'DOCTOR',
    doctor: {
      specialty: 'Cardiology',
      department: 'Cardiology',
      bio: 'Consultant cardiologist — heart and chest clinics.',
    },
  },
  {
    email: 'dr.ortho@hospital.local',
    firstName: 'Vikram',
    lastName: 'Singh',
    roleCode: 'DOCTOR',
    doctor: {
      specialty: 'Orthopedics',
      department: 'Orthopedics',
      bio: 'Orthopedic surgeon — joints, fractures, sports injuries.',
    },
  },
  {
    email: 'dr.general@hospital.local',
    firstName: 'Neha',
    lastName: 'Kapoor',
    roleCode: 'DOCTOR',
    doctor: {
      specialty: 'General Medicine',
      department: 'General Medicine',
      bio: 'General physician — fever, wellness, primary care.',
    },
  },
  {
    email: 'nurse1@hospital.local',
    firstName: 'Sita',
    lastName: 'Nair',
    roleCode: 'NURSE',
  },
];

type PortalMenuDef = {
  label: string;
  path: string;
  icon: string;
  sortOrder: number;
  roles: string[];
  resource: string;
};

const PATIENT_MENUS: PortalMenuDef[] = [
  {
    label: 'Book Appointment',
    path: '/app/hospital/book',
    icon: 'activity',
    sortOrder: 1,
    roles: ['PATIENT'],
    resource: 'book_appointment',
  },
  {
    label: 'My Appointments',
    path: '/app/hospital/my-appointments',
    icon: 'table',
    sortOrder: 2,
    roles: ['PATIENT'],
    resource: 'my_appointments',
  },
  {
    label: 'My Profile',
    path: '/app/hospital/profile',
    icon: 'user',
    sortOrder: 3,
    roles: ['PATIENT'],
    resource: 'patient_profile',
  },
];

const DOCTOR_MENUS: PortalMenuDef[] = [
  {
    label: 'My Schedule',
    path: '/app/hospital/schedule',
    icon: 'activity',
    sortOrder: 1,
    roles: ['DOCTOR'],
    resource: 'doctor_schedule',
  },
  {
    label: 'My Patients',
    path: '/app/hospital/patients',
    icon: 'users',
    sortOrder: 2,
    roles: ['DOCTOR'],
    resource: 'doctor_patients',
  },
];

async function ensureIamRole(
  db: TenantDb,
  organizationId: string,
  code: string,
  name: string,
  description: string,
) {
  const existing = await db.iamRole.findFirst({ where: { organizationId, code } });
  if (existing) {
    return db.iamRole.update({
      where: { id: existing.id },
      data: { name, description, isActive: true },
    });
  }
  return db.iamRole.create({
    data: {
      organizationId,
      code,
      name,
      description,
      isSystem: false,
      isActive: true,
    },
  });
}

async function ensurePermission(
  db: TenantDb,
  organizationId: string,
  code: string,
  name: string,
  type: 'MENU' | 'SCREEN' | 'API' | 'DATA',
  resource?: string,
  action?: string,
) {
  const existing = await db.permission.findFirst({ where: { organizationId, code } });
  if (existing) return existing;
  return db.permission.create({
    data: {
      organizationId,
      code,
      name,
      type,
      resource: resource ?? null,
      action: action ?? null,
    },
  });
}

async function ensureGroup(
  db: TenantDb,
  organizationId: string,
  code: string,
  name: string,
  sortOrder: number,
) {
  const existing = await db.menuGroup.findFirst({ where: { organizationId, code } });
  if (existing) {
    return db.menuGroup.update({
      where: { id: existing.id },
      data: { name, sortOrder, isActive: true },
    });
  }
  return db.menuGroup.create({
    data: { organizationId, name, code, sortOrder, isActive: true },
  });
}

async function ensurePortalMenu(
  db: TenantDb,
  organizationId: string,
  groupId: string,
  def: PortalMenuDef,
) {
  const menuPerm = await ensurePermission(
    db,
    organizationId,
    `menu.${def.resource}`,
    `${def.label} menu`,
    'MENU',
    def.resource,
    'access',
  );
  await ensurePermission(
    db,
    organizationId,
    `${def.resource}.view`,
    `${def.resource} view`,
    'SCREEN',
    def.resource,
    'view',
  );

  let menu = await db.menu.findFirst({
    where: { organizationId, path: def.path, parentId: null },
  });
  if (!menu) {
    menu = await db.menu.findFirst({
      where: { organizationId, label: def.label, groupId },
    });
  }

  if (!menu) {
    menu = await db.menu.create({
      data: {
        organizationId,
        groupId,
        label: def.label,
        path: def.path,
        icon: def.icon,
        formId: null,
        permissionId: menuPerm.id,
        sortOrder: def.sortOrder,
        isActive: true,
      },
    });
    console.log(`  + menu ${def.label} → ${def.path}`);
  } else {
    menu = await db.menu.update({
      where: { id: menu.id },
      data: {
        groupId,
        label: def.label,
        path: def.path,
        icon: def.icon,
        formId: null,
        permissionId: menuPerm.id,
        sortOrder: def.sortOrder,
        isActive: true,
      },
    });
    console.log(`  ~ menu ${def.label}`);
  }

  for (const roleCode of def.roles) {
    const role = await db.iamRole.findFirst({ where: { organizationId, code: roleCode } });
    if (!role) {
      console.warn(`  WARN: role ${roleCode} missing for menu ${def.label}`);
      continue;
    }
    await db.roleMenu.createMany({
      data: [{ roleId: role.id, menuId: menu.id }],
      skipDuplicates: true,
    });
    const perms = await db.permission.findMany({
      where: {
        organizationId,
        code: { in: [`menu.${def.resource}`, `${def.resource}.view`] },
      },
    });
    if (perms.length) {
      await db.rolePermission.createMany({
        data: perms.map((p: { id: string }) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  return menu;
}

async function grantOverviewMenus(db: TenantDb, organizationId: string, roleCodes: string[]) {
  const overviewPaths = ['/app', '/app/dashboard', null];
  const overviewMenus = await db.menu.findMany({
    where: {
      organizationId,
      OR: [
        { path: { in: ['/app', '/app/dashboard'] } },
        { label: { equals: 'Dashboard', mode: 'insensitive' } },
        { label: { equals: 'Overview', mode: 'insensitive' } },
      ],
      isActive: true,
    },
  });

  for (const roleCode of roleCodes) {
    const role = await db.iamRole.findFirst({ where: { organizationId, code: roleCode } });
    if (!role) continue;
    for (const menu of overviewMenus) {
      await db.roleMenu.createMany({
        data: [{ roleId: role.id, menuId: menu.id }],
        skipDuplicates: true,
      });
    }
    // Also grant common workspace menu.profile / menu.overview if present
    const workspacePerms = await db.permission.findMany({
      where: {
        organizationId,
        code: {
          in: [
            'menu.overview',
            'menu.profile',
            'menu.sessions',
            'menu.notifications',
            'data.users.own',
            'screen.notifications',
          ],
        },
      },
    });
    if (workspacePerms.length) {
      await db.rolePermission.createMany({
        data: workspacePerms.map((p: { id: string }) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  void overviewPaths;
}

/** Remove DOCTOR/PATIENT from clinical/admin form menus so portals stay focused. */
async function stripClinicalMenusFromPortalRoles(db: TenantDb, organizationId: string) {
  const portalRoles = await db.iamRole.findMany({
    where: { organizationId, code: { in: ['DOCTOR', 'PATIENT'] } },
    select: { id: true, code: true },
  });
  if (!portalRoles.length) return;

  const clinicalGroups = await db.menuGroup.findMany({
    where: {
      organizationId,
      code: {
        in: [
          'FRONT_DESK',
          'CLINICAL',
          'NURSING',
          'LABORATORY',
          'PHARMACY',
          'BILLING',
          'MASTERS',
          'ADMINISTRATION',
          'ACCESS',
          'CONFIG',
          'GOVERNANCE',
        ],
      },
    },
    select: { id: true },
  });
  const groupIds = clinicalGroups.map((g: { id: string }) => g.id);
  if (!groupIds.length) return;

  const clinicalMenus = await db.menu.findMany({
    where: { organizationId, groupId: { in: groupIds } },
    select: { id: true },
  });
  const menuIds = clinicalMenus.map((m: { id: string }) => m.id);
  if (!menuIds.length) return;

  for (const role of portalRoles) {
    const removed = await db.roleMenu.deleteMany({
      where: { roleId: role.id, menuId: { in: menuIds } },
    });
    if (removed.count) {
      console.log(`  Stripped ${removed.count} clinical menu(s) from ${role.code}`);
    }
  }
}

async function upsertPlatformUser(
  platform: PrismaClient,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    organizationId: string;
  },
) {
  return platform.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: 'ACTIVE',
      isActive: true,
      isPlatformAdmin: false,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      organizationId: input.organizationId,
    },
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: 'ACTIVE',
      isActive: true,
      isPlatformAdmin: false,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      organizationId: input.organizationId,
    },
  });
}

async function syncProjectUser(
  db: TenantDb,
  organizationId: string,
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    phone: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;
    isActive: boolean;
    status: string;
  },
) {
  // Prefer same UUID as platform. Clear email collisions from older seed rows.
  const conflict = await db.user.findFirst({
    where: { email: user.email, NOT: { id: user.id } },
  });
  if (conflict) {
    await db.memberRole.deleteMany({
      where: { member: { userId: conflict.id } },
    });
    await db.organizationMember.deleteMany({ where: { userId: conflict.id } });
    await db.doctorProfile.deleteMany({ where: { userId: conflict.id } });
    await db.patientProfile.deleteMany({ where: { userId: conflict.id } });
    await db.user.delete({ where: { id: conflict.id } });
  }

  await db.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      platformUserId: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      organizationId,
      status: user.status,
      isActive: user.isActive,
    },
    update: {
      platformUserId: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      organizationId,
      status: user.status,
      isActive: user.isActive,
    },
  });
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function atHour(day: Date, hour: number, minute = 0): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function seedSlotsForDoctor(db: TenantDb, doctorId: string) {
  // Wipe future AVAILABLE/BOOKED seed slots without appointments, then recreate AVAILABLEs.
  // Keep slots that already have appointments.
  const existing = await db.appointmentSlot.findMany({
    where: { doctorId },
    include: { appointment: true },
  });

  const deletable = existing
    .filter((s: { appointment: unknown; status: string }) => !s.appointment && s.status !== 'BOOKED')
    .map((s: { id: string }) => s.id);

  if (deletable.length) {
    await db.appointmentSlot.deleteMany({ where: { id: { in: deletable } } });
  }

  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);
  const windows = [
    [9, 0],
    [10, 0],
    [11, 0],
    [14, 0],
    [15, 0],
    [16, 0],
  ] as const;

  let created = 0;
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const day = addDays(startDay, dayOffset);
    // Skip Sundays
    if (day.getDay() === 0) continue;
    for (const [h, m] of windows) {
      const startAt = atHour(day, h, m);
      const endAt = new Date(startAt.getTime() + 45 * 60 * 1000);
      const clash = await db.appointmentSlot.findFirst({
        where: { doctorId, startAt },
      });
      if (clash) continue;
      await db.appointmentSlot.create({
        data: { doctorId, startAt, endAt, status: 'AVAILABLE' },
      });
      created += 1;
    }
  }
  return created;
}

async function main() {
  const platform = new PrismaClient();
  let project: ProjectClient | null = null;

  try {
    const org = await platform.organization.findFirst({
      where: { slug: SLUG },
      select: {
        id: true,
        name: true,
        slug: true,
        databaseName: true,
        connectionString: true,
      },
    });
    if (!org?.connectionString) {
      throw new Error(
        `Org "${SLUG}" missing or has no connectionString. Create/provision Hospital Management first.`,
      );
    }

    project = new ProjectClient({
      datasources: { db: { url: org.connectionString } },
    });
    const db: TenantDb = project;
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    console.log(`\n── Hospital appointments seed (${org.slug}) ──\n`);

    console.log('1) Ensure PATIENT / DOCTOR / NURSE roles');
    await ensureIamRole(db, org.id, 'PATIENT', 'Patient', 'Patient portal — book and manage appointments');
    await ensureIamRole(db, org.id, 'DOCTOR', 'Doctor', 'Doctor portal — schedule and patients');
    await ensureIamRole(db, org.id, 'NURSE', 'Nurse', 'Ward / nursing operations');

    console.log('\n2) Demo users (platform + project)');
    for (const def of DEMO_USERS) {
      const platformUser = await upsertPlatformUser(platform, {
        email: def.email,
        firstName: def.firstName,
        lastName: def.lastName,
        passwordHash,
        organizationId: org.id,
      });

      await platform.organizationMember.upsert({
        where: {
          organizationId_userId: { organizationId: org.id, userId: platformUser.id },
        },
        update: { role: 'MEMBER', status: 'ACTIVE' },
        create: {
          organizationId: org.id,
          userId: platformUser.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      await syncProjectUser(db, org.id, {
        id: platformUser.id,
        email: platformUser.email,
        firstName: platformUser.firstName,
        lastName: platformUser.lastName,
        passwordHash: platformUser.passwordHash,
        phone: platformUser.phone,
        avatarUrl: platformUser.avatarUrl,
        emailVerified: platformUser.emailVerified,
        emailVerifiedAt: platformUser.emailVerifiedAt,
        isActive: platformUser.isActive,
        status: platformUser.status,
      });

      const member = await db.organizationMember.upsert({
        where: {
          organizationId_userId: { organizationId: org.id, userId: platformUser.id },
        },
        update: { role: 'MEMBER', status: 'ACTIVE' },
        create: {
          organizationId: org.id,
          userId: platformUser.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      const role = await db.iamRole.findFirst({
        where: { organizationId: org.id, code: def.roleCode },
      });
      if (!role) throw new Error(`Missing IAM role ${def.roleCode}`);

      await db.memberRole.deleteMany({ where: { memberId: member.id } });
      await db.memberRole.create({
        data: { memberId: member.id, roleId: role.id },
      });

      if (def.doctor) {
        await db.doctorProfile.upsert({
          where: { userId: platformUser.id },
          update: {
            specialty: def.doctor.specialty,
            department: def.doctor.department,
            bio: def.doctor.bio,
            active: true,
          },
          create: {
            userId: platformUser.id,
            specialty: def.doctor.specialty,
            department: def.doctor.department,
            bio: def.doctor.bio,
            active: true,
          },
        });
      }

      if (def.patient) {
        await db.patientProfile.upsert({
          where: { userId: platformUser.id },
          update: {
            gender: def.patient.gender,
            bloodGroup: def.patient.bloodGroup,
            address: def.patient.address,
          },
          create: {
            userId: platformUser.id,
            gender: def.patient.gender,
            bloodGroup: def.patient.bloodGroup,
            address: def.patient.address,
          },
        });
      }

      console.log(`  ${def.email} → ${def.roleCode}`);
    }

    console.log('\n3) Appointment slots (next ~14 weekdays)');
    const doctors = await db.doctorProfile.findMany({ where: { active: true } });
    for (const doc of doctors) {
      const n = await seedSlotsForDoctor(db, doc.id);
      console.log(`  ${doc.specialty}: +${n} available slots`);
    }

    console.log('\n4) Portal menus + RoleMenu');
    const patientGroup = await ensureGroup(db, org.id, 'PATIENT_PORTAL', 'Patient Portal', 1.5);
    const doctorGroup = await ensureGroup(db, org.id, 'DOCTOR_PORTAL', 'Doctor Portal', 1.6);

    // Prisma Int sortOrder — use integers
    await db.menuGroup.update({
      where: { id: patientGroup.id },
      data: { sortOrder: 2 },
    });
    await db.menuGroup.update({
      where: { id: doctorGroup.id },
      data: { sortOrder: 3 },
    });
    // Shift clinical groups if needed — hospital seed uses 2+; portals at 2/3 is fine alongside Front Desk

    for (const def of PATIENT_MENUS) {
      await ensurePortalMenu(db, org.id, patientGroup.id, def);
    }
    for (const def of DOCTOR_MENUS) {
      await ensurePortalMenu(db, org.id, doctorGroup.id, def);
    }

    await grantOverviewMenus(db, org.id, ['PATIENT', 'DOCTOR']);
    await stripClinicalMenusFromPortalRoles(db, org.id);

    // Hospital admin keeps everything
    const admin = await db.iamRole.findFirst({
      where: { organizationId: org.id, code: 'HOSPITAL_ADMIN' },
    });
    if (admin) {
      const allMenus = await db.menu.findMany({
        where: { organizationId: org.id },
        select: { id: true },
      });
      const allPerms = await db.permission.findMany({
        where: { organizationId: org.id },
        select: { id: true },
      });
      await db.roleMenu.createMany({
        data: allMenus.map((m: { id: string }) => ({ roleId: admin.id, menuId: m.id })),
        skipDuplicates: true,
      });
      await db.rolePermission.createMany({
        data: allPerms.map((p: { id: string }) => ({
          roleId: admin.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }

    console.log('\n── Done ──');
    console.log(`Login: /${SLUG}/login`);
    console.log(`Password (all demo users): ${PASSWORD}`);
    console.log('Accounts:');
    for (const u of DEMO_USERS) {
      console.log(`  ${u.email}  (${u.roleCode})`);
    }
    console.log('\nDemo flow:');
    console.log('  1. Login patient1@hospital.local → Book Appointment → Heart → cardiologist → slot → book');
    console.log('  2. Login dr.heart@hospital.local → My Schedule → see appointment');
    console.log('  3. Login patient1 → My Appointments → Cancel');
  } finally {
    if (project) await project.$disconnect();
    await platform.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
