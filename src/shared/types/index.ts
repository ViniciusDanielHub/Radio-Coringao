// src/shared/types/index.ts
import type { Role } from '../entities';

export interface JwtPayload {
  id: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

// Augment Fastify request type
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
    uploadedFile?: {
      path: string;
      mimetype: string;
      fieldname: string;
    };
  }
}
