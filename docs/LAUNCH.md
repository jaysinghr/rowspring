# Rowspring launch checklist

Public name: Rowspring. Support: rowspring.app@gmail.com.

Assets in the repo:

- `site/` — static site: `index.html`, `privacy.html`, `terms.html`, `assets/rowspring-{32,128,512}.png`. Host it at a public HTTPS URL.
- `production/appsscript.json` — add-on manifest. Replace `REPLACE_WITH_PUBLIC_URL` with the hosted site URL before pushing to the production project.
- `scripts/make-logo.mjs` — regenerates the icons (`node scripts/make-logo.mjs`).

Dev stays bound to the dev sheet via `addon/.clasp.json`. Production must be a **standalone** Apps Script project (not container-bound) for the Marketplace.

Order: host site -> production Apps Script + Cloud project -> OAuth consent screen + verification -> Marketplace SDK config -> listing -> submit.
