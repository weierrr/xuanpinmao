#!/usr/bin/env python3
"""Deterministic T21 offer math and known-cost-floor calculations."""

from __future__ import annotations

import json
from decimal import Decimal, ROUND_HALF_UP


FX_CNY_PER_USD = Decimal("6.7766")
SINGLE_PLANNED_PRICE = Decimal("29.00")

OFFERS = (
    {"quantity": 1, "revenue_usd": Decimal("29.00"), "reference_usd": Decimal("49.00"), "logistics_quote_usd": Decimal("5.30")},
    {"quantity": 2, "revenue_usd": Decimal("49.30"), "reference_usd": Decimal("98.00"), "logistics_quote_usd": Decimal("8.30")},
    {"quantity": 3, "revenue_usd": Decimal("69.60"), "reference_usd": Decimal("147.00"), "logistics_quote_usd": Decimal("11.30")},
)

PROCUREMENT_SCENARIOS = (
    ("用户输入采购价（存在冲突，适用性未验证）", Decimal("18.00")),
    ("1688公开低价（具体SKU适用性未完整验证）", Decimal("21.00")),
    ("1688公开高价（具体SKU适用性未完整验证）", Decimal("24.00")),
)


def rounded(value: Decimal, places: str = "0.0001") -> Decimal:
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def number(value: Decimal, places: str = "0.0001") -> float:
    return float(rounded(value, places))


def build_result() -> dict:
    offer_rows = []
    for offer in OFFERS:
        quantity = Decimal(offer["quantity"])
        revenue = offer["revenue_usd"]
        reference = offer["reference_usd"]
        full_single_total = SINGLE_PLANNED_PRICE * quantity
        offer_rows.append(
            {
                "quantity": int(quantity),
                "revenue_usd": number(revenue, "0.01"),
                "reference_usd": number(reference, "0.01"),
                "price_per_unit_usd": number(revenue / quantity, "0.01"),
                "discount_vs_reference_pct": number((reference - revenue) / reference * 100, "0.01"),
                "discount_vs_planned_single_pct": number((full_single_total - revenue) / full_single_total * 100, "0.01"),
                "logistics_quote_usd": number(offer["logistics_quote_usd"], "0.01"),
            }
        )

    cost_rows = []
    for label, unit_cny in PROCUREMENT_SCENARIOS:
        for offer in OFFERS:
            quantity = Decimal(offer["quantity"])
            procurement_usd = unit_cny * quantity / FX_CNY_PER_USD
            known_cost_subtotal = procurement_usd + offer["logistics_quote_usd"]
            residual = offer["revenue_usd"] - known_cost_subtotal
            cost_rows.append(
                {
                    "scenario": label,
                    "unit_procurement_cny": number(unit_cny, "0.01"),
                    "quantity": int(quantity),
                    "procurement_usd": number(procurement_usd),
                    "quoted_logistics_usd": number(offer["logistics_quote_usd"], "0.01"),
                    "known_cost_subtotal_usd": number(known_cost_subtotal),
                    "revenue_less_known_costs_usd": number(residual),
                }
            )

    return {
        "fx": {
            "cny_per_usd": number(FX_CNY_PER_USD),
            "observation_date": "2026-07-10",
            "source": "Federal Reserve H.10 release dated 2026-07-13",
            "actual_settlement_rate_pending": True,
        },
        "offer_math": offer_rows,
        "known_cost_floor": cost_rows,
        "excluded_unknown_costs": [
            "包装成本",
            "国内运输",
            "DDP未包含的关税与清关",
            "支付手续费",
            "退款准备",
            "拒付准备",
            "瑕疵与补发成本",
            "其他单笔变动成本",
        ],
        "formal_unit_economics": {
            "landed_cost": None,
            "gross_profit": None,
            "cm1": None,
            "cm1_margin": None,
            "break_even_cpa": None,
            "break_even_roas": None,
            "status": "关键成本字段缺失，正式单位经济停止",
        },
    }


if __name__ == "__main__":
    print(json.dumps(build_result(), ensure_ascii=False, indent=2))
