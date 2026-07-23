#!/usr/bin/env python3
"""Regenerate data.json (and preview/data.json) from CSV files in data/."""

from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# Plausible explanations for overdue / failed tasks (status «Не исполнено»)
TASK_EXPLANATIONS = {
    "Письмо в АО «Прут» по оценке совместной работы": (
        "Ответ АО «Прут» не получен в согласованный срок; повторный запрос направлен, "
        "оценка совместной работы задерживается на стороне контрагента."
    ),
}


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


def full_date_lbl(iso: str) -> str:
    if iso and len(iso) >= 10:
        return f"{iso[8:10]}.{iso[5:7]}.{iso[:4]}"
    return short_date(iso)


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

RISK_LABELS = {
    ("1", "2026-01-13"): "Финансирование · доведено 489",
    ("1", "2026-01-20"): "Финансирование · доп. соглашение",
    ("1", "2026-01-24"): "Финансирование · остаток 586 млн",
    ("2", "2026-01-15"): "Неучтенный объём · ПСД",
    ("2", "2026-02-15"): "Неучтенный объём · согласование",
    ("2", "2026-02-28"): "Неучтенный объём · лимиты",
}

SUPPLY_SHORT = {
    "Инженерное оборудование": "Инж. оборуд.",
    "Технологическое оборудование": "Тех. оборуд.",
    "Материалы": "Материалы",
    "Итого": "Итого",
}


def compute_smr_days(start_iso: str, end_iso: str, readiness: float, as_of: date | None = None) -> dict:
    as_of = as_of or date.today()
    y, m, d = (int(x) for x in start_iso.split("-"))
    start = date(y, m, d)
    y2, m2, d2 = (int(x) for x in end_iso.split("-"))
    end = date(y2, m2, d2)
    total = max(1, (end - start).days)
    elapsed = max(0, (as_of - start).days)
    remaining = max(0, (end - as_of).days)
    time_pct = round(100.0 * elapsed / total, 2)
    alert = time_pct - readiness > 10
    return {
        "elapsed": elapsed,
        "total": total,
        "remaining": remaining,
        "readinessPct": readiness,
        "timePct": time_pct,
        "alert": alert,
        "start": start_iso,
        "end": end_iso,
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

    risks: list[dict] = []
    for r in risk_rows:
        pid = r["problem_id"]
        dl = r.get("deadline") or ""
        label = RISK_LABELS.get((pid, dl))
        if not label:
            label = (r.get("solution") or r.get("problem") or "Риск")[:40]
        risks.append(
            {
                "t": label,
                "problem": r.get("problem") or "",
                "impact": r.get("impact") or "",
                "risk_level": r.get("risk_level") or "",
                "solution": r.get("solution") or "",
                "owner": r.get("owner") or "",
                "deadline": dl,
                "m": short_date(dl),
                "status": r.get("status") or "В работе",
            }
        )

    tasks = []
    for i, r in enumerate(task_rows):
        label = TASK_LABELS[i] if i < len(TASK_LABELS) else (r["task"][:42] + "…")
        status = r.get("status") or "В работе"
        full_task = r.get("task") or ""
        explanation = ""
        if status == "Не исполнено":
            explanation = TASK_EXPLANATIONS.get(full_task, "")
            if not explanation:
                explanation = (
                    "Срок просрочен; причина уточняется у ответственного, "
                    "повторный контроль поставлен в план."
                )
        tasks.append(
            {
                "t": label,
                "description": full_task,
                "responsible": r.get("responsible") or "",
                "explanation": explanation,
                "m": deadline_label(r),
                "deadline": (r.get("deadline") or "").strip(),
                "deadline_type": r.get("deadline_type") or "",
                "status": status,
                "block": r.get("block") or "",
            }
        )

    end = card.get("directive_end") or card.get("contract_end") or ""
    end_lbl = full_date_lbl(end)
    start = card.get("start_date") or "2019-06-05"
    readiness = fnum(card["readiness_fact_pct"])
    smr_days = compute_smr_days(start, end or "2027-06-30", readiness)

    return {
        "project": {
            "name": card["object_name"],
            "meta": f"Генподряд · {card['gen_contractor']} · срок до {end_lbl}",
            "readiness_fact": readiness,
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
            "start_date": start,
            "directive_end": end,
        },
        "smrDays": smr_days,
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
