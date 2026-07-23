#!/usr/bin/env python3
"""Regenerate data.json (and preview/data.json) from CSV files in data/."""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def read_csv(name: str) -> list[dict[str, str]]:
    path = DATA / name
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def fnum(v: str | None) -> float:
    if v is None or v == "":
        return 0.0
    return float(str(v).replace(",", ".").replace(" ", ""))


def short_date(iso: str) -> str:
    if not iso or "-" not in iso:
        return iso or ""
    parts = iso.split("-")
    if len(parts) >= 3:
        return f"{parts[2]}.{parts[1]}"
    return iso


def deadline_label(row: dict[str, str]) -> str:
    dtype = (row.get("deadline_type") or "").lower()
    raw = (row.get("deadline") or "").strip()
    if "еженед" in dtype and "пт" in dtype:
        return "пт"
    if "еженед" in dtype and "пн" in dtype:
        return "пн"
    if "еженед" in dtype:
        return "еженед."
    if "постоян" in dtype:
        return "пост."
    if raw:
        return short_date(raw)
    return dtype or "—"


# Compact task titles for mobile list (order matches data/08_tasks.csv)
TASK_LABELS = [
    "Рентабельность АО «Успех»",
    "Стратегия ЖК «Северный»",
    "НДС +2% · разногласия",
    "Доп. соглашения (НДС)",
    "Сокращение расходов",
    "ЖК «Солнце» · благоустр.",
    "Контракты 1С",
    "Материалы на балансе",
    "Договоры с субподрядчиками",
    "Папки с ответами · ВПР",
    "Претензионная работа",
    "Приказ · ответственность",
    "АО «Прут» · письмо",
    "ЖК «Берег» · справка",
]

SUPPLY_SHORT = {
    "Инженерное оборудование": "Инж. оборуд.",
    "Технологическое оборудование": "Тех. оборуд.",
    "Материалы": "Материалы",
    "Итого": "Итого",
}


def build() -> dict:
    card = read_csv("01_project_card.csv")[0]
    supply_rows = read_csv("05_supply.csv")
    finance_rows = read_csv("06_finance.csv")
    labor_rows = read_csv("04_labor.csv")
    risk_rows = read_csv("07_risks.csv")
    task_rows = read_csv("08_tasks.csv")

    supply_total = next(
        (fnum(r["completion_pct"]) for r in supply_rows if r["category"] == "Итого"),
        0,
    )

    supply = []
    for r in supply_rows:
        name = SUPPLY_SHORT.get(r["category"], r["category"])
        pct = fnum(r["completion_pct"])
        if pct <= 25:
            tone = "alert"
        elif pct >= 50 and name != "Итого":
            tone = "ok"
        else:
            tone = "default"
        supply.append({"name": name, "pct": pct, "tone": tone})

    fin_map = {
        "Стоимость договора": "Договор · млн",
        "Оплачено подрядчику": "Оплачено · млн",
        "Стоимость по лимитам": "Лимиты · млн",
    }
    finance = []
    for r in finance_rows:
        label = fin_map.get(r["metric"])
        if not label:
            continue
        finance.append(
            {
                "name": label,
                "plan": round(fnum(r["plan_mln"])),
                "fact": round(fnum(r["fact_mln"])),
            }
        )

    labor = []
    for r in labor_rows:
        metric = r["metric"]
        if "ИТР" in metric:
            name = "ИТР · чел."
        else:
            name = "Рабочие · чел."
        labor.append(
            {
                "name": name,
                "plan": round(fnum(r["plan"])),
                "fact": round(fnum(r["fact"])),
            }
        )

    # One compact row per unique problem_id (open / critical deadline)
    risks: list[dict] = []
    seen: set[str] = set()
    for r in risk_rows:
        pid = r["problem_id"]
        if pid in seen:
            continue
        seen.add(pid)
        if pid == "1":
            t = "Финансирование 489 / 1082"
            # prefer latest open deadline among rows with same id
            open_deadlines = [
                x["deadline"]
                for x in risk_rows
                if x["problem_id"] == pid and x.get("status") == "В работе" and x.get("deadline")
            ]
            m = short_date(max(open_deadlines) if open_deadlines else r["deadline"])
        else:
            t = "Неучтенный объём · ПСД"
            open_deadlines = [
                x["deadline"]
                for x in risk_rows
                if x["problem_id"] == pid and x.get("status") == "В работе" and x.get("deadline")
            ]
            m = short_date(min(open_deadlines) if open_deadlines else r["deadline"])
        risks.append({"t": t, "m": m})

    tasks = []
    for i, r in enumerate(task_rows):
        label = TASK_LABELS[i] if i < len(TASK_LABELS) else (r["task"][:42] + "…")
        tasks.append(
            {
                "t": label,
                "m": deadline_label(r),
                "status": r.get("status") or "В работе",
            }
        )

    end = card.get("directive_end") or card.get("contract_end") or ""
    end_lbl = short_date(end)
    if end and len(end) >= 4:
        end_lbl = f"{end[8:10]}.{end[5:7]}.{end[:4]}" if len(end) >= 10 else short_date(end)

    return {
        "project": {
            "name": card["object_name"],
            "meta": f"Генподряд · {card['gen_contractor']} · до {end_lbl}",
            "readiness_fact": fnum(card["readiness_fact_pct"]),
            "readiness_plan": fnum(card["readiness_plan_pct"]),
            "delta_pp": fnum(card["delta_readiness_pp"]),
            "contract_mln": round(fnum(card["contract_cost_mln"])),
            "paid_mln": round(
                next(
                    fnum(r["fact_mln"])
                    for r in finance_rows
                    if r["metric"] == "Оплачено подрядчику"
                )
            ),
            "workers_fact": round(fnum(card["workers_fact"])),
            "workers_plan": round(fnum(card["workers_plan"])),
            "supply_total_pct": supply_total,
        },
        "supply": supply,
        "finance": finance,
        "labor": labor,
        "risks": risks,
        "tasks": tasks,
    }


def main() -> None:
    payload = build()
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    targets = [ROOT / "data.json", ROOT / "preview" / "data.json"]
    for path in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
