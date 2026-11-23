
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
    if (flow) { e.preventDefault(); state.flow = flow; render(); return; }
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
      if (i === -1) state.filters.carriers.push(car); else state.filters.carriers.splice(i, 1);
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
