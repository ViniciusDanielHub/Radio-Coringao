// src/modules/banners/banners.schema.ts

export const createBannerSchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 },
      linkUrl: { type: 'string' },
      order: { type: 'number' },
      startsAt: { type: 'string', format: 'date-time' },
      endsAt: { type: 'string', format: 'date-time' },
    },
  },
} as const;

export const updateBannerSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1 },
      linkUrl: { type: 'string' },
      order: { type: 'number' },
      isActive: { type: 'boolean' },
      startsAt: { type: 'string', format: 'date-time' },
      endsAt: { type: 'string', format: 'date-time' },
    },
  },
} as const;
