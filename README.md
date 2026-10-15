# DK Benefits Tools

The quote tool demo is now isolated in its own folder so existing files (including `wrapplan.html`) are not affected.

## Benefits compliance checkup

Scoring lives in `compliance-quiz/quiz-engine.js`. The pages are thin shells.

- `compliance-assessment.html` is the live checkup, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/compliance-assessment.html`
- `compliance-assessment-preview.html` is the draft preview, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/compliance-assessment-preview.html` after this version is on `main`. GitHub Pages serves `main` only.
- `compliance-assessment-embed.html` iframes the live Pages URL and forwards `postMessage` both ways. It does not set the iframe height.
- Optional leads: `compliance-quiz/apps-script/ComplianceLeads.gs`. `QUIZ_LEAD_ENDPOINT` in `compliance-quiz/config.js` is the deployed web app.

Answers stay in the browser. The page may post `{ type: 'resize', height }` and `{ type: 'scrollTop' }`. Those messages are harmless, and the page does not post the answers. The HtmlComponent has no height property, so Wix should not listen for them.

**Live Wix:** point one HtmlComponent at `compliance-assessment.html`. Set a fixed height in the editor: 3710px on desktop and 4660px on mobile. That fits the longest collapsed results. The page hides its own header when it is inside a frame. The page body does not force `min-height: 100vh`.

Set the HtmlComponent iframe title to `Benefits compliance checkup`.

`compliance-assessment-v3.html` is the previous live quiz, kept so the Wix component can point back at it. Use the same fixed heights if the component points at that file.

Local preview:

```text
http://localhost:8000/compliance-assessment.html
http://localhost:8000/compliance-assessment-preview.html
http://localhost:8000/compliance-assessment-embed.html
```

## Section 128 Trump Account Program Draft

- `section128/` — guided draft generator for a Section 128 employer plan, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/section128/`
- The page builds the Word and PDF drafts in the browser. Email starts only after `section128/config.js` has the dedicated Apps Script URL. Deploy steps are in `section128/apps-script/README.md`.
- Research notes: `section128/research/RESEARCH_RECORD.md`

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
