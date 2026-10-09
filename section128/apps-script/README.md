# Section 128 lead script — deploy steps for Daniel

This is a **new** Apps Script. Do not paste it into the quote-tool project, and do not change that project’s `/exec` URL.

The page reads the web-app URL from `section128/config.js` (`endpoint`). Until that value is a real `/exec` URL, the page still builds the Word and PDF samples in the browser and shows that they are ready to download. It does not email anyone.

Template version `s128-v0.5.1-2026-10-09`. Terms version `s128-terms-2026-10-08b`. The Terms of use in `s128-terms.js` are a draft for DK Benefits LLC’s own attorney to review before go-live. They are not themselves legal advice.

## 1. Create the spreadsheet

1. In Google Drive, next to the quote-tool sheet, create a spreadsheet named **DK Benefits Section 128 Leads**.
2. Extensions → Apps Script.
3. Delete the default `Code.gs` contents.

## 2. Add the script files

Either paste `section128/apps-script/S128Combined.gs` as the only `Code.gs`, or create these files (the names must match):

| Apps Script file | Paste from the repo |
|---|---|
| `S128Model.gs` | `section128/s128-model.js` (entire file) |
| `S128Terms.gs` | `section128/s128-terms.js` (entire file) |
| `S128Docgen.gs` | `section128/s128-docgen.js` (entire file) |
| `Code.gs` | `section128/apps-script/Code.gs` (entire file) |

`S128Model.gs`, `S128Terms.gs`, and `S128Docgen.gs` are the same source the page uses. The page also sends the Word and PDF files it created. Do not paste `s128-tips.js` or `section128.js` into Apps Script.

Save the project. Do not add the Drive API. If the spreadsheet already has a Submissions header row, the script fills only blank header cells at the end (`terms_version`, `terms_accepted_at`). It does not insert columns in the middle.

## 3. Attachments

The page sends the Word and PDF files in the submission as base64. The script checks the type, the size (1.5 MB each, up to eight files), and the file signature (`PK` for Word, `%PDF` for PDF), then attaches the files that pass. A combined design sends the plan, the Section 125 amendment, and the implementation guide, each as Word and PDF. If no valid Word file arrives, the script rebuilds the Word plan, the amendment when a cafeteria plan name was confirmed, and the implementation guide. No Drive conversion is used. A submission without an accepted terms acknowledgement is rejected.

## 4. Deploy the web app

1. Deploy → New deployment → type **Web app**.
2. Description: `Section 128 leads`.
3. Execute as: **Me** (`dan@dkbenefits.net`).
4. Who has access: **Anyone**.
5. Deploy and authorize MailApp.
6. Copy the URL that ends in `/exec`.

Opening that URL in a browser should show: `DK Benefits Section 128 lead service is deployed.`

## 5. Point the page at it

In `section128/config.js`, set:

```js
endpoint: 'https://script.google.com/macros/s/PASTE_THE_DEPLOYMENT_ID/exec'
```

Commit that one-line change and let GitHub Pages publish it. After that, a submission on `https://dankirves-prog.github.io/dkbenefits-tools/section128/` :

- emails **dan@dkbenefits.net** immediately with the internal summary (terms version and acceptance time) and the sample Word and PDF files (plan, implementation guide, and the Section 125 amendment when a cafeteria plan was confirmed)
- lets the visitor download those files on the page
- about 10 minutes later, sends the visitor one plain note from Daniel Kirves, with no attachments

The script never attaches visitor-supplied files to the address the visitor typed.

## 6. The delayed note

1. In the Apps Script editor, select `setupFollowUpTrigger` and click **Run**.
2. Approve the authorization prompt (script triggers and email).
3. Confirm **Triggers** shows `s128SendDueFollowUps` every 5 minutes. Running the function again does not add a second trigger.
4. `doPost` also tries to create that trigger if it is missing. If Apps Script blocks that from the web app, the Run step above is the one that installs it.

The note is queued on a `FollowUps` sheet. The trigger sends rows that are still `pending` and at least 10 minutes old, then marks them `sent`, `failed`, or `skipped`. One note per address per day. The same address is also limited to 3 notes an hour. A `[TEST]` submission uses the subject `[TEST] Thanks for using my Section 128 tool`.

`SECTION125_URL` is `https://www.dkbenefits.net/section125plantool`. `RATES_URL` is `https://www.dkbenefits.net/instant-group-quote`. Those are the only two links in the follow-up, Section 125 first. The follow-up is plain text plus an HTML alternative. The greeting uses the first word of the contact name, or “Hi there,” when that name is blank. Reply-To is dan@dkbenefits.net. The signature, including the phone and www.dkbenefits.net, is plain text. The site name is not a third link, and the note does not print the email address. There are no images, tracking parameters, or shortened links.

## 7. What the script does

- Checks the same field, date, and year-specific dollar limits as the page.
- Rejects a filled honeypot and any submission completed in under 3 seconds.
- Stops after `S128_DAILY_LEAD_CAP` lead emails in a UTC day. The default at the top of `Code.gs` is 50. A retry of a lead that was already emailed does not count again.
- Writes each attempt to the `Submissions` tab, including `terms_version` and `terms_accepted_at`, and a short line to the `Events` tab. `lead_emailed` and `visitor_emailed` stay in columns 16 and 17. `visitor_emailed` stays `no` because the visitor is not emailed at submit time.
- Sends Dan’s email first. The visitor note is queued only after that send succeeds.

## 8. A safe test after deploy

Open the page with `?live=1&test=1`, use a real address you can check, and submit one employer-grant draft. Dan’s subject should start with `[TEST]`, and the files should be on that message only. About 10 minutes later the visitor note should arrive with `[TEST] Thanks for using my Section 128 tool` and no attachments. Do not use the quote-tool URL for this.

## Repaste after this change

1. Open the Section 128 Apps Script project (not the quote-tool project).
2. Select all of `Code.gs` and replace it with the current `section128/apps-script/S128Combined.gs`.
3. Save.
4. Deploy → Manage deployments → edit the existing web app → New version → Deploy. Keep **Execute as: Me** and **Who has access: Anyone**. The `/exec` URL stays the same, so `config.js` does not need a new endpoint.
5. Run `setupFollowUpTrigger` once from the editor and accept the authorization prompt.
