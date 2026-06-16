// src/modules/articles/articles.schema.ts

export const updateArticleStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] },
    },
  },
} as const;

export const trendingQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      days: { type: 'integer', minimum: 1, maximum: 365, default: 7 },
      category: { type: 'string' },
    },
  },
} as const;