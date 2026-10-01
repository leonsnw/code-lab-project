-- Desafios em C, organizados por assunto, com regras sobre o codigo-fonte.
ALTER TYPE "SubmissionLanguage" ADD VALUE 'C';
ALTER TYPE "SubmissionStatus" ADD VALUE 'RULE_VIOLATION';

ALTER TABLE "challenges"
    ADD COLUMN "language" "SubmissionLanguage" NOT NULL DEFAULT 'JAVASCRIPT',
    ADD COLUMN "topic" TEXT NOT NULL DEFAULT 'Lógica de Programação',
    ADD COLUMN "source_rules" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "challenges_language_idx" ON "challenges"("language");
CREATE INDEX "challenges_topic_idx" ON "challenges"("topic");
