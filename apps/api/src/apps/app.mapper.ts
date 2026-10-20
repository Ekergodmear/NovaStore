import type { App, AppCategory } from '@novastore/database';
import {
  APP_EDITABLE_STATUSES,
  isAppDeveloperTransitionAllowed,
  type AdminCategoryResponse,
  type AppCategoryResponse,
  type AppStatus,
  type DeveloperAppResponse,
  type DeveloperAppSummary,
} from '@novastore/types';
import type { DeveloperContext } from '../developers/developer-access.service';
import { developerCapabilities } from '../developers/developer-access.service';

export const developerAppSelect = {
  id: true,
  slug: true,
  packageName: true,
  pendingPackageName: true,
  title: true,
  shortDescription: true,
  fullDescription: true,
  supportEmail: true,
  supportUrl: true,
  privacyPolicyUrl: true,
  contentRating: true,
  containsAds: true,
  defaultLocale: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, slug: true, nameVi: true, nameEn: true } },
} as const;

export type DeveloperAppRow = Pick<App, Exclude<keyof typeof developerAppSelect, 'category'>> & {
  category: Pick<AppCategory, 'id' | 'slug' | 'nameVi' | 'nameEn'>;
};

export function toDeveloperAppResponse(
  row: DeveloperAppRow,
  developer: DeveloperContext,
): DeveloperAppResponse {
  const canPublish = developerCapabilities(developer.status, developer.memberRole).canPublish;
  const status = row.status as AppStatus;
  return {
    id: row.id,
    slug: row.slug,
    packageName: row.packageName ?? row.pendingPackageName,
    packageNameReleased: row.packageName === null && row.pendingPackageName !== null,
    title: row.title,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    category: row.category,
    supportEmail: row.supportEmail,
    supportUrl: row.supportUrl,
    privacyPolicyUrl: row.privacyPolicyUrl,
    contentRating: row.contentRating,
    containsAds: row.containsAds,
    defaultLocale: row.defaultLocale,
    status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    capabilities: {
      canEdit: canPublish && (APP_EDITABLE_STATUSES as readonly AppStatus[]).includes(status),
      canArchive: canPublish && isAppDeveloperTransitionAllowed(status, 'archived'),
    },
  };
}

export function toDeveloperAppSummary(row: DeveloperAppRow): DeveloperAppSummary {
  return {
    id: row.id,
    slug: row.slug,
    packageName: row.packageName ?? row.pendingPackageName,
    title: row.title,
    status: row.status,
    categorySlug: row.category.slug,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const categorySelect = {
  id: true,
  slug: true,
  nameVi: true,
  nameEn: true,
  icon: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CategoryRow = Pick<AppCategory, keyof typeof categorySelect>;

export function toCategoryResponse(row: CategoryRow): AppCategoryResponse {
  return {
    id: row.id,
    slug: row.slug,
    nameVi: row.nameVi,
    nameEn: row.nameEn,
    icon: row.icon,
    sortOrder: row.sortOrder,
  };
}

export function toAdminCategoryResponse(row: CategoryRow, appCount: number): AdminCategoryResponse {
  return {
    ...toCategoryResponse(row),
    isActive: row.isActive,
    appCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
