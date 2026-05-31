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
    return plan.days[key] || { mileage: 0, type: "", note: "", strides: false, hills: false, double: false };
  }
  function dayHasContent(d) {
    return d.mileage > 0 || d.type || d.note || d.strides || d.hills || d.double;
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
      for (let i = 0; i < 7; i++) total += getDay(isoOf(addDays(start, w * 7 + i))).mileage || 0;
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
        week.appendChild(renderDay(key, date, i, key === todayISO));
      }
      cal.appendChild(week);
    }
  }

  function renderDay(key, date, dayIdx, isToday) {
    const d = getDay(key);
    const type = d.type ? TYPE_BY_ID[d.type] : null;

    const cell = document.createElement("button");
    cell.className = "day" + (isToday ? " is-today" : "") + (dayHasContent(d) ? "" : " is-empty");
    cell.style.borderLeftColor = type ? type.color : "var(--t-rest)";
    cell.setAttribute("aria-label", `${DAY_NAMES[dayIdx]} ${key} — edit`);

    const mileageClass = d.mileage > 0 ? "" : " zero";
    const typeHtml = type
      ? `<span class="day-type" style="background:${type.color}">${type.label}</span>`
      : "";
    const noteHtml = d.note ? `<span class="day-note">${escapeHtml(d.note)}</span>` : "";

    let mods = "";
    if (d.strides) mods += `<span class="chip chip-strides">Strides</span>`;
    if (d.hills) mods += `<span class="chip chip-hills">Hills</span>`;
    if (d.double) mods += `<span class="chip chip-double">Double</span>`;

    cell.innerHTML = `
      <div class="day-top">
        <span class="day-name">${DAY_NAMES[dayIdx]}</span>
        <span class="day-date">${date.getMonth() + 1}/${date.getDate()}</span>
      </div>
      <span class="day-mileage${mileageClass}">${round(d.mileage)}<small> ${unitLabel()}</small></span>
      ${typeHtml}
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
        total += d.mileage || 0;
        weekTotal += d.mileage || 0;
        if (qualityTypes.has(d.type)) workouts++;
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
  function buildTypeGrid() {
    const grid = $("typeGrid");
    grid.innerHTML = "";
    for (const t of TYPES) {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "type-opt";
      opt.dataset.type = t.id;
      opt.innerHTML = `<span class="legend-dot" style="background:${t.color}"></span>${t.label}`;
      opt.addEventListener("click", () => {
        grid.querySelectorAll(".type-opt").forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
        opt.style.borderColor = t.color;
        grid.querySelectorAll(".type-opt").forEach((o) => {
          if (o !== opt) o.style.borderColor = "";
        });
      });
      grid.appendChild(opt);
    }
  }

  function selectedType() {
    const sel = $("typeGrid").querySelector(".type-opt.selected");
    return sel ? sel.dataset.type : "";
  }
  function setSelectedType(id) {
    $("typeGrid").querySelectorAll(".type-opt").forEach((o) => {
      const on = o.dataset.type === id;
      o.classList.toggle("selected", on);
      o.style.borderColor = on ? TYPE_BY_ID[id].color : "";
    });
  }

  function openEditor(key, date, dayIdx) {
    editingKey = key;
    const d = getDay(key);
    $("modalTitle").textContent = `${DAY_NAMES[dayIdx]} · ${date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
    $("dMileage").value = d.mileage || "";
    setSelectedType(d.type || "");
    $("dStrides").checked = !!d.strides;
    $("dHills").checked = !!d.hills;
    $("dDouble").checked = !!d.double;
    $("dNote").value = d.note || "";
    $("modalBackdrop").classList.add("open");
    $("dMileage").focus();
  }

  function closeEditor() {
    $("modalBackdrop").classList.remove("open");
    editingKey = null;
  }

  function saveEditor() {
    if (!editingKey) return;
    const entry = {
      mileage: Math.max(0, parseFloat($("dMileage").value) || 0),
      type: selectedType(),
      strides: $("dStrides").checked,
      hills: $("dHills").checked,
      double: $("dDouble").checked,
      note: $("dNote").value.trim(),
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
    buildTypeGrid();
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
