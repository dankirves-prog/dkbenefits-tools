# Workforce size calculator lead script

This is a new Apps Script. Do not paste it into the ACA penalty project or any other tool.

The page reads the web-app URL from `aca-workforce/config.js` (`endpoint`). Until that value is a real `/exec` URL, the calculator still runs in the browser. It does not email anyone, and the form says it is not connected yet.

## 1. Create the spreadsheet

1. In Google Drive, signed in as dan@dkbenefits.net, create a spreadsheet named **DK Workforce Leads**.
2. Extensions → Apps Script.
3. Replace the default `Code.gs` with `aca-workforce/apps-script/Code.gs`.

## 2. Deploy the web app

1. Deploy → New deployment → type **Web app**.
2. Execute as: **Me** (dan@dkbenefits.net).
3. Who has access: **Anyone**.
4. Copy the URL that ends in `/exec`.

Opening that URL in a browser should show: `DK Benefits workforce-size lead service is deployed.`

## 3. Point the page at it

In `aca-workforce/config.js`, set `endpoint` to that `/exec` URL. Leave it as an empty string until this deploy exists.
