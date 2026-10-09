# Section 128 Trump Account Contribution Program — Research Record

**Prepared for:** Daniel Kirves, DK Benefits LLC
**Research date:** Thursday, October 8, 2026 (all sources checked this day; times ET)
**Purpose:** To check the document-generator logic and the supplied materials (Employer Plan DOCX, Standard Template DOCX, Research Guide PDF, Field Specification JSON) against official sources, and to log material changes.
**Release status:** There are no final Section 128 regulations yet. Nothing here claims IRS approval, attorney approval, or guaranteed compliance.

**Template v0.4 (October 8, 2026):** Visitor-facing documents use one footer line, “Prepared with DK Benefits' educational tool. Not effective until signed by the employer.” The full Terms of use stay in the on-screen dialog (version s128-terms-2026-10-08b). The research findings below are unchanged.

**Version 1.0 (October 9, 2026): first public release. Terms s128-terms-2026-10-09 add free download and copy-on-request wording. Legal findings unchanged.**

**Template v0.5 (October 8, 2026):** The dependents tooltip says the separate $1,000 Treasury contribution is only for children born in 2025 through 2028. A child who did not receive it can still have a Trump account and can still receive an employer Section 128 contribution while under 18, if the account is opened and active. Anyone under 18 with a Social Security number can have an account opened. The growth period still ends on December 31 of the year the child turns 17. An unclaimed Treasury auto account still cannot receive an employer contribution until it is claimed and activated.

## Verification for the generator build (October 8, 2026)

The findings below were checked again against the official pages before the draft language was locked into `section128/s128-docgen.js`. Secondary commentary was not treated as authority.

| Point used in the generator | What was opened | Result |
|---|---|---|
| §128(b) is $2,500, with the increase after 2027 rounded down to the next lower $100. §128(c) incorporates §129(d)(2), (3), (6), (7), and (8), and not (4). | [26 USC §128 (LII)](https://www.law.cornell.edu/uscode/text/26/128) | Confirmed. There is no 25% / more-than-5%-owner concentration test in §128. |
| Proposed employer-program rules, reliance, the January 31 statement (via §129(d)(7)), W-2 box 12 code TA, and salary reduction only for dependents. | [91 FR 51611 (Aug. 11, 2026)](https://www.govinfo.gov/content/pkg/FR-2026-08-11/html/2026-16314.htm) | Confirmed in the preamble text. No final §128 regulation was found. |
| An auto account can receive only qualified general contributions and the $1,000 pilot contribution. A claimed initial Trump account, after activation, can receive an employer contribution. | [T.D. 10056, 91 FR 61705 (Sept. 30, 2026)](https://www.federalregister.gov/documents/2026/09/30/2026-20026/trump-accounts) | Confirmed. Article 6 now says an unclaimed, unactivated auto account cannot receive program contributions. |
| 2026 Form W-2 box 12 code TA. Contributions may begin July 4, 2026. | [2026 General Instructions for Forms W-2 and W-3](https://www.irs.gov/instructions/iw2w3) | Confirmed. Indexed figures for 2028 were not published. The generator does not invent them. |

### Material changes applied to the supplied Employer Plan

| ID | Change in the generated draft |
|---|---|
| E1 | Article 6 adds that verification must show the account can accept program contributions, and that a Treasury auto account that has not been claimed and activated cannot. Article 8’s employee notice tells employees the same activation rule. |
| E2 | Article 8 states the annual statement is due on or before January 31. A correct Form W-2 box 12 code TA can satisfy it for 2026. |
| E3 | Adoption-agreement checkboxes are replaced with the choice the employer actually made. Lines that do not apply to the funding method are omitted. |
| E4 | Employer-grant-only keeps Article 7 as “Article 7 Reserved,” with one sentence that salary reduction is not offered. Articles stay numbered 1 through 12. |
| E5 | Salary-reduction sentences in Articles 3, 4, 5, 8, 9, 10, 11, and 12 are kept only when that funding method is selected. |
| E6 | “$2,500 for 2026 and 2027” and “$5,000 for 2026 and 2027” are printed only when the effective year is 2026 or 2027. A 2028 effective date says the indexed amount has not been published. No 2028 dollar figure is invented. |
| E7 | Header and opening paragraph label every file as a draft for review, template v0.2, guidance as of October 8, 2026. |
| E8 | The signature line and the date line stay blank. The representative’s name and title are printed and are not a signature. No adoption date is collected. |

Salary reduction does not remove Social Security or Medicare tax. The page and the plan say that. FICA, FUTA, and RRTA still apply because §128 excludes the amount from gross income only.

Business choices used by the page: an employer in any U.S. state can prepare a draft, and the state is shown on the lead (outside Florida and Georgia it is also a review flag). The visitor receives a copy at the email address entered, limited to three sends an hour.

The separate Section 125 amendment is generated only for salary reduction or combined funding, from the amendment at the end of the standard template. Employee forms and notices are not included. Their transaction blanks are not filled because those forms are not generated here.

Status key used below:

| Code | Meaning |
|---|---|
| **STATUTE** | Enacted Internal Revenue Code text (Pub. L. 119-21, §70204) |
| **NOTICE** | IRS notice (sub-regulatory guidance) |
| **PROP REG** | Proposed regulation. Not binding, but **reliance permitted** where stated |
| **PROP-PREAMBLE** | Interpretation stated in a proposed-rule preamble, not in the reg text itself |
| **TEMP REG** | Temporary regulation (binding while in effect) |
| **FINAL REG** | Final regulation (none exist yet for §128) |
| **FORM INSTR** | IRS form instructions or publication |
| **DOL** | Department of Labor sub-regulatory guidance |
| **STATE** | State law |
| **DESIGN** | DK Benefits drafting or design choice. Not a legal requirement |

---

## 1. Official sources reviewed (with links)

| # | Source | Date | Status | Link |
|---|---|---|---|---|
| S1 | IRC §128, Employer contributions to Trump accounts (added by Pub. L. 119-21 §70204(b)(1), 139 Stat. 186) | Enacted July 4, 2025; applies to taxable years beginning after Dec 31, 2025 | STATUTE | https://www.law.cornell.edu/uscode/text/26/128 · https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section128&num=0&edition=prelim |
| S2 | IRC §530A, Trump accounts | Same | STATUTE | https://www.law.cornell.edu/uscode/text/26/530A |
| S3 | Pub. L. 119-21 (H.R. 1, "One Big Beautiful Bill Act") | July 4, 2025 | STATUTE | https://www.congress.gov/bill/119th-congress/house-bill/1/text |
| S4 | IRS Notice 2025-68, 2025-52 IRB 856 (Q&A C-4, I-1, I-2, I-3) | Dec 2025 | NOTICE | https://www.irs.gov/pub/irs-drop/n-25-68.pdf |
| S5 | REG-101355-26, *Employer Contributions to Trump Accounts and Nondiscrimination Rules for Dependent Care Assistance Programs*, 91 FR 51611–51633 (proposed §§1.128-1 to 1.128-3, 1.129-1, 1.129-2). Also IRB 2026-37 | Aug 11, 2026 | PROP REG (reliance permitted) | https://www.federalregister.gov/documents/2026/08/11/2026-16314/employer-contributions-to-trump-accounts-and-nondiscrimination-rules-for-dependent-care-assistance · https://www.govinfo.gov/content/pkg/FR-2026-08-11/html/2026-16314.htm · https://www.irs.gov/irb/2026-37_irb |
| S6 | Correction to S5, 91 FR 54686 (C1-2026-16314): comment-date line, graphic, §1.128-1 heading | Aug 24, 2026 | PROP REG correction | https://www.govinfo.gov/content/pkg/FR-2026-08-24/html/C1-2026-16314.htm |
| S7 | Hearing notice change, 91 FR 61817 (2026-20021). The Oct 15, 2026 10 a.m. ET hearing is now telephone-only. Requests to attend are due 5 p.m. ET Oct 12, 2026 | Sept 30, 2026 | Procedural | https://www.federalregister.gov/documents/2026/09/30/2026-20021/employer-contributions-to-trump-accounts-and-nondiscrimination-rules-for-dependent-care-assistance |
| S8 | IR-2026-90 (IRS news release on S5) | Aug 11, 2026 | Press release | https://www.irs.gov/newsroom/treasury-irs-issue-proposed-regulations-on-employer-contributions-to-trump-accounts-under-the-working-families-tax-cuts |
| S9 | T.D. 10056, *Trump Accounts*, temporary §§1.530A-1T and 1.530A-7T, 91 FR 61705–61727. Effective Sept 30, 2026. Applies to taxable years beginning on or after Jan 1, 2026. Expires Sept 30, 2029 | Sept 30, 2026 | TEMP REG | https://www.federalregister.gov/documents/2026/09/30/2026-20026/trump-accounts |
| S10 | Companion NPRM CC-00226466-26 (same text as S9). Withdraws REG-117270-25 (the Mar 9, 2026 §1.530A-1 election proposal) | Sept 30, 2026 | PROP REG | https://www.federalregister.gov/documents/2026/09/30/2026-20027/trump-accounts |
| S11 | Other §530A/§6434 items cited in the S9 preamble: REG-117002-25 pilot program (91 FR 11203, Mar 9, 2026); Rev. Proc. 2026-25 (transfer-tax safe harbor, July 13, 2026); CC-00349938-26 eligible investments (91 FR 54280, Aug 21, 2026) | 2026 | PROP REG / Rev. Proc. | (cited in S9 preamble) |
| S12 | 2026 General Instructions for Forms W-2 and W-3 (box 12 **code TA**) | 2026 | FORM INSTR | https://www.irs.gov/instructions/iw2w3 |
| S13 | Publication 15-A (2026), *Employer Contributions to Trump Accounts* | Updated Apr 30, 2026 | FORM INSTR | https://www.irs.gov/publications/p15a |
| S14 | Form 4547, *Trump Account Election(s)* | 2026 | Form | https://www.irs.gov/pub/irs-pdf/f4547.pdf · https://trumpaccounts.gov/ |
| S15 | DOL EBSA Technical Release 2026-02, *Trump Accounts* (ERISA Title I status) | June 17, 2026 | DOL | https://www.dol.gov/agencies/ebsa/employers-and-advisers/guidance/technical-releases/26-02 |
| S16 | Georgia HB 1199 (2026), IRC conformity updated to Jan 1, 2026, effective for tax years beginning on or after Jan 1, 2026. §128 is **not** on the list of decoupled sections | 2026 | STATE | https://www.legis.ga.gov/legislation/72875 · https://gov.georgia.gov/document/2026-signed-legislation/hb-1199/download |

**Not found as of Oct 8, 2026:**
- No final §128 regulations.
- No temporary §128 regulations.
- No IRS notice after Notice 2025-68 that is specific to §128 employer programs.
- No published inflation adjustment of the §128 or §530A limits for any year. None is due for 2027, because indexing starts with taxable years beginning **after 2027**.

Local copies of the fetched texts are in `/workspace/s128/sources/`.

---

## 2. Findings by topic

### 2.1 Separate written plan
- **Rule.** A §128 program must be a *separate written plan of an employer for the exclusive benefit of his employees*. It must meet requirements similar to §129(d)(2), (3), (6), (7) and (8). **[STATUTE §128(c)]**
- **Six required terms.** Under Prop. §1.128-2(b)(2), the written plan must specify:
  1. the eligible classes;
  2. the contribution rules, including the amount and whether salary reduction via a §125 plan is allowed;
  3. the account-designation procedures;
  4. the certification, notice and reporting procedures under (d), (f) and (g);
  5. the plan year;
  6. the procedures for correcting administrative failures and for giving notices to employees and trustees when amounts are later found not excludable.

  **[PROP REG]**
- **Operation.** The employer must follow the written terms in operation (Prop. §1.128-2(c)). **[PROP REG]**
- **Reliance.** Taxpayers may rely on the proposed regs for plan years beginning before final regs are published (S5 preamble Part III.C). The final regs will apply to plan years beginning on or after publication. **[PROP REG — permitted reliance]**
- **Supplied documents.** The Employer Plan's adoption agreement plus Articles 1–12 cover all six items. ✔

### 2.2 Employer program rules vs. individual account rules (kept separate)
- **Employer program rules** come from §128 and Prop. §§1.128-1 to -3:
  - eligibility;
  - the per-employee $2,500 limit;
  - certification;
  - verification;
  - no restriction on trustees;
  - salary reduction;
  - notices and statements;
  - nondiscrimination;
  - corrections.
- **Individual account rules** come from §530A, T.D. 10056 and Notice 2025-68:
  - the account must exist and be designated;
  - the growth period;
  - the $5,000 per-account annual limit;
  - no contributions before July 4, 2026;
  - investments, distributions and rollovers;
  - auto accounts.
- **The employer has no obligation to enforce the §530A(c)(2) account limit** (Prop. §1.128-2(d)(5)(v)). **[PROP REG]**
- **Not yet proposed.** Treasury says a separate proposal will order account-limit excesses so that they come first from other-source contributions and only then from §128 contributions. That proposal has not been issued; §1.530A-2 is reserved. **[PROP-PREAMBLE]**

### 2.3 Employees and owners
- **Who is an employee.** A common-law employee (Prop. §1.128-1(b)(1)). Self-employed individuals under §401(c)(1) are excluded. They may sponsor a program but may not participate (Prop. §1.128-1(b)(2)). **[PROP REG]**
- **Owners and directors.** The preamble specifically names these as not employees for §128:
  - partners;
  - sole proprietors;
  - directors acting only as directors;
  - **2-percent S corporation shareholders within §1372(b)** (with §318 attribution through §1372(b)).

  This is preamble interpretation. The reg text cites only §401(c)(1). **[PROP-PREAMBLE]**
- **No owner-concentration test.** §128(c) does **not** incorporate §129(d)(4), the 25% test for more-than-5% owners. Section 128 therefore has **no 5%-owner concentration test**. A C-corporation owner who is a genuine common-law employee may participate. That owner is usually an HCE, which matters for testing. **[STATUTE + PROP-PREAMBLE]**
- **Supplied documents.** Article 2's employee definition matches. ✔
  - *Note for the brief:* the task asked about "§129(d)-style owner/5% limits". Those do **not** apply to §128. The proposed §1.129-2(c) 25% owner rule applies only to dependent care (§129) programs.

### 2.4 Employer aggregation
- All entities treated as a single employer under §414(b), (c), (m) or (o) count as one employer for §128. The §414(r) separate-line-of-business rules apply as they do under §129 (Prop. §1.128-1(c); preamble III.A.4). **[PROP REG]**
- **Supplied documents.** Article 2 covers this. ✔
- **Generator.** Any related or participating entity should route to review (see BUILD_BRIEF).

### 2.5 Permitted beneficiaries and the growth period
- **Who can receive contributions.** Only a Trump account whose beneficiary is (i) in the growth period and (ii) the employee or the employee's dependent (Prop. §1.128-2(d)(1)). **[PROP REG]**
- **Dependent.** An individual the employee *anticipates* will be a §152 dependent for the calendar year of the contribution. For a joint return, the dependent counts as a dependent of both spouses (Prop. §1.128-1(a)). For divorced or separated parents, or married filing separately, only one parent can claim the child (preamble III.A.5). **[PROP REG]**
- **Growth period.** It ends Dec 31 of the year the beneficiary turns 17. Age is attained on the birthday, not the day before (Temp. §1.530A-1T(b)(3), (c)(5); Prop. §1.128-1(d)). **[TEMP REG / PROP REG]**
- **Supplied documents.** The Employer Plan, Template and Guide state the age-out rule correctly, including the Guide's example of an 18th birthday in Nov 2027. ✔
- **NEW — auto accounts (material).**
  - Under T.D. 10056, Treasury may automatically create "auto accounts". During the growth period, an auto account may accept **only** qualified general contributions and the $1,000 pilot contribution (Temp. §1.530A-1T(e)(2)).
  - It **cannot receive §128 employer contributions** until a guardian or legal custodian *claims* it. The balance then moves by qualified rollover to a claimed initial Trump account (which must be *activated* to exist) or to a rollover Trump account (Temp. §1.530A-1T(d)(3), (f)).
  - **[TEMP REG]**
  - The Guide says only that "a valid account may exist without a fresh parent election". That is true, but it misses this limit. **Recommended change:** in Article 6 and the employee notice, require verification that the destination account can accept §128 contributions. An unclaimed auto account cannot.

### 2.6 Contribution start date
- No contribution can be accepted before **July 4, 2026** (§530A(b)(1)(C)(i)(I), 12 months after enactment). Notice 2025-68, DOL TR 2026-02, the 2026 W-2 instructions and Pub. 15-A all say so. **[STATUTE]**
- **Generator.** The program effective date must be on or after 2026-07-04. ✔ (JSON rule)

### 2.7 Contribution limits and indexing (per year)

| Contribution calendar year | §128(b) per-employee exclusion (all employers combined) | §530A(c)(2) per-account limit (non-exempt contributions) | Status |
|---|---|---|---|
| 2026 (contributions only on/after July 4, 2026) | **$2,500** | **$5,000** | STATUTE |
| 2027 | **$2,500** | **$5,000** | STATUTE (no indexing until after 2027) |
| 2028 and later | $2,500 plus the §1(f)(3) COLA (base year 2026). The **increase is rounded down to a multiple of $100**, so the figure may stay $2,500 for 2028 | $5,000 plus COLA (base 2026), rounded down to $100 | STATUTE. Amount **not yet published**. Expect it in the IRS annual inflation Rev. Proc. (normally Oct–Nov of the prior year) |

Other limit rules:
- **Per employee, all sources.** The limit applies to each employee, not each child, and covers all employers (Notice 2025-68 Q&A I-1; Prop. §1.128-2(d)(5)(ii)). Each spouse filing jointly has a separate limit for the same child, even with the same employer (Prop. Ex. 2–3). **[NOTICE / PROP REG]**
- **Program limit.** The program limit is the lesser of the §128(b) amount and the plan's stated amount (Prop. §1.128-2(d)(5)(i)). The plan must *prohibit* contributions above that limit to keep its status when another employer causes an excess (Prop. §1.128-2(d)(5)(iii), Ex. 4). **[PROP REG]**
  - The Employer Plan, Article 5, does prohibit them. ✔
- **Amounts over the limit.** Employer amounts over the limit, or otherwise outside the program, are taxable wages. They must be identified to the trustee as **not** §128 contributions (Prop. Ex. 5; §219(f)(5) discussion). **[PROP REG]**
- **No prior-year dating.** A contribution counts in the year it is actually made. A January contribution cannot be applied to the prior year (Notice 2025-68 Q&A C-4; §530A(c)(3)). **[NOTICE / STATUTE]** ✔

### 2.8 Salary reduction through §125
- A §128 program may be offered through §125 salary reduction **only for dependents' accounts**. It may not fund the employee's own account, because that would be prohibited deferred compensation under §125(d)(2)(A).
  - Sources: Notice 2025-68 Q&A I-3; Prop. §1.128-2(d)(7)(i).
  - Because §128 is an express exclusion, the benefit is a "qualified benefit" under §125(f)(1). **[NOTICE / PROP REG]**
- **Elections.** The cafeteria plan must **specifically describe** the benefit and must let participants change or revoke elections prospectively **at least monthly**, before salary becomes currently available. No life event is needed (Prop. §1.128-2(d)(7)(ii)). **[PROP REG]**
  - Treasury plans to amend Treas. Reg. §1.125-4 to match (preamble III.A.2). **[PROP-PREAMBLE]**
- **Supplied documents.** The Template's §125 amendment and Employer Plan Article 7 match. ✔
- **Retroactivity (not re-fetched this session; long-standing rule).** Cafeteria plan amendments must be prospective. The generator should not accept an amendment effective date earlier than the generation date.
- **ERISA.** Salary-reduction amounts are "employee contributions" for ERISA purposes, to the extent Title I would otherwise apply (DOL TR 2026-02). **[DOL]**

### 2.9 Payroll tax treatment and reporting
- **Taxes.**
  - Qualifying §128 amounts are excluded from federal gross income only.
  - There is no matching exclusion from **FICA (§3121)**, **FUTA (§3306)** or **RRTA (§3231)**. They remain wages for those taxes unless another exclusion applies.
  - They are generally **not** subject to federal income tax withholding (S5 preamble III.A.6, citing Notice 2001-14).
  - The FICA/FUTA result follows from the statute itself, since Subtitle C was not amended. The withholding position is stated in the preamble. **[STATUTE + PROP-PREAMBLE]**
  - Salary reduction for §128 therefore does **not** save FICA. ✔ (Article 9 and Guide are correct.)
- **W-2.** Report on **Form W-2 box 12, code TA** (2026 W-2/W-3 instructions). **[FORM INSTR]**
- **Annual statement.**
  - §128(c) incorporates §129(d)(7): a written statement of the prior year's contributions, due **on or before January 31**.
  - Prop. §1.128-2(g) says a correct W-2 satisfies it. **[STATUTE / PROP REG]**
  - The Employer Plan, Article 8, omits the January 31 date. *Minor recommended addition.*
- **State tax.**
  - Florida has no personal income tax.
  - Georgia: HB 1199 conforms to the IRC as of Jan 1, 2026, and does not list §128 among the decoupled sections. Georgia therefore appears to follow the exclusion for 2026 and later tax years. Confirm against Georgia DOR withholding guidance before marketing any state-tax statement. **[STATE]**

### 2.10 Account designation, certification and verification
- **Certification the employer may rely on.** It must be in writing, on paper or electronic, and must state:
  - (A) the beneficiary is the employee or an anticipated dependent for the employee's taxable year;
  - (B) the beneficiary's date of birth;
  - (C) no known facts make the beneficiary ineligible that calendar year.

  The employer may rely on it unless it has actual knowledge that it is wrong (Prop. §1.128-2(d)(4)(i)–(ii)). **[PROP REG]** ✔ (Article 6)
- **Account verification.** The employer may **not** rely only on the employee to show the account is a valid Trump account. It must use a method reasonably designed to verify this through information from the trustee, payroll processor or another provider (Prop. §1.128-2(d)(4)(iii)). One example given is a unique account identifier. Treasury is exploring secure electronic validation. **[PROP REG]** ✔ (Article 6). *Add the auto-account point from §2.5.*
- **Trustee notices.** At every transfer, the employer must identify the amount in writing to the trustee as a §128 contribution. The employer must also adopt procedures for these notices and for corrective notices (Prop. §1.128-2(h)(1)–(2); Notice 2025-68 Q&A I-2). **[PROP REG / NOTICE]** ✔ (Article 8)

### 2.11 Trustee choice
- If the employer limits contributions to particular trustees, the arrangement is **not** a §128 program (Prop. §1.128-2(d)(6)). Only one funded Trump account may exist per beneficiary. **[PROP REG]** ✔ (Article 6)

### 2.12 Notices to employees
- All eligible employees must get reasonable notice of the program's availability and terms (§129(d)(6) via §128(c); Prop. §1.128-2(f)). No content or delivery method is prescribed. **[STATUTE / PROP REG]** ✔ (Article 8; Template notice model)

### 2.13 Nondiscrimination (Prop. §1.128-3)
- **(a) Contributions and benefits.** Benefits on the same terms for all eligible employees pass. **[PROP REG]**
- **(b) Eligibility.**
  - The classification must be reasonable and based on objective business criteria. Listing employees by name, or anything with the same effect, fails.
  - It must also be nondiscriminatory, either:
    - under the safe harbor (ratio percentage of at least 90%, reduced by ¾ of a point for each whole point by which the NHCE concentration exceeds 60%), or
    - on the facts and circumstances.
  - An employee counts as eligible only with a *meaningful opportunity* to benefit. **[PROP REG]**
- **(c) 55% average-benefits test.**
  - Each group's average equals its §128 contributions divided by the number of employees in that group who actually **received** a contribution. Salary reduction is included.
  - Tested on the **last day of the plan year**.
  - For salary reduction, employees with compensation under $25,000 may be disregarded.
  - Failures may be fixed by including the HCE excess in income and wages by the W-2 furnishing deadline, plus a trustee corrective notice. **[PROP REG]**
- **(d) Pilot-match safe harbor.** It disregards qualifying pilot-match contributions for tests (a) and (c) only. **[PROP REG]** (Not offered in this generator.)
- **(e) Excluded employees.** Employees under age 21 with less than one year of service (under §410(b)(4)-type rules), and certain collectively bargained employees. **[PROP REG]**
- **(g) Effect of a failure.** The exclusion is lost for HCEs only. NHCEs keep it. **[PROP REG]**
- **Supplied documents.** Articles 10–11 and the Guide's worked example ($1,000 ÷ 0.55 = $1,818.18) are correct. ✔

### 2.14 Corrections
- If an amount identified as §128 turns out not to be, the employer must give the trustee written notice of the affected account, the calendar year and the amount within a reasonable period. **21 calendar days is a deemed-reasonable safe harbor** (Prop. §1.128-2(h)(4)). **[PROP REG]** ✔ (Article 11)
- An unrelated-employer excess alone does not require this employer to send a corrective notice (Prop. Ex. 4). **[PROP REG]** ✔

### 2.15 ERISA (DOL Technical Release 2026-02)
- **Dependents.** Trump accounts and §128 programs that fund **dependents'** accounts are generally not ERISA pension plans. This holds even when funded through §125 salary reduction. **[DOL]**
- **Employees' own accounts (minor employees, e.g. ages 16–17).** No ERISA plan arises during the growth period if all of these hold:
  - participation is completely voluntary; and
  - the employer does not (1) restrict use of funds beyond the Code, (2) make or influence investments, (3) represent the accounts or program as an employer ERISA plan, or (4) receive payment or compensation.

  Restricting rollovers to another Trump account beyond the Code would break this. **[DOL]**
- **After the growth period.** Employer involvement should follow the IRA payroll-deduction safe harbor, 29 CFR 2510.3-2(d). **[DOL]**
- **Supplied documents.** Article 12 matches. ✔ The JSON spec's escalation of "own employee accounts" is appropriate.

### 2.16 Plan year
- Under the reg, the plan year is the 12-month period the program uses for administration, or shorter if the program runs less time (Prop. §1.128-1(g)). The annual limit is always measured by calendar year (Prop. §1.128-2(d)(5)(i)). **[PROP REG]**
- The fixed calendar plan year in the supplied documents is a **DESIGN** choice. It is not required, but it avoids mismatches between the plan year and the limit year. ✔ Non-calendar years should route to review.

---

## 3. Comparison with the supplied materials

### 3.1 Research Guide (PDF): accuracy check
Correct and verified:
- REG-101355-26 citation (91 FR 51611–51633, Aug 11, 2026).
- The Aug 24 correction.
- The Sept 30 telephone-only hearing notice.
- The T.D. 10056 citation and effective date.
- Notice 2025-68 Q&As.
- The 2026 W-2 code TA.
- DOL TR 2026-02, dated June 17, 2026.
- Reliance language.
- The six written-plan items.
- Employee and owner exclusions.
- The per-employee limit and the spouse rule.
- FICA/FUTA treatment.
- The three tests and the 55% example.
- The 21-day safe harbor.
- The absence of a §129(d)(4) test.
- The growth-period age-out example.

**Errors, omissions and outdated items:**

| # | Item | Type | Fix |
|---|---|---|---|
| G1 | Says "a valid account may exist without a fresh parent election" but does not say that **unclaimed auto accounts cannot accept §128 contributions** (Temp. §1.530A-1T(e)(2), (f)) | Omission (material) | Add to verification guidance, Article 6 and the employee notice |
| G2 | Source list omits related 2026 items: REG-117270-25 (Mar 9, 2026, now withdrawn), companion NPRM CC-00226466-26, CC-00349938-26 eligible investments (Aug 21, 2026), REG-117002-25 pilot program, Rev. Proc. 2026-25, Pub. 15-A (2026), IR-2026-90 | Omission (context) | Add to the source list |
| G3 | Says the U.S. Code site was unavailable, so statute was taken from secondary reproductions | Outdated | Statute text verified directly at LII / OLRC on Oct 8, 2026 |
| G4 | Does not mention that the **§128 and §530A increases round down to the next $100**, so 2028+ limits may stay at $2,500 / $5,000 | Omission | Add. Generator must use published year-specific values only |
| G5 | Does not mention the **January 31** statement date (§129(d)(7) via §128(c)) | Omission (minor) | Add to Article 8 |
| G6 | Does not say Treasury will amend §1.125-4, or that the §530A excess-ordering rule (other sources first) is still to come | Omission (watch list) | Add to "before final release" checklist |
| G7 | Treats the 2-percent S-corp shareholder exclusion as settled. It comes from the **preamble**, not the reg text | Classification nuance | Label as PROP-PREAMBLE. Keep the exclusion; keep owner review |
| G8 | Says nothing on state conformity beyond "state rules" | Omission (FL/GA market) | FL: no PIT. GA: HB 1199 conforms as of 1/1/2026 with §128 not decoupled (verify GA DOR withholding) |
| G9 | Calls the funding_mode default (salary reduction only) a "builder suggestion" | Conflicts with Dan's spec | Require an active choice. No default |
| G10 | Lists `adoption_date` as a builder field ("actual signature date") | Conflicts with Dan's spec | Do not collect or populate. Leave signature and date blank |

### 3.2 Employer Plan DOCX: recommended material changes (template v0.2)

| # | Location | Change | Basis |
|---|---|---|---|
| E1 | Art. 6, ¶3 (doc para 53) | After the verification sentence, add: *"Verification confirms that the account can accept contributions under this Program; an account automatically established by the Secretary that has not been claimed and activated cannot receive Program contributions."* | Temp. §1.530A-1T(d)(3), (e)(2), (f) |
| E2 | Art. 8, ¶2 (para 63) | Add "on or before January 31" to the annual statement sentence | §128(c) → §129(d)(7) |
| E3 | Adoption agreement (paras 12–17) | Replace "[ ]" checkbox lines with **resolved text** for the elections made. Omit lines that do not apply to the funding method | Dan's instruction; avoids unexplained checkboxes |
| E4 | Art. 7 for employer-only | Replace the body with "Reserved. Salary reduction is not offered under this Program." Keep the heading so numbering and "Articles 1 through 12" stay correct | Dan's numbering instruction |
| E5 | Salary-reduction sentences in Arts. 3, 4, 5, 9, 10, 11, 12 and the adoption paragraph | Make conditional on funding method (exact sentences in BUILD_BRIEF §3) | Clean employer-only output |
| E6 | Art. 5, ¶1 (para 43) | Keep "$2,500 for 2026 and 2027", but generate it from the year table. For effective dates in 2028+, say "as adjusted under Section 128(b)(2)" with no hard-coded figure | §128(b)(2) |
| E7 | Footer/header | Keep the "Draft" footer. Add a header such as "Draft for review — not adopted until signed; template v0.2, guidance as of Oct 8, 2026". Do not put research commentary in the body | Dan's labeling instruction |
| E8 | Signature/Date (para 21) | Must stay blank lines. Never populate | Dan's instruction |

No legal conflicts were found in Articles 1–12 apart from E1 and E2. The remaining changes are output-cleanliness items.

### 3.3 Standard Template DOCX
- **Use it for** the separate §125 amendment and for the employee and trustee models.
- **Changes:**
  - E1 is in Article 6 and in the Article 8 employee notice. A separate designation form is still outside this draft.
  - In the §125 amendment, the representative name and title may be filled from the form. "Signature ____ Date ____" must stay blank lines, just as in the Employer Plan. The amendment needs no other execution data.
- **Do not send employers** the cover "Preparation instructions" paragraph or the "Research draft" subtitle as part of their documents.

### 3.4 Field Specification JSON: inconsistencies
See BUILD_BRIEF §2 for the full reconciliation. In short:
- `adoption_date` is required "always". It must be **removed**.
- `funding_mode` has a default. It must have **none**; the user chooses.
- Placeholders refer to the broker template, not the Employer Plan's blanks.
- There are no upper bounds on `waiting_days` or `election_cutoff_days`.
- There is no rule that the fixed cap must be at least the employer grant.
- `statutory_limit_2026_2027` must become a year-keyed table.
- The lead-only fields Dan requires are missing: contact name, title, email, phone, employee count, and structured address/state.
- Screening questions for review routing are missing: entity type, related businesses, owner participation, existing §125 plan.

---

## 4. Items to recheck before final client release
1. Final §§1.128-1 to 1.128-3, when published. Compare definitions, applicability, trustee rule, monthly elections, testing denominator, pilot-match relief and correction timing.
2. Any §1.125-4 amendment.
3. The §530A contributions proposal (§1.530A-2) and its excess-ordering rule.
4. Final or extended §1.530A-1T (expires 9/30/2029).
5. The 2027 W-2 instructions (code TA continuity).
6. The IRS inflation Rev. Proc. for 2028 limits.
7. Treasury's secure account-validation method.
8. Georgia DOR withholding guidance.
9. Benefits counsel and payroll review of the v0.2 language.
