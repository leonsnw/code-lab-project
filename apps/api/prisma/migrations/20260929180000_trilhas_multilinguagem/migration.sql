-- Trilhas de estudo, desafios multilinguagem, modo funcao, comparadores,
-- dicas, solucao comentada e avisos do compilador.
ALTER TYPE "SubmissionLanguage" ADD VALUE 'PYTHON';

CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tracks_slug_key" ON "tracks"("slug");

CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 30,
    "position" INTEGER NOT NULL DEFAULT 0,
    "prerequisite_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "modules_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "modules_slug_key" ON "modules"("slug");
CREATE INDEX "modules_track_id_idx" ON "modules"("track_id");

CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 10,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "lessons_slug_key" ON "lessons"("slug");
CREATE INDEX "lessons_module_id_idx" ON "lessons"("module_id");

CREATE TABLE "lesson_completions" (
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lesson_completions_pkey" PRIMARY KEY ("user_id", "lesson_id"),
    CONSTRAINT "lesson_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lesson_completions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "challenge_unlocks" (
    "user_id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "hints_revealed" INTEGER NOT NULL DEFAULT 0,
    "solution_revealed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "challenge_unlocks_pkey" PRIMARY KEY ("user_id", "challenge_id"),
    CONSTRAINT "challenge_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "challenge_unlocks_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "challenges"
    ADD COLUMN "languages" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'stdio',
    ADD COLUMN "function_spec" JSONB,
    ADD COLUMN "checker" JSONB NOT NULL DEFAULT '{"kind":"exact"}',
    ADD COLUMN "time_limit_ms" INTEGER,
    ADD COLUMN "memory_limit_mb" INTEGER,
    ADD COLUMN "module_id" TEXT,
    ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "is_boss" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "hints" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "editorial" TEXT,
    ADD COLUMN "complexity" JSONB,
    ADD COLUMN "follow_ups" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- A linguagem unica e as regras viram a primeira entrada de "languages".
UPDATE "challenges"
SET "languages" = jsonb_build_array(jsonb_build_object(
    'language', lower("language"::TEXT),
    'sourceRules', "source_rules"
));

DROP INDEX IF EXISTS "challenges_language_idx";
ALTER TABLE "challenges" DROP COLUMN "language", DROP COLUMN "source_rules";

ALTER TABLE "challenges" ADD CONSTRAINT "challenges_module_id_fkey"
    FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "challenges_module_id_idx" ON "challenges"("module_id");

ALTER TABLE "submissions" ADD COLUMN "compile_warnings" TEXT;
