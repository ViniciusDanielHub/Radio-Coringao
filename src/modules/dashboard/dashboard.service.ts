// src/modules/dashboard/dashboard.service.ts
import type { IArticleRepository } from '../articles/articles.repository.interface';
import type { IUserRepository } from '../users/users.repository';
import type { ICategoryRepository } from '../categories/categories.repository';

export class DashboardService {
  constructor(
    private readonly articleRepo: IArticleRepository,
    private readonly userRepo: IUserRepository,
    private readonly categoryRepo: ICategoryRepository,
  ) { }

  async getStats() {
    const [stats, { topArticles, recentArticles }, topCategories, totalUsers] = await Promise.all([
      this.articleRepo.aggregateStats(),
      this.articleRepo.findForDashboard(),
      this.categoryRepo.listAdmin(),
      this.userRepo.count(),
    ]);

    return {
      stats: { ...stats, totalUsers },
      topArticles,
      topCategories: topCategories.slice(0, 5).map((c: any) => ({
        ...c,
        articleCount: c._count?.articles || 0,
      })),
      recentArticles,
    };
  }
}