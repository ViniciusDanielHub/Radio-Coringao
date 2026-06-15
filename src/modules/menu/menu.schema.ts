// src/modules/menu/menu.schema.ts

export const createMenuItemSchema = {
  body: {
    type: 'object',
    required: ['label', 'url'],
    properties: {
      label: { type: 'string', minLength: 1 },
      url: { type: 'string', minLength: 1 },
      target: { type: 'string', enum: ['_self', '_blank'] },
      order: { type: 'number' },
      parentId: { type: 'string' },
    },
  },
} as const;

export const updateMenuItemSchema = {
  body: {
    type: 'object',
    properties: {
      label: { type: 'string', minLength: 1 },
      url: { type: 'string', minLength: 1 },
      target: { type: 'string', enum: ['_self', '_blank'] },
      order: { type: 'number' },
      isActive: { type: 'boolean' },
      parentId: { type: 'string' },
    },
  },
} as const;
