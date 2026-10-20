import type { DeveloperAccount } from '@novastore/database';
import {
  DEVELOPER_STATUS_TRANSITIONS,
  type AdminDeveloperResponse,
  type DeveloperAccountResponse,
  type DeveloperMemberRole,
  type DeveloperStatusResponse,
  type PublicDeveloperProfile,
} from '@novastore/types';
import { developerCapabilities } from './developer-access.service';

/** Các cột đọc từ developer_accounts cho mọi phản hồi; không select dư. */
export const developerAccountSelect = {
  id: true,
  slug: true,
  displayName: true,
  contactEmail: true,
  website: true,
  status: true,
  statusReason: true,
  statusChangedAt: true,
  verificationStatus: true,
  agreementVersion: true,
  agreementAcceptedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type DeveloperAccountRow = Pick<DeveloperAccount, keyof typeof developerAccountSelect>;

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toDeveloperAccountResponse(
  row: DeveloperAccountRow,
  memberRole: DeveloperMemberRole,
): DeveloperAccountResponse {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    contactEmail: row.contactEmail,
    website: row.website,
    status: row.status,
    statusReason: row.statusReason,
    statusChangedAt: iso(row.statusChangedAt),
    verificationStatus: row.verificationStatus,
    memberRole,
    agreementVersion: row.agreementVersion,
    agreementAcceptedAt: row.agreementAcceptedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    capabilities: developerCapabilities(row.status, memberRole),
  };
}

export function toDeveloperStatusResponse(
  row: DeveloperAccountRow,
  memberRole: DeveloperMemberRole,
): DeveloperStatusResponse {
  return {
    developerAccountId: row.id,
    status: row.status,
    statusReason: row.statusReason,
    statusChangedAt: iso(row.statusChangedAt),
    capabilities: developerCapabilities(row.status, memberRole),
  };
}

export function toPublicDeveloperProfile(row: DeveloperAccountRow): PublicDeveloperProfile {
  return {
    slug: row.slug,
    displayName: row.displayName,
    website: row.website,
    verified: row.verificationStatus === 'verified',
  };
}

export function toAdminDeveloperResponse(row: DeveloperAccountRow): AdminDeveloperResponse {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    contactEmail: row.contactEmail,
    website: row.website,
    status: row.status,
    statusReason: row.statusReason,
    statusChangedAt: iso(row.statusChangedAt),
    verificationStatus: row.verificationStatus,
    createdAt: row.createdAt.toISOString(),
    allowedTransitions: [...DEVELOPER_STATUS_TRANSITIONS[row.status]],
  };
}
