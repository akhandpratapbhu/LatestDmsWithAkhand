/**
 * One-shot: replace generic ADMIN/MEMBER IAM roles with domain roles.
 *
 * - hospital-management / school-management → project DB (connectionString)
 * - mahindra → platform DB (no project DB)
 *
 * Keeps akhandpratap121196@gmail.com on the org's Admin-type role (full IAM).
 *
 * Run from repo root:
 *   npx ts-node --transpile-only -w @dms/api prisma/seed-org-roles.ts
 * or:
 *   npm run prisma:seed:org-roles -w @dms/api
 */
import { PrismaClient } from '@prisma/client';
import { PrismaClient as ProjectClient } from '@dms/project-client';

const KEEP_EMAIL = 'akhandpratap121196@gmail.com';

type RoleDef = {
  code: string;
  name: string;
  description: string;
  /** Admin-type: full permission + menu catalog */
  isAdmin?: boolean;
  /** Permission codes; ignored when isAdmin. Missing codes are skipped. */
  permissionCodes?: string[];
};

/** Shared permission bundles (filtered against whatever exists in the org). */
const PERM = {
  workspace: [
    'menu.overview',
    'menu.profile',
    'menu.sessions',
    'menu.notifications',
    'menu.search',
    'menu.activity',
    'menu.chat',
    'menu.calls',
    'screen.notifications',
    'screen.search',
    'screen.activity',
    'screen.chat',
    'screen.calls',
    'data.users.own',
  ],
  clinicalOps: [
    'menu.overview',
    'menu.profile',
    'menu.sessions',
    'menu.notifications',
    'menu.search',
    'menu.activity',
    'menu.chat',
    'menu.calls',
    'menu.forms',
    'menu.grids',
    'screen.notifications',
    'screen.search',
    'screen.activity',
    'screen.chat',
    'screen.calls',
    'screen.forms',
    'screen.grids',
    'data.users.own',
  ],
  finance: [
    'menu.overview',
    'menu.profile',
    'menu.sessions',
    'menu.dashboards',
    'menu.grids',
    'menu.forms',
    'menu.activity',
    'menu.notifications',
    'screen.dashboards',
    'screen.grids',
    'screen.forms',
    'screen.activity',
    'data.users.own',
  ],
  leadership: [
    'menu.overview',
    'menu.organization',
    'menu.users',
    'menu.profile',
    'menu.sessions',
    'menu.chat',
    'menu.calls',
    'menu.activity',
    'menu.notifications',
    'menu.search',
    'menu.forms',
    'menu.grids',
    'menu.dashboards',
    'menu.audit',
    'screen.organization',
    'screen.users',
    'screen.chat',
    'screen.calls',
    'screen.activity',
    'screen.forms',
    'screen.grids',
    'screen.dashboards',
    'screen.audit',
    'api.users.write',
    'api.forms.write',
    'data.users.all',
    'data.users.own',
  ],
  frontDesk: [
    'menu.overview',
    'menu.users',
    'menu.profile',
    'menu.sessions',
    'menu.notifications',
    'menu.search',
    'menu.activity',
    'menu.chat',
    'menu.calls',
    'menu.forms',
    'menu.grids',
    'screen.users',
    'screen.notifications',
    'screen.search',
    'screen.activity',
    'screen.chat',
    'screen.calls',
    'screen.forms',
    'screen.grids',
    'data.users.all',
    'data.users.own',
  ],
  student: [
    'menu.overview',
    'menu.profile',
    'menu.notifications',
    'menu.search',
    'screen.notifications',
    'screen.search',
    'data.users.own',
  ],
  salesService: [
    'menu.overview',
    'menu.profile',
    'menu.sessions',
    'menu.notifications',
    'menu.search',
    'menu.activity',
    'menu.chat',
    'menu.calls',
    'menu.forms',
    'menu.grids',
    'menu.users',
    'screen.notifications',
    'screen.search',
    'screen.activity',
    'screen.chat',
    'screen.calls',
    'screen.forms',
    'screen.grids',
    'screen.users',
    'data.users.own',
  ],
  parts: [
    'menu.overview',
    'menu.profile',
    'menu.sessions',
    'menu.forms',
    'menu.grids',
    'menu.dashboards',
    'menu.activity',
    'menu.notifications',
    'screen.forms',
    'screen.grids',
    'screen.dashboards',
    'screen.activity',
    'data.users.own',
  ],
};

const HOSPITAL_ROLES: RoleDef[] = [
  {
    code: 'HOSPITAL_ADMIN',
    name: 'Hospital Admin',
    description: 'Full hospital administration and IAM',
    isAdmin: true,
  },
  {
    code: 'DOCTOR',
    name: 'Doctor',
    description: 'Clinical care — own schedule and patients',
    permissionCodes: PERM.workspace,
  },
  {
    code: 'PATIENT',
    name: 'Patient',
    description: 'Patient portal — profile and appointment booking',
    permissionCodes: PERM.student,
  },
  {
    code: 'NURSE',
    name: 'Nurse',
    description: 'Ward / nursing operations',
    permissionCodes: PERM.clinicalOps,
  },
  {
    code: 'RECEPTIONIST',
    name: 'Receptionist',
    description: 'Front desk — registration and patient intake',
    permissionCodes: PERM.frontDesk,
  },
  {
    code: 'PHARMACIST',
    name: 'Pharmacist',
    description: 'Pharmacy dispensing and inventory forms',
    permissionCodes: PERM.clinicalOps,
  },
  {
    code: 'LAB_TECHNICIAN',
    name: 'Lab Technician',
    description: 'Laboratory orders and results entry',
    permissionCodes: PERM.clinicalOps,
  },
  {
    code: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Billing, reports, and finance grids',
    permissionCodes: PERM.finance,
  },
  {
    code: 'RADIOLOGIST',
    name: 'Radiologist',
    description: 'Imaging / radiology workflows',
    permissionCodes: PERM.clinicalOps,
  },
];

const SCHOOL_ROLES: RoleDef[] = [
  {
    code: 'SCHOOL_ADMIN',
    name: 'School Admin',
    description: 'Full school administration and IAM',
    isAdmin: true,
  },
  {
    code: 'PRINCIPAL',
    name: 'Principal',
    description: 'School leadership — users, reports, audit',
    permissionCodes: PERM.leadership,
  },
  {
    code: 'TEACHER',
    name: 'Teacher',
    description: 'Teaching staff — classes, forms, collaboration',
    permissionCodes: PERM.clinicalOps,
  },
  {
    code: 'STUDENT',
    name: 'Student',
    description: 'Student portal — limited self-service',
    permissionCodes: PERM.student,
  },
  {
    code: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Fees, payroll, and finance reports',
    permissionCodes: PERM.finance,
  },
  {
    code: 'LIBRARIAN',
    name: 'Librarian',
    description: 'Library catalog and circulation forms',
    permissionCodes: PERM.clinicalOps,
  },
  {
    code: 'COUNSELOR',
    name: 'Counselor',
    description: 'Student counseling and case notes',
    permissionCodes: PERM.frontDesk,
  },
  {
    code: 'ADMISSIONS_OFFICER',
    name: 'Admissions Officer',
    description: 'Admissions intake and applicant records',
    permissionCodes: PERM.frontDesk,
  },
];

const MAHINDRA_ROLES: RoleDef[] = [
  {
    code: 'DEALER_ADMIN',
    name: 'Dealer Admin',
    description: 'Full dealer / DMS administration and IAM',
    isAdmin: true,
  },
  {
    code: 'BRANCH_MANAGER',
    name: 'Branch Manager',
    description: 'Branch leadership — users, reports, ops oversight',
    permissionCodes: PERM.leadership,
  },
  {
    code: 'SALES_EXECUTIVE',
    name: 'Sales Executive',
    description: 'Vehicle sales and CRM follow-ups',
    permissionCodes: PERM.salesService,
  },
  {
    code: 'SERVICE_ADVISOR',
    name: 'Service Advisor',
    description: 'Service booking and workshop coordination',
    permissionCodes: PERM.salesService,
  },
  {
    code: 'PARTS_MANAGER',
    name: 'Parts Manager',
    description: 'Parts inventory, counters, and stock reports',
    permissionCodes: PERM.parts,
  },
  {
    code: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Dealer finance, invoices, and reports',
    permissionCodes: PERM.finance,
  },
  {
    code: 'WORKSHOP_MANAGER',
    name: 'Workshop Manager',
    description: 'Workshop floor and technician scheduling',
    permissionCodes: PERM.leadership,
  },
  {
    code: 'CRM_EXECUTIVE',
    name: 'CRM Executive',
    description: 'Customer relationship and follow-up desk',
    permissionCodes: PERM.salesService,
  },
];

type OrgTarget = {
  slug: string;
  label: string;
  roles: RoleDef[];
};

const TARGETS: OrgTarget[] = [
  { slug: 'hospital-management', label: 'Hospital', roles: HOSPITAL_ROLES },
  { slug: 'school-management', label: 'School', roles: SCHOOL_ROLES },
  { slug: 'mahindra', label: 'Mahindra', roles: MAHINDRA_ROLES },
];

const ORG_THEMES: Record<string, { theme: string; primaryColor: string }> = {
  'hospital-management': { theme: 'hospital', primaryColor: '#0d9488' },
  'school-management': { theme: 'school', primaryColor: '#b45309' },
  mahindra: { theme: 'dms', primaryColor: '#3b82a0' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TenantDb = any;

async function clearRoles(db: TenantDb, organizationId: string) {
  // Landing pages cascade on role delete; clear first so we can rebind cleanly.
  await db.landingPage.deleteMany({ where: { organizationId } });
  await db.dashboard.updateMany({
    where: { organizationId },
    data: { roleId: null },
  });

  const existing = await db.iamRole.findMany({
    where: { organizationId },
    select: { id: true, code: true },
  });
  if (!existing.length) return;

  const roleIds = existing.map((r: { id: string }) => r.id);
  await db.memberRole.deleteMany({ where: { roleId: { in: roleIds } } });
  await db.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
  await db.roleMenu.deleteMany({ where: { roleId: { in: roleIds } } });
  await db.iamRole.deleteMany({ where: { organizationId } });
  console.log(
    `  Deleted ${existing.length} role(s): ${existing.map((r: { code: string }) => r.code).join(', ')}`,
  );
}

async function seedRoles(
  db: TenantDb,
  organizationId: string,
  roleDefs: RoleDef[],
  keepEmail: string,
) {
  const perms: Array<{ id: string; code: string }> = await db.permission.findMany({
    where: { organizationId },
  });
  const byCode = Object.fromEntries(perms.map((p) => [p.code, p.id])) as Record<string, string>;
  const menus: Array<{ id: string; path: string | null; permissionId: string | null }> =
    await db.menu.findMany({ where: { organizationId } });

  const created: Array<{ id: string; code: string; isAdmin: boolean }> = [];

  for (const def of roleDefs) {
    const role = await db.iamRole.create({
      data: {
        organizationId,
        name: def.name,
        code: def.code,
        description: def.description,
        isSystem: !!def.isAdmin,
        isActive: true,
      },
    });

    const permIds = def.isAdmin
      ? perms.map((p) => p.id)
      : (def.permissionCodes ?? []).map((c) => byCode[c]).filter(Boolean);

    if (permIds.length) {
      await db.rolePermission.createMany({
        data: permIds.map((permissionId: string) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    const menuIds = def.isAdmin
      ? menus.map((m) => m.id)
      : menus
          .filter((m) => {
            if (!m.permissionId) return false;
            return permIds.includes(m.permissionId);
          })
          .map((m) => m.id);

    if (menuIds.length) {
      await db.roleMenu.createMany({
        data: menuIds.map((menuId: string) => ({ roleId: role.id, menuId })),
        skipDuplicates: true,
      });
    }

    created.push({ id: role.id, code: role.code, isAdmin: !!def.isAdmin });
    console.log(
      `  + ${role.code} (${role.name}) — ${permIds.length} perms, ${menuIds.length} menus`,
    );
  }

  const adminRole = created.find((r) => r.isAdmin) ?? created[0];
  if (!adminRole) throw new Error('No roles created');

  // Rebind default admin dashboard + landing
  const adminDash = await db.dashboard.findFirst({
    where: { organizationId, slug: 'admin-home' },
  });
  if (adminDash) {
    await db.dashboard.update({
      where: { id: adminDash.id },
      data: { roleId: adminRole.id },
    });
    await db.landingPage.create({
      data: {
        organizationId,
        roleId: adminRole.id,
        dashboardId: adminDash.id,
        path: '/app',
        isActive: true,
      },
    });
  }

  // Attach Admin role to keep-user membership
  const user = await db.user.findFirst({
    where: { email: { equals: keepEmail, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  if (!user) {
    console.warn(`  WARN: user ${keepEmail} not found in this DB — skip memberRole`);
    return created;
  }

  const member = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  if (!member) {
    console.warn(`  WARN: ${keepEmail} is not a member of this org — skip memberRole`);
    return created;
  }

  await db.memberRole.deleteMany({ where: { memberId: member.id } });
  await db.memberRole.create({
    data: { memberId: member.id, roleId: adminRole.id },
  });
  console.log(`  Assigned ${adminRole.code} → ${user.email}`);

  return created;
}

async function listRoles(db: TenantDb, organizationId: string, label: string) {
  const roles = await db.iamRole.findMany({
    where: { organizationId },
    select: { code: true, name: true, isSystem: true },
    orderBy: { code: 'asc' },
  });
  console.log(
    `\n=== ${label} roles (${roles.length}) ===\n` +
      roles.map((r: { code: string; name: string }) => `  ${r.code} — ${r.name}`).join('\n'),
  );
}

async function main() {
  const platform = new PrismaClient();
  const projectClients: ProjectClient[] = [];

  try {
    for (const target of TARGETS) {
      const org = await platform.organization.findFirst({
        where: { slug: target.slug },
        select: {
          id: true,
          name: true,
          slug: true,
          connectionString: true,
          databaseName: true,
        },
      });
      if (!org) {
        console.warn(`\nSKIP ${target.label}: org slug "${target.slug}" not found`);
        continue;
      }

      const useProject = Boolean(org.connectionString);
      let db: TenantDb = platform;
      if (useProject) {
        const client = new ProjectClient({
          datasources: { db: { url: org.connectionString! } },
        });
        projectClients.push(client);
        db = client;
      }

      console.log(
        `\n── ${target.label} (${org.slug}) → ${useProject ? `project DB ${org.databaseName}` : 'platform DB'} ──`,
      );

      const themeCfg = ORG_THEMES[target.slug];
      if (themeCfg) {
        await platform.organization.update({
          where: { id: org.id },
          data: { theme: themeCfg.theme },
        });
        console.log(`  Organization theme → ${themeCfg.theme}`);
        if (useProject) {
          const existingLogin = await db.loginPageConfig.findUnique({
            where: { organizationId: org.id },
          });
          if (existingLogin) {
            await db.loginPageConfig.update({
              where: { organizationId: org.id },
              data: { theme: themeCfg.theme, primaryColor: themeCfg.primaryColor },
            });
          } else {
            await db.loginPageConfig.create({
              data: {
                organizationId: org.id,
                companyName: org.name,
                welcomeText: `Sign in to ${org.name}`,
                theme: themeCfg.theme,
                primaryColor: themeCfg.primaryColor,
                enablePasswordLogin: true,
              },
            });
          }
          console.log(`  LoginPageConfig theme → ${themeCfg.theme}`);
        }
      }

      await clearRoles(db, org.id);
      await seedRoles(db, org.id, target.roles, KEEP_EMAIL);
      await listRoles(db, org.id, target.label);
    }
  } finally {
    await Promise.all(projectClients.map((c) => c.$disconnect()));
    await platform.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
