# Wrap plan tool, internal research record

Status: internal. Do not copy year-numbered citations, bulletin numbers, or instruction-booklet years into the page, the emails, or the employer documents.
This record is not legal advice. Items marked "needs counsel" stay out of the templates until Dan's attorney review answers the open go-live question in the Stage 1 spec.

Checked October 15, 2026.

## Field Assistance Bulletin 2026-03

Primary source, fetched from DOL:

https://www.dol.gov/agencies/ebsa/employers-and-advisers/guidance/field-assistance-bulletins/2026-03

The index page listing it is:

https://www.dol.gov/agencies/ebsa/employers-and-advisers/guidance/field-assistance-bulletins

What it is: Field Assistance Bulletin No. 2026-03, September 8, 2026, from Daniel Aronowitz, Assistant Secretary, to the EBSA Director of Enforcement and Regional Directors. Subject: guiding principles for EBSA's enforcement of the Mental Health Parity and Addiction Equity Act nonquantitative treatment limitation (NQTL) requirements, as amended by the Consolidated Appropriations Act, 2021.

What it says, in short: EBSA will focus NQTL comparative-analysis enforcement on three areas: blanket or separate treatment limits that hit only mental health or substance use benefits, medical-necessity review (prior authorization, concurrent review, retrospective review), and network adequacy (network admission and provider reimbursement). EBSA may still look at other NQTLs, especially after a participant complaint. The bulletin also says EBSA will not pursue the portions of the 2024 final rule that are new relative to the 2013 rule, pointing at the Departments' May 15, 2025 nonenforcement statement, while the statute, including the CAA 2021 comparative-analysis duty, continues to apply. The bulletin says it is internal Department policy and "is not intended to, does not, and may not be relied upon to create any rights."

What it is not: it is not a Form 5500 bulletin, not an SPD model, and not a wrap-document content rule.

Needs counsel: whether the SPD's one parity paragraph should stay general, or whether counsel wants any NQTL sentence aimed at those three enforcement areas. The Stage 1 spec keeps the SPD paragraph general and does not name this bulletin. Do not promote the bulletin into visitor copy.

## Form 5500 participant count and the small-plan exemption

Primary sources:

- 29 CFR 2510.3-3(d). The Form 5500 instructions tell filers to use this paragraph when counting welfare-plan participants for the under-100 exemption.
- 29 CFR 2520.104-20. Welfare plan filing exemption: fewer than 100 participants at the beginning of the plan year, and unfunded, fully insured, or a combination, and not a plan that must file Form M-1.
- DOL Form 5500 instructions, "Who Must File" and "Lines 5 and 6." The booklet on the DOL site at the time of this note is the 2025 instruction PDF:

https://www.dol.gov/sites/dolgov/files/ebsa/employers-and-advisers/plan-administration-and-compliance/reporting-and-filing/form-5500/2025-instructions.pdf

The instruction year stays in this record. The tool cites the regulations, not the booklet year.

Lines 5 and 6, welfare, as stated in that booklet: a person becomes a participant covered under a welfare plan on the earliest of the date the plan says participation begins, the date the person becomes eligible for a benefit subject only to the contingency the benefit covers, or the date the person contributes. Covered dependents are not counted. A child who is an alternate recipient under a QMCSO is not counted. A former employee receiving COBRA who is covered by the plan is counted. See 29 CFR 2510.3-3(d)(1) and (d)(2).

The same booklet tells the sponsor to read the wrap document and the way the plan actually runs to decide whether several policies are one plan or several plans. Separate policies do not automatically mean separate plans.

How the spec locks the count, so the builder does not invent a third method:

- One person, once, across every benefit inside this wrap.
- Covered employees, covered COBRA continuees, and covered retirees count.
- Someone eligible for an employer-paid benefit that needs no election (basic life is the example) counts, because eligibility plus the contingency is enough under (d)(1).
- An employee who waived an elective benefit, is not covered, is not contributing, and has no automatic benefit does not count.
- Dependents never count.

The preview asks four counts as of the first day of the plan year, and adds them. (a) Current employees enrolled in or automatically covered by at least one wrapped benefit, counted once. Help text says employer-paid benefits that need no enrollment, such as basic life, count everyone eligible. (b) Current employees not in (a) who contribute, for example a health FSA only. (c) Former employees on COBRA. (d) Covered retirees. Total is a + b + c + d. Dependents, spouses, and QMCSO alternate recipients are not counted, and the same person is not counted twice.

Worked cases the tests lock: census 85 + 10 + 3 = 98. A fully insured plan, after-tax employee contributions remitted to the insurer, no trust, and no Section 125 plan may state the small-plan exemption. A count of 100 + 10 + 3 = 113 still says a Form 5500 is required even when the employer says a prior small-plan filing was made.

Needs counsel only as part of the open go-live review: the waiver edge (eligible but declined) is the sentence in (d)(1)(B) that practitioners argue about. The spec picks the reading above so the tests have one answer. Counsel can change it before go-live. Until then, builders follow the spec.

## The 80-120 rule is not an exemption

Same 2025 instruction booklet, "What To File," 80-120 Participant Rule: if the count is between 80 and 120, and a Form 5500 was filed for the prior year, the filer may use the same large-plan or small-plan category as that prior filing. That chooses schedules. It is not in the "Do Not File" list. A welfare plan with 113 participants still files. A welfare plan with 98 participants that meets 2520.104-20 still does not file, and 80-120 does not change that.

The tool's filing sentence is yes or no. It does not offer an 80-120 skip. A prior small-plan filing does not turn 113 participants into an exemption. The filing sentence is printed only in the findings report. The SPD keeps the model rights line that a participant receives a summary annual report if the plan is required to file an annual report. The SPD does not say whether this employer must file.

## Technical Release 92-01

The 2025 instructions, in the unfunded-plan note, say a welfare plan that takes employee contributions and is tied to a Code section 125 cafeteria plan may still be treated as unfunded for the annual report if it meets DOL Technical Release 92-01, 57 Fed. Reg. 23272 (June 2, 1992), and 58 Fed. Reg. 45359 (Aug. 27, 1993). The instructions also point to 61 Fed. Reg. 41220, 41222-23 (Aug. 7, 1996): COBRA premiums or other after-tax participant contributions received by the cafeteria plan do not, by themselves, remove that relief when the release is otherwise met.

29 CFR 2520.104-20 also lets a fully insured welfare plan take employee contributions and still use the small-plan exemption when those contributions are forwarded to the insurer within three months of receipt. That condition is not the Section 125 condition.

The Section 125 and Technical Release 92-01 condition applies to the self-funded or level-funded part: employee contributions to benefits paid from general assets are described as unfunded for the annual report only when a cafeteria plan is in place and the release is met. Any trust, including a separate fund that pays short-term disability, ends the exemption at any size.

The tool's version, with no citation in the document: under 100 and no trust, a fully insured plan may state the exemption when employees do not contribute or when contributions are remitted to the insurer. A self-funded or level-funded slice may state the exemption when employees do not contribute, or when they contribute and a Section 125 plan is in place. If the remittance or the cafeteria plan is not confirmed, the tool does not state the exemption. 100 or more, or any trust, means "A Form 5500 is required." That sentence is findings-only.

## Owner-only

29 CFR 2510.3-3(b) and (c). A plan with no employees is not an ERISA employee benefit plan. An owner and spouse, and partners and their spouses, are not employees for that test. One common-law employee who is covered makes it a plan. The 2025 instructions, "Do Not File" item 10, repeat the owner-only welfare exclusion and cite 29 CFR 2510.3-3(b). The tool sends these employers to the explanation path and still saves the lead.

## Dependent care

Advisory Opinion 93-25A is the authority the brief named for keeping a dependent care assistance program out of the ERISA wrap. The opinion treats a dependent care program under Code section 129 as outside ERISA section 3(1) welfare benefits. The tool omits it from the wrap and from Schedule A and points the employer to the Section 125 document.

Needs counsel: confirm the opinion still matches the program the employer runs before go-live. The visitor document does not cite the opinion number.

## Voluntary benefits

29 CFR 2510.3-1(j). The safe harbor needs all of: no employer contribution, voluntary participation, no employer endorsement, the employer limited to permitting the insurer to publicize and to collecting premiums through payroll, and no consideration to the employer beyond reasonable compensation for that payroll work. The tool asks those conditions, including the consideration question as its own yes/no. All met: leave the benefit out. Any miss: wrap it, and say why in the findings report. Paying the premium pre-tax through a Section 125 plan is an employer contribution arrangement for this test, so the safe harbor fails, the benefit is wrapped, and the findings report says so.

## Payroll-practice disability

29 CFR 2510.3-1(b)(2) is the payroll-practice exclusion for disability payments from the employer's general assets. The tool offers three labels. An insured policy is wrapped. Payment from the employer's general assets is left out as a payroll practice, with a findings sentence that state disability rules may still apply. Payment from a trust or separate fund is wrapped, and the trust question applies because that fund is plan assets.

Needs counsel: borderline "payroll practice versus a plan" designs. The tool does not decide a close case. It follows the label the employer picks and tells them so in the findings report.

## Model ERISA rights figure

The SPD prints the model statement's "$110 a day" sentence from 29 CFR 2520.102-3. That model sentence is current. ERISA section 502(c)(1) is a penalty a court may assess. The maximum the court may assess is set at 29 CFR 2575.502c-1, and the model statement already states that figure. The SPD does not include a PBGC paragraph.

## HIPAA plan-document terms

45 CFR 164.504(f) is the source for the HIPAA amendment and the long SPD privacy section: plan-administration use only, no employment use, agents, reporting a misuse, access, amendment, accounting, HHS access, return or destroy, safeguards, and a firewall of named classes. 45 CFR 164.504(f)(2)(ii) is the plan sponsor certification: the group health plan may disclose protected health information to the sponsor only if the sponsor certifies that the plan documents have been amended and that the sponsor agrees to the conditions. The amendment includes that certification and a blank signature line. A line-by-line match of the template to the regulation is part of counsel review, not something this record certifies.

## Medicare, parity, reversion, newborns, COBRA, and medical child support

Medicare Secondary Payer. The form does not ask whether the plan pays primary or secondary. Whenever a group health benefit is wrapped, the SPD prints: "Coordination with Medicare follows the federal Medicare Secondary Payer rules and the certificate."

Mental health parity. ERISA section 712 applies to a group health plan. Section 712(c)(1) limits the parity rule for a small self-funded plan: a self-insured plan of a small employer (50 or fewer employees) is outside that application. The tool prints the parity sentence for insured medical at any size. It prints the sentence for level-funded, ASO, captive, and reference-based pricing only when last year's employee count is more than 50. Otherwise it defers to the booklet. The bulletin above is not named.

Reversion. 29 CFR 2510.3-102 treats participant contributions as plan assets. Technical Release 2011-04 (the medical-loss-ratio rebate release) treats the participants' share of an insurer refund or rebate as plan assets that are used for benefits or reasonable plan expenses. The SPD prints, and does not cite: "Any plan assets, including participant contributions and the participants' share of any insurer refund or rebate, will be used only for benefits and reasonable plan expenses and will not revert to the employer."

Newborns. 29 CFR 2520.102-3(u)(2) is the safe-harbor SPD text. The medical SPD prints that text. For a fully insured medical benefit the SPD adds: "If state law governs the length of a hospital stay in connection with childbirth, the certificate describes that law."

COBRA "not sure." The SPD still prints the federal COBRA paragraph, and the findings report tells the employer to confirm the count. Help text says a part-timer counts as a fraction of an employee, hours worked divided by full-time hours, under 26 CFR 54.4980B-2, Q&A-5.

Qualified medical child support orders. ERISA section 609(a)(5)(C) requires the procedures to cover a National Medical Support Notice. The QMCSO paper says a National Medical Support Notice is handled as a medical child support order.

## Other review points applied in the preview

The postMessage allowlist is the site, the GitHub Pages host, `https://www-dkbenefits-net.filesusr.com` (the Wix HTML component parent), and the Wix editor preview origins `https://editor.wix.com`, `https://create.editorx.com`, and `https://manage.wix.com`. There is no wildcard origin.

The form asks "About how many employees did you have last year, full-time and part-time?" That headcount feeds the applicable-large-employer warning, the parity size test, and the lead score. It is not the participant count.

"Do you have the certificate, booklet, or TPA plan document for each benefit?" does not block a download. A no answer is a findings line. Self-funded, level-funded, captive, and reference-based pricing also ask for the name of the TPA plan document or SPD, and that name is incorporated.

The contact step asks the requester's role: employer, broker or consultant, TPA, attorney or CPA, or other. Name and email are required. Phone is optional. The sheet stores employee count, role, utm, and referrer. Phone still adds 20 points to the internal lead score when it is present.

An individual coverage HRA offered to a class that can also enroll in group medical is a findings flag. The documents still generate.

Agent for service of legal process defaults to the employer. The employer can change it.

The renewal reminder to Dan is 90 days before the next plan-year start. If that date has already passed, the reminder is the next business morning. It is never sent to the visitor.

## What stayed out of the tool on purpose

- This bulletin's number and date
- The Form 5500 instruction booklet year
- Federal Register page numbers
- Stop-loss deductibles, attachment percentages, and carrier names
- State continuation month counts
- Any dollar amount other than the allowed $110 model figure

## Guide calendar and SPD delivery, October 16, 2026

This section is the current tool. Earlier notes in this record that say the phone is optional, that the preview asks four census boxes, that certificates are a findings question, or that voluntary benefits use five safe-harbor questions, describe the prior preview. The page now requires a 10-digit business phone, stores one covered-person count as census (a) with (b), (c), and (d) still accepted when an older payload sends them, treats missing certificates as a guide task, and asks one include-or-leave-out question for after-tax voluntary benefits. Pre-tax or employer-paid voluntary benefits are included without that question. The five-question safe harbor still runs when an older payload sends those answers and does not send the new include answer.

29 CFR 2520.102-3(f). The SPD names the plan administrator and prints a business telephone number. The page requires that phone. The SPD does not print a sentence that the number is "on the employer's records." Needs counsel: a line-by-line check that the administrator block still matches (f), including the address lines.

29 CFR 2520.102-3(q). The SPD keeps the existing statement of ERISA rights, including the model "$110 a day" sentence. Needs counsel: this rebuild did not re-compare that paragraph to the current model text.

29 CFR 2520.104b-2(a) and (b). (a) is the 90-day SPD rule after coverage starts. (b) is the 120-day rule after a plan first becomes subject to the reporting rules. The guide says to give the SPD as soon as the plan is signed, and to each new person within 90 days after coverage starts. Needs counsel: the approved guide does not add the 120-day new-plan sentence. Counsel can add it later if they want both clocks stated.

29 CFR 2520.104b-3(a) and (d). (a) is the summary of material modifications within 210 days after the plan year of the change. (d) is notice of a reduction in group health benefits. The guide states both: 210 days for a material change, and within 60 days for a cut in group health benefits. Needs counsel: (d) measures 60 days from adoption. The guide says "within 60 days" and does not add the word "adoption."

29 CFR 2520.104b-1(b) and (c). (b) is hand delivery or first-class mail. (c) is the electronic safe harbor: a worker who uses a computer as part of the job, and anyone else only after written agreement, with a paper copy on request. The guide states those three methods and the free paper copy. Needs counsel: whether one sentence is enough for the rest of (c), including the steps that show the person actually received it.

ERISA section 107. Records that support a filing are kept for at least six years after the filing date. The guide says to keep the signed documents, the certificates in force each year, and the delivery log for at least six years. Needs counsel: for a plan that files, six years runs from the filing date, which can be longer than six years after the document was signed. The guide states the floor the brief approved.

FLSA section 18B and Technical Release 2013-02. The marketplace notice goes to a new hire within 14 days after the start date. The guide says that. The release number and year stay in this record only.

42 CFR 423.56. This is the creditable-coverage notice to people who are eligible for Medicare Part D. The guide puts that notice by October 15 when medical or a separate drug benefit is wrapped. The guide also puts the CMS creditable-coverage disclosure within 60 days after the plan year starts. Needs counsel: the CMS filing sits in CMS guidance, not only in 423.56. The day is computed from the employer's plan-year start and is not a fixed year.

ERISA section 701(f)(3)(B). This is the employer CHIP notice about Medicaid and CHIP premium assistance. The open-enrollment calendar line for medical includes the CHIP notice. Needs counsel: the statute is an employer notice to employees, and it can go with enrollment materials. The guide names it and does not reprint the model notice.

ERISA section 713. This is the women's health notice. The same open-enrollment line names the WHCRA notice. The medical SPD still prints the newborns text from 29 CFR 2520.102-3(u)(2).

29 CFR 2590.701-6(c). The special-enrollment notice is due at or before the chance to enroll. The guide puts it at open enrollment and again at enrollment for a new hire when medical is wrapped.

29 CFR 2590.606-1. The COBRA general notice. The guide adds it to the new-hire list only when the employer answered that federal COBRA applies. Under 20 employees last year, the page derives that federal COBRA does not apply.

29 CFR 2590.715-2715. The summary of benefits and coverage. The guide names the SBC at open enrollment, at medical enrollment, and when a mid-year group health change needs 60 days' notice before it takes effect.

Form 5500 and Form 5558 instructions. The Form 5500 for a calendar year is due July 31. A plan year that starts July 1 ends in June, and the due date is the following January 31. That is the last day of the seventh month after the plan year ends. The guide states a two-and-a-half-month extension on Form 5558. The instruction-booklet year stays in this record only. The one-line count in the guide is: each covered person once, on the first day of the plan year, and spouses and children are not counted.

29 CFR 2520.104b-10. A summary annual report follows a required Form 5500, nine months after the plan year ends, unless every wrapped benefit is paid only from general assets. The guide omits that row in the all-general-assets case. Needs counsel: an all-self-funded plan that takes employee contributions. Contributions can be plan assets, so "paid only from general assets" may not be the right SAR exemption for that plan. The tool follows the funding label. It does not decide the contributions case.

Code section 4376. The PCORI fee on Form 720 is due July 31 of the calendar year after the plan year ends. The guide says "By July 31" for level-funded, self-funded, captive, reference-based pricing, or an HRA. Needs counsel: a fiscal plan year still lands on a July 31, and the guide does not add "the following year."

ERISA section 724. The gag-clause attestation. The guide says December 31 when medical is wrapped, and that the insurer or TPA usually files it, so the employer should get that in writing. Needs counsel: the employer stays responsible if the vendor does not file.

ERISA section 725. Prescription-drug data collection. The guide says June 1 when medical is wrapped, with the same "usually files it, get that in writing" note. Needs counsel: the annual day is set in agency instructions and can move. The guide uses the day the brief approved.

Code sections 6055 and 6056. Section 6055 is the coverage statement. The insurer files it for an insured medical plan. The employer files it for self-funded medical. Section 6056 is the applicable-large-employer statement. The guide shows "ACA forms 1094 and 1095" early in the year when last year's headcount is 50 or more, or when medical is self-funded. Needs counsel: the exact day of those filings moves, so the guide says "early in the year" and does not print a day.

26 CFR 54.4980B-2, Q&A-5. The federal COBRA small-employer test counts a part-time employee as weekly hours divided by full-time hours, and looks at more than half of the typical business days in the prior year. The "How do I know?" text on the COBRA question says that. The question is hidden, and the answer is derived as no, when the most employees at one time last year was under 20.
