-- Elimina a race condition do dedupe check-then-act em ArticleView.
--
-- Antes: o código fazia findFirst(where: ipHash + janela de 24h) e,
-- se não achasse, fazia create. Dois requests simultâneos do mesmo
-- IP passavam ambos pelo findFirst antes que o primeiro create
-- terminasse, gravando 2 registros para a "mesma leitura".
--
-- Agora: viewBucket é o dia (UTC) truncado em que a leitura ocorreu.
-- Uma constraint UNIQUE real em (articleId, ipHash, viewBucket) torna
-- "1 leitura por IP/artigo/dia" uma garantia do banco, não da aplicação.
-- O insert atômico (create + catch de P2002) substitui o check-then-act.

-- 1) Coluna nova. Nullable por enquanto para popular linhas existentes
--    sem quebrar nada, depois passa a NOT NULL.
ALTER TABLE "article_views" ADD COLUMN "viewBucket" DATE;

-- 2) Popula o bucket das linhas já existentes a partir de viewedAt (UTC).
UPDATE "article_views"
SET "viewBucket" = ("viewedAt" AT TIME ZONE 'UTC')::date
WHERE "viewBucket" IS NULL;

-- 3) Agora que está populada, torna NOT NULL.
ALTER TABLE "article_views" ALTER COLUMN "viewBucket" SET NOT NULL;

-- 4) Antes de criar a constraint única, remove duplicados que já possam
--    existir por causa da race condition antiga (mantém o registro mais
--    antigo de cada grupo articleId+ipHash+viewBucket).
DELETE FROM "article_views" a
USING "article_views" b
WHERE a.id <> b.id
  AND a."articleId" = b."articleId"
  AND a."ipHash" = b."ipHash"
  AND a."viewBucket" = b."viewBucket"
  AND a."viewedAt" > b."viewedAt";

-- 5) Constraint única real — é isso que torna o dedupe atômico.
--    Substitui o índice não-único anterior (articleId, ipHash, viewedAt).
DROP INDEX IF EXISTS "article_views_articleId_ipHash_viewedAt_idx";

CREATE UNIQUE INDEX "article_views_articleId_ipHash_viewBucket_key"
ON "article_views"("articleId", "ipHash", "viewBucket");

-- Mantém os índices de agregação (viewedAt para relatórios mensais,
-- articleId para "mais lida"); esses não mudam.