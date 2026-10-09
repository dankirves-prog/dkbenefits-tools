/**
 * Section 125 sample cafeteria plan, checklist, and follow-up note.
 * Word uses Calibri. The PDF uses Times because the vendored pdf-lib has no fontkit.
 */
var S125Docgen = (function () {
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var FOOTER = S125Terms.FOOTER;

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

  function ownerParagraph(plan) {
    if (plan.owner_rule === 's-corp') {
      return 'Employee does not include a 2-percent shareholder of the Employer within the meaning of Code §1372(b). A 2-percent shareholder is a person who owns more than 2 percent of the outstanding stock or of the total combined voting power on any day of the S corporation’s year, including stock treated as owned under Code §318. Attribution under §318(a)(1) includes stock owned by a spouse, child, grandchild, or parent. It does not include stock owned only by a sibling. Such a person may not make pre-tax contributions under this Plan. This rule applies to an S corporation and to an LLC that has elected to be taxed as an S corporation.';
    }
    if (plan.owner_rule === 'self-employed') {
      return 'Employee does not include a self-employed individual within the meaning of Code §401(c), including a partner, a member of an LLC taxed as a partnership, a member of an LLC that is a disregarded entity, and a sole proprietor. Those individuals may not make pre-tax contributions under this Plan.';
    }
    return 'A common-law employee of a C corporation or a nonprofit may participate, including an owner who is a common-law employee. Partners, sole proprietors, and more-than-2-percent S corporation shareholders are not employees for Code §125 when those rules apply to the employer.';
  }

  function benefitParagraphs(plan) {
    var rows = [];
    ['medical', 'dental', 'vision'].forEach(function (code) {
      if (!has(plan, code)) return;
      var name = S125Model.benefitLabel(code).toLowerCase();
      rows.push(row(null, 'The Employee’s share of premiums for coverage under the Employer’s group ' + name + ' plan, as described in the applicable insurance contract or plan document.'));
    });
    if (has(plan, 'health_fsa')) {
      var design = plan.health_fsa_design;
      var designText = design === 'limited'
        ? 'The Health FSA under this Plan is a limited-purpose health FSA. It reimburses dental, vision, and preventive care expenses. It is not a general-purpose health FSA.'
        : design === 'both'
          ? 'The Employer offers a general-purpose Health FSA and a limited-purpose Health FSA. The limited-purpose Health FSA reimburses dental, vision, and preventive care expenses. A Participant who wants to contribute to an HSA elects the limited-purpose Health FSA. A Participant covered by the general-purpose Health FSA, and a spouse who can be reimbursed by that FSA, is not eligible to contribute to an HSA for that period.'
          : 'The Health FSA under this Plan is a general-purpose health FSA. It can reimburse Code §213(d) medical expenses. A Participant covered by this general-purpose Health FSA, and a spouse who can be reimbursed by it, is not eligible to contribute to an HSA while that coverage is in effect. The Employer may still offer an HSA. An employee who wants to contribute to an HSA needs a limited-purpose FSA (dental, vision, and preventive care), a post-deductible FSA, or no general-purpose Health FSA.';
      rows.push(row(null, 'Health FSA. ' + designText + ' For a plan year beginning in 2026, the most a Participant may contribute by salary reduction is ' + S125Model.formatMoney(S125Model.HEALTH_FSA_LIMIT_2026) + ', under Code §125(i).'));
      if (plan.health_fsa_unused === 'grace') {
        rows.push(row(null, 'Health FSA grace period. This Plan provides a grace period ending on the 15th day of the third month after the end of each plan year. Expenses incurred during the grace period may be reimbursed from unused Health FSA amounts remaining at the end of the prior plan year. Amounts not used by the end of the grace period and the run-out period are forfeited. This Plan does not also provide a Health FSA carryover.'));
      } else if (plan.health_fsa_unused === 'carryover') {
        rows.push(row(null, 'Health FSA carryover. Unused Health FSA amounts up to the indexed carryover limit may be carried into the next plan year. For a plan year beginning in 2026, that carryover into the next plan year is ' + S125Model.formatMoney(S125Model.CARRYOVER_FROM_2026) + '. Amounts carried into a plan year beginning in 2026 from a plan year beginning in 2025 are limited to ' + S125Model.formatMoney(S125Model.CARRYOVER_INTO_2026) + '. Amounts above the limit are forfeited. This Plan does not also provide a Health FSA grace period. Carryover does not apply to the Dependent Care FSA.'));
      } else {
        rows.push(row(null, 'Health FSA forfeiture. Unused Health FSA amounts are forfeited at the end of the plan year and the run-out period. This Plan does not provide a Health FSA grace period or a Health FSA carryover.'));
      }
    }
    if (has(plan, 'dcap')) {
      var dcapUnused = plan.dcap_unused === 'grace'
        ? 'This Plan provides a grace period for the Dependent Care FSA ending on the 15th day of the third month after the end of each plan year. Amounts not used by the end of that grace period and the run-out period are forfeited.'
        : 'Unused Dependent Care FSA amounts are forfeited at the end of the plan year and the run-out period.';
      rows.push(row(null, 'Dependent Care FSA. A Participant may pay qualifying dependent care expenses on a pre-tax basis under Code §129. For taxable years beginning in 2026, the exclusion is ' + S125Model.formatMoney(S125Model.DCAP_LIMIT_2026) + ' (' + S125Model.formatMoney(S125Model.DCAP_MFS_2026) + ' if the Participant is married and files a separate return). That amount is set by statute and is not adjusted for inflation. Dependent care eligibility follows Code §§129 and 21, generally a dependent under age 13 or a spouse or dependent who is incapable of self-care. The age-27 accident-and-health rule does not apply to the Dependent Care FSA. ' + dcapUnused + ' Carryover does not apply to the Dependent Care FSA.'));
    }
    if (has(plan, 'hsa')) {
      rows.push(row(null, 'HSA contributions. A Participant who is an eligible individual under Code §223 may make pre-tax salary-reduction contributions to a health savings account. HSA Elections: Notwithstanding any irrevocable-election rule, a Participant may prospectively make, change, or revoke a salary reduction election for HSA contributions at least monthly, without a change-in-status event. The change applies only to compensation that is not yet currently available on the date of the change. A Participant who stops being HSA-eligible may prospectively revoke the election. HSA contributions are nonforfeitable once deposited to the custodian. Offering a general-purpose Health FSA does not prohibit the Employer from offering HSA contributions. A person covered by a general-purpose Health FSA is not an eligible individual for the HSA.'));
    }
    return rows;
  }

  function planParagraphs(plan) {
    var rows = [];
    rows.push(row('Title', plan.plan_name || 'Section 125 Cafeteria Plan'));
    rows.push(row(null, 'Educational sample prepared for ' + plan.employer_name + '. This document is not legal, tax, or ERISA advice. It is not effective until the Employer signs it. The signature line and the date line are blank.'));
    rows.push(row('Heading1', 'Article I. Establishment'));
    rows.push(row(null, plan.employer_name + ', ' + S125Model.entitySentence(plan) + ', EIN ' + plan.employer_ein + ', with its principal office at ' + plan.employer_address + ', adopts this cafeteria plan under Code §125. The plan number is ' + plan.plan_number + '. The Plan Administrator is the Employer, acting through its authorized officer.'));
    var adopt = plan.prior_plan
      ? 'This document restates the cafeteria plan originally adopted ' + plan.prior_adoption + '. The restatement is effective ' + S125Model.formatLongDate(plan.effective_date) + '.'
      : 'This Plan is effective ' + S125Model.formatLongDate(plan.effective_date) + '. It is adopted prospectively. It does not cover a period before the effective date.';
    rows.push(row(null, adopt));
    rows.push(row(null, 'The plan year is ' + S125Model.planYearSentence(plan) + '.'));
    if (plan.short_plan_year) {
      rows.push(row(null, 'The first plan year is a short plan year beginning ' + S125Model.formatLongDate(plan.effective_date) + ' and ending ' + S125Model.formatLongDate(plan.short_plan_year_end) + '. Later plan years follow the 12-month plan year above.' + (plan.plan_year_change ? ' This restatement changes the plan year, so the period before the new plan year starts is a short year.' : '')));
    } else if (plan.prior_plan) {
      rows.push(row(null, 'This restatement continues the existing plan year. It is not a new short plan year.'));
    }

    rows.push(row('Heading1', 'Article II. Definitions'));
    rows.push(row(null, 'Employer means ' + plan.employer_name + '.'));
    rows.push(row(null, ownerParagraph(plan)));
    rows.push(row(null, 'Eligible Employee means an Employee in an eligible class in Article III who has satisfied the waiting period and the other eligibility rules. Full-Time means an Employee regularly scheduled to work at least ' + plan.full_time_hours + ' hours a week. Part-Time means an Employee regularly scheduled to work fewer than ' + plan.full_time_hours + ' hours a week.'));
    rows.push(row(null, 'Dependent means a dependent under Code §152, except as this paragraph provides. For accident and health benefits, including medical, dental, vision, and a Health FSA, Dependent also includes a Participant’s child (as defined in Code §152(f)(1)) who has not attained age 27 as of the end of the Participant’s taxable year, even if that child is not a dependent under Code §152. That age-27 rule does not make a person a qualifying individual for the Dependent Care FSA.'));
    rows.push(row(null, 'A highly compensated individual, for Code §125, is a person described in Code §125(e): an officer; a shareholder owning more than 5 percent of the voting power or value of all classes of stock; a highly compensated employee under the compensation test; or a spouse or dependent of any of them. “Five percent or greater” is not the test. The ownership test is more than 5 percent.'));
    rows.push(row(null, 'A key employee is a key employee under Code §416(i)(1).'));

    rows.push(row('Heading1', 'Article III. Eligibility'));
    rows.push(row(null, 'Eligible classes: ' + S125Model.classSentence(plan) + '.'));
    rows.push(row(null, 'Waiting period and election effective date. ' + S125Model.waitingText(plan.waiting_period) + ' An election is effective on the date coverage begins under that waiting period. It is not postponed by an extra month beyond the waiting period the Employer chose.'));
    if (plan.waiting_period === 'days_90') {
      rows.push(row(null, 'The 90-day period is the general maximum waiting period for a group health plan under the Affordable Care Act. Coverage begins on the 91st day. This sample does not add days beyond that.'));
    }
    rows.push(row(null, 'The following are not Eligible Employees: an Employee who has not finished the waiting period; a temporary employee, a leased employee, or an independent contractor who is not a common-law employee; and any person excluded in Article II.'));
    if (plan.multi_state) {
      rows.push(row(null, 'Employees may work in more than one state. This Plan states the federal cafeteria-plan rules. State insurance and employment laws may also apply where the employees work.'));
    }

    rows.push(row('Heading1', 'Article IV. Benefits'));
    var claimSource = (has(plan, 'health_fsa') || has(plan, 'dcap'))
      ? 'The underlying insurance contract or FSA claims procedures control payment of a specific claim.'
      : 'The underlying insurance contract controls payment of a specific claim.';
    rows.push(row(null, 'A Participant may choose among cash and the qualified benefits listed in this Article. Each benefit is the Employee’s pre-tax payment of the cost described. ' + claimSource));
    benefitParagraphs(plan).forEach(function (item) { rows.push(item); });
    if ((has(plan, 'health_fsa') || has(plan, 'dcap')) && plan.funding_type) {
      rows.push(row(null, 'The ' + (has(plan, 'health_fsa') && has(plan, 'dcap') ? 'Health FSA and the Dependent Care FSA are' : has(plan, 'health_fsa') ? 'Health FSA is' : 'Dependent Care FSA is') + ' administered under the Employer’s FSA procedures. Those procedures do not replace the unused-funds rule stated in this Plan.'));
    }

    rows.push(row('Heading1', 'Article V. Elections'));
    rows.push(row(null, 'A salary-reduction election is irrevocable for the plan year except as this Article allows. The Plan permits prospective election changes for the events in Treas. Reg. §1.125-4 that the Employer has put in its election procedures, including a change in status and a HIPAA special enrollment right, when the change is consistent with that event.'));
    if (has(plan, 'hsa')) {
      rows.push(row(null, 'HSA salary-reduction elections are not locked for the year. Article IV requires a prospective change or revocation at least monthly, and a prospective revocation when the Participant stops being HSA-eligible.'));
    }
    rows.push(row(null, 'A new hire has ' + plan.new_hire_window + ' days after becoming eligible to make an initial election. An Employee who does not make an election in that window, or during open enrollment, is deemed to have waived all pre-tax benefits and elected cash. The missed election does not default to after-tax coverage.'));
    var oe = 'The annual open enrollment period runs for ' + plan.oe_window_days + ' days and ends the day before the plan year starts. Elections made during open enrollment are effective on the first day of the upcoming plan year. The first open enrollment period under this Plan runs from ' + S125Model.formatLongDate(plan.oe_start_date) + ' through ' + S125Model.formatLongDate(plan.oe_end_date) + '.';
    if (plan.oe_before_effective) {
      oe += ' That first window ends the day before the effective date. It is the enrollment to start the Plan. It is not an enrollment for a year that has already passed.';
    }
    rows.push(row(null, oe));

    rows.push(row('Heading1', 'Article VI. Salary reduction'));
    rows.push(row(null, 'A Participant’s taxable pay is reduced, before income tax and, where the Code allows, before Social Security and Medicare tax, by the amount needed to pay the elected benefits. The Employer pays that amount to the benefit. An election applies only to compensation that is not yet currently available.'));

    rows.push(row('Heading1', 'Article VII. Plan Administrator'));
    var admin = 'The Plan Administrator is the Employer, acting through its authorized officer. The officer who signs this Plan does so for the Employer and is not named personally as the fiduciary. The Plan Administrator applies this Plan and keeps records.';
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      admin += ' The Plan Administrator may delegate day-to-day administration of an FSA to a third-party administrator. Delegation does not move the unused-funds rule out of this Plan.';
    }
    rows.push(row(null, admin));
    rows.push(row(null, 'Notices to the Plan Administrator may be sent to ' + plan.signer_name + ', ' + plan.signer_title + ', at the Employer’s office.'));

    rows.push(row('Heading1', has(plan, 'hsa')
      ? 'Article VIII. No vested right except deposited HSA contributions'
      : 'Article VIII. No vested right'));
    var vest = 'Except for HSA amounts already deposited with the custodian, no Participant accrues a vested right to benefits under this Plan. Health FSA and Dependent Care FSA balances that remain unused under Article IV are forfeited.';
    if (!has(plan, 'hsa')) vest = 'No Participant accrues a vested right to benefits under this Plan. Amounts that remain unused under Article IV are forfeited.';
    rows.push(row(null, vest));

    rows.push(row('Heading1', 'Article IX. Nondiscrimination'));
    rows.push(row(null, 'This Plan is intended to satisfy the cafeteria-plan nondiscrimination rules in Code §125, including the 25 percent key-employee concentration test in §125(b)(2). Those tests apply to a plan of every size. The Employer will test the Plan each year. A larger workforce does not create the duty, and a smaller workforce does not remove it.'));
    if (has(plan, 'dcap')) {
      rows.push(row(null, 'Dependent Care FSA benefits are also subject to the Code §129(d) tests, including the 55 percent average benefits test and the limit on benefits to more-than-5-percent owners. The higher 2026 exclusion can make the 55 percent test harder to pass. The Employer should test before relying on the ' + S125Model.formatMoney(S125Model.DCAP_LIMIT_2026) + ' cap.'));
    }
    if (plan.funding_type === 'self' || plan.funding_type === 'level') {
      rows.push(row(null, 'Self-insured medical reimbursement benefits, including a level-funded arrangement that is self-insured for tax purposes, are also subject to the nondiscrimination requirements of Code §105(h).'));
    }
    if (Number(plan.employee_count) >= 50) {
      rows.push(row(null, 'An employer with 50 or more employees may be subject to the Family and Medical Leave Act, which affects cafeteria-plan elections during leave. Applicable large employer status under the Affordable Care Act depends on full-time and full-time-equivalent employees, not on this headcount alone.'));
    }

    rows.push(row('Heading1', 'Article X. Amendment and termination'));
    var amend = 'The Employer may amend or terminate this Plan prospectively. An amendment is effective only when the Employer adopts it in writing.';
    if (has(plan, 'hsa')) amend += ' Termination does not take back an HSA contribution already deposited.';
    rows.push(row(null, amend));

    rows.push(row('Heading1', 'Article XI. Severability'));
    rows.push(row(null, 'If a provision of this Plan is held invalid, the rest of the Plan remains in effect. This Article is part of every form of this Plan, whether or not an HSA is offered.'));

    rows.push(row('Heading1', 'Article XII. Execution'));
    rows.push(row(null, 'The Employer adopts this Plan as of the effective date when its authorized officer signs below. Generating this file does not adopt the Plan.', { keepNext: true }));
    rows.push(row(null, 'Employer: ' + plan.employer_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'By: ________________________________', { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Name: ' + plan.signer_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Title: ' + plan.signer_title, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Date: ________________________________', { keepLines: true }));
    rows.push(row(null, 'The date line is blank. The Employer dates the Plan when it signs.'));
    return rows;
  }

  function signLine(plan) {
    var when = S125Model.formatLongDate(plan.effective_date);
    var today = S125Model.todayIso();
    if (plan.effective_date && plan.effective_date < today) return 'Sign and date the plan as soon as you can.';
    return 'Sign and date the plan before ' + when + '.';
  }

  function checklistLines(plan) {
    var lines = [signLine(plan).replace(/\.$/, '') + '.'];
    lines.push('Give payroll the signed plan so pre-tax deductions start on or after the effective date.');
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      lines.push('Tell the FSA administrator the unused-funds rule in Article IV. Do not leave that rule only in side materials.');
    }
    if (has(plan, 'hsa')) lines.push('Tell payroll that HSA salary-reduction elections can be changed at least monthly, prospectively.');
    lines.push('Send employees a short note with the eligible classes, the waiting period, and the open enrollment dates in the plan.');
    if (plan.owner_rule === 's-corp') lines.push('Keep more-than-2% S corporation shareholders, including attributed family owners, off the pre-tax plan.');
    if (plan.owner_rule === 'self-employed') lines.push('Keep partners, LLC members taxed as partners, and sole proprietors off the pre-tax plan.');
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
      row(null, plan.employer_name + ' — ' + plan.plan_name + '.')
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
      'Oh, and if you want to look at employer contributions to Trump accounts under Section 128, I have a free tool for that too:',
      section128,
      '',
      'Also, just so you know, I\'m an employee benefits broker. No pressure at all, but I\'d be happy to help you shop and negotiate your group health and other benefits. I even have some rates you can check out online right now:',
      rates,
      '',
      'Would you mind giving me a shot to see what I can do for you? I\'d love to hear from you.',
      '',
      'Also, just so it\'s clear, I don\'t sell, market, open, or administer Trump accounts. And legally I have to mention that the tool is educational and isn\'t legal or tax advice.',
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
      '<w:ftr xmlns:w="' + W + '">' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>' +
      '<w:r><w:t xml:space="preserve">' + xml(FOOTER) + '</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/></w:pPr>' +
      '<w:r><w:t xml:space="preserve">Page </w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
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

  function planFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Plan_v1.0.docx';
  }

  function guideFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Implementation_Guide_v1.0.docx';
  }

  function pdfFileName(docxName) {
    return String(docxName).replace(/\.docx$/i, '.pdf');
  }


  function buildPlanDocx(plan) {
    return buildDocx(planParagraphs(plan), {
      title: plan.plan_name,
      created: S125Model.GUIDANCE_AS_OF
    });
  }

  function buildGuideDocx(plan) {
    return buildDocx(guideParagraphs(plan), {
      title: 'Section 125 implementation checklist',
      created: S125Model.GUIDANCE_AS_OF
    });
  }

  function plainText(rows) {
    return (rows || []).map(function (row) { return row.text || ''; }).join('\n');
  }

  return {
    FOOTER: FOOTER,
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

