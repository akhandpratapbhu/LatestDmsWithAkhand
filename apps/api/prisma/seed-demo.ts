/**
 * Demo seed: role-wise dashboards + users for local UI testing.
 * Run: npm run db:seed
 *
 * Logins (password for all: Password1)
 * - admin@dms.local   → Admin dashboard (full sidebar)
 * - manager@dms.local → Manager dashboard
 * - member@dms.local  → Member dashboard (limited menus)
 */
import 'reflect-metadata';
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { IamSeedService } from '../src/modules/iam/iam-seed.service';

const prisma = new PrismaClient();
const PASSWORD = 'Password1';

async function upsertUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      status: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await upsertUser({
    email: 'admin@dms.local',
    firstName: 'Ada',
    lastName: 'Admin',
    passwordHash,
  });
  const manager = await upsertUser({
    email: 'manager@dms.local',
    firstName: 'Mia',
    lastName: 'Manager',
    passwordHash,
  });
  const member = await upsertUser({
    email: 'member@dms.local',
    firstName: 'Sam',
    lastName: 'Member',
    passwordHash,
  });

  let org = await prisma.organization.findFirst({ where: { slug: 'demo-company' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Demo Company',
        slug: 'demo-company',
        code: 'DEMO',
        ownerId: admin.id,
        passwordPolicy: { create: {} },
      },
    });
  }

  const ensureMember = async (
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER',
  ) => {
    return prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: org!.id, userId },
      },
      update: { role, status: 'ACTIVE' },
      create: {
        organizationId: org!.id,
        userId,
        role,
        status: 'ACTIVE',
      },
    });
  };

  const adminMember = await ensureMember(admin.id, 'OWNER');
  const managerMember = await ensureMember(manager.id, 'MEMBER');
  const memberMember = await ensureMember(member.id, 'MEMBER');

  // Branches for org page
  await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'HQ' } },
    update: { name: 'Head Office' },
    create: {
      organizationId: org.id,
      name: 'Head Office',
      code: 'HQ',
      city: 'Mumbai',
      country: 'IN',
    },
  });
  await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'BLR' } },
    update: { name: 'Bangalore Branch' },
    create: {
      organizationId: org.id,
      name: 'Bangalore Branch',
      code: 'BLR',
      city: 'Bengaluru',
      country: 'IN',
    },
  });

  // Trigger / reuse IAM seed via direct ensure of roles if missing
  let adminRole = await prisma.iamRole.findFirst({
    where: { organizationId: org.id, code: 'ADMIN' },
  });
  let memberRole = await prisma.iamRole.findFirst({
    where: { organizationId: org.id, code: 'MEMBER' },
  });

  if (!adminRole || !memberRole) {
    const seed = new IamSeedService(prisma);
    await seed.seedOrganization(org.id, adminMember.id);
    adminRole = await prisma.iamRole.findFirstOrThrow({
      where: { organizationId: org.id, code: 'ADMIN' },
    });
    memberRole = await prisma.iamRole.findFirstOrThrow({
      where: { organizationId: org.id, code: 'MEMBER' },
    });
  }

  // Ensure Phase 6–7 permissions + menus exist on already-seeded orgs
  const extraPerms: Array<{
    code: string;
    name: string;
    type: 'MENU' | 'SCREEN' | 'API' | 'DATA';
    resource?: string;
    action?: string;
  }> = [
    { code: 'menu.forms', name: 'Forms menu', type: 'MENU' },
    { code: 'menu.grids', name: 'Grids menu', type: 'MENU' },
    { code: 'menu.notifications', name: 'Notifications menu', type: 'MENU' },
    { code: 'menu.search', name: 'Search menu', type: 'MENU' },
    { code: 'menu.activity', name: 'Activity menu', type: 'MENU' },
    { code: 'menu.audit', name: 'Audit menu', type: 'MENU' },
    { code: 'menu.masters', name: 'Masters menu', type: 'MENU' },
    { code: 'menu.chat', name: 'Chat menu', type: 'MENU' },
    { code: 'menu.calls', name: 'Calls menu', type: 'MENU' },
    { code: 'screen.forms', name: 'Form builder', type: 'SCREEN', resource: 'forms', action: 'manage' },
    { code: 'screen.grids', name: 'Grid builder', type: 'SCREEN', resource: 'grids', action: 'manage' },
    { code: 'screen.notifications', name: 'Notifications screen', type: 'SCREEN', resource: 'notifications', action: 'manage' },
    { code: 'screen.search', name: 'Search screen', type: 'SCREEN', resource: 'search', action: 'use' },
    { code: 'screen.activity', name: 'Activity screen', type: 'SCREEN', resource: 'activity', action: 'view' },
    { code: 'screen.audit', name: 'Audit screen', type: 'SCREEN', resource: 'audit', action: 'view' },
    { code: 'screen.masters', name: 'Masters screen', type: 'SCREEN', resource: 'masters', action: 'manage' },
    { code: 'screen.chat', name: 'Chat screen', type: 'SCREEN', resource: 'chat', action: 'use' },
    { code: 'screen.calls', name: 'Calls screen', type: 'SCREEN', resource: 'calls', action: 'use' },
    { code: 'api.forms.write', name: 'Manage forms API', type: 'API', resource: 'forms', action: 'write' },
    { code: 'api.grids.write', name: 'Manage grids API', type: 'API', resource: 'grids', action: 'write' },
    { code: 'api.notifications.write', name: 'Send notifications API', type: 'API', resource: 'notifications', action: 'write' },
    { code: 'api.masters.write', name: 'Manage masters API', type: 'API', resource: 'masters', action: 'write' },
  ];
  for (const p of extraPerms) {
    await prisma.permission.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: p.code },
      },
      update: { name: p.name, type: p.type, resource: p.resource, action: p.action },
      create: {
        organizationId: org.id,
        code: p.code,
        name: p.name,
        type: p.type,
        resource: p.resource,
        action: p.action,
      },
    });
  }

  let adminGroup = await prisma.menuGroup.findFirst({
    where: { organizationId: org.id, code: 'ADMIN' },
  });
  if (!adminGroup) {
    adminGroup = await prisma.menuGroup.create({
      data: { organizationId: org.id, name: 'Administration', code: 'ADMIN', sortOrder: 2 },
    });
  }
  const extraMenus = [
    { label: 'Search', path: '/app/search', icon: 'search', permissionCode: 'menu.search', sortOrder: 2, group: 'MAIN' },
    { label: 'Chat', path: '/app/chat', icon: 'chat', permissionCode: 'menu.chat', sortOrder: 3, group: 'MAIN' },
    { label: 'Calls', path: '/app/calls', icon: 'phone', permissionCode: 'menu.calls', sortOrder: 4, group: 'MAIN' },
    { label: 'Notifications', path: '/app/notifications', icon: 'bell', permissionCode: 'menu.notifications', sortOrder: 5, group: 'MAIN' },
    { label: 'Activity', path: '/app/activity', icon: 'activity', permissionCode: 'menu.activity', sortOrder: 6, group: 'MAIN' },
    { label: 'Masters', path: '/app/masters', icon: 'database', permissionCode: 'menu.masters', sortOrder: 3, group: 'ADMIN' },
    { label: 'Forms', path: '/app/forms', icon: 'form', permissionCode: 'menu.forms', sortOrder: 6, group: 'ADMIN' },
    { label: 'Grids', path: '/app/grids', icon: 'table', permissionCode: 'menu.grids', sortOrder: 7, group: 'ADMIN' },
    { label: 'Audit', path: '/app/audit', icon: 'audit', permissionCode: 'menu.audit', sortOrder: 8, group: 'ADMIN' },
  ];
  const allPermsForMenus = await prisma.permission.findMany({ where: { organizationId: org.id } });
  const permByCode = Object.fromEntries(allPermsForMenus.map((p) => [p.code, p.id]));
  let mainGroup = await prisma.menuGroup.findFirst({
    where: { organizationId: org.id, code: 'MAIN' },
  });
  if (!mainGroup) {
    mainGroup = await prisma.menuGroup.create({
      data: { organizationId: org.id, name: 'Main', code: 'MAIN', sortOrder: 1 },
    });
  }
  for (const m of extraMenus) {
    const existingMenu = await prisma.menu.findFirst({
      where: { organizationId: org.id, path: m.path },
    });
    if (!existingMenu) {
      await prisma.menu.create({
        data: {
          organizationId: org.id,
          groupId: m.group === 'MAIN' ? mainGroup.id : adminGroup.id,
          label: m.label,
          path: m.path,
          icon: m.icon,
          sortOrder: m.sortOrder,
          permissionId: permByCode[m.permissionCode],
        },
      });
    }
  }

  // Grant all permissions + menus to ADMIN role; extend MEMBER menus
  {
    const permsNow = await prisma.permission.findMany({ where: { organizationId: org.id } });
    const menusNow = await prisma.menu.findMany({ where: { organizationId: org.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
    await prisma.rolePermission.createMany({
      data: permsNow.map((p) => ({ roleId: adminRole!.id, permissionId: p.id })),
    });
    await prisma.roleMenu.deleteMany({ where: { roleId: adminRole.id } });
    await prisma.roleMenu.createMany({
      data: menusNow.map((m) => ({ roleId: adminRole!.id, menuId: m.id })),
    });

    const memberPermCodes = [
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
    ];
    await prisma.rolePermission.deleteMany({ where: { roleId: memberRole.id } });
    await prisma.rolePermission.createMany({
      data: memberPermCodes
        .filter((c) => permsNow.some((p) => p.code === c))
        .map((c) => ({
          roleId: memberRole!.id,
          permissionId: permsNow.find((p) => p.code === c)!.id,
        })),
    });
    const memberPaths = [
      '/app',
      '/app/profile',
      '/app/sessions',
      '/app/notifications',
      '/app/search',
      '/app/activity',
      '/app/chat',
      '/app/calls',
    ];
    await prisma.roleMenu.deleteMany({ where: { roleId: memberRole.id } });
    await prisma.roleMenu.createMany({
      data: menusNow
        .filter((m) => memberPaths.includes(m.path ?? ''))
        .map((m) => ({ roleId: memberRole!.id, menuId: m.id })),
    });
  }

  // Manager role + permissions (subset between admin and member)
  let managerRole = await prisma.iamRole.findFirst({
    where: { organizationId: org.id, code: 'MANAGER' },
  });
  if (!managerRole) {
    managerRole = await prisma.iamRole.create({
      data: {
        organizationId: org.id,
        name: 'Manager',
        code: 'MANAGER',
        description: 'Team lead — users + org view, no IAM builder',
        isSystem: false,
      },
    });
  }

  const perms = await prisma.permission.findMany({ where: { organizationId: org.id } });
  const byCode = Object.fromEntries(perms.map((p) => [p.code, p.id]));
  const managerPermCodes = [
    'menu.overview',
    'menu.organization',
    'menu.users',
    'menu.profile',
    'menu.sessions',
    'menu.chat',
    'menu.calls',
    'menu.masters',
    'screen.organization',
    'screen.users',
    'screen.chat',
    'screen.calls',
    'screen.masters',
    'api.users.write',
    'api.masters.write',
    'data.users.all',
    'data.users.own',
  ];

  await prisma.rolePermission.deleteMany({ where: { roleId: managerRole.id } });
  await prisma.rolePermission.createMany({
    data: managerPermCodes
      .filter((c) => byCode[c])
      .map((c) => ({ roleId: managerRole!.id, permissionId: byCode[c] })),
  });

  const menus = await prisma.menu.findMany({ where: { organizationId: org.id } });
  const managerMenuPaths = [
    '/app',
    '/app/organization',
    '/app/users',
    '/app/masters',
    '/app/chat',
    '/app/calls',
    '/app/profile',
    '/app/sessions',
  ];
  await prisma.roleMenu.deleteMany({ where: { roleId: managerRole.id } });
  await prisma.roleMenu.createMany({
    data: menus
      .filter((m) => managerMenuPaths.includes(m.path ?? ''))
      .map((m) => ({ roleId: managerRole!.id, menuId: m.id })),
  });

  // Assign IAM roles to members
  await prisma.memberRole.deleteMany({
    where: { memberId: { in: [adminMember.id, managerMember.id, memberMember.id] } },
  });
  await prisma.memberRole.createMany({
    data: [
      { memberId: adminMember.id, roleId: adminRole.id },
      { memberId: managerMember.id, roleId: managerRole.id },
      { memberId: memberMember.id, roleId: memberRole.id },
    ],
  });

  // Distinct dashboards per role
  const upsertDashboard = async (input: {
    slug: string;
    name: string;
    description: string;
    roleId: string;
    widgets: Prisma.WidgetCreateWithoutDashboardInput[];
  }) => {
    const existing = await prisma.dashboard.findUnique({
      where: { organizationId_slug: { organizationId: org!.id, slug: input.slug } },
    });
    if (existing) {
      await prisma.widget.deleteMany({ where: { dashboardId: existing.id } });
      return prisma.dashboard.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description,
          roleId: input.roleId,
          isDefault: true,
          isLanding: true,
          isActive: true,
          widgets: { create: input.widgets },
        },
      });
    }
    return prisma.dashboard.create({
      data: {
        organizationId: org!.id,
        slug: input.slug,
        name: input.name,
        description: input.description,
        roleId: input.roleId,
        isDefault: true,
        isLanding: true,
        widgets: { create: input.widgets },
      },
    });
  };

  const adminDash = await upsertDashboard({
    slug: 'admin-home',
    name: 'Admin Command Center',
    description: 'Full org metrics for administrators',
    roleId: adminRole.id,
    widgets: [
      {
        type: 'CARD',
        title: 'Total Users',
        config: { metric: 'users', valueLabel: '3 demo users' },
        sortOrder: 1,
        width: 3,
        height: 2,
      },
      {
        type: 'CARD',
        title: 'Branches',
        config: { metric: 'branches', valueLabel: '2 branches' },
        sortOrder: 2,
        posX: 3,
        width: 3,
        height: 2,
      },
      {
        type: 'CARD',
        title: 'Access',
        config: { metric: 'iam', valueLabel: 'Full IAM + Dashboards' },
        sortOrder: 3,
        posX: 6,
        width: 3,
        height: 2,
      },
      {
        type: 'CHART',
        title: 'Weekly logins (Admin view)',
        config: {
          chartType: 'bar',
          series: [
            { label: 'Mon', value: 20 },
            { label: 'Tue', value: 28 },
            { label: 'Wed', value: 18 },
            { label: 'Thu', value: 32 },
            { label: 'Fri', value: 25 },
          ],
        },
        sortOrder: 4,
        posY: 2,
        width: 8,
        height: 3,
      },
      {
        type: 'TEXT',
        title: 'Admin tip',
        config: {
          body: 'You can open IAM and Dashboards from the sidebar to manage roles and widgets.',
        },
        sortOrder: 5,
        posY: 5,
        width: 8,
        height: 2,
      },
    ],
  });

  const managerDash = await upsertDashboard({
    slug: 'manager-home',
    name: 'Manager Workspace',
    description: 'Team-focused dashboard for managers',
    roleId: managerRole.id,
    widgets: [
      {
        type: 'CARD',
        title: 'My Team',
        config: { metric: 'team', valueLabel: '12 people (demo)' },
        sortOrder: 1,
        width: 4,
        height: 2,
      },
      {
        type: 'CARD',
        title: 'Open Tasks',
        config: { metric: 'tasks', valueLabel: '5 pending reviews' },
        sortOrder: 2,
        posX: 4,
        width: 4,
        height: 2,
      },
      {
        type: 'CHART',
        title: 'Team throughput',
        config: {
          chartType: 'bar',
          series: [
            { label: 'Week 1', value: 8 },
            { label: 'Week 2', value: 14 },
            { label: 'Week 3', value: 11 },
            { label: 'Week 4', value: 17 },
          ],
        },
        sortOrder: 3,
        posY: 2,
        width: 8,
        height: 3,
      },
      {
        type: 'TEXT',
        title: 'Manager tip',
        config: {
          body: 'You can manage Users and Organization, but not IAM/Dashboard builder.',
        },
        sortOrder: 4,
        posY: 5,
        width: 8,
        height: 2,
      },
    ],
  });

  const memberDash = await upsertDashboard({
    slug: 'member-home',
    name: 'Member Home',
    description: 'Simple landing for members',
    roleId: memberRole.id,
    widgets: [
      {
        type: 'CARD',
        title: 'Welcome',
        config: { metric: 'welcome', valueLabel: 'Hello Sam 👋' },
        sortOrder: 1,
        width: 4,
        height: 2,
      },
      {
        type: 'CARD',
        title: 'Documents',
        config: { metric: 'docs', valueLabel: '3 shared with you' },
        sortOrder: 2,
        posX: 4,
        width: 4,
        height: 2,
      },
      {
        type: 'TEXT',
        title: 'Getting started',
        config: {
          body: 'Update your profile and check Sessions. Admin menus are hidden for your role.',
        },
        sortOrder: 3,
        posY: 2,
        width: 8,
        height: 2,
      },
    ],
  });

  // Landing pages per role
  for (const row of [
    { roleId: adminRole.id, dashboardId: adminDash.id },
    { roleId: managerRole.id, dashboardId: managerDash.id },
    { roleId: memberRole.id, dashboardId: memberDash.id },
  ]) {
    await prisma.landingPage.upsert({
      where: {
        organizationId_roleId: { organizationId: org.id, roleId: row.roleId },
      },
      update: { dashboardId: row.dashboardId, path: '/app', isActive: true },
      create: {
        organizationId: org.id,
        roleId: row.roleId,
        dashboardId: row.dashboardId,
        path: '/app',
        isActive: true,
      },
    });
  }

  // Sample dynamic form
  let sampleForm = await prisma.dynamicForm.findUnique({
    where: { organizationId_code: { organizationId: org.id, code: 'EMP_ONBOARD' } },
  });
  if (!sampleForm) {
    sampleForm = await prisma.dynamicForm.create({
      data: {
        organizationId: org.id,
        name: 'Employee Onboarding',
        code: 'EMP_ONBOARD',
        description: 'Sample Phase 6 form',
        layoutType: 'TABS',
        status: 'PUBLISHED',
        tabs: {
          create: [
            { name: 'Personal', code: 'PERSONAL', sortOrder: 1 },
            { name: 'Role', code: 'ROLE', sortOrder: 2 },
          ],
        },
      },
      include: { tabs: true },
    });
    const personalTab = sampleForm.tabs.find((t) => t.code === 'PERSONAL')!;
    const roleTab = sampleForm.tabs.find((t) => t.code === 'ROLE')!;
    const personalSection = await prisma.formSection.create({
      data: {
        formId: sampleForm.id,
        tabId: personalTab.id,
        name: 'Basics',
        code: 'BASICS',
        columns: 2,
        sortOrder: 1,
      },
    });
    const roleSection = await prisma.formSection.create({
      data: {
        formId: sampleForm.id,
        tabId: roleTab.id,
        name: 'Assignment',
        code: 'ASSIGN',
        columns: 2,
        sortOrder: 1,
      },
    });
    const fullName = await prisma.formControl.create({
      data: {
        sectionId: personalSection.id,
        fieldKey: 'fullName',
        label: 'Full name',
        controlType: 'TEXT',
        required: true,
        sortOrder: 1,
      },
    });
    await prisma.formValidation.create({
      data: {
        controlId: fullName.id,
        ruleType: 'REQUIRED',
        message: 'Full name is required',
      },
    });
    await prisma.formControl.create({
      data: {
        sectionId: personalSection.id,
        fieldKey: 'email',
        label: 'Work email',
        controlType: 'EMAIL',
        required: true,
        sortOrder: 2,
        validations: {
          create: [
            { ruleType: 'REQUIRED', message: 'Email is required' },
            { ruleType: 'EMAIL', message: 'Enter a valid email' },
          ],
        },
      },
    });
    await prisma.formControl.create({
      data: {
        sectionId: roleSection.id,
        fieldKey: 'department',
        label: 'Department',
        controlType: 'SELECT',
        required: true,
        options: [
          { label: 'Engineering', value: 'ENG' },
          { label: 'Operations', value: 'OPS' },
        ],
        sortOrder: 1,
        validations: {
          create: [{ ruleType: 'REQUIRED', message: 'Department is required' }],
        },
      },
    });
  }

  // Sample dynamic grid
  let sampleGrid = await prisma.dynamicGrid.findUnique({
    where: { organizationId_code: { organizationId: org.id, code: 'CONTACTS' } },
  });
  if (!sampleGrid) {
    sampleGrid = await prisma.dynamicGrid.create({
      data: {
        organizationId: org.id,
        name: 'Contacts Directory',
        code: 'CONTACTS',
        description: 'Sample Phase 7 grid',
        pageSize: 5,
        columns: {
          create: [
            { fieldKey: 'name', title: 'Name', dataType: 'TEXT', sortOrder: 1 },
            { fieldKey: 'status', title: 'Status', dataType: 'TEXT', sortOrder: 2 },
            { fieldKey: 'score', title: 'Score', dataType: 'NUMBER', sortOrder: 3 },
          ],
        },
        rows: {
          create: [
            { data: { name: 'Alice', status: 'Active', score: 90 } },
            { data: { name: 'Bob', status: 'Inactive', score: 70 } },
            { data: { name: 'Cara', status: 'Active', score: 85 } },
            { data: { name: 'Dan', status: 'Active', score: 60 } },
            { data: { name: 'Eve', status: 'Inactive', score: 75 } },
            { data: { name: 'Finn', status: 'Active', score: 95 } },
          ],
        },
      },
    });
  }

  // Sample business masters (chat/call contacts)
  await prisma.customer.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'CUST001' } },
    update: { name: 'Acme Motors', email: 'buyer@acme.example', phone: '+91-90000-11111', linkedUserId: member.id },
    create: {
      organizationId: org.id,
      code: 'CUST001',
      name: 'Acme Motors',
      email: 'buyer@acme.example',
      phone: '+91-90000-11111',
      company: 'Acme Motors Pvt Ltd',
      city: 'Pune',
      linkedUserId: member.id,
    },
  });
  await prisma.dealer.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'DLR001' } },
    update: { name: 'West Zone Dealer', email: 'dealer@west.example', linkedUserId: manager.id },
    create: {
      organizationId: org.id,
      code: 'DLR001',
      name: 'West Zone Dealer',
      email: 'dealer@west.example',
      phone: '+91-90000-22222',
      region: 'West',
      linkedUserId: manager.id,
    },
  });
  await prisma.employee.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'EMP001' } },
    update: { firstName: 'Ada', lastName: 'Admin', linkedUserId: admin.id },
    create: {
      organizationId: org.id,
      code: 'EMP001',
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'admin@dms.local',
      designation: 'Administrator',
      department: 'IT',
      linkedUserId: admin.id,
    },
  });
  await prisma.vendor.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'VEN001' } },
    update: { name: 'Parts Supply Co' },
    create: {
      organizationId: org.id,
      code: 'VEN001',
      name: 'Parts Supply Co',
      email: 'sales@parts.example',
      contactPerson: 'Ravi',
    },
  });
  await prisma.vehicle.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'VEH001' } },
    update: { name: 'Demo SUV' },
    create: {
      organizationId: org.id,
      code: 'VEH001',
      name: 'Demo SUV',
      make: 'Tata',
      model: 'Harrier',
      year: 2024,
      registrationNo: 'MH12AB1234',
    },
  });
  await prisma.part.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'PRT001' } },
    update: { name: 'Oil Filter' },
    create: {
      organizationId: org.id,
      code: 'PRT001',
      name: 'Oil Filter',
      sku: 'OF-100',
      unit: 'pcs',
      price: 450,
      category: 'Service',
    },
  });
  await prisma.product.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'PRD001' } },
    update: { name: 'Extended Warranty' },
    create: {
      organizationId: org.id,
      code: 'PRD001',
      name: 'Extended Warranty',
      sku: 'EW-1Y',
      unit: 'plan',
      price: 12000,
      category: 'Service Product',
    },
  });
  await prisma.warehouse.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'WH001' } },
    update: { name: 'Central Warehouse' },
    create: {
      organizationId: org.id,
      code: 'WH001',
      name: 'Central Warehouse',
      city: 'Mumbai',
      state: 'MH',
      country: 'IN',
    },
  });

  console.log('Demo seed complete.\n');
  console.log('Organization: Demo Company');
  console.log('Password for all: Password1\n');
  console.log('admin@dms.local   → Admin Command Center (full menus)');
  console.log('manager@dms.local → Manager Workspace (org + users)');
  console.log('member@dms.local  → Member Home (limited menus)');
  console.log('Sample form: EMP_ONBOARD · Sample grid: CONTACTS');
  console.log('Masters seeded: CUST001, DLR001, EMP001 (+ vendor/vehicle/part/product/warehouse)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
