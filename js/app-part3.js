
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
