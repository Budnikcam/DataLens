/**
 * DataLens — Google Sheets → dashboard JSON
 *
 * Sheet tabs (headers match data/*.csv):
 *   project_card, kpi_summary, smr, labor, supply, finance, risks, tasks
 *
 * Optional columns on tasks/risks: title (or t), explanation, m
 *
 * Deploy:
 *   1. Open the spreadsheet → Extensions → Apps Script
 *   2. Replace Code.gs with this file → Save
 *   3. Deploy → New deployment → Web app
 *      Execute as: Me · Who has access: Anyone
 *   4. Copy the /exec URL into the editor field
 *      «URL веб-приложения Google (Apps Script)» → Save to site
 *      (writes data.json sources.sheetsApiUrl)
 *
 * CORS: plain JSON for server/Action; JSONP (?callback=name) for browsers
 * when Google's redirect blocks Access-Control-Allow-Origin.
 */

var SHEET_NAMES = {
  project: "project_card",
  kpi: "kpi_summary",
  smr: "smr",
  labor: "labor",
  supply: "supply",
  finance: "finance",
  risks: "risks",
  tasks: "tasks"
};

var SUPPLY_SHORT = {
  "Инженерное оборудование": "Инж. оборуд.",
  "Технологическое оборудование": "Тех. оборуд.",
  Материалы: "Материалы",
  Итого: "Итого"
};

var FIN_MAP = {
  "Стоимость договора": "Договор · млн",
  "Стоимость по лимитам": "Лимиты · млн",
  "Оплачено подрядчику": "Оплачено · млн"
};

function doGet(e) {
  try {
    var payload = buildDashboardJson();
    var callback = e && e.parameter && e.parameter.callback;
    if (callback && /^[A-Za-z_$][\w$]*$/.test(String(callback))) {
      return ContentService.createTextOutput(
        callback + "(" + JSON.stringify(payload) + ");"
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    var errObj = {
      ok: false,
      error: String(err && err.message ? err.message : err)
    };
    var cb = e && e.parameter && e.parameter.callback;
    if (cb && /^[A-Za-z_$][\w$]*$/.test(String(cb))) {
      return ContentService.createTextOutput(
        cb + "(" + JSON.stringify(errObj) + ");"
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(errObj)).setMimeType(
      ContentService.MimeType.JSON
    );
  }
}

function doOptions() {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

function buildDashboardJson() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cardRows = sheetToObjects_(ss, SHEET_NAMES.project);
  if (!cardRows.length) {
    throw new Error('Лист "' + SHEET_NAMES.project + '" пуст или не найден');
  }
  var card = cardRows[0];
  var supplyRows = sheetToObjects_(ss, SHEET_NAMES.supply);
  var financeRows = sheetToObjects_(ss, SHEET_NAMES.finance);
  var laborRows = sheetToObjects_(ss, SHEET_NAMES.labor);
  var riskRows = sheetToObjects_(ss, SHEET_NAMES.risks);
  var taskRows = sheetToObjects_(ss, SHEET_NAMES.tasks);

  var supplyTotal = 0;
  var supply = [];
  for (var i = 0; i < supplyRows.length; i++) {
    var sr = supplyRows[i];
    var cat = str_(sr.category || sr.name);
    var pct = num_(sr.completion_pct != null && sr.completion_pct !== "" ? sr.completion_pct : sr.pct);
    if (cat === "Итого") supplyTotal = pct;
    var shortName = SUPPLY_SHORT[cat] || cat;
    var tone = "default";
    if (pct <= 25) tone = "alert";
    else if (pct >= 50 && shortName !== "Итого") tone = "ok";
    supply.push({ name: shortName, pct: pct, tone: tone });
  }

  var finance = [];
  var paidMln = 0;
  for (var fi = 0; fi < financeRows.length; fi++) {
    var fr = financeRows[fi];
    var metric = str_(fr.metric || fr.name);
    if (metric === "Оплачено подрядчику") {
      paidMln = Math.round(num_(fr.fact_mln != null && fr.fact_mln !== "" ? fr.fact_mln : fr.fact));
    }
    var label = FIN_MAP[metric];
    if (!label) continue;
    finance.push({
      name: label,
      plan: Math.round(num_(fr.plan_mln != null && fr.plan_mln !== "" ? fr.plan_mln : fr.plan)),
      fact: Math.round(num_(fr.fact_mln != null && fr.fact_mln !== "" ? fr.fact_mln : fr.fact))
    });
  }

  var labor = [];
  for (var li = 0; li < laborRows.length; li++) {
    var lr = laborRows[li];
    var m = str_(lr.metric || lr.name);
    labor.push({
      name: m.indexOf("ИТР") >= 0 ? "ИТР · чел." : "Рабочие · чел.",
      plan: Math.round(num_(lr.plan)),
      fact: Math.round(num_(lr.fact))
    });
  }

  var risks = [];
  for (var ri = 0; ri < riskRows.length; ri++) {
    var rr = riskRows[ri];
    var dl = normalizeDate_(rr.deadline);
    var title =
      str_(rr.title || rr.t) ||
      truncate_(str_(rr.solution || rr.problem || "Риск"), 42);
    risks.push({
      t: title,
      problem: str_(rr.problem),
      impact: str_(rr.impact),
      risk_level: str_(rr.risk_level),
      solution: str_(rr.solution),
      owner: str_(rr.owner),
      deadline: dl,
      m: str_(rr.m) || shortDate_(dl),
      status: str_(rr.status) || "В работе"
    });
  }

  var tasks = [];
  for (var ti = 0; ti < taskRows.length; ti++) {
    var tr = taskRows[ti];
    var full = str_(tr.task || tr.description);
    var status = str_(tr.status) || "В работе";
    var explanation = str_(tr.explanation);
    if (!explanation && status === "Не исполнено") {
      explanation =
        "Срок просрочен; причина уточняется у ответственного, повторный контроль поставлен в план.";
    }
    var tLabel = str_(tr.title || tr.t) || truncate_(full, 42);
    var deadline = normalizeDate_(tr.deadline);
    tasks.push({
      t: tLabel,
      description: full,
      responsible: str_(tr.responsible),
      explanation: explanation,
      m: str_(tr.m) || deadlineLabel_(tr),
      deadline: deadline,
      deadline_type: str_(tr.deadline_type),
      status: status,
      block: str_(tr.block)
    });
  }

  var start = normalizeDate_(card.start_date) || "2019-06-05";
  var end = normalizeDate_(card.directive_end || card.contract_end) || "2027-06-30";
  var readiness = num_(
    card.readiness_fact_pct != null && card.readiness_fact_pct !== ""
      ? card.readiness_fact_pct
      : card.readiness_fact
  );
  var smrDays = computeSmrDays_(start, end, readiness);

  var smrRows = sheetToObjects_(ss, SHEET_NAMES.smr);
  if (smrRows.length) {
    var smr0 = smrRows[0];
    if (smr0.fact_pct != null && smr0.fact_pct !== "") {
      readiness = num_(smr0.fact_pct);
      smrDays.readinessPct = readiness;
    }
  }

  var gen = str_(card.gen_contractor) || "ООО «Успех»";
  var endLbl = fullDateLbl_(end);

  return {
    project: {
      name: str_(card.object_name || card.name) || "ЖК «Северный»",
      meta: "Генподряд · " + gen + " · срок до " + endLbl,
      readiness_fact: readiness,
      readiness_plan: num_(
        card.readiness_plan_pct != null && card.readiness_plan_pct !== ""
          ? card.readiness_plan_pct
          : card.readiness_plan
      ),
      delta_pp: num_(
        card.delta_readiness_pp != null && card.delta_readiness_pp !== ""
          ? card.delta_readiness_pp
          : card.delta_pp
      ),
      contract_mln: Math.round(
        num_(
          card.contract_cost_mln != null && card.contract_cost_mln !== ""
            ? card.contract_cost_mln
            : card.contract_mln
        )
      ),
      paid_mln: paidMln || Math.round(num_(card.paid_mln)),
      workers_fact: Math.round(num_(card.workers_fact)),
      workers_plan: Math.round(num_(card.workers_plan)),
      supply_total_pct: supplyTotal,
      start_date: start,
      directive_end: end
    },
    smrDays: smrDays,
    supply: supply,
    finance: finance,
    labor: labor,
    risks: risks,
    tasks: tasks,
    sources: {
      generatedAt: new Date().toISOString(),
      from: "google_apps_script"
    }
  };
}

function sheetToObjects_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function (h) {
    return String(h || "")
      .replace(/^\uFEFF/, "")
      .trim();
  });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c];
      if (!key) continue;
      var v = values[r][c];
      if (v !== "" && v != null) empty = false;
      obj[key] = v;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

function computeSmrDays_(startIso, endIso, readiness) {
  var start = parseIso_(startIso);
  var end = parseIso_(endIso);
  var asOf = new Date();
  asOf.setHours(0, 0, 0, 0);
  var total = Math.max(1, daysBetween_(start, end));
  var elapsed = Math.max(0, daysBetween_(start, asOf));
  var remaining = Math.max(0, daysBetween_(asOf, end));
  var timePct = Math.round((10000 * elapsed) / total) / 100;
  var alert = timePct - readiness > 10;
  return {
    elapsed: elapsed,
    total: total,
    remaining: remaining,
    readinessPct: readiness,
    timePct: timePct,
    alert: alert,
    start: startIso,
    end: endIso
  };
}

function parseIso_(iso) {
  var p = String(iso || "").split("-");
  if (p.length < 3) return new Date();
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function daysBetween_(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function normalizeDate_(v) {
  if (v == null || v === "") return "";
  var s = String(v).trim();
  // Display values like 30.06.2027 or 2027-06-30
  var m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return m[3] + "-" + m[2] + "-" + m[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return s;
}

function shortDate_(iso) {
  iso = normalizeDate_(iso);
  if (!iso || iso.indexOf("-") < 0) return iso || "";
  var p = iso.split("-");
  if (p.length >= 3) return p[2] + "." + p[1];
  return iso;
}

function fullDateLbl_(iso) {
  iso = normalizeDate_(iso);
  if (iso && iso.length >= 10) {
    return iso.substring(8, 10) + "." + iso.substring(5, 7) + "." + iso.substring(0, 4);
  }
  return shortDate_(iso);
}

function deadlineLabel_(row) {
  var dtype = String(row.deadline_type || "").toLowerCase();
  var raw = normalizeDate_(row.deadline);
  if (dtype.indexOf("еженед") >= 0 && dtype.indexOf("пт") >= 0) return "пт";
  if (dtype.indexOf("еженед") >= 0 && dtype.indexOf("пн") >= 0) return "пн";
  if (dtype.indexOf("еженед") >= 0) return "еженед.";
  if (dtype.indexOf("постоян") >= 0) return "пост.";
  if (raw) return shortDate_(raw);
  return dtype || "—";
}

function truncate_(s, n) {
  s = String(s || "");
  if (s.length <= n) return s;
  return s.substring(0, n - 1) + "…";
}

function str_(v) {
  if (v == null) return "";
  return String(v).trim();
}

function num_(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  var s = String(v).replace(/\s/g, "").replace(",", ".");
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
