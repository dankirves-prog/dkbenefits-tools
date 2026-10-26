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

## Contact form

- `contact/` is the contact form for dkbenefits.net/contact, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/contact/`
- Wix embeds that GitHub Pages URL in an iframe. Deploy steps and the iframe height are in `contact/apps-script/README.md`.
- The Apps Script URL is the single `CONTACT_ENDPOINT` value in `contact/config.js`. Until that is a real `/exec` URL, the form does not say a message was sent.

## Meet the Team

- `team/` is the Meet the Team section for dkbenefits.net/aboutus, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/team/`
- Wix "Embed a Site" loads that URL in an iframe. The page background is transparent, and the body does not scroll.
- Set a fixed iframe height. At about 980px wide (the column inside a 1280px browser): **975px**. At 320px wide (Wix mobile embeds): **2127px**. A taller frame, such as 2350px, leaves empty space under the cards. At 360px wide the height is **2043px**.

## About

- `about/` is the about-page embed for dkbenefits.net/aboutus, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/about/`
- It is one page: a navy hero, About Us and Our Mission cards, then the same Meet the Team section. `/team/` stays available on its own.
- Wix "Embed a Site" loads that URL. The hero is solid navy. The rest of the page is `#F5F7FA`, and the body does not scroll.
- The "See Instant Rates" button opens `https://www.dkbenefits.net/instant-group-quote` in the top window.
- Fixed iframe height: **980px wide: 1435px**. **320px wide: 2937px**.

## Section 128 Trump Account Program Draft

- `section128/` — guided draft generator for a Section 128 employer plan, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/section128/`
- The page builds the Word and PDF drafts in the browser. Email starts only after `section128/config.js` has the dedicated Apps Script URL. Deploy steps are in `section128/apps-script/README.md`.
- Research notes: `section128/research/RESEARCH_RECORD.md`

## Qualifying Event Decision Tool

- `qualifying-event/index.html` — Section 125 mid-year election change decision tool, hosted at `https://dankirves-prog.github.io/dkbenefits-tools/qualifying-event/` after this is on `main`. GitHub Pages serves `main` only.
- `qualifying-event/embed.html` — Wix HtmlComponent shim. It iframes that Pages URL, sets the iframe height from `{ type: 'resize', height, tool: 'qualifying-event' }`, and forwards `postMessage` both ways. The iframe address stays the GitHub Pages URL, so the shim shows the new tool only after this is on `main`.
- The tool page is full width and grows with the answers. Set the Wix component to full width, in place of the old 639 by 720 desktop size and 320 by 453 phone size. With the question form on the page, the first screen is about 1600px on a desktop and about 2400px on a phone. A result with the scenario summary is about 1950px on a desktop and about 2900px on a phone. The shim grows its document to the tool. A taller component leaves empty space under the tool. A shorter component scrolls once, in the Wix frame.
- The result keeps the link to the Section 125 plan document tool. `window.QE.scenario` holds the event, change, timing, coverage, follow-ups, and result.
- A question form sits at the bottom of the tool, including before a scenario is run. After a result, the visitor can include a short summary of that scenario or leave it off. The form posts to its own Apps Script web app. The deployed URL is `QE_QUESTION_ENDPOINT` in `qualifying-event/index.html`. The steps are in `qualifying-event/apps-script/SETUP.md`. The alert goes only to dan@dkbenefits.net. The visitor does not get an automatic reply.
- Every path, the result, and the legal basis are in `qualifying-event/SCENARIOS.md`. `npm test` in `qualifying-event/` checks them.
- Paste this into the Wix HTML embed (website address): `https://dankirves-prog.github.io/dkbenefits-tools/qualifying-event/embed.html`

Local preview of the tool (the embed iframe points at the Pages URL, so it shows the live `main` tool until this branch is merged):

```text
http://localhost:8000/qualifying-event/
http://localhost:8000/qualifying-event/test/harness.html
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
