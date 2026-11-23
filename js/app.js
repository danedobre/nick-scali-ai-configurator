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

  /* ---------- chrome ---------- */
  function renderNav() {
    const links = [["deliveries", "Deliveries"], ["configurator", "AI configurator"], ["settings", "Settings"], ["impact", "Impact"]];
    $("#main-nav").innerHTML = links.map(function (x) {
      return '<a href="#/' + x[0] + '" class="' + (state.route === x[0] ? "on" : "") + '">' + x[1] + "</a>";
    }).join("");
  }
  function renderFlow() {
    const fromErp = state.jobSource === "erp";
    const steps = fromErp
      ? [["erp", "ERP"], ["ai", "AI config"]]
      : [["erp", "ERP"], ["radaro", "Radaro"], ["ai", "AI config"]];
    const branches = [
      ["routes", "Radaro push"],
      ["export", "Carrier export"],
      ["fms", "FMS parcel export"],
    ];
    const order = fromErp
      ? ["erp", "ai", "routes", "picklists", "export", "fms"]
      : ["erp", "radaro", "ai", "routes", "picklists", "export", "fms"];
    function cls(id) {
      if (id === "routes" && state.flow === "picklists") return "done";
      if (id === state.flow) return "now";
      const idx = order.indexOf(state.flow);
      const aiIdx = order.indexOf("ai");
      if (["routes", "export", "fms", "picklists"].indexOf(state.flow) !== -1 && order.indexOf(id) <= aiIdx && order.indexOf(id) !== -1) return "done";
      if (idx > -1 && order.indexOf(id) > -1 && order.indexOf(id) < idx && idx <= aiIdx) return "done";
      return "";
    }
    var html = steps.map(function (s, i) {
      return (i ? "<i></i>" : "") + '<button type="button" class="' + cls(s[0]) + '" data-flow="' + s[0] + '">' + s[1] + "</button>";
    }).join("");
    html += '<i></i><span class="branch">';
    branches.forEach(function (b, i) {
      if (i) html += '<span class="or">or</span>';
      html += '<button type="button" class="' + cls(b[0]) + '" data-flow="' + b[0] + '">' + b[1] + "</button>";
    });
    html += "</span>";
    $("#flow").innerHTML = html;
  }

  function statusCell(job) {
    if (isHeld(job) && job.held === "not_paid") return '<span class="pill pill-mute">Not paid</span>';
    if (isHeld(job) && job.held === "not_ready") {
      return '<span class="pill pill-amber">Not ready</span><div class="note note-wait">Goods being unpacked, ready by 2 pm</div>';
    }
    var bits = ['<span class="pill pill-ok">Ready</span>'];
    var ov = state.blockOverrides[job.id];
    if (job.held === "overridden_eft" || (ov && !isHeld(job))) {
      var src = ov || state.blockOverrides["NS-4832"];
      if (src) bits.push('<div class="note note-ovr">Override: ' + esc(src.reason) + " · " + esc(src.by) + "</div>");
    }
    if (job.manual_from) bits.push('<div class="note note-man">Manual change · from Truck ' + esc(job.manual_from) + "</div>");
    if (isParcel(job)) {
      var q = fmsQuote(job);
      bits.push('<div class="note">' + esc(q.name) + " · $" + q.price.toFixed(2) + " · " + esc(q.eta) + "</div>");
    }
    return bits.join("");
  }
  function utilBar(pct, wide) {
    return '<div class="util"><div class="track" style="width:' + (wide || 88) + 'px"><div class="fill' + (pct < TARGET_PCT ? " amber" : "") + '" style="width:' + Math.min(100, pct) + '%"></div><i class="mark" style="left:' + TARGET_PCT + '%"></i></div></div>';
  }
  function picklistChip(runId) {
    var s = state.picklists[runId];
    if (s === "picked") return '<span class="pill pill-ok">Picked</span>';
    if (s === "sent") return '<span class="pill pill-ok">Sent ' + esc(state.picklistTimes[runId] || "") + "</span>";
    return '<span class="pill pill-mute">Not sent</span>';
  }
  function execCell(job) {
    return '<div class="exec">' + esc(job.carrier) + (job.tms && job.tms !== job.carrier ? '<div class="tms">' + esc(job.tms) + "</div>" : "") + "</div>";
  }

  function renderDeliveries() {
    var jobs = delJobs();
    if (state.sort === "delivery_type") jobs.sort(function (a, b) { return a.delivery_type.localeCompare(b.delivery_type) || a.id.localeCompare(b.id); });
    else if (state.sort === "suburb") jobs.sort(function (a, b) { return a.suburb.localeCompare(b.suburb); });
    else jobs.sort(function (a, b) { return a.id.localeCompare(b.id); });
    var typeChips = DELIVERY_TYPES.map(function (t) {
      var on = state.filters.types.indexOf(t) !== -1;
      return '<button type="button" class="tchip' + (on ? "" : " off") + '" data-type="' + esc(t) + '">' + esc(t) + (on ? " <i>×</i>" : "") + "</button>";
    }).join("");
    var truckChips = ["A", "B", "C"].map(function (t) {
      var on = state.filters.trucks.indexOf(t) !== -1;
      return '<button type="button" class="tchip' + (on ? "" : " off") + '" data-truck="' + t + '">Truck ' + t + (on ? " <i>×</i>" : "") + "</button>";
    }).join("");
    var carrierChips = Object.keys(CARRIERS).map(function (id) {
      var c = CARRIERS[id];
      var on = state.filters.carriers.indexOf(id) !== -1;
      return '<button type="button" class="tchip' + (on ? "" : " off") + '" data-carrier="' + id + '">' + esc(c.name) + (on ? " <i>×</i>" : "") + "</button>";
    }).join("");
    var fleetHtml;
    if (state.pushed) {
      var fleetJobs = state.jobs.filter(function (j) { return j.date === "2026-11-24" && j.planned_run && "ABC".indexOf(j.planned_run) !== -1 && !isHeld(j); });
      var used = ["A", "B", "C"].reduce(function (a, id) { return a + runCubic(id, fleetJobs); }, 0);
      var pct = Math.round((used / 90) * 100);
      fleetHtml = '<div class="fleet"><b>Fleet utilisation ' + pct + "%</b>" + utilBar(pct, 120) + "<span>3 trucks · target " + TARGET_PCT + "%</span></div>";
    } else {
      fleetHtml = '<div class="fleet"><b>Routes not assigned yet</b><span>Configure times, then push to Radaro or export to a regional carrier or FMS.</span></div>';
    }
    var body = state.delView === "grid" ? renderDelGrid(jobs) : state.delView === "run" ? renderDelRuns(jobs) : renderDelTable(jobs, true);
    return '<div class="page"><aside class="filters"><h2 class="k">Filters</h2>' +
      '<div class="field"><label>Date range</label><div class="box">24 Nov 2026</div></div>' +
      '<div class="filter" data-filter="paid">' + chk(state.filters.paid ? "on" : "off") + " Paid</div>" +
      '<div class="filter" data-filter="confirmed">' + chk(state.filters.confirmed ? "on" : "off") + " Confirmed</div>" +
      '<div class="filter" data-filter="ready">' + chk(state.filters.ready ? "on" : "off") + " Ready</div>" +
      '<div class="field" style="margin-top:18px"><label>Trucks</label><div class="chips">' + truckChips + "</div></div>" +
      '<div class="field"><label>Execution</label><div class="chips">' + carrierChips + "</div></div>" +
      '<div class="field"><label>Delivery type</label><div class="chips">' + typeChips + "</div></div>" +
      '</aside><main class="stage"><div class="tools">' +
      '<div class="search">' + searchIcon() + '<input id="search-del" placeholder="Search order #, customer, suburb" value="' + esc(state.searchDel) + '"></div>' +
      '<div class="sortby">Sort by <select id="sort-del"><option value="delivery_type"' + (state.sort === "delivery_type" ? " selected" : "") + '>Delivery type</option><option value="order"' + (state.sort === "order" ? " selected" : "") + '>Order</option><option value="suburb"' + (state.sort === "suburb" ? " selected" : "") + ">Suburb</option></select></div>" +
      '<div class="seg" id="del-view"><button type="button" data-view="table" class="' + (state.delView === "table" ? "on" : "") + '">Table</button><button type="button" data-view="grid" class="' + (state.delView === "grid" ? "on" : "") + '">Grid</button><button type="button" data-view="run" class="' + (state.delView === "run" ? "on" : "") + '">Group by run</button></div>' +
      '<button class="btn btn-ghost" id="btn-save">Save</button>' +
      '<button class="btn btn-ghost" id="btn-submit-all"' + (state.pushed ? "" : " disabled") + ">Submit all picklists</button>" +
      '<button class="btn btn-navy" id="btn-sync-erp">' + (state.jobSource === "erp" ? "Send to AI configurator" : radaroMark("white") + " Sync to Radaro") + '</button>' +
      "</div>" + fleetHtml + body + "</main></div>";
  }
  function headers(withRun) {
    return "<thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Order details</th><th>Delivery type</th><th>Execution</th>" + (withRun ? "<th>Run</th>" : "") + "<th>Status</th></tr></thead>";
  }
  function jobRow(job, withRun, expandable, inGroup) {
    var held = isHeld(job);
    var items = job.items;
    var details = items.length > 1 ? items.length + " items · whole house" : items[0].name;
    var runNames = { P: "Pickups", F: "Parcels / ATL", T: "Transfers", S: "Assembly only" };
    var run = job.planned_run && state.pushed && !held ? (runNames[job.planned_run] || ("Truck " + job.planned_run)) : "—";
    if (isParcel(job) && !held) run = "Parcels / ATL";
    var open = state.expanded.has(job.id);
    var extra = "";
    if (open) {
      extra = '<tr class="expand-body"><td></td><td colspan="' + (withRun ? 7 : 6) + '"><div class="lines">' + items.map(function (i) {
        return '<div class="line"><img class="shot" src="' + esc(i.image) + '" alt=""><div><strong>' + esc(i.name) + '</strong><span class="sub">' + esc(i.configuration || "") + "</span></div></div>";
      }).join("") + "</div></td></tr>";
    }
    var canOverride = held && perm().overrideBlock;
    return '<tr class="' + (held ? "mute " : "") + (expandable ? "expandable " : "") + (inGroup ? "child-row " : "") + '" data-expand="' + job.id + '">' +
      '<td class="onum">' + esc(job.id) + "</td>" +
      '<td><div class="name">' + esc(job.customer) + '</div><div class="sub">' + esc(job.suburb) + "</div></td>" +
      "<td>" + (items.length > 1 ? stack(items) : '<img class="shot" src="' + esc(items[0].image) + '" alt="">') + "</td>" +
      "<td>" + esc(details) + "</td><td>" + esc(job.delivery_type) + "</td><td>" + execCell(job) + "</td>" +
      (withRun ? '<td class="sub">' + esc(run) + "</td>" : "") +
      "<td>" + statusCell(job) + (held && canOverride ? ' <button class="btn btn-ghost btn-sm" data-override-block="' + job.id + '">Override</button>' : "") +
      (held && !canOverride ? '<div class="note">Managers only</div>' : "") + "</td></tr>" + extra;
  }

  function stopRows(jobs, withRun, expandable) {
    var html = "";
    groupJobs(jobs).forEach(function (g) {
      if (g.jobs.length === 1) {
        html += jobRow(g.jobs[0], withRun, expandable);
        return;
      }
      var t = groupTimes(g.jobs);
      var collapsed = state.collapsedGroups.has("del:" + g.key);
      var where = g.jobs[0].suburb + (g.jobs[0].site_id ? "" : "");
      var time = state.applied ? (t.total + '<span class="u">min</span>') : (g.jobs.length + " orders");
      html += '<tr class="group-row" data-toggle-group="del:' + esc(g.key) + '"><td colspan="' + (withRun ? 8 : 7) + '"><div class="gstop"><button type="button" class="chev" aria-label="Toggle group">' + (collapsed ? "▸" : "▾") + '</button><span class="name">' + esc(where) + " · " + g.jobs.length + " orders · 1 stop</span>" +
        (state.applied ? '<span class="why"><span class="mins">' + t.total + '<span class="u">min</span></span><i>?</i><div class="tooltip"><b>Why</b>' + esc(whyGroup(g)) + "</div></span>" : "") +
        "</div></td></tr>";
      if (!collapsed) g.jobs.forEach(function (j) { html += jobRow(j, withRun, expandable, true); });
    });
    return html;
  }
  function renderDelTable(jobs, withRun) {

    var showRun = withRun && state.delView === "table";
    return '<table class="data">' + headers(showRun) + "<tbody>" + (jobs.length ? stopRows(jobs, showRun, true) : '<tr><td colspan="8" class="muted">No orders match the filters.</td></tr>') + "</tbody></table>";
  }
  function renderDelGrid(jobs) {
    return '<div class="grid">' + jobs.map(function (j) {
      return '<article class="card ' + (isHeld(j) ? "mute" : "") + '"><div class="hero-shot">' +
        (j.items.length > 1 ? j.items.slice(0, 3).map(function (i) { return '<img src="' + esc(i.image) + '" alt="" style="height:90px;width:30%;object-fit:contain">'; }).join("") : '<img src="' + esc(j.items[0].image) + '" alt="">') +
        '</div><div class="top"><span class="onum">' + esc(j.id) + "</span>" +
        (isHeld(j) && j.held === "not_paid" ? '<span class="pill pill-mute">Not paid</span>' : isHeld(j) ? '<span class="pill pill-amber">Not ready</span>' : '<span class="pill pill-ok">Ready</span>') +
        '</div><div class="name">' + esc(j.customer) + '</div><div class="sub">' + esc(j.suburb) + " · " + esc(j.delivery_type) + " · " + esc(j.carrier) + "</div></article>";
    }).join("") + "</div>";
  }
  function renderDelRuns(jobs) {
    function sectionFor(id, rows, opts) {
      opts = opts || {};
      if (!rows.length && !opts.keep) return "";
      var run = RUNS[id] || { name: opts.name, driver: opts.driver || "" };
      var collapsed = state.collapsedRuns.has(id);
      var used = (id === "A" || id === "B" || id === "C") ? runCubic(id, rows) : 0;
      var pct = (id === "A" || id === "B" || id === "C") ? Math.round((used / TRUCK_CAP) * 100) : null;
      var under = pct !== null && pct < TARGET_PCT;
      var util = "";
      if (id === "P" || id === "S") util = '<div class="sub">Not on a delivery truck</div>';
      else if (id === "T") util = '<div class="sub">Middle mile · grouped by address</div>';
      else if (pct !== null) util = '<div class="util"><div class="track"><div class="fill' + (under ? " amber" : "") + '" style="width:' + Math.min(100, pct) + '%"></div><i class="mark" style="left:' + TARGET_PCT + '%"></i></div><span class="pct">' + pct + '%</span><span class="vol">' + used.toFixed(1) + '<span class="u">m³</span> / 30<span class="u">m³</span></span></div>' + (under ? '<span class="pill pill-amber">Under 80%</span>' : "");
      var cta = "";
      if (opts.exportKind) cta = '<button type="button" class="btn btn-navy btn-sm" data-export-kind="' + opts.exportKind + '">' + esc(opts.exportLabel) + "</button>";
      else {
        var cls = state.picklists[id] === "not" ? "btn btn-navy btn-sm" : "btn btn-ghost btn-sm";
        cta = picklistChip(id) + '<button type="button" class="' + cls + '" data-submit-run="' + id + '">Submit picklist</button>';
      }
      var status = opts.status || (id === "P" || id === "S" || id === "T" ? "Assigned" : "Route published");
      return '<section class="run"><div class="rhead" data-toggle-run="' + id + '"><div class="id">' + esc(run.name || opts.name) + '</div><div class="drv">' + esc(run.driver || opts.driver || "") + '</div><div class="jobs">' + rows.length + " job" + (rows.length === 1 ? "" : "s") + "</div>" + util + '<div class="grow"></div><div class="status">' + status + "</div>" + cta + "</div>" +
        (collapsed ? "" : '<table class="data">' + headers(false) + "<tbody>" + stopRows(rows, false, true) + "</tbody></table>") + "</section>";
    }
    var held = jobs.filter(isHeld);
    var parcels = jobs.filter(function (j) { return !isHeld(j) && isParcel(j); });
    var regional = jobs.filter(function (j) { return !isHeld(j) && isRegional(j); });
    var transfers = jobs.filter(function (j) { return !isHeld(j) && isTransfer(j) && !isRegional(j) && !isParcel(j); });
    var assembly = jobs.filter(function (j) { return !isHeld(j) && isAssemblyOnly(j); });
    var html = "";
    if (!state.pushed) {
      var unassigned = jobs.filter(function (j) {
        return !isHeld(j) && !isParcel(j) && !isRegional(j) && !isTransfer(j) && !isAssemblyOnly(j) && j.planned_run !== "T" && j.planned_run !== "S";
      });
      html += '<section class="run"><div class="rhead"><div class="id">Unassigned</div><div class="drv">' + unassigned.length + " orders · waiting for routes</div></div><table class=\"data\">" + headers(false) + "<tbody>" + stopRows(unassigned, false, true) + "</tbody></table></section>";
      if (transfers.length) html += sectionFor("T", transfers, { status: "Ready to group", keep: true });
      if (assembly.length) html += sectionFor("S", assembly, { status: "Return visits", keep: true });
      if (regional.length) html += sectionFor("R", regional, { name: "Regional carrier", driver: "External carrier", exportKind: "regional", exportLabel: "Export to carriers", status: "Regional export", keep: true });
      if (parcels.length) html += parcelGroup(parcels);
      html += renderHeld(held);
      return html;
    }
    ["A", "B", "C", "P"].forEach(function (id) {
      if (id !== "P" && state.filters.trucks.indexOf(id) === -1) return;
      var rows = jobs.filter(function (j) { return j.planned_run === id && !isHeld(j) && !isParcel(j) && !isTransfer(j) && !isAssemblyOnly(j); });
      html += sectionFor(id, rows, { keep: id === "P" });
    });
    if (transfers.length) html += sectionFor("T", transfers, { status: "Grouped stops" });
    if (assembly.length) html += sectionFor("S", assembly, { status: "Return visits" });
    if (regional.length) html += sectionFor("R", regional, { name: "Regional carrier", driver: "External carrier", exportKind: "regional", exportLabel: "Export to carriers", status: "Regional export" });
    if (parcels.length) html += parcelGroup(parcels);
    html += renderHeld(held);
    return html;
  }
  function parcelGroup(rows) {
    var collapsed = state.collapsedRuns.has("F");
    return '<section class="run"><div class="rhead" data-toggle-run="F"><div class="id">Parcels / ATL</div><div class="drv">FMS</div><div class="jobs">' + rows.length + " job" + (rows.length === 1 ? "" : "s") + '</div><div class="grow"></div><div class="status">FMS recommendation</div><button type="button" class="btn btn-navy btn-sm" data-export-kind="fms">Export to FMS</button></div>' +
      (collapsed ? "" : '<table class="data">' + headers(false) + "<tbody>" + rows.map(function (j) { return jobRow(j, false, true); }).join("") + "</tbody></table>") + "</section>";
  }
  function renderHeld(held) {
    if (!held.length) return "";
    return '<section class="run held"><div class="rhead"><div class="id">Held</div><div class="drv">' + held.length + " order" + (held.length === 1 ? "" : "s") + ' · blocked from Sync to Radaro</div><div class="grow"></div></div><table class="data">' + headers(false) + "<tbody>" + held.map(function (j) { return jobRow(j, false, false); }).join("") + "</tbody></table></section>";
  }

  function fmsBlock(job) {
    if (!isParcel(job)) return "";
    var chosen = fmsChoice(job);
    var q = fmsQuote(job, chosen);
    var opts = fmsQuotes(job).map(function (x) {
      return '<option value="' + x.id + '"' + (x.id === chosen ? " selected" : "") + ">" + esc(x.name) + " · $" + x.price.toFixed(2) + " · " + esc(x.eta) + (x.tag === "cheapest" || x.tag === "fastest" ? " (" + x.tag + ")" : "") + "</option>";
    }).join("");
    return '<div class="fms"><select data-fms-choice="' + job.id + '">' + opts + '</select><span class="tag' + (q.tag === "fastest" ? " fast" : "") + '">' + esc(q.tag) + '</span><div class="meta">' + esc(fmsReason(job, chosen)) + "</div></div>";
  }

  function renderConfigurator() {
    var region = effectiveRegion();
    var jobs = cfgJobs();
    var regionPills = REGIONS.map(function (r) {
      var allowed = perm().allRegions || r === "NSW";
      return '<button type="button" class="reg' + (r === region ? " on" : "") + '" data-region="' + esc(r) + '" ' + (allowed ? "" : "disabled") + ">" + esc(r) + "</button>";
    }).join("");
    var carrierChips = Object.keys(CARRIERS).map(function (id) {
      var c = CARRIERS[id], on = state.filters.carriers.indexOf(id) !== -1;
      return '<button type="button" class="tchip' + (on ? "" : " off") + '" data-carrier="' + id + '">' + esc(c.name) + (on ? " <i>×</i>" : "") + "</button>";
    }).join("");
    var srcName = state.jobSource === "erp" ? "ERP" : "Radaro";
    var una = unassignedInRadaro();
    var pending = pendingRemoval();
    var unaHtml = "";
    if (state.jobSource === "radaro" && state.inRadaro && una.length) {
      var nR = una.filter(isRegional).length, nP = una.filter(isParcel).length;
      unaHtml = '<div class="unassigned"><b>' + una.length + " unassigned in Radaro</b> · " + nR + " Regional · " + nP + " Parcel/ATL" +
        (pending.length ? ' <button type="button" class="btn btn-ghost btn-sm" id="btn-remove-radaro">Remove exported jobs from Radaro · ' + pending.length + "</button>" : "") +
        "</div>";
    }
    var status = state.pulling ? '<div class="status-line"><b class="pulling">Pulling jobs from ' + srcName + "</b></div>"
      : state.pulled ? '<div class="status-line"><b>Pulled ' + state.pulledCount + " jobs from " + srcName + "</b> · " + esc(region) + " · 24–25 Nov</div>" + unaHtml
      : '<div class="status-line">Pull from ' + srcName + " to load jobs for " + esc(region) + ".</div>";
    var visible = state.pulled ? jobs : [];
    var selectedVis = visible.filter(function (j) { return state.selected.has(j.id) && !state.skipped.has(j.id); });
    var allSel = visible.length && selectedVis.length === visible.filter(function (j) { return !state.skipped.has(j.id); }).length;
    var selKind = allSel ? "on" : selectedVis.length ? "mix" : "off";
    var table;
    if (!state.pulled) table = '<p class="muted" style="padding:48px 0">No jobs in the configurator yet. Pull from ' + (state.jobSource === "erp" ? "ERP" : "Radaro") + " to load the " + esc(region) + " slate.</p>";
    else if (state.cfgView === "cards") table = renderCfgCards(visible);
    else table = '<table class="data"><thead><tr><th style="width:36px"><button type="button" id="select-all">' + chk(selKind) + "</button></th><th>Order</th><th>Customer</th><th>Items</th><th>Property type</th><th>Execution</th><th>Current</th><th>AI skillset</th><th>AI labels</th><th>Confidence</th><th>Status</th></tr></thead><tbody>" + renderCfgBody(visible) + '</tbody></table><div class="sub" style="padding:10px 0 0">Showing ' + visible.length + " of " + state.pulledCount + " jobs</div>";
    var exportable = state.pulled ? selectedConfigured() : [];
    var radaroN = exportable.filter(function (j) { return j.execution === "radaro"; }).length;
    var carN = exportable.filter(isRegional).length;
    var fmsN = exportable.filter(isParcel).length;
    var pulledList = state.pulled ? state.jobs.filter(function (j) { return inCfgScope(j, { ignoreSearch: true }); }) : [];
    var regionCarN = pulledList.filter(isRegional).length;
    var nSel = exportable.length;
    var canAct = state.pulled && nSel > 0;
    return "<div><div class=\"cfg-bar\"><div class=\"regions\">" + regionPills + "</div>" +
      '<div class="box" style="width:auto;display:flex;align-items:center;height:36px">24–25 Nov 2026</div>' +
      '<div class="search" style="flex:1;height:36px">' + searchIcon() + '<input id="search-cfg" placeholder="Search order #, customer, suburb" value="' + esc(state.searchCfg) + '"></div>' +
      '<button class="btn btn-navy" id="btn-sync-cfg">' + (state.jobSource === "erp" ? "Pull from ERP" : radaroMark("white") + " Pull from Radaro") + "</button>" +
      '<div class="seg" id="cfg-view"><button type="button" data-cfgview="table" class="' + (state.cfgView === "table" ? "on" : "") + '">Table</button><button type="button" data-cfgview="cards" class="' + (state.cfgView === "cards" ? "on" : "") + '">Cards</button></div></div>' +
      sourceSwitchHtml("configurator") +
      '<div class="cfg-bar" style="padding-top:0"><span class="k" style="margin-right:8px">Execution</span><div class="chips">' + carrierChips + "</div></div>" +
      status + '<div class="cfg-table-wrap">' + table + "</div>" +
      '<div class="sticky"><div class="selcount">' + selectedVis.length + " selected</div>" +
      '<div class="dry">Preview a dry run before pushing or exporting.</div>' +
      '<div class="sticky-actions">' +
      '<button class="btn btn-ghost" id="btn-dry"' + (canAct ? "" : " disabled") + ">Preview dry run</button>" +
      '<button class="btn btn-ghost" id="btn-apply"' + (canAct ? "" : " disabled") + ">Apply AI configuration</button>" +
      '<button class="btn btn-navy" id="btn-push"' + (state.applied && radaroN ? "" : " disabled") + ">" + radaroMark("white") + " Push to Radaro" + (radaroN ? " · " + radaroN : "") + "</button>" +
      '<button class="btn btn-ghost" id="btn-export-reg"' + (state.applied && carN ? "" : " disabled") + ">Export to carriers" + (carN ? " · " + carN : "") + "</button>" +
      '<button class="btn btn-ghost" id="btn-export-fms"' + (state.applied && fmsN ? "" : " disabled") + ">Export to FMS" + (fmsN ? " · " + fmsN : "") + "</button>" +
      "</div>" +
      (state.pulled && !nSel ? '<div class="hint">Select jobs to apply, push or export.</div>' : "") +
      (state.applied && nSel && !regionCarN ? '<div class="hint">No regional jobs in this region. Switch View as to Global manager and choose All Australia.</div>' : "") +
      "</div></div>";
  }
  function labelChips(labels) {
    if (!labels.length) return '<span class="muted">—</span>';
    return '<div class="chips">' + labels.map(function (l) {
      var cls = l === "Access check" ? "chip chip-acc" : (l === "Assembly" || l === "Assembly only" ? "chip chip-asm" : "chip");
      return '<span class="' + cls + '">' + esc(l) + "</span>";
    }).join("") + "</div>";
  }

  function renderCfgBody(jobs) {
    var html = "";
    groupJobs(jobs).forEach(function (g) {
      if (g.jobs.length === 1) { html += cfgRow(g.jobs[0]); return; }
      var t = groupTimes(g.jobs);
      var collapsed = state.collapsedGroups.has("cfg:" + g.key);
      var allSel = g.jobs.every(function (j) { return state.selected.has(j.id) && !state.skipped.has(j.id); });
      var timeCell = state.applied
        ? '<div class="why"><span class="mins">' + t.total + '<span class="u">min</span></span><i>?</i><div class="tooltip"><b>Why</b>' + esc(whyGroup(g)) + "</div></div>"
        : '<span class="muted">' + g.jobs.length + " orders</span>";
      html += '<tr class="group-row" data-toggle-group="cfg:' + esc(g.key) + '"><td><button type="button" data-toggle-group-sel="' + esc(g.key) + '">' + chk(allSel ? "on" : "off") + '</button></td><td colspan="4"><div class="gstop"><button type="button" class="chev">' + (collapsed ? "▸" : "▾") + "</button><div><div class=\"name\">Grouped stop · " + g.jobs.length + " orders</div><div class=\"sub\">" + esc(g.jobs[0].suburb) + " · " + esc(g.jobs[0].address) + "</div></div></div></td><td></td><td class=\"muted\">—</td><td>" + timeCell + '</td><td></td><td></td><td><span class="pill pill-navy">1 stop</span></td></tr>';
      if (!collapsed) g.jobs.forEach(function (j) { html += cfgRow(j, true); });
    });
    return html;
  }
  function cfgRow(job, inGroup) {

    var d = displayOf(job);
    var skipped = state.skipped.has(job.id);
    var selected = state.selected.has(job.id) && !skipped;
    var ov = state.overrides[job.id];
    var m = modifierFor(job.property_type);
    var skill;
    if (skipped) skill = '<span class="muted">—</span>';
    else if (ov) {
      skill = '<div style="display:flex;flex-direction:column;gap:6px;min-width:220px"><div style="display:flex;align-items:center;gap:8px">' +
        '<div class="step"><button type="button" data-step="' + job.id + '" data-dir="-1">−</button><span>' + ov.minutes + '</span><button type="button" data-step="' + job.id + '" data-dir="1">+</button></div>' +
        '<select class="dd" data-ov-label="' + job.id + '">' + state.labels.map(function (l) { return "<option" + (l === ov.label ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select>" +
        '<button type="button" class="ico" title="Revert to AI" data-revert="' + job.id + '"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7a4 4 0 1 0 1.2-2.9M3 2.5v2.8h2.8" stroke="#00112c" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
        '<div class="sub">AI suggested ' + compute(job).minutes + '<span class="u">min</span> · <span class="note note-ovr">Overridden by ' + esc(ov.by) + "</span></div></div>";
    } else if (state.applied) {
      skill = '<div class="why"><span class="mins" data-mins="' + job.id + '">' + d.minutes + '<span class="u">min</span></span><i data-why="' + job.id + '">?</i><div class="tooltip"><b>Why</b>' + esc(d.why) + "</div></div>" + fmsBlock(job);
    } else {
      skill = '<span class="mins pending" data-mins="' + job.id + '">35<span class="u">min</span></span>' + fmsBlock(job);
    }
    var st = skipped ? '<span class="pill pill-mute">Skipped</span>' : d.status === "overridden" ? '<span class="pill pill-warn">Overridden</span>' : d.status === "configured" ? '<span class="pill pill-ok">Configured</span>' : '<span class="pill pill-mute">Pending</span>';
    return '<tr class="' + (skipped ? "mute " : "") + '" data-job="' + job.id + '"><td><button type="button" data-toggle-sel="' + job.id + '">' + chk(selected ? "on" : "off") + '</button></td><td class="onum">' + esc(job.id) + '</td><td><div class="name">' + esc(job.customer) + '</div><div class="sub">' + esc(job.suburb) + "</div></td><td>" +
      (job.items.length > 1 ? stack(job.items) : '<div class="stack"><img src="' + esc(job.items[0].image) + '" alt=""></div>') +
      "</td><td>" + esc(m.short) + (job.floors ? ", " + job.floors + " floor" + (job.floors === 1 ? "" : "s") : "") + "</td><td>" + execCell(job) + '</td><td class="muted">35<span class="u">min</span></td><td>' + skill + "</td><td>" +
      (skipped ? "—" : labelChips(d.labels)) + "</td><td>" + (d.confidence && !skipped ? d.confidence + "%" : "—") + "</td><td>" + st +
      (!skipped && perm().overrideTimes ? ' <button class="btn btn-ghost btn-sm" data-open-drawer="' + job.id + '">Edit</button>' : "") +
      ' <button class="btn btn-quiet" data-skip="' + job.id + '" style="font-size:12px;color:var(--taupe);background:none;border:0">' + (skipped ? "Undo skip" : "Skip") + "</button></td></tr>";
  }
  function renderCfgCards(jobs) {
    return '<div class="grid">' + jobs.map(function (j) {
      var d = displayOf(j);
      return '<article class="card"><div class="hero-shot"><img src="' + esc(j.items[0].image) + '" alt=""></div><div class="top"><span class="onum">' + esc(j.id) + "</span>" +
        (d.status === "configured" ? '<span class="pill pill-ok">Configured</span>' : d.status === "overridden" ? '<span class="pill pill-warn">Overridden</span>' : state.skipped.has(j.id) ? '<span class="pill pill-mute">Skipped</span>' : '<span class="pill pill-mute">Pending</span>') +
        '</div><div class="name">' + esc(j.customer) + '</div><div class="sub">' + esc(j.suburb) + " · " + esc(j.carrier) + "</div>" +
        '<div style="margin-top:8px" class="' + (state.applied && !state.skipped.has(j.id) ? "mins" : "muted") + '">' + (d.minutes == null ? "—" : d.minutes) + '<span class="u">min</span></div>' +
        labelChips(d.labels) + fmsBlock(j) + "</article>";
    }).join("") + "</div>";
  }

  /* ---------- Settings, impact, overlays, export ---------- */
  function renderSettings() {
    var tabs = [["products", "Products"], ["properties", "Property types"], ["skillsets", "Skillsets"], ["labels", "Labels"], ["rules", "Rules"], ["roles", "Users & roles"], ["integrations", "Integrations"]];
    var nav = tabs.map(function (t) { return '<a href="#/settings/' + t[0] + '" class="' + (state.settingsTab === t[0] ? "on" : "") + '">' + t[1] + "</a>"; }).join("");
    var integMini = integCard();
    var main = "";
    if (state.settingsTab === "products") main = renderProducts();
    else if (state.settingsTab === "properties") main = renderProperties();
    else if (state.settingsTab === "skillsets") main = renderSkillsets();
    else if (state.settingsTab === "labels") main = renderLabels();
    else if (state.settingsTab === "rules") main = renderRules();
    else if (state.settingsTab === "roles") main = renderRoles();
    else main = renderIntegrations();
    return '<div class="settings"><nav class="side">' + nav + integMini + '</nav><div class="settings-main">' + main + "</div></div>";
  }
  function integCard() {
    return '<div class="integ"><h3>Integrations</h3><div class="row"><span style="display:flex;align-items:center;gap:8px"><span class="dot"></span>Radaro API</span><span class="pill pill-ok">Connected</span></div><div class="row"><span style="display:flex;align-items:center;gap:8px"><span class="dot"></span>ERP</span><span class="pill pill-ok">Connected</span></div><div class="sub" style="margin-top:8px">Last sync ' + esc(state.lastSync || "—") + "</div></div>";
  }
  function renderIntegrations() {
    var active = [
      { name: "Radaro", meta: "Last-mile TMS for metro white-glove runs. API connected. Job source below chooses whether work is pulled from ERP or from Radaro.", pill: "Connected", logo: true },
      { name: "ERP", meta: "Orders pulled and picklists submitted after routing.", pill: "Connected" },
      { name: "Regional carrier", meta: "External regional execution. Export a CSV and a branded PDF job summary per region.", pill: "CSV + PDF" },
      { name: "FMS", meta: "Freight management system for ATL and postage parcels. Recommends Carrier A, B or C on price and speed. Consignment CSV and PDF.", pill: "CSV + PDF" },
    ];
    var soon = [
      { name: "EDI", meta: "Direct electronic exchange with a carrier or 3PL." },
      { name: "Webhooks", meta: "Push status events as jobs move through a TMS or FMS." },
      { name: "Carrier API", meta: "Live booking, tracking and POD without a file export." },
    ];
    return "<h1>Integrations</h1><p class=\"lede\">Radaro runs metro last-mile. Regional work and ATL parcels export cleanly today, with room to grow into live connections.</p>" +
      sourceSwitchHtml("integrations") +
      '<p class="k section-label">Active</p><div class="tile-grid">' + active.map(function (t) {
        return '<div class="tile">' + (t.logo ? radaroMark("dark") : "") + "<h3>" + esc(t.name) + "</h3><div class=\"meta\">" + esc(t.meta) + '</div><span class="pill pill-ok">' + esc(t.pill) + "</span></div>";
      }).join("") + "</div>" +
      '<p class="k section-label">Coming soon</p><div class="tile-grid">' + soon.map(function (t) {
        return '<div class="tile soon"><h3>' + esc(t.name) + "</h3><div class=\"meta\">" + esc(t.meta) + '</div><span class="pill pill-mute">Coming soon</span></div>';
      }).join("") + "</div>";
  }
  function renderProducts() {
    var q = state.searchProd.trim().toLowerCase();
    var list = state.products.filter(function (p) { return !q || (p.name + " " + (p.configuration || "")).toLowerCase().indexOf(q) !== -1; });
    var can = perm().editProducts;
    return '<div class="head-row"><div><h1>Products</h1><p class="lede">Times, packed volume and images the configurator uses for every job.</p>' +
      '<div class="search" style="width:260px">' + searchIcon() + '<input id="search-prod" placeholder="Search products" value="' + esc(state.searchProd) + '"></div></div>' +
      '<div class="import-panel" id="import-panel"><h2>Import from nickscali.com.au</h2><p>Paste a product or collection link. AI pulls the name, configurations, packed m³ and images.</p>' +
      '<input class="box" id="import-url" placeholder="https://www.nickscali.com.au/product/…" ' + (can ? "" : "disabled") + ">" +
      '<button class="btn btn-navy" id="btn-import" style="width:100%;margin-top:10px" ' + (can ? "" : "disabled") + ">Import</button>" +
      '<div class="k" style="text-align:center;margin:14px 0 10px">or</div>' +
      '<button class="btn btn-ghost" id="btn-manual" style="width:100%" ' + (can ? "" : "disabled") + ">Add manually</button>" +
      (can ? "" : '<p style="margin-top:10px">Only admin can edit the catalogue.</p>') +
      '<div id="manual-form" hidden style="margin-top:14px"><input class="box" id="man-name" placeholder="Product name" style="margin-bottom:8px"><input class="box" id="man-min" placeholder="Base minutes" style="margin-bottom:8px"><input class="box" id="man-m3" placeholder="Packed m³" style="margin-bottom:8px"><button class="btn btn-navy" id="btn-manual-save" style="width:100%">Add product</button></div></div></div>' +
      '<table class="data"><thead><tr><th></th><th>Product</th><th>Configurations</th><th>Packed volume</th><th>Base time</th><th>Default label</th></tr></thead><tbody>' +
      list.map(function (p) { return '<tr><td><img class="shot" src="' + esc(p.image) + '" alt=""></td><td class="name">' + esc(p.name) + '</td><td class="muted">' + esc(p.configuration || "") + "</td><td>" + p.cubic_m3 + '<span class="u">m³</span></td><td>' + p.base_minutes + '<span class="u">min</span></td><td><span class="chip">White glove</span></td></tr>'; }).join("") + "</tbody></table>";
  }
  function renderProperties() {
    var selected = state._prop || "high_rise_lift";
    var m = modifierFor(selected);
    var can = perm().editRules;
    return "<h1>Property types</h1><p class=\"lede\">Add-on minutes and default labels, based on how the address reads.</p><div class=\"split\"><div class=\"plist\">" +
      state.modifiers.map(function (x) { return '<div class="ptype' + (x.id === selected ? " on" : "") + '" data-prop="' + x.id + '"><div class="t">' + esc(x.label) + '</div><div class="s">' + (x.per === "floor" ? "+" + x.minutes + " min per floor" : "+" + x.minutes + " min") + "</div></div>"; }).join("") +
      '</div><div class="editor"><h2>' + esc(m.label) + '</h2><div class="fieldm"><label>Skillset add-on</label><div class="addon" style="display:flex;align-items:baseline;gap:8px"><span style="font-size:28px;font-weight:650;color:var(--navy)">+</span><input class="box" id="mod-min" type="number" value="' + m.minutes + '" style="width:88px;font-size:22px;font-weight:650" ' + (can ? "" : "disabled") + '><span class="muted">' + (m.per === "floor" ? "min per floor" : "min") + "</span></div></div>" +
      (m.id === "high_rise_lift" ? '<div class="fieldm"><label>Applies when the address contains</label><div class="chips"><span class="tchip">apartment <i>×</i></span><span class="tchip">unit <i>×</i></span><span class="tchip">level <i>×</i></span><span class="tchip">tower <i>×</i></span></div></div>' : "") +
      '<button class="btn btn-navy" id="btn-save-prop" ' + (can ? "" : "disabled") + ">Save property type</button>" +
      (can ? "" : '<p class="sub" style="margin-top:10px">Only admin can edit property rules.</p>') + "</div></div>";
  }
  function renderSkillsets() {
    var can = perm().editSkillsets;
    return "<h1>Skillsets</h1><p class=\"lede\">Service times the AI applies as a Radaro skillset.</p><table class=\"data\"><thead><tr><th>Skillset</th><th>Minutes</th>" + (can ? "<th></th>" : "") + "</tr></thead><tbody>" +
      state.skillsets.map(function (s, i) { return '<tr><td class="name">' + esc(s.name) + "</td><td>" + (can ? '<input class="box" data-sk-min="' + i + '" type="number" value="' + s.minutes + '" style="width:88px">' : s.minutes + '<span class="u">min</span>') + "</td>" + (can ? '<td><button class="btn btn-ghost btn-sm" data-del-sk="' + i + '">Remove</button></td>' : "") + "</tr>"; }).join("") +
      "</tbody></table>" + (can ? '<div style="display:flex;gap:8px;margin-top:16px"><input class="box" id="sk-name" placeholder="New skillset name" style="max-width:260px"><input class="box" id="sk-min" placeholder="Minutes" style="width:100px"><button class="btn btn-navy" id="btn-add-sk">Add skillset</button></div>' : '<p class="sub" style="margin-top:12px">Only admin can edit skillsets.</p>');
  }
  function renderLabels() {
    var can = perm().editSkillsets;
    return "<h1>Labels</h1><p class=\"lede\">White glove includes assembly when the goods go out on the truck. Assembly only is a rare return visit — the goods are already at the house, there is no delivery leg, and nothing takes truck space.</p><div class=\"chips\" style=\"margin:16px 0 24px\">" +
      state.labels.map(function (l, i) { return '<span class="tchip">' + esc(l) + (can ? ' <i data-del-label="' + i + '">×</i>' : "") + "</span>"; }).join("") + "</div>" +
      (can ? '<div style="display:flex;gap:8px"><input class="box" id="new-label" placeholder="New label" style="max-width:260px"><button class="btn btn-navy" id="btn-add-label">Add label</button></div>' : '<p class="sub">Only admin can edit labels.</p>');
  }
  function renderRules() {
    return "<h1>Rules</h1><p class=\"lede\">How the AI turns items and a property type into a service time.</p><div class=\"editor\" style=\"max-width:680px\">" +
      "<div class=\"fieldm\"><label>Geofence</label><p>The service timer starts 150 m from the customer’s residence.</p></div>" +
      "<div class=\"fieldm\"><label>Multi-item formula</label><p>Largest item in full, plus one-third of every extra item’s own base minutes. Two 45-minute sofas become 60, not 90.</p></div>" +
      "<div class=\"fieldm\"><label>Warehouse pickup and ATL parcels</label><p>About 10 min to bring out or pack the goods. ATL parcels then go to an FMS, which recommends Carrier A, B or C on price and speed.</p></div>" +
      "<div class=\"fieldm\"><label>White glove and assembly</label><p>White glove includes assembly. Assembly only is used when the goods are already at the house (for example in the garage) and the team comes back to assemble — no delivery leg, and no cubic on the truck.</p></div>" +
      "<div class=\"fieldm\"><label>Property modifiers</label><p>Added once per stop, after the item formula. Edit them under Property types.</p></div>" +
      renderGroupingRules() +
      (perm().editRules ? "" : '<p class="sub">Despatchers can use these rules, not edit them.</p>') + "</div>";
  }
  function renderGroupingRules() {
    var g = state.grouping, can = perm().editRules;
    function tog(key, label, hint) {
      return '<label class="gopt"><input type="checkbox" data-grp-toggle="' + key + '"' + (g[key] ? " checked" : "") + (can ? "" : " disabled") + "> <span><strong>" + label + "</strong><span class=\"sub\">" + hint + "</span></span></label>";
    }
    return '<div class="grouping-rules"><h2>Grouping</h2><p>Orders that share a delivery address become one stop. The first order takes the full service time; each extra order only adds its handling share — no second arrival or setup. Applies to transfers and to ordinary customer orders.</p>' +
      tog("normaliseAddress", "Normalise address", "Ignore punctuation, case, and unit or apartment prefixes when matching.") +
      tog("matchBySiteId", "Match by site ID", "If a site ID is on the order, group by that first (for example a showroom or a repair workshop).") +
      tog("appliesToTransfers", "Apply to transfers", "Warehouse-to-showroom, click-and-collect and repair drops.") +
      tog("appliesToCustomerOrders", "Apply to customer orders", "Different customers at the same address or site also share a stop.") +
      '<div class="gnums"><div class="fieldm"><label>Per-extra-order handling time</label><div class="addon" style="display:flex;align-items:baseline;gap:8px"><input class="box" id="grp-extra" type="number" min="0" max="60" value="' + g.extraHandlingMinutes + '" style="width:88px" ' + (can ? "" : "disabled") + '><span class="muted">min</span></div></div>' +
      '<div class="fieldm"><label>Max orders per group</label><input class="box" id="grp-max" type="number" min="2" max="20" value="' + g.maxOrdersPerGroup + '" style="width:88px" ' + (can ? "" : "disabled") + "></div></div>" +
      (can ? '<button class="btn btn-navy" id="btn-save-grouping" style="margin-top:8px">Save grouping</button>' : "") +
      "</div>";
  }
  function renderRoles() {
    var rows = [
      ["View jobs in own region", 1, 1, 1, 1], ["View all regions", 0, 0, 0, 1],
      ["Sync with Radaro", 1, 1, 1, 1], ["Apply AI configuration", 1, 1, 1, 1],
      ["Override times and labels", 1, 1, 1, 1], ["Push to Radaro", 1, 1, 1, 1],
      ["Export to carriers or FMS", 1, 1, 1, 1], ["Submit picklists", 1, 1, 1, 1],
      ["Override payment/ready block", 0, 1, 1, 1], ["Edit products", 0, 0, 1, 1],
      ["Edit skillsets and labels", 0, 0, 1, 1], ["Edit rules", 0, 0, 1, 1],
      ["View regional reports", 0, 1, 0, 1], ["View audit log", 0, 1, 1, 1],
    ];
    var cell = function (v) { return v ? '<span class="yes">✓</span>' : '<span class="no">–</span>'; };
    var users = [["J. Patel", "Despatcher", "NSW"], ["A. Chen", "Despatcher", "VIC"], ["S. Nguyen", "Regional manager", "NSW"], ["R. Walsh", "Admin", "All Australia"], ["M. Saito", "Global manager", "All Australia + NZ"]];
    return "<h1>Users &amp; roles</h1><p class=\"lede\">A non-technical despatcher can run their region. Rules stay with admin.</p><p class=\"k\" style=\"margin:18px 0 10px\">Permissions</p>" +
      '<table class="data matrix"><thead><tr><th>Permission</th><th class="role">Despatcher</th><th class="role">Regional manager</th><th class="role">Admin</th><th class="role">Global manager</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td class="name">' + r[0] + "</td>" + [1, 2, 3, 4].map(function (i) { return '<td class="role">' + cell(r[i]) + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody></table><p class=\"sub\" style=\"margin:12px 0 28px\">You are viewing the app as " + esc(perm().label) + ". Switch roles in the header to see what each person can do.</p>" +
      '<p class="k" style="margin-bottom:10px">Example users</p><table class="data"><thead><tr><th>Name</th><th>Role</th><th>Region</th><th>Status</th></tr></thead><tbody>' +
      users.map(function (u) { return '<tr><td class="name">' + u[0] + "</td><td>" + u[1] + "</td><td>" + u[2] + '</td><td><span class="pill pill-ok">Active</span></td></tr>'; }).join("") + "</tbody></table>";
  }
  function renderImpact() {
    return '<div class="impact"><div class="hero-label">Saved per driver, per day</div><div class="hero"><span class="approx">~</span><span class="num" data-count="100">0</span><span class="unit">min</span></div>' +
      '<div class="subhero">Using a conservative 35-minute Radaro default, against a 26.5-minute AI average.</div>' +
      '<div class="compare"><div><div class="l">Before</div><div class="n"><span data-count="35">0</span><span class="u">min</span></div><div class="l">Average service time</div></div>' +
      '<div><div class="l">After</div><div class="n"><span data-count-dec="26.5">0</span><span class="u">min</span></div><div class="l">Average configured time</div></div></div>' +
      '<div class="exhead">If the recovered time is reinvested — examples only</div>' +
      '<div class="examples"><div><div class="from">Jobs per day 12 →</div><div class="to"><span data-count="14">0</span></div></div>' +
      '<div><div class="from">Cost per delivery $125 →</div><div class="to">$<span data-count="107">0</span></div></div></div></div>';
  }
  function countUp() {
    $$("[data-count]").forEach(function (el) { animateCount(el, parseFloat(el.dataset.count), 0); });
    $$("[data-count-dec]").forEach(function (el) { animateCount(el, parseFloat(el.dataset.countDec), 1); });
  }
  function animateCount(el, to, dec) {
    var start = performance.now(), dur = 900;
    function tick(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (to * eased).toFixed(dec);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = dec ? to.toFixed(dec) : String(Math.round(to));
    }
    requestAnimationFrame(tick);
  }

  function selectedConfigured() {
    return state.jobs.filter(function (j) { return inCfgScope(j, { ignoreSearch: true }) && state.selected.has(j.id) && !state.skipped.has(j.id); });
  }
  function exportRows(kind, carrierIds) {
    var jobs = selectedConfigured();
    if (kind === "fms") return jobs.filter(isParcel);
    if (kind === "regional") return jobs.filter(function (j) { return isRegional(j) && (!carrierIds || carrierIds.indexOf(j.carrier) !== -1); });
    return jobs;
  }
  function csvEscape(s) { return /[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s); }
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function jobNote(job) {
    var parts = [];
    var ov = state.overrides[job.id];
    if (ov && ov.reason) parts.push("Override: " + ov.reason);
    if (job.held === "overridden_eft") parts.push("Payment override");
    return parts.join(" ");
  }
  function stateOf(job) {
    var m = job.address && job.address.match(/\b(NSW|VIC|QLD|SA|WA|NT|TAS|ACT|TX|CA|ON|MI)\b/);
    return m ? m[1] : (job.region === "North America" ? "" : job.region);
  }
  function buildCarrierCsv(jobs) {
    var head = ["Job ID", "Customer", "Suburb", "State", "Items", "Cubic m3", "AI service time (min)", "Labels", "Property type", "Property modifier (min)", "Execution", "TMS", "Notes"];
    var lines = [head.join(",")];
    jobs.forEach(function (j) {
      var d = displayOf(j), conf = compute(j), m = modifierFor(j.property_type);
      lines.push([j.id, j.customer, j.suburb, stateOf(j), j.items.map(function (i) { return i.name; }).join("; "), j.cubic_m3.toFixed(3), d.minutes, d.labels.join("; "), m.short, conf.modifier, j.carrier, j.tms, jobNote(j)].map(csvEscape).join(","));
    });
    return lines.join("\r\n");
  }
  function buildFmsCsv(jobs) {
    var head = ["ConsignmentRef", "FromName", "FromSuburb", "FromState", "ToName", "ToAddress", "ToSuburb", "ToState", "ItemDescription", "Pieces", "CubicM3", "Service", "Carrier", "QuotedPriceAUD", "ETA", "RecommendReason", "Labels", "ServiceTimeMin", "Notes"];
    var lines = [head.join(",")];
    jobs.forEach(function (j) {
      var d = displayOf(j), q = fmsQuote(j);
      lines.push([j.id, "Nick Scali last-mile warehouse", "Wetherill Park", "NSW", j.customer, j.address, j.suburb, stateOf(j), j.items.map(function (i) { return i.name; }).join("; "), j.items.reduce(function (a, i) { return a + (i.pieces || 1); }, 0), j.cubic_m3.toFixed(3), "ATL", q.name, q.price.toFixed(2), q.eta, fmsReason(j), d.labels.join("; "), d.minutes, jobNote(j)].map(csvEscape).join(","));
    });
    return "\uFEFF" + lines.join("\r\n");
  }

  /* Minimal branded PDF (Helvetica, navy header). */
  function buildPdf(title, subtitle, headers, rows) {
    function hex(s) { var o = []; for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i)); return o; }
    var objs = [], pages = [], pageW = 841.89, pageH = 595.28; /* A4 landscape */
    var margin = 36, y0 = pageH - 88, rowH = 16, colW;
    var weights = headers.map(function (h) { return /suburb|reason|notes|address|items|customer/i.test(h) ? 1.85 : 1; });
    var wsum = weights.reduce(function (a, b) { return a + b; }, 0);
    colW = weights.map(function (w) { return (pageW - margin * 2) * (w / wsum); });
    function fontW(str, size) { return String(str).length * size * 0.5; }
    function pdfClean(str) {
      return String(str == null ? "" : str).replace(/m³/g, "m3").replace(/[–—·]/g, "-").replace(/[’‘]/g, "'").replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, " ");
    }
    function wrapLines(str, size, w) {
      str = pdfClean(str);
      var words = str.split(/\s+/).filter(Boolean);
      if (!words.length) return [""];
      var lines = [], cur = "";
      words.forEach(function (word) {
        while (fontW(word, size) > w - 6 && word.length > 1) {
          var cut = word.length;
          while (cut > 1 && fontW(word.slice(0, cut), size) > w - 6) cut--;
          if (cur) { lines.push(cur); cur = ""; }
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        var trial = cur ? cur + " " + word : word;
        if (cur && fontW(trial, size) > w - 6) { lines.push(cur); cur = word; }
        else cur = trial;
      });
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    }
    function fit(str, size, w) { return wrapLines(str, size, w)[0]; }
    var lineH = 11;
    var chunks = [], cur = [], y = y0;
    function newPage() { if (cur.length) chunks.push(cur); cur = []; y = y0; }
    rows.forEach(function (row) {
      var cells = row.map(function (cell, i) { return wrapLines(cell, 8, colW[i]); });
      var nLines = 1;
      cells.forEach(function (ls) { if (ls.length > nLines) nLines = ls.length; });
      var h = Math.max(16, nLines * lineH + 5);
      if (y - h < 48) newPage();
      cur.push({ y: y, h: h, cells: cells });
      y -= h;
    });
    if (cur.length) chunks.push(cur);
    if (!chunks.length) chunks = [[]];
    function pageStream(chunk, pageNo, pageCount) {
      var s = [];
      s.push("0.00 0.07 0.17 rg 0 540.28 841.89 55 re f");
      s.push("1 1 1 rg /F1 16 Tf 36 560 Td (Nick Scali) Tj");
      s.push("/F1 11 Tf 1 0 0 1 200 562 Tm (" + fit(title, 11, 400) + ") Tj");
      s.push("/F1 9 Tf 1 0 0 1 36 548 Tm (" + fit(subtitle + "  -  Example data  -  " + pageNo + " / " + pageCount, 9, 700) + ") Tj");
      s.push("0.15 0.15 0.15 rg");
      var x = margin;
      headers.forEach(function (h, i) {
        s.push("/F1 8 Tf 1 0 0 1 " + x + " " + (y0 + 14) + " Tm (" + fit(h, 8, colW[i]) + ") Tj");
        x += colW[i];
      });
      s.push("0.9 0.87 0.83 RG 0.4 w " + margin + " " + (y0 + 8) + " m " + (pageW - margin) + " " + (y0 + 8) + " l S");
      chunk.forEach(function (item) {
        var x = margin;
        item.cells.forEach(function (lines, i) {
          lines.forEach(function (line, li) {
            s.push("/F1 8 Tf 1 0 0 1 " + x + " " + (item.y - 2 - li * lineH) + " Tm (" + line + ") Tj");
          });
          x += colW[i];
        });
      });
      return s.join("\n");
    }
        /* Build PDF after we know page count — handled by caller via objects below. */
    var contentStreams = chunks.map(function (chunk, i) { return pageStream(chunk, i + 1, chunks.length); });
    var out = [];
    function add(str) { var o = { off: 0, str: str }; objs.push(o); return objs.length; }
    /* We'll assemble with xref at the end. */
    var parts = ["%PDF-1.4\n"];
    var offsets = [0];
    function emit(body) {
      offsets.push(parts.reduce(function (a, p) { return a + p.length; }, 0));
      parts.push(body);
    }
    var fontId, pagesId, catalogId, pageIds = [], streamIds = [];
    /* We'll number objects: 1 catalog, 2 pages, 3 font, then pairs of page+content */
    /* Simpler: build list then number */
    var objects = [];
    objects.push(null); /* 1-index */
    var fontObj = objects.length; objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    var contentIds = [], pIds = [];
    contentStreams.forEach(function (stream) {
      var cid = objects.length;
      objects.push("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
      contentIds.push(cid);
    });
    var kids = [];
    contentIds.forEach(function (cid) {
      var pid = objects.length;
      objects.push("PLACEHOLDER_PAGE");
      pIds.push(pid);
      kids.push(pid);
    });
    var pagesObj = objects.length;
    objects.push("<< /Type /Pages /Kids [" + pIds.map(function (id) { return id + " 0 R"; }).join(" ") + "] /Count " + pIds.length + " >>");
    pIds.forEach(function (pid, i) {
      objects[pid] = "<< /Type /Page /Parent " + pagesObj + " 0 R /MediaBox [0 0 841.89 595.28] /Resources << /Font << /F1 " + fontObj + " 0 R >> >> /Contents " + contentIds[i] + " 0 R >>";
    });
    var catObj = objects.length;
    objects.push("<< /Type /Catalog /Pages " + pagesObj + " 0 R >>");
    var buf = "%PDF-1.4\n";
    var offs = [0];
    for (var i = 1; i < objects.length; i++) {
      offs[i] = buf.length;
      buf += i + " 0 obj\n" + objects[i] + "\nendobj\n";
    }
    var xref = buf.length;
    buf += "xref\n0 " + objects.length + "\n";
    buf += "0000000000 65535 f \n";
    for (var i = 1; i < objects.length; i++) buf += ("0000000000" + offs[i]).slice(-10) + " 00000 n \n";
    buf += "trailer\n<< /Size " + objects.length + " /Root " + catObj + " 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    return buf;
  }
  function downloadPdf(filename, title, subtitle, headers, rows) {
    var pdf = buildPdf(title, subtitle, headers, rows);
    var blob = new Blob([pdf], { type: "application/pdf" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function pdfRowsCarrier(jobs) {
    return jobs.map(function (j) {
      var d = displayOf(j), conf = compute(j);
      return [j.id, j.customer, j.suburb + " " + stateOf(j), j.items.map(function (i) { return i.name; }).join(", "), j.cubic_m3.toFixed(2), String(d.minutes), d.labels.join(", "), String(conf.modifier), jobNote(j)];
    });
  }
  function pdfRowsFms(jobs) {
    return jobs.map(function (j) {
      var d = displayOf(j), q = fmsQuote(j);
      return [j.id, j.customer, j.suburb, j.items.map(function (i) { return i.name; }).join(", "), q.name, "$" + q.price.toFixed(2), q.eta, String(d.minutes), fmsReason(j)];
    });
  }

  function jobById(id) { return state.jobs.find(function (j) { return j.id === id; }); }
  function closeOverlay() {
    state.drawer = null;
    state.modal = null;
    state.dryRun = null;
    renderOverlay();
  }
  function setRoute(route, tab) {
    if (route === "settings") location.hash = "#/settings/" + (tab || state.settingsTab || "products");
    else location.hash = "#/" + route;
  }
  function parseHash() {
    var h = (location.hash || "#/deliveries").replace(/^#\/?/, "");
    var parts = h.split("/").filter(Boolean);
    state.route = parts[0] || "deliveries";
    if (state.route === "settings") state.settingsTab = parts[1] || "products";
  }

  function render() {
    parseHash();
    renderNav();
    renderFlow();
    var html = "";
    if (state.route === "deliveries") html = renderDeliveries();
    else if (state.route === "configurator") html = renderConfigurator();
    else if (state.route === "settings") html = renderSettings();
    else if (state.route === "impact") html = renderImpact();
    else html = renderDeliveries();
    $("#app").innerHTML = html;
    syncStickyClearance();
    var roleEl = $("#role-switch");
    if (roleEl && roleEl.value !== state.role) roleEl.value = state.role;
    renderOverlay();
    restoreFocus();
    if (state.route === "impact") countUp();
  }

  function syncStickyClearance() {
    var on = state.route === "configurator" && state.pulled;
    document.body.classList.toggle("has-sticky", on);
    var s = document.querySelector(".sticky");
    var h = (on && s) ? Math.ceil(s.getBoundingClientRect().height) : 0;
    document.body.style.setProperty("--sticky-h", h + "px");
  }
  function placeTooltip(tip) {
    if (!tip) return;
    tip.classList.remove("flip-up");
    var sticky = document.querySelector(".sticky");
    var limit = window.innerHeight;
    if (sticky) {
      var top = sticky.getBoundingClientRect().top;
      if (top > 0 && top < limit) limit = top;
    }
    var r = tip.getBoundingClientRect();
    if (r.bottom > limit - 8) tip.classList.add("flip-up");
  }
  function restoreFocus() {
    if (!state._focus) return;
    var el = document.getElementById(state._focus);
    if (el) {
      el.focus();
      if (typeof el.selectionStart === "number" && state._caret != null) {
        try { el.setSelectionRange(state._caret, state._caret); } catch (e) {}
      }
    }
  }

  function renderOverlay() {
    var root = $("#overlay");
    if (!root) return;
    if (!state.drawer && !state.modal && !state.dryRun) { root.innerHTML = ""; return; }
    var html = '<div class="dim" data-close="1"></div>';
    if (state.drawer) html += renderDrawer(state.drawer);
    if (state.modal === "block") html += renderBlockModal();
    if (state.modal === "export") html += renderExportModal();
    if (state.modal === "remove") html += renderRemoveModal();
    if (state.dryRun) html += renderDryRun();
    root.innerHTML = html;
  }

  function renderDrawer(id) {
    var job = jobById(id);
    if (!job) return "";
    var conf = compute(job);
    var ov = state.overrides[id] || { minutes: conf.minutes, label: conf.labels[0] || "White glove", reason: "", by: perm().label, at: nowAudit() };
    if (!state._ovDraft || state._ovDraft.id !== id) state._ovDraft = { id: id, minutes: ov.minutes, label: ov.label, reason: ov.reason || "" };
    var d = state._ovDraft;
    return '<aside class="drawer"><h1>Override service time</h1><p class="who">' + esc(job.id) + " · " + esc(job.customer) + " · " + esc(job.suburb) + "</p>" +
      '<div class="prod-row"><img src="' + esc(job.items[0].image) + '" alt=""><div><strong>' + esc(job.items.length > 1 ? job.items.length + " items" : job.items[0].name) + "</strong><span class=\"sub\">AI " + conf.minutes + '<span class="u">min</span> · ' + esc(conf.labels.join(", ") || "—") + " · " + conf.confidence + "%</span></div></div>" +
      '<div class="fieldm"><label>Manual time</label><div class="step"><button type="button" data-draft-step="-1">−</button><span>' + d.minutes + '</span><button type="button" data-draft-step="1">+</button></div></div>' +
      '<div class="fieldm"><label>Label</label><select class="dd" id="draft-label">' + state.labels.map(function (l) { return "<option" + (l === d.label ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select></div>" +
      '<div class="fieldm"><label>Reason</label><textarea class="reason" id="draft-reason" placeholder="Why is this changing?">' + esc(d.reason) + "</textarea></div>" +
      '<div class="actions"><button class="btn btn-ghost" data-close="1">Cancel</button><button class="btn btn-navy" id="btn-save-override">Save override</button></div>' +
      (state.overrides[id] ? '<button class="btn btn-ghost" style="margin-top:10px" data-revert="' + id + '">Revert to AI</button>' : "") +
      '<p class="audit">Audit · ' + esc((state.overrides[id] && state.overrides[id].at) || nowAudit()) + "</p></aside>";
  }
  function renderBlockModal() {
    var job = jobById(state.blockJob);
    if (!job) return "";
    var reason = state._blockReason || "EFT confirmed";
    return '<div class="modal"><h1>Override a held order</h1><p class="who">' + esc(job.id) + " · " + esc(job.customer) + " · " + esc(job.suburb) + "</p>" +
      '<p class="sub" style="margin-bottom:12px">Managers only. This is written to the audit log.</p>' +
      '<div class="reasons">' +
      ["EFT confirmed", "Goods arriving today", "Goods being unpacked, ready by 2 pm", "Other"].map(function (r) {
        return '<label><input type="radio" name="block-reason" value="' + esc(r) + '"' + (r === reason ? " checked" : "") + "> " + esc(r) + "</label>";
      }).join("") + "</div>" +
      '<div class="fieldm"><label>Note</label><textarea class="reason" id="block-note" placeholder="Optional note">' + esc(state._blockNote || "") + "</textarea></div>" +
      '<div class="actions"><button class="btn btn-ghost" data-close="1">Cancel</button><button class="btn btn-navy" id="btn-confirm-block">Override and allow sync</button></div>' +
      '<p class="audit">Will be recorded as ' + esc(perm().label) + " · " + esc(nowAudit()) + "</p></div>";
  }
  function renderExportModal() {
    var kind = state.exportKind;
    var ids = state.exportPick;
    var jobs;
    if (kind === "fms") jobs = exportRows("fms");
    else {
      var selectedCarriers = ids.length ? ids : null;
      jobs = exportRows("regional", selectedCarriers);
    }
    if (kind === "fms") {
      return '<div class="modal wide"><h1>Export to FMS</h1><p class="who">' + jobs.length + " ATL / parcel job" + (jobs.length === 1 ? "" : "s") + " · consignment import</p>" +
        '<p class="sub">Each row uses the recommended or overridden carrier, example price and ETA. Example data only.</p>' +
        '<table class="data" style="margin:12px 0"><thead><tr><th>Job</th><th>Suburb</th><th>Carrier</th><th>Price</th><th>ETA</th></tr></thead><tbody>' +
        jobs.map(function (j) { var q = fmsQuote(j); return "<tr><td class=\"onum\">" + esc(j.id) + "</td><td>" + esc(j.suburb) + "</td><td>" + esc(q.name) + "</td><td>$" + q.price.toFixed(2) + "</td><td>" + esc(q.eta) + "</td></tr>"; }).join("") +
        "</tbody></table>" +
        '<div class="export-actions"><button class="btn btn-navy" data-do-export="csv">Download consignment CSV</button><button class="btn btn-ghost" data-do-export="pdf">Download PDF summary</button></div>' +
        '<div class="actions"><button class="btn btn-ghost" data-close="1">Close</button></div></div>';
    }
    var groups = {};
    exportRows("regional").forEach(function (j) { groups[j.carrier] = groups[j.carrier] || { carrier: j.carrier, tms: j.tms, n: 0 }; groups[j.carrier].n++; });
    var keys = Object.keys(groups);
    if (!state.exportPick.length) state.exportPick = keys.slice();
    jobs = exportRows("regional", state.exportPick);
    return '<div class="modal wide"><h1>Export to regional carriers</h1><p class="who">Choose one or more carriers. ' + jobs.length + " job" + (jobs.length === 1 ? "" : "s") + " will be included.</p>" +
      '<div class="carrier-pick">' + keys.map(function (id) {
        var g = groups[id], on = state.exportPick.indexOf(id) !== -1;
        return '<label><input type="checkbox" data-export-carrier="' + id + '"' + (on ? " checked" : "") + "> " + esc(g.carrier) + " · " + esc(g.tms) + " · " + g.n + " job" + (g.n === 1 ? "" : "s") + "</label>";
      }).join("") + "</div>" +
      '<div class="export-actions"><button class="btn btn-navy" data-do-export="csv"' + (jobs.length ? "" : " disabled") + '>Download CSV</button><button class="btn btn-ghost" data-do-export="pdf"' + (jobs.length ? "" : " disabled") + '>Download PDF summary</button></div>' +
      '<div class="actions"><button class="btn btn-ghost" data-close="1">Close</button></div></div>';
  }
  function renderRemoveModal() {
    var all = pendingRemoval();
    var nR = all.filter(isRegional).length, nP = all.filter(isParcel).length;
    var f = state.removeFilter;
    var chosen = all.filter(function (j) { return (f.regional && isRegional(j)) || (f.parcel && isParcel(j)); });
    return '<div class="modal danger"><h1>Remove exported jobs from Radaro</h1>' +
      '<p class="warn">These jobs have already been exported to a regional carrier or to an FMS. Removing them from Radaro stops them sitting unassigned. This is a demo action — nothing is sent to a live system.</p>' +
      '<div class="remove-filters">' +
      '<label><input type="checkbox" data-remove-filter="regional"' + (f.regional ? " checked" : "") + "> Regional <span class=\"muted\">· " + nR + "</span></label>" +
      '<label><input type="checkbox" data-remove-filter="parcel"' + (f.parcel ? " checked" : "") + "> Parcel/ATL <span class=\"muted\">· " + nP + "</span></label>" +
      "</div>" +
      "<p><b>" + chosen.length + "</b> job" + (chosen.length === 1 ? "" : "s") + " will be removed from the unassigned count in Radaro.</p>" +
      '<div class="actions"><button class="btn btn-ghost" data-close="1">Cancel</button><button class="btn btn-danger" id="btn-confirm-remove"' + (chosen.length ? "" : " disabled") + ">Remove from Radaro</button></div></div>";
  }
  function renderDryRun() {
    var jobs = selectedConfigured();
    var radaro = jobs.filter(function (j) { return j.execution === "radaro"; });
    var regional = jobs.filter(isRegional);
    var parcels = jobs.filter(isParcel);
    var saved = jobs.reduce(function (a, j) { return a + (DEFAULT_MIN - (displayOf(j).minutes || DEFAULT_MIN)); }, 0);
    return '<div class="modal wide"><h1>Dry run</h1><p class="who">A preview of what will be pushed or exported. Example data only.</p>' +
      "<p><b>" + jobs.length + "</b> selected · " + radaro.length + " to Radaro · " + regional.length + " regional export · " + parcels.length + " FMS parcels</p>" +
      "<p class=\"sub\" style=\"margin:8px 0 16px\">About " + Math.max(0, saved) + '<span class="u">min</span> recovered against a 35-minute default.</p>' +
      '<div class="actions"><button class="btn btn-ghost" data-close="1">Close</button></div></div>';
  }

  function pullJobs() {
    if (state.pulling) return;
    state.pulling = true;
    if (state.jobSource === "radaro") { state.inRadaro = true; state.flow = "radaro"; }
    else { state.flow = "ai"; }
    render();
    setTimeout(function () {
      state.pulling = false;
      state.pulled = true;
      var jobs = cfgJobs();
      state.pulledCount = jobs.length;
      state.selected = new Set(jobs.map(function (j) { return j.id; }));
      state.lastSync = nowTime();
      state.flow = "ai";
      render();
      toast("Pulled " + state.pulledCount + " jobs from " + (state.jobSource === "erp" ? "ERP" : "Radaro") + " · " + effectiveRegion());
    }, 900);
  }
  function applyAI() {
    if (!state.pulled) return;
    if (!selectedConfigured().length) { toast("Select jobs to apply AI configuration."); return; }
    state.applied = true;
    state.applying = true;
    state.flow = "ai";
    render();
    $$("[data-mins]").forEach(function (el) {
      var job = jobById(el.getAttribute("data-mins"));
      if (!job || state.skipped.has(job.id)) return;
      var to = displayOf(job).minutes;
      animateMins(el, 35, to);
    });
    state.applying = false;
    toast("AI configuration applied to " + selectedConfigured().length + " jobs.");
  }
  function animateMins(el, from, to) {
    if (to == null) return;
    var start = performance.now(), dur = 700;
    function tick(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      var n = Math.round(from + (to - from) * eased);
      el.innerHTML = n + '<span class="u">min</span>';
      if (t < 1) requestAnimationFrame(tick);
      else { el.innerHTML = to + '<span class="u">min</span>'; el.classList.remove("pending"); }
    }
    requestAnimationFrame(tick);
  }
  function pushToRadaro() {
    var jobs = selectedConfigured().filter(function (j) { return j.execution === "radaro"; });
    if (!jobs.length) { toast("No Radaro jobs selected."); return; }
    state.pushed = true;
    state.flow = "routes";
    state.picklists = { A: "not", B: "not", C: "not", P: "not", T: "not", S: "not" };
    state.picklistTimes = {};
    closeOverlay();
    setRoute("deliveries");
    toast("Pushed " + jobs.length + " jobs to Radaro. Routes assigned to runs.");
  }
  function openExport(kind) {
    var jobs = exportRows(kind === "fms" ? "fms" : "regional");
    if (!jobs.length) { toast(kind === "fms" ? "No ATL / parcel jobs selected." : "No regional carrier jobs selected."); return; }
    state.exportKind = kind;
    state.exportPick = kind === "fms" ? [] : Array.from(new Set(jobs.map(function (j) { return j.carrier; })));
    state.modal = "export";
    renderOverlay();
  }
  function stampExported(jobs) {
    jobs.forEach(function (j) { state.exportedIds.add(j.id); });
    state.exported = true;
    state.flow = state.exportKind === "fms" ? "fms" : "export";
  }
  function ascii(s) {
    return String(s == null ? "" : s)
      .replace(/m³/g, "m3").replace(/³/g, "3")
      .replace(/[–—]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7E]/g, " ");
  }
  function doExport(format) {
    var kind = state.exportKind;
    var jobs = kind === "fms" ? exportRows("fms") : exportRows("regional", state.exportPick);
    if (!jobs.length) return;
    var stamp = "2026-11-24";
    if (kind === "fms") {
      if (format === "csv") downloadText("nick-scali-fms-consignments-" + stamp + ".csv", buildFmsCsv(jobs), "text/csv;charset=utf-8");
      else {
        var headers = ["Job", "Customer", "Suburb", "Items", "Carrier", "Price", "ETA", "Time min", "Reason"];
        var rows = pdfRowsFms(jobs).map(function (r) { return r.map(ascii); });
        downloadPdf("nick-scali-fms-summary-" + stamp + ".pdf", "FMS parcel summary", "ATL / postage consignments  " + stamp + "  " + jobs.length + " jobs", headers, rows);
      }
    } else {
      var label = state.exportPick.map(function (id) { return (CARRIERS[id] || {}).name || id; }).join("-") || "regional";
      var slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (format === "csv") downloadText("nick-scali-" + slug + "-" + stamp + ".csv", buildCarrierCsv(jobs), "text/csv;charset=utf-8");
      else {
        var headers = ["Job", "Customer", "Suburb", "Items", "Cubic", "Time min", "Labels", "Modifier", "Notes"];
        var rows = pdfRowsCarrier(jobs).map(function (r) { return r.map(ascii); });
        downloadPdf("nick-scali-" + slug + "-summary-" + stamp + ".pdf", "Regional carrier job summary", label + "  " + stamp + "  " + jobs.length + " jobs", headers, rows);
      }
    }
    stampExported(jobs);
    toast((format === "csv" ? "CSV" : "PDF") + " downloaded for " + jobs.length + " job" + (jobs.length === 1 ? "" : "s") + ".");
    render();
  }
  function confirmRemove() {
    var f = state.removeFilter;
    var chosen = pendingRemoval().filter(function (j) { return (f.regional && isRegional(j)) || (f.parcel && isParcel(j)); });
    chosen.forEach(function (j) { state.removedFromRadaro.add(j.id); });
    state.modal = null;
    render();
    toast(chosen.length + " exported job" + (chosen.length === 1 ? "" : "s") + " removed from Radaro.");
  }
  function setJobSource(src) {
    if (src !== "erp" && src !== "radaro") return;
    state.jobSource = src;
    if (src === "erp") {
      if (state.flow === "radaro") state.flow = state.pulled ? "ai" : "erp";
    } else if (state.flow === "erp" && state.pulled) state.flow = "ai";
    render();
    toast(src === "erp" ? "Job source: Pull from ERP (recommended)." : "Job source: Pull from Radaro.");
  }
  function submitRun(id) {
    if (!state.pushed) return;
    if (state.picklists[id] === "not") {
      state.picklists[id] = "sent";
      state.picklistTimes[id] = nowTime();
      toast("Picklist for " + (RUNS[id] ? RUNS[id].name : id) + " submitted · " + state.picklistTimes[id] + " Australia/Sydney");
    } else if (state.picklists[id] === "sent") {
      state.picklists[id] = "picked";
      toast((RUNS[id] ? RUNS[id].name : id) + " marked picked.");
    }
    state.flow = "picklists";
    render();
  }

  function onClick(e) {
    var t = e.target.closest("[data-close],button,a,.filter,.ptype,.rhead,tr.expandable,tr.group-row,label");
    if (!t) return;
    if (t.dataset && t.dataset.close) { e.preventDefault(); closeOverlay(); return; }
    if (t.id === "btn-sync-erp") {
      e.preventDefault();
      if (state.jobSource === "radaro") {
        state.inRadaro = true;
        state.flow = "radaro";
        toast("Synced to Radaro. Pull Regional and Parcel/ATL labelled jobs into AI config.");
      } else {
        toast("Sending today’s slate to the AI configurator.");
      }
      setRoute("configurator");
      setTimeout(pullJobs, 200);
      return;
    }
    if (t.id === "btn-sync-cfg") { e.preventDefault(); pullJobs(); return; }
    if (t.id === "btn-apply") { e.preventDefault(); applyAI(); return; }
    if (t.id === "btn-push") { e.preventDefault(); pushToRadaro(); return; }
    if (t.id === "btn-export-reg" || t.getAttribute("data-export-kind") === "regional") { e.preventDefault(); openExport("regional"); return; }
    if (t.id === "btn-export-fms" || t.getAttribute("data-export-kind") === "fms") { e.preventDefault(); openExport("fms"); return; }
    if (t.id === "btn-dry") { e.preventDefault(); state.dryRun = true; renderOverlay(); return; }
    if (t.id === "btn-remove-radaro") { e.preventDefault(); state.modal = "remove"; renderOverlay(); return; }
    if (t.id === "btn-confirm-remove") { e.preventDefault(); confirmRemove(); return; }
    if (t.id === "btn-save") { e.preventDefault(); toast("View saved."); return; }
    if (t.id === "btn-submit-all") {
      e.preventDefault();
      if (!state.pushed) return;
      ["A", "B", "C", "P", "T", "S"].forEach(function (id) {
        if (state.picklists[id] === "not") { state.picklists[id] = "sent"; state.picklistTimes[id] = nowTime(); }
      });
      state.flow = "picklists";
      render();
      toast("All picklists submitted · " + nowTime() + " Australia/Sydney");
      return;
    }
    if (t.id === "select-all") {
      e.preventDefault();
      var jobs = cfgJobs().filter(function (j) { return !state.skipped.has(j.id); });
      var all = jobs.every(function (j) { return state.selected.has(j.id); });
      if (all) jobs.forEach(function (j) { state.selected.delete(j.id); });
      else jobs.forEach(function (j) { state.selected.add(j.id); });
      render();
      return;
    }
    if (t.id === "btn-save-override") {
      e.preventDefault();
      if (!state._ovDraft) return;
      var job = jobById(state._ovDraft.id);
      state.overrides[state._ovDraft.id] = {
        minutes: state._ovDraft.minutes,
        label: state._ovDraft.label,
        reason: state._ovDraft.reason || "Manual override",
        by: perm().label,
        at: nowAudit(),
      };
      state.drawer = null;
      render();
      toast("Override saved for " + job.id + ".");
      return;
    }
    if (t.id === "btn-confirm-block") {
      e.preventDefault();
      if (!perm().overrideBlock) { toast("Only a regional manager or above can override a payment or ready block."); return; }
      var job = jobById(state.blockJob);
      state.blockOverrides[job.id] = { reason: state._blockReason || "EFT confirmed", note: state._blockNote || "", by: perm().label + (perm().label === "Regional manager" ? "" : ""), at: nowAudit() };
      if (job.held === "not_paid" || job.held === "not_ready") job.held = "overridden_eft";
      state.modal = null;
      render();
      toast("Override recorded for " + job.id + ".");
      return;
    }
    if (t.id === "btn-import") {
      e.preventDefault();
      if (!perm().editProducts) return;
      var panel = $("#import-panel");
      if (panel) panel.classList.add("shimmer");
      setTimeout(function () {
        if (panel) panel.classList.remove("shimmer");
        var url = ($("#import-url") && $("#import-url").value) || "";
        var slug = (url.split("/").filter(Boolean).pop() || "imported-armchair").replace(/[-_]/g, " ");
        slug = slug.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        state.products.unshift({ name: slug || "Imported armchair", configuration: "Imported example", cubic_m3: 0.48, base_minutes: 15, image: "assets/products/barrel-swivel-armchair.png", is_example: true });
        render();
        toast("Imported “" + (slug || "product") + "” from the catalogue URL. Example only.");
      }, 1100);
      return;
    }
    if (t.id === "btn-manual") {
      e.preventDefault();
      var f = $("#manual-form");
      if (f) f.hidden = !f.hidden;
      return;
    }
    if (t.id === "btn-manual-save") {
      e.preventDefault();
      if (!perm().editProducts) return;
      var name = ($("#man-name") && $("#man-name").value.trim()) || "New product";
      var mins = parseInt($("#man-min") && $("#man-min").value, 10) || 15;
      var m3 = parseFloat($("#man-m3") && $("#man-m3").value) || 0.5;
      state.products.unshift({ name: name, configuration: "Manual entry", cubic_m3: m3, base_minutes: mins, image: "assets/products/barrel-swivel-armchair.png", is_example: true });
      render();
      toast("Added " + name + ".");
      return;
    }
    if (t.id === "btn-save-prop") {
      e.preventDefault();
      if (!perm().editRules) return;
      var m = modifierFor(state._prop);
      var v = parseInt($("#mod-min") && $("#mod-min").value, 10);
      if (!isNaN(v)) m.minutes = v;
      render();
      toast("Property type saved. Configured times will use +" + m.minutes + " min" + (m.per === "floor" ? " per floor" : "") + ".");
      return;
    }
    if (t.id === "btn-add-sk") {
      e.preventDefault();
      if (!perm().editSkillsets) return;
      var n = ($("#sk-name") && $("#sk-name").value.trim()) || "New skillset";
      var mins = parseInt($("#sk-min") && $("#sk-min").value, 10) || 15;
      state.skillsets.push({ id: "sk-" + Date.now(), name: n, minutes: mins });
      render();
      return;
    }
    if (t.id === "btn-add-label") {
      e.preventDefault();
      if (!perm().editSkillsets) return;
      var n = ($("#new-label") && $("#new-label").value.trim());
      if (n && state.labels.indexOf(n) === -1) state.labels.push(n);
      render();
      return;
    }

    if (t.id === "btn-save-grouping") {
      e.preventDefault();
      if (!perm().editRules) return;
      var extra = parseInt($("#grp-extra") && $("#grp-extra").value, 10);
      var maxn = parseInt($("#grp-max") && $("#grp-max").value, 10);
      if (!isNaN(extra)) state.grouping.extraHandlingMinutes = Math.max(0, Math.min(60, extra));
      if (!isNaN(maxn)) state.grouping.maxOrdersPerGroup = Math.max(2, Math.min(20, maxn));
      render();
      toast("Grouping rules saved. Combined stop times will use " + state.grouping.extraHandlingMinutes + " min per extra order.");
      return;
    }
    var grpSel = t.getAttribute("data-toggle-group-sel") || (t.closest && t.closest("[data-toggle-group-sel]") && t.closest("[data-toggle-group-sel]").getAttribute("data-toggle-group-sel"));
    if (t.getAttribute("data-toggle-group-sel") || (t.closest && t.closest("[data-toggle-group-sel]") && !t.closest("[data-toggle-group]"))) {
      if (grpSel) {
        e.preventDefault();
        var members = groupJobs(cfgJobs()).filter(function (g) { return g.key === grpSel; });
        var jobs = members.length ? members[0].jobs : [];
        var all = jobs.every(function (j) { return state.selected.has(j.id); });
        jobs.forEach(function (j) { if (all) state.selected.delete(j.id); else state.selected.add(j.id); });
        render();
        return;
      }
    }
    var tg = t.getAttribute("data-toggle-group") || (t.closest && t.closest("[data-toggle-group]") && t.closest("[data-toggle-group]").getAttribute("data-toggle-group"));
    if (tg && !t.closest("[data-toggle-group-sel]")) {
      e.preventDefault();
      if (state.collapsedGroups.has(tg)) state.collapsedGroups.delete(tg); else state.collapsedGroups.add(tg);
      render();
      return;
    }
    var src = t.getAttribute("data-job-source");
    if (src) { e.preventDefault(); setJobSource(src); return; }
    var flow = t.getAttribute("data-flow");
    if (flow) {
      e.preventDefault();
      state.flow = flow;
      if (flow === "erp") { setRoute("deliveries"); return; }
      if (flow === "ai" || flow === "radaro") { setRoute("configurator"); return; }
      if (flow === "routes") {
        if (state.pushed) setRoute("deliveries");
        else setRoute("configurator");
        return;
      }
      if (flow === "export") {
        setRoute("configurator");
        if (state.applied) openExport("regional");
        return;
      }
      if (flow === "fms") {
        setRoute("configurator");
        if (state.applied) openExport("fms");
        return;
      }
      render();
      return;
    }
    var region = t.getAttribute("data-region");
    if (region) {
      e.preventDefault();
      if (!(perm().allRegions || region === "NSW")) return;
      state.region = region;
      if (state.pulled) { state.pulledCount = cfgJobs().length; state.selected = new Set(cfgJobs().map(function (j) { return j.id; })); }
      render();
      return;
    }
    var view = t.getAttribute("data-view");
    if (view) { e.preventDefault(); state.delView = view; render(); return; }
    var cfgview = t.getAttribute("data-cfgview");
    if (cfgview) { e.preventDefault(); state.cfgView = cfgview; render(); return; }
    var typ = t.getAttribute("data-type");
    if (typ) {
      e.preventDefault();
      var i = state.filters.types.indexOf(typ);
      if (i === -1) state.filters.types.push(typ); else state.filters.types.splice(i, 1);
      render();
      return;
    }
    var truck = t.getAttribute("data-truck");
    if (truck) {
      e.preventDefault();
      var i = state.filters.trucks.indexOf(truck);
      if (i === -1) state.filters.trucks.push(truck); else state.filters.trucks.splice(i, 1);
      render();
      return;
    }
    var car = t.getAttribute("data-carrier");
    if (car && !t.getAttribute("data-export-carrier")) {
      e.preventDefault();
      var i = state.filters.carriers.indexOf(car);
      if (i === -1) state.filters.carriers.push(car);
      else if (state.filters.carriers.length === 1) { toast("Keep at least one execution path selected."); return; }
      else state.filters.carriers.splice(i, 1);
      render();
      return;
    }
    var fil = t.getAttribute("data-filter");
    if (fil && (fil === "paid" || fil === "confirmed" || fil === "ready")) {
      e.preventDefault();
      state.filters[fil] = !state.filters[fil];
      render();
      return;
    }
    var prop = t.getAttribute("data-prop");
    if (prop) { e.preventDefault(); state._prop = prop; render(); return; }
    var expand = t.closest && t.closest("tr.expandable") && t.closest("tr.expandable").getAttribute("data-expand");
    if (expand && !t.closest("button") && !t.closest("select")) {
      if (state.expanded.has(expand)) state.expanded.delete(expand); else state.expanded.add(expand);
      render();
      return;
    }
    var toggleRun = t.getAttribute("data-toggle-run") || (t.closest && t.closest("[data-toggle-run]") && t.closest("[data-toggle-run]").getAttribute("data-toggle-run"));
    if (toggleRun && !t.closest("button")) {
      if (state.collapsedRuns.has(toggleRun)) state.collapsedRuns.delete(toggleRun); else state.collapsedRuns.add(toggleRun);
      render();
      return;
    }
    var sub = t.getAttribute("data-submit-run");
    if (sub) { e.preventDefault(); submitRun(sub); return; }
    var ovb = t.getAttribute("data-override-block");
    if (ovb) {
      e.preventDefault();
      if (!perm().overrideBlock) { toast("Only a regional manager or above can override a payment or ready block."); return; }
      state.blockJob = ovb;
      state._blockReason = "EFT confirmed";
      state._blockNote = "";
      state.modal = "block";
      renderOverlay();
      return;
    }
    var open = t.getAttribute("data-open-drawer");
    if (open) { e.preventDefault(); if (!perm().overrideTimes) return; state.drawer = open; state._ovDraft = null; renderOverlay(); return; }
    var toggleSel = t.getAttribute("data-toggle-sel") || (t.closest && t.closest("[data-toggle-sel]") && t.closest("[data-toggle-sel]").getAttribute("data-toggle-sel"));
    if (toggleSel && (t.getAttribute("data-toggle-sel") || t.closest("button"))) {
      e.preventDefault();
      if (state.selected.has(toggleSel)) state.selected.delete(toggleSel); else state.selected.add(toggleSel);
      render();
      return;
    }
    var skip = t.getAttribute("data-skip");
    if (skip) {
      e.preventDefault();
      if (state.skipped.has(skip)) state.skipped.delete(skip); else state.skipped.add(skip);
      render();
      return;
    }
    var step = t.getAttribute("data-step");
    if (step) {
      e.preventDefault();
      var dir = parseInt(t.getAttribute("data-dir"), 10) || 0;
      var ov = state.overrides[step];
      if (ov) { ov.minutes = Math.max(5, Math.min(180, ov.minutes + dir)); render(); }
      return;
    }
    var dstep = t.getAttribute("data-draft-step");
    if (dstep && state._ovDraft) {
      e.preventDefault();
      state._ovDraft.minutes = Math.max(5, Math.min(180, state._ovDraft.minutes + parseInt(dstep, 10)));
      renderOverlay();
      return;
    }
    var revert = t.getAttribute("data-revert");
    if (revert) {
      e.preventDefault();
      delete state.overrides[revert];
      if (state.drawer === revert) { state.drawer = null; }
      render();
      toast("Reverted " + revert + " to the AI time.");
      return;
    }
    var delSk = t.getAttribute("data-del-sk");
    if (delSk != null) { e.preventDefault(); if (!perm().editSkillsets) return; state.skillsets.splice(parseInt(delSk, 10), 1); render(); return; }
    var delLb = t.getAttribute("data-del-label");
    if (delLb != null) { e.preventDefault(); if (!perm().editSkillsets) return; state.labels.splice(parseInt(delLb, 10), 1); render(); return; }
    var doEx = t.getAttribute("data-do-export");
    if (doEx) { e.preventDefault(); doExport(doEx); return; }
  }

  function onChange(e) {
    var t = e.target;
    if (t.id === "role-switch") {
      state.role = t.value;
      if (!perm().allRegions) state.region = "NSW";
      render();
      toast("Viewing as " + perm().label + (perm().allRegions ? " · all regions" : " · NSW"));
      return;
    }
    if (t.id === "sort-del") { state.sort = t.value; render(); return; }
    if (t.id === "draft-label" && state._ovDraft) { state._ovDraft.label = t.value; return; }
    if (t.getAttribute("data-ov-label")) {
      var id = t.getAttribute("data-ov-label");
      if (state.overrides[id]) state.overrides[id].label = t.value;
      return;
    }
    if (t.getAttribute("data-fms-choice")) {
      var id = t.getAttribute("data-fms-choice");
      var job = jobById(id);
      if (job) job.fmsChosen = t.value;
      render();
      return;
    }
    if (t.getAttribute("data-export-carrier")) {
      var id = t.getAttribute("data-export-carrier");
      var i = state.exportPick.indexOf(id);
      if (t.checked && i === -1) state.exportPick.push(id);
      if (!t.checked && i !== -1) state.exportPick.splice(i, 1);
      renderOverlay();
      return;
    }
    if (t.getAttribute("data-remove-filter")) {
      state.removeFilter[t.getAttribute("data-remove-filter")] = !!t.checked;
      renderOverlay();
      return;
    }
    if (t.name === "block-reason") { state._blockReason = t.value; return; }
    if (t.getAttribute("data-grp-toggle") && perm().editRules) {
      state.grouping[t.getAttribute("data-grp-toggle")] = !!t.checked;
      render();
      return;
    }
    if (t.getAttribute("data-sk-min") != null && perm().editSkillsets) {
      var i = parseInt(t.getAttribute("data-sk-min"), 10);
      if (state.skillsets[i]) state.skillsets[i].minutes = parseInt(t.value, 10) || state.skillsets[i].minutes;
    }
  }
  function onInput(e) {
    var t = e.target;
    var map = { "search-del": "searchDel", "search-cfg": "searchCfg", "search-prod": "searchProd" };
    if (map[t.id]) {
      state[map[t.id]] = t.value;
      state._focus = t.id;
      state._caret = t.selectionStart;
      render();
      return;
    }
    if (t.id === "draft-reason" && state._ovDraft) state._ovDraft.reason = t.value;
    if (t.id === "block-note") state._blockNote = t.value;
  }
  function onKey(e) {
    if (e.key === "Escape") closeOverlay();
  }

  function init() {
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mouseenter", function (e) {
      var why = e.target && e.target.closest ? e.target.closest(".why") : null;
      if (why) placeTooltip(why.querySelector(".tooltip"));
    }, true);
    window.addEventListener("resize", syncStickyClearance);
    window.addEventListener("hashchange", render);
    $("#role-switch").addEventListener("change", function () { /* handled in onChange */ });
    Promise.all([
      fetch("data/jobs.json").then(function (r) { return r.json(); }),
      fetch("data/config-model.json").then(function (r) { return r.json(); }),
    ]).then(function (pair) {
      state.jobs = (pair[0].jobs || pair[0]).map(function (j) { return j; });
      state.products = (pair[1].products || []).map(function (p) {
        var img = p.image || "";
        if (img && img.indexOf("assets/") !== 0) img = "assets/" + img.replace(/^\//, "");
        return { id: p.id, name: p.name, configuration: p.configuration, cubic_m3: p.cubic_m3, base_minutes: p.base_minutes, image: img, default_label: p.default_label };
      });
      parseHash();
      render();
    }).catch(function (err) {
      console.error(err);
      $("#app").innerHTML = "<p class=\"muted\" style=\"padding:40px\">Couldn’t load the example data.</p>";
    });
  }
  init();
})();
