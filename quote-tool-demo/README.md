# DK Benefits Quote Tool (Employer Funnel Front-End)

This folder contains a static, employer-facing guided quote funnel for DK Benefits.

## Files

- `quote-tool.html` — one-question-at-a-time guided intake + tier mix inputs + dynamic results + lead capture + trust-forward CTA
- `quote-tool.css` — premium visual style (desktop-first, mobile-compatible)
- `quote-tool.js` — front-end flow logic, contribution modes, tier mix estimate math, plan card rendering and disclosures

## Scope

- Front-end only
- No Wix backend integration
- No CRM integration
- No production underwriting logic

## Functional highlights

- Concierge-style intake wording and trust-first hero copy
- No personal employee details required to start
- Back button on every intake step
- Edit answers returns to first question with saved answers
- Start over resets all answers, contribution mode/values, tier mix inputs, and lead form state
- Contribution Mode A: % of employee-only premium (50% to 100%)
- Contribution Mode B: flat dollar per enrolled employee ($200/$300/$400/custom)
- Tier mix inputs (EE / EE+Spouse / EE+Child / Family) drive per-plan premium math
- If mix is missing, smart estimated mix is used and disclosed
- Plan cards use clean mini-sections: Rates, Benefits, Important Notes
- Public-facing plan names and accurate network language
- Limited/MEC plans show brief but clear limitation notes
- Works as a static front-end (no build step required) in modern browsers

## Preview locally

From the repository root:

```bash
python3 -m http.server 8765
```

Open:

- `http://127.0.0.1:8765/quote-tool-demo/quote-tool.html`
