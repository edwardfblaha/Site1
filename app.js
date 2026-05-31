/* base — a highly visual training planner for elite runners
 * Pure client-side: plans persist in localStorage; no backend required. */

(() => {
  "use strict";

  // ---- Workout type definitions (order matters for legend / picker) ----
  const TYPES = [
    { id: "easy",      label: "Easy",      color: "var(--t-easy)" },
    { id: "long",      label: "Long",      color: "var(--t-long)" },
    { id: "tempo",     label: "Tempo",     color: "var(--t-tempo)" },
    { id: "threshold", label: "Threshold", color: "var(--t-threshold)" },
    { id: "vo2",       label: "VO2",       color: "var(--t-vo2)" },
    { id: "anaerobic", label: "Anaerobic", color: "var(--t-anaerobic)" },
    { id: "race",      label: "Race",      color: "var(--t-race)" },
    { id: "rest",      label: "Rest",      color: "var(--t-rest)" },
  ];
  const TYPE_BY_ID = Object.fromEntries(TYPES.map((t) => [t.id, t]));
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const STORE_KEY = "base.plan.v1";

  // ---- State ----
  /** plan.days is keyed by ISO date 'YYYY-MM-DD'. */
  let plan = loadPlan();
  let editingKey = null; // the day currently open in the modal

  // ---- Date helpers ----
  function isoOf(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function parseISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  function mondayOf(d) {
    const r = new Date(d);
    const wd = (r.getDay() + 6) % 7; // 0 = Monday
    r.setDate(r.getDate() - wd);
    r.setHours(0, 0, 0, 0);
    return r;
  }
  const fmtRange = (a, b) =>
    `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${b.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  // ---- Persistence ----
  function defaultPlan() {
    return {
      startDate: isoOf(mondayOf(new Date())),
      weeks: 12,
      units: "mi",
      days: {},
    };
  }
  function loadPlan() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultPlan();
      const p = JSON.parse(raw);
      return { ...defaultPlan(), ...p, days: p.days || {} };
    } catch {
      return defaultPlan();
    }
  }
  function savePlan() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(plan));
    } catch {
      /* storage may be unavailable; the app still works in-memory */
    }
  }

  function getDay(key) {
    return (
      plan.days[key] || {
        mileage: 0, type: "", note: "",
        pmMileage: 0, pmType: "", pmNote: "",
        strides: false, hills: false,
      }
    );
  }
  // A day is a "double" when it has any PM-session content.
  function isDouble(d) {
    return (d.pmMileage || 0) > 0 || !!d.pmType || !!d.pmNote;
  }
  // Total mileage for a day = AM run + PM run.
  function dayMileage(d) {
    return (d.mileage || 0) + (d.pmMileage || 0);
  }
  function dayHasContent(d) {
    return (
      d.mileage > 0 || d.type || d.note ||
      isDouble(d) || d.strides || d.hills
    );
  }

  // ---- Rendering ----
  const $ = (id) => document.getElementById(id);
  const unitLabel = () => (plan.units === "km" ? "km" : "mi");

  function renderLegend() {
    const el = $("legend");
    el.innerHTML = "";
    for (const t of TYPES) {
      const pill = document.createElement("span");
      pill.className = "legend-pill";
      pill.innerHTML = `<span class="legend-dot" style="background:${t.color}"></span>${t.label}`;
      el.appendChild(pill);
    }
  }

  function renderControls() {
    $("startDate").value = plan.startDate;
    $("weekCount").value = plan.weeks;
    $("units").value = plan.units;
  }

  function renderCalendar() {
    const cal = $("calendar");
    cal.innerHTML = "";
    const start = mondayOf(parseISO(plan.startDate));
    const todayISO = isoOf(new Date());

    // First pass: collect weekly totals to scale the volume bars.
    const weekTotals = [];
    for (let w = 0; w < plan.weeks; w++) {
      let total = 0;
      for (let i = 0; i < 7; i++) total += dayMileage(getDay(isoOf(addDays(start, w * 7 + i))));
      weekTotals.push(total);
    }
    const peak = Math.max(1, ...weekTotals);

    for (let w = 0; w < plan.weeks; w++) {
      const weekStart = addDays(start, w * 7);
      const weekEnd = addDays(weekStart, 6);

      const week = document.createElement("section");
      week.className = "week";

      const head = document.createElement("div");
      head.className = "week-head";
      head.innerHTML = `
        <span class="week-num">Week ${w + 1}</span>
        <span class="week-range">${fmtRange(weekStart, weekEnd)}</span>
        <span class="week-total">${round(weekTotals[w])}<small> ${unitLabel()}</small></span>
        <div class="week-bar"><div class="week-bar-fill" style="width:${(weekTotals[w] / peak) * 100}%"></div></div>`;
      week.appendChild(head);

      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const key = isoOf(date);
        week.appendChild(renderDay(key, date, i, key === todayISO, key < todayISO));
      }
      cal.appendChild(week);
    }
  }

  function renderDay(key, date, dayIdx, isToday, isPast) {
    const d = getDay(key);
    const amType = d.type ? TYPE_BY_ID[d.type] : null;
    const pmType = d.pmType ? TYPE_BY_ID[d.pmType] : null;
    const amHas = (d.mileage || 0) > 0 || !!d.type || !!d.note;
    const pmHas = (d.pmMileage || 0) > 0 || !!d.pmType || !!d.pmNote;
    const isRace = d.type === "race" || d.pmType === "race";
    const total = dayMileage(d);

    const cell = document.createElement("button");
    cell.className =
      "day" +
      (isToday ? " is-today" : "") +
      (!isToday && isPast ? " is-past" : "") +
      (isRace ? " is-race" : "") +
      (dayHasContent(d) ? "" : " is-empty");
    cell.style.borderLeftColor = (amType || pmType) ? (amType || pmType).color : "var(--t-rest)";
    cell.setAttribute("aria-label", `${DAY_NAMES[dayIdx]} ${key} — edit`);

    const mileageClass = total > 0 ? "" : " zero";

    // Either session is optional. Show a stacked AM/PM breakdown whenever
    // both run, or a single labelled PM row for a PM-only day. A plain
    // AM-only day keeps the compact single type pill.
    const session = (badge, mi, t) =>
      `<div class="session"><span class="session-badge">${badge}</span>` +
      `<span class="session-dot" style="background:${t ? t.color : "var(--t-rest)"}"></span>` +
      `<span class="session-mi">${round(mi)} ${unitLabel()}</span>` +
      (t ? `<span class="session-name">${t.id === "race" ? "🏁 " : ""}${t.label}</span>` : "") +
      `</div>`;

    let body = "";
    if (amHas && pmHas) {
      body = `<div class="day-sessions">
          ${session("AM", d.mileage || 0, amType)}
          ${session("PM", d.pmMileage || 0, pmType)}
        </div>`;
    } else if (pmHas) {
      body = `<div class="day-sessions">${session("PM", d.pmMileage || 0, pmType)}</div>`;
    } else if (amType) {
      const pillText = amType.id === "race" ? "#fff" : "#06121f";
      const label = amType.id === "race" ? "🏁 Race" : amType.label;
      body = `<span class="day-type" style="background:${amType.color};color:${pillText}">${label}</span>`;
    }

    const noteHtml = d.note ? `<span class="day-note">${escapeHtml(d.note)}</span>` : "";

    let mods = "";
    if (d.strides) mods += `<span class="chip chip-strides">Strides</span>`;
    if (d.hills) mods += `<span class="chip chip-hills">Hills</span>`;

    cell.innerHTML = `
      <div class="day-top">
        <span class="day-name">${DAY_NAMES[dayIdx]}</span>
        <span class="day-date">${date.getMonth() + 1}/${date.getDate()}</span>
      </div>
      <span class="day-mileage${mileageClass}">${round(total)}<small> ${unitLabel()}</small></span>
      ${body}
      ${noteHtml}
      ${mods ? `<div class="day-mods">${mods}</div>` : ""}`;

    cell.addEventListener("click", () => openEditor(key, date, dayIdx));
    return cell;
  }

  function renderSummary() {
    const start = mondayOf(parseISO(plan.startDate));
    let total = 0,
      workouts = 0,
      peak = 0;
    const qualityTypes = new Set(["tempo", "threshold", "vo2", "anaerobic"]);

    for (let w = 0; w < plan.weeks; w++) {
      let weekTotal = 0;
      for (let i = 0; i < 7; i++) {
        const d = getDay(isoOf(addDays(start, w * 7 + i)));
        total += dayMileage(d);
        weekTotal += dayMileage(d);
        if (qualityTypes.has(d.type)) workouts++;
        if (qualityTypes.has(d.pmType)) workouts++;
      }
      peak = Math.max(peak, weekTotal);
    }

    const u = unitLabel();
    $("sumTotal").textContent = round(total);
    $("sumAvg").textContent = round(total / Math.max(1, plan.weeks));
    $("sumPeak").textContent = round(peak);
    $("sumWorkouts").textContent = workouts;
    $("sumTotalLabel").textContent = `total ${u}`;
    $("sumAvgLabel").textContent = `avg ${u} / week`;
    $("sumPeakLabel").textContent = `peak week (${u})`;
  }

  function renderAll() {
    renderControls();
    renderLegend();
    renderCalendar();
    renderSummary();
  }

  // ---- Day editor modal ----
  function buildTypeGrid(gridId) {
    const grid = $(gridId);
    grid.innerHTML = "";
    for (const t of TYPES) {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "type-opt";
      opt.dataset.type = t.id;
      opt.innerHTML = `<span class="legend-dot" style="background:${t.color}"></span>${t.label}`;
      opt.addEventListener("click", () => {
        const wasSelected = opt.classList.contains("selected");
        grid.querySelectorAll(".type-opt").forEach((o) => {
          o.classList.remove("selected");
          o.style.borderColor = "";
        });
        // Allow clicking the active type to clear it.
        if (!wasSelected) {
          opt.classList.add("selected");
          opt.style.borderColor = t.color;
        }
      });
      grid.appendChild(opt);
    }
  }

  function selectedType(gridId) {
    const sel = $(gridId).querySelector(".type-opt.selected");
    return sel ? sel.dataset.type : "";
  }
  function setSelectedType(gridId, id) {
    $(gridId).querySelectorAll(".type-opt").forEach((o) => {
      const on = o.dataset.type === id;
      o.classList.toggle("selected", on);
      o.style.borderColor = on && id ? TYPE_BY_ID[id].color : "";
    });
  }

  function openEditor(key, date, dayIdx) {
    editingKey = key;
    const d = getDay(key);
    $("modalTitle").textContent = `${DAY_NAMES[dayIdx]} · ${date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
    $("dMileage").value = d.mileage || "";
    setSelectedType("typeGrid", d.type || "");
    $("dNote").value = d.note || "";
    $("dPmMileage").value = d.pmMileage || "";
    setSelectedType("typePmGrid", d.pmType || "");
    $("dPmNote").value = d.pmNote || "";
    $("dStrides").checked = !!d.strides;
    $("dHills").checked = !!d.hills;
    $("modalBackdrop").classList.add("open");
    $("dMileage").focus();
  }

  function closeEditor() {
    $("modalBackdrop").classList.remove("open");
    editingKey = null;
  }

  function saveEditor() {
    if (!editingKey) return;
    const pmMileage = Math.max(0, parseFloat($("dPmMileage").value) || 0);
    const pmType = selectedType("typePmGrid");
    const pmNote = $("dPmNote").value.trim();
    const entry = {
      mileage: Math.max(0, parseFloat($("dMileage").value) || 0),
      type: selectedType("typeGrid"),
      note: $("dNote").value.trim(),
      pmMileage,
      pmType,
      pmNote,
      double: pmMileage > 0 || !!pmType || !!pmNote,
      strides: $("dStrides").checked,
      hills: $("dHills").checked,
    };
    if (dayHasContent(entry)) plan.days[editingKey] = entry;
    else delete plan.days[editingKey];
    savePlan();
    closeEditor();
    renderCalendar();
    renderSummary();
  }

  function clearEditingDay() {
    if (editingKey) delete plan.days[editingKey];
    savePlan();
    closeEditor();
    renderCalendar();
    renderSummary();
  }

  // ---- Import / export ----
  function exportPlan() {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-plan-${plan.startDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importPlan(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result);
        plan = { ...defaultPlan(), ...p, days: p.days || {} };
        savePlan();
        renderAll();
      } catch {
        alert("That file could not be read as a base plan.");
      }
    };
    reader.readAsText(file);
  }

  // ---- Utilities ----
  function round(n) {
    const r = Math.round((n || 0) * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // ---- Wire up events ----
  function init() {
    buildTypeGrid("typeGrid");
    buildTypeGrid("typePmGrid");
    renderAll();

    $("startDate").addEventListener("change", (e) => {
      plan.startDate = isoOf(mondayOf(parseISO(e.target.value)));
      savePlan();
      renderAll();
    });
    $("weekCount").addEventListener("change", (e) => {
      plan.weeks = Math.min(52, Math.max(1, parseInt(e.target.value, 10) || 1));
      savePlan();
      renderAll();
    });
    $("units").addEventListener("change", (e) => {
      plan.units = e.target.value;
      savePlan();
      renderAll();
    });

    $("exportBtn").addEventListener("click", exportPlan);
    $("importBtn").addEventListener("click", () => $("importInput").click());
    $("importInput").addEventListener("change", (e) => {
      if (e.target.files[0]) importPlan(e.target.files[0]);
      e.target.value = "";
    });
    $("resetBtn").addEventListener("click", () => {
      if (confirm("Clear the entire plan? This cannot be undone.")) {
        plan = defaultPlan();
        savePlan();
        renderAll();
      }
    });

    $("dSave").addEventListener("click", saveEditor);
    $("dClear").addEventListener("click", clearEditingDay);
    $("modalClose").addEventListener("click", closeEditor);
    $("modalBackdrop").addEventListener("click", (e) => {
      if (e.target === $("modalBackdrop")) closeEditor();
    });
    document.addEventListener("keydown", (e) => {
      if (!$("modalBackdrop").classList.contains("open")) return;
      if (e.key === "Escape") closeEditor();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEditor();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
