-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "SubmissionLanguage" AS ENUM ('JAVASCRIPT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('COMPLETED', 'RUNTIME_ERROR', 'TIMEOUT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "points" INTEGER NOT NULL,
    "constraints" TEXT[],
    "examples" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "language" "SubmissionLanguage" NOT NULL,
    "source_code" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL,
    "score_awarded" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "evaluated_at" TIMESTAMP(3),
    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_test_results" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "execution_status" "ExecutionStatus" NOT NULL,
    "is_public" BOOLEAN NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "input" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "actual_output" TEXT NOT NULL,
    "error" TEXT,
    "duration_ms" INTEGER NOT NULL,
    CONSTRAINT "submission_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_tags" (
    "challenge_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    CONSTRAINT "challenge_tags_pkey" PRIMARY KEY ("challenge_id", "tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "challenges_slug_key" ON "challenges"("slug");
CREATE INDEX "challenges_difficulty_idx" ON "challenges"("difficulty");
CREATE INDEX "challenges_is_active_idx" ON "challenges"("is_active");
CREATE INDEX "test_cases_challenge_id_idx" ON "test_cases"("challenge_id");
CREATE INDEX "submissions_user_id_idx" ON "submissions"("user_id");
CREATE INDEX "submissions_challenge_id_idx" ON "submissions"("challenge_id");
CREATE INDEX "submissions_status_idx" ON "submissions"("status");
CREATE INDEX "submissions_submitted_at_idx" ON "submissions"("submitted_at");
CREATE INDEX "submission_test_results_submission_id_idx" ON "submission_test_results"("submission_id");
CREATE UNIQUE INDEX "scores_user_id_key" ON "scores"("user_id");
CREATE INDEX "comments_challenge_id_idx" ON "comments"("challenge_id");
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");
CREATE INDEX "ratings_challenge_id_idx" ON "ratings"("challenge_id");
CREATE UNIQUE INDEX "ratings_user_id_challenge_id_key" ON "ratings"("user_id", "challenge_id");
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submission_test_results" ADD CONSTRAINT "submission_test_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_tags" ADD CONSTRAINT "challenge_tags_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_tags" ADD CONSTRAINT "challenge_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
