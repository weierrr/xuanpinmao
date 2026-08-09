-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "targetMarket" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dataOrigin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SelectionSpec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL,
    "targetCountry" TEXT NOT NULL,
    "acquisitionChannel" TEXT NOT NULL,
    "testBudget" TEXT,
    "fulfillmentMode" TEXT NOT NULL,
    "targetPriceRange" TEXT,
    "acceptableCostRange" TEXT,
    "excludedCategories" TEXT NOT NULL,
    "preferredCategories" TEXT NOT NULL,
    "teamAdvantages" TEXT NOT NULL,
    "completenessStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SelectionSpec_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunSpec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL,
    "productName" TEXT NOT NULL,
    "productUrl" TEXT,
    "sku" TEXT,
    "variant" TEXT,
    "packageSpec" TEXT,
    "targetCountry" TEXT NOT NULL,
    "targetUser" TEXT,
    "salePrice" DECIMAL,
    "saleCurrency" TEXT NOT NULL,
    "offer" TEXT,
    "acquisitionChannel" TEXT NOT NULL,
    "fulfillmentMode" TEXT NOT NULL,
    "supplierCost" DECIMAL,
    "packagingCost" DECIMAL,
    "domesticShipping" DECIMAL,
    "internationalShipping" DECIMAL,
    "testBudget" DECIMAL,
    "prohibitedConditions" TEXT NOT NULL,
    "completenessStatus" TEXT NOT NULL,
    "supersedesRunSpecId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunSpec_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "sku" TEXT,
    "variant" TEXT,
    "market" TEXT,
    "relationship" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "evidenceCarrier" TEXT NOT NULL,
    "accessedAt" TEXT NOT NULL,
    "accessStatus" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "skuOrVariant" TEXT,
    "market" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Source_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Source_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "entityId" TEXT,
    "atomicClaim" TEXT NOT NULL,
    "dataNature" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "evidenceCarrier" TEXT NOT NULL,
    "sourceLocation" TEXT NOT NULL,
    "linkSpecificity" TEXT NOT NULL,
    "observedAt" TEXT NOT NULL,
    "informationNature" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "timeStatus" TEXT NOT NULL,
    "runSpecApplicability" TEXT NOT NULL,
    "dataCompleteness" TEXT NOT NULL,
    "decisionUse" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "inferenceBasis" TEXT NOT NULL,
    "missingEvidence" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Claim_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Claim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "moduleType" TEXT NOT NULL,
    "relevance" TEXT NOT NULL,
    "executionStatus" TEXT NOT NULL,
    "evidenceSufficiency" TEXT NOT NULL,
    "decisionUsability" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "determiningClaimIds" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskModule_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EconomicsScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "grossRevenue" DECIMAL,
    "discount" DECIMAL,
    "netRevenue" DECIMAL,
    "currency" TEXT NOT NULL,
    "supplierCost" DECIMAL,
    "packagingCost" DECIMAL,
    "domesticShipping" DECIMAL,
    "internationalShipping" DECIMAL,
    "unlistedDutyAndClearance" DECIMAL,
    "paymentFee" DECIMAL,
    "refundReserve" DECIMAL,
    "chargebackReserve" DECIMAL,
    "defectAndReshipCost" DECIMAL,
    "otherVariableCost" DECIMAL,
    "landedCost" DECIMAL,
    "grossProfit" DECIMAL,
    "variableOperatingCost" DECIMAL,
    "cm1" DECIMAL,
    "cm1Margin" DECIMAL,
    "breakEvenCpa" DECIMAL,
    "breakEvenRoas" DECIMAL,
    "completenessStatus" TEXT NOT NULL,
    "stopReason" TEXT,
    "missingFields" TEXT NOT NULL,
    "calculationVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EconomicsScenario_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "runSpecId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "instructionVersion" TEXT NOT NULL,
    "instructionChecksum" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "error" TEXT,
    "tokenUsage" INTEGER NOT NULL,
    "estimatedCost" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "dataOrigin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchRun_runSpecId_fkey" FOREIGN KEY ("runSpecId") REFERENCES "RunSpec" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowStageRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "stageCode" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "inputArtifactRef" TEXT NOT NULL,
    "outputArtifactRef" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryOfId" TEXT,
    "log" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowStageRun_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "workflowStageRunId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "taskKind" TEXT NOT NULL,
    "requestSchemaVersion" TEXT NOT NULL,
    "responseSchemaVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "instructionChecksum" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCost" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "responseArtifactRef" TEXT,
    "responseChecksum" TEXT,
    "warning" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    CONSTRAINT "ModelCall_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModelCall_workflowStageRunId_fkey" FOREIGN KEY ("workflowStageRunId") REFERENCES "WorkflowStageRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "formalStatus" TEXT NOT NULL,
    "applicableRunSpecId" TEXT NOT NULL,
    "determiningClaimIds" TEXT NOT NULL,
    "secondaryRisks" TEXT NOT NULL,
    "listingAllowed" BOOLEAN NOT NULL,
    "adTestAllowed" BOOLEAN NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Decision_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissingDataItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "decisionId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "fieldCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceNeeded" TEXT NOT NULL,
    "minimumCaptureScope" TEXT NOT NULL,
    "blockingArea" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "MissingDataItem_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchRunId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "formalStatus" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL,
    "supersedesReportId" TEXT,
    CONSTRAINT "Report_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SelectionSpec_projectId_version_key" ON "SelectionSpec"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RunSpec_projectId_version_key" ON "RunSpec"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RiskModule_researchRunId_moduleCode_key" ON "RiskModule"("researchRunId", "moduleCode");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStageRun_researchRunId_stageCode_attempt_key" ON "WorkflowStageRun"("researchRunId", "stageCode", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_researchRunId_key" ON "Decision"("researchRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_researchRunId_format_version_key" ON "Report"("researchRunId", "format", "version");

