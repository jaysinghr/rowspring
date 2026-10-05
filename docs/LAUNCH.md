# Rowspring launch checklist

Public name: Rowspring. Support: rowspring.app@gmail.com.

Assets in the repo:

- `site/` — static site: `index.html`, `privacy.html`, `terms.html`, `assets/rowspring-{32,128,512}.png`. A GitHub Pages workflow publishes it at `https://jaysinghr.github.io/rowspring/`.
- `production/appsscript.json` — add-on manifest configured to use the public GitHub Pages logo.
- `scripts/make-logo.mjs` — regenerates the icons (`node scripts/make-logo.mjs`).

Dev stays bound to the dev sheet via `addon/.clasp.json`. Production must be a **standalone** Apps Script project (not container-bound) for the Marketplace.

Order: host site -> production Apps Script + Cloud project -> OAuth consent screen + verification -> Marketplace SDK config -> listing -> submit.
