# Wix page copy for the ACA Workforce Size Calculator

The calculator itself is an iframe. Google indexes the Wix page around that iframe, not the tool. Paste the copy below on the Wix page. Do not paste it into the GitHub Pages file.

Embed URL, after this file is on `main`:

`https://dankirves-prog.github.io/dkbenefits-tools/aca-workforce-calculator.html`

Iframe title: `ACA Workforce Size Calculator`

Suggested slug: `/aca-workforce-calculator`

This is the workforce-size companion to the ACA Employer Penalty Calculator at `/aca-penalty-calculator`. When the count is an applicable large employer, or on the line at 49 or 50, the tool links there.

## SEO

**Title** (36 characters)

ACA Workforce Size (ATNE) Calculator

**H1**

ACA Workforce Size Calculator

**Meta description** (148 characters)

Free ATNE calculator for Florida and Georgia employers. Average full-time employees plus equivalents to see if you are an applicable large employer.

## Intro and FAQ

The words below are the indexable page copy.

Employers in Florida and Georgia can use this free calculator to see whether they are an applicable large employer for a calendar year. DK Benefits made it for owners who want the headcount in plain English before they look at a penalty.

People often call the figure ATNE, the average total number of employees. That is full-time employees plus full-time equivalents. Status for a calendar year uses the prior calendar year. A full-time employee averages at least 30 hours of service a week, or 130 hours in a month. For everyone else, add hours of service, count no more than 120 hours for any one person, and divide by 120. Average the 12 monthly totals and round down. 50 or more means applicable large employer status, unless the seasonal worker exception applies.

The seasonal exception covers a workforce that exceeds 50 for 120 days or fewer, when the employees above 50 in that stretch are seasonal workers. Four calendar months may be treated as 120 days, and they do not have to be consecutive.

Two other rules change the count, and this page states them without trying to decide them. Companies treated as one employer under the controlled-group and affiliated-service-group rules combine their employees. An employee with TRICARE or Veterans Administration coverage is left out for a month of that coverage, and only for this size test. A company that did not exist on any business day last year uses a reasonable expectation for the current year, and is an applicable large employer only if it also actually averages at least 50.

This is an educational estimate, not legal or tax advice. DK Benefits is a licensed insurance agency, not a tax advisor. Under 50, the employer mandate does not apply, and small-group coverage may still be worth a look. At 50 or above, the next step is the ACA employer penalty calculator.

### Frequently asked questions

**What is ATNE?**
ATNE means average total number of employees. It is the prior-year average of full-time employees plus full-time equivalents, rounded down to a whole number. Applicable large employer status uses that number.

**How are full-time equivalents counted?**
Add the hours of service of employees who are not full-time that month. Count no more than 120 hours for any one person. Divide by 120. Fractions count, and the month may be rounded to the nearest hundredth.

**When does the seasonal worker exception apply?**
When the workforce exceeds 50 for 120 days or fewer and the employees above 50 during that stretch are seasonal workers. Four calendar months count as 120 days. They do not have to be in a row.

**What if the company is new?**
A company that was not in business on any day last year looks at the current year. It is an applicable large employer only if it reasonably expects to average at least 50 full-time employees, counting equivalents, and it actually does.

## FAQPage JSON-LD

Paste this into the Wix page's custom code or an SEO JSON-LD field. Do not put it inside the iframe.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is ATNE?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ATNE means average total number of employees. It is the prior-year average of full-time employees plus full-time equivalents, rounded down to a whole number. Applicable large employer status uses that number."
      }
    },
    {
      "@type": "Question",
      "name": "How are full-time equivalents counted?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Add the hours of service of employees who are not full-time that month. Count no more than 120 hours for any one person. Divide by 120. Fractions count, and the month may be rounded to the nearest hundredth."
      }
    },
    {
      "@type": "Question",
      "name": "When does the seasonal worker exception apply?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "When the workforce exceeds 50 for 120 days or fewer and the employees above 50 during that stretch are seasonal workers. Four calendar months count as 120 days. They do not have to be in a row."
      }
    },
    {
      "@type": "Question",
      "name": "What if the company is new?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A company that was not in business on any day last year looks at the current year. It is an applicable large employer only if it reasonably expects to average at least 50 full-time employees, counting equivalents, and it actually does."
      }
    }
  ]
}
</script>
```
