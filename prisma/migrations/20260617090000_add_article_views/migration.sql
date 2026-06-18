-- CreateTable
CREATE TABLE "article_views" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Usado para checar duplicidade (1 leitura única por IP/artigo a cada 24h)
CREATE INDEX "article_views_articleId_ipHash_viewedAt_idx" ON "article_views"("articleId", "ipHash", "viewedAt");

-- CreateIndex
-- Usado para agregações por mês (relatórios do dashboard)
CREATE INDEX "article_views_viewedAt_idx" ON "article_views"("viewedAt");

-- CreateIndex
-- Usado para "qual matéria mais lida" e contagem de leitores únicos por artigo
CREATE INDEX "article_views_articleId_idx" ON "article_views"("articleId");

-- AddForeignKey
ALTER TABLE "article_views" ADD CONSTRAINT "article_views_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;