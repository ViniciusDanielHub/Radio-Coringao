// src/modules/users/users.schema.ts

const rolesEnum = [
  'SUPER_ADMIN',
  'EDITOR_CHEFE',
  'EDITOR',
  'JORNALISTA',
  'COLUNISTA',
  'SOCIAL_MEDIA',
  'MODERADOR',
  'SEO_MANAGER',
] as const;

export const createUserSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'password', 'role'],
    properties: {
      name: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      role: { type: 'string', enum: rolesEnum },
      bio: { type: 'string' },
      position: { type: 'string' },
    },
  },
} as const;

export const updateUserSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: rolesEnum },
      bio: { type: 'string' },
      position: { type: 'string' },
      isActive: { type: 'boolean' },
    },
  },
} as const;

export const changeOwnPasswordSchema = {
  body: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', minLength: 1 },
      newPassword: { type: 'string', minLength: 6 },
    },
  },
} as const;

export const changeUserPasswordSchema = {
  body: {
    type: 'object',
    required: ['newPassword'],
    properties: {
      newPassword: { type: 'string', minLength: 6 },
    },
  },
} as const;