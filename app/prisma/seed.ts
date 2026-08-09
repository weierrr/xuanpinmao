import { PrismaClient } from "@prisma/client";
import { MockProvider } from "../src/infrastructure/mock-provider";
import { loadT21Fixture } from "../src/infrastructure/fixture";
import { persistWorkflowExecution } from "../src/infrastructure/workflow-persistence";
import { runFixtureWorkflow } from "../src/application/workflow";

const prisma = new PrismaClient();

const jsonText = (value: unknown): string => JSON.stringify(value);

const main = async (): Promise<void> => {
  const fixture = await loadT21Fixture();
  const runId = fixture.validation.run_id;
  const workflow = await runFixtureWorkflow(runId, new MockProvider());

  await prisma.project.upsert({
    where: { id: fixture.project.id },
    create: {
      id: fixture.project.id,
      name: fixture.project.name,
      mode: fixture.project.mode,
      targetMarket: fixture.project.targetMarket,
      status: fixture.project.status,
      dataOrigin: fixture.project.dataOrigin,
    },
    update: {
      name: fixture.project.name,
      mode: fixture.project.mode,
      targetMarket: fixture.project.targetMarket,
      status: fixture.project.status,
      dataOrigin: fixture.project.dataOrigin,
    },
  });

  await prisma.selectionSpec.upsert({
    where: { id: "selection-t21-v1" },
    create: {
      id: "selection-t21-v1",
      projectId: fixture.project.id,
      version: 1,
      isCurrent: true,
      targetCountry: "US",
      acquisitionChannel: fixture.runspec.acquisitionChannel,
      testBudget: null,
      fulfillmentMode: fixture.runspec.fulfillmentMode,
      targetPriceRange: "$29-$69.60",
      acceptableCostRange: null,
      excludedCategories: jsonText([]),
      preferredCategories: jsonText(["women shapewear", "compression top"]),
      teamAdvantages: jsonText([]),
      completenessStatus: "fixture_only",
    },
    update: {
      isCurrent: true,
      targetCountry: "US",
      acquisitionChannel: fixture.runspec.acquisitionChannel,
      testBudget: null,
      fulfillmentMode: fixture.runspec.fulfillmentMode,
      targetPriceRange: "$29-$69.60",
      acceptableCostRange: null,
      excludedCategories: jsonText([]),
      preferredCategories: jsonText(["women shapewear", "compression top"]),
      teamAdvantages: jsonText([]),
      completenessStatus: "fixture_only",
    },
  });

  await prisma.runSpec.upsert({
    where: { id: fixture.runspec.id },
    create: {
      id: fixture.runspec.id,
      projectId: fixture.project.id,
      version: fixture.runspec.version,
      isCurrent: fixture.runspec.isCurrent,
      productName: fixture.runspec.productName,
      productUrl: fixture.runspec.productUrl,
      sku: fixture.runspec.sku,
      variant: fixture.runspec.variant,
      packageSpec: fixture.runspec.packageSpec,
      targetCountry: fixture.runspec.targetCountry,
      targetUser: fixture.runspec.targetUser,
      salePrice: fixture.runspec.salePrice,
      saleCurrency: fixture.runspec.saleCurrency,
      offer: fixture.runspec.offer,
      acquisitionChannel: fixture.runspec.acquisitionChannel,
      fulfillmentMode: fixture.runspec.fulfillmentMode,
      supplierCost: fixture.runspec.supplierCost,
      packagingCost: fixture.runspec.packagingCost,
      domesticShipping: fixture.runspec.domesticShipping,
      internationalShipping: fixture.runspec.internationalShipping,
      testBudget: fixture.runspec.testBudget,
      prohibitedConditions: jsonText(fixture.runspec.prohibitedConditions),
      completenessStatus: fixture.runspec.completenessStatus,
      supersedesRunSpecId: null,
    },
    update: {
      isCurrent: fixture.runspec.isCurrent,
      productName: fixture.runspec.productName,
      productUrl: fixture.runspec.productUrl,
      sku: fixture.runspec.sku,
      variant: fixture.runspec.variant,
      packageSpec: fixture.runspec.packageSpec,
      targetCountry: fixture.runspec.targetCountry,
      targetUser: fixture.runspec.targetUser,
      salePrice: fixture.runspec.salePrice,
      saleCurrency: fixture.runspec.saleCurrency,
      offer: fixture.runspec.offer,
      acquisitionChannel: fixture.runspec.acquisitionChannel,
      fulfillmentMode: fixture.runspec.fulfillmentMode,
      supplierCost: fixture.runspec.supplierCost,
      packagingCost: fixture.runspec.packagingCost,
      domesticShipping: fixture.runspec.domesticShipping,
      internationalShipping: fixture.runspec.internationalShipping,
      testBudget: fixture.runspec.testBudget,
      prohibitedConditions: jsonText(fixture.runspec.prohibitedConditions),
      completenessStatus: fixture.runspec.completenessStatus,
    },
  });

  for (const entity of fixture.entities) {
    await prisma.entity.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        projectId: entity.projectId,
        type: entity.type,
        name: entity.name,
        url: entity.url,
        sku: entity.sku,
        variant: entity.variant,
        market: entity.market,
        relationship: entity.relationship,
      },
      update: {
        type: entity.type,
        name: entity.name,
        url: entity.url,
        sku: entity.sku,
        variant: entity.variant,
        market: entity.market,
        relationship: entity.relationship,
      },
    });
  }

  await persistWorkflowExecution({
    prisma,
    workflow,
    projectId: fixture.project.id,
    runSpecId: fixture.runspec.id,
    provider: "mock",
    model: "t21-fixture-mock-v1",
    dataOrigin: "fixture",
  });

  const supplierEntityId = "entity-supplier";
  const targetEntityId = "entity-target-product";
  for (const source of fixture.sources) {
    await prisma.source.upsert({
      where: { id: source.id },
      create: {
        id: source.id,
        researchRunId: runId,
        entityId: source.sourceType.includes("供应商") || source.title.includes("1688") ? supplierEntityId : targetEntityId,
        title: source.title,
        url: source.url,
        sourceType: source.sourceType,
        evidenceCarrier: source.evidenceCarrier,
        accessedAt: source.accessedAt,
        accessStatus: source.accessStatus,
        targetEntity: source.targetEntity,
        skuOrVariant: source.skuOrVariant,
        market: source.market,
        notes: source.notes,
      },
      update: {
        entityId: source.sourceType.includes("供应商") || source.title.includes("1688") ? supplierEntityId : targetEntityId,
        title: source.title,
        url: source.url,
        sourceType: source.sourceType,
        evidenceCarrier: source.evidenceCarrier,
        accessedAt: source.accessedAt,
        accessStatus: source.accessStatus,
        targetEntity: source.targetEntity,
        skuOrVariant: source.skuOrVariant,
        market: source.market,
        notes: source.notes,
      },
    });
  }

  for (const claim of fixture.claims) {
    await prisma.claim.upsert({
      where: { id: claim.id },
      create: {
        id: claim.id,
        researchRunId: runId,
        sourceId: claim.sourceId,
        entityId: claim.sourceId === "SRC-003" || claim.sourceId === "SRC-004" ? supplierEntityId : targetEntityId,
        atomicClaim: claim.atomicClaim,
        dataNature: claim.dataNature,
        sourceType: claim.sourceType,
        evidenceCarrier: claim.evidenceCarrier,
        sourceLocation: claim.sourceLocation,
        linkSpecificity: claim.linkSpecificity,
        observedAt: claim.observedAt,
        informationNature: claim.informationNature,
        verificationStatus: claim.verificationStatus,
        timeStatus: claim.timeStatus,
        runSpecApplicability: claim.runSpecApplicability,
        dataCompleteness: claim.dataCompleteness,
        decisionUse: claim.decisionUse,
        confidence: claim.confidence,
        inferenceBasis: claim.inferenceBasis,
        missingEvidence: claim.missingEvidence,
        notes: claim.notes,
      },
      update: {
        sourceId: claim.sourceId,
        entityId: claim.sourceId === "SRC-003" || claim.sourceId === "SRC-004" ? supplierEntityId : targetEntityId,
        atomicClaim: claim.atomicClaim,
        dataNature: claim.dataNature,
        sourceType: claim.sourceType,
        evidenceCarrier: claim.evidenceCarrier,
        sourceLocation: claim.sourceLocation,
        linkSpecificity: claim.linkSpecificity,
        observedAt: claim.observedAt,
        informationNature: claim.informationNature,
        verificationStatus: claim.verificationStatus,
        timeStatus: claim.timeStatus,
        runSpecApplicability: claim.runSpecApplicability,
        dataCompleteness: claim.dataCompleteness,
        decisionUse: claim.decisionUse,
        confidence: claim.confidence,
        inferenceBasis: claim.inferenceBasis,
        missingEvidence: claim.missingEvidence,
        notes: claim.notes,
      },
    });
  }

  for (const riskModule of fixture.riskModules) {
    await prisma.riskModule.upsert({
      where: {
        researchRunId_moduleCode: {
          researchRunId: runId,
          moduleCode: riskModule.moduleCode,
        },
      },
      create: {
        id: `risk-${riskModule.moduleCode.toLowerCase()}`,
        researchRunId: runId,
        moduleCode: riskModule.moduleCode,
        moduleName: riskModule.moduleName,
        moduleType: riskModule.moduleType,
        relevance: riskModule.relevance,
        executionStatus: riskModule.executionStatus,
        evidenceSufficiency: riskModule.evidenceSufficiency,
        decisionUsability: riskModule.decisionUsability,
        nextAction: riskModule.nextAction,
        ownerRole: riskModule.ownerRole,
        determiningClaimIds: jsonText(riskModule.determiningClaimIds),
        notes: riskModule.notes,
      },
      update: {
        moduleName: riskModule.moduleName,
        moduleType: riskModule.moduleType,
        relevance: riskModule.relevance,
        executionStatus: riskModule.executionStatus,
        evidenceSufficiency: riskModule.evidenceSufficiency,
        decisionUsability: riskModule.decisionUsability,
        nextAction: riskModule.nextAction,
        ownerRole: riskModule.ownerRole,
        determiningClaimIds: jsonText(riskModule.determiningClaimIds),
        notes: riskModule.notes,
      },
    });
  }

  for (const scenario of fixture.economics) {
    await prisma.economicsScenario.upsert({
      where: { id: scenario.id },
      create: {
        id: scenario.id,
        researchRunId: runId,
        kind: scenario.kind,
        quantity: scenario.quantity,
        grossRevenue: scenario.grossRevenue,
        discount: null,
        netRevenue: scenario.netRevenue,
        currency: scenario.currency,
        supplierCost: scenario.supplierCost,
        packagingCost: null,
        domesticShipping: null,
        internationalShipping: scenario.internationalShipping,
        unlistedDutyAndClearance: null,
        paymentFee: null,
        refundReserve: null,
        chargebackReserve: null,
        defectAndReshipCost: null,
        otherVariableCost: null,
        landedCost: null,
        grossProfit: null,
        variableOperatingCost: null,
        cm1: null,
        cm1Margin: null,
        breakEvenCpa: null,
        breakEvenRoas: null,
        completenessStatus: scenario.completenessStatus,
        stopReason: "关键成本字段缺失，正式CM1、CPA和ROAS不可计算",
        missingFields: jsonText(scenario.missingFields),
        calculationVersion: "phase2a-v1",
      },
      update: {
        kind: scenario.kind,
        quantity: scenario.quantity,
        grossRevenue: scenario.grossRevenue,
        discount: null,
        netRevenue: scenario.netRevenue,
        currency: scenario.currency,
        supplierCost: scenario.supplierCost,
        packagingCost: null,
        domesticShipping: null,
        internationalShipping: scenario.internationalShipping,
        unlistedDutyAndClearance: null,
        paymentFee: null,
        refundReserve: null,
        chargebackReserve: null,
        defectAndReshipCost: null,
        otherVariableCost: null,
        landedCost: null,
        grossProfit: null,
        variableOperatingCost: null,
        cm1: null,
        cm1Margin: null,
        breakEvenCpa: null,
        breakEvenRoas: null,
        completenessStatus: scenario.completenessStatus,
        stopReason: "关键成本字段缺失，正式CM1、CPA和ROAS不可计算",
        missingFields: jsonText(scenario.missingFields),
        calculationVersion: "phase2a-v1",
      },
    });
  }

  await prisma.decision.upsert({
    where: { researchRunId: runId },
    create: {
      id: "decision-t21",
      researchRunId: runId,
      formalStatus: fixture.decision.formalStatus,
      applicableRunSpecId: fixture.decision.applicableRunSpecId,
      determiningClaimIds: jsonText(fixture.decision.determiningClaimIds),
      secondaryRisks: jsonText(fixture.decision.secondaryRisks),
      listingAllowed: fixture.decision.listingAllowed,
      adTestAllowed: fixture.decision.adTestAllowed,
      rationale: fixture.decision.rationale,
    },
    update: {
      formalStatus: fixture.decision.formalStatus,
      applicableRunSpecId: fixture.decision.applicableRunSpecId,
      determiningClaimIds: jsonText(fixture.decision.determiningClaimIds),
      secondaryRisks: jsonText(fixture.decision.secondaryRisks),
      listingAllowed: fixture.decision.listingAllowed,
      adTestAllowed: fixture.decision.adTestAllowed,
      rationale: fixture.decision.rationale,
    },
  });

  for (const item of fixture.missingData) {
    await prisma.missingDataItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        decisionId: "decision-t21",
        priority: item.priority,
        fieldCode: item.fieldCode,
        title: item.title,
        description: item.description,
        evidenceNeeded: item.evidenceNeeded,
        minimumCaptureScope: item.minimumCaptureScope,
        blockingArea: item.blockingArea,
        status: item.status,
        resolvedAt: null,
      },
      update: {
        priority: item.priority,
        fieldCode: item.fieldCode,
        title: item.title,
        description: item.description,
        evidenceNeeded: item.evidenceNeeded,
        minimumCaptureScope: item.minimumCaptureScope,
        blockingArea: item.blockingArea,
        status: item.status,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        status: "seeded",
        mode: "non_destructive_upsert",
        projectId: fixture.project.id,
        runId,
        sourceCount: fixture.sources.length,
        claimCount: fixture.claims.length,
        moduleCount: fixture.riskModules.length,
        formalStatus: fixture.decision.formalStatus,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
