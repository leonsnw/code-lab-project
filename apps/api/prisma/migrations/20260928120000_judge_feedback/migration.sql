-- Veredito detalhado no estilo LeetCode: erro de sintaxe, falha de
-- infraestrutura, contagem de casos aprovados e ordem de execucao.
ALTER TYPE "SubmissionStatus" ADD VALUE 'COMPILE_ERROR';
ALTER TYPE "SubmissionStatus" ADD VALUE 'INTERNAL_ERROR';

ALTER TABLE "submissions"
    ADD COLUMN "total_tests" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "passed_tests" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "error_message" TEXT;

ALTER TABLE "submission_test_results"
    ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "stderr" TEXT;

-- Submissoes anteriores executavam todos os casos; os totais saem dos
-- resultados ja gravados.
UPDATE "submissions" AS s
SET "total_tests" = r.total,
    "passed_tests" = r.passed
FROM (
    SELECT "submission_id",
           COUNT(*)::INTEGER AS total,
           COUNT(*) FILTER (WHERE "passed")::INTEGER AS passed
    FROM "submission_test_results"
    GROUP BY "submission_id"
) AS r
WHERE r."submission_id" = s."id";

-- Ordem retroativa: casos publicos primeiro, como o avaliador atual executa.
UPDATE "submission_test_results" AS t
SET "position" = o.position
FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
               PARTITION BY "submission_id"
               ORDER BY "is_public" DESC, "test_case_id"
           )::INTEGER AS position
    FROM "submission_test_results"
) AS o
WHERE o."id" = t."id";
