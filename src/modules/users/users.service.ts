// src/modules/users/users.service.ts
import bcrypt from 'bcryptjs';
import type { IUserRepository } from './users.repository';
import type { IRefreshTokenRepository } from '../auth/auth.repository';
import type { Role, PaginationParams } from '../../shared/entities';
import { NotFoundError, AppError, ConflictError, ValidationError, ForbiddenError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';
import { deleteImage } from '../../shared/services/cloudinary';

const VALID_ROLES: Role[] = [
  'SUPER_ADMIN', 'EDITOR_CHEFE', 'EDITOR', 'JORNALISTA',
  'COLUNISTA', 'SOCIAL_MEDIA', 'MODERADOR', 'SEO_MANAGER',
];

export class UserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenRepo: IRefreshTokenRepository,
  ) { }

  async list(filter: { role?: Role; isActive?: boolean }, pagination: PaginationParams) {
    if (filter.role && !VALID_ROLES.includes(filter.role)) {
      throw new ValidationError(ErrorCode.USER_INVALID_ROLE, {
        received: filter.role,
        accepted: VALID_ROLES,
      });
    }
    return this.userRepo.list(filter, pagination);
  }

  async getById(id: string) {
    if (!id || id.trim() === '') {
      throw new ValidationError(ErrorCode.VALIDATION_REQUIRED_FIELD, { field: 'id' });
    }
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError(ErrorCode.USER_NOT_FOUND, { id });
    const { password: _, ...rest } = user;
    return rest;
  }

  async create(
    data: {
      name: string;
      email: string;
      password: string;
      role: Role;
      bio?: string;
      position?: string;
    },
    requestingRole: Role,
  ) {
    // Apenas SUPER_ADMIN pode cadastrar usuários
    if (requestingRole !== 'SUPER_ADMIN') {
      throw new ForbiddenError(ErrorCode.PERMISSION_ONLY_SUPER_ADMIN);
    }

    // Campos obrigatórios
    if (!data.name || data.name.trim() === '') {
      throw new ValidationError(ErrorCode.VALIDATION_REQUIRED_FIELD, { field: 'name' });
    }
    if (!data.email || data.email.trim() === '') {
      throw new ValidationError(ErrorCode.VALIDATION_REQUIRED_FIELD, { field: 'email' });
    }
    if (!data.password) {
      throw new ValidationError(ErrorCode.VALIDATION_REQUIRED_FIELD, { field: 'password' });
    }
    if (!data.role || !VALID_ROLES.includes(data.role)) {
      throw new ValidationError(ErrorCode.USER_INVALID_ROLE, {
        received: data.role,
        accepted: VALID_ROLES,
      });
    }

    // Senha fraca
    if (data.password.length < 6) {
      throw new ValidationError(ErrorCode.USER_WEAK_PASSWORD, { minLength: 6 });
    }

    // E-mail duplicado
    const existing = await this.userRepo.findByEmail(data.email.trim().toLowerCase());
    if (existing) {
      throw new ConflictError(ErrorCode.USER_EMAIL_TAKEN, { email: data.email });
    }

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await this.userRepo.create({
      ...data,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      password: hashed,
      isActive: true,
    });
    const { password: _, ...rest } = user;
    return rest;
  }

  async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      role?: Role;
      bio?: string;
      position?: string;
      isActive?: boolean;
    },
    requestingRole: Role,
  ) {
    const userExists = await this.userRepo.findById(id);
    if (!userExists) throw new NotFoundError(ErrorCode.USER_NOT_FOUND, { id });

    // Validação de role se fornecida
    if (data.role && !VALID_ROLES.includes(data.role)) {
      throw new ValidationError(ErrorCode.USER_INVALID_ROLE, {
        received: data.role,
        accepted: VALID_ROLES,
      });
    }

    // E-mail duplicado se estiver sendo alterado
    if (data.email && data.email.trim().toLowerCase() !== userExists.email) {
      const emailTaken = await this.userRepo.findByEmail(data.email.trim().toLowerCase());
      if (emailTaken) {
        throw new ConflictError(ErrorCode.USER_EMAIL_TAKEN, { email: data.email });
      }
    }

    const updateData: any = {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.email !== undefined && { email: data.email.trim().toLowerCase() }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.position !== undefined && { position: data.position }),
    };

    if (requestingRole === 'SUPER_ADMIN') {
      if (data.role !== undefined) updateData.role = data.role;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
    }

    const user = await this.userRepo.update(id, updateData);
    const { password: _, ...rest } = user;
    return rest;
  }

  async changeUserPassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError(ErrorCode.USER_WEAK_PASSWORD, { minLength: 6 });
    }

    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError(ErrorCode.USER_NOT_FOUND, { id: userId });
    if (!user.isActive) {
      throw new AppError(ErrorCode.AUTH_USER_INACTIVE, 400, ErrorCode.AUTH_USER_INACTIVE);
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { password: hashed });
    await this.tokenRepo.deleteByUserId(userId);
    return { message: 'Senha alterada com sucesso. Sessões anteriores encerradas.' };
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword) {
      throw new ValidationError(ErrorCode.VALIDATION_REQUIRED_FIELD, { field: 'currentPassword' });
    }
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError(ErrorCode.USER_WEAK_PASSWORD, { minLength: 6 });
    }
    if (currentPassword === newPassword) {
      throw new ValidationError(
        'A nova senha não pode ser igual à senha atual.',
        400,
        'USER_SAME_PASSWORD',
      );
    }

    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError(ErrorCode.USER_NOT_FOUND, { id: userId });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError(ErrorCode.USER_WRONG_PASSWORD, 400, ErrorCode.USER_WRONG_PASSWORD);

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { password: hashed });
    return { message: 'Senha alterada com sucesso.' };
  }

  async updateAvatar(userId: string, imageUrl: string) {
    const existing = await this.userRepo.findById(userId);
    if (!existing) throw new NotFoundError(ErrorCode.USER_NOT_FOUND, { id: userId });

    if (existing.avatar) {
      await deleteImage(existing.avatar).catch(() => {
        // não bloqueia a atualização se a deleção da imagem antiga falhar
      });
    }

    const user = await this.userRepo.update(userId, { avatar: imageUrl });
    const { password: _, ...rest } = user;
    return rest;
  }

  async deactivate(targetId: string, requestingId: string, requestingRole: Role) {
    if (requestingRole !== 'SUPER_ADMIN') {
      throw new ForbiddenError(ErrorCode.PERMISSION_ONLY_SUPER_ADMIN);
    }
    if (targetId === requestingId) {
      throw new AppError(
        ErrorCode.PERMISSION_CANNOT_SELF_DEACTIVATE,
        400,
        ErrorCode.PERMISSION_CANNOT_SELF_DEACTIVATE,
      );
    }

    const user = await this.userRepo.findById(targetId);
    if (!user) throw new NotFoundError(ErrorCode.USER_NOT_FOUND, { id: targetId });
    if (!user.isActive) {
      throw new AppError(ErrorCode.USER_ALREADY_INACTIVE, 409, ErrorCode.USER_ALREADY_INACTIVE);
    }

    await this.userRepo.update(targetId, { isActive: false });
    return { message: 'Usuário desativado com sucesso.' };
  }
}