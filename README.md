# DK Benefits Tools

The quote tool demo is now isolated in its own folder so existing files (including `wrapplan.html`) are not affected.

## Employee Benefits Compliance Assessment

Self-contained quiz + scoring + results (no Wix Velo). Scoring is a port of the live dkbenefits.net compliance quiz engine, with Pages-path additions (Marketplace notice on the no-benefits path, SBC distribution, state / mini-COBRA).

- `compliance-assessment.html` — single-page assessment, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/compliance-assessment.html`
- `compliance-assessment-embed.html` — Wix HtmlComponent shim that iframes the Pages URL and forwards `postMessage` both ways (resize + optional future hooks), same pattern as `section125-embed.html`

The assessment posts `{ type: 'resize', height }` on load, fonts ready, each step change, option select, and window resize (debounced; sent twice after layout). Height is the document content height (`document.documentElement.scrollHeight` / `body.scrollHeight` plus the content root), not a clipped iframe rect. The embed shim sets the iframe height from that message (absolute floor 450px, plus a few pixels of padding — no fixed 6953px results height).

**Live Wix cutover:** point the compliance quiz HtmlComponent(s) at the embed shim (`compliance-assessment-embed.html`). Quiz and results now live in one iframe, so the two-component Velo page (`htmlQuiz` / `htmlResults`) can be replaced by a single HtmlComponent.

**Wix Velo follow-up (not in this repo):** live Velo still floors the HtmlComponent with `$w("#htmlQuiz").height = Math.max(u.height + 40, 670)`. That 670px minimum leaves a large empty gap under short quiz steps even after Pages reports the true content height. After this Pages change, update Velo to `height + 40` only (no 670 floor) so short steps can shrink. Do not reintroduce a Velo file here unless one already exists.

Local preview:

```text
http://localhost:8000/compliance-assessment.html
http://localhost:8000/compliance-assessment-embed.html
```

## Section 125 Plan Tool

- `section125.html` — Section 125 cafeteria plan wizard, hosted on GitHub Pages at `https://dankirves-prog.github.io/dkbenefits-tools/section125.html`
- `section125-embed.html` — Wix HtmlComponent shim that iframes the Pages URL and forwards `postMessage` both ways (same pattern as the Wrap Plan filesusr shim)

## Quote Tool Demo Location

- Local path: `quote-tool-demo/`
- Main file: `quote-tool-demo/index.html`

## Run locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/compliance-assessment.html
http://localhost:8000/quote-tool-demo/
```

## GitHub Pages path

If this repo is published with GitHub Pages, the demo URL should be:

```text
https://<your-github-username>.github.io/<your-repo-name>/quote-tool-demo/
```

## Files in `quote-tool-demo/`

- `index.html`
- `styles.css`
- `app.js`
- `plans.json`
- `config.json`

## Notes

- `wrapplan.html` remains unchanged at the repository root.
- Expired rates are shown as `Current pricing needs verification`.
