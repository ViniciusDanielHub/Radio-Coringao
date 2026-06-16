// src/shared/container.ts
//
// COMPOSITION ROOT — único lugar do projeto que faz "new".
// Todas as rotas importam daqui; nunca instanciam diretamente.
//
// Regra: este arquivo pode importar de qualquer camada.
//        Nenhuma outra camada importa deste arquivo.

import { jwtService } from './services/jwt';

// ─── Infraestrutura ──────────────────────────────────────────
import { PrismaArticlePublicRepository }  from '../modules/articles/infrastructure/prisma-article-public.repository';
import { PrismaArticleAdminRepository }   from '../modules/articles/infrastructure/prisma-article-admin.repository';
import { UserRepository }                 from '../modules/users/users.repository';
import { RefreshTokenRepository }         from '../modules/auth/auth.repository';
import { CategoryRepository }             from '../modules/categories/categories.repository';
import { TagRepository }                  from '../modules/tags/tags.repository';
import { BannerRepository }               from '../modules/banners/banners.repository';
import { MenuRepository }                 from '../modules/menu/menu.repository';
import { SiteSettingsRepository }         from '../modules/settings/settings.repository';

// ─── Use Cases — Articles public ─────────────────────────────
import { ListArticlesUseCase }            from '../modules/articles/use-cases/list-articles.use-case';
import { GetArticleBySlugUseCase }        from '../modules/articles/use-cases/get-article-by-slug.use-case';
import { SearchArticlesUseCase }          from '../modules/articles/use-cases/search-articles.use-case';

// ─── Use Cases — Articles admin ──────────────────────────────
import { ListAdminArticlesUseCase }       from '../modules/articles/use-cases/list-admin-articles.use-case';
import { GetAdminArticleByIdUseCase }     from '../modules/articles/use-cases/get-admin-article-by-id.use-case';
import { SearchAdminArticlesUseCase }     from '../modules/articles/use-cases/search-admin-articles.use-case';
import { CreateArticleUseCase }           from '../modules/articles/use-cases/create-article.use-case';
import { UpdateArticleUseCase }           from '../modules/articles/use-cases/update-article.use-case';
import { UpdateArticleStatusUseCase }     from '../modules/articles/use-cases/update-article-status.use-case';
import { DeleteArticleUseCase }           from '../modules/articles/use-cases/delete-article.use-case';
import { AddArticleImageUseCase }         from '../modules/articles/use-cases/add-article-image.use-case';
import { DeleteArticleImageUseCase }      from '../modules/articles/use-cases/delete-article-image.use-case';

// ─── Services (módulos que ainda não quebramos em use-cases) ─
import { AuthService }                    from '../modules/auth/auth.service';
import { UserService }                    from '../modules/users/users.service';
import { CategoryService }                from '../modules/categories/categories.service';
import { TagService }                     from '../modules/tags/tags.service';
import { BannerService }                  from '../modules/banners/banners.service';
import { MenuService }                    from '../modules/menu/menu.service';
import { SettingsService }                from '../modules/settings/settings.service';
import { DashboardService }               from '../modules/dashboard/dashboard.service';

// ─── Controllers ─────────────────────────────────────────────
import { ArticlePublicController }        from '../modules/articles/public/articles-public.controller';
import { ArticleAdminController }         from '../modules/articles/admin/articles-admin.controller';
import { AuthController }                 from '../modules/auth/auth.controller';
import { UserController }                 from '../modules/users/users.controller';
import { CategoryController }             from '../modules/categories/categories.controller';
import { TagController }                  from '../modules/tags/tags.controller';
import { BannerController }               from '../modules/banners/banners.controller';
import { MenuController }                 from '../modules/menu/menu.controller';
import { SettingsController }             from '../modules/settings/settings.controller';
import { DashboardController }            from '../modules/dashboard/dashboard.controller';
import { LiveScoresController }           from '../modules/live-scores/live-scores.controller';
import { LiveScoresService }              from '../modules/live-scores/live-scores.service';

// ═══════════════════════════════════════════════════════════════
// Repositórios (singleton — uma instância por processo)
// ═══════════════════════════════════════════════════════════════
const articlePublicRepo  = new PrismaArticlePublicRepository();
const articleAdminRepo   = new PrismaArticleAdminRepository();
const userRepo           = new UserRepository();
const refreshTokenRepo   = new RefreshTokenRepository();
const categoryRepo       = new CategoryRepository();
const tagRepo            = new TagRepository();
const bannerRepo         = new BannerRepository();
const menuRepo           = new MenuRepository();
const settingsRepo       = new SiteSettingsRepository();

// ═══════════════════════════════════════════════════════════════
// Use Cases — Articles
// ═══════════════════════════════════════════════════════════════
const listArticlesUseCase         = new ListArticlesUseCase(articlePublicRepo);
const getArticleBySlugUseCase     = new GetArticleBySlugUseCase(articlePublicRepo);
const searchArticlesUseCase       = new SearchArticlesUseCase(articlePublicRepo);

const listAdminArticlesUseCase    = new ListAdminArticlesUseCase(articleAdminRepo);
const getAdminArticleByIdUseCase  = new GetAdminArticleByIdUseCase(articleAdminRepo);
const searchAdminArticlesUseCase  = new SearchAdminArticlesUseCase(articleAdminRepo);
const createArticleUseCase        = new CreateArticleUseCase(articleAdminRepo);
const updateArticleUseCase        = new UpdateArticleUseCase(articleAdminRepo);
const updateArticleStatusUseCase  = new UpdateArticleStatusUseCase(articleAdminRepo);
const deleteArticleUseCase        = new DeleteArticleUseCase(articleAdminRepo);
const addArticleImageUseCase      = new AddArticleImageUseCase(articleAdminRepo);
const deleteArticleImageUseCase   = new DeleteArticleImageUseCase(articleAdminRepo);

// ═══════════════════════════════════════════════════════════════
// Services
// ═══════════════════════════════════════════════════════════════
const authService      = new AuthService(userRepo, refreshTokenRepo, jwtService);
const userService      = new UserService(userRepo, refreshTokenRepo);
const categoryService  = new CategoryService(categoryRepo);
const tagService       = new TagService(tagRepo);
const bannerService    = new BannerService(bannerRepo);
const menuService      = new MenuService(menuRepo);
const settingsService  = new SettingsService(settingsRepo);
const dashboardService = new DashboardService(articleAdminRepo, userRepo, categoryRepo);
const liveScoresService = new LiveScoresService();

// ═══════════════════════════════════════════════════════════════
// Controllers
// ═══════════════════════════════════════════════════════════════
export const articlePublicController = new ArticlePublicController(
  listArticlesUseCase,
  getArticleBySlugUseCase,
  searchArticlesUseCase,
);

export const articleAdminController = new ArticleAdminController(
  listAdminArticlesUseCase,
  getAdminArticleByIdUseCase,
  searchAdminArticlesUseCase,
  createArticleUseCase,
  updateArticleUseCase,
  updateArticleStatusUseCase,
  deleteArticleUseCase,
  addArticleImageUseCase,
  deleteArticleImageUseCase,
);

export const authController      = new AuthController(authService);
export const userController      = new UserController(userService);
export const categoryController  = new CategoryController(categoryService);
export const tagController       = new TagController(tagService);
export const bannerController    = new BannerController(bannerService);
export const menuController      = new MenuController(menuService);
export const settingsController  = new SettingsController(settingsService);
export const dashboardController = new DashboardController(dashboardService);
export const liveScoresController = new LiveScoresController(liveScoresService);
