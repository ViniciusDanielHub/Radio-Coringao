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
