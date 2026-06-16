// src/shared/errors/index.ts
import type { ErrorCode } from './error-codes';
export { ErrorCode } from './error-codes';

// ─── Mensagens amigáveis em PT-BR por código ─────────────────
export const ERROR_MESSAGES: Record<string, string> = {

  // Auth
  AUTH_TOKEN_MISSING:           'Token de autenticação não fornecido. Inclua o header: Authorization: Bearer <token>',
  AUTH_TOKEN_INVALID:           'Token de autenticação inválido ou corrompido.',
  AUTH_TOKEN_EXPIRED:           'Seu token expirou. Faça login novamente ou use o refresh token.',
  AUTH_TOKEN_MALFORMED:         'Formato de token inválido. Use o padrão Bearer <token>.',
  AUTH_REFRESH_MISSING:         'Refresh token não fornecido.',
  AUTH_REFRESH_INVALID:         'Refresh token inválido ou já foi revogado.',
  AUTH_REFRESH_EXPIRED:         'Refresh token expirado. Faça login novamente.',
  AUTH_CREDENTIALS_INVALID:     'E-mail ou senha incorretos. Verifique suas credenciais.',
  AUTH_USER_INACTIVE:           'Esta conta foi desativada. Entre em contato com o administrador.',
  AUTH_USER_NOT_FOUND:          'Usuário não encontrado. Faça login novamente.',

  // Permissões
  PERMISSION_DENIED:            'Acesso negado. Você não tem permissão para esta ação.',
  PERMISSION_ROLE_INSUFFICIENT: 'Seu cargo não possui privilégios suficientes para esta operação.',
  PERMISSION_OWN_ONLY:          'Você só pode gerenciar seus próprios conteúdos.',
  PERMISSION_CANNOT_SELF_DEACTIVATE: 'Você não pode desativar sua própria conta.',
  PERMISSION_ONLY_SUPER_ADMIN:  'Esta operação é restrita ao Super Administrador.',

  // Usuários
  USER_NOT_FOUND:               'Usuário não encontrado.',
  USER_EMAIL_TAKEN:             'Este e-mail já está cadastrado. Use outro ou recupere seu acesso.',
  USER_WRONG_PASSWORD:          'Senha atual incorreta.',
  USER_WEAK_PASSWORD:           'A senha deve ter pelo menos 8 caracteres, incluindo letras e números.',
  USER_INVALID_ROLE:            'Cargo inválido. Valores aceitos: SUPER_ADMIN, EDITOR_CHEFE, EDITOR, JORNALISTA, COLUNISTA, SOCIAL_MEDIA, MODERADOR, SEO_MANAGER.',
  USER_ALREADY_INACTIVE:        'Este usuário já está inativo.',

  // Artigos
  ARTICLE_NOT_FOUND:            'Artigo não encontrado.',
  ARTICLE_SLUG_TAKEN:           'Já existe um artigo com este slug. Um novo será gerado automaticamente.',
  ARTICLE_INVALID_STATUS:       'Status inválido. Valores aceitos: DRAFT, REVIEW, PUBLISHED, ARCHIVED.',
  ARTICLE_INVALID_TYPE:         'Tipo de artigo inválido. Valores aceitos: NEWS, ANALYSIS, INTERVIEW, LIVE, GALLERY.',
  ARTICLE_CANNOT_PUBLISH:       'Seu cargo não permite publicar artigos diretamente. O artigo será enviado para revisão.',
  ARTICLE_CANNOT_ARCHIVE:       'Seu cargo não permite arquivar artigos.',
  ARTICLE_CATEGORY_REQUIRED:    'O campo "categoryId" é obrigatório.',
  ARTICLE_CONTENT_REQUIRED:     'O campo "content" é obrigatório e não pode estar vazio.',
  ARTICLE_TITLE_REQUIRED:       'O campo "title" é obrigatório.',
  ARTICLE_TITLE_TOO_LONG:       'O título não pode ultrapassar 255 caracteres.',
  ARTICLE_SCHEDULED_PAST:       'A data de agendamento deve ser no futuro.',
  ARTICLE_IMAGE_NOT_FOUND:      'Imagem do artigo não encontrada.',
  ARTICLE_NO_IMAGE_UPLOADED:    'Nenhuma imagem foi enviada.',

  // Categorias
  CATEGORY_NOT_FOUND:           'Categoria não encontrada.',
  CATEGORY_NAME_TAKEN:          'Já existe uma categoria com este nome.',
  CATEGORY_SLUG_TAKEN:          'Já existe uma categoria com este slug.',
  CATEGORY_HAS_ARTICLES:        'Não é possível deletar: a categoria possui artigos vinculados. Reatribua-os antes.',
  CATEGORY_NAME_REQUIRED:       'O nome da categoria é obrigatório.',
  CATEGORY_COLOR_INVALID:       'Cor inválida. Use o formato hexadecimal (#RRGGBB ou #RGB).',

  // Tags
  TAG_NOT_FOUND:                'Tag não encontrada.',
  TAG_NAME_TAKEN:               'Já existe uma tag com este nome.',
  TAG_NAME_REQUIRED:            'O nome da tag é obrigatório.',
  TAG_NAME_TOO_LONG:            'O nome da tag não pode ultrapassar 50 caracteres.',

  // Banners
  BANNER_NOT_FOUND:             'Banner não encontrado.',
  BANNER_IMAGE_REQUIRED:        'A imagem do banner é obrigatória.',
  BANNER_TITLE_REQUIRED:        'O título do banner é obrigatório.',
  BANNER_DATE_RANGE_INVALID:    'A data de início deve ser anterior à data de término.',
  BANNER_DATE_PAST:             'A data de início não pode ser no passado.',

  // Menu
  MENU_ITEM_NOT_FOUND:          'Item de menu não encontrado.',
  MENU_LABEL_REQUIRED:          'O rótulo (label) do item de menu é obrigatório.',
  MENU_URL_REQUIRED:            'A URL do item de menu é obrigatória.',
  MENU_URL_INVALID:             'URL inválida. Use uma URL relativa (/pagina) ou absoluta (https://...).',
  MENU_PARENT_NOT_FOUND:        'Item pai (parentId) não encontrado.',
  MENU_CIRCULAR_REFERENCE:      'Referência circular detectada: um item não pode ser pai de si mesmo.',

  // Configurações
  SETTINGS_NOT_FOUND:           'Configurações do site não encontradas.',
  SETTINGS_COLOR_INVALID:       'Cor primária inválida. Use o formato hexadecimal (#RRGGBB).',
  SETTINGS_URL_INVALID:         'URL de rede social inválida.',
  SETTINGS_LOGO_REQUIRED:       'Nenhum arquivo de logo foi enviado.',

  // Upload
  UPLOAD_NO_FILE:               'Nenhum arquivo foi enviado.',
  UPLOAD_INVALID_TYPE:          'Tipo de arquivo não permitido. Envie apenas imagens (JPEG, PNG, WebP).',
  UPLOAD_TOO_LARGE:             'O arquivo excede o tamanho máximo permitido de 5MB.',
  UPLOAD_CLOUDINARY_FAILED:     'Falha ao fazer upload da imagem. Tente novamente.',
  UPLOAD_DELETE_FAILED:         'Falha ao remover a imagem anterior. O registro foi atualizado mesmo assim.',

  // Paginação
  PAGINATION_PAGE_INVALID:      'O parâmetro "page" deve ser um número inteiro positivo.',
  PAGINATION_LIMIT_INVALID:     'O parâmetro "limit" deve ser um número inteiro positivo.',
  PAGINATION_LIMIT_TOO_HIGH:    'O limite máximo por página é 100 registros.',

  // Banco de dados
  DB_UNIQUE_VIOLATION:          'Já existe um registro com este valor único.',
  DB_RECORD_NOT_FOUND:          'Registro não encontrado no banco de dados.',
  DB_FOREIGN_KEY_VIOLATION:     'Operação inválida: referência a um registro inexistente.',
  DB_CONNECTION_ERROR:          'Erro de conexão com o banco de dados. Tente novamente em instantes.',
  DB_QUERY_FAILED:              'Erro ao executar a operação no banco de dados.',

  // Live Scores
  LIVE_SCORES_API_KEY_MISSING:   'Chave da API football-data.org não configurada (FOOTBALL_DATA_API_KEY). Cadastre-se em https://www.football-data.org/client/register',
  LIVE_SCORES_API_UNAVAILABLE:   'O serviço de placar ao vivo está temporariamente indisponível.',
  LIVE_SCORES_API_RATE_LIMITED:  'Limite de requisições da API de placar atingido. Aguarde antes de tentar novamente.',
  LIVE_SCORES_TEAM_NOT_FOUND:    'Time não encontrado. Verifique o ID informado.',
  LIVE_SCORES_MATCHDAY_INVALID:  'Rodada inválida. Informe um número entre 1 e 38.',
  LIVE_SCORES_DATE_RANGE_INVALID:'O intervalo de datas é inválido. "dateFrom" deve ser anterior a "dateTo".',
  LIVE_SCORES_STATUS_INVALID:    'Status de partida inválido. Valores aceitos: SCHEDULED, LIVE, IN_PLAY, PAUSED, FINISHED, POSTPONED, CANCELLED, SUSPENDED.',

  // Validação genérica
  VALIDATION_REQUIRED_FIELD:    'Campo obrigatório não informado.',
  VALIDATION_INVALID_FORMAT:    'Formato de dado inválido.',
  VALIDATION_INVALID_EMAIL:     'Endereço de e-mail inválido.',
  VALIDATION_INVALID_UUID:      'ID inválido. Deve ser um UUID v4.',
  VALIDATION_INVALID_DATE:      'Data inválida. Use o formato ISO 8601 (ex: 2026-06-01T12:00:00Z).',
  VALIDATION_INVALID_URL:       'URL inválida.',
  VALIDATION_STRING_TOO_SHORT:  'Texto muito curto.',
  VALIDATION_STRING_TOO_LONG:   'Texto muito longo.',
  VALIDATION_NUMBER_OUT_OF_RANGE: 'Valor numérico fora do intervalo permitido.',

  // Sistema
  INTERNAL_ERROR:               'Erro interno do servidor. Nossa equipe foi notificada.',
  ROUTE_NOT_FOUND:              'Rota não encontrada.',
  RATE_LIMIT_EXCEEDED:          'Muitas requisições. Aguarde 15 minutos antes de tentar novamente.',
  ENV_MISSING:                  'Variável de ambiente obrigatória não configurada.',
  SCHEDULER_ERROR:              'Erro no agendador de publicações.',
};

// ─── Classe base ──────────────────────────────────────────────
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    messageOrCode: string,
    statusCode: number = 400,
    code?: string,
    details?: unknown,
  ) {
    // Se recebermos um ErrorCode conhecido, usamos a mensagem mapeada
    const message = ERROR_MESSAGES[messageOrCode] ?? messageOrCode;
    super(message);
    this.name       = 'AppError';
    this.statusCode = statusCode;
    this.code       = code ?? messageOrCode;
    this.details    = details;
  }
}

// ─── Erros de domínio ─────────────────────────────────────────
export class NotFoundError extends AppError {
  constructor(code: string = 'DB_RECORD_NOT_FOUND', details?: unknown) {
    super(code, 404, code, details);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string = 'AUTH_TOKEN_INVALID', details?: unknown) {
    super(code, 401, code, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string = 'PERMISSION_DENIED', details?: unknown) {
    super(code, 403, code, details);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(code: string = 'DB_UNIQUE_VIOLATION', details?: unknown) {
    super(code, 409, code, details);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(code: string = 'VALIDATION_INVALID_FORMAT', details?: unknown) {
    super(code, 422, code, details);
    this.name = 'ValidationError';
  }
}

export class UploadError extends AppError {
  constructor(code: string = 'UPLOAD_CLOUDINARY_FAILED', details?: unknown) {
    super(code, 500, code, details);
    this.name = 'UploadError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(code: string = 'LIVE_SCORES_API_UNAVAILABLE', details?: unknown) {
    super(code, 503, code, details);
    this.name = 'ExternalServiceError';
  }
}
