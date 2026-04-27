# DK Benefits Quote Tool (Employer Funnel Front-End)

This folder contains a static, employer-facing guided quote funnel for DK Benefits.

## Files

- `quote-tool.html` — one-question-at-a-time guided intake + tier mix inputs + dynamic results + lead capture + CTA
- `quote-tool.css` — premium visual style (desktop-first, mobile-compatible)
- `quote-tool.js` — front-end flow logic, contribution modes, tier mix estimate math, plan card rendering

## Scope

- Front-end only
- No Wix backend integration
- No CRM integration
- No production underwriting logic

## Functional highlights

- Back button on every intake step
- Edit answers returns to first question with saved answers
- Start over resets all answers, contribution mode/values, tier mix inputs, and lead form state
- Contribution Mode A: % of employee-only premium (50% to 100%)
- Contribution Mode B: flat dollar per enrolled employee ($200/$300/$400/custom)
- Tier mix inputs (EE / EE+Spouse / EE+Child / Family) drive per-plan premium math
- If mix is missing, smart estimated mix is used and disclosed
- Plan cards show Gross Monthly Premium, Estimated Employer Cost, Estimated Employee Payroll Share
- Top Display Group, Lower Cost Section, and hidden MEC section

## Preview locally

From the repository root:

```bash
python3 -m http.server 8765
```

Open:

- `http://127.0.0.1:8765/quote-tool-demo/quote-tool.html`
