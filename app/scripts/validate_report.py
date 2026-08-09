#!/usr/bin/env python3
"""Validate the deterministic structure and evidence integrity of T21 outputs."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

from unit_economics import build_result


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "tests" / "T21" / "output"
INSTRUCTION = ROOT / "instructions" / "项目指令_v1.4-8K.md"
INSTRUCTION_SHA256 = "8919b659f867284c2f2ffe0c8a5ff1098336cd424779d54d62eeff5083b45eb2"

REQUIRED_FILES = (
    "T21_report.md",
    "T21_report.html",
    "source_ledger.csv",
    "claim_evidence.csv",
    "validation.json",
    "missing_data.md",
)

SOURCE_HEADERS = (
    "source_id",
    "title",
    "url",
    "source_type",
    "evidence_carrier",
    "accessed_at",
    "access_status",
    "target_entity",
    "sku_or_variant",
    "market",
    "claim_ids",
    "notes",
)

CLAIM_HEADERS = (
    "claim_id",
    "atomic_claim",
    "data_nature",
    "source_id",
    "source_type",
    "evidence_carrier",
    "source_location",
    "link_specificity",
    "observed_at",
    "information_nature",
    "verification_status",
    "time_status",
    "runspec_applicability",
    "data_completeness",
    "decision_use",
    "confidence",
    "inference_basis",
    "missing_evidence",
    "notes",
)

ENUMS = {
    "source_type": {"官方来源", "平台数据/页面", "用户输入", "供应商声明", "第三方研究", "商业博客", "内部文件", "模型推断"},
    "link_specificity": {"具体原始页面", "保留查询条件的搜索结果页", "泛平台首页", "内部文件，无公开URL", "用户输入，无公开URL", "无原始链接，仅模型推断"},
    "information_nature": {"事实观察", "第三方估算", "模型推断", "未知"},
    "verification_status": {"已验证", "部分验证", "未验证", "不支持", "已否定", "存在冲突", "未知"},
    "time_status": {"当前有效", "临近失效", "已失效", "历史有效", "日期未知"},
    "runspec_applicability": {"适用", "部分适用", "不适用", "未知"},
    "data_completeness": {"完整", "部分完整", "关键字段缺失"},
    "decision_use": {"直接决策证据", "辅助决策证据", "不可作为决策依据"},
    "confidence": {"高", "中", "低"},
}

FORMAL_STATUSES = {
    "GO_TEST",
    "HOLD_DATA",
    "HOLD_RISK",
    "HOLD_ECON",
    "HOLD_SUPPLY",
    "HOLD_CONFLICT",
    "NO_GO_HARD_GATE",
    "NO_GO_ECON",
    "NO_GO_DEMAND",
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def parse_claim_ids(value: str) -> list[str]:
    return [claim_id.strip() for claim_id in value.split(";") if claim_id.strip()]


def rebuild_source_claims() -> dict[str, int]:
    source_path = OUTPUT / "source_ledger.csv"
    claim_path = OUTPUT / "claim_evidence.csv"
    source_headers, source_rows = read_csv(source_path)
    claim_headers, claim_rows = read_csv(claim_path)
    if source_headers != list(SOURCE_HEADERS) or claim_headers != list(CLAIM_HEADERS):
        raise ValueError("cannot rebuild mappings with invalid CSV headers")

    source_ids = [row["source_id"] for row in source_rows]
    if len(source_ids) != len(set(source_ids)):
        raise ValueError("cannot rebuild mappings with duplicate source IDs")

    claims_by_source: dict[str, list[str]] = {source_id: [] for source_id in source_ids}
    for row in claim_rows:
        source_id = row["source_id"]
        if source_id not in claims_by_source:
            raise ValueError(f"claim {row['claim_id']} references unknown source {source_id}")
        claims_by_source[source_id].append(row["claim_id"])

    for row in source_rows:
        row["claim_ids"] = ";".join(claims_by_source[row["source_id"]])

    temporary_path = source_path.with_suffix(".csv.tmp")
    with temporary_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SOURCE_HEADERS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(source_rows)
    temporary_path.replace(source_path)

    return {
        "source_count": len(source_rows),
        "claim_count": len(claim_rows),
        "mapped_source_count": sum(bool(claims_by_source[source_id]) for source_id in source_ids),
        "empty_source_count": sum(not claims_by_source[source_id] for source_id in source_ids),
    }


def audit_claim_source_mapping(
    source_rows: list[dict[str, str]], claim_rows: list[dict[str, str]]
) -> dict[str, object]:
    source_ids = {row.get("source_id", "") for row in source_rows}
    expected_pairs = {
        (row.get("source_id", ""), row.get("claim_id", "")) for row in claim_rows
    }
    actual_pairs = {
        (row.get("source_id", ""), claim_id)
        for row in source_rows
        for claim_id in parse_claim_ids(row.get("claim_ids", ""))
    }
    missing_pairs = expected_pairs - actual_pairs
    wrong_pairs = actual_pairs - expected_pairs
    unknown_source_claim_ids = sorted(
        row.get("claim_id", "")
        for row in claim_rows
        if row.get("source_id", "") not in source_ids
    )
    orphan_claim_ids = sorted(
        {claim_id for _, claim_id in missing_pairs} | set(unknown_source_claim_ids)
    )
    wrong_source_claim_ids = sorted(
        f"{source_id}:{claim_id}" for source_id, claim_id in wrong_pairs
    )
    mismatch_count = len(missing_pairs) + len(wrong_pairs)
    return {
        "claim_source_forward_reference_valid": not orphan_claim_ids,
        "claim_source_reverse_reference_valid": not wrong_source_claim_ids,
        "orphan_claim_ids": orphan_claim_ids,
        "wrong_source_claim_ids": wrong_source_claim_ids,
        "source_claim_mapping_mismatch_count": mismatch_count,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--rebuild-source-claims",
        action="store_true",
        help="rebuild source_ledger.csv claim_ids from claim_evidence.csv source_id values",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rebuild_result = rebuild_source_claims() if args.rebuild_source_claims else None
    errors: list[str] = []
    for name in REQUIRED_FILES:
        if not (OUTPUT / name).is_file():
            errors.append(f"missing output file: {name}")

    if errors:
        print(json.dumps({"status": "fail", "errors": errors}, ensure_ascii=False, indent=2))
        return 1

    instruction_hash = hashlib.sha256(INSTRUCTION.read_bytes()).hexdigest()
    if instruction_hash != INSTRUCTION_SHA256:
        errors.append("project instruction hash changed")

    report = (OUTPUT / "T21_report.md").read_text(encoding="utf-8")
    html = (OUTPUT / "T21_report.html").read_text(encoding="utf-8")
    missing_data = (OUTPUT / "missing_data.md").read_text(encoding="utf-8")

    module_rows = []
    for line in report.splitlines():
        if re.match(r"^\| M\d{2} ", line):
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            module_rows.append(cells)

    expected_modules = {f"M{i:02d}" for i in range(1, 16)}
    found_modules = {cells[0].split()[0] for cells in module_rows if cells}
    if len(module_rows) != 15 or found_modules != expected_modules:
        errors.append(f"module table invalid: rows={len(module_rows)}, ids={sorted(found_modules)}")

    relevance_counts: Counter[str] = Counter()
    execution_counts: Counter[str] = Counter()
    evidence_counts: Counter[str] = Counter()
    decision_counts: Counter[str] = Counter()
    for cells in module_rows:
        if len(cells) != 8:
            errors.append(f"module row has {len(cells)} cells: {cells[0] if cells else 'unknown'}")
            continue
        relevance_counts[cells[1]] += 1
        execution_counts[cells[2]] += 1
        evidence_counts[cells[3]] += 1
        decision_counts[cells[4]] += 1
        if cells[1] == "不相关" and cells[2] != "不适用":
            errors.append(f"irrelevant module not marked inapplicable: {cells[0]}")

    status_match = re.search(r"正式主状态：\*\*(%s)\*\*" % "|".join(sorted(FORMAL_STATUSES)), report)
    formal_status = status_match.group(1) if status_match else ""
    if formal_status != "HOLD_SUPPLY":
        errors.append(f"unexpected formal status: {formal_status or 'missing'}")
    if f'data-formal-status="{formal_status}"' not in html:
        errors.append("HTML formal status differs from Markdown")

    source_headers, source_rows = read_csv(OUTPUT / "source_ledger.csv")
    if source_headers != list(SOURCE_HEADERS):
        errors.append("source ledger headers invalid")
    source_ids = {row.get("source_id", "") for row in source_rows}
    if len(source_ids) != len(source_rows):
        errors.append("source ledger contains duplicate source IDs")
    for row_number, row in enumerate(source_rows, start=2):
        for field in SOURCE_HEADERS:
            if field == "claim_ids":
                continue
            if not row.get(field, "").strip():
                errors.append(f"source ledger blank field at row {row_number}: {field}")
        if row.get("source_type") not in ENUMS["source_type"]:
            errors.append(f"source ledger source_type invalid at row {row_number}")

    claim_headers, claim_rows = read_csv(OUTPUT / "claim_evidence.csv")
    if claim_headers != list(CLAIM_HEADERS):
        errors.append("claim evidence headers invalid")
    claim_ids: set[str] = set()
    for row_number, row in enumerate(claim_rows, start=2):
        claim_id = row.get("claim_id", "")
        if claim_id in claim_ids:
            errors.append(f"duplicate claim id: {claim_id}")
        claim_ids.add(claim_id)
        for field in CLAIM_HEADERS:
            if not row.get(field, "").strip():
                errors.append(f"claim evidence blank field at row {row_number}: {field}")
        if row.get("source_id") not in source_ids:
            errors.append(f"unknown source_id at claim row {row_number}: {row.get('source_id')}")
        for field, allowed in ENUMS.items():
            if row.get(field) not in allowed:
                errors.append(f"invalid {field} at claim row {row_number}: {row.get(field)}")
        if row.get("information_nature") == "模型推断":
            if row.get("confidence") != "低" or row.get("decision_use") != "不可作为决策依据":
                errors.append(f"model inference metadata invalid at claim row {row_number}")

    mapping_audit = audit_claim_source_mapping(source_rows, claim_rows)
    mapping_integrity = (
        mapping_audit["claim_source_forward_reference_valid"]
        and mapping_audit["claim_source_reverse_reference_valid"]
        and mapping_audit["source_claim_mapping_mismatch_count"] == 0
    )
    if not mapping_audit["claim_source_forward_reference_valid"]:
        errors.append(
            f"orphan claim IDs: {mapping_audit['orphan_claim_ids']}"
        )
    if not mapping_audit["claim_source_reverse_reference_valid"]:
        errors.append(
            f"wrong source claim IDs: {mapping_audit['wrong_source_claim_ids']}"
        )
    if mapping_audit["source_claim_mapping_mismatch_count"] != 0:
        errors.append(
            "source claim mapping mismatch count: "
            f"{mapping_audit['source_claim_mapping_mismatch_count']}"
        )

    if len(source_rows) != 25:
        errors.append(f"unexpected source count: {len(source_rows)}")
    if len(claim_rows) != 77:
        errors.append(f"unexpected claim count: {len(claim_rows)}")

    claims_by_id = {row.get("claim_id", ""): row for row in claim_rows}
    expected_c073 = {
        "information_nature": "事实观察",
        "verification_status": "已验证",
        "runspec_applicability": "适用",
        "data_completeness": "关键字段缺失",
        "decision_use": "直接决策证据",
        "confidence": "高",
    }
    c073 = claims_by_id.get("C073", {})
    for field, expected in expected_c073.items():
        if c073.get(field) != expected:
            errors.append(f"C073 metadata invalid for {field}: {c073.get(field)!r}")

    for claim_id in ("C013", "C014", "C033", "C036"):
        if claims_by_id.get(claim_id, {}).get("verification_status") == "存在冲突":
            errors.append(f"unproven conflict status retained for {claim_id}")

    replacement_count = sum(
        path.read_text(encoding="utf-8").count("\ufffd")
        for path in OUTPUT.iterdir()
        if path.is_file() and path.suffix in {".md", ".html", ".csv", ".json"}
    )
    if replacement_count:
        errors.append(f"unicode replacement characters found: {replacement_count}")

    calculations = build_result()
    if calculations["formal_unit_economics"]["cm1"] is not None:
        errors.append("formal CM1 must remain null")
    if len(calculations["offer_math"]) != 3 or len(calculations["known_cost_floor"]) != 9:
        errors.append("deterministic calculation row count invalid")

    validation = json.loads((OUTPUT / "validation.json").read_text(encoding="utf-8"))
    expected_module_counts = {
        "module_type": {"baseline": 6, "conditional": 9},
        "relevance": dict(relevance_counts),
        "execution": dict(execution_counts),
        "evidence_sufficiency": dict(evidence_counts),
        "decision_usability": dict(decision_counts),
    }
    if validation.get("module_counts") != expected_module_counts:
        errors.append("validation.json module_counts do not match the report")
    if "required_fields_missing" in validation:
        errors.append("validation.json retains ambiguous required_fields_missing field")
    expected_validation = {
        "module_count": 15,
        "module_count_valid": True,
        "claim_source_integrity": "pass" if mapping_integrity else "fail",
        "claim_source_forward_reference_valid": mapping_audit[
            "claim_source_forward_reference_valid"
        ],
        "claim_source_reverse_reference_valid": mapping_audit[
            "claim_source_reverse_reference_valid"
        ],
        "orphan_claim_ids": mapping_audit["orphan_claim_ids"],
        "wrong_source_claim_ids": mapping_audit["wrong_source_claim_ids"],
        "source_claim_mapping_mismatch_count": mapping_audit[
            "source_claim_mapping_mismatch_count"
        ],
        "report_required_fields_missing": [],
        "c073_metadata_valid": True,
        "conflict_definition_valid": True,
        "unit_economics_valid": True,
        "formal_status": "HOLD_SUPPLY",
        "status_supported_by_evidence": True,
        "competitor_data_migration_found": False,
        "unsupported_estimation_found": False,
        "unicode_replacement_characters": 0,
    }
    for field, expected in expected_validation.items():
        if validation.get(field) != expected:
            errors.append(f"validation.json mismatch for {field}: {validation.get(field)!r}")

    if "¥18对应SKU及报价有效期" not in missing_data or "DDP包含项" not in missing_data:
        errors.append("missing_data.md lacks highest-priority evidence gaps")

    result = {
        "status": "pass" if not errors else "fail",
        "errors": errors,
        "module_count": len(module_rows),
        "relevance_counts": dict(relevance_counts),
        "execution_counts": dict(execution_counts),
        "evidence_counts": dict(evidence_counts),
        "decision_counts": dict(decision_counts),
        "source_count": len(source_rows),
        "claim_count": len(claim_rows),
        "formal_status": formal_status,
        "unicode_replacement_characters": replacement_count,
        "instruction_sha256": instruction_hash,
    }
    if rebuild_result is not None:
        result["source_claim_rebuild"] = rebuild_result
    result["claim_source_integrity"] = "pass" if mapping_integrity else "fail"
    result.update(mapping_audit)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
