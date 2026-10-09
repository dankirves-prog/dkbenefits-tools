/**
 * Section 125 sample cafeteria plan, checklist, and follow-up note.
 * Word uses Calibri. The PDF uses Times because the vendored pdf-lib has no fontkit.
 */
var S125Docgen = (function () {
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  function xml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function has(plan, code) { return plan.benefits.indexOf(code) !== -1; }
  function row(style, text, extra) {
    var item = { style: style, text: text };
    if (extra) Object.keys(extra).forEach(function (key) { item[key] = extra[key]; });
    return item;
  }

  function h1(text) { return row('Heading1', text, { keepNext: true, keepLines: true }); }
  function h2(text) { return row('Heading2', text, { keepNext: true, keepLines: true }); }
  function money(amount) { return S125Model.formatMoney(amount); }
  function finishSentence(text) {
    var s = String(text || '');
    if (!s || /[.!?]$/.test(s)) return s;
    return s + '.';
  }

  function ownerParagraph(plan) {
    if (plan.owner_rule === 's-corp') {
      return 'Employee does not include a 2-percent shareholder of the Employer within the meaning of Code §1372(b). A 2-percent shareholder is a person who owns more than 2 percent of the outstanding stock or of the total combined voting power on any day of the S corporation’s year, including stock treated as owned under Code §318. Attribution under §318(a)(1) includes stock owned by a spouse, child, grandchild, or parent. It does not include stock owned only by a sibling. Such a person may not make pre-tax contributions under this Plan. This rule applies to an S corporation and to an LLC that has elected to be taxed as an S corporation.';
    }
    if (plan.owner_rule === 'self-employed') {
      return 'Employee does not include a self-employed individual within the meaning of Code §401(c), including a partner, a member of an LLC taxed as a partnership, a member of an LLC that is a disregarded entity, and a sole proprietor. Those individuals may not make pre-tax contributions under this Plan.';
    }
    return 'A common-law employee of a C corporation or a nonprofit may participate, including an owner who is a common-law employee. Partners, sole proprietors, and more-than-2-percent S corporation shareholders are not employees for Code §125 when those rules apply to the employer.';
  }

  function joinList(items) {
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  function benefitSections(plan) {
    var rows = [];
    var premiums = ['medical', 'dental', 'vision'].filter(function (code) { return has(plan, code); });
    if (premiums.length) {
      var names = premiums.map(function (code) { return S125Model.benefitLabel(code).toLowerCase(); });
      rows.push(h2('Premium payment benefits'));
      rows.push(row(null, 'A Participant may pay, on a pre-tax basis, the Employee’s share of the premium for the group ' + joinList(names) + ' coverage the Employer maintains. The contract for each coverage describes the benefits, the exclusions, and how a claim is paid. Electing one of these coverages does not elect the others.'));
      var bodies = {
        medical: (plan.funding_type === 'self' || plan.funding_type === 'level')
          ? 'Medical coverage under this Plan is the Employer’s group medical plan, and it is an accident and health benefit. The salary reduction equals the Employee’s share of the premium for the coverage tier the Participant elects. If the Employer changes that share during the plan year, the reduction changes with it, and the rate change alone does not require a new election. The Employer may pay any remaining share of the medical premium outside this Plan.'
          : 'Medical coverage under this Plan is the Employer’s group medical contract, and it is an accident and health benefit. The salary reduction equals the Employee’s share of the premium for the coverage tier the Participant elects. If the insurer changes that share during the plan year, the reduction changes with it, and the rate change alone does not require a new election. The Employer may pay any remaining share of the medical premium outside this Plan.',
        dental: 'Dental coverage under this Plan is the Employer’s group dental contract. The services that contract covers are the dental services the Participant may receive. The salary reduction equals the Employee’s share of the dental premium for the tier elected. Waiving dental coverage leaves any medical election and any vision election in place.',
        vision: 'Vision coverage under this Plan is the Employer’s group vision contract. The services that contract covers are the vision services the Participant may receive. The salary reduction equals the Employee’s share of the vision premium for the tier elected. The vision election is independent of the other premium benefits for the plan year.'
      };
      premiums.forEach(function (code) {
        rows.push(h2(S125Model.benefitLabel(code)));
        rows.push(row(null, bodies[code]));
      });
    }
    if (has(plan, 'health_fsa')) {
      var design = plan.health_fsa_design;
      var what = design === 'limited'
        ? 'The Health FSA is a limited-purpose health FSA. It reimburses dental, vision, and preventive care expenses.'
        : design === 'both'
          ? 'The Employer offers both a general-purpose Health FSA, which reimburses Code §213(d) medical expenses, and a limited-purpose Health FSA, which reimburses dental expenses, vision expenses, and preventive care. A Participant may elect only one of the two, and the §125(i) limit applies to the combined election.'
          : 'The Health FSA reimburses Code §213(d) medical expenses.';
      var unused;
      if (plan.health_fsa_unused === 'grace') {
        unused = 'The Health FSA has a grace period that ends on the 15th day of the third month after the plan year. A Health FSA expense incurred in the grace period may be paid from the amount unused at the end of the prior plan year. Any Health FSA amount still unused when the grace period and the run-out period end is forfeited to the Employer. The Health FSA does not also carry unused amounts into the next plan year.';
      } else if (plan.health_fsa_unused === 'carryover') {
        unused = carryoverSentence(plan);
      } else {
        unused = 'A Health FSA amount still unused when the plan year and the run-out period end is forfeited to the Employer. The Health FSA has neither a grace period nor a carryover.';
      }
      rows.push(h2('Health FSA'));
      rows.push(row(null, what + ' ' + healthFsaLimitSentence(plan)));
      rows.push(row(null, 'Only an Eligible Employee who is eligible for the Employer\'s group major medical plan for the plan year, whether or not the Employee enrolls in it, may elect the Health FSA.'));
      rows.push(row(null, 'The Health FSA is self-insured medical reimbursement. The amount elected for the period of coverage is available on the first day of that coverage, without regard to how much has been withheld from pay by the date of the claim.'));
      rows.push(row(null, 'An expense is incurred when the care is furnished, not when the Participant is billed and not when the Participant pays. Only an expense incurred while Health FSA coverage is in effect may be reimbursed, and only after the Participant substantiates it.'));
      rows.push(row(null, unused));
    }
    if (has(plan, 'dcap')) {
      var dcapUnused = plan.dcap_unused === 'grace'
        ? 'The Dependent Care FSA has a grace period that ends on the 15th day of the third month after the plan year. Any Dependent Care FSA amount still unused when that grace period and the run-out period end is forfeited to the Employer.'
        : 'A Dependent Care FSA amount still unused when the plan year and the run-out period end is forfeited to the Employer.';
      rows.push(h2('Dependent Care FSA'));
      rows.push(row(null, 'A Participant may pay qualifying dependent care assistance on a pre-tax basis under Code §129. For taxable years beginning after December 31, 2025, the exclusion is ' + money(S125Model.DCAP_LIMIT_2026) + ', or ' + money(S125Model.DCAP_MFS_2026) + ' if the Participant is married and files a separate return. A Participant’s Dependent Care FSA election for a plan year may not exceed ' + money(S125Model.DCAP_LIMIT_2026) + ', or ' + money(S125Model.DCAP_MFS_2026) + ' for a married Participant filing separately. The statute sets those amounts. They are not adjusted for inflation. A qualifying individual is determined under Code §§129 and 21.'));
      rows.push(row(null, 'The expenses must be employment-related expenses that §129 treats as qualifying. The exclusion for a year also cannot exceed the Participant’s earned income, or the spouse’s earned income if the Participant is married, except where §129 treats a student or a spouse who is incapable of self-care as having earned income.'));
      rows.push(row(null, 'The Participant identifies the provider and shows the date and the amount before the Employer excludes the payment. The Employer reports the assistance on Form W-2.'));
      rows.push(row(null, dcapUnused + ' The Dependent Care FSA does not have a carryover.'));
    }
    if (has(plan, 'hsa')) {
      var hsa = 'A Participant who is an eligible individual under Code §223 may contribute to a health savings account by pre-tax salary reduction. The Participant may prospectively start, change, or stop that election at least monthly, and no change-in-status event is required. The change applies only to compensation not yet currently available. A Participant who ceases to be an eligible individual may prospectively stop the election. An HSA contribution is nonforfeitable once deposited with the custodian.';
      if (has(plan, 'health_fsa') && plan.health_fsa_design === 'limited') {
        hsa += ' Coverage under the limited-purpose Health FSA does not, by itself, end HSA eligibility.';
      } else if (has(plan, 'health_fsa') && plan.health_fsa_design === 'both') {
        hsa += ' A Participant who contributes to an HSA elects the limited-purpose Health FSA. Coverage under the general-purpose Health FSA, including coverage of a spouse who can be reimbursed from it, ends HSA eligibility for that period.';
      } else if (has(plan, 'health_fsa')) {
        hsa += ' Coverage under the general-purpose Health FSA, including coverage of a spouse who can be reimbursed from it, ends HSA eligibility while that coverage remains in effect.';
      }
      rows.push(h2('Health savings account'));
      rows.push(row(null, hsa));
      rows.push(row(null, 'The Employer forwards each contribution to the custodian the Participant designates, and the custodian holds the account. This Plan does not decide claims for payment from that account.'));
      rows.push(row(null, 'Contributions from all sources for the year stay within the limit Code §223 sets for the Participant’s coverage. This Plan does not write a different annual dollar cap over that statute.'));
    }
    return rows;
  }

  function planParagraphs(plan) {
    var rows = [];
    var state = S125Model.stateName(plan.state);
    var health = has(plan, 'medical') || has(plan, 'dental') || has(plan, 'vision') || has(plan, 'health_fsa') || has(plan, 'hsa');
    rows.push(row('Title', plan.plan_name || 'Section 125 Cafeteria Plan', { keepNext: true, keepLines: true }));
    rows.push({
      table: [
        { label: 'Plan Name', value: plan.plan_name },
        { label: 'Employer', value: plan.employer_name },
        { label: 'EIN', value: plan.employer_ein },
        { label: 'Effective Date', value: S125Model.formatLongDate(plan.effective_date) },
        { label: 'Plan Year', value: S125Model.planYearSentence(plan) },
        { label: 'Plan Number', value: String(plan.plan_number) }
      ]
    });

    rows.push(h1('Article 1. Establishment'));
    rows.push(row(null, plan.employer_name + ', ' + S125Model.entitySentence(plan) + ', adopts this cafeteria plan under Code §125. The Employer’s principal office is ' + plan.employer_address + '.'));
    if (plan.prior_plan) {
      rows.push(row(null, 'This document restates the cafeteria plan originally adopted in ' + S125Model.formatAdoptionMonth(plan.prior_adoption) + '. The restatement is effective ' + S125Model.formatLongDate(plan.effective_date) + '. The Employer adopts it prospectively.'));
    } else {
      rows.push(row(null, 'This Plan is effective ' + S125Model.formatLongDate(plan.effective_date) + '. The Employer adopts it prospectively. Benefits are not provided for a period before the effective date.'));
    }
    var yearSentence = establishmentYearSentence(plan);
    if (yearSentence) rows.push(row(null, yearSentence));
    rows.push(row(null, 'The purpose of this Plan is to let an Eligible Employee choose, before the compensation is currently available, between cash and the qualified benefits in Article 5. The Employer intends the Plan to meet Code §125 and the regulations under it.'));
    rows.push(row(null, 'Where a benefit is also described in a separate contract or account agreement, that document controls the coverage or the account, and this Plan controls the pre-tax election.'));

    rows.push(h1('Article 2. Definitions'));
    rows.push(row(null, 'Employer means ' + finishSentence(plan.employer_name)));
    rows.push(row(null, 'Plan Administrator means the Employer, acting through its authorized officer. The officer who signs this Plan signs for the Employer and is not named personally as the fiduciary.'));
    rows.push(row(null, 'Code means the Internal Revenue Code of 1986, as amended. ERISA means the Employee Retirement Income Security Act of 1974, as amended.'));
    rows.push(row(null, ownerParagraph(plan)));
    rows.push(row(null, 'Eligible Employee means an Employee in an eligible class who has completed the waiting period in Article 3. Full-Time means an Employee regularly scheduled to work at least ' + plan.full_time_hours + ' hours a week. Part-Time means an Employee regularly scheduled to work fewer than ' + plan.full_time_hours + ' hours a week.'));
    rows.push(row(null, 'Dependent means a dependent under Code §152, except that, for an accident or health benefit, Dependent also includes a child as defined in Code §152(f)(1) who has not attained age 27 as of the end of the Participant’s taxable year. The age-27 rule does not determine who is a qualifying individual for dependent care assistance.'));
    rows.push(row(null, 'A highly compensated individual is a person described in Code §125(e): an officer, a shareholder who owns more than 5 percent of the voting power or value of all classes of stock, a highly compensated employee under the compensation test, or a spouse or dependent of any of them.'));
    rows.push(row(null, 'Key employee means a person described in Code §416(i)(1). A Participant is an Eligible Employee who has a salary-reduction election in effect, or who is treated as having elected cash.'));
    rows.push(row(null, 'Compensation means wages paid for service as an Employee, measured before the salary reduction in Article 7. Plan Year means the period named in the title block, and a short first year described in Article 1 is a Plan Year for the rules that apply during it.'));
    rows.push(row(null, 'A Qualified Benefit is a benefit Code §125 permits and that Article 5 offers. Cash is the compensation the Participant would have received if the Participant had not elected a Qualified Benefit. A Salary Reduction Agreement is the election filed under Article 6. Spouse means the person to whom the Participant is married under federal tax law.'));
    rows.push(row(null, 'The Run-out Period is 90 days after the end of the plan year (or the grace period), unless the Plan Administrator announces a longer period before the plan year begins. During that period a claim may still be filed for an expense incurred while coverage was in effect.'));

    rows.push(h1('Article 3. Eligibility'));
    rows.push(row(null, 'The eligible classes are: ' + S125Model.classSentence(plan) + '.'));
    rows.push(row(null, 'Waiting period. ' + S125Model.waitingText(plan.waiting_period)));
    rows.push(row(null, 'An Employee who has not completed the waiting period is not an Eligible Employee. A temporary employee, a leased employee, and an independent contractor who is not a common-law employee are not Eligible Employees. A person excluded from the definition of Employee is not an Eligible Employee.'));
    rows.push(h2('Loss of eligibility'));
    rows.push(row(null, 'Eligibility ends when employment ends or when the person no longer belongs to an eligible class. From that date the person cannot make a new pre-tax election. A claim for care or dependent care furnished before that date is still presented under Article 9.'));
    rows.push(row(null, 'An Employee who terminates employment and is rehired within 30 days, or who returns from an unpaid leave of absence of less than 30 days, is not a new employee under Article 4. The election in effect before the separation or leave is reinstated for the rest of the plan year, unless Article 6 permits a change. An Employee who returns after 30 days or more is treated as a new hire, unless the group health plan or applicable law requires coverage to resume sooner.'));
    if (plan.multi_state) {
      rows.push(row(null, 'Eligible Employees may work in more than one state. This Plan applies the federal cafeteria-plan rules. State insurance law and state employment law may also apply in a state where an Employee works.'));
    }

    rows.push(h1('Article 4. Participation'));
    rows.push(row(null, 'An Eligible Employee may make an election within ' + plan.new_hire_window + ' days after becoming eligible. An election received on or before the date coverage begins under Article 3 takes effect on that date. An election received later takes effect prospectively, on the first day of the first pay period that begins after the Plan Administrator receives it. The exception is an election made within 30 days after the date of hire, which may take effect as of the date coverage begins (Prop. Treas. Reg. §1.125-2(d)). Salary reduction applies only to compensation not yet currently available when the election is made. An Employee who does not elect in that period, or during open enrollment, is treated as having waived every pre-tax benefit and elected cash. The missed election does not default to after-tax coverage.'));
    rows.push(row(null, 'Participation ends on the earliest of the day employment ends, the day the person ceases to be an Eligible Employee, the day no pre-tax election remains in effect, and the day this Plan ends. The Employer takes no salary reduction for pay earned after that day.'));
    if (Number(plan.employee_count) >= 50) {
      rows.push(row(null, 'While a Participant is on leave protected by the Family and Medical Leave Act, the Participant may continue, revoke, or resume a salary-reduction election as that Act and the cafeteria-plan regulations require.'));
    }

    rows.push(h1('Article 5. Benefits'));
    rows.push(row(null, 'A Participant may choose cash or one or more of the qualified benefits described in this Article. Each qualified benefit is the pre-tax payment of the cost this Article describes.'));
    rows.push(row(null, has(plan, 'hsa')
      ? 'Except for the health savings account contributions this Article allows, the Plan does not provide deferred compensation. A program the Employer maintains outside this Article is not a benefit of this Plan.'
      : 'The Plan does not provide deferred compensation. A program the Employer maintains outside this Article is not a benefit of this Plan.'));
    benefitSections(plan).forEach(function (item) { rows.push(item); });

    rows.push(h1('Article 6. Elections'));
    rows.push(row(null, 'The Participant files each election in the manner the Plan Administrator directs, on paper or by electronic enrollment. An election received after the applicable period has closed does not take effect.'));
    rows.push(row(null, 'A salary-reduction election stays in effect for the plan year. The Participant may change it during the year only when Treas. Reg. §1.125-4 permits the change, the Employer’s election procedures include that event, and the change is consistent with the event. Those events include a change in status and a HIPAA special enrollment right. The request is due within 30 days after the event, unless that special enrollment right allows more time, and it affects only compensation that is not yet currently available unless the regulation sets an earlier effective date.'));
    if (has(plan, 'hsa')) {
      rows.push(row(null, 'An election to contribute to a health savings account changes only as the Health savings account section provides.'));
    }
    if (!plan.prior_plan) {
      rows.push(row(null, 'Initial enrollment. Each Employee who will be an Eligible Employee on the Effective Date may make an election during an initial enrollment period the Plan Administrator sets, ending no later than the day before the Effective Date. Those elections take effect on the Effective Date and remain in effect through the end of the first plan year.'));
    } else {
      rows.push(row(null, 'Elections in effect under the plan being restated continue under this restatement for the rest of the plan year in which the restatement takes effect.'));
    }
    rows.push(row(null, 'Open enrollment lasts ' + plan.oe_window_days + ' days and ends on the day before the plan year begins. An election made in open enrollment takes effect on the first day of the coming plan year. The first' + (plan.short_plan_year ? ' annual' : '') + ' open enrollment period under this Plan is ' + S125Model.formatLongDate(plan.oe_start_date) + ' through ' + S125Model.formatLongDate(plan.oe_end_date) + '.'));

    rows.push(h1('Article 7. Salary reduction'));
    rows.push(row(null, 'The Employer reduces a Participant’s compensation, before federal income tax and, where the Code allows, before Social Security and Medicare tax, by the amount required to pay the elected benefits. The reduction applies only to compensation that is not yet currently available to the Participant. The Employer then pays that amount toward the elected benefit.'));
    rows.push(row(null, 'The annual election is collected over the paydays remaining in the period of coverage. If a clerical error withholds the wrong amount, the Employer may adjust a later payday in the same plan year. That adjustment is not a new election and does not change the benefit the Participant chose.'));

    rows.push(h1('Article 8. Funding'));
    if (plan.funding_type === 'self' || plan.funding_type === 'level') {
      rows.push(row(null, 'The Employer pays benefits from its general assets. A level-funded arrangement, if the Employer uses one, is treated as self-insured for federal income-tax purposes.'));
    } else if (has(plan, 'medical') || has(plan, 'dental') || has(plan, 'vision')) {
      rows.push(row(null, 'The Employer pays insured benefits by remitting the elected premium to the insurer.'));
    }
    rows.push(row(null, 'A salary reduction under this Plan is an Employer contribution for federal income-tax purposes. The Employer is not required to hold Plan contributions in a separate trust.' + (has(plan, 'hsa') ? ' A health savings account is held by its custodian under Article 5.' : '')));
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      var which = has(plan, 'health_fsa') && has(plan, 'dcap')
        ? 'Each flexible spending arrangement'
        : (has(plan, 'health_fsa') ? 'The Health FSA' : 'The Dependent Care FSA');
      rows.push(row(null, which + ' is paid from the Employer’s general assets and is administered under the Employer’s claims procedures. Those procedures do not change the unused-amount rule in Article 5.'));
    }

    rows.push(h1('Article 9. Claims and appeals'));
    if (health && (has(plan, 'health_fsa') || has(plan, 'dcap'))) {
      rows.push(row(null, 'A claim under an insurance contract is filed and decided under that contract. A request for reimbursement from a flexible spending arrangement is filed with the Plan Administrator, or with the claims administrator the Employer names, before the Run-out Period ends. The decision is in writing. A claimant may appeal a denial in writing within 180 days after receiving it, and the appeal is decided in writing.'));
      rows.push(row(null, 'The request states the date of service, the amount, and the provider, and the Participant affirms that the expense has not been reimbursed elsewhere and will not be claimed as a deduction or a credit. Further proof may be required. A request that is still incomplete when the Run-out Period ends is denied.'));
    } else if (has(plan, 'dcap')) {
      rows.push(row(null, 'A request for dependent care reimbursement is filed with the Plan Administrator, or with the claims administrator the Employer names, before the Run-out Period ends. The decision is in writing. A claimant may appeal a denial in writing within 180 days after receiving it, and the appeal is decided in writing.'));
      rows.push(row(null, 'The request names the provider and the dependent, states the dates of care and the amount, and includes the Participant’s affirmation that the expense has not been reimbursed elsewhere. A request that is still incomplete when the Run-out Period ends is denied.'));
    } else {
      rows.push(row(null, 'A claim for a benefit under an insurance contract is filed and decided under that contract, including the contract’s appeal procedure. This Plan does not decide a carrier’s claim.'));
    }

    rows.push(h1('Article 10. Continuation coverage'));
    if (has(plan, 'medical') || has(plan, 'dental') || has(plan, 'vision') || has(plan, 'health_fsa')) {
      rows.push(row(null, 'If COBRA applies to a group health benefit under this Plan, a qualified beneficiary may elect continuation coverage as COBRA provides. Electing COBRA does not keep a salary-reduction election in force after the person ceases to be a Participant. Pre-tax payment of a COBRA premium is available only while the person remains a Participant. Continuation of a Health FSA, if COBRA requires it, lasts only for the period and on the terms COBRA provides for a health flexible spending arrangement.'));
      rows.push(row(null, 'The Employer gives the notices COBRA assigns to the plan sponsor. Once the qualified beneficiary is no longer a Participant, the continuation premium is paid on an after-tax basis under that continuation coverage.'));
    } else {
      rows.push(row(null, 'COBRA continuation coverage does not apply to dependent care assistance. If the Employer maintains a group health plan outside this Plan, continuation of that plan is governed by COBRA and by that plan.'));
    }

    rows.push(h1('Article 11. Privacy of health information'));
    if (health) {
      rows.push(row(null, 'To the extent this Plan is a group health plan, the Employer may use and disclose protected health information only for plan administration, as the HIPAA privacy rule permits. The information is not used to make employment decisions, and it is not shared with people who do not administer the Plan. A vendor that handles claims does so under a business-associate agreement when the privacy rule requires one. Dependent care assistance is not a group health plan, and the HIPAA privacy rule does not apply to it.'));
    } else {
      rows.push(row(null, 'Dependent care assistance under this Plan is not a group health plan, and the HIPAA privacy rule does not apply to it.'));
    }

    rows.push(h1('Article 12. Administration'));
    rows.push(row(null, 'The Plan Administrator, as defined in Article 2, interprets this Plan, decides questions of eligibility and benefit, and keeps the records Article 17 requires. The Administrator may adopt enrollment and claims procedures, correct a clerical mistake, and delegate ministerial work. Notices go to ' + plan.signer_name + ', ' + plan.signer_title + ', at the Employer’s office.'));
    rows.push(row(null, 'The Employer indemnifies an officer or employee who serves in the administration of the Plan against reasonable cost of that service, other than cost arising from that person’s fraud or willful misconduct.'));
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      rows.push(row(null, 'The Plan Administrator may appoint a third-party administrator for day-to-day claims work. The appointment does not change the unused-amount rule in Article 5.'));
    }
    rows.push(row(null, has(plan, 'hsa')
      ? 'Participation does not give a Participant a vested right to a benefit that has not been paid, other than an HSA contribution the custodian has received.'
      : 'Participation does not give a Participant a vested right to a benefit that has not been paid.'));

    rows.push(h1('Article 13. Nondiscrimination'));
    rows.push(row(null, 'The Plan Administrator will apply the cafeteria-plan nondiscrimination rules of Code §125 for each plan year, including the eligibility test, the contributions and benefits test, and the key-employee concentration test in Code §125(b)(2). If a test is not met, the highly compensated individuals or key employees reached by that test include the benefit in income as the Code provides, and the failure does not by itself tax the other Participants.'));
    if (has(plan, 'dcap')) {
      rows.push(row(null, 'Dependent care assistance is also tested under Code §129(d), including the 55 percent average-benefits test and the limit on benefits provided to more-than-5-percent owners. The Plan Administrator will complete that testing before the Employer relies on the ' + money(S125Model.DCAP_LIMIT_2026) + ' exclusion.'));
    }
    if (plan.funding_type === 'self' || plan.funding_type === 'level' || has(plan, 'health_fsa')) {
      rows.push(row(null, 'Self-insured medical reimbursement, including the Health FSA and any level-funded medical arrangement that is self-insured for tax purposes, must also satisfy Code §105(h).'));
    }
    rows.push(h1('Article 14. Amendment and termination'));
    var amend = 'The Employer may amend or terminate this Plan by a written instrument. The change is prospective. It does not take away a benefit for a claim already incurred, except as the Code permits.';
    if (has(plan, 'hsa')) amend += ' Termination does not recover an HSA contribution the custodian has already received.';
    rows.push(row(null, amend + ' An authorized officer signs each amendment. Participants are notified of a material reduction before the reduction applies, or as soon as Plan administration reasonably permits.'));

    rows.push(h1('Article 15. No right to employment'));
    rows.push(row(null, 'This Plan does not give any person a right to be hired or to remain employed, and it does not limit the Employer’s right to change the terms of employment or to end employment. An election is not a contract of employment and does not set the Participant’s hours or pay.'));

    rows.push(h1('Article 16. Nonassignment'));
    rows.push(row(null, 'A Participant may not assign, alienate, or pledge a benefit under this Plan, except as the Code requires or as an insurer accepts an assignment of an insured benefit. A benefit is not subject to the claims of the Participant’s creditors.'));

    rows.push(h1('Article 17. Plan records'));
    rows.push(row(null, 'The Plan Administrator keeps elections, salary reductions, and reimbursement records for as long as the Code and ERISA require, and makes them available for examination as those laws require. Those records include this document, later amendments, enrollment forms, payroll reports, and claim files, and they are kept at least seven years after the plan year they concern, or longer while a claim or an examination remains open.'));

    rows.push(h1('Article 18. Governing law'));
    rows.push(row(null, 'This Plan is governed by the Code and by ERISA to the extent ERISA applies. Where state law is not preempted, this Plan is governed by the laws of the State of ' + state + '.'));

    rows.push(h1('Article 19. Severability'));
    rows.push(row(null, 'If a provision of this Plan is held invalid, the rest of the Plan remains in effect. Headings are for convenience and do not change the meaning of the provisions that follow them.'));

    rows.push(h1('Article 20. Execution'));
    rows.push(row(null, 'The Employer has caused this Plan to be executed by its authorized officer.', { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Employer: ' + plan.employer_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'By: ________________________________', { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Name: ' + plan.signer_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Title: ' + plan.signer_title, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Date: ________________________________', { keepLines: true }));
    return rows;
  }

  function signLine(plan) {
    return 'Sign and date the plan on or before ' + S125Model.formatLongDate(plan.effective_date) + '.';
  }

  function firstPlanYear(plan) {
    if (plan.short_plan_year && plan.effective_date) return Number(String(plan.effective_date).slice(0, 4));
    if (plan.on_plan_year_start && plan.effective_date) return Number(String(plan.effective_date).slice(0, 4));
    if (plan.next_plan_year_start) return Number(String(plan.next_plan_year_start).slice(0, 4)) - (plan.effective_date === plan.next_plan_year_start ? 0 : 1);
    return Number(String(plan.effective_date || '').slice(0, 4)) || 2026;
  }

  function healthFsaLimitSentence(plan) {
    var sentence = 'Salary reduction contributions to the Health FSA for a plan year may not exceed the dollar limit in Code §125(i) for that plan year, as adjusted for inflation. For a plan year beginning in 2026, the limit is ' + money(S125Model.HEALTH_FSA_LIMIT_2026) + '.';
    if (!plan.short_plan_year || !plan.effective_date || !plan.short_plan_year_end) return sentence;
    var months = S125Model.shortYearMonths(plan.effective_date, plan.short_plan_year_end);
    var year = Number(String(plan.effective_date).slice(0, 4));
    var amount = year === 2026
      ? money(Math.floor(S125Model.HEALTH_FSA_LIMIT_2026 * months / 12))
      : (months + '/12 of the §125(i) limit for ' + year);
    return sentence + ' For the short plan year from ' + S125Model.formatLongDate(plan.effective_date) + ' through ' + S125Model.formatLongDate(plan.short_plan_year_end) + ', the limit is prorated by the number of months in that short plan year, as Notice 2012-40 requires: ' + amount + '.';
  }

  function carryoverSentence(plan) {
    var text = 'The Health FSA carries unused amounts into the next plan year, up to the maximum carryover the IRS sets for that plan year, as adjusted for inflation ($680 from a plan year beginning in 2026).';
    if (firstPlanYear(plan) < 2027) {
      text += ' Amounts carried into a plan year that begins in 2026, from a plan year that begins in 2025, are limited to ' + money(S125Model.CARRYOVER_INTO_2026) + '.';
    }
    return text + ' Any Health FSA amount above that limit is forfeited to the Employer. The Health FSA does not also have a grace period.';
  }

  function establishmentYearSentence(plan) {
    if (plan.plan_year_change && plan.on_plan_year_start) return S125Model.planYearNote(plan);
    if (plan.short_plan_year && plan.plan_year_change) {
      return 'The short plan year begins ' + S125Model.formatLongDate(plan.effective_date) + ' and ends ' + S125Model.formatLongDate(plan.short_plan_year_end) + '. Each later plan year is ' + S125Model.planYearSentence(plan) + '.';
    }
    if (plan.short_plan_year) {
      return 'The first plan year is a short plan year beginning ' + S125Model.formatLongDate(plan.effective_date) + ' and ending ' + S125Model.formatLongDate(plan.short_plan_year_end) + '. Each later plan year is ' + S125Model.planYearSentence(plan) + '.';
    }
    if (plan.prior_plan && !plan.plan_year_change) return 'This restatement continues the existing plan year.';
    return '';
  }

  function checklistLines(plan) {
    var lines = [signLine(plan)];
    if (!plan.prior_plan) lines.push('Hold enrollment for current employees before ' + S125Model.formatLongDate(plan.effective_date) + '.');
    if (plan.plan_year_change) lines.push('Changing the plan year needs a valid business reason (Notice 2012-40). Write it down. Prorate the Health FSA limit for any short plan year, including the year that ends early.');
    lines.push('Give payroll the signed plan so pre-tax deductions start on or after the effective date.');
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      lines.push('Tell the FSA administrator the unused-amount rule in the plan. Do not leave that rule only in side materials.');
    }
    if (has(plan, 'health_fsa')) lines.push('Offer the Health FSA only to employees eligible for your major medical plan.');
    if (has(plan, 'hsa')) lines.push('Tell payroll that HSA salary-reduction elections can be changed at least monthly, prospectively.');
    lines.push('Send employees a short note with the eligible classes, the waiting period, and the open enrollment dates in the plan.');
    if (plan.owner_rule === 's-corp') lines.push('Keep more-than-2% S corporation shareholders, including attributed family owners, off the pre-tax plan.');
    if (plan.owner_rule === 'self-employed') lines.push('Keep partners, LLC members taxed as partners, and sole proprietors off the pre-tax plan.');
    if (has(plan, 'health_fsa')) lines.push('Give employees a summary plan description for the Health FSA (ERISA)');
    lines.push('Run the §125 nondiscrimination tests (and §129 for dependent care) each year');
    if (has(plan, 'health_fsa') || plan.funding_type === 'self' || plan.funding_type === 'level') {
      lines.push('File Form 5500 if the Health FSA or a self-funded medical plan has 100 or more participants');
    }
    return lines;
  }

  function emailChecklistLines(plan) {
    var lines = [signLine(plan)];
    lines.push('Let payroll know these elections come out of pay before income tax, and before Social Security and Medicare tax when the benefit qualifies.');
    if (has(plan, 'health_fsa')) {
      if (plan.health_fsa_unused === 'carryover') {
        lines.push('The Health FSA carries unused amounts up to the plan-year limit ($680 from a 2026 plan year). It does not also have a grace period.');
      } else if (plan.health_fsa_unused === 'grace') {
        lines.push('The Health FSA grace period runs through the 15th day of the third month after the plan year. It does not also have a carryover.');
      } else {
        lines.push('Unused Health FSA money is forfeited at the end of the plan year. There is no grace period and no carryover.');
      }
    }
    if (has(plan, 'dcap')) {
      lines.push(plan.dcap_unused === 'grace'
        ? 'Unused dependent care money can be used through the 15th day of the third month. It cannot be carried over.'
        : 'Unused dependent care money is forfeited at the end of the plan year. It cannot be carried over.');
    }
    if (has(plan, 'hsa')) lines.push('Employees can change the HSA election at least once a month. It does not have to wait for open enrollment.');
    lines.push('Send your employees a short note about who is eligible and when they can enroll.');
    return lines;
  }

  function guideParagraphs(plan) {
    var rows = [
      row('Title', 'Section 125 implementation checklist'),
      row(null, finishSentence(plan.employer_name + ' — ' + plan.plan_name))
    ];
    checklistLines(plan).forEach(function (line, index) {
      rows.push(row(null, (index + 1) + '. ' + line));
    });
    rows.push(row(null, 'This checklist is educational. It is not legal or tax advice.'));
    return rows;
  }

  function followUpFirstName(lead) {
    var name = String(lead && lead.contact_name || '').trim();
    return name.split(/\s+/)[0] || '';
  }

  function followUpEmailText(plan, lead, links) {
    links = links || {};
    lead = lead || {};
    plan = plan || { benefits: [], employer_name: '' };
    plan.benefits = plan.benefits || [];
    var section128 = links.section128Url || '';
    var rates = links.ratesUrl || '';
    var first = followUpFirstName(lead);
    var employer = plan.employer_name || 'your company';
    var lines = [
      first ? ('Hi ' + first + ',') : 'Hi there,',
      '',
      'I just saw you put together your Section 125 plan for ' + employer + '. Thanks so much for giving my tool a try. I really appreciate it!',
      '',
      'Just a few quick reminders so you can get it up and running:',
      ''
    ];
    emailChecklistLines(plan).forEach(function (line, index) {
      lines.push((index + 1) + '. ' + line);
    });
    lines.push(
      '',
      'Your tax advisor can help with anything specific to your situation.',
      '',
      'Oh, and if you\'re looking at contributing to your employees\' kids\' Trump accounts (employers can contribute under the new Section 128), I have a free tool that creates that plan too. I don\'t sell, market, open, or administer Trump accounts, but the tool is there if you need it:',
      section128,
      '',
      'Also, just so you know, I\'m an employee benefits broker. No pressure at all, but I\'d be happy to help you shop and negotiate your group health and other benefits. I even have some rates you can check out online right now:',
      rates,
      '',
      'Would you mind giving me a shot to see what I can do for you? I\'d love to hear from you.',
      '',
      'Just so it\'s clear, legally I have to mention that the tool is educational and isn\'t legal or tax advice.',
      '',
      'If you\'d rather not get these emails from me, let me know and I\'ll take you off the list.',
      '',
      'Daniel Kirves',
      'Benefits Broker | 20 Years Exp | DK Benefits',
      '407-476-5076 | www.dkbenefits.net',
      '6000 Metrowest Blvd #200 Orlando, FL 32835',
      '',
      'Agency Lic# L109331'
    );
    return lines.join('\n');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function followUpEmailHtml(plan, lead, links) {
    links = links || {};
    var allowed = {};
    if (links.section128Url) allowed[links.section128Url] = true;
    if (links.ratesUrl) allowed[links.ratesUrl] = true;
    var html = followUpEmailText(plan, lead, links).split('\n').map(function (line) {
      if (allowed[line]) {
        var safe = escapeHtml(line);
        return '<a href="' + safe + '">' + safe + '</a>';
      }
      return escapeHtml(line);
    }).join('<br>\n');
    return '<div>' + html + '</div>';
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

  function tableXml(items) {
    var rows = items.map(function (item) {
      return '<w:tr>' +
        '<w:tc><w:tcPr><w:tcW w:w="2880" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F4F7FB"/></w:tcPr>' +
        '<w:p><w:r><w:rPr><w:b/><w:color w:val="1A2E4A"/></w:rPr><w:t xml:space="preserve">' + xml(item.label) + '</w:t></w:r></w:p></w:tc>' +
        '<w:tc><w:tcPr><w:tcW w:w="6480" w:type="dxa"/></w:tcPr>' +
        '<w:p><w:r><w:t xml:space="preserve">' + xml(item.value) + '</w:t></w:r></w:p></w:tc>' +
        '</w:tr>';
    }).join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="1A2E4A"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="1A2E4A"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="1A2E4A"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="1A2E4A"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D5DDE6"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D5DDE6"/>' +
      '</w:tblBorders></w:tblPr>' + rows + '</w:tbl>';
  }

  function blockXml(row) {
    if (row.table) return tableXml(row.table);
    return paragraphXml(row);
  }

  function documentXml(rows) {
    var body = rows.map(blockXml).join('');
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

  function pageField(instr) {
    return '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
  }

  function footerXml(label) {
    var name = xml(label || '');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:ftr xmlns:w="' + W + '">' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr>' +
      (name ? '<w:r><w:t xml:space="preserve">' + name + ' | Page </w:t></w:r>' : '<w:r><w:t xml:space="preserve">Page </w:t></w:r>') +
      pageField('PAGE') +
      '<w:r><w:t xml:space="preserve"> of </w:t></w:r>' +
      pageField('NUMPAGES') +
      '</w:p></w:ftr>';
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
      '<dc:title>' + xml(props.title || 'Section 125 Cafeteria Plan') + '</dc:title>' +
      '<dc:subject>Section 125 Cafeteria Plan.</dc:subject>' +
      '<dc:creator>DK Benefits LLC</dc:creator>' +
      '<cp:lastModifiedBy>DK Benefits LLC</cp:lastModifiedBy>' +
      '<dc:description>Template ' + xml(S125Model.TEMPLATE_VERSION) + '.</dc:description>' +
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
      '<w:settings xmlns:w="' + W + '"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><w:updateFields w:val="true"/></w:settings>';
  }

  function packageParts(rows, props) {
    props = props || {};
    return [
      { name: '[Content_Types].xml', text: contentTypesXml() },
      { name: '_rels/.rels', text: rootRels() },
      { name: 'docProps/core.xml', text: coreXml(props) },
      { name: 'docProps/app.xml', text: appXml() },
      { name: 'word/document.xml', text: documentXml(rows) },
      { name: 'word/styles.xml', text: stylesXml() },
      { name: 'word/header1.xml', text: headerXml() },
      { name: 'word/footer1.xml', text: footerXml(props.footer || props.title || '') },
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

  var FILE_LETTERS = { 'Ł': 'L', 'ł': 'l', 'Ø': 'O', 'ø': 'o', 'Đ': 'D', 'đ': 'd', 'ß': 'ss', 'Æ': 'AE', 'æ': 'ae', 'Œ': 'OE', 'œ': 'oe', 'Þ': 'Th', 'þ': 'th' };

  function asciiLetters(value) {
    var s = String(value || '');
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/[ŁłØøĐđßÆæŒœÞþ]/g, function (ch) { return FILE_LETTERS[ch]; });
  }

  function safeFilePart(name) {
    var s = asciiLetters(name || 'Employer').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
    return s || 'Employer';
  }

  function fileVersion() {
    var match = String(S125Model.TEMPLATE_VERSION || '').match(/v(\d+\.\d+(?:\.\d+)?)/);
    return match ? ('_v' + match[1]) : '';
  }

  function planFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Plan' + fileVersion() + '.docx';
  }

  function guideFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Implementation_Checklist' + fileVersion() + '.docx';
  }

  function pdfFileName(docxName) {
    return String(docxName).replace(/\.docx$/i, '.pdf');
  }


  function buildPlanDocx(plan) {
    return buildDocx(planParagraphs(plan), {
      title: plan.plan_name,
      footer: plan.plan_name,
      created: S125Model.GUIDANCE_AS_OF
    });
  }

  function buildGuideDocx(plan) {
    return buildDocx(guideParagraphs(plan), {
      title: 'Section 125 implementation checklist',
      footer: 'Section 125 implementation checklist',
      created: S125Model.GUIDANCE_AS_OF
    });
  }

  function plainText(rows) {
    return (rows || []).map(function (row) {
      if (row.table) {
        return row.table.map(function (item) { return item.label + ': ' + item.value; }).join('\n');
      }
      return row.text || '';
    }).join('\n');
  }

  return {
    checklistLines: checklistLines,
    emailChecklistLines: emailChecklistLines,
    planParagraphs: planParagraphs,
    guideParagraphs: guideParagraphs,
    followUpEmailText: followUpEmailText,
    followUpEmailHtml: followUpEmailHtml,
    buildDocx: buildDocx,
    buildPlanDocx: buildPlanDocx,
    buildGuideDocx: buildGuideDocx,
    planFileName: planFileName,
    guideFileName: guideFileName,
    pdfFileName: pdfFileName,
    plainText: plainText,
    zipStore: zipStore
  };
})();

