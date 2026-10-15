# Wrap plan tool spec

Status: Dan approved this spec after Claude's review. The preview in `wrapplan/` follows it. The live page `wrapplan.html` is unchanged. Attorney review before the live Wix page is swapped remains open.

Date: October 15, 2026
Status: specification only. No code, no pull request.
Audience: Dan, then Claude for the build.

This spec replaces the current wrap tool's behavior. Dan's overrides win where an earlier diagnosis or draft said something else. One product question is still open, at the end.

The current live form (`wrapplan.html` at the repo root, embedded on dkbenefits.net) stays up until a later stage swaps it. This spec does not edit that file.

## How to read the seven parts

1. Locked decisions
2. Files and hosting
3. The form
4. What the documents say
5. The v1 download package, and a short v2 sketch
6. Leads, email, and the Google Sheet
7. Rules, tests, and the open question

Visitor-facing sentences in this spec are written so they can be copied into the tool. They do not use an em dash. Year-numbered research citations are not in this spec. They are in the companion research record, and they stay out of the tool.

---

## 1. Locked decisions

**What the tool is.** A free browser tool that drafts an ERISA wrap plan document and summary plan description (SPD), plus the companion papers listed in Part 5, for a private employer. The employer downloads Word and PDF on the spot. DK Benefits is not a law firm. Every document carries this line, under the title and again in the footer area:

Sample prepared for review by the employer's own counsel. DK Benefits is not a law firm.

**Every funding design gets a clean download.** Fully insured, level-funded, self-funded (ASO), captive, and reference-based pricing (RBP) all get Word and PDF immediately. No watermark. No "call us before you can download" path. No assisted-only path.

**Complex funding gets a findings note, not a block.** Level-funded, self-funded ASO, captive, and RBP still download. The findings report explains the design in plain words and adds this sentence:

DK Benefits can do an in-depth review of this arrangement once DK Benefits is the broker of record.

Level-funded is included in that sentence because the document will describe it as a self-funded plan.

**Former hard stops become supported paths.** Mixed waiting periods, mixed pre-tax and after-tax benefits, the employer as appeals fiduciary, a restatement signed after an older effective date, and "100 participants but COBRA was answered no" all produce documents. The odd cases are explained in the findings report. The form does not refuse to generate.

**Three true non-ERISA cases do not get an ERISA wrap.** Governmental plans, church plans, and owner-only arrangements (only the owner and spouse, or only partners and their spouses, with no common-law employee covered) get a short explanation on screen and a one-page Word and PDF titled as an explanation, not as a plan. The lead is still captured and Dan is still emailed. The explanation does not say the arrangement is an ERISA plan.

**No combined PDF in v1.** Each paper is its own Word file and its own PDF. The tool does not merge them into one file. Schedule A is a list of the carrier certificates the employer must attach. Assembly instructions tell the employer the order, how to distribute the package, and to keep the signed copy. Schedule A in this tool is not the insurance schedule that goes with a Form 5500 filing. The on-screen name is "Schedule A: Documents to attach" so those two are not confused.

**Contact info is collected at the download step.** Name and email are required. Phone is optional. The same step asks the requester's role: employer, broker or consultant, TPA, attorney or CPA, or other. The intro may skip any "enter your email to save your place" wall. Progress is saved in the browser (localStorage). The page never says an email is coming, never says "check your inbox," and never says the file was sent to the visitor.

**Plan administrator is the employer by default.** An officer signs for the employer. The officer is not the plan administrator unless the employer changes that on purpose. If they name a person, the document follows what they typed, and the findings report flags it.

**Signature lines stay blank.** The printed name and title of the intended signer are filled in. The signature line and the date line are blank. The form still collects three dates, kept separate: original effective date, the effective date of this document (the restatement date, if it is a restatement), and the date they intend to sign. Those dates can appear in the adoption resolution as the dates the employer entered. They do not get written onto the signature line. If the intended signature date is after the effective date, the findings report says so and asks them to confirm it is a restatement. Generation is not blocked.

**Plan number** is a whole number from 501 through 999. Default 501.

**February plan-year end** is the last day of February, described that way, not as February 28.

**Form 5500 count** uses the four census inputs in Part 4, each person once. The 80-120 band is not a reason to skip a filing. A prior small-plan filing does not change a count of 100 or more. The filing result is printed only in the findings report. The SPD does not say whether this employer must file. It keeps the model line that a participant receives a summary annual report if the plan is required to file an annual report.

**Stop-loss terms never appear in the participant document.** No carrier name, no deductible, no percentage. The form asks only whether stop-loss exists, for the findings report.

**Dependent care stays out of the wrap.** It belongs in the Section 125 plan.

**QMCSO procedures are a real document in v1**, not a promise that procedures exist somewhere else.

**HIPAA amendment is included when the PHI path is on.** Self-funded and level-funded default to on. Fully insured is on only if the employer says it receives health information for plan administration.

**Leads** go to a new Google Sheet in dan@dkbenefits.net through a new Apps Script, on the same pattern as Section 125. Dan is emailed immediately with the files and the findings. One short check-in goes to the visitor 12 minutes later, and only from 7:00 a.m. through 6:59 p.m. Eastern. If the 12 minutes lands outside that window, the note waits until the next 7:00 a.m. Eastern. A renewal reminder is emailed to Dan only, never to the visitor. The reminder date is 90 days before the next plan-year start. If that date has already passed, Dan is reminded the next business morning.

**The check-in close and signature are fixed.** After a short opener, the note ends with these two sentences, then the signature. There is no "Thanks, Dan" line.

Since this is a free tool, it's always a good idea to have your own counsel take a quick look before you sign.

If you don't want to hear from me that's fine too just let me know.

Daniel Kirves
Benefits Broker | 20 Years Exp | DK Benefits
407-476-5076 | www.dkbenefits.net
6000 Metrowest Blvd #200 Orlando, FL 32835
Agency Lic# L109331

**No years and no stale dollar amounts** in visitor copy or in the documents, except the model ERISA rights sentence that says $110 a day. That figure is allowed. Dates the employer typed (effective date, restatement date) are allowed because they are that employer's dates. The name of the statute may say 1974. Day counts that are the law (48 hours, 96 hours, 90 days, 120 days, 210 days, age 26, the 20-employee COBRA test, the 100-participant filing line, plan numbers 501 through 999) stay. A year-numbered bulletin or a year-numbered Form 5500 instruction booklet is not quoted in the tool.

**Attorney review before go-live is not decided.** See Part 7.

---

## 2. Files and hosting

Mirror the Section 125 folder. New code lives in `wrapplan/` with a `wp-` prefix. Do not edit the root file `wrapplan.html`. Do not point the live Wix page at the new folder until a later stage says to swap.

| Path | Role |
| --- | --- |
| `wrapplan/index.html` | The tool page |
| `wrapplan/wrapplan.js` | Wizard, downloads, and the lead post |
| `wrapplan/embed.html` | Wix shim. Iframes the GitHub Pages URL and forwards messages |
| `wrapplan/wrapplan.css` | Layout, mobile first |
| `wrapplan/wp-model.js` | Answers, validation, participant count, findings |
| `wrapplan/wp-terms.js` | Short terms, versioned, for counsel to read before go-live |
| `wrapplan/wp-docgen.js` | Word files |
| `wrapplan/wp-pdf.js` | PDFs |
| `wrapplan/wp-tips.js` | Plain-English help under questions |
| `wrapplan/config.js` | Apps Script `/exec` URL. Empty until Dan deploys |
| `wrapplan/vendor/pdf-lib.min.js` | Same vendored library the other tools use |
| `wrapplan/apps-script/Code.gs` | Sheet, Dan's email, visitor check-in, Dan-only renewal |
| `wrapplan/apps-script/WpCombined.gs` | Single paste file for Apps Script, built like the Section 125 combined file |
| `wrapplan/apps-script/README.md` | Deploy steps for Dan |
| `wrapplan/research/RESEARCH_RECORD.md` | Internal citations. Not shipped in the page |
| `wrapplan/test/` | The tests in Part 7 |

GitHub Pages serves `main` only. The future public URL is:

https://dankirves-prog.github.io/dkbenefits-tools/wrapplan/index.html

Until `config.js` has a real `/exec` URL, the page still builds the Word and PDF files in the browser and still allows download. It does not email anyone.

The Apps Script is a new project and a new spreadsheet. Do not paste it into the Section 125 project, the Section 128 project, or the quote-tool project. Do not change those `/exec` URLs.

**Security, locked for the build.**

- Files are built in the browser. They are posted only to the Apps Script, as attachments on Dan's email. They are not uploaded to Wix media and they are not given a public link.
- `postMessage` checks `event.origin` against an allowlist: `https://www.dkbenefits.net`, `https://dkbenefits.net`, `https://dankirves-prog.github.io`, `https://www-dkbenefits-net.filesusr.com` (the Wix HTML component parent), and the Wix editor preview origins `https://editor.wix.com`, `https://create.editorx.com`, and `https://manage.wix.com`. The embed forwards only those messages. Do not use `*` as the target origin for tool payloads.
- User-typed text is placed with `textContent` or an equivalent escape. Do not assign user text to `innerHTML`.
- The draft in localStorage stays on the device. It is not put in the page URL.
- A hidden honeypot field and a minimum time on the form reject junk before any email is sent. Match the Section 125 limits: reject a filled honeypot, reject a submit faster than 3 seconds, cap Dan's lead emails at 50 in a UTC day, one visitor note per address per day, and at most three visitor notes an hour.

**What the visitor sees at the end.** A Word column and a PDF column. Buttons are gold, class `btn-gold`, same treatment as Section 125 and Section 128. The plan row is labeled exactly:

Download Plan (Word)
Download Plan (PDF)

Other papers use the same gold buttons and the same two columns, with their own names: Download Schedule A (Word), Download Schedule A (PDF), and the same pattern for the adoption resolution, the HIPAA amendment when it applies, the QMCSO procedures, and the findings report.

**Footer on the plan Word file and the plan PDF**, centered:

[Company] Wrap Plan Document and SPD | Page N of X

Word uses page fields so the numbers survive editing. The other papers use the same pattern with their own title, for example "[Company] Schedule A | Page N of X".

**Layout the current PDF gets wrong, and this build fixes.** No large empty first page. The fact table does not strand a wrapped word in its own cell. Header and footer stay clear of the body. A heading stays with its first lines. A bullet does not split across pages. One indent for an article. The courtesy disclaimer is readable, not micro-type.

---

## 3. The form

Mobile first. One column. Inputs at least 16px so phones do not zoom the page by accident. Under 640px the gold buttons are full width, Word on top and PDF under it. Errors appear under the field that failed, in plain language. A step does not advance while that step has an error. The review step is plain English, not a dump of internal field names. Empty rows are omitted.

**Intro, before step 1.** What this tool drafts, that it is a sample for the employer's own counsel, and what to have ready: legal name, EIN, plan year, the name of each carrier or administrator, who is covered, and who will sign. No email required to start. A "save my progress by email" box is out of scope and should be skipped.

**Step 1. Employer and plan identity.** Legal name, EIN (9 digits), employer phone (optional), street, city, state, ZIP (5 digits), plan name (defaults to "[Employer] Group Welfare Benefit Plan"), plan number (501 through 999), original effective date, whether this file is the first adoption or a restatement, restatement effective date if needed, plan year (calendar, or fiscal ending on the last day of a named month). February is "the last day of February." Also ask, in these words: "About how many employees did you have last year, full-time and part-time?" That headcount is used for the parity size test, the applicable-large-employer warning, and the lead score. It is not the participant count.

**Step 2. Is ERISA the right frame?** Private employer, governmental, church, or owner-only. Governmental, church, and owner-only leave the wizard, show the explanation, and still ask for contact info so the lead is saved. Private employer continues. Help text for church plans says a church plan that has elected ERISA coverage is uncommon, and this version still uses the explanation path rather than producing an ERISA SPD.

**Step 3. Benefits.** Checkboxes:

- Medical
- Dental
- Vision
- Prescription drugs, only if carved out of medical
- Group term life
- Group AD&D
- Short-term disability
- Long-term disability
- Employee assistance program
- Health reimbursement arrangement
- Health FSA
- Voluntary life, voluntary AD&D, accident, critical illness, hospital indemnity

Dependent care is not a wrap checkbox. If the employer has a dependent care account, a note says it stays in the Section 125 plan and is not listed in this document. An HSA note says an HSA is the employee's account and is not wrapped.

Uniform eligibility and uniform tax treatment are not hard stops. The form asks, benefit by benefit only where the answer differs, what the waiting period is and whether employee contributions for that benefit are pre-tax, after-tax, or none.

**Step 4. Funding and administrators.** Shown from the benefits just selected.

- Medical funding: fully insured, level-funded, self-funded ASO, captive, or RBP.
- Carrier or TPA name for every wrapped benefit, not only medical.
- Network: traditional, or reference-based pricing. No percentage field and no dollar field.
- Stop-loss: yes or no. No carrier, deductible, or percentage.
- HRA type: integrated, excepted-benefit, individual coverage (ICHRA), or qualified small employer (QSEHRA). Separate HRA document confirmed.
- Health FSA: separate document confirmed.
- EAP: referral-only, or an EAP that provides counseling or other care. Referral-only is left out of the wrap. The other kind is included.
- Short-term disability has three choices. An insured policy is wrapped. Payment from the employer's general assets is a payroll practice and is left out, with a one-line explanation. Payment from a trust or separate fund is wrapped, and the trust question applies.
- Voluntary benefits: the safe-harbor questions are no employer contribution, voluntary participation, no employer endorsement, payroll deduction only, and a separate yes/no for whether the employer receives any consideration beyond reasonable pay for that payroll work. Pre-tax payment through a Section 125 plan fails the safe harbor. The benefit is then wrapped, and the findings report says why. If every condition is met, the benefit is left out.
- HRA type includes a follow-up when the type is an individual coverage HRA: is it offered to a class that can also enroll in group medical? A yes, or a blank, with group medical also selected, is a findings flag. The documents still generate.
- For self-funded, level-funded, captive, and reference-based pricing medical, ask the name of the TPA plan document or SPD and incorporate that name.

**Step 5. Who is covered.** Employee classes, waiting period, hours, dependents the employer actually covers. The SPD lists only what was selected. The participant calculator uses four counts as of the first day of the plan year. (a) Current employees enrolled in or automatically covered by at least one wrapped benefit, counted once. Help text: employer-paid benefits that need no enrollment, such as basic life, count everyone eligible. (b) Current employees not in (a) who contribute, for example a health FSA only. (c) Former employees on COBRA. (d) Covered retirees. The total is a + b + c + d. Do not count dependents, spouses, QMCSO alternate recipients, or the same person twice. Owner-only is chosen on the ERISA step, not inferred from these counts.

**Step 6. Contributions and Section 125.** Do employees contribute? If yes: pre-tax, after-tax, or mixed by benefit. If pre-tax, confirm a separate Section 125 plan exists. If after-tax, record that choice and print it. Ask whether the employer remits insured premiums to the insurer within three months. Do not assume remittance. Ask whether any plan money sits in a trust or a separate account. If yes, collect the trustee's name and address. This trust question is on every plan, including plans at 100 participants and above. A fully insured plan under 100 may state the small-plan exemption when contributions are remitted to the insurer and there is no trust, even without a Section 125 plan. The Section 125 condition is required before the exemption is stated for a self-funded or level-funded slice that takes employee contributions. Any trust ends the exemption. Also ask whether a Form 5500 was filed last year as a small plan. That answer does not create an exemption. Ask, and do not block on, "Do you have the certificate, booklet, or TPA plan document for each benefit?" A no answer is a findings line.

**Step 7. COBRA, claims, and notices.** COBRA question, worded as the prior calendar year: 20 or more employees on more than half of the typical business days, counting full-time and part-time, and counting related employers under common control. Help text: a part-timer counts as a fraction, hours worked divided by full-time hours. Yes, no, or not sure. "Not sure" does not block. The SPD prints the federal COBRA paragraph, and the findings report says to confirm the count. If the participant count is 100 or more and the COBRA answer is no, still generate, and the findings report explains that those two answers usually do not belong together.

Who handles COBRA: employer, vendor, or carrier, plus the vendor name when needed.

Appeals fiduciary, chosen to match the funding:

- Fully insured medical: the carrier decides claims. That is the default sentence.
- Level-funded, ASO, captive, or RBP: the TPA administers claims. The employer is the named fiduciary. The employer may keep the final internal appeal. That choice is allowed. The findings report says the written claim procedure has to match the choice.

External review for medical claims is included whenever medical is wrapped. It points to the certificate for the address and the deadlines.

Collective bargaining: yes or no. If yes, the SPD says the bargained benefits are maintained under that agreement and that a copy is available on request.

Medicare coordination is a fixed sentence. Whenever a group health benefit is wrapped, the SPD prints: "Coordination with Medicare follows the federal Medicare Secondary Payer rules and the certificate."

**Step 8. Participant count and privacy.** The calculator in Part 4 runs from census fields a, b, c, and d. Show the covered-participant total on the review step. The filing sentence appears in the findings report, not in the SPD.

PHI: for self-funded and level-funded medical, default yes, the employer receives information to run the plan. For fully insured, ask. If yes, collect the job classes that may see it (a short fill-in, blank if they skip, and the findings report says to fill the blank before signing). The HIPAA amendment is generated on this path and includes the plan sponsor certification.

Agent for service of legal process defaults to the employer, with a change option. Plan administrator defaults to the employer. Naming a person is allowed and is flagged in the findings report.

**Step 9. Adoption.** Signer name, signer title, governing body (members, board, authorized officer), original effective date, restatement date if any, intended signature date. None of these dates are printed on the signature line.

**Step 10. Review, contact, download.** Plain-English summary. Contact name (required), email (required), phone (optional), and role. Consent checkbox for the terms. Then the gold download columns. Download is available as soon as the files are built in the browser. A failed lead post does not block the download and does not tell the visitor that an email failed.

**Copy that comes out of the form.** The stop-loss box has no dollar placeholder. The RBP help text does not mention a percent of Medicare. The lawsuit help text does not cite a case year. Review blanks do not use an em dash. Use "None" or omit the row.

---

## 4. What the documents say

The wrap is one ERISA welfare plan. Carrier certificates, booklets, schedules, and the separate HRA or health FSA document are incorporated by reference. Order of control:

- The certificate or self-funded booklet controls covered services, exclusions, and dependent rules for that benefit.
- The carrier or TPA booklet controls the claim steps and the address for that benefit.
- This wrap controls the ERISA frame: name, number, sponsor, administrator, fiduciary, agent for service, plan year, amendment, and termination.
- Enrollment records show who elected what. They do not add a benefit the certificate does not provide.
- If the wrap reads richer than the certificate, the certificate still controls, and the employer should issue a summary of material modifications.

The SPD includes each item below. This is the 29 CFR 2520.102-3 list, in plain words.

| SPD item | How this tool handles it |
| --- | --- |
| Plan name | From the form. Default "[Employer] Group Welfare Benefit Plan" |
| Sponsor name, address, EIN, phone | From the form |
| Plan number | 501 through 999 |
| Type of plan | Employee welfare benefit plan |
| Type of administration | One sentence that matches the funding actually selected. Insured: the insurer administers claims. Level-funded, ASO, captive, RBP: the named TPA administers claims and the employer is the named fiduciary. Do not describe a funding method the employer did not pick |
| Plan administrator | The employer, unless they named someone else |
| Agent for service | The employer, unless they used the change option and named someone else |
| Trustee | Only if they said there is a trust. Then name and address |
| Collective bargaining | If yes, the SPD says so and that a copy of the agreement is available |
| Eligibility, waiting period, hours, dependents | Only the classes and rules they entered. Different benefits may have different waiting periods, each stated |
| Benefits | Each wrapped benefit, the carrier or TPA name, and the HRA type. Referral-only EAP, dependent care, payroll-practice disability, and voluntary benefits that passed the safe harbor are omitted |
| Loss of benefits | Keep a clear list: end of employment, end of eligibility, missed enrollment, unpaid contributions, loss of dependent status, plan amendment or termination, and any tighter rule in the certificate |
| Funding and contributions | Who pays. Pre-tax points to a separate Section 125 plan and says this wrap is not that plan. After-tax is stated when that is the answer. Remittance is stated only if they said the employer remits. Stop-loss is not described |
| Plan year | Calendar, or fiscal year ending on the last day of the named month |
| Claims | Incorporated from the booklet, available without charge. Appeals fiduciary as chosen. External review mentioned for medical |
| ERISA rights | Model-style statement, including the $110 a day figure, plus the paragraph telling the reader they can contact the Employee Benefits Security Administration. No PBGC paragraph. This is a welfare plan |
| COBRA | If the answer is yes or not sure, name the COBRA administrator and incorporate the general notice and the election notice. Do not restate every deadline. Not sure also flags the findings report. If the answer is no and medical, dental, or vision is insured, say state continuation may be available and that the certificate and state law control. Do not print a number of months |
| QMCSO | The SPD says the plan has written procedures, including a National Medical Support Notice, and that a copy is available without charge. The procedures are the separate v1 document |
| Newborns | If medical is wrapped, print the safe-harbor text: group health plans and issuers generally may not restrict a hospital stay in connection with childbirth to less than 48 hours following a vaginal delivery or 96 hours following a cesarean section, the attending provider may discharge earlier after consulting the mother, and the plan may not require authorization for a stay within those limits. For insured medical, add that if state law governs the length of the stay, the certificate describes that law |
| Women's health | If medical is wrapped: reconstruction, surgery of the other breast, prostheses, and treatment of physical complications including lymphedema, if the plan covers mastectomy |
| Mental health parity | Insured medical, any size: financial requirements and treatment limits on mental health and substance use benefits are not more restrictive than on medical and surgical benefits, as federal law requires. Level-funded, ASO, captive, and reference-based pricing print that sentence only when last year's employee count is more than 50. At 50 or fewer, the SPD defers to the booklet. No bulletin name |
| Amendment and termination | The employer may amend or terminate by written action of the governing body they named. A material change is communicated in a summary of material modifications. Welfare benefits are not vested. Print: "Any plan assets, including participant contributions and the participants' share of any insurer refund or rebate, will be used only for benefits and reasonable plan expenses and will not revert to the employer." |
| HIPAA privacy | Short version if the employer does not take health information beyond enrollment. Full plan-document promises if the PHI path is on, matching the amendment, including the plan sponsor certification |
| Filing status | Not printed. The findings report carries the filing sentence |

**Participant calculator.** As of the first day of the plan year, add four counts the employer enters:

- (a) Current employees enrolled in or automatically covered by at least one wrapped benefit, counted once. Employer-paid benefits that need no enrollment, such as basic life, count everyone eligible.
- (b) Current employees not already in (a) who contribute, for example a health FSA only.
- (c) Former employees on COBRA.
- (d) Covered retirees.

The total is a + b + c + d. Do not count dependents, spouses, or domestic partners. Do not count a child who is covered only as an alternate recipient under a QMCSO. Do not count the same person twice.

Worked examples the tests must lock:

- Census 85 + 10 + 3 = 98. Fully insured, after-tax contributions remitted to the insurer, no trust, and no Section 125 plan: the findings report may say the small-plan filing exemption may apply. The SPD does not say that.
- Census 100 + 10 + 3 = 113, and the employer says a Form 5500 was filed last year as a small plan. The findings report still says a Form 5500 is required, and it says a prior small-plan filing does not change this. The SPD does not say that.
- A count of 90 does not get an 80-120 pass. A trust at 98 does not get the exemption.

The band from 80 through 120 does not cancel a filing and does not create the small-plan exemption. It is irrelevant to the yes-or-no filing answer this tool gives.

For a fully insured plan, employee contributions do not destroy the small-plan exemption when they are remitted to the insurer within three months and there is no trust. A Section 125 plan is not required for that insured case. For a self-funded or level-funded slice, employee contributions are described as compatible with the exemption only when a Section 125 plan is in place and the money is not held in a trust. If there is a trust, the tool does not state an exemption, at any count. If the count is 100 or more, the findings report says "A Form 5500 is required."

**COBRA.** Federal COBRA follows the prior-year employee test, not the participant count. Dental and vision are group health coverage for this question. A part-timer counts as a fraction. "Not sure" prints the federal COBRA paragraph and a findings flag to confirm. A "no" answer on a fully insured plan produces the state-continuation sentence with no month count. A "no" answer together with 100 or more participants produces the documents plus a findings explanation. Controlled-group counting is in the question help, not a separate calculator.

**HRA conflicts, findings only, documents still generate.**

- QSEHRA selected and the wrap also contains a group health plan: the findings report says a qualified small employer HRA is for an employer that does not offer a group health plan, and tells them to confirm the design with counsel before they sign.
- ICHRA: the findings report says the individual-coverage notice and the individual policy sit outside this wrap. If that HRA is offered to the same class that can enroll in group medical, the findings report says to confirm the class design.
- Integrated or excepted-benefit HRA: print the type, and incorporate the separate HRA document by name.

**Code sections 105(h) and 4980H** appear only in the findings report, as warnings, not as conclusions. Self-funded and level-funded: nondiscrimination rules can apply to a self-funded health plan. Headcount near 50: whether the employer is an applicable large employer depends on full-time equivalents, not on a raw headcount, and this tool does not decide that.

**RBP.** The SPD includes a plain disclosure that reference-based pricing can leave a balance bill, that the No Surprises Act protects the participant in the situations the Act covers (emergency care, certain non-emergency care at an in-network facility, and air ambulance), and that the certificate controls the detail. No benchmark percentage. The findings report carries the broker-of-record sentence.

**STD.** An insured policy is wrapped. Payment from the employer's general assets is omitted as a payroll practice, with a findings sentence that state disability rules may still apply. Payment from a trust or separate fund is wrapped, and that fund ends the small-plan exemption.

**Owner-only, governmental, church.** Explanation page, lead captured, no ERISA SPD. Owner-only explanation: a plan that covers only an owner and spouse, or only partners and their spouses, and no common-law employee, is generally not an ERISA plan, so this tool does not draft an ERISA wrap for it. Governmental: an ERISA wrap is the wrong document for a governmental plan. Church: a church plan is generally outside ERISA, and this tool does not draft an ERISA wrap for it.

---

## 5. v1 package, and v2 in brief

v1 produces these files, each as Word and PDF, never merged:

1. **Wrap plan document and SPD.** The participant document in Part 4. Blank signature and blank date. Signer name and title printed.
2. **Schedule A and assembly instructions.** One employer paper in two parts. Schedule A is a table: benefit, carrier or administrator, document the employer attaches (certificate, booklet, HRA plan, health FSA plan), and funding in a word (insured or self-funded). Assembly instructions say: put the wrap first, then each certificate in the table order, then the claim procedures if they are not already inside the certificate; give that package to participants; keep the signed wrap, the resolution, and a record of what was sent, when, and to whom. Distribution timing in this paper uses the stable rules: within 90 days after a person becomes covered, within 120 days after the plan becomes subject to the reporting rules, and a summary of material modifications within 210 days after the end of the plan year in which the change was adopted. A restated SPD is due every five years if material changes were made, and every ten years if they were not.
3. **Adoption resolution.** The governing body adopts the wrap as of the effective date the employer entered, when the authorized person signs. Signature and date lines blank. Name and title printed. If it is a restatement, the resolution says it restates the plan originally effective on the original date.
4. **HIPAA amendment**, only on the PHI path. The employer promises the plan-document limits: use only for plan administration, not for employment decisions, agents bound to the same limits, report a misuse, honor access, amendment, and an accounting, open books to the Department of Health and Human Services, return or destroy the information when the job is done, and apply security safeguards. The plan sponsor certifies that the plan documents have been amended and that the sponsor agrees to those limits. The certification signature line is blank. The job classes they typed are the only people who may see it. If they left the classes blank, the amendment shows a blank line and the findings report says to fill it in before signing.
5. **QMCSO procedures**, whenever a group health benefit is wrapped (medical, dental, vision, health FSA, HRA, or a substantive EAP). How an order is received, including a National Medical Support Notice, notice to the participant and each alternate recipient, how qualification is decided, and that a copy is available without charge.
6. **Findings report.** Employer-facing, plain English. What was built, the participant count and the filing sentence, COBRA (including a not-sure flag), missing certificates, anything left out (dependent care, referral EAP, payroll-practice disability, safe-harbor voluntary products), HRA conflicts including an individual coverage HRA on the same class as group medical, the signature-date flag if it applies, and the broker-of-record sentence for level-funded, self-funded ASO, captive, and RBP. No watermark language. No scare language. No filing sentence in the SPD.

The findings report is also the body of Dan's immediate email, above the attachments.

**v2, later, not in this build.**

- **Compliance calendar.** A month-by-month employer calendar for the plan year they entered: filing, summary annual report, open enrollment notices, CHIP, Medicare Part D notice, and the marketplace notice. It uses the dates they entered. It does not invent a tax year.
- **Distribution checklist.** A notice-by-notice list (Summary of Benefits and Coverage, CHIP, Medicare Part D, marketplace, Women's Health notice, newborns notice, COBRA general notice) with who receives it. v1's assembly paper already covers the SPD timing and the certificate order. v2 is the longer notice list, not a second copy of Schedule A.
- **Employee kit.** A one-page cover the employer can hand out with the package: what the wrap is, that the certificate controls the benefit detail, and who to call at the employer. No sales page.

---

## 6. Leads, email, and the sheet

New spreadsheet: **DK Benefits Wrap Plan Leads**. New Apps Script, execute as dan@dkbenefits.net, access set to anyone, same deploy style as Section 125. `setupWrapPlan` creates the tabs and the five-minute trigger. Running setup again does not add a second trigger.

**Dan's email, immediate, only after the lead is accepted.** To dan@dkbenefits.net. Subject: `New Wrap Plan Lead: {company}`. A test submission (`?test=1`) uses a `[TEST]` prefix. The body has the contact, funding, benefits, participant result, lead score, the findings text, and the renewal date. Attachments are the Word and PDF files the browser built, after the script checks the file type and the file signature. Non-ERISA paths attach the one-page explanation only.

**Visitor check-in, one time.** Queued only after Dan's email succeeds. Sent 12 minutes later if that moment is from 7:00 a.m. through 6:59 p.m. Eastern. Otherwise held until the next 7:00 a.m. Eastern. No attachments. No links. No images. Reply-To dan@dkbenefits.net. From name Daniel Kirves. The phone and the site stay plain text. The note does not print Dan's email address. Greeting is "Hi {first name}," or "Hi there," if the name is blank.

The note is short:

Hi {first name},

I hope the wrap document was useful.

Since this is a free tool, it's always a good idea to have your own counsel take a quick look before you sign.

If you don't want to hear from me that's fine too just let me know.

Daniel Kirves
Benefits Broker | 20 Years Exp | DK Benefits
407-476-5076 | www.dkbenefits.net
6000 Metrowest Blvd #200 Orlando, FL 32835
Agency Lic# L109331

Nothing before the signature except the greeting, the one-line hope, a blank line, and those two sentences. In particular there is no "Thanks, Dan" line.

**Renewal reminder, Dan only.** Column `renewal_reminder_on` is 90 days before the next plan-year start. If that date has already passed when the lead arrives, the date stored is the next business morning. The five-minute trigger emails dan@dkbenefits.net on that date with the company name. It never emails the visitor. A separate column `renewal_emailed_dan` records the internal send.

**Lead score, internal, never shown on the page.** Start at 0. Add 10 for a name, 15 for an email, and 20 for a phone when a phone is present. Phone is not required. Add 15 if last year's employee count is 20 or more, or the covered count is 100 or more. Add 10 for level-funded. Add 20 for self-funded ASO, captive, or RBP. Add 10 if the COBRA answer is no and the covered count is 100 or more. Add 10 if there is a trust. Cap at 100. The score is a sorting aid for Dan, not a rating of compliance.

**Submissions columns.**

timestamp, submission_id, status, test, company, state, contact_name, contact_email, contact_phone, employee_count, role, utm, referrer, erisa_path, funding, benefits, plan_number, covered_participants, filing_result, cobra, phi, lead_score, findings_summary, renewal_reminder_on, renewal_emailed_dan, page_url, template_version, lead_emailed, visitor_emailed, error, payload_json, terms_version, terms_accepted_at

`visitor_emailed` stays `no` at submit time. It becomes `yes` only when the check-in actually sends. `lead_emailed` is the immediate note to Dan.

**Events columns.** timestamp, kind, submission_id, detail

**FollowUps columns.** timestamp, email, name, company, status, test, submission_id, error, sent_at, not_before

`not_before` is the 12-minute mark, moved forward to 7:00 a.m. Eastern when the hours rule requires it. Status moves from pending to sent, failed, or skipped.

---

## 7. Rules, tests, and the open question

**Visitor-copy lint.** A test scans the page, the tips, the terms, and the document templates for a four-digit year and for a dollar sign. Allowed exceptions, listed in the test so it does not cry wolf:

- The statute name that contains 1974
- The model rights sentence that contains $110
- Dates that come from the employer's answers in a fixture
- Day counts, age 26, plan numbers, and the 20-employee and 100-participant thresholds

A hardcoded deductible, a percent-of-Medicare example, a case year, a tax year, or a bulletin number in visitor copy fails the test.

**Tests to write with the build.**

(a) **Participant count.** Census 85 + 10 + 3 = 98. A fully insured plan, after-tax contributions remitted to the insurer, no trust, and no Section 125 plan may state the small-plan exemption in the findings report only. Census 100 + 10 + 3 = 113 with a prior small-plan filing still says a Form 5500 is required, and the findings report says a prior small-plan filing does not change this. A count of 90 does not get an 80-120 pass. A trust at 98 does not get the exemption. Level-funded, under 100, employee contributions, Section 125 missing: the exemption is not stated. Level-funded, under 100, Section 125 in place, no trust: the exemption may be stated.

(b) **Non-ERISA paths.** Governmental, church, and owner-only each produce the explanation, produce no ERISA wrap, and still create a lead payload. A private employer with one common-law employee does produce the wrap.

(c) **Funding paths and a clean file.** Insured, level-funded, self-funded ASO, captive, and RBP each produce Word and PDF with no watermark. Stop-loss carrier, deductible, and percentage do not appear. Self-funded, captive, RBP, and level-funded findings include the broker-of-record sentence. Mixed waiting periods and mixed pre-tax and after-tax still generate. COBRA answered no with 113 participants still generates, with a findings explanation. Insured COBRA answered no mentions state continuation and does not print a number of months.

(d) **Document content.** Plan number 500 fails validation. Plan number 501 passes. Name and email are required. Phone is optional. The administrator and the agent for service default to the employer. The signature line and the date line are blank, and the signer name and title are present. Original date and restatement date are both printed when it is a restatement. An intended signature date after the document's effective date is a findings flag and does not block. QSEHRA plus medical raises a findings flag and still generates. An individual coverage HRA on the same class as group medical is a findings flag. Dependent care is absent from the wrap and from Schedule A. Referral-only EAP is absent. The filing sentence is in the findings report and absent from the SPD. The SPD keeps the summary-annual-report-if-filed sentence and the $110 model sentence. PHI path includes the HIPAA amendment and the plan sponsor certification. Group health path includes QMCSO procedures and National Medical Support Notice handling. The Medicare sentence, the newborns safe-harbor text, and the reversion sentence are printed. The plan footer contains the company name, the document title, and "Page N of X". The download labels for the plan are exactly "Download Plan (Word)" and "Download Plan (PDF)", and the buttons are gold. The page does not promise an email.

(e) **Lead and email.** A honeypot or a submit under 3 seconds is rejected and sends no mail. A good submit emails Dan immediately with the files and the findings. The visitor note is not sent at submit time. It is due 12 minutes later, and a due time at 7:05 p.m. Eastern waits until 7:00 a.m. Eastern. The visitor note contains the counsel sentence and the "let me know" sentence exactly, contains the signature block, and does not contain "Thanks, Dan". The page source does not promise an email. The renewal reminder is addressed to dan@dkbenefits.net and is not queued on FollowUps as a visitor send.

**Open question for Dan.**

Should a benefits attorney review the draft templates before the new tool replaces the live Wix page?

The build can be written and previewed either way. Go-live, meaning the Wix shim starts pointing at `wrapplan/index.html` and the Apps Script is turned on for real visitors, waits on this answer. The research record also flags one enforcement bulletin for counsel. That bulletin is not quoted in the tool either way.
