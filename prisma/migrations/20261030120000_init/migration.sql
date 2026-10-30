-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('CSV', 'INTERNAL', 'PLACES');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'SIGNED_UP', 'STORE_CREATED', 'FIRST_LISTING', 'FIRST_ORDER', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "OptimizationStatus" AS ENUM ('READY', 'NEEDS_REVIEW', 'APPLIED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "instagram" TEXT,
    "city" TEXT,
    "category" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "score" INTEGER NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadStatus" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelCall" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER,
    "ms" INTEGER NOT NULL,
    "stopReason" TEXT,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Optimization" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "sellerRef" TEXT NOT NULL,
    "productRef" TEXT,
    "parentId" TEXT,
    "promptVersion" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "proposal" JSONB NOT NULL,
    "problems" TEXT[],
    "status" "OptimizationStatus" NOT NULL,
    "applied" JSONB,
    "rejectReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "modelCallId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Optimization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_inviteCode_key" ON "Lead"("inviteCode");

-- CreateIndex
CREATE INDEX "Lead_tenant_batch_status_idx" ON "Lead"("tenant", "batch", "status");

-- CreateIndex
CREATE INDEX "Lead_tenant_score_idx" ON "Lead"("tenant", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_tenant_dedupeKey_key" ON "Lead"("tenant", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "LeadEvent_leadId_type_key" ON "LeadEvent"("leadId", "type");

-- CreateIndex
CREATE INDEX "ModelCall_tenant_createdAt_idx" ON "ModelCall"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "Optimization_tenant_status_createdAt_idx" ON "Optimization"("tenant", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Optimization_tenant_productRef_idx" ON "Optimization"("tenant", "productRef");

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Optimization" ADD CONSTRAINT "Optimization_modelCallId_fkey" FOREIGN KEY ("modelCallId") REFERENCES "ModelCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Optimization" ADD CONSTRAINT "Optimization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Optimization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

