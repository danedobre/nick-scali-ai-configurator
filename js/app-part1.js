/* Nick Scali AI configurator — example demo. Nothing is stored or sent. */
(function () {
  "use strict";

  const DEFAULT_MIN = 35;
  const TRUCK_CAP = 30;
  const TARGET_PCT = 80;
  const REGIONS = ["All Australia", "NSW", "VIC", "QLD", "SA", "WA", "NZ", "North America"];
  const DELIVERY_TYPES = ["White glove", "Warehouse pickup", "In-store pickup", "Room of choice", "ATL", "Transfer", "Collection", "Assembly only"];
  const RUNS = {
    A: { id: "A", name: "Truck A", driver: "Ben Lawson" },
    B: { id: "B", name: "Truck B", driver: "Aisha Khan" },
    C: { id: "C", name: "Truck C", driver: "Liam Barrett" },
    P: { id: "P", name: "Pickups", driver: "Warehouse & stores" },
    T: { id: "T", name: "Transfers", driver: "Middle mile" },
    S: { id: "S", name: "Assembly only", driver: "Return visits" },
    F: { id: "F", name: "Parcels / ATL", driver: "FMS" },
  };
  const CARRIERS = {
    radaro: { id: "radaro", name: "Radaro", tms: "Radaro", kind: "tms" },
    regional: { id: "regional", name: "Regional carrier", tms: "CSV / PDF", kind: "carrier" },
    fms: { id: "fms", name: "FMS", tms: "FMS", kind: "fms" },
  };
  const FMS_CARRIERS = [
    { id: "a", name: "Carrier A" },
    { id: "b", name: "Carrier B" },
    { id: "c", name: "Carrier C" },
  ];
  const ROLES = {
    despatcher: { label: "Despatcher", apply: true, overrideTimes: true, submit: true, overrideBlock: false, editProducts: false, editRules: false, editSkillsets: false, allRegions: false },
    regional:   { label: "Regional manager", apply: true, overrideTimes: true, submit: true, overrideBlock: true, editProducts: false, editRules: false, editSkillsets: false, allRegions: false },
    admin:      { label: "Admin", apply: true, overrideTimes: true, submit: true, overrideBlock: true, editProducts: true, editRules: true, editSkillsets: true, allRegions: false },
    global:     { label: "Global manager", apply: true, overrideTimes: true, submit: true, overrideBlock: true, editProducts: true, editRules: true, editSkillsets: true, allRegions: true },
  };
  const defaultModifiers = [
    { id: "new_house", label: "New house", short: "New house, no stairs, no unit", minutes: 0, per: "order" },
    { id: "unit_stairs", label: "Unit with stairs", short: "Unit with stairs", minutes: 10, per: "floor" },
    { id: "high_rise_lift", label: "High-rise apartment (lift)", short: "High-rise with lift", minutes: 15, per: "order" },
    { id: "loading_dock", label: "Loading dock", short: "Loading dock", minutes: 5, per: "order" },
    { id: "three_storey_steep", label: "3-storey house, steep driveway", short: "3-storey, steep driveway", minutes: 25, per: "order" },
  ];

  const state = {
    route: "deliveries",
    settingsTab: "products",
    role: "regional",
    flow: "erp",
    region: "NSW",
    dateFrom: "2026-11-24",
    dateTo: "2026-11-25",
    searchDel: "",
    searchCfg: "",
    searchProd: "",
    delView: "run",
    cfgView: "table",
    filters: {
      paid: true, confirmed: true, ready: true,
      trucks: ["A", "B", "C"],
      types: ["White glove", "Warehouse pickup", "In-store pickup", "ATL", "Transfer", "Assembly only"],
      carriers: ["radaro", "regional", "fms"],
    },
    sort: "delivery_type",
    selected: new Set(),
    skipped: new Set(),
    expanded: new Set(),
    collapsedRuns: new Set(),
    collapsedGroups: new Set(),
    grouping: {
      normaliseAddress: true,
      matchBySiteId: true,
      extraHandlingMinutes: 8,
      maxOrdersPerGroup: 8,
      appliesToTransfers: true,
      appliesToCustomerOrders: true,
    },
    overrides: {},
    blockOverrides: {
      "NS-4832": { reason: "EFT confirmed", note: "Paid by EFT this morning. Receipt is on file.", by: "S. Nguyen, Regional manager", at: "23 Nov 2026, 11:14 am" },
    },
    pulled: false,
    applied: false,
    suggested: false,
    aiRunning: false,
    aiProgress: 0,
    aiDoneCount: 0,
    aiStep: "Reading products...",
    pushed: false,
    exported: false,
    pulling: false,
    applying: false,
    pulledCount: 0,
    picklists: { A: "not", B: "not", C: "not", P: "not", T: "not", S: "not" },
    picklistTimes: {},
    modifiers: defaultModifiers.map((m) => Object.assign({}, m)),
    products: [],
    labels: ["ATL", "Room of choice", "White glove", "Assembly only", "Access check", "Transfer (middle mile)", "Collection or pickup"],
    skillsets: [
      { id: "pickup", name: "Warehouse / in-store pickup", minutes: 10 },
      { id: "chair", name: "Single or swivel chair", minutes: 15 },
      { id: "recliner", name: "Power recliner lounge", minutes: 20 },
      { id: "table", name: "Dining table assembly", minutes: 30 },
      { id: "modular", name: "Large modular or bed", minutes: 45 },
    ],
    jobs: [],
    lastSync: null,
    drawer: null,
    modal: null,
    dryRun: null,
    exportPick: [],
    exportKind: null,
    jobSource: "erp",
    inRadaro: false,
    exportedIds: new Set(),
    removedFromRadaro: new Set(),
    removeFilter: { regional: true, parcel: true },
    _prop: "high_rise_lift",
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function perm() { return ROLES[state.role]; }
  function effectiveRegion() { return perm().allRegions ? state.region : "NSW"; }
  function toast(msg) {
    const host = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }
  function nowTime() {
    return new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Australia/Sydney" }).toLowerCase();
  }
  function nowAudit() {
    return new Date().toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Australia/Sydney" }) + " (Australia/Sydney)";
  }
  function svgCheck() {
    return '<svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5.2 4.2 8.5 11 1.5" stroke="#f9f5ed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function svgMinus() {
    return '<svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="2" rx="1" fill="#f9f5ed"/></svg>';
  }
  function chk(kind) {
    if (kind === "on") return '<span class="chk on">' + svgCheck() + "</span>";
    if (kind === "mix") return '<span class="chk mix">' + svgMinus() + "</span>";
    return '<span class="chk off"></span>';
  }
  function searchIcon() {
    return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.2" stroke="#726c61" stroke-width="1.4"/><path d="M9.2 9.2 12 12" stroke="#726c61" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }
  function stack(items) {
    const show = items.slice(0, 3);
    const extra = items.length - show.length;
    return '<div class="stack">' + show.map(function (i) { return '<img src="' + esc(i.image) + '" alt="">'; }).join("") +
      (extra > 0 ? '<span class="more">+' + extra + "</span>" : "") + "</div>";
  }
  function carrierLabel(job) {
    return job.carrier + (job.tms && job.tms !== job.carrier ? " · " + job.tms : "");
  }
  function modifierFor(id) { return state.modifiers.find(function (m) { return m.id === id; }) || state.modifiers[0]; }
  function modifierMinutes(job) {
    const m = modifierFor(job.property_type);
    if (m.per === "floor") return m.minutes * (job.floors || 0);
    return m.minutes || 0;
  }
  function isPickup(job) {
    return ["Warehouse pickup", "In-store pickup", "Collection"].indexOf(job.delivery_type) !== -1;
  }
  function isParcel(job) {
    return job.delivery_type === "ATL" || job.execution === "fms";
  }
  function isRegional(job) {
    return job.execution === "regional";
  }
  function isTransfer(job) {
    return job.delivery_type === "Transfer" || job.delivery_type === "Transfer (middle mile)";
  }
  function isAssemblyOnly(job) {
    return job.delivery_type === "Assembly only";
  }
  function radaroTag(job) {
    if (isParcel(job)) return "parcel";
    if (isRegional(job)) return "regional";
    return "metro";
  }
  function radaroTagLabel(job) {
    return { parcel: "Parcel/ATL", regional: "Regional", metro: "Last mile" }[radaroTag(job)];
  }
  function unassignedInRadaro() {
    if (state.jobSource !== "radaro" || !state.inRadaro) return [];
    return state.jobs.filter(function (j) {
      return inDate(j) && eligible(j) && radaroTag(j) !== "metro" && !state.removedFromRadaro.has(j.id) &&
        (perm().allRegions || j.region === effectiveRegion() || (effectiveRegion() === "NSW" && j.region === "NSW"));
    });
  }
  function pendingRemoval() {
    return state.jobs.filter(function (j) {
      return state.exportedIds.has(j.id) && !state.removedFromRadaro.has(j.id) && radaroTag(j) !== "metro";
    });
  }
  function radaroMark(kind) {
    var src = kind === "white" ? "assets/radaro-logo-white.png" : "assets/radaro-logo.png";
    return '<img class="radaro-mark" src="' + src + '" alt="Radaro">';
  }
  function sourceSwitchHtml(where) {
    var erp = state.jobSource === "erp";
    return '<div class="source-bar" data-source-where="' + where + '"><span class="k">Job source</span>' +
      '<div class="source-seg">' +
      '<button type="button" data-job-source="erp" class="' + (erp ? "on" : "") + '">Pull from ERP <em>Recommended</em></button>' +
      '<button type="button" data-job-source="radaro" class="' + (erp ? "" : "on") + '">Pull from Radaro</button>' +
      "</div>" +
      '<p class="source-note">' + (erp
        ? "Recommended. Jobs go from ERP to AI config, then you route them to Radaro, a regional carrier, or an FMS. Regional and parcel jobs never sit unassigned in Radaro."
        : "Jobs labelled Regional or Parcel/ATL in Radaro flow into AI config. After you export them, remove them so they don’t sit unassigned in Radaro.") +
      "</p></div>";
  }
  function fmsQuotes(job) {
    var seed = 0;
    for (var i = 0; i < job.id.length; i++) seed += job.id.charCodeAt(i);
    function money(base, step, n) { return Math.round((base + (seed % n) * step) * 100) / 100; }
    return [
      { id: "a", name: "Carrier A", price: money(14.8, 0.9, 8), eta: "2–3 days", tag: "cheapest" },
      { id: "b", name: "Carrier B", price: money(28.5, 1.1, 6), eta: "Next day", tag: "fastest" },
      { id: "c", name: "Carrier C", price: money(21.4, 1.2, 5), eta: "1–2 days", tag: "balanced" },
    ];
  }
  function fmsChoice(job) {
    if (job.fmsChosen) return job.fmsChosen;
    var q = fmsQuotes(job);
    /* Prefer fastest when the packed cube is tiny and the date is tight; otherwise cheapest. */
    return (seedOf(job) % 3 === 0) ? "b" : "a";
  }
  function seedOf(job) {
    var s = 0; for (var i = 0; i < job.id.length; i++) s += job.id.charCodeAt(i); return s;
  }
  function fmsQuote(job, id) {
    id = id || fmsChoice(job);
    return fmsQuotes(job).find(function (q) { return q.id === id; }) || fmsQuotes(job)[0];
  }
  function fmsReason(job, id) {
    var q = fmsQuote(job, id);
    if (q.tag === "cheapest") return "Cheapest at $" + q.price.toFixed(2) + ", " + q.eta + ".";
    if (q.tag === "fastest") return "Fastest: " + q.eta.toLowerCase() + " at $" + q.price.toFixed(2) + ".";
    return q.tag.charAt(0).toUpperCase() + q.tag.slice(1) + " option: $" + q.price.toFixed(2) + ", " + q.eta + ".";
  }
  function autoLabels(job) {
    if (isAssemblyOnly(job)) return ["Assembly only"];
    if (isParcel(job)) return ["ATL"];
    if (isPickup(job)) return ["Collection or pickup"];
    if (isTransfer(job)) return ["Transfer (middle mile)"];
    const labels = ["White glove"];
    const access = ["unit_stairs", "high_rise_lift", "three_storey_steep"].indexOf(job.property_type) !== -1 ||
      job.items.some(function (i) { return (i.pieces || 0) >= 10 || (i.cubic_m3 || 0) >= 4; });
    if (access) labels.push("Access check");
    return labels;
  }
  function whyText(job) {
    if (isAssemblyOnly(job)) return "Goods are already at the house (for example in the garage because the house was not ready). This is assembly only — no delivery leg, so it does not take truck space. White glove already includes assembly when the goods go out on the truck.";
    if (isParcel(job)) return "ATL / parcel via FMS. About 10 min to pack, label and hand over. The FMS then recommends a carrier on price and speed; you can override the recommendation.";
    if (isPickup(job)) return "About 10 min to bring out the goods, take POD photos and collect a signature.";
    if (isTransfer(job)) return "Middle-mile transfer. Timed like a stop at this address. If other orders share the address, they group into one stop — the first order takes the full time, and each extra order only adds its handling share.";
    const bases = job.items.map(function (i) { return i.base_minutes; }).sort(function (a, b) { return b - a; });
    const max = bases[0];
    const rest = bases.slice(1).reduce(function (a, b) { return a + b; }, 0);
    const add = rest / 3;
    const sub = Math.round(max + add);
    const sum = bases.reduce(function (a, b) { return a + b; }, 0);
    const mod = modifierMinutes(job);
    const m = modifierFor(job.property_type);
    var t;
    if (bases.length === 1) t = max + " min white glove for " + job.items[0].name + ".";
    else t = "Largest item " + max + " min. Each extra item adds one-third of its own time, so " + max + " + " + Math.round(add) + " = " + sub + ", not " + sum + ".";
    if (mod) t += m.per === "floor" ? " Plus " + m.minutes + " min per floor × " + job.floors + "." : " Plus " + mod + " min for " + m.short.toLowerCase() + ".";
    return t;
  }
  function compute(job) {
    if (isAssemblyOnly(job)) {
      const bases = job.items.map(function (i) { return i.base_minutes; }).sort(function (a, b) { return b - a; });
      const max = bases[0] || 20;
      const rest = bases.slice(1).reduce(function (a, b) { return a + b; }, 0);
      const minutes = Math.round(max + rest / 3);
      return { minutes: minutes, labels: autoLabels(job), itemSubtotal: minutes, modifier: 0, confidence: 90, why: whyText(job) };
    }
    if (isParcel(job) || isPickup(job)) {
      return { minutes: 10, labels: autoLabels(job), itemSubtotal: 10, modifier: 0, confidence: isParcel(job) ? 92 : 94, why: whyText(job) };
    }
    const bases = job.items.map(function (i) { return i.base_minutes; }).sort(function (a, b) { return b - a; });
    const max = bases[0] || 0;
    const rest = bases.slice(1).reduce(function (a, b) { return a + b; }, 0);
    const itemSubtotal = Math.round(max + rest / 3);
    const modifier = modifierMinutes(job);
    const minutes = itemSubtotal + modifier;
    var confidence = 96 - (job.items.length - 1) * 5 - (modifier ? 6 : 0) - (minutes > 50 ? 4 : 0);
    confidence = Math.max(72, Math.min(97, confidence));
    return { minutes: minutes, labels: autoLabels(job), itemSubtotal: itemSubtotal, modifier: modifier, confidence: confidence, why: whyText(job) };
  }

  function groupingApplies(job) {
    if (isParcel(job) || isPickup(job) || isAssemblyOnly(job)) return false;
    if (isTransfer(job)) return !!state.grouping.appliesToTransfers;
    return !!state.grouping.appliesToCustomerOrders;
  }
  function normaliseAddress(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\b(unit|apt|apartment|suite|level|u)\s*[\w-]+\b/g, " ")
      .replace(/^\s*\d+\s*\//, " ")
      .replace(/[.,#]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function groupKey(job) {
    if (state.grouping.matchBySiteId && job.site_id) return "site:" + job.site_id;
    var addr = state.grouping.normaliseAddress ? normaliseAddress(job.address) : String(job.address || "").trim().toLowerCase();
    return "addr:" + addr;
  }
  function groupJobs(jobs) {
    var buckets = {};
    var order = [];
    jobs.forEach(function (j) {
      var k = groupingApplies(j) ? groupKey(j) : "solo:" + j.id;
      if (!buckets[k]) { buckets[k] = []; order.push(k); }
      buckets[k].push(j);
    });
    var out = [];
    var max = Math.max(1, state.grouping.maxOrdersPerGroup || 8);
    order.forEach(function (k) {
      var list = buckets[k];
      if (k.indexOf("solo:") === 0 || list.length === 1) {
        list.forEach(function (j) { out.push({ key: "solo:" + j.id, jobs: [j] }); });
        return;
      }
      for (var i = 0; i < list.length; i += max) {
        var slice = list.slice(i, i + max);
        var suffix = list.length > max ? ":" + Math.floor(i / max) : "";
        out.push({ key: k + suffix, jobs: slice });
      }
    });
    return out;
  }
  function groupTimes(jobs) {
    var scored = jobs.map(function (j) { return { job: j, minutes: compute(j).minutes }; });
    scored.sort(function (a, b) { return b.minutes - a.minutes || a.job.id.localeCompare(b.job.id); });
    var first = scored[0] ? scored[0].minutes : 0;
    var extra = state.grouping.extraHandlingMinutes || 0;
    var add = Math.max(0, jobs.length - 1) * extra;
    return { first: first, extra: extra, add: add, total: first + add, lead: scored[0] && scored[0].job };
  }
  function whyGroup(g) {
    var t = groupTimes(g.jobs);
    var n = g.jobs.length;
    var lead = t.lead ? t.lead.id : "the first order";
    return "Same delivery address, " + n + " orders, one stop. " + lead + " takes the full service time of " + t.first + " min. Each extra order adds only its " + t.extra + "-min handling share — no second arrival or setup. " + t.first + " + " + t.extra + " × " + (n - 1) + " = " + t.total + " min.";
  }
  function truckCubicOf(job) {
    if (isAssemblyOnly(job)) return 0;
    return job.cubic_m3 || 0;
  }

  function displayOf(job) {
    const conf = compute(job);
    const ov = state.overrides[job.id];
    if (ov) return { minutes: ov.minutes, labels: [ov.label], confidence: conf.confidence, why: conf.why, status: "overridden" };
    if (state.skipped.has(job.id)) return { minutes: null, labels: [], confidence: null, why: conf.why, status: "skipped" };
    if (state.applied) return { minutes: conf.minutes, labels: conf.labels, confidence: conf.confidence, why: conf.why, status: "configured" };
    if (state.suggested) return { minutes: conf.minutes, labels: conf.labels, confidence: conf.confidence, why: conf.why, status: "suggested" };
    return { minutes: DEFAULT_MIN, labels: [], confidence: null, why: conf.why, status: "pending" };
  }
  function isHeld(job) {
    if (job.held === "overridden_eft") return false;
    if (state.blockOverrides[job.id] && (job.held === "not_paid" || job.held === "not_ready")) return false;
    if (job.held === "not_paid" || job.held === "not_ready") return true;
    if (!job.paid || !job.ready) return true;
    return false;
  }
  function eligible(job) { return !isHeld(job) && job.confirmed !== false; }
  function inDate(job) { return job.date >= state.dateFrom && job.date <= state.dateTo; }
  function inCfgScope(job, opts) {
    const region = effectiveRegion();
    if (region !== "All Australia" && job.region !== region) return false;
    if (!inDate(job)) return false;
    if (!eligible(job)) return false;
    if (state.filters.carriers.length && state.filters.carriers.indexOf(job.execution) === -1) return false;
    if (!(opts && opts.ignoreSearch)) {
      const q = state.searchCfg.trim().toLowerCase();
      if (q && (job.id + " " + job.customer + " " + job.suburb).toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  }
  function cfgJobs() { return state.jobs.filter(inCfgScope); }
  function delJobs() {
    const q = state.searchDel.trim().toLowerCase();
    return state.jobs.filter(function (j) {
      if (!perm().allRegions && j.region !== "NSW") return false;
      if (j.date !== "2026-11-24" && !isHeld(j) && j.region === "NSW") return false;
      if (j.region !== "NSW" && !perm().allRegions) return false;
      /* Deliveries focuses on the 24 Nov NSW work day when not global; global still uses filters */
      if (!perm().allRegions && j.date !== "2026-11-24" && !isHeld(j)) return false;
      if (perm().allRegions && j.region !== "NSW" && j.date !== "2026-11-24" && j.date !== "2026-11-25") {
        /* keep */
      }
      if (q && (j.id + " " + j.customer + " " + j.suburb + " " + j.address).toLowerCase().indexOf(q) === -1) return false;
      if (state.filters.types.length && state.filters.types.indexOf(j.delivery_type) === -1 && !isHeld(j)) return false;
      if (state.filters.carriers.length && state.filters.carriers.indexOf(j.execution) === -1 && !isHeld(j)) return false;
      if (!isHeld(j)) {
        if (state.filters.paid && !j.paid) return false;
        if (state.filters.confirmed && j.confirmed === false) return false;
        if (state.filters.ready && !j.ready) return false;
      }
      if (state.pushed && j.planned_run && "ABC".indexOf(j.planned_run) !== -1 && state.filters.trucks.length && state.filters.trucks.indexOf(j.planned_run) === -1 && !isHeld(j)) return false;
      if (!perm().allRegions && j.region !== "NSW") return false;
      if (perm().allRegions) {
        /* show NSW 24 Nov runs plus other-region jobs in date range (for carrier work) */
        const nswDay = j.region === "NSW" && (j.date === "2026-11-24" || isHeld(j));
        const other = j.region !== "NSW" && inDate(j);
        if (!nswDay && !other) return false;
      }
      return true;
    });
  }
  function runCubic(id, jobs) {
    return jobs.filter(function (j) { return j.planned_run === id && !isHeld(j); }).reduce(function (a, j) { return a + truckCubicOf(j); }, 0);
  }
