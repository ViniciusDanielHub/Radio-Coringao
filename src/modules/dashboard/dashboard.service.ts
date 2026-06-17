// src/modules/dashboard/dashboard.service.ts
import type { IArticleAdminRepository } from '../articles/repositories/article-admin.repository.interface';
import type { IUserRepository } from '../users/users.repository';
import type { ICategoryRepository } from '../categories/categories.repository';

export class DashboardService {
  constructor(
    private readonly articleRepo: IArticleAdminRepository,
    private readonly userRepo: IUserRepository,
    private readonly categoryRepo: ICategoryRepository,
  ) { }

  async getStats() {
    const [stats, { topArticles, recentArticles }, topCategories, totalUsers] = await Promise.all([
      this.articleRepo.aggregateStats(),
      this.articleRepo.findForDashboard(),
      // Busca apenas as 5 top categorias diretamente no banco,
      // sem trazer todas para fatiar em memória
      this.categoryRepo.listTopByArticleCount(5),
      this.userRepo.count(),
    ]);

    return {
      stats: { ...stats, totalUsers },
      topArticles,
      topCategories,
      recentArticles,
    };
  }
}