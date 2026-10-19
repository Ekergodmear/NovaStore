import type { PlatformRole } from '@novastore/types';
import { vi } from 'vitest';

export interface FakeUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'active' | 'suspended' | 'deleted';
  lastSeenAt: Date | null;
  roles: PlatformRole[];
}

type Select = Record<string, boolean> | undefined;

function pick(user: FakeUser, select: Select) {
  if (!select) return withRelations(user);
  return Object.fromEntries(Object.keys(select).map((key) => [key, user[key as keyof FakeUser]]));
}

function withRelations(user: FakeUser) {
  return {
    ...user,
    roles: user.roles.map((role) => ({ role })),
    memberships: [],
  };
}

/** Prisma giả lập tối thiểu cho e2e test — chỉ các truy vấn mà Phase 1 dùng. */
export function createFakePrisma() {
  const users = new Map<string, FakeUser>();

  const fake = {
    users,
    seedUser(user: Partial<FakeUser> & { id: string }) {
      users.set(user.id, {
        email: null,
        displayName: null,
        avatarUrl: null,
        status: 'active',
        lastSeenAt: new Date(),
        roles: [],
        ...user,
      });
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const user = users.get(where.id);
        return user ? withRelations(user) : null;
      }),
      findUniqueOrThrow: vi.fn(
        async ({ where, select }: { where: { id: string }; select?: Select }) => {
          const user = users.get(where.id);
          if (!user) throw new Error('not found');
          return pick(user, select);
        },
      ),
      create: vi.fn(async ({ data }: { data: Partial<FakeUser> & { id: string } }) => {
        fake.seedUser(data);
        return withRelations(users.get(data.id)!);
      }),
      update: vi.fn(
        async ({
          where,
          data,
          select,
        }: {
          where: { id: string };
          data: Partial<FakeUser>;
          select?: Select;
        }) => {
          const user = users.get(where.id);
          if (!user) throw new Error('not found');
          Object.assign(user, data);
          return pick(user, select);
        },
      ),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    appRelease: { count: vi.fn(async () => 2) },
    appReport: { count: vi.fn(async () => 1) },
    developerAccount: { count: vi.fn(async () => 5) },
    moderationReview: {
      groupBy: vi.fn(async () => [
        { decision: 'approve', _count: { _all: 3 } },
        { decision: 'reject', _count: { _all: 1 } },
      ]),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(fake)),
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $disconnect: vi.fn(async () => undefined),
  };

  return fake;
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
