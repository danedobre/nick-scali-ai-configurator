
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
    var canAct = state.pulled && nSel > 0 && state.suggested && !state.aiRunning;
    return "<div><div class=\"cfg-bar\"><div class=\"regions\">" + regionPills + "</div>" +
      '<div class="box" style="width:auto;display:flex;align-items:center;height:36px">24–25 Nov 2026</div>' +
      '<div class="search" style="flex:1;height:36px">' + searchIcon() + '<input id="search-cfg" placeholder="Search order #, customer, suburb" value="' + esc(state.searchCfg) + '"></div>' +
      '<button class="btn btn-navy" id="btn-sync-cfg"' + (state.aiRunning ? " disabled" : "") + ">" + (state.jobSource === "erp" ? "Pull from ERP" : radaroMark("white") + " Pull from Radaro") + "</button>" +
      '<button class="btn btn-ghost" id="btn-run-ai"' + (state.pulled && !state.aiRunning ? "" : " disabled") + ">" + (state.suggested ? "Re-run AI" : "Run AI") + "</button>" +
      '<div class="seg" id="cfg-view"><button type="button" data-cfgview="table" class="' + (state.cfgView === "table" ? "on" : "") + '">Table</button><button type="button" data-cfgview="cards" class="' + (state.cfgView === "cards" ? "on" : "") + '">Cards</button></div></div>' +
      sourceSwitchHtml("configurator") +
      '<div class="cfg-bar" style="padding-top:0"><span class="k" style="margin-right:8px">Execution</span><div class="chips">' + carrierChips + "</div></div>" +
      status + '<div class="cfg-table-wrap">' + table + "</div>" +
      '<div class="sticky"><div class="selcount">' + selectedVis.length + " selected</div>" +
      '<div class="dry">Preview a dry run before pushing or exporting.</div>' +
      '<div class="sticky-actions">' +
      '<button class="btn btn-ghost" id="btn-dry"' + (canAct ? "" : " disabled") + ">Preview dry run</button>" +
      '<button class="btn btn-ghost" id="btn-apply"' + (canAct && !state.applied ? "" : " disabled") + ">Apply AI configuration</button>" +
      '<button class="btn btn-navy" id="btn-push"' + (state.applied && radaroN ? "" : " disabled") + ">" + radaroMark("white") + " Push to Radaro" + (radaroN ? " · " + radaroN : "") + "</button>" +
      '<button class="btn btn-ghost" id="btn-export-reg"' + (state.applied && carN ? "" : " disabled") + ">Export to carriers" + (carN ? " · " + carN : "") + "</button>" +
      '<button class="btn btn-ghost" id="btn-export-fms"' + (state.applied && fmsN ? "" : " disabled") + ">Export to FMS" + (fmsN ? " · " + fmsN : "") + "</button>" +
      "</div>" +
      (state.pulled && !nSel ? '<div class="hint">Select jobs to apply, push or export.</div>' : "") +
      (state.applied && nSel && !regionCarN ? '<div class="hint">No regional jobs in this region. Switch View as to Global manager and choose All Australia.</div>' : "") +
      "</div></div>";
  }
  function confCell(c) {
    if (c == null || c === "") return "—";
    var cls = c >= 90 ? "conf-hi" : c >= 80 ? "conf-mid" : "conf-lo";
    return '<span class="' + cls + '">' + c + "%</span>";
  }
  function labelChips(labels) {
    if (!labels.length) return '<span class="muted">—</span>';
    return '<div class="chips">' + labels.map(function (l) {
      var cls = l === "Access check" ? "chip chip-acc" : (l === "Assembly" || l === "Assembly only" ? "chip chip-asm" : "chip");
      return '<span class="' + cls + '">' + esc(l) + "</span>";
    }).join("") + "</div>";
  }

  function renderCfgBody(jobs) {
    state._aiRevealI = 0;
    var html = "";
    groupJobs(jobs).forEach(function (g) {
      if (g.jobs.length === 1) { html += cfgRow(g.jobs[0]); return; }
      var t = groupTimes(g.jobs);
      var collapsed = state.collapsedGroups.has("cfg:" + g.key);
      var allSel = g.jobs.every(function (j) { return state.selected.has(j.id) && !state.skipped.has(j.id); });
      var timeCell = (state.suggested || state.applied)
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
    } else if (state.suggested || state.applied) {
      skill = '<div class="why"><span class="mins" data-mins="' + job.id + '">' + d.minutes + '<span class="u">min</span></span><i data-why="' + job.id + '">?</i><div class="tooltip"><b>Why</b>' + esc(d.why) + "</div></div>" + fmsBlock(job);
    } else {
      skill = '<span class="muted">—</span>';
    }
    var st = skipped ? '<span class="pill pill-mute">Skipped</span>' : d.status === "overridden" ? '<span class="pill pill-warn">Overridden</span>' : d.status === "configured" ? '<span class="pill pill-ok">Configured</span>' : d.status === "suggested" ? '<span class="pill pill-sug">Suggested</span>' : '<span class="pill pill-mute">Pending</span>';
    var reveal = (state.suggested || state.applied) && state._aiReveal;
    var delay = (state._aiRevealI = (state._aiRevealI || 0) + 1);
    var delStyle = reveal ? ' style="--ai-d:' + Math.min(12, delay) * 55 + 'ms"' : "";
    return '<tr class="' + (skipped ? "mute " : "") + (reveal ? "ai-in" : "") + '" data-job="' + job.id + '"' + delStyle + '><td><button type="button" data-toggle-sel="' + job.id + '">' + chk(selected ? "on" : "off") + '</button></td><td class="onum">' + esc(job.id) + '</td><td><div class="name">' + esc(job.customer) + '</div><div class="sub">' + esc(job.suburb) + "</div></td><td>" +
      (job.items.length > 1 ? stack(job.items) : '<div class="stack"><img src="' + esc(job.items[0].image) + '" alt=""></div>') +
      "</td><td>" + esc(m.short) + (job.floors ? ", " + job.floors + " floor" + (job.floors === 1 ? "" : "s") : "") + "</td><td>" + execCell(job) + '</td><td class="muted">35<span class="u">min</span></td><td class="ai-cell">' + skill + '</td><td class="ai-cell">' +
      (skipped || !d.labels.length ? "—" : labelChips(d.labels)) + '</td><td class="ai-cell">' + confCell(skipped ? null : d.confidence) + "</td><td>" + st +
      (!skipped && perm().overrideTimes ? ' <button class="btn btn-ghost btn-sm" data-open-drawer="' + job.id + '">Edit</button>' : "") +
      ' <button class="btn btn-quiet" data-skip="' + job.id + '" style="font-size:12px;color:var(--taupe);background:none;border:0">' + (skipped ? "Undo skip" : "Skip") + "</button></td></tr>";
  }
  function renderCfgCards(jobs) {
    return '<div class="grid">' + jobs.map(function (j) {
      var d = displayOf(j);
      return '<article class="card"><div class="hero-shot"><img src="' + esc(j.items[0].image) + '" alt=""></div><div class="top"><span class="onum">' + esc(j.id) + "</span>" +
        (d.status === "configured" ? '<span class="pill pill-ok">Configured</span>' : d.status === "overridden" ? '<span class="pill pill-warn">Overridden</span>' : d.status === "suggested" ? '<span class="pill pill-sug">Suggested</span>' : state.skipped.has(j.id) ? '<span class="pill pill-mute">Skipped</span>' : '<span class="pill pill-mute">Pending</span>') +
        '</div><div class="name">' + esc(j.customer) + '</div><div class="sub">' + esc(j.suburb) + " · " + esc(j.carrier) + "</div>" +
        '<div style="margin-top:8px" class="' + ((state.suggested || state.applied) && !state.skipped.has(j.id) ? "mins" : "muted") + '">' + (!(state.suggested || state.applied) || d.minutes == null ? "—" : d.minutes + '<span class="u">min</span>') + "</div>" +
        labelChips(d.labels) + fmsBlock(j) + "</article>";
    }).join("") + "</div>";
  }
