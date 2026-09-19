# DK Benefits Tools

The quote tool demo is now isolated in its own folder so existing files (including `wrapplan.html`) are not affected.

## Employee Benefits Compliance Assessment

Self-contained quiz + scoring + results (no Wix Velo). Scoring is a port of the live dkbenefits.net compliance quiz engine, with Pages-path additions (Marketplace notice on the no-benefits path, SBC distribution, state / mini-COBRA).

- `compliance-assessment.html` — single-page assessment, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/compliance-assessment.html`
- `compliance-assessment-embed.html` — optional height:100% Wix HtmlComponent shim that iframes the Pages URL and forwards `postMessage` both ways (same pattern as Wrap / `section125-embed.html`). Does not set iframe height from resize messages.

The assessment posts `{ type: 'resize', height }` on load, fonts ready, each step change, option select, and window resize (debounced; sent twice after layout). Height is the document content height, not a clipped iframe rect.

**Live Wix:** one HtmlComponent pointed at `compliance-assessment.html`. A simple Velo `onMessage` listener sets the HtmlComponent height to `data.height +` a small pad — no `Math.max` floor and no 670px minimum. Do not use a fixed ~4800px box as the primary approach; parent-driven auto-height is the live pattern. Embedded `body` does not force `min-height: 100vh`, so short steps do not paint a tall empty canvas inside the HtmlComponent.

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
