# Wrap plan lead script: deploy steps for Daniel

This is a **new** Apps Script and a **new** spreadsheet. Do not paste it into the Section 125 project, the Section 128 project, or the quote-tool project. Do not change any of those `/exec` URLs.

The page reads the web-app URL from `wrapplan/config.js` (`endpoint`). Until that value is a real `/exec` URL, the page still builds the Word and PDF samples in the browser and lets the employer download them. It does not email anyone.

Template version `wp-v1`. Terms version `wp-terms-1`. The terms in `wp-terms.js` are a draft for DK Benefits LLC's own attorney to review before go-live.

The live Wix page still embeds the root file `wrapplan.html`. Leave that file in place. This preview is a separate folder.

## 1. Create the spreadsheet

1. In Google Drive, signed in as dan@dkbenefits.net, create a spreadsheet named **DK Benefits Wrap Plan Leads**.
2. Extensions → Apps Script.
3. Delete the default `Code.gs` contents.

## 2. Add the script

Paste `wrapplan/apps-script/WpCombined.gs` as the only script file.

That file is `wp-model.js`, `wp-terms.js`, `wp-docgen.js`, and `apps-script/Code.gs`, in that order. Do not paste `wp-tips.js`, `wp-pdf.js`, or `wrapplan.js`. The page builds the PDF in the browser.

Save the project. Do not add the Drive API.

## 3. Run setup once

1. In the editor, select `setupWrapPlan` and click **Run**.
2. Approve the authorization prompt.
3. Confirm the spreadsheet has tabs **Submissions**, **Events**, and **FollowUps**.
4. Confirm **Triggers** shows `wpSendDueFollowUps` every 5 minutes. That trigger also sends Dan's renewal reminders. Running setup again does not add a second trigger.

## 4. Deploy the web app

1. Deploy → New deployment → type **Web app**.
2. Description: `Wrap plan leads`.
3. Execute as: **Me** (`dan@dkbenefits.net`).
4. Who has access: **Anyone**.
5. Deploy and authorize MailApp.
6. Copy the URL that ends in `/exec`.

Opening that URL in a browser should show: `DK Benefits wrap plan lead service is deployed. Submit the form to deliver a lead.`

## 5. Point the page at it

Put that `/exec` URL in `wrapplan/config.js` as `endpoint`. Leave it blank until this deployment exists. A blank endpoint means the preview still builds files and does not email anyone.

After the URL is saved and the page is published, a submission on `https://dankirves-prog.github.io/dkbenefits-tools/wrapplan/`:

- emails **dan@dkbenefits.net** immediately, with the sample Word and PDF files attached
- lets the employer download those files on the page
- about 12 minutes later, during 7:00 a.m. through 6:59 p.m. Eastern, sends one note to the address on the form, with no attachments

`visitor_emailed` stays `no` until that note actually sends. The files are not stored as a public link.

## 6. The delayed note

Subject: `Your wrap plan sample`. A test submission (`?test=1`) uses `[TEST] Your wrap plan sample`.

The note is a short check-in. It hopes the wrap document was useful, suggests the employer's own counsel take a look before anyone signs, and closes with: `If you don't want to hear from me that's fine too just let me know.` Then Daniel Kirves's signature. It does not say the person was added to a list, and it has no unsubscribe line. It has no links.

Reply-To is dan@dkbenefits.net. The From name is Daniel Kirves. One note per address per day, and at most three an hour. The trigger runs every 5 minutes.

## 7. The renewal reminder

The same trigger emails **only** dan@dkbenefits.net when `renewal_reminder_on` has arrived. That date is 90 days before the next plan-year start. If that date has already passed, it is the next business morning. The visitor is not copied.

## 8. Embed it on Wix, later

Use `wrapplan/embed.html`, or point a Wix HTML component at `https://dankirves-prog.github.io/dkbenefits-tools/wrapplan/index.html`.

Do not change the live wrap page until the attorney-review question is answered. The preview can be published on GitHub Pages on its own.

The tool posts `{ type: 'wp-scroll', step }` when the employer changes steps. In the Wix page code, scroll the HTML component only when that message arrives.

## 9. A safe test after deploy

Open the GitHub Pages URL with `?test=1`, use an address you can check, and submit one sample. Dan's subject should start with `[TEST] New Wrap Plan Lead:`. About 12 minutes later, inside the daytime window, the follow-up should arrive with `[TEST] Your wrap plan sample` and no attachments. Do not use the Section 125 URL, the Section 128 URL, or the quote-tool URL for this test.
