// src/modules/settings/settings.schema.ts

export const updateSettingsSchema = {
  body: {
    type: 'object',
    properties: {
      siteName: { type: 'string', minLength: 1 },
      siteDescription: { type: 'string' },
      primaryColor: { type: 'string' },
      socialFacebook: { type: 'string' },
      socialInstagram: { type: 'string' },
      socialTwitter: { type: 'string' },
      socialYoutube: { type: 'string' },
      googleAnalytics: { type: 'string' },
      footerText: { type: 'string' },
    },
  },
} as const;
