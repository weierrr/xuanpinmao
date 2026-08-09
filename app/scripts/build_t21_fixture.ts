import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimRecord, RiskModuleRecord, SourceRecord } from "../src/domain/types";
import { attachDerivedClaimIds } from "../src/domain/claim-source";

const root = process.cwd();
const outputDir = path.join(root, "fixtures", "T21");

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
};

const readCsv = async (relativePath: string): Promise<Record<string, string>[]> => {
  const raw = await readFile(path.join(root, relativePath), "utf8");
  const [headerLine, ...lines] = raw.trim().split(/\r?\n/);
  if (!headerLine) {
    throw new Error(`empty csv: ${relativePath}`);
  }
  const headers = splitCsvLine(headerLine);
  return lines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
};

const nullable = (value: string): string | null => (value.trim() === "" ? null : value);

const buildSources = async (): Promise<SourceRecord[]> => {
  const rows = await readCsv("tests/T21/output/source_ledger.csv");
  return rows.map((row) => ({
    id: row.source_id,
    title: row.title,
    url: row.url,
    sourceType: row.source_type,
    evidenceCarrier: row.evidence_carrier,
    accessedAt: row.accessed_at,
    accessStatus: row.access_status,
    targetEntity: row.target_entity,
    skuOrVariant: nullable(row.sku_or_variant),
    market: nullable(row.market),
    notes: nullable(row.notes),
  }));
};

const buildClaims = async (): Promise<ClaimRecord[]> => {
  const rows = await readCsv("tests/T21/output/claim_evidence.csv");
  return rows.map((row) => ({
    id: row.claim_id,
    atomicClaim: row.atomic_claim,
    dataNature: row.data_nature,
    sourceId: row.source_id,
    sourceType: row.source_type,
    evidenceCarrier: row.evidence_carrier,
    sourceLocation: row.source_location,
    linkSpecificity: row.link_specificity,
    observedAt: row.observed_at,
    informationNature: row.information_nature,
    verificationStatus: row.verification_status,
    timeStatus: row.time_status,
    runSpecApplicability: row.runspec_applicability,
    dataCompleteness: row.data_completeness,
    decisionUse: row.decision_use,
    confidence: row.confidence,
    inferenceBasis: row.inference_basis,
    missingEvidence: row.missing_evidence,
    notes: nullable(row.notes),
  }));
};

const riskModules: RiskModuleRecord[] = [
  {
    moduleCode: "M01",
    moduleName: "商品身份与RunSpec",
    moduleType: "baseline",
    relevance: "基线相关",
    executionStatus: "已完成",
    evidenceSufficiency: "部分充分",
    decisionUsability: "仅可有限使用",
    nextAction: "补充证据",
    ownerRole: "主责",
    determiningClaimIds: ["C001", "C002", "C003", "C004"],
    notes: "实体已分离但最终销售SKU和颜色未锁定",
  },
  {
    moduleCode: "M02",
    moduleName: "基础产品安全",
    moduleType: "baseline",
    relevance: "基线相关",
    executionStatus: "已完成",
    evidenceSufficiency: "不足",
    decisionUsability: "不可使用",
    nextAction: "补充证据",
    ownerRole: "主责",
    determiningClaimIds: ["C053", "C054", "C058"],
    notes: "标签护理和阻燃适用证据未取得",
  },
  {
    moduleCode: "M03",
    moduleName: "供应链报价与履约",
    moduleType: "baseline",
    relevance: "基线相关",
    executionStatus: "已完成",
    evidenceSufficiency: "不足",
    decisionUsability: "不可使用",
    nextAction: "补充证据",
    ownerRole: "主责",
    determiningClaimIds: ["C013", "C022", "C033", "C034", "C073"],
    notes: "报价关系、SKU重量口径、MOQ、主体和DDP均未收口",
  },
  {
    moduleCode: "M04",
    moduleName: "单位经济",
    moduleType: "baseline",
    relevance: "基线相关",
    executionStatus: "已完成",
    evidenceSufficiency: "部分充分",
    decisionUsability: "仅可有限使用",
    nextAction: "补充证据",
    ownerRole: "主责",
    determiningClaimIds: ["C064", "C065", "C066", "C069", "C073"],
    notes: "Offer和已知成本小计完成；正式CM1停止",
  },
  {
    moduleCode: "M05",
    moduleName: "一般质量与退货风险",
    moduleType: "baseline",
    relevance: "基线相关",
    executionStatus: "已完成",
    evidenceSufficiency: "部分充分",
    decisionUsability: "仅可有限使用",
    nextAction: "补充证据",
    ownerRole: "主责",
    determiningClaimIds: ["C041", "C042", "C043"],
    notes: "已识别卷边薄透尺码和穿脱风险；无目标样品数据",
  },
  {
    moduleCode: "M06",
    moduleName: "知识产权快速筛查",
    moduleType: "baseline",
    relevance: "基线相关",
    executionStatus: "已完成",
    evidenceSufficiency: "部分充分",
    decisionUsability: "仅可有限使用",
    nextAction: "获取适用证据",
    ownerRole: "主责",
    determiningClaimIds: ["C061", "C062"],
    notes: "有效专利线索存在；未做商标图片和权利要求清查",
  },
  {
    moduleCode: "M07",
    moduleName: "材料与成分",
    moduleType: "conditional",
    relevance: "条件触发",
    executionStatus: "已完成",
    evidenceSufficiency: "部分充分",
    decisionUsability: "仅可有限使用",
    nextAction: "补充证据",
    ownerRole: "主责",
    determiningClaimIds: ["C027", "C055"],
    notes: "供应商声明锦纶或尼龙但无比例和报告",
  },
  {
    moduleCode: "M08",
    moduleName: "电气电池与发热",
    moduleType: "conditional",
    relevance: "不相关",
    executionStatus: "不适用",
    evidenceSufficiency: "不适用",
    decisionUsability: "不适用",
    nextAction: "不适用",
    ownerRole: "不适用",
    determiningClaimIds: [],
    notes: "当前RunSpec为普通纺织短袖上衣",
  },
  {
    moduleCode: "M09",
    moduleName: "儿童使用与小部件",
    moduleType: "conditional",
    relevance: "不相关",
    executionStatus: "不适用",
    evidenceSufficiency: "不适用",
    decisionUsability: "不适用",
    nextAction: "不适用",
    ownerRole: "不适用",
    determiningClaimIds: [],
    notes: "当前目标用户为成年女性",
  },
  {
    moduleCode: "M10",
    moduleName: "食品或口腔接触",
    moduleType: "conditional",
    relevance: "不相关",
    executionStatus: "不适用",
    evidenceSufficiency: "不适用",
    decisionUsability: "不适用",
    nextAction: "不适用",
    ownerRole: "不适用",
    determiningClaimIds: [],
    notes: "当前用途不涉及食品或口腔",
  },
  {
    moduleCode: "M11",
    moduleName: "皮肤黏膜或动物体表接触",
    moduleType: "conditional",
    relevance: "条件触发",
    executionStatus: "已完成",
    evidenceSufficiency: "不足",
    decisionUsability: "不可使用",
    nextAction: "补充证据",
    ownerRole: "主责",
    determiningClaimIds: ["C055", "C056", "C057"],
    notes: "紧身直接皮肤接触且成分色牢度刺激证据不足",
  },
  {
    moduleCode: "M12",
    moduleName: "液体粉末气雾磁性等物流属性",
    moduleType: "conditional",
    relevance: "不相关",
    executionStatus: "不适用",
    evidenceSufficiency: "不适用",
    decisionUsability: "不适用",
    nextAction: "不适用",
    ownerRole: "不适用",
    determiningClaimIds: [],
    notes: "当前商品形态未出现这些属性",
  },
  {
    moduleCode: "M13",
    moduleName: "功效治疗安全和绝对化宣传",
    moduleType: "conditional",
    relevance: "条件触发",
    executionStatus: "已完成",
    evidenceSufficiency: "不足",
    decisionUsability: "不可使用",
    nextAction: "补充证据",
    ownerRole: "主责",
    determiningClaimIds: ["C050", "C051", "C052", "C058"],
    notes: "姿态脊柱背部紧张长期改善和绝对舒适均禁用",
  },
  {
    moduleCode: "M14",
    moduleName: "兼容替代授权与专项IP",
    moduleType: "conditional",
    relevance: "不相关",
    executionStatus: "不适用",
    evidenceSufficiency: "不适用",
    decisionUsability: "不适用",
    nextAction: "不适用",
    ownerRole: "不适用",
    determiningClaimIds: [],
    notes: "当前没有兼容替代或授权关系声明",
  },
  {
    moduleCode: "M15",
    moduleName: "实体SKU变体主体市场时间与证据适用性",
    moduleType: "conditional",
    relevance: "不相关",
    executionStatus: "不适用",
    evidenceSufficiency: "不适用",
    decisionUsability: "不适用",
    nextAction: "不适用",
    ownerRole: "不适用",
    determiningClaimIds: [],
    notes: "未证明发生SKU主体时间或证据归属错配；普通缺字段由M03处理",
  },
];

const writeJson = async (fileName: string, value: unknown): Promise<void> => {
  await writeFile(path.join(outputDir, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async (): Promise<void> => {
  await mkdir(outputDir, { recursive: true });
  const sources = await buildSources();
  const claims = await buildClaims();
  const validationRaw = await readFile(path.join(root, "tests/T21/output/validation.json"), "utf8");
  const validation = JSON.parse(validationRaw) as Record<string, unknown>;
  const missingData = [
    {
      id: "MD-P0-01",
      priority: "P0",
      fieldCode: "supplier_quote_sku_validity",
      title: "¥18对应SKU及报价有效期",
      description: "用户输入¥18未绑定供应商主体、offerId、SKU、MOQ、含税口径和有效期。",
      evidenceNeeded: "供应商可追溯书面报价。",
      minimumCaptureScope: "价格与SKU联动区域、阶梯/MOQ、报价日期或有效期。",
      blockingArea: "供应链报价",
      status: "open",
    },
    {
      id: "MD-P0-02",
      priority: "P0",
      fieldCode: "weight_basis",
      title: "215g与230g重量口径",
      description: "两组重量未证明同一SKU、颜色、尺码、时间和重量类型。",
      evidenceNeeded: "同一目标SKU的裸衣净重、装袋毛重和计费重记录。",
      minimumCaptureScope: "SKU选择状态、对应重量字段、同一件样品称重照片。",
      blockingArea: "供应链履约",
      status: "open",
    },
    {
      id: "MD-P0-03",
      priority: "P0",
      fieldCode: "ddp_inclusions",
      title: "DDP包含项",
      description: "1/2/3件物流报价缺少承运商、路线、计费重、DDP包含/排除项和有效期。",
      evidenceNeeded: "正式物流报价单。",
      minimumCaptureScope: "报价金额、路线/邮编、计费重、DDP包含/排除项、有效期。",
      blockingArea: "供应链履约",
      status: "open",
    },
  ];

  await writeJson("project.json", {
    id: "project-t21-fixture",
    name: "T21 女士塑形压缩短袖上衣",
    mode: "candidate_diligence",
    targetMarket: "US",
    status: "active",
    dataOrigin: "fixture",
  });
  await writeJson("runspec.json", {
    id: "runspec-t21-v1",
    projectId: "project-t21-fixture",
    version: 1,
    isCurrent: true,
    productName: "女士塑形压缩短袖上衣",
    productUrl: "https://detail.1688.com/offer/976047440170.html?offerId=976047440170",
    sku: null,
    variant: "S-3XL，颜色未锁定",
    packageSpec: "25x30袋装待确认",
    targetCountry: "US",
    targetUser: "成年女性",
    salePrice: 29,
    saleCurrency: "USD",
    offer: "1件$29，2件$49.30，3件$69.60",
    acquisitionChannel: "Meta Ads / 独立站测试",
    fulfillmentMode: "跨境小包或DDP待确认",
    supplierCost: 18,
    packagingCost: null,
    domesticShipping: null,
    internationalShipping: null,
    testBudget: null,
    prohibitedConditions: ["不得发布Listing", "不得启动广告测试"],
    completenessStatus: "关键供应链字段缺失",
  });
  await writeJson("entities.json", [
    {
      id: "entity-target-product",
      projectId: "project-t21-fixture",
      type: "target_product",
      name: "目标女士塑形压缩短袖上衣",
      url: "https://detail.1688.com/offer/976047440170.html?offerId=976047440170",
      sku: null,
      variant: "S-3XL，颜色未锁定",
      market: "US",
      relationship: "target",
    },
    {
      id: "entity-supplier",
      projectId: "project-t21-fixture",
      type: "supplier",
      name: "1688目标供应商商品页",
      url: "https://detail.1688.com/offer/976047440170.html?offerId=976047440170",
      sku: "offerId=976047440170",
      variant: null,
      market: "CN",
      relationship: "supplier_page_observation",
    },
  ]);
  await writeJson("sources.json", sources);
  await writeJson("source_ledger_derived.json", attachDerivedClaimIds(sources, claims));
  await writeJson("claims.json", claims);
  await writeJson("risk_modules.json", riskModules);
  await writeJson("economics.json", [
    {
      id: "econ-single",
      kind: "single",
      quantity: 1,
      grossRevenue: 29,
      netRevenue: 29,
      currency: "USD",
      supplierCost: 2.6562,
      internationalShipping: 5.3,
      cm1: null,
      breakEvenCpa: null,
      breakEvenRoas: null,
      completenessStatus: "formal_unit_economics_incomplete",
      missingFields: [
        "packaging",
        "domesticShipping",
        "ddpInclusions",
        "paymentFee",
        "refundReserve",
        "chargebackReserve",
        "defectAndReship",
      ],
    },
    {
      id: "econ-bundle-2",
      kind: "bundle_2",
      quantity: 2,
      grossRevenue: 49.3,
      netRevenue: 49.3,
      currency: "USD",
      supplierCost: 5.3124,
      internationalShipping: 8.3,
      cm1: null,
      breakEvenCpa: null,
      breakEvenRoas: null,
      completenessStatus: "formal_unit_economics_incomplete",
      missingFields: [
        "packaging",
        "domesticShipping",
        "ddpInclusions",
        "paymentFee",
        "refundReserve",
        "chargebackReserve",
        "defectAndReship",
      ],
    },
    {
      id: "econ-bundle-3",
      kind: "bundle_3",
      quantity: 3,
      grossRevenue: 69.6,
      netRevenue: 69.6,
      currency: "USD",
      supplierCost: 7.9686,
      internationalShipping: 11.3,
      cm1: null,
      breakEvenCpa: null,
      breakEvenRoas: null,
      completenessStatus: "formal_unit_economics_incomplete",
      missingFields: [
        "packaging",
        "domesticShipping",
        "ddpInclusions",
        "paymentFee",
        "refundReserve",
        "chargebackReserve",
        "defectAndReship",
      ],
    },
  ]);
  await writeJson("decision.json", {
    formalStatus: "HOLD_SUPPLY",
    listingAllowed: false,
    adTestAllowed: false,
    applicableRunSpecId: "runspec-t21-v1",
    determiningClaimIds: ["C013", "C022", "C033", "C034", "C073"],
    secondaryRisks: ["材料成分", "尺码质量", "Claim合规", "知识产权", "正式单位经济"],
    rationale: "供应商报价、SKU映射、MOQ、重量口径、供应商主体和DDP适用性未收口，当前RunSpec不可采购、不可发布Listing、不可启动广告。",
  });
  await writeJson("validation.json", {
    run_id: validation.run_id,
    source_count: validation.source_count,
    claim_count: validation.claim_count,
    module_count: validation.module_count,
    formal_status: validation.formal_status,
    listing_allowed: validation.listing_allowed,
    ad_test_allowed: validation.ad_test_allowed,
    unicode_replacement_characters: validation.unicode_replacement_characters,
    claim_source_forward_reference_valid: validation.claim_source_forward_reference_valid,
    claim_source_reverse_reference_valid: validation.claim_source_reverse_reference_valid,
    source_claim_mapping_mismatch_count: validation.source_claim_mapping_mismatch_count,
    report_required_fields_missing: validation.report_required_fields_missing,
    business_critical_missing: validation.business_critical_missing,
  });
  await writeJson("missing_data.json", missingData);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
