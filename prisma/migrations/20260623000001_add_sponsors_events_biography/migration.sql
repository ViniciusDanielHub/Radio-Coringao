-- ============================================================
-- PATROCINADORES
-- ============================================================
CREATE TABLE "sponsors" (
  "id"          TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "logoUrl"     TEXT        NOT NULL,
  "websiteUrl"  TEXT,
  "description" TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "order"       INTEGER     NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- EVENTOS
-- ============================================================
CREATE TABLE "events" (
  "id"          TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "slug"        TEXT        NOT NULL,
  "description" TEXT        NOT NULL,
  "location"    TEXT,
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "endsAt"      TIMESTAMP(3),
  "coverImage"  TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

CREATE TABLE "event_images" (
  "id"        TEXT        NOT NULL,
  "url"       TEXT        NOT NULL,
  "alt"       TEXT,
  "caption"   TEXT,
  "order"     INTEGER     NOT NULL DEFAULT 0,
  "eventId"   TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "event_images_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "event_images" ADD CONSTRAINT "event_images_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- BIOGRAFIAS
-- ============================================================
CREATE TABLE "biographies" (
  "id"          TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "slug"        TEXT        NOT NULL,
  "role"        TEXT,
  "bio"         TEXT        NOT NULL,
  "avatarUrl"   TEXT,
  "birthDate"   TIMESTAMP(3),
  "nationality" TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "order"       INTEGER     NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "biographies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "biographies_slug_key" ON "biographies"("slug");