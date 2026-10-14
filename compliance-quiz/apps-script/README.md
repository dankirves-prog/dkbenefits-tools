# Compliance checkup leads

`ComplianceLeads.gs` stores optional checkup contacts and emails Dan.

## Setup

1. Create a Google Sheet.
2. Extensions, then Apps Script. Replace the default file with the contents of `ComplianceLeads.gs`.
3. Run `setup`. Approve the permissions. That creates a tab named `DK Compliance Leads` and a trigger that runs `processComplianceFollowUps` every 5 minutes.
4. Deploy, then New deployment, then Web app. Execute as yourself. Who has access: Anyone.
5. Copy the web app URL that ends in `/exec`.
6. Paste that URL into `compliance-quiz/config.js` as `QUIZ_LEAD_ENDPOINT`, then publish the site. Until that URL is set, the checkup shows a message and does not submit.

## What it sends

- Dan (`dan@dkbenefits.net`) gets an immediate note with the first name, company, email, phone, answer summary, and top findings.
- If the visitor left an email, a check-in is queued for 12 minutes later. It sends only from 7:00 through 6:59 p.m. Eastern. Outside that window it waits until 7:00 a.m. Eastern. One note per email per day.
- A phone number with no email still emails Dan. The visitor check-in is skipped.
- Subject: `Thanks for using my compliance checkup!`
- The visitor note has no opt-out line.
