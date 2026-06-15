// src/modules/users/users.service.ts
import bcrypt from 'bcryptjs';
import type { IUserRepository } from './users.repository';
import type { IRefreshTokenRepository } from '../auth/auth.repository';
import type { Role, PaginationParams } from '../../shared/entities';
import { NotFoundError, AppError } from '../../shared/errors';
import { deleteImage } from '../../shared/services/cloudinary';

export class UserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenRepo: IRefreshTokenRepository,
  ) { }

  async list(filter: { role?: Role; isActive?: boolean }, pagination: PaginationParams) {
    return this.userRepo.list(filter, pagination);
  }

  async getById(id: string) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado.');
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
      throw new AppError('Apenas o Super Admin pode cadastrar novos usuários.', 403);
    }

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await this.userRepo.create({
      ...data,
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
    // Apenas SUPER_ADMIN pode alterar role e isActive
    const updateData: any = {
      name: data.name,
      email: data.email,
      bio: data.bio,
      position: data.position,
    };

    if (requestingRole === 'SUPER_ADMIN') {
      if (data.role !== undefined) updateData.role = data.role;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
    }

    Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k]);
    const user = await this.userRepo.update(id, updateData);
    const { password: _, ...rest } = user;
    return rest;
  }

  async changeUserPassword(userId: string, newPassword: string) {
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { password: hashed });
    await this.tokenRepo.deleteByUserId(userId);
    return { message: 'Senha alterada com sucesso. Sessões anteriores encerradas.' };
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('Usuário não encontrado.');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Senha atual incorreta.', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { password: hashed });
    return { message: 'Senha alterada com sucesso.' };
  }

  async updateAvatar(userId: string, imageUrl: string) {
    const existing = await this.userRepo.findById(userId);
    if (existing?.avatar) await deleteImage(existing.avatar);

    const user = await this.userRepo.update(userId, { avatar: imageUrl });
    const { password: _, ...rest } = user;
    return rest;
  }

  async deactivate(targetId: string, requestingId: string, requestingRole: Role) {
    // Apenas SUPER_ADMIN pode desativar usuários
    if (requestingRole !== 'SUPER_ADMIN') {
      throw new AppError('Apenas o Super Admin pode desativar usuários.', 403);
    }
    if (targetId === requestingId) {
      throw new AppError('Você não pode desativar sua própria conta.', 400);
    }
    await this.userRepo.update(targetId, { isActive: false });
    return { message: 'Usuário desativado com sucesso.' };
  }
}