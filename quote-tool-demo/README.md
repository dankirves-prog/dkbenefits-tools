# DK Benefits Quote Tool (Employer Funnel Front-End)

This folder contains a static, employer-facing guided quote funnel for DK Benefits.

## Files

- `quote-tool.html` — one-question-at-a-time guided intake + dynamic results + lead capture + CTA
- `quote-tool.css` — premium visual style (desktop-first, mobile-compatible)
- `quote-tool.js` — front-end flow logic, contribution modes, plan card rendering

## Scope

- Front-end only
- No Wix backend integration
- No CRM integration
- No production underwriting logic

## Functional highlights

- Back button on every intake step
- Edit answers returns to first question with saved answers
- Start over resets all answers, contribution mode/values, and lead form state
- Contribution Mode A: % of employee-only premium (50% to 100%)
- Contribution Mode B: flat dollar per enrolled employee ($200/$300/$400/custom)
- Top Display Group, Lower Cost Section, and hidden MEC section
- Plan cards include network, rate, deductible, OOP max, PCP/specialist/urgent care, and Rx summary
- Brief limited-coverage explanation for budget/limited/MEC plan types

## Preview locally

From the repository root:

```bash
python3 -m http.server 8765
```

Open:

- `http://127.0.0.1:8765/quote-tool-demo/quote-tool.html`
