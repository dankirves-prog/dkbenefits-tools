# DK Benefits Tools

The quote tool demo is now isolated in its own folder so existing files (including `wrapplan.html`) are not affected.

## Benefits compliance checkup

Scoring lives in `compliance-quiz/quiz-engine.js`. The pages are thin shells.

- `compliance-assessment.html` is the live checkup, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/compliance-assessment.html`
- `compliance-assessment-preview.html` is the draft preview, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/compliance-assessment-preview.html` after this version is on `main`. GitHub Pages serves `main` only.
- `compliance-assessment-embed.html` iframes the live Pages URL and forwards `postMessage` both ways. It does not set the iframe height.
- Optional leads: `compliance-quiz/apps-script/ComplianceLeads.gs`. Leave `QUIZ_LEAD_ENDPOINT` blank until that web app is deployed.

Answers stay in the browser. The page posts `{ type: 'resize', height }` and `{ type: 'scrollTop' }`. It does not post the answers.

**Live Wix:** point one HtmlComponent at `compliance-assessment.html`. Velo sets the height from the resize message. Add a small pad. Do not use a `Math.max` floor. The page body does not force `min-height: 100vh`.

```javascript
$w.onReady(function () {
  $w('#html1').onMessage(function (event) {
    var data = event.data || {};
    if (data.type === 'resize' && data.height) {
      $w('#html1').height = data.height + 24;
    }
    if (data.type === 'scrollTop') {
      $w('#html1').scrollTo();
    }
  });
});
```

If the component cannot listen for messages, size it to the longest collapsed results. Measured on `compliance-assessment.html` at the content width, with every result card still closed:

- Desktop, 1280px wide: 3682px of content. A fixed height of 3710px includes the 24px pad.
- Phone, 390px wide: 4629px of content. A fixed height of 4660px includes the 24px pad.
- A question step is 597px on desktop and 623px on a phone, so a fixed results height leaves empty space during the questions.
- Opening every card grows the page to 8888px on desktop and 11828px on a phone. The resize message covers that. A fixed height clips open cards.

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
