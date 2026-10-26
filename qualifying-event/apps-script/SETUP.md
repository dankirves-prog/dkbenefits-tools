# Qualifying event question form

This form is only for the mid-year election change tool. It is a new Google Sheet and a new Apps Script web app. Do not paste this script into the contact form, the quote tool, Section 125, Section 128, or the wrap plan.

The alert goes to dan@dkbenefits.net. The person who fills out the form does not get an automatic email.

The deployed web app URL is the `QE_QUESTION_ENDPOINT` line in `qualifying-event/index.html`. If that line is empty, the form checks the fields but does not say the question was sent. It tells the visitor to call or email instead.

## 1. Create the spreadsheet

1. Open Google Drive.
2. Click New, then Google Sheets.
3. Name the spreadsheet DK Benefits Qualifying Event Questions.
4. In the sheet, click Extensions, then Apps Script.
5. Select all of the starter code in Code.gs and delete it.

The script has to be created from that spreadsheet. Do not start a blank script at script.google.com.

## 2. Paste the script

1. On your computer, open `qualifying-event/apps-script/Code.gs` from this repo.
2. Select the whole file and copy it.
3. Paste it into the empty Code.gs in the Apps Script editor.
4. Click Save. You can leave the project name, or name it DK Benefits Qualifying Event Questions.

That one file is the whole script. Do not add other files. Do not turn on extra Google services.

## 3. Run setup

1. In the function dropdown at the top, choose setup.
2. Click Run.
3. If Google asks you to review permissions, continue, choose the dan@dkbenefits.net account, and click Allow. It needs permission to edit the spreadsheet and to send email.

setup adds a tab named Questions with the column headings. You can leave or delete the empty Sheet1 tab. Running setup again does not add a second header row.

## 4. Deploy the web app

1. Click Deploy, then New deployment.
2. Click the gear next to Select type and choose Web app.
3. Description: Qualifying event questions.
4. Execute as: Me (dan@dkbenefits.net).
5. Who has access: Anyone.
6. Click Deploy. If it asks you to authorize, allow it.
7. Copy the Web app URL. It ends in /exec.

Use Anyone, not Anyone with a Google account. Visitors on the website are not signed in.

Open that URL in a browser. You should see:

```text
DK Benefits qualifying event questions are deployed. Submit the form to send a question.
```

If you change the script later, deploy a new version (Deploy, Manage deployments, edit, New version, Deploy). The URL stays the same.

## 5. Put the URL in the tool

The current deployment is already on this line in `qualifying-event/index.html`:

```js
var QE_QUESTION_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyQLz93oRRkrZV8Vj6DTbUvIXIyfZO3IfnJ92DHR3upMiNP9GIykZ23GoP5CZvlVMYStQ/exec';
```

If you deploy again and the URL changes, replace that one line and publish the page. Do not put this URL in the contact form or any other tool.

After the site is updated, a real submission:

- adds one row on the Questions tab (time, name, email, phone, company, question, scenario summary, scenario JSON, page URL, and whether the scenario was included)
- emails dan@dkbenefits.net with the question and the scenario, with Reply-To set to the visitor
- does not email the visitor

The form on the tool is always visible. If the visitor ran a scenario and left the include box checked, the row and the email contain that scenario. If they did not run one, or they unchecked the box, the question still comes through and the scenario cells are blank.
