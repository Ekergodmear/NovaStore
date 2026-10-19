/**
 * Gán hoặc gỡ vai trò nền tảng cho user đã đăng nhập ít nhất một lần.
 *   pnpm db:grant-role <email> <moderator|admin> [--revoke]
 */
import { PlatformRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [email, role, flag] = process.argv.slice(2);
  if (!email || !role || !(role in PlatformRole) || role === 'user') {
    console.error('Usage: grant-role <email> <moderator|admin> [--revoke]');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(
      `Không tìm thấy user ${email}. User cần đăng nhập vào một console ít nhất một lần.`,
    );
    process.exitCode = 1;
    return;
  }

  const platformRole = role as PlatformRole;
  if (flag === '--revoke') {
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: user.id, role: platformRole } }),
      prisma.auditLog.create({
        data: {
          action: 'user.role.revoke',
          targetType: 'user',
          targetId: user.id,
          before: { role },
          actorRole: 'system',
        },
      }),
    ]);
    console.log(`Đã gỡ ${role} khỏi ${email}`);
  } else {
    await prisma.$transaction([
      prisma.userRole.upsert({
        where: { userId_role: { userId: user.id, role: platformRole } },
        update: {},
        create: { userId: user.id, role: platformRole },
      }),
      prisma.auditLog.create({
        data: {
          action: 'user.role.grant',
          targetType: 'user',
          targetId: user.id,
          after: { role },
          actorRole: 'system',
        },
      }),
    ]);
    console.log(`Đã gán ${role} cho ${email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
