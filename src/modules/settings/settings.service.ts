// src/modules/settings/settings.service.ts
import type { ISiteSettingsRepository } from './settings.repository';
import { deleteImage } from '../../shared/services/cloudinary';

export class SettingsService {
  constructor(private readonly repo: ISiteSettingsRepository) {}

  async get() { return this.repo.get(); }

  async update(data: {
    siteName?: string; siteDescription?: string; primaryColor?: string;
    socialFacebook?: string; socialInstagram?: string; socialTwitter?: string;
    socialYoutube?: string; googleAnalytics?: string; footerText?: string;
  }) {
    return this.repo.upsert(data as any);
  }

  async updateLogo(logoUrl: string) {
    const existing = await this.repo.get();
    if (existing?.logoUrl) await deleteImage(existing.logoUrl);
    return this.repo.upsert({ logoUrl });
  }
}
