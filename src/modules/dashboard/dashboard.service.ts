// src/modules/dashboard/dashboard.service.ts
//
// ADIÇÕES nesta versão:
//   - articlesPerMonth: artigos publicados/em revisão, mês a mês
//   - readsPerMonth: leituras totais e leitores únicos, mês a mês
//   - mostReadArticle: matéria mais lida (geral, sem filtro de período)
//     e mostReadArticleThisMonth (mesmo critério, restrito ao mês atual)
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      stats,
      { topArticles, recentArticles },
      topCategories,
      totalUsers,
      articlesPerMonth,
      readsPerMonth,
      mostReadArticle,
      mostReadArticleThisMonth,
    ] = await Promise.all([
      this.articleRepo.aggregateStats(),
      this.articleRepo.findForDashboard(),
      // Busca apenas as 5 top categorias diretamente no banco,
      // sem trazer todas para fatiar em memória
      this.categoryRepo.listTopByArticleCount(5),
      this.userRepo.count(),
      this.articleRepo.getArticlesPerMonth(12),
      this.articleRepo.getReadsPerMonth(12),
      this.articleRepo.getMostReadArticle(),
      this.articleRepo.getMostReadArticle({ from: startOfMonth }),
    ]);

    return {
      stats: { ...stats, totalUsers },
      topArticles,
      topCategories,
      recentArticles,
      articlesPerMonth,
      readsPerMonth,
      mostReadArticle,
      mostReadArticleThisMonth,
    };
  }
}