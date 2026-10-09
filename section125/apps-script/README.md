# Section 125 lead script — deploy steps for Daniel

This is a **new** Apps Script and a **new** spreadsheet. Do not paste it into the Section 128 project, and do not paste it into the quote-tool project. Do not change either of those `/exec` URLs.

The page reads the web-app URL from `section125/config.js` (`endpoint`). Until that value is a real `/exec` URL, the page still builds the Word and PDF samples in the browser and lets the employer download them. It does not email anyone.

Template version `s125-v1.0-2026-10-10`. Terms version `s125-terms-2026-10-10`. The script still accepts the previous terms version `s125-terms-2026-10-09` so a page that has not refreshed can post. The Terms of use in `s125-terms.js` are a draft for DK Benefits LLC’s own attorney to review before go-live. They are not themselves legal advice.

The live Wix page that posts to `/_functions/section125pdf` is a different tool. Leave `section125.html` and `section125-embed.html` in place until this replacement is ready to swap in.

## 1. Create the spreadsheet

1. In Google Drive, create a spreadsheet named **DK Benefits Section 125 Leads**.
2. Extensions → Apps Script.
3. Delete the default `Code.gs` contents.

## 2. Add the script

Paste `section125/apps-script/S125Combined.gs` as the only script file.

That file is `s125-model.js`, `s125-terms.js`, `s125-docgen.js`, and `apps-script/Code.gs`, in that order. Do not paste `s125-tips.js`, `s125-pdf.js`, or `section125.js`. The page builds the PDF in the browser. If no valid Word file arrives, the script rebuilds the Word plan and the Word checklist.

Save the project. Do not add the Drive API.

If the web app is already deployed, paste this file over the existing script and save. Then Deploy → Manage deployments → Edit (pencil) → Version → **New version** → Deploy. Do that on the existing deployment before the Wix page is swapped to this tool.

## 3. Run setup once

1. In the editor, select `setupSection125` and click **Run**.
2. Approve the authorization prompt.
3. Confirm the spreadsheet has tabs **Submissions**, **Events**, and **FollowUps**.
4. Confirm **Triggers** shows `s125SendDueFollowUps` every 5 minutes. Running setup again does not add a second trigger.

## 4. Deploy the web app

1. Deploy → New deployment → type **Web app**.
2. Description: `Section 125 leads`.
3. Execute as: **Me** (`dan@dkbenefits.net`).
4. Who has access: **Anyone**.
5. Deploy and authorize MailApp.
6. Copy the URL that ends in `/exec`.

Opening that URL in a browser should show: `DK Benefits Section 125 lead service is deployed. Submit the form to deliver a lead.`

## 5. Point the page at it

In `section125/config.js`, set `endpoint` to that `/exec` URL. Commit that one-line change and let GitHub Pages publish it. Until then, `endpoint` stays empty and the page only downloads files.

After the endpoint is published, a submission on `https://dankirves-prog.github.io/dkbenefits-tools/section125/`:

- emails **dan@dkbenefits.net** immediately, with the sample Word and PDF files attached
- lets the employer download those files on the page
- about 10 minutes later, sends one note to the address on the form, with no attachments

`visitor_emailed` stays `no`. The visitor is not emailed at submit time. The files are not stored as a public link.

## 6. The delayed note

Subject: `Thanks for using my Section 125 tool!` A test submission (`?test=1`) uses `[TEST] Thanks for using my Section 125 tool!`.

The note has exactly two links, in this order:

1. `https://www.dkbenefits.net/section-128-tool`
2. `https://www.dkbenefits.net/instant-group-quote`

Reply-To is dan@dkbenefits.net. The From name is Daniel Kirves. The phone number and www.dkbenefits.net in the signature stay plain text. The note does not print the email address. One note per address per day, and at most three an hour. The trigger runs every 5 minutes and sends rows that have been pending for at least 10 minutes.

## 7. Embed it on Wix

Use `section125/embed.html`, or point a Wix HTML component at `https://dankirves-prog.github.io/dkbenefits-tools/section125/index.html`.

The tool posts `{ type: 's125-scroll', top, step }` only after the employer changes steps or hits a validation error. It does not post that message on load. In the Wix page code, scroll the HTML component only when that message arrives. Do not scroll the component when the page loads.

```javascript
$w.onReady(function () {
  $w('#html1').onMessage(function (event) {
    if (event.data && event.data.type === 's125-scroll') {
      $w('#html1').scrollTo();
    }
  });
});
```

## 8. A safe test after deploy

Open the GitHub Pages URL with `?live=1&test=1`, use an address you can check, and submit one sample. Dan’s subject should start with `[TEST] New Section 125 Lead:`. About 10 minutes later the follow-up should arrive with `[TEST] Thanks for using my Section 125 tool!` and no attachments. Do not use the Section 128 URL or the quote-tool URL for this test.

## 9. Public test files from the old tool

Earlier test PDFs were left in Wix media by a previous draft. Delete those public files from the Wix Media Manager. This replacement does not upload a PDF to a public media URL.
