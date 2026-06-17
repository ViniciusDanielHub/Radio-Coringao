// src/modules/articles/admin/articles-admin.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ListAdminArticlesUseCase }    from '../use-cases/list-admin-articles.use-case';
import type { GetAdminArticleByIdUseCase }  from '../use-cases/get-admin-article-by-id.use-case';
import type { SearchAdminArticlesUseCase }  from '../use-cases/search-admin-articles.use-case';
import type { CreateArticleUseCase }        from '../use-cases/create-article.use-case';
import type { UpdateArticleUseCase }        from '../use-cases/update-article.use-case';
import type { UpdateArticleStatusUseCase }  from '../use-cases/update-article-status.use-case';
import type { DeleteArticleUseCase }        from '../use-cases/delete-article.use-case';
import type { AddArticleImageUseCase }      from '../use-cases/add-article-image.use-case';
import type { DeleteArticleImageUseCase }   from '../use-cases/delete-article-image.use-case';
import type { CreateArticleInput } from '../use-cases/create-article.use-case';

export class ArticleAdminController {
  constructor(
    private readonly listUseCase:          ListAdminArticlesUseCase,
    private readonly getByIdUseCase:       GetAdminArticleByIdUseCase,
    private readonly searchUseCase:        SearchAdminArticlesUseCase,
    private readonly createUseCase:        CreateArticleUseCase,
    private readonly updateUseCase:        UpdateArticleUseCase,
    private readonly updateStatusUseCase:  UpdateArticleStatusUseCase,
    private readonly deleteUseCase:        DeleteArticleUseCase,
    private readonly addImageUseCase:      AddArticleImageUseCase,
    private readonly deleteImageUseCase:   DeleteArticleImageUseCase,
  ) {}

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      await this.listUseCase.execute(request.query as any, request.user.id, request.user.role),
    );
  };

  search = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      await this.searchUseCase.execute(request.query as any, request.user.id, request.user.role),
    );
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(
      await this.getByIdUseCase.execute(id, request.user.id, request.user.role),
    );
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    console.log('BODY:', JSON.stringify(request.body));
    console.log('UPLOADED FILE:', request.uploadedFile);

    const rawBody = request.body as Record<string, any> ?? {};

    const fields: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawBody)) {
      if (Array.isArray(val)) {
        fields[key] = val.map((v: any) => v?.value ?? v);
      } else {
        fields[key] = (val as any)?.value ?? val;
      }
    }

    // Converte tags de string para array se necessário
    if (fields.tags && typeof fields.tags === 'string') {
      fields.tags = fields.tags.split(',').map((t: string) => t.trim());
    }

    return reply.code(201).send(
      await this.createUseCase.execute(
        fields as CreateArticleInput,
        request.user.id,
        request.user.role,
        request.uploadedFile?.path,
      ),
    );
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(
      await this.updateUseCase.execute(
        id,
        request.body as any,
        request.user.id,
        request.user.role,
        request.uploadedFile?.path,
      ),
    );
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as any;
    return reply.send(
      await this.updateStatusUseCase.execute(id, status, request.user.role),
    );
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.deleteUseCase.execute(id));
  };

  addImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Nenhuma imagem enviada.' });
    return reply.code(201).send(
      await this.addImageUseCase.execute(id, request.uploadedFile.path, request.body as any),
    );
  };

  deleteImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, imageId } = request.params as { id: string; imageId: string };
    return reply.send(await this.deleteImageUseCase.execute(id, imageId));
  };
}
