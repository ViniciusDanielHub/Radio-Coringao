// src/modules/tags/tags.schema.ts

export const listTagsSchema = {
  querystring: {
    type: 'object',
    properties: {
      q: { type: 'string' },
    },
  },
} as const;
