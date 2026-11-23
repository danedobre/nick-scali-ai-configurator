# Nick Scali AI configurator — clickable demo (example data)

A static, client-side prototype of the Nick Scali last-mile AI configurator. Nothing is stored or sent to a server.

Open `index.html` from a local web server (needed so `jobs.json` can load):

```
cd demo
python3 -m http.server 4173
# then visit http://127.0.0.1:4173/
```

## What it shows

- **Deliveries** — supporting context only (group-by-run, utilisation vs 30 m³ / 80% target, held orders, picklists, grouped stops). Not a replica of any live ERP.
- **AI configurator** — the centrepiece. Pull jobs, apply service times (largest item + ⅓ of extras, plus property modifiers; pickups and ATL parcels are about 10 min), override, dry run. White glove includes assembly. Assembly only is a rare return visit when the goods are already at the house — no delivery leg, and no cubic on the truck.
- **Grouped stops** — same delivery address (or site ID), different orders or customers, is one stop. The first order takes the full service time; each extra order only adds its handling share. Used for transfers (showroom changeover, click-and-collect, repair drops) and for ordinary customer orders. Grouping rules live under Settings → Rules.
- **Three execution paths** after AI config:
  1. **Push to Radaro** for metro last-mile
  2. **Export to regional carriers** (CSV + branded PDF)
  3. **Export to FMS** (freight management system) for ATL / postage parcels, with a simulated cheapest/fastest recommendation for Carrier A, B or C that you can override
- **Job source** — *Pull from ERP* (recommended: ERP → AI config, then route out) or *Pull from Radaro* (Regional / Parcel jobs in Radaro flow in; after you export them, remove them so they don’t sit unassigned).
- **Settings** — products, property types, skillsets, labels, rules (including grouping), users & roles, integrations (Radaro, regional carriers, FMS).
- **Impact** — example 35 → 26.5 min, ~100 min saved per driver per day.

Use **View as** in the header to switch roles. The switcher actually changes what you can edit or override.

All names, jobs, prices and ETAs are example data. The only company / system names used in the demo are Nick Scali and Radaro.
