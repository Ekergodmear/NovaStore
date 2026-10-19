import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { slug: 'productivity', nameVi: 'Năng suất', nameEn: 'Productivity', icon: 'briefcase' },
  { slug: 'education', nameVi: 'Giáo dục', nameEn: 'Education', icon: 'graduation-cap' },
  { slug: 'tools', nameVi: 'Công cụ', nameEn: 'Tools', icon: 'wrench' },
  { slug: 'communication', nameVi: 'Liên lạc', nameEn: 'Communication', icon: 'message-circle' },
  { slug: 'entertainment', nameVi: 'Giải trí', nameEn: 'Entertainment', icon: 'clapperboard' },
  { slug: 'games', nameVi: 'Trò chơi', nameEn: 'Games', icon: 'gamepad-2' },
  { slug: 'finance', nameVi: 'Tài chính', nameEn: 'Finance', icon: 'wallet' },
  {
    slug: 'health-fitness',
    nameVi: 'Sức khỏe & Thể hình',
    nameEn: 'Health & Fitness',
    icon: 'heart-pulse',
  },
  { slug: 'photography', nameVi: 'Nhiếp ảnh', nameEn: 'Photography', icon: 'camera' },
  { slug: 'travel', nameVi: 'Du lịch', nameEn: 'Travel', icon: 'plane' },
  { slug: 'shopping', nameVi: 'Mua sắm', nameEn: 'Shopping', icon: 'shopping-bag' },
  { slug: 'lifestyle', nameVi: 'Phong cách sống', nameEn: 'Lifestyle', icon: 'sparkles' },
];

async function main() {
  for (const [index, category] of categories.entries()) {
    await prisma.appCategory.upsert({
      where: { slug: category.slug },
      update: {
        nameVi: category.nameVi,
        nameEn: category.nameEn,
        icon: category.icon,
        sortOrder: index,
      },
      create: { ...category, sortOrder: index },
    });
  }
  console.log(`Seeded ${categories.length} categories`);

  const adminId = process.env.SEED_ADMIN_USER_ID?.trim();
  if (adminId) {
    const email = process.env.SEED_ADMIN_EMAIL?.trim() || null;
    await prisma.user.upsert({
      where: { id: adminId },
      update: {},
      create: { id: adminId, email },
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: adminId, role: 'admin' } },
      update: {},
      create: { userId: adminId, role: 'admin' },
    });
    await prisma.auditLog.create({
      data: {
        action: 'user.role.grant',
        targetType: 'user',
        targetId: adminId,
        after: { role: 'admin' },
        actorRole: 'system',
      },
    });
    console.log(`Granted admin to ${adminId}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
