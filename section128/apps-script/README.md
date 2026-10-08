# Section 128 lead script — deploy steps for Daniel

This is a **new** Apps Script. Do not paste it into the quote-tool project, and do not change that project’s `/exec` URL.

The page reads the web-app URL from `section128/config.js` (`endpoint`). Until that value is a real `/exec` URL, the page still builds the Word and PDF drafts in the browser and shows that they are ready to download. It does not email anyone.

## 1. Create the spreadsheet

1. In Google Drive, next to the quote-tool sheet, create a spreadsheet named **DK Benefits Section 128 Leads**.
2. Extensions → Apps Script.
3. Delete the default `Code.gs` contents.

## 2. Add the three script files

Create these files in the Apps Script project (the names must match):

| Apps Script file | Paste from the repo |
|---|---|
| `S128Model.gs` | `section128/s128-model.js` (entire file) |
| `S128Docgen.gs` | `section128/s128-docgen.js` (entire file) |
| `Code.gs` | `section128/apps-script/Code.gs` (entire file) |

`S128Model.gs` and `S128Docgen.gs` are the same source the page uses, so the server checks the same rules. The page also sends the Word and PDF files it created.

Save the project. Do not add the Drive API.

## 3. Attachments

The page sends the Word and PDF files in the submission as base64. The script checks the type, the size (1.5 MB each, up to four files), and the file signature (`PK` for Word, `%PDF` for PDF), then attaches the files that pass. If the Word plan is missing or fails those checks, the script rebuilds the Word file from the submitted answers, including the Section 125 amendment when a cafeteria plan name was confirmed. No Drive conversion is used.

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

Commit that one-line change and let GitHub Pages publish it. After that, a submission on `https://dankirves-prog.github.io/dkbenefits-tools/section128/` emails:

- **dan@dkbenefits.net** — summary plus the draft Word plan and PDF (and the Section 125 amendment when a cafeteria plan was confirmed)
- the visitor — the same attachments, at the email address they typed, limited to 3 copies per address per hour

The page shows an “emailed” confirmation only when the script returns `{"ok":true,...}` after MailApp accepts your message.

## 6. What the script does

- Checks the same field, date, and year-specific dollar limits as the page.
- Rejects a filled honeypot and any submission completed in under 3 seconds.
- Uses `CacheService` to limit visitor copies.
- Stops after `S128_DAILY_LEAD_CAP` lead emails in a UTC day. The default at the top of `Code.gs` is 50. A retry of a draft Dan already received does not count again.
- Records whether Dan’s email and the visitor’s copy each went out. A retry of the same submission id sends only the missing part. If Dan already received the draft and the visitor copy failed, the retry emails the visitor and does not email Dan again. When both already went out, the retry returns `ok: true` with `duplicate: true`.
- Writes each attempt to the `Submissions` tab and a short line to the `Events` tab.
- Sends your email first. If the daily MailApp quota cannot cover a second message, you still get the draft and the visitor does not.

## 7. A safe test after deploy

Open the page with `?live=1&test=1`, use a real address you can check, and submit one employer-grant draft. The subject should start with `[TEST]`. Salary-reduction and combined drafts are separate tests if you want the amendment attachment checked. Do not use the quote-tool URL for this.
