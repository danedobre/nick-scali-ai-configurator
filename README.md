# Nick Scali AI configurator — clickable demo (example data)

A static, client-side prototype of the Nick Scali last-mile AI configurator. Nothing is stored or sent to a server.

Open `index.html` from a local web server (needed so `jobs.json` can load):

```
cd demo
python3 -m http.server 4173
# then visit http://127.0.0.1:4173/
```

## What it shows

- **Deliveries** — supporting context only (group-by-run, utilisation vs 30 m³ / 80% target, held orders, picklists). Not a replica of any live ERP.
- **AI configurator** — the centrepiece. Pull jobs, apply service times (largest item + ⅓ of extras, plus property modifiers; pickups and ATL parcels are about 10 min), override, dry run.
- **Three execution paths** after AI config:
  1. **Push to Radaro** for metro last-mile
  2. **Export to regional carriers** (CSV + branded PDF)
  3. **Export to MachShip FMS** for ATL / postage parcels, with a simulated cheapest/fastest carrier recommendation you can override
- **Job source** — *Pull from ERP* (recommended: ERP → AI config, then route out) or *Pull from Radaro* (Regional / Parcel jobs in Radaro flow in; after export you can remove them so they don’t sit unassigned).
- **Settings** — products, property types, skillsets, labels, rules, users & roles, integrations (including MachShip and a Radaro tile).
- **Impact** — example 35 → 26.5 min, ~100 min saved per driver per day.

Use **View as** in the header to switch roles. The switcher actually changes what you can edit or override.

All names, jobs, prices and ETAs are example data.
