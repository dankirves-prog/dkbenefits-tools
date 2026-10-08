/**
 * Deterministic Section 128 DOCX builder. Template s128-v0.5-2026-10-08.
 * Language is the Employer Plan (Articles 1–12 and the adoption agreement),
 * with the October 8, 2026 research edits applied. No live drafting.
 */
var S128Docgen = (function () {
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var FOOTER = S128Terms.FOOTER;

  function xml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function money(plan, amount) {
    return S128Model.formatMoney(amount);
  }

  function longDate(iso) {
    return S128Model.formatLongDate(iso);
  }

  function usesGrant(plan) { return S128Model.fundingUsesGrant(plan.funding_mode); }
  function usesSalary(plan) { return S128Model.fundingUsesSalary(plan.funding_mode); }

  function waitingText(days) {
    if (days === 0) return '0 calendar days of employment (eligible on hire)';
    return days + ' calendar days of employment';
  }

  function employersText(plan) {
    if (!plan.participating_employers || !plan.participating_employers.length) {
      return 'None (the sponsoring Employer is the sole participating employer)';
    }
    return plan.participating_employers.join('; ');
  }

  function recipientText(plan) {
    if (plan.allow_employee_account) {
      return 'eligible dependent Trump accounts and an eligible employee’s own Trump account during the growth period';
    }
    return 'eligible dependent Trump accounts only';
  }

  function accountLimitSentence(plan) {
    var year = +String(plan.effective_date).slice(0, 4);
    if (year >= 2028) {
      return 'Section 530A imposes a separate account-level annual contribution limit. The base amount is adjusted after 2027. The indexed amount is not stated here because it has not been published. Section 128 contributions count toward that limit. Qualified pilot, qualified general, and qualified rollover contributions receive their applicable statutory treatment. The employee and responsible party must coordinate other account deposits. The administrator processes trustee rejections and known errors. The Employer is not required to enforce the separate account-level limit.';
    }
    return 'Section 530A imposes a separate account-level annual contribution limit, generally $5,000 for 2026 and 2027, adjusted after 2027. Section 128 contributions count toward that limit. Qualified pilot, qualified general, and qualified rollover contributions receive their applicable statutory treatment. The employee and responsible party must coordinate other account deposits. The administrator processes trustee rejections and known errors. The Employer is not required to enforce the separate account-level limit.';
  }

  function article4Funding(plan) {
    if (plan.funding_mode === 'salary_reduction_only') {
      return 'The funding method is salary reduction only. No employer grant is provided. Contributions are made only by salary reduction, which begins only after the Section 125 plan permits the benefit.';
    }
    var grant = 'The Employer provides a uniform annual grant of ' + money(plan, plan.employer_annual_grant) + ' once per employee per calendar year. It is paid with the next practicable regular payroll remittance after eligibility, written designation, and account verification are complete for that year. The grant is not prorated for a partial year. The employee must be eligible and employed when payment is made. Rehire does not create a second grant in the same year. No grant is payable as cash or in exchange for declining participation.';
    if (plan.funding_mode === 'combined') {
      return 'The funding method is an employer grant and employee salary reduction. ' + grant + ' Salary reduction begins only after the Section 125 plan permits the benefit.';
    }
    return 'The funding method is an employer grant only. ' + grant;
  }

  function article4Recipients(plan) {
    var tail = ' Every account beneficiary must remain in the growth period when a program contribution is made.';
    if (plan.funding_mode === 'salary_reduction_only') {
      return 'Salary reduction may be directed only to Trump accounts of the employee’s qualifying dependents. No Section 125 salary reduction may fund the employee’s own account.' + tail;
    }
    if (plan.funding_mode === 'combined') {
      return 'Employer grants may be directed to ' + recipientText(plan) + '. Salary reduction may be directed only to Trump accounts of the employee’s qualifying dependents. No Section 125 salary reduction may fund the employee’s own account.' + tail;
    }
    return 'Employer grants may be directed to ' + recipientText(plan) + '.' + tail;
  }

  function article5Cap(plan) {
    var who = usesSalary(plan)
      ? 'including employer grants and salary reduction'
      : 'including employer grants';
    if (plan.funding_mode === 'salary_reduction_only') who = 'including salary reduction';
    var tail = '';
    if (plan.annual_cap_mode === 'fixed') tail = ' A fixed employer cap does not increase automatically.';
    else if (+String(plan.effective_date).slice(0, 4) < 2028) tail = ' A cap equal to the statutory limit follows published adjustments.';
    return 'The program annual cap is ' + S128Model.capText(plan) + '. Total Section 128 contributions attributable to an employee, ' + who + ', may not exceed the lesser of that cap and the Section 128(b) statutory limit.' + tail;
  }

  function combinedShareSentence(plan) {
    var info = S128Model.salaryCapacity(plan);
    var grant = money(plan, plan.employer_annual_grant);
    if (info && info.room != null) {
      return 'The employer grant and employee salary reduction together cannot exceed the annual limit per employee. With a ' + grant + ' grant, an employee can elect up to ' + S128Model.formatMoney(info.room) + ' through payroll.';
    }
    return 'The employer grant and employee salary reduction together cannot exceed the annual limit per employee. Salary reduction is limited to the amount left after the employer grant.';
  }

  function article5Tracking(plan) {
    var base = 'The administrator tracks actual contributions and amounts pending transmission across participating employers and all programs required to be aggregated.';
    if (plan.funding_mode === 'combined') {
      return base + ' ' + combinedShareSentence(plan) + ' Any amount reported by the employee from an unrelated employer is considered when setting prospective elections, to the extent practicable.';
    }
    if (plan.funding_mode === 'salary_reduction_only') {
      return base + ' Any amount reported by the employee from an unrelated employer is considered when setting prospective elections, to the extent practicable.';
    }
    return base + ' Any amount reported by the employee from an unrelated employer is considered when applying prospective limits, to the extent practicable.';
  }

  function article5Carryover(plan) {
    if (usesSalary(plan)) {
      return 'A contribution is counted in the calendar year actually made during the growth period. This program provides no prior-year catch-up allocation, carryover of unused salary reduction authority, or use-it-or-lose-it spending account. Amounts already deposited belong to the account beneficiary.';
    }
    return 'A contribution is counted in the calendar year actually made during the growth period. This program provides no prior-year catch-up allocation or use-it-or-lose-it spending account. Amounts already deposited belong to the account beneficiary.';
  }

  function article7(plan) {
    if (!usesSalary(plan)) {
      return [{
        style: 'Heading2',
        text: 'Article 7 Reserved'
      }, {
        style: null,
        text: 'Reserved: salary reduction is not offered under this Program, and adding it requires a prospective written amendment to this Program and to the Employer’s Section 125 cafeteria plan.'
      }];
    }
    return [
      { style: 'Heading2', text: 'Article 7 Salary reduction' },
      { style: null, text: 'Salary reduction is elected in the Adoption Agreement. An employee may initiate, increase, decrease, or revoke an election prospectively at any time during the plan year, subject to ' + plan.election_cutoff_days + ' calendar days of payroll processing notice. Administration must permit changes and revocations to become effective at least monthly and only as to salary not yet currently available. No qualifying life event is required.' },
      { style: null, text: 'Elections identify the amount per payroll and the effective payroll date. The administrator limits deductions to the available annual amount, applicable compensation, and verified eligible dependent accounts. No retroactive election is permitted. Salary reduction stops before the dependent’s growth period ends and when the employee revokes the election, employment or eligibility ends, or applicable limits require a stop.' },
      { style: null, text: 'The employer remits authorized salary reduction promptly under its regular payroll remittance process. Deductions continue only while they can be sent to valid eligible accounts. If a contribution is rejected, the administrator investigates, retries only when a lawful eligible transfer is available, and otherwise returns an untransferred deduction through payroll with the appropriate wage and withholding adjustments. ' + (plan.funding_mode === 'combined'
        ? 'A correction does not authorize retroactive salary reduction or a cash substitute for an employer grant.'
        : 'A correction does not authorize retroactive salary reduction.') }
    ];
  }

  function article8Notice(plan) {
    var items = 'eligibility, funding, contribution limits, designation requirements, ';
    if (usesSalary(plan)) items += 'available election changes, ';
    items += 'tax treatment, the administrator contact, and that an account automatically created by the Treasury Department cannot receive Program contributions until a parent or guardian claims it and the account is activated';
    return 'The employer gives all eligible employees reasonable written notice of the program’s availability and terms before participation and when material terms change. The notice identifies ' + items + '. Electronic delivery must provide a practical way for employees to obtain the terms.';
  }

  function article9Payroll(plan) {
    if (plan.funding_mode === 'salary_reduction_only') {
      return 'Payroll will distinguish salary reduction, qualifying contributions, and amounts reclassified as taxable. It will collect applicable employee taxes from available compensation and account for employer taxes. The employer will follow current federal reporting instructions and determine applicable state and local income and employment tax treatment separately.';
    }
    if (plan.funding_mode === 'combined') {
      return 'Payroll will distinguish employer grants, salary reduction, qualifying contributions, and amounts reclassified as taxable. It will collect applicable employee taxes from available compensation and account for employer taxes without reducing a stated grant except as law permits. The employer will follow current federal reporting instructions and determine applicable state and local income and employment tax treatment separately.';
    }
    return 'Payroll will distinguish employer grants, qualifying contributions, and amounts reclassified as taxable. It will collect applicable employee taxes from available compensation and account for employer taxes without reducing a stated grant except as law permits. The employer will follow current federal reporting instructions and determine applicable state and local income and employment tax treatment separately.';
  }

  function article9Tax(plan) {
    var base = 'Properly qualifying contributions are intended to be excluded from the employee’s federal gross income and generally from federal income tax withholding. They remain wages for Social Security, Medicare, and generally federal unemployment tax, and Railroad Retirement Tax Act compensation where applicable, unless a separate exclusion applies. Applicable wage bases and employer-specific exemptions remain relevant.';
    if (usesSalary(plan)) return base + ' Salary reduction does not create a payroll-tax exclusion for these contributions.';
    return base;
  }

  function article10Intro(plan) {
    var base = 'Eligibility, contributions, and benefits must not discriminate in favor of HCEs or their dependents. The employer applies objective eligibility criteria, uniform contribution terms, and the Section 128 tests, aggregating related employers and programs when required.';
    if (usesSalary(plan)) return base + ' Section 125 compliance is evaluated separately.';
    return base;
  }

  function article10Average(plan) {
    var included = 'Employer grants and salary reduction are included.';
    if (plan.funding_mode === 'employer_only') included = 'Employer grants are included.';
    if (plan.funding_mode === 'salary_reduction_only') included = 'Salary reduction contributions are included.';
    return 'The administrator evaluates the eligibility classification and the 55-percent average-benefits test under applicable law. For the average-benefits test, the administrator divides contributions for each HCE or NHCE group by the number of employees in that group receiving a positive contribution, after permitted exclusions. ' + included + ' Testing is performed as of the last day of the plan year. Interim checks may support prospective limits.';
  }

  function article11Corrections(plan) {
    if (usesSalary(plan)) {
      return 'The administrator documents an error’s nature, affected employee and accounts, contribution year and dates, amounts, determination date, and corrective action. It stops improper transfers and reconciles payroll and trustee records. Corrections may include fixing a designation, making a missed contribution when still permitted, returning untransferred deductions, or reclassifying deposits. A late payment is not assigned to an earlier contribution year.';
    }
    return 'The administrator documents an error’s nature, affected employee and accounts, contribution year and dates, amounts, determination date, and corrective action. It stops improper transfers and reconciles payroll and trustee records. Corrections may include fixing a designation, making a missed contribution when still permitted, or reclassifying deposits. A late payment is not assigned to an earlier contribution year.';
  }

  function article12(plan) {
    if (usesSalary(plan)) {
      return 'The employer may amend or terminate the program prospectively by a written instrument and reasonable notice. Amendments must preserve required eligibility, contribution, notice, and correction provisions. They cannot retroactively create a salary reduction election. Termination does not relieve the employer of remitting authorized deductions, furnishing statements, or completing corrections.';
    }
    return 'The employer may amend or terminate the program prospectively by a written instrument and reasonable notice. Amendments must preserve required eligibility, contribution, notice, and correction provisions. Termination does not relieve the employer of furnishing statements or completing corrections.';
  }

  function adoptionClose(plan) {
    var base = 'The undersigned employer adopts this agreement and Articles 1 through 12 as its separate written Section 128 Trump Account Contribution Program. The elections above are incorporated into the program and govern its administration.';
    if (usesSalary(plan)) {
      return base + ' Salary reduction is authorized only after corresponding provisions of the employer’s Section 125 cafeteria plan have been adopted and become effective.';
    }
    return base;
  }

  function planParagraphs(plan) {
    var rows = [
      { style: 'Title', text: 'Section 128 Trump Account Contribution Program' },
      { style: 'Heading1', text: 'Employer adoption agreement' },
      { style: null, text: 'Employer legal name: ' + plan.employer_name },
      { style: null, text: 'Employer EIN: ' + plan.employer_ein },
      { style: null, text: 'Effective date: ' + longDate(plan.effective_date) },
      { style: null, text: 'Employer address: ' + plan.employer_address },
      { style: null, text: 'Additional participating employers: ' + employersText(plan) },
      { style: null, text: 'Program name: ' + plan.plan_name },
      { style: null, text: 'Administrator: ' + plan.administrator_name },
      { style: null, text: 'Administrator contact: ' + plan.administrator_contact },
      { style: null, text: 'Eligible employee class: ' + plan.eligibility_class },
      { style: null, text: 'Waiting period: ' + waitingText(plan.waiting_days) },
      { style: 'Heading2', text: 'Funding elections' },
      { style: null, text: 'Funding method: ' + S128Model.fundingLabel(plan.funding_mode) }
    ];
    if (usesGrant(plan)) {
      rows.push({ style: null, text: 'Annual employer grant per employee: ' + money(plan, plan.employer_annual_grant) + ' (uniform flat grant, once per calendar year)' });
    }
    rows.push({ style: null, text: 'Annual total cap per employee: ' + S128Model.capText(plan) });
    if (usesGrant(plan)) {
      rows.push({ style: null, text: 'Employer grant recipients: ' + recipientText(plan) + '.' });
    }
    if (usesSalary(plan)) {
      rows.push({ style: null, text: 'Salary reduction election processing notice: ' + plan.election_cutoff_days + ' calendar days before payday' });
      if (plan.cafeteria_plan_name) {
        rows.push({ style: null, text: 'Section 125 plan name: ' + plan.cafeteria_plan_name });
        rows.push({ style: null, text: 'Section 125 amendment effective date: ' + longDate(plan.cafeteria_amendment_date) });
      } else {
        rows.push({ style: null, text: 'A Section 125 cafeteria plan was not confirmed. Salary reduction cannot start until a cafeteria plan is adopted or confirmed and amended for this benefit. A cafeteria-plan amendment is not included.' });
      }
    }
    rows.push({ style: null, text: adoptionClose(plan) });
    signatureBlock(plan).forEach(function (row) { rows.push(row); });

    rows.push({ style: 'Heading1', text: 'Plan purpose, definitions, and participation' });
    rows.push({ style: 'Heading2', text: 'Article 1 Purpose and governing terms' });
    var separate = usesSalary(plan)
      ? 'The Program is separate from the Employer’s Section 125 cafeteria plan and from each beneficiary’s individual Trump account.'
      : 'The Program is separate from each beneficiary’s individual Trump account.';
    rows.push({ style: null, text: 'The employer identified in the Adoption Agreement (the Employer) establishes the program named in that agreement (the Program) effective on the stated effective date, for the exclusive benefit of its eligible employees. The Program is intended to provide contributions eligible for exclusion from employees’ federal gross income under Internal Revenue Code Section 128. The Adoption Agreement is incorporated into the Program. ' + separate });
    rows.push({ style: null, text: 'The administrator identified in the Adoption Agreement applies these terms consistently, verifies account eligibility, coordinates contributions and payroll reporting, and maintains Program records. Administrative delegation does not change the Employer’s responsibility to follow the Program.' });
    rows.push({ style: null, text: 'The plan year is January 1 through December 31. The first plan year begins on the effective date and ends on December 31 of that year. Additional employers listed in the Adoption Agreement participate under the same terms. If none are listed, the sponsoring Employer is the sole participating employer.' });
    rows.push({ style: 'Heading2', text: 'Article 2 Definitions' });
    rows.push({ style: null, text: 'Employee means a common-law employee. It excludes self-employed individuals within Section 401(c)(1), including sole proprietors and partners, and a 2-percent S corporation shareholder within Section 1372(b), applying applicable ownership attribution rules. A director is not eligible solely because of director service. Ownership alone does not exclude an otherwise eligible common-law employee of a C corporation, subject to nondiscrimination rules.' });
    rows.push({ style: null, text: 'Dependent means an individual the employee anticipates will be the employee’s dependent under Section 152 for the contribution year. For a married couple filing jointly, a qualifying dependent is treated as the dependent of both spouses.' });
    rows.push({ style: null, text: 'Trump account means an account meeting Section 530A(b)(1). Growth period begins when the initial account is established and ends on December 31 of the calendar year in which the beneficiary attains age 17. Contributions under this program stop before January 1 of the year the beneficiary turns 18, even if the birthday occurs later in that year.' });
    rows.push({ style: null, text: 'HCE means a highly compensated employee under Section 414(q). NHCE means an employee who is not an HCE. Employers required to be aggregated under Section 414(b), (c), (m), or (o) are treated as one employer for the applicable Section 128 rules.' });
    rows.push({ style: 'Heading2', text: 'Article 3 Eligibility and voluntary participation' });
    rows.push({ style: null, text: 'Eligible employees are common-law employees in the class stated in the Adoption Agreement who complete its calendar-day waiting period and satisfy Article 2. Entry occurs upon completion of that period while in the eligible class, but not before the effective date. Each eligible employee must have a meaningful opportunity to participate. Participation requires a voluntary written request. Employees may decline without receiving a cash substitute.' });
    var endParticipation = usesSalary(plan)
      ? 'Participation ends when employment or eligible-class status ends, or the program terminates. The employer remains responsible for amounts already withheld and unresolved transfers or corrections. An employee may update account designations and certifications as provided below.'
      : 'Participation ends when employment or eligible-class status ends, or the program terminates. The employer remains responsible for unresolved transfers or corrections. An employee may update account designations and certifications as provided below.';
    rows.push({ style: null, text: endParticipation });

    rows.push({ style: 'Heading1', text: 'Contributions and annual limits' });
    rows.push({ style: 'Heading2', text: 'Article 4 Funding and allocation' });
    rows.push({ style: null, text: article4Funding(plan) });
    rows.push({ style: null, text: article4Recipients(plan) });
    rows.push({ style: null, text: 'An employee may allocate permitted contributions among one or more eligible accounts by a written designation totaling 100 percent. Allocations do not increase the employee’s total limit. Amounts are paid directly to verified Trump account trustees, never paid to the employee or dependent as cash or as reimbursement for an earlier personal contribution.' });
    rows.push({ style: 'Heading2', text: 'Article 5 Calendar year limits' });
    rows.push({ style: null, text: article5Cap(plan) });
    rows.push({ style: null, text: article5Tracking(plan) });
    rows.push({ style: null, text: 'The statutory exclusion applies per employee across all employers. The employee must report other-employer contributions to the administrator to support prospective limits. Excess contributions attributable to unrelated employers are treated under applicable tax law. Such excess alone does not invalidate an otherwise compliant Program.' });
    rows.push({ style: null, text: accountLimitSentence(plan) });
    rows.push({ style: null, text: article5Carryover(plan) });

    rows.push({ style: 'Heading1', text: 'Account designation and payroll elections' });
    rows.push({ style: 'Heading2', text: 'Article 6 Designation, certification, and verification' });
    rows.push({ style: null, text: 'Before any contribution, an employee submits a paper or electronic designation identifying the contribution year, each beneficiary and date of birth, the relationship to the employee, the trustee, secure payment instructions, and the allocation percentage. The employee certifies in writing that each beneficiary is the employee or an anticipated Section 152 dependent for that contribution year and that no facts known to the employee make the beneficiary ineligible for that calendar year.' });
    rows.push({ style: null, text: 'The employee renews the certification for each contribution year and promptly reports changes affecting eligibility, dependency, trustee, account status, allocation, or contributions from other employers. The employer may rely on the relationship and eligibility certifications unless it has actual knowledge they are incorrect. Dependency or ownership questions requiring interpretation are resolved before payment.' });
    rows.push({ style: null, text: 'The employer will independently verify that each destination is a valid Trump account using information supplied by the trustee, payroll processor, or another service provider through a method reasonably designed for that purpose. An employee’s assertion that an account is valid, standing alone, is insufficient. Verification confirms that the account can accept contributions under this Program. An account automatically established by the Secretary that has not been claimed and activated cannot receive Program contributions. Verification is documented before initial payment and refreshed when an account or trustee changes or contrary information arises.' });
    rows.push({ style: null, text: 'The employer will not restrict contributions to accounts maintained by a selected trustee or list of trustees. A payroll vendor’s limited trustee support does not change that rule. The administrator will arrange a workable alternative transfer process for a valid designated account. Contributions pending verification or transfer are tracked and resolved. The employer does not promise tax qualification or retroactive dating for delayed deposits.' });
    article7(plan).forEach(function (row) { rows.push(row); });

    rows.push({ style: 'Heading1', text: 'Employee notices, tax treatment, and records' });
    rows.push({ style: 'Heading2', text: 'Article 8 Notices and statements' });
    rows.push({ style: null, text: article8Notice(plan) });
    rows.push({ style: null, text: 'The employer furnishes each participating employee, on or before January 31, a written statement of Section 128 contributions made during the preceding calendar year. This obligation may be satisfied by correct reporting on Form W-2 under the instructions applicable for that year. For 2026, the instructions prescribe box 12, code TA. The employer provides any additional or corrected statement required to explain reclassification or an administrative error.' });
    rows.push({ style: null, text: 'At the time of every transfer, the employer affirmatively identifies in writing the amount transmitted as a Section 128 contribution to the trustee. Electronic transmission data may satisfy this requirement if they communicate the designation in writing. Nonqualifying amounts are separately identified and not represented as Section 128 contributions.' });
    rows.push({ style: 'Heading2', text: 'Article 9 Tax administration and record retention' });
    rows.push({ style: null, text: article9Tax(plan) });
    rows.push({ style: null, text: article9Payroll(plan) });
    rows.push({ style: null, text: 'The administrator maintains the executed plan and amendments, employer adoption data, eligible employee notices, annual certifications, trustee verification evidence, designations and elections, dated transfer records, trustee acknowledgments or rejections, payroll and annual statements, nondiscrimination calculations, and correction records. Records are retained for applicable tax and other legal periods and protected using access controls and secure transmission. Account and tax identifiers must be collected and transmitted securely.' });
    rows.push({ style: null, text: 'The employer does not guarantee an employee’s tax treatment, investment return, future account value, or eligibility for the separate federal pilot deposit. Account investments, distributions, and account-level tax reporting are handled by the trustee and responsible party under applicable law.' });

    rows.push({ style: 'Heading1', text: 'Testing, corrections, and employer authority' });
    rows.push({ style: 'Heading2', text: 'Article 10 Nondiscrimination' });
    rows.push({ style: null, text: article10Intro(plan) });
    rows.push({ style: null, text: article10Average(plan) });
    rows.push({ style: null, text: 'The administrator applies testing exclusions only when their conditions are satisfied. A testing exclusion does not itself exclude participation. HCE amounts may be limited prospectively under a consistent compliance procedure.' });
    rows.push({ style: 'Heading2', text: 'Article 11 Administrative failures and corrective notices' });
    rows.push({ style: null, text: article11Corrections(plan) });
    rows.push({ style: null, text: 'When a previously identified Section 128 contribution is determined not to qualify, the employer gives the trustee written notice of the account, contribution calendar year, and nonqualifying amount within 21 calendar days after determination. The employee is informed of the amount, year, reason, tax and statement corrections, and required action. Correction does not authorize unilateral withdrawal from the account.' });
    rows.push({ style: null, text: 'A nondiscrimination failure generally removes the exclusion for affected HCEs without removing it for NHCEs. Where legally available, an average-benefits failure may be remediated by timely treating the calculated HCE excess as gross income and applicable wages and reporting it by the Form W-2 furnishing deadline for the tested year, with trustee corrective notices. That partial remediation is not assumed to cure an eligibility or contribution-terms failure. Otherwise the employer applies the income inclusion required by law and corrects reporting.' });
    rows.push({ style: 'Heading2', text: 'Article 12 Amendment, termination, and individual ownership' });
    rows.push({ style: null, text: article12(plan) });
    rows.push({ style: null, text: 'The account belongs to its beneficiary and remains independent of employment. Participation is voluntary. The employer does not direct or influence investments, impose use or rollover restrictions beyond law, present the account or program as an employer-maintained ERISA pension or welfare plan, or receive payment or compensation in connection with an account. The employer imposes no vesting or forfeiture condition on money deposited into an account. Account-level rights are governed by Section 530A and the trustee’s instrument.' });
    return rows;
  }

  function amendmentParagraphs(plan) {
    if (!usesSalary(plan) || !plan.cafeteria_plan_name) return null;
    var capShare = plan.funding_mode === 'combined'
      ? combinedShareSentence(plan)
      : 'Salary reduction contributions attributable to an employee may not exceed that cap.';
    return [
      { style: 'Title', text: 'Amendment to ' + plan.cafeteria_plan_name },
      { style: 'Heading2', text: 'Section 128 Trump Account Contribution Benefit' },
      { style: 'Heading2', text: 'Adoption and qualified benefit' },
      { style: null, text: plan.employer_name + ' amends ' + plan.cafeteria_plan_name + ' effective ' + longDate(plan.cafeteria_amendment_date) + ' to make available the Section 128 Trump Account contribution benefit described in ' + plan.plan_name + ', maintained as a separate written program. Eligible participants may elect prospective salary reduction contributions to verified Trump accounts of their anticipated Section 152 dependents during those beneficiaries’ growth periods. Contributions to a participant’s own Trump account are not available through this cafeteria plan.' },
      { style: 'Heading2', text: 'Eligibility and amounts' },
      { style: null, text: 'Participation requires eligibility under both this cafeteria plan and the separate Section 128 program named ' + plan.plan_name + ' (the Program). The Section 128 program annual cap is ' + S128Model.capText(plan) + '. ' + capShare + ' Account designation, certification, verification, allocation, notices, and corrections follow the Program.' },
      { style: 'Heading2', text: 'Prospective election changes' },
      { style: null, text: 'A participant may initiate, increase, decrease, or revoke a salary reduction election for this benefit prospectively at any time during the plan year. No qualifying life event is required. The participant must provide ' + plan.election_cutoff_days + ' calendar days of payroll processing notice. Administration must permit changes and revocations to become effective at least monthly and only as to salary not yet currently available. No retroactive election or change is permitted. This provision controls over a general irrevocability or change-in-status restriction in the cafeteria plan solely for this benefit.' },
      { style: 'Heading2', text: 'Payment, tax treatment, and compliance' },
      { style: null, text: 'Authorized deductions are remitted directly to independently verified Trump account trustees under the Section 128 program. Elections end or are adjusted when the participant or account becomes ineligible, the beneficiary’s growth period ends, the participant revokes an election, the maximum is reached, or a compliance limit applies. Payroll will apply federal gross income exclusion only to qualifying amounts and will retain applicable Social Security, Medicare, unemployment, and other required wage treatment. This amendment creates no payroll-tax exclusion.' },
      { style: null, text: 'The employer will evaluate cafeteria plan nondiscrimination independently of Section 128 testing. The amendment does not establish an FSA grace period, carryover, uniform coverage rule, or prior-year contribution designation. Except for the specific benefit and election provisions above, the cafeteria plan remains governed by its existing terms and applicable law.' }
    ].concat(signatureBlock(plan));
  }

  function signatureBlock(plan) {
    function line(text, spaceBefore) {
      return {
        text: text,
        spaceBefore: spaceBefore,
        spaceAfter: 40,
        keepNext: true,
        keepLines: true
      };
    }
    return [
      { style: 'Heading2', text: 'Employer signature', keepNext: true, keepLines: true },
      line('Authorized representative: ' + plan.signer_name, 120),
      line('Title: ' + plan.signer_title, 160),
      line('Signature: ________________________________', 200),
      { text: 'Date: ________________', spaceBefore: 200, spaceAfter: 40, keepLines: true }
    ];
  }

  function checklistLines(plan) {
    var lines = [
      'Sign and date the plan (page 1) before the effective date (' + longDate(plan.effective_date) + ').'
    ];
    if (usesSalary(plan)) {
      lines.push('Add the Section 125 amendment to your cafeteria plan and sign it.');
    }
    lines.push('Tell payroll: contributions are excluded from income tax but still subject to Social Security and Medicare, reported on W-2 box 12 code TA.');
    lines.push('Give employees a short written notice of the program.');
    lines.push('Collect each employee’s child’s Trump account information and make sure the account is active. Accounts the Treasury opened automatically must be claimed by a parent first.');
    lines.push('Start contributions through payroll, up to $2,500 per employee per year.');
    return lines;
  }

  function guideParagraphs(plan) {
    var rows = [
      { style: 'Title', text: 'Section 128 implementation checklist' },
      { style: null, text: plan.employer_name + ' — ' + S128Model.fundingLabel(plan.funding_mode) + '.' }
    ];
    checklistLines(plan).forEach(function (line, index) {
      rows.push({ style: null, text: (index + 1) + '. ' + line });
    });
    return rows;
  }

  function visitorEmailText(plan, lead) {
    var attached = usesSalary(plan) && plan.cafeteria_plan_name
      ? 'Your plan, Section 125 amendment, and implementation checklist are attached.'
      : 'Your plan and implementation checklist are attached.';
    var lines = [
      'Hello ' + (lead.contact_name || '') + ',',
      '',
      'Here are the Section 128 program documents for ' + plan.employer_name + '.',
      attached,
      '',
      'Employee notices, salary-reduction election forms, and account designation forms aren\'t included.',
      ''
    ];
    checklistLines(plan).forEach(function (line, index) {
      lines.push((index + 1) + '. ' + line);
    });
    lines.push(
      '',
      'Your tax advisor can help with anything specific to your situation.',
      '',
      'Questions about DK Benefits’ services? 407-476-5076 · dan@dkbenefits.net',
      '',
      'This was created with an educational tool and isn\'t legal or tax advice.'
    );
    return lines.join('\n');
  }

  function paragraphXml(row) {
    if (row.pageBreak) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    var bits = [];
    if (row.style) bits.push('<w:pStyle w:val="' + xml(row.style) + '"/>');
    if (row.keepNext) bits.push('<w:keepNext/>');
    if (row.keepLines) bits.push('<w:keepLines/>');
    if (row.spaceBefore || row.spaceAfter != null) {
      var spacing = '<w:spacing';
      if (row.spaceBefore) spacing += ' w:before="' + row.spaceBefore + '"';
      if (row.spaceAfter != null) spacing += ' w:after="' + row.spaceAfter + '"';
      spacing += '/>';
      bits.push(spacing);
    }
    var pPr = bits.length ? '<w:pPr>' + bits.join('') + '</w:pPr>' : '';
    var text = row.text || '';
    if (!text) return '<w:p>' + pPr + '</w:p>';
    return '<w:p>' + pPr + '<w:r><w:t xml:space="preserve">' + xml(text) + '</w:t></w:r></w:p>';
  }

  function documentXml(rows) {
    var body = rows.map(paragraphXml).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="' + W + '" xmlns:r="' + R + '"><w:body>' + body +
      '<w:sectPr>' +
      '<w:headerReference w:type="default" r:id="rId2"/>' +
      '<w:footerReference w:type="default" r:id="rId3"/>' +
      '<w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="936" w:right="1152" w:bottom="936" w:left="1152" w:header="720" w:footer="720" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
  }

  function headerXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:hdr xmlns:w="' + W + '"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p></w:hdr>';
  }

  function footerXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:ftr xmlns:w="' + W + '"><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>' +
      '<w:r><w:t xml:space="preserve">' + xml(FOOTER) + '</w:t></w:r></w:p></w:ftr>';
  }

  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="' + W + '">' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:after="120" w:line="246" w:lineRule="auto"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:before="0" w:after="160"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1A2E4A"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1A2E4A"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1A2E4A"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="Header"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:i/><w:color w:val="5A6A7E"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="Footer"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="5A6A7E"/></w:rPr></w:style>' +
      '</w:styles>';
  }

  function coreXml(props) {
    var now = (props.created || '2026-10-08') + 'T00:00:00Z';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xml(props.title || 'Section 128 Trump Account Contribution Program') + '</dc:title>' +
      '<dc:subject>Section 128 Trump Account Contribution Program.</dc:subject>' +
      '<dc:creator>DK Benefits LLC</dc:creator>' +
      '<cp:lastModifiedBy>DK Benefits LLC</cp:lastModifiedBy>' +
      '<dc:description>Template ' + xml(S128Model.TEMPLATE_VERSION) + '.</dc:description>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + xml(now) + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + xml(now) + '</dcterms:modified>' +
      '</cp:coreProperties>';
  }

  function appXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
      '<Application>DK Benefits LLC</Application><Company>DK Benefits LLC</Company></Properties>';
  }

  function contentTypesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '</Types>';
  }

  function rootRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>';
  }

  function docRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '</Relationships>';
  }

  function settingsXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:settings xmlns:w="' + W + '"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
  }

  function packageParts(rows, props) {
    return [
      { name: '[Content_Types].xml', text: contentTypesXml() },
      { name: '_rels/.rels', text: rootRels() },
      { name: 'docProps/core.xml', text: coreXml(props || {}) },
      { name: 'docProps/app.xml', text: appXml() },
      { name: 'word/document.xml', text: documentXml(rows) },
      { name: 'word/styles.xml', text: stylesXml() },
      { name: 'word/header1.xml', text: headerXml() },
      { name: 'word/footer1.xml', text: footerXml() },
      { name: 'word/settings.xml', text: settingsXml() },
      { name: 'word/_rels/document.xml.rels', text: docRels() }
    ];
  }

  function crcTable() {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  }
  var CRC = null;
  function crc32(bytes) {
    if (!CRC) CRC = crcTable();
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return new Uint8Array(out);
  }

  function u16(n) { return new Uint8Array([n & 255, (n >> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]); }
  function concatBytes(parts) {
    var len = 0;
    var i;
    for (i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len);
    var o = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }

  function zipStore(files) {
    var locals = [];
    var centrals = [];
    var offset = 0;
    for (var i = 0; i < files.length; i++) {
      var nameBytes = utf8(files[i].name);
      var data = utf8(files[i].text);
      var crc = crc32(data);
      var local = concatBytes([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
        nameBytes, data
      ]);
      locals.push(local);
      centrals.push(concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), nameBytes
      ]));
      offset += local.length;
    }
    var central = concatBytes(centrals);
    var end = concatBytes([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(central.length), u32(offset), u16(0)
    ]);
    return concatBytes(locals.concat([central, end]));
  }

  function buildDocx(rows, props) {
    return zipStore(packageParts(rows, props || {}));
  }

  function safeFilePart(name) {
    var s = String(name || 'Employer').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
    return s || 'Employer';
  }

  function planFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_128_Plan_v0.5.docx';
  }

  function amendmentFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Amendment_v0.5.docx';
  }

  function guideFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_128_Implementation_Guide_v0.5.docx';
  }

  function pdfFileName(docxName) {
    return String(docxName).replace(/\.docx$/i, '.pdf');
  }

  function buildPlanDocx(plan) {
    return buildDocx(planParagraphs(plan), {
      title: plan.plan_name,
      created: S128Model.GUIDANCE_AS_OF
    });
  }

  function buildAmendmentDocx(plan) {
    var rows = amendmentParagraphs(plan);
    if (!rows) return null;
    return buildDocx(rows, {
      title: 'Amendment to ' + plan.cafeteria_plan_name,
      created: S128Model.GUIDANCE_AS_OF
    });
  }

  function buildGuideDocx(plan) {
    return buildDocx(guideParagraphs(plan), {
      title: 'Section 128 implementation checklist',
      created: S128Model.GUIDANCE_AS_OF
    });
  }

  function plainText(rows) {
    return (rows || []).map(function (row) { return row.text || ''; }).join('\n');
  }

  return {
    FOOTER: FOOTER,
    checklistLines: checklistLines,
    planParagraphs: planParagraphs,
    amendmentParagraphs: amendmentParagraphs,
    guideParagraphs: guideParagraphs,
    visitorEmailText: visitorEmailText,
    buildDocx: buildDocx,
    buildPlanDocx: buildPlanDocx,
    buildAmendmentDocx: buildAmendmentDocx,
    buildGuideDocx: buildGuideDocx,
    planFileName: planFileName,
    amendmentFileName: amendmentFileName,
    guideFileName: guideFileName,
    pdfFileName: pdfFileName,
    plainText: plainText,
    zipStore: zipStore
  };
})();
