# ACA calculator lead script

This is a new Apps Script. Do not paste it into the quote-tool project, the Section 125 project, or the Section 128 project.

The page reads the web-app URL from `aca-penalty/config.js` (`endpoint`). Until that value is a real `/exec` URL, the calculator still runs in the browser. It does not email anyone, and the form says it is not connected yet.

## 1. Create the spreadsheet

1. In Google Drive, signed in as dan@dkbenefits.net, create a spreadsheet named **DK ACA Leads**.
2. Extensions → Apps Script.
3. Replace the default `Code.gs` with `aca-penalty/apps-script/Code.gs`.

## 2. Deploy the web app

1. In the editor, select `setupAcaLeads` and click Run. Approve the prompts.
2. Deploy → New deployment → type **Web app**.
3. Execute as: **Me** (dan@dkbenefits.net).
4. Who has access: **Anyone**.
5. Copy the URL that ends in `/exec`.

Opening that URL in a browser should show: `DK Benefits ACA lead service is deployed.`

Confirm **Triggers** shows `acaSendDueFollowUps` every 5 minutes. Running setup again does not add a second trigger.

## 3. Point the page at it

In `aca-penalty/config.js`, set:

```js
endpoint: 'https://script.google.com/macros/s/PASTE_THE_DEPLOYMENT_ID/exec'
```

Commit that one-line change. After GitHub Pages publishes it:

- The first time a visitor gets results, Dan gets one email, subject **ACA calculation run**, with the inputs and results and no contact information. Recalculating updates the same sheet row and does not send that email again.
- When the visitor submits the form, Dan gets one email, subject **ACA compliance review request**, with the contact information and the full results. Submitting again updates the row and does not send a second email.
- About 10 minutes later, during 7:00 a.m. through 6:59 p.m. Eastern, the visitor gets one plain-text check-in with the results summary. There is no second check-in.

The sheet has one row per browser visit. The visitor id is stored in session storage. A later calculation or a form submit updates that row. The script uses LockService and looks up the visitor id before it writes.

A `[TEST]` subject is used when the page is opened with `?test=1`.

Reply-To on the visitor note is dan@dkbenefits.net. The note does not print that address. The signature is plain text.
