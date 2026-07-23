/**
 * DataLens — Google Sheets (ТЕСТ 1 / ТЕСТ 2) → dashboard JSON
 *
 * Spreadsheet: Family Garden / original client workbook
 *   https://docs.google.com/spreadsheets/d/1yzwXXxW1cVvc8t96a0uVXhz_KXR_thcd113y2U2tR9w
 *
 * Tabs:
 *   «ТЕСТ 1» — project report (key-value + sections СМР / труд / комплектация / финансы / риски)
 *   «ТЕСТ 2» — nested tasks by blocks (ФИНАНСЫ…, ЗАКУПКИ…, ПРАВОВЫЕ…)
 *
 * Parsing is heuristic (label matching). Renaming section titles / column headers
 * can break extraction — see docs/SHEETS_SYNC.md.
 *
 * Deploy:
 *   1. Open THIS spreadsheet → Extensions → Apps Script
 *   2. Replace Code.gs with this file → Save
 *   3. Deploy → New deployment → Web app
 *      Execute as: Me · Who has access: Anyone
 *   4. Copy the /exec URL into the editor field
 *      «URL веб-приложения Google (Apps Script)» → Save to site
 *
 * CORS: plain JSON for server/Action; JSONP (?callback=name) for browsers.
 */

var SHEET_TEST1 = "ТЕСТ 1";
var SHEET_TEST2 = "ТЕСТ 2";

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

/** Optional short titles for known task texts (substring match). */
var TASK_TITLE_HINTS = [
  ["рентабельности и прибыли", "Рентабельность АО «Успех»"],
  ["стратегию", "Стратегия ЖК «Северный»"],
  ["ндс на 2", "НДС +2% · разногласия"],
  ["дополнительных соглашений", "Доп. соглашения (НДС)"],
  ["сокращению расходов", "Сокращение расходов"],
  ["благоустройству", "ЖК «Солнце» · благоустр."],
  ["1с", "Контракты 1С"],
  ["материалов, находящихся на балансе", "Материалы на балансе"],
  ["субподряд", "Договоры с субподрядчиками"],
  ["папки с ответами", "Папки с ответами · ВПР"],
  ["претензионной", "Претензионная работа"],
  ["приказ об усилении", "Приказ · ответственность"],
  ["прут", "АО «Прут» · письмо"],
  ["берег", "ЖК «Берег» · справка"]
];

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

/** Manual test from Apps Script editor. */
function debugBuild() {
  Logger.log(JSON.stringify(buildDashboardJson(), null, 2));
}

function buildDashboardJson() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var t1 = getSheetValues_(ss, SHEET_TEST1);
  var t2 = getSheetValues_(ss, SHEET_TEST2);
  if (!t1.length) {
    throw new Error('Лист "' + SHEET_TEST1 + '" пуст или не найден');
  }
  if (!t2.length) {
    throw new Error('Лист "' + SHEET_TEST2 + '" пуст или не найден');
  }

  var general = parseGeneral_(t1);
  var summary = parseSummary_(t1);
  var smr = parseSmr_(t1);
  var labor = parseLabor_(t1);
  var supplyPack = parseSupply_(t1);
  var financePack = parseFinance_(t1);
  var risks = parseRisks_(t1);
  var tasks = parseTasks_(t2);

  var readinessFact =
    smr.fact != null
      ? smr.fact
      : summary.readiness_fact != null
        ? summary.readiness_fact
        : 0;
  var readinessPlan =
    smr.plan != null
      ? smr.plan
      : summary.readiness_plan != null
        ? summary.readiness_plan
        : 0;
  var deltaPp = Math.round((readinessFact - readinessPlan) * 100) / 100;

  var start = general.start_date || "2019-06-05";
  var end = general.directive_end || general.contract_end || "2027-06-30";
  var smrDays = computeSmrDays_(start, end, readinessFact);

  var workersPlan =
    summary.workers_plan != null ? summary.workers_plan : general.workers_plan;
  var workersFact =
    summary.workers_fact != null ? summary.workers_fact : general.workers_fact;

  var gen = general.gen_contractor || "ООО «Успех»";
  var endLbl = fullDateLbl_(end);

  return {
    project: {
      name: general.object_name || "ЖК «Северный»",
      meta: "Генподряд · " + gen + " · срок до " + endLbl,
      readiness_fact: readinessFact,
      readiness_plan: readinessPlan,
      delta_pp: deltaPp,
      contract_mln: Math.round(general.contract_mln || financePack.contract_plan || 0),
      paid_mln: Math.round(financePack.paid_mln || 0),
      workers_fact: Math.round(workersFact || 0),
      workers_plan: Math.round(workersPlan || 0),
      supply_total_pct: supplyPack.total,
      start_date: start,
      directive_end: end
    },
    smrDays: smrDays,
    supply: supplyPack.items,
    finance: financePack.items,
    labor: labor,
    risks: risks,
    tasks: tasks,
    sources: {
      generatedAt: new Date().toISOString(),
      from: "google_apps_script",
      sheets: [SHEET_TEST1, SHEET_TEST2]
    }
  };
}

/* ───────────── ТЕСТ 1 parsers ───────────── */

function parseGeneral_(rows) {
  var out = {
    object_name: "",
    customer: "",
    gen_contractor: "",
    contract_mln: 0,
    limit_mln: 0,
    start_date: "",
    contract_end: "",
    directive_end: "",
    workers_plan: 0,
    workers_fact: 0
  };
  for (var i = 0; i < rows.length; i++) {
    var a = cell_(rows[i], 0);
    var b = cell_(rows[i], 1);
    if (!a) continue;
    var al = a.toLowerCase();
    if (al.indexOf("наименование объекта") >= 0) out.object_name = b;
    else if (al.indexOf("заказчик") === 0) out.customer = b;
    else if (al.indexOf("генеральный подрядчик") >= 0) out.gen_contractor = b;
    else if (al.indexOf("стоимость работ") >= 0 || (al.indexOf("стоимость") >= 0 && al.indexOf("договор") >= 0 && al.indexOf("лимит") < 0 && al.indexOf("показател") < 0)) {
      if (!out.contract_mln) out.contract_mln = firstNum_(b);
    } else if (al.indexOf("стоимость по лимитам") >= 0) out.limit_mln = firstNum_(b);
    else if (al.indexOf("дата начала") >= 0) out.start_date = normalizeDate_(b);
    else if (al.indexOf("контрактный срок") >= 0) out.contract_end = normalizeDate_(b);
    else if (al.indexOf("директивный срок") >= 0) out.directive_end = normalizeDate_(b);
  }
  return out;
}

function parseSummary_(rows) {
  var out = {
    readiness_fact: null,
    readiness_plan: null,
    workers_plan: null,
    workers_fact: null
  };
  var inSection = false;
  for (var i = 0; i < rows.length; i++) {
    var a = cell_(rows[i], 0);
    var b = cell_(rows[i], 1);
    var al = a.toLowerCase();
    if (/^\d+(\.\d+)?\.?\s*сводка/i.test(a) || al.indexOf("1.1") === 0) {
      inSection = true;
      continue;
    }
    if (inSection && isSectionHeader_(a)) break;
    if (!inSection && al.indexOf("сводка") < 0) {
      // also allow matching rows without strict section if labels match
    }
    if (al.indexOf("готовность") >= 0 && al.indexOf("план") < 0) {
      out.readiness_fact = pct_(b);
    } else if (al.indexOf("плановая готовность") >= 0 || (al.indexOf("готовность") >= 0 && al.indexOf("план") >= 0)) {
      out.readiness_plan = pct_(b);
    } else if (al.indexOf("численность") >= 0 || (al.indexOf("рабочих") >= 0 && al.indexOf("план/факт") >= 0)) {
      var pair = parseSlashPair_(b);
      if (pair) {
        out.workers_plan = pair[0];
        out.workers_fact = pair[1];
      }
    }
  }
  return out;
}

function parseSmr_(rows) {
  var out = { plan: null, fact: null };
  var inSection = false;
  for (var i = 0; i < rows.length; i++) {
    var a = cell_(rows[i], 0);
    var al = a.toLowerCase();
    if (al.indexOf("строительно-монтажные") >= 0 || /^\d+\.?\s*смр/i.test(a)) {
      inSection = true;
      continue;
    }
    if (inSection && isSectionHeader_(a) && al.indexOf("строительн") < 0) break;
    if (!inSection) continue;
    if (al.indexOf("строительная готовность") >= 0 || al.indexOf("готовность объекта") >= 0) {
      out.plan = pct_(cell_(rows[i], 1));
      out.fact = pct_(cell_(rows[i], 2));
    }
  }
  return out;
}

function parseLabor_(rows) {
  var labor = [];
  var inSection = false;
  for (var i = 0; i < rows.length; i++) {
    var a = cell_(rows[i], 0);
    var al = a.toLowerCase();
    if (al.indexOf("трудовые ресурсы") >= 0) {
      inSection = true;
      continue;
    }
    if (inSection && isSectionHeader_(a)) break;
    if (!inSection) continue;
    if (al.indexOf("показател") >= 0 || al.indexOf("план") === 0) continue;
    if (al.indexOf("рабочие") >= 0) {
      labor.push({
        name: "Рабочие · чел.",
        plan: Math.round(num_(cell_(rows[i], 1))),
        fact: Math.round(num_(cell_(rows[i], 2)))
      });
    } else if (al.indexOf("итр") >= 0) {
      labor.push({
        name: "ИТР · чел.",
        plan: Math.round(num_(cell_(rows[i], 1))),
        fact: Math.round(num_(cell_(rows[i], 2)))
      });
    }
  }
  return labor;
}

function parseSupply_(rows) {
  var items = [];
  var total = 0;
  var inSection = false;
  for (var i = 0; i < rows.length; i++) {
    var a = cell_(rows[i], 0);
    var al = a.toLowerCase();
    if (al.indexOf("комплектация") >= 0 || (al.indexOf("поставка") >= 0 && al.indexOf("монтаж") >= 0)) {
      inSection = true;
      continue;
    }
    if (inSection && isSectionHeader_(a)) break;
    if (!inSection) continue;
    if (al.indexOf("категория") >= 0 || !a) continue;
    var pct = pct_(cell_(rows[i], 3));
    var shortName = SUPPLY_SHORT[a] || a;
    if (al === "итого" || a === "Итого") total = pct;
    var tone = "default";
    if (pct <= 25) tone = "alert";
    else if (pct >= 50 && shortName !== "Итого") tone = "ok";
    items.push({ name: shortName, pct: pct, tone: tone });
  }
  return { items: items, total: total };
}

function parseFinance_(rows) {
  var items = [];
  var paid = 0;
  var contractPlan = 0;
  var inSection = false;
  for (var i = 0; i < rows.length; i++) {
    var a = cell_(rows[i], 0);
    var al = a.toLowerCase();
    if (al.indexOf("финансирование") >= 0 || al.indexOf("взаиморасчёт") >= 0 || al.indexOf("взаиморасчет") >= 0) {
      inSection = true;
      continue;
    }
    if (inSection && isSectionHeader_(a)) break;
    if (!inSection) continue;
    if (al.indexOf("показател") >= 0 || !a) continue;
    var label = FIN_MAP[a];
    if (!label) {
      // fuzzy
      if (al.indexOf("стоимость договора") >= 0) label = FIN_MAP["Стоимость договора"];
      else if (al.indexOf("стоимость по лимитам") >= 0) label = FIN_MAP["Стоимость по лимитам"];
      else if (al.indexOf("оплачено") >= 0) label = FIN_MAP["Оплачено подрядчику"];
    }
    if (!label) continue;
    var plan = Math.round(num_(cell_(rows[i], 1)));
    var fact = Math.round(num_(cell_(rows[i], 2)));
    items.push({ name: label, plan: plan, fact: fact });
    if (label === "Оплачено · млн") paid = fact;
    if (label === "Договор · млн") contractPlan = plan;
  }
  return { items: items, paid_mln: paid, contract_plan: contractPlan };
}

function parseRisks_(rows) {
  var risks = [];
  var inSection = false;
  var curProblem = "";
  var curImpact = "";
  var curLevel = "";
  var headerIdx = -1;

  for (var i = 0; i < rows.length; i++) {
    var a = cell_(rows[i], 0);
    var al = a.toLowerCase();
    if (al.indexOf("проблем") >= 0 && (al.indexOf("риск") >= 0 || al.indexOf("решен") >= 0)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (isSectionHeader_(a) && al.indexOf("проблем") < 0) break;

    // Header row: № | Проблема | ...
    if (al === "№" || al === "no" || (al.indexOf("проблема") === 0 && cell_(rows[i], 1))) {
      // detect columns by header labels
      headerIdx = i;
      continue;
    }
    if (headerIdx < 0) continue;

    var numLabel = a;
    var problem = cell_(rows[i], 1);
    var impact = cell_(rows[i], 2);
    var level = cell_(rows[i], 3);
    var solution = cell_(rows[i], 4);
    var owner = cell_(rows[i], 5);
    var deadlineRaw = cell_(rows[i], 6);
    var status = cell_(rows[i], 7);

    var isNewProblem = /^\d+\.?$/.test(numLabel.replace(/\s/g, ""));
    if (isNewProblem && problem) {
      curProblem = cleanText_(problem);
      curImpact = impact;
      curLevel = level;
    }

    // Skip pure empty rows
    if (!solution && !deadlineRaw && !status && !isNewProblem) continue;
    if (!curProblem && !problem) continue;

    if (isNewProblem && problem) {
      curProblem = cleanText_(problem);
      if (impact) curImpact = impact;
      if (level) curLevel = level;
    }

    var sol = cleanText_(solution);
    // First row of problem #1 often has empty «Решение» — treat problem text as done action
    if (!sol && isNewProblem && status) {
      sol = truncate_(curProblem, 120);
    }
    if (!sol && !status && !deadlineRaw) continue;

    var dl = normalizeDate_(deadlineRaw);
    var title = riskTitle_(curProblem, sol, dl);
    risks.push({
      t: title,
      problem: curProblem || cleanText_(problem),
      impact: curImpact || impact,
      risk_level: curLevel || level,
      solution: sol,
      owner: cleanText_(owner) || guessOwner_(sol),
      deadline: dl,
      m: shortDate_(dl),
      status: status || "В работе"
    });
  }
  return risks;
}

function riskTitle_(problem, solution, dl) {
  var p = (problem || "").toLowerCase();
  var s = (solution || "").toLowerCase();
  if (p.indexOf("финанс") >= 0 || p.indexOf("489") >= 0) {
    if (s.indexOf("доведен") >= 0 || (dl && dl.indexOf("01-13") >= 0)) return "Финансирование · доведено 489";
    if (s.indexOf("доп") >= 0 || s.indexOf("соглашен") >= 0) return "Финансирование · доп. соглашение";
    if (s.indexOf("586") >= 0 || s.indexOf("остат") >= 0) return "Финансирование · остаток 586 млн";
    return "Финансирование";
  }
  if (p.indexOf("неучтен") >= 0 || p.indexOf("неучтенн") >= 0 || p.indexOf("инспекц") >= 0) {
    if (s.indexOf("псд") >= 0 && s.indexOf("предостав") >= 0) return "Неучтенный объём · ПСД";
    if (s.indexOf("рассмотр") >= 0 || s.indexOf("согласован") >= 0) return "Неучтенный объём · согласование";
    if (s.indexOf("лимит") >= 0) return "Неучтенный объём · лимиты";
    return "Неучтенный объём";
  }
  return truncate_(solution || problem || "Риск", 42);
}

function guessOwner_(solution) {
  var s = solution || "";
  if (/ООО\s*«?\s*Успех/i.test(s) && /Заказчик/i.test(s)) return "Заказчик А / ООО «Успех»";
  if (/ООО\s*«?\s*Успех/i.test(s)) return "ООО «Успех»";
  if (/Заказчик/i.test(s)) return "Заказчик А";
  return "";
}

/* ───────────── ТЕСТ 2 parsers ───────────── */

function parseTasks_(rows) {
  var tasks = [];
  var block = "";
  var blockOwner = "";
  var start = 0;
  // skip header
  if (rows.length && /задача/i.test(cell_(rows[0], 1) || cell_(rows[0], 0))) start = 1;

  for (var i = start; i < rows.length; i++) {
    var c0 = cell_(rows[i], 0);
    var c1 = cell_(rows[i], 1);
    var c2 = cell_(rows[i], 2);
    var c3 = cell_(rows[i], 3);
    var c4 = cell_(rows[i], 4);

    // «План на неделю:» under current legal block
    if (/^план на неделю/i.test(c0) || /^план на неделю/i.test(c1)) {
      if (block && block.indexOf("План на неделю") < 0) {
        block = block.replace(/\s*\/\s*План на неделю$/, "") + " / План на неделю";
      } else if (!block) {
        block = "План на неделю";
      }
      continue;
    }

    // «Задачи:» alone
    if (/^задачи:?$/i.test(c0) || /^задачи:?$/i.test(c1)) continue;

    // Block header with number in A: «1.0 | ФИНАНСЫ… | Иванова»
    if (/^\d+(\.\d+)?\.?$/.test(c0.replace(/\s/g, "")) && c1 && !isBullet_(c1)) {
      block = cleanBlockName_(c1);
      blockOwner = cleanPerson_(c2);
      continue;
    }

    // Block header without number: «ПРАВОВЫЕ ВОПРОСЫ | Абрамов»
    if (c0 && !isBullet_(c0) && isBlockTitle_(c0) && !looksLikeDate_(c1) && !looksLikeStatus_(c1)) {
      block = cleanBlockName_(c0);
      blockOwner = cleanPerson_(c1);
      continue;
    }

    // Task bullet in B (finance/supply style): empty A, "- text"
    var taskText = "";
    var responsible = "";
    var deadlineRaw = "";
    var status = "";

    if (isBullet_(c1) || (c1 && c1.charAt(0) === "-")) {
      taskText = stripBullet_(c1);
      responsible = cleanPerson_(c2) || blockOwner;
      deadlineRaw = c3;
      status = c4;
    } else if (isBullet_(c0) || (c0 && c0.charAt(0) === "-")) {
      // Legal style: bullet in A
      taskText = stripBullet_(c0);
      responsible = cleanPerson_(c1) || blockOwner;
      deadlineRaw = c2;
      status = c3;
      // Sometimes status shifts if deadline is text cadence
      if (!status && looksLikeStatus_(c2)) {
        status = c2;
        deadlineRaw = "";
      }
    } else {
      continue;
    }

    if (!taskText) continue;

    var dtype = "";
    var deadline = "";
    var cadence = parseCadence_(deadlineRaw);
    if (cadence) {
      dtype = cadence;
      deadline = "";
    } else {
      deadline = normalizeDate_(deadlineRaw);
      dtype = deadline ? "дата" : "";
    }

    // Status may live in deadline column for cadence-only rows
    if (!status && looksLikeStatus_(deadlineRaw)) {
      status = deadlineRaw;
      deadline = "";
      dtype = "";
    }
    // Cadence in deadline, status empty → «В работе»
    if (!status) status = "В работе";
    // Row like: deadline=еженедельно, no status col
    if (!cadence && !deadline && deadlineRaw && !looksLikeStatus_(deadlineRaw)) {
      cadence = parseCadence_(deadlineRaw);
      if (cadence) {
        dtype = cadence;
        // if we wrongly set status from something else, keep
      }
    }

    // Fix: when col D is cadence and col E empty — already handled
    // When only 3 cols used: task, responsible/empty, cadence — status default

    var explanation = "";
    if (status === "Не исполнено") {
      explanation =
        "Срок просрочен; причина уточняется у ответственного, повторный контроль поставлен в план.";
      if (/прут/i.test(taskText)) {
        explanation =
          "Ответ АО «Прут» не получен в согласованный срок; повторный запрос направлен, оценка совместной работы задерживается на стороне контрагента.";
      }
    }

    tasks.push({
      t: taskTitle_(taskText),
      description: capitalizeFirst_(taskText),
      responsible: responsible,
      explanation: explanation,
      m: deadlineLabelFrom_(deadline, dtype),
      deadline: deadline,
      deadline_type: dtype,
      status: status,
      block: block || "Прочее"
    });
  }
  return tasks;
}

function isBullet_(s) {
  s = String(s || "").trim();
  return s.charAt(0) === "-" || s.charAt(0) === "–" || s.charAt(0) === "—";
}

function stripBullet_(s) {
  return String(s || "")
    .replace(/^[\s\-–—]+/, "")
    .replace(/;+\s*$/, "")
    .trim();
}

function isBlockTitle_(s) {
  s = String(s || "");
  if (s.length < 3 || s.length > 80) return false;
  if (isBullet_(s)) return false;
  if (/^задачи/i.test(s)) return false;
  // ALL CAPS-ish or contains slash department names
  if (/[А-ЯA-Z]{3,}/.test(s) && s === s.toUpperCase()) return true;
  if (/ФИНАНС|ЗАКУПК|ПРАВОВ|КАЗНАЧ|КАЦ|ПЛАН/i.test(s)) return true;
  return false;
}

function cleanBlockName_(s) {
  s = cleanText_(s);
  s = s.replace(/\s*\/\s*Задачи:?\s*$/i, "");
  s = s.replace(/\s*Задачи:?\s*$/i, "");
  s = s.replace(/:\s*$/, "");
  return s.trim();
}

function cleanPerson_(s) {
  s = cleanText_(s);
  s = s.replace(/\.\.+/g, ".");
  s = s.replace(/\s+/g, " ").trim();
  // drop trailing lone dots duplication «Баранов В.Б..»
  s = s.replace(/(\.)\./g, "$1");
  return s;
}

function taskTitle_(full) {
  var low = full.toLowerCase();
  for (var i = 0; i < TASK_TITLE_HINTS.length; i++) {
    if (low.indexOf(TASK_TITLE_HINTS[i][0]) >= 0) return TASK_TITLE_HINTS[i][1];
  }
  return truncate_(capitalizeFirst_(full), 42);
}

function parseCadence_(raw) {
  var s = String(raw || "").toLowerCase().replace(/\n/g, " ");
  if (!s) return "";
  if (s.indexOf("постоян") >= 0) return "постоянно";
  if (s.indexOf("еженед") >= 0 || s.indexOf("еженедель") >= 0) {
    if (s.indexOf("пятниц") >= 0 || /\bпт\b/.test(s)) return "еженедельно (пт)";
    if (s.indexOf("понедельник") >= 0 || /\bпн\b/.test(s)) return "еженедельно (пн)";
    return "еженедельно";
  }
  return "";
}

function looksLikeDate_(s) {
  s = String(s || "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}\.\d{1,2}\.+\d{2,4}/.test(s);
}

function looksLikeStatus_(s) {
  s = String(s || "").toLowerCase().trim();
  return (
    s === "в работе" ||
    s === "не исполнено" ||
    s === "выполнено" ||
    s === "исполнено" ||
    s.indexOf("не исполн") >= 0
  );
}

function deadlineLabelFrom_(deadline, dtype) {
  var d = String(dtype || "").toLowerCase();
  if (d.indexOf("еженед") >= 0 && d.indexOf("пт") >= 0) return "пт";
  if (d.indexOf("еженед") >= 0 && d.indexOf("пн") >= 0) return "пн";
  if (d.indexOf("еженед") >= 0) return "еженед.";
  if (d.indexOf("постоян") >= 0) return "пост.";
  if (deadline) return shortDate_(deadline);
  return d || "—";
}

function capitalizeFirst_(s) {
  s = String(s || "");
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ───────────── sheet helpers ───────────── */

function getSheetValues_(ss, name) {
  var sh = findSheet_(ss, name);
  if (!sh) return [];
  return sh.getDataRange().getDisplayValues();
}

function findSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  // tolerate NBSP / spacing variants
  var want = normalizeSheetName_(name);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (normalizeSheetName_(sheets[i].getName()) === want) return sheets[i];
  }
  return null;
}

function normalizeSheetName_(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cell_(row, idx) {
  if (!row || idx >= row.length) return "";
  var v = row[idx];
  if (v == null) return "";
  return String(v).replace(/\u00a0/g, " ").replace(/\r/g, "").trim();
}

function isSectionHeader_(a) {
  a = String(a || "").trim();
  if (!a || a.length > 120) return false;
  // «5. СТРОИТЕЛЬНО…», «10. ПРОБЛЕМЫ…»
  if (/^\d+(\.\d+)?\.?\s+[А-ЯA-Z]/.test(a) && /[А-ЯA-Z]{4,}/.test(a)) {
    if (a.indexOf("%") >= 0) return false;
    if (/^готовность/i.test(a)) return false;
    return true;
  }
  return false;
}

function cleanText_(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

function parseSlashPair_(s) {
  var m = String(s || "").match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  return [num_(m[1]), num_(m[2])];
}

function firstNum_(s) {
  var m = String(s || "").replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  return m ? num_(m[1]) : 0;
}

function pct_(v) {
  var n = num_(v);
  // Sheet stores 0.5471 for 54.71%
  if (n > 0 && n <= 1.5) return Math.round(n * 10000) / 100;
  return n;
}

function num_(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  var s = String(v)
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace("%", "")
    .replace(",", ".");
  // keep first number chunk
  var m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  var n = parseFloat(m[0]);
  return isFinite(n) ? n : 0;
}

function normalizeDate_(v) {
  if (v == null || v === "") return "";
  var s = String(v).trim().replace(/\u00a0/g, " ");
  // Excel serial displayed as datetime string
  s = s.replace(/ 00:00:00$/, "");
  // Fix double dots: 24.01..2026
  s = s.replace(/\.{2,}/g, ".");
  var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    var dd = Number(m[1]);
    var mm = Number(m[2]);
    var yy = Number(m[3]);
    return isoClamp_(yy, mm, dd);
  }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (m) {
    return isoClamp_(2000 + Number(m[3]), Number(m[2]), Number(m[1]));
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // DisplayValues sometimes keep locale
  return "";
}

function isoClamp_(y, m, d) {
  if (!y || !m || m < 1 || m > 12) return "";
  var last = new Date(y, m, 0).getDate();
  if (d < 1) d = 1;
  if (d > last) d = last;
  return (
    String(y) +
    "-" +
    (m < 10 ? "0" : "") +
    m +
    "-" +
    (d < 10 ? "0" : "") +
    d
  );
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

function shortDate_(iso) {
  iso = normalizeDate_(iso) || iso;
  if (!iso || String(iso).indexOf("-") < 0) return iso || "";
  var p = String(iso).split("-");
  if (p.length >= 3) return p[2] + "." + p[1];
  return iso;
}

function fullDateLbl_(iso) {
  iso = normalizeDate_(iso) || iso;
  if (iso && String(iso).length >= 10 && String(iso).indexOf("-") >= 0) {
    return iso.substring(8, 10) + "." + iso.substring(5, 7) + "." + iso.substring(0, 4);
  }
  return shortDate_(iso);
}

function truncate_(s, n) {
  s = String(s || "");
  if (s.length <= n) return s;
  return s.substring(0, n - 1) + "…";
}
