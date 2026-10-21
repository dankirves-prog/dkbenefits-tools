# DK Benefits contact form

This replaces the Wix contact form on [dkbenefits.net/contact](https://www.dkbenefits.net/contact). The form page is hosted on GitHub Pages and embedded in Wix with an iframe.

Live page, after this is on `main`:

```text
https://dankirves-prog.github.io/dkbenefits-tools/contact/
```

The only address that receives a lead alert is **dan@dkbenefits.net**. The script will not send that alert anywhere else. About 10 minutes later, the visitor gets one short plain-text note from Daniel Kirves. Reply-To on that note is dan@dkbenefits.net.

Until `contact/config.js` has the web app URL, the form still checks the fields, but it does not say the message was sent. It tells the visitor to call or email instead.

## 1. Create the spreadsheet

1. Open [Google Drive](https://drive.google.com).
2. Click **New**, then **Google Sheets**.
3. Name the spreadsheet **DK Benefits Contact Leads**.
4. In the sheet, click **Extensions**, then **Apps Script**.
5. Select all of the starter code in `Code.gs` and delete it.

The script has to be created from that spreadsheet. Do not start a blank script from script.google.com, and do not paste this into the quote tool or the Section 128 project.

## 2. Paste the script

1. On your computer, open `contact/apps-script/ContactCombined.gs` from this repo.
2. Select the whole file and copy it.
3. Paste it into the empty `Code.gs` in the Apps Script editor.
4. Click **Save** (the disk icon). Leave the project name as it is, or name it `DK Benefits Contact Leads`.

That one file is the whole script. Do not add other files. Do not turn on extra Google services.

## 3. Run setup and allow the trigger

1. In the function dropdown at the top, choose **setup**.
2. Click **Run**.
3. If Google asks you to review permissions, continue, choose the dan@dkbenefits.net account, and click **Allow**. It needs permission to send email and to run the timer.
4. Click the clock icon, **Triggers**, on the left.
5. Confirm one trigger: function `contactSendDueFollowUps`, event **Time-driven**, every **5 minutes**.
6. Click **Run** on `setup` again if you want to be sure. A second run does not add a second trigger.

`setup` also adds three tabs on the spreadsheet: **Submissions**, **FollowUps**, and **Events**. You can leave or delete the empty **Sheet1** tab.

## 4. Deploy the web app

1. Click **Deploy**, then **New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Description: `Contact form`.
4. Execute as: **Me** (dan@dkbenefits.net).
5. Who has access: **Anyone**.
6. Click **Deploy**. If it asks you to authorize, allow it.
7. Copy the **Web app URL**. It ends in `/exec`.

Open that URL in a browser. You should see:

```text
DK Benefits contact form is deployed. Submit the form to send a message.
```

## 5. Point the form at that URL

1. Open `contact/config.js`.
2. Replace the empty quotes on this line with the URL you copied:

```js
var CONTACT_ENDPOINT = '';
```

Example, with your own deployment id:

```js
var CONTACT_ENDPOINT = 'https://script.google.com/macros/s/PASTE_THE_DEPLOYMENT_ID/exec';
```

3. Save the file and publish it to the `main` branch so GitHub Pages updates. The form reads that one constant. There is no other place to put the URL.

After Pages updates, a real submission:

- writes a row on **Submissions**
- emails **dan@dkbenefits.net** right away, with the visitor's address on Reply-To so you can hit Reply
- adds a **FollowUps** row
- about 10 minutes later, emails the visitor the note below

The timer runs every 5 minutes, so the note can arrive a few minutes after the 10 minute mark. It is plain text, with no attachment and no link.

Subject: `Thanks for reaching out to DK Benefits`

```text
Hi [First name],

Thanks for reaching out to DK Benefits. I got your message and will get back to you within one business day. If it's urgent, call or text me at 407-476-5076.

Daniel Kirves
DK Benefits
```

A `[TEST]` submission uses the subject `[TEST] Thanks for reaching out to DK Benefits`. The words of the note stay the same.

## 6. Put the form on the Wix contact page

Remove the old Wix contact form on `/contact` so it stops sending mail.

Add an HTML iframe (Embed HTML, or an iframe element) with this address:

```text
https://dankirves-prog.github.io/dkbenefits-tools/contact/
```

Set the iframe title to `Contact DK Benefits`.

Recommended height:

- **Desktop: 820px**
- **Phone: 1020px**

Those heights fit the form, including the field errors, so the frame does not need to grow after the page loads. If the Wix element only allows one height, use **1020px**. The form sits at the top of the frame. Do not turn on a script that changes the height while the page loads.

```html
<iframe
  src="https://dankirves-prog.github.io/dkbenefits-tools/contact/"
  title="Contact DK Benefits"
  width="100%"
  height="1020"
  style="border:0;display:block;width:100%;max-width:640px;"
></iframe>
```

Publish the Wix page.

## 7. What the script checks

- A hidden honeypot field rejects bots.
- A form finished in under 3 seconds is rejected.
- The same email, and the same browser, can send 3 messages an hour (`CONTACT_VISITOR_HOURLY_LIMIT`).
- At most 50 lead emails go out per UTC day (`CONTACT_DAILY_LEAD_CAP` at the top of the script). A retry of a lead that was already emailed does not count again.
- The same submission id is not emailed twice.
- Each accepted attempt is stored on **Submissions**. A short line is stored on **Events**.
- Dan's email is sent first. The visitor note is queued only after that send succeeds.
- One real visitor note per email address per day. A row marked test still sends, and it does not use up that day's note. The same address is also limited to 3 notes an hour.
- Required fields are first name, email, and message. Last name, company, and phone are optional. A phone number, if filled in, must be 10 digits.

## 8. A safe test after deploy

Open:

```text
https://dankirves-prog.github.io/dkbenefits-tools/contact/?test=1
```

Use an email inbox you can check. Send one message. Dan's subject should start with `[TEST]`. About 10 minutes later the visitor note should arrive with `[TEST] Thanks for reaching out to DK Benefits` and no attachment.

The limits in section 7 still apply to a test, so do not send a burst of them.

## If you update the script later

1. Open the contact Apps Script project (not the quote tool, and not Section 128).
2. Select all of `Code.gs` and replace it with the current `contact/apps-script/ContactCombined.gs`.
3. Save.
4. Click **Deploy**, then **Manage deployments**. Edit the existing web app, choose **New version**, and click **Deploy**. Keep **Execute as: Me** and **Who has access: Anyone**. The `/exec` URL stays the same, so `config.js` does not need a new value.
5. Choose `setup` and click **Run** once.
