/**
 * Backfill users.organizationId (home/primary org) from OrganizationMember.
 *
 * Rules:
 * - Users with exactly one membership → set that organizationId
 * - Users with multiple memberships → leave null (platform admin / multi-org);
 *   OrganizationMember remains the source of truth for access
 * - Prefer OWNER membership when choosing among several for single-owned case
 *   (only applied when membership count === 1)
 *
 * Usage (from apps/api):
 *   npx ts-node --transpile-only prisma/backfill-user-organization-id.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { organizationId: null },
    select: {
      id: true,
      email: true,
      isPlatformAdmin: true,
      memberships: {
        select: { organizationId: true, role: true, joinedAt: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  let updated = 0;
  let skippedMulti = 0;
  let skippedNone = 0;

  for (const user of users) {
    const memberships = user.memberships;
    if (memberships.length === 0) {
      skippedNone += 1;
      continue;
    }
    if (memberships.length > 1) {
      // Multi-org (e.g. platform admin across hospital/school/mahindra): keep null.
      skippedMulti += 1;
      console.log(
        `Skip multi-org ${user.email} (${memberships.length} memberships) — organizationId stays null`,
      );
      continue;
    }

    const homeOrgId = memberships[0].organizationId;
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: homeOrgId },
    });
    updated += 1;
    console.log(`Set ${user.email} → organizationId=${homeOrgId}`);
  }

  console.log(
    `\nDone. updated=${updated} skippedMulti=${skippedMulti} skippedNone=${skippedNone}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
