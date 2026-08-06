/**
 * Role-wise dashboards for Hospital + School projects.
 *
 * Upserts one primary Dashboard + LandingPage per domain role with live
 * `dataSource` widgets (resolved at runtime via /hospital|school/dashboard-stats).
 *
 * Can run standalone or be called from seed-hospital-app / seed-school-app.
 *
 *   npm run prisma:seed:role-dashboards -w @dms/api
 */
import { PrismaClient } from '@prisma/client';
import { PrismaClient as ProjectClient } from '@dms/project-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TenantDb = any;

type WidgetSeed = {
  type: 'CARD' | 'CHART' | 'TABLE' | 'TEXT';
  title: string;
  config: Record<string, unknown>;
  sortOrder: number;
  width?: number;
  height?: number;
  posX?: number;
  posY?: number;
};

async function upsertRoleDashboard(
  db: TenantDb,
  organizationId: string,
  input: {
    roleCode: string;
    slug: string;
    name: string;
    description: string;
    widgets: WidgetSeed[];
  },
) {
  const role = await db.iamRole.findFirst({
    where: { organizationId, code: input.roleCode },
  });
  if (!role) {
    console.warn(`  skip ${input.roleCode} — role not found`);
    return null;
  }

  let dashboard = await db.dashboard.findUnique({
    where: { organizationId_slug: { organizationId, slug: input.slug } },
  });

  if (dashboard) {
    await db.widget.deleteMany({ where: { dashboardId: dashboard.id } });
    dashboard = await db.dashboard.update({
      where: { id: dashboard.id },
      data: {
        name: input.name,
        description: input.description,
        roleId: role.id,
        isDefault: true,
        isLanding: true,
        isActive: true,
        widgets: {
          create: input.widgets.map((w) => ({
            type: w.type,
            title: w.title,
            config: w.config,
            sortOrder: w.sortOrder,
            posX: w.posX ?? 0,
            posY: w.posY ?? 0,
            width: w.width ?? 3,
            height: w.height ?? 2,
          })),
        },
      },
    });
  } else {
    // Prefer updating an existing role-linked dashboard if present
    const byRole = await db.dashboard.findFirst({
      where: { organizationId, roleId: role.id, isActive: true },
      orderBy: [{ isLanding: 'desc' }, { updatedAt: 'desc' }],
    });
    if (byRole) {
      await db.widget.deleteMany({ where: { dashboardId: byRole.id } });
      dashboard = await db.dashboard.update({
        where: { id: byRole.id },
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          isDefault: true,
          isLanding: true,
          isActive: true,
          widgets: {
            create: input.widgets.map((w) => ({
              type: w.type,
              title: w.title,
              config: w.config,
              sortOrder: w.sortOrder,
              posX: w.posX ?? 0,
              posY: w.posY ?? 0,
              width: w.width ?? 3,
              height: w.height ?? 2,
            })),
          },
        },
      });
    } else {
      dashboard = await db.dashboard.create({
        data: {
          organizationId,
          roleId: role.id,
          slug: input.slug,
          name: input.name,
          description: input.description,
          isDefault: true,
          isLanding: true,
          widgets: {
            create: input.widgets.map((w) => ({
              type: w.type,
              title: w.title,
              config: w.config,
              sortOrder: w.sortOrder,
              posX: w.posX ?? 0,
              posY: w.posY ?? 0,
              width: w.width ?? 3,
              height: w.height ?? 2,
            })),
          },
        },
      });
    }
  }

  await db.landingPage.upsert({
    where: {
      organizationId_roleId: { organizationId, roleId: role.id },
    },
    update: {
      dashboardId: dashboard!.id,
      path: '/app',
      isActive: true,
    },
    create: {
      organizationId,
      roleId: role.id,
      dashboardId: dashboard!.id,
      path: '/app',
      isActive: true,
    },
  });

  console.log(`  ✓ ${input.roleCode} → ${input.name} (${input.widgets.length} widgets)`);
  return dashboard;
}

/** Rename Configuration → Reports menu to Dashboard Builder when present. */
async function renameDashboardBuilderMenu(db: TenantDb, organizationId: string) {
  await db.menu.updateMany({
    where: {
      organizationId,
      path: '/app/dashboards',
      label: { in: ['Reports', 'Dashboards'] },
    },
    data: { label: 'Dashboard Builder' },
  });
}

export async function seedHospitalRoleDashboards(db: TenantDb, organizationId: string) {
  console.log('\nRole dashboards (Hospital)');
  await renameDashboardBuilderMenu(db, organizationId);

  await upsertRoleDashboard(db, organizationId, {
    roleCode: 'HOSPITAL_ADMIN',
    slug: 'hospital-admin-home',
    name: 'Hospital Admin Overview',
    description: 'Org-wide appointments, doctors, and patient volume',
    widgets: [
      {
        type: 'CARD',
        title: 'Pending appointments',
        config: {
          dataSource: 'hospital.pendingAppointments',
          metric: 'pending',
          valueLabel: '0',
        },
        sortOrder: 1,
      },
      {
        type: 'CARD',
        title: "Today's appointments",
        config: {
          dataSource: 'hospital.todayAppointments',
          metric: 'today',
          valueLabel: '0',
        },
        sortOrder: 2,
        posX: 3,
      },
      {
        type: 'CARD',
        title: 'Doctors',
        config: {
          dataSource: 'hospital.doctorsCount',
          metric: 'doctors',
          valueLabel: '0',
        },
        sortOrder: 3,
        posX: 6,
      },
      {
        type: 'CARD',
        title: 'Patients',
        config: {
          dataSource: 'hospital.patientsCount',
          metric: 'patients',
          valueLabel: '0',
        },
        sortOrder: 4,
        posX: 9,
      },
      {
        type: 'TABLE',
        title: 'Upcoming across hospital',
        config: {
          dataSource: 'hospital.upcomingAppointments',
          limit: 8,
        },
        sortOrder: 5,
        posY: 2,
        width: 8,
        height: 4,
      },
      {
        type: 'TEXT',
        title: 'Admin tip',
        config: {
          body: 'Use Dashboard Builder under Configuration to edit these widgets. Doctor and patient landings are scoped to their own schedules.',
        },
        sortOrder: 6,
        posY: 2,
        posX: 8,
        width: 4,
        height: 3,
      },
    ],
  });

  await upsertRoleDashboard(db, organizationId, {
    roleCode: 'DOCTOR',
    slug: 'doctor-home',
    name: 'My Clinical Schedule',
    description: 'Your appointments and patient load',
    widgets: [
      {
        type: 'CARD',
        title: 'Pending with me',
        config: {
          dataSource: 'hospital.pendingAppointments',
          metric: 'pending',
          valueLabel: '0',
        },
        sortOrder: 1,
      },
      {
        type: 'CARD',
        title: "Today's schedule",
        config: {
          dataSource: 'hospital.todayAppointments',
          metric: 'today',
          valueLabel: '0',
        },
        sortOrder: 2,
        posX: 3,
      },
      {
        type: 'CARD',
        title: 'My patients',
        config: {
          dataSource: 'hospital.patientsCount',
          metric: 'patients',
          valueLabel: '0',
        },
        sortOrder: 3,
        posX: 6,
      },
      {
        type: 'CARD',
        title: 'Completed',
        config: {
          dataSource: 'hospital.completedAppointments',
          metric: 'completed',
          valueLabel: '0',
        },
        sortOrder: 4,
        posX: 9,
      },
      {
        type: 'TABLE',
        title: 'Upcoming appointments',
        config: {
          dataSource: 'hospital.upcomingAppointments',
          limit: 6,
        },
        sortOrder: 5,
        posY: 2,
        width: 8,
        height: 4,
      },
      {
        type: 'TEXT',
        title: 'Quick links',
        config: {
          body: 'Open My Schedule or My Patients from the Doctor portal in the sidebar.',
        },
        sortOrder: 6,
        posY: 2,
        posX: 8,
        width: 4,
      },
    ],
  });

  await upsertRoleDashboard(db, organizationId, {
    roleCode: 'PATIENT',
    slug: 'patient-home',
    name: 'My Care Home',
    description: 'Your appointments at a glance',
    widgets: [
      {
        type: 'CARD',
        title: 'Upcoming visits',
        config: {
          dataSource: 'hospital.pendingAppointments',
          metric: 'pending',
          valueLabel: '0',
        },
        sortOrder: 1,
      },
      {
        type: 'CARD',
        title: 'Today',
        config: {
          dataSource: 'hospital.todayAppointments',
          metric: 'today',
          valueLabel: '0',
        },
        sortOrder: 2,
        posX: 3,
      },
      {
        type: 'CARD',
        title: 'All appointments',
        config: {
          dataSource: 'hospital.totalAppointments',
          metric: 'total',
          valueLabel: '0',
        },
        sortOrder: 3,
        posX: 6,
      },
      {
        type: 'TABLE',
        title: 'Next appointments',
        config: {
          dataSource: 'hospital.upcomingAppointments',
          limit: 5,
        },
        sortOrder: 4,
        posY: 2,
        width: 8,
        height: 3,
      },
      {
        type: 'TEXT',
        title: 'Need care?',
        config: {
          body: 'Book a new visit from Book Appointment in the Patient portal.',
        },
        sortOrder: 5,
        posY: 2,
        posX: 8,
        width: 4,
      },
    ],
  });
}

export async function seedSchoolRoleDashboards(db: TenantDb, organizationId: string) {
  console.log('\nRole dashboards (School)');
  await renameDashboardBuilderMenu(db, organizationId);

  const adminWidgets: WidgetSeed[] = [
    {
      type: 'CARD',
      title: 'Students',
      config: { dataSource: 'school.students', valueLabel: '0' },
      sortOrder: 1,
    },
    {
      type: 'CARD',
      title: 'Teachers',
      config: { dataSource: 'school.teachers', valueLabel: '0' },
      sortOrder: 2,
      posX: 3,
    },
    {
      type: 'CARD',
      title: 'Classes',
      config: { dataSource: 'school.classes', valueLabel: '0' },
      sortOrder: 3,
      posX: 6,
    },
    {
      type: 'CARD',
      title: 'Fee collections',
      config: { dataSource: 'school.feeCollections', valueLabel: '0' },
      sortOrder: 4,
      posX: 9,
    },
    {
      type: 'CARD',
      title: 'Attendance records',
      config: { dataSource: 'school.attendanceRecords', valueLabel: '0' },
      sortOrder: 5,
      posY: 2,
    },
    {
      type: 'CARD',
      title: 'Exam results',
      config: { dataSource: 'school.examResults', valueLabel: '0' },
      sortOrder: 6,
      posY: 2,
      posX: 3,
    },
    {
      type: 'CARD',
      title: 'All submissions',
      config: { dataSource: 'school.submissionsTotal', valueLabel: '0' },
      sortOrder: 7,
      posY: 2,
      posX: 6,
    },
    {
      type: 'TEXT',
      title: 'School tip',
      config: {
        body: 'Counts come from published Dynamic Forms. Edit widgets in Dashboard Builder under Configuration.',
      },
      sortOrder: 8,
      posY: 2,
      posX: 9,
      width: 3,
    },
  ];

  await upsertRoleDashboard(db, organizationId, {
    roleCode: 'SCHOOL_ADMIN',
    slug: 'school-admin-home',
    name: 'School Admin Overview',
    description: 'School-wide form counts and academic volume',
    widgets: adminWidgets,
  });

  await upsertRoleDashboard(db, organizationId, {
    roleCode: 'PRINCIPAL',
    slug: 'principal-home',
    name: 'Principal Overview',
    description: 'School-wide snapshot for leadership',
    widgets: [
      ...adminWidgets.slice(0, 6),
      {
        type: 'TEXT',
        title: 'Leadership',
        config: {
          body: 'Review Attendance, Examinations, and Fees modules from the sidebar for operational detail.',
        },
        sortOrder: 7,
        posY: 2,
        posX: 6,
        width: 6,
      },
    ],
  });

  await upsertRoleDashboard(db, organizationId, {
    roleCode: 'TEACHER',
    slug: 'teacher-home',
    name: 'Teacher Workspace',
    description: 'Classes, attendance, and results at a glance',
    widgets: [
      {
        type: 'CARD',
        title: 'Classes / sections',
        config: { dataSource: 'school.classes', valueLabel: '0' },
        sortOrder: 1,
      },
      {
        type: 'CARD',
        title: 'Students enrolled',
        config: { dataSource: 'school.students', valueLabel: '0' },
        sortOrder: 2,
        posX: 3,
      },
      {
        type: 'CARD',
        title: 'Attendance entries',
        config: { dataSource: 'school.attendanceRecords', valueLabel: '0' },
        sortOrder: 3,
        posX: 6,
      },
      {
        type: 'CARD',
        title: 'Exam results entered',
        config: { dataSource: 'school.examResults', valueLabel: '0' },
        sortOrder: 4,
        posX: 9,
      },
      {
        type: 'TEXT',
        title: 'Teaching tip',
        config: {
          body: 'Phase-1 counts are school-wide form totals. Use Attendance and Exam Result forms for your classes.',
        },
        sortOrder: 5,
        posY: 2,
        width: 8,
      },
    ],
  });

  await upsertRoleDashboard(db, organizationId, {
    roleCode: 'STUDENT',
    slug: 'student-home',
    name: 'Student Home',
    description: 'Fees, results, and attendance summary',
    widgets: [
      {
        type: 'CARD',
        title: 'Fee collections (school)',
        config: { dataSource: 'school.feeCollections', valueLabel: '0' },
        sortOrder: 1,
      },
      {
        type: 'CARD',
        title: 'Exam results (school)',
        config: { dataSource: 'school.examResults', valueLabel: '0' },
        sortOrder: 2,
        posX: 3,
      },
      {
        type: 'CARD',
        title: 'Attendance records',
        config: { dataSource: 'school.attendanceRecords', valueLabel: '0' },
        sortOrder: 3,
        posX: 6,
      },
      {
        type: 'TEXT',
        title: 'Your summary',
        config: {
          body: 'Phase-1 student widgets show school form totals. Personal fee/result portals come in a later phase.',
        },
        sortOrder: 4,
        posY: 2,
        width: 8,
      },
    ],
  });
}

async function resolveProjectOrg(
  platform: PrismaClient,
  slug: string,
  nameHint: string,
) {
  const org =
    (await platform.organization.findFirst({
      where: { slug },
    })) ??
    (await platform.organization.findFirst({
      where: {
        OR: [
          { slug: { contains: nameHint, mode: 'insensitive' } },
          { name: { contains: nameHint, mode: 'insensitive' } },
        ],
      },
    }));
  return org;
}

async function main() {
  const platform = new PrismaClient();
  let hospitalDb: ProjectClient | null = null;
  let schoolDb: ProjectClient | null = null;

  try {
    const hospitalOrg = await resolveProjectOrg(platform, 'hospital-management', 'hospital');
    if (hospitalOrg?.connectionString) {
      hospitalDb = new ProjectClient({
        datasources: { db: { url: hospitalOrg.connectionString } },
      });
      await seedHospitalRoleDashboards(hospitalDb, hospitalOrg.id);
    } else {
      console.warn('Hospital org not found — skip hospital dashboards');
    }

    const schoolOrg = await resolveProjectOrg(platform, 'school-management', 'school');
    if (schoolOrg?.connectionString) {
      schoolDb = new ProjectClient({
        datasources: { db: { url: schoolOrg.connectionString } },
      });
      await seedSchoolRoleDashboards(schoolDb, schoolOrg.id);
    } else {
      console.warn('School org not found — skip school dashboards');
    }

    console.log('\nDone.');
  } finally {
    await hospitalDb?.$disconnect();
    await schoolDb?.$disconnect();
    await platform.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
