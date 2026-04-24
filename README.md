# DK Benefits Group Benefits Quote Tool (Static Demo v1)

This repository now contains a plain HTML/CSS/JavaScript demo that can run locally and later be hosted on GitHub Pages.

## Files

- `index.html` — multi-step quote discovery flow + results/education/CTA sections.
- `styles.css` — premium blue/white modern card styling, spacing, and responsive behavior.
- `app.js` — step logic, eligibility checks, plan filtering, estimate calculations, and rendering.
- `plans.json` — static sample plans (major medical, HSA, major-medical-style, MEC, limited benefit).
- `config.json` — contact details and eligibility threshold configuration.

## Run locally

Because `app.js` fetches JSON files, run through a local server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## What you need to do next

1. **Replace sample rates/plan details with verified values** from your current quote PDFs.
2. **Swap placeholder hero/CTA imagery** with approved Daniel office/meeting photos.
3. **Validate wording/compliance language** for your market and preferred disclosures.
4. **Decide which CTA actions stay mock vs. connect next** (email templates, census upload flow, full market review intake).
5. **Deploy static demo** to GitHub Pages (or your preferred static host) for review.

## Notes

- Expired rates are automatically hidden and shown as: `Current pricing needs verification`.
- Eligibility messaging includes `Likely fit`, `Close to qualifying`, and `Needs review` based on group size/enrollment assumptions.
- MEC/limited benefit cards include the required non-major-medical disclosure.
