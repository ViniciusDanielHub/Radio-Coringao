// src/modules/categories/categories.schema.ts

export const createCategorySchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      color: { type: 'string' },
      icon: { type: 'string' },
      order: { type: 'number' },
    },
  },
} as const;

export const updateCategorySchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      color: { type: 'string' },
      icon: { type: 'string' },
      order: { type: 'number' },
      isActive: { type: 'boolean' },
    },
  },
} as const;
