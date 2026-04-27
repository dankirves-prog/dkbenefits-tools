# DK Benefits Quote Tool (Employer Funnel Front-End)

This folder contains a static, employer-facing guided quote funnel for DK Benefits.

## Files

- `quote-tool.html` — one-question-at-a-time guided intake + dynamic results + lead capture
- `quote-tool.css` — premium visual style (desktop-first, mobile-compatible)
- `quote-tool.js` — front-end flow logic, contribution model toggles, plan card rendering

## Scope

- Front-end only
- No Wix backend integration
- No CRM integration
- No production underwriting logic

## Features in this version

- Employer-facing start-page copy using real published starting-rate positioning
- Current-coverage question with only Yes/No paths
- Contribution modeling:
  - percentage of employee-only rate
  - flat monthly dollar amount per enrolling employee
- Benefits-at-a-glance expandable plan highlights
- Clear MEC/limited coverage explanation and major limitations
- Back on intake, plus Edit answers and Start over on results

## Preview locally

From the repository root:

```bash
python3 -m http.server 8765
```

Open:

- `http://127.0.0.1:8765/quote-tool-demo/quote-tool.html`
