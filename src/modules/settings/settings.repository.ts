// src/modules/settings/settings.repository.ts
import { prisma } from '../../shared/database/prisma';
import type { SiteSettings } from '../../shared/entities';

export interface ISiteSettingsRepository {
  get(): Promise<SiteSettings | null>;
  upsert(data: Partial<SiteSettings>): Promise<SiteSettings>;
}

export class SiteSettingsRepository implements ISiteSettingsRepository {
  async get(): Promise<SiteSettings | null> {
    return prisma.siteSettings.findUnique({ where: { id: 'main' } }) as Promise<SiteSettings | null>;
  }

  async upsert(data: Partial<SiteSettings>): Promise<SiteSettings> {
    return prisma.siteSettings.upsert({
      where: { id: 'main' },
      update: data as any,
      create: { id: 'main', siteName: 'Portal Esportivo', ...(data as any) },
    }) as Promise<SiteSettings>;
  }
}
