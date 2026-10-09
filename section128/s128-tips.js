/**
 * Plain-language facts for the Section 128 form. Sources are the October 8, 2026 research record.
 */
var S128Tips = (function () {
  var TEXT = {
    employer_name: 'A Section 128 program is a separate written plan of an employer for the exclusive benefit of its employees. The legal name is the name printed on the sample. The employer decides whether to adopt the sample.',
    employer_ein: 'The employer identification number is printed so the sample and payroll refer to the same employer. This tool does not check the number with the IRS. The employer is responsible for the number it enters.',
    total_employee_count: 'This is the employee count stored with the sample. Proposed rules under REG-101355-26 measure eligibility and average benefits by groups of employees. The count is not a list of names.',
    street: 'The street address is printed on the sample so the employer is identified. It does not adopt the program. The employer confirms that the address is correct.',
    city: 'The city is printed with the state and ZIP on the sample plan. The address identifies the employer. It is not a signature.',
    state: 'An employer in any U.S. state can prepare this sample. Federal income-tax treatment does not decide state income tax. Florida has no personal income tax. Georgia’s 2026 conformity statute does not list Section 128 among the sections it decouples.',
    zip: 'The ZIP code is printed as part of the employer’s address, in the form City, ST ZIP. It identifies the employer on the sample.',
    contact_name: 'The person filling out this form. The name is used to address the email copy and is not printed on the plan. The signer is entered separately in the Administration step.',
    contact_title: 'Your job title, stored with the submission. It is not printed on the plan. The signer’s title is entered separately in the Administration step.',
    contact_email: 'When email delivery is on, a copy of the sample documents is sent to this address. The same address is limited to three copies an hour. The copy is the employer’s sample, not an approval.',
    contact_phone: 'The phone number is stored with the submission. Questions about DK Benefits’ services can use 407-476-5076 or dan@dkbenefits.net. The number is not a signature.',
    funding_method: 'The written plan states how contributions are made. Proposed rules in REG-101355-26 require the plan to state the amount and whether salary reduction through a Section 125 plan is allowed. Choose one method. There is no default.',
    funding_employer_only: 'An employer grant is an amount the employer pays. This choice uses one uniform annual grant and does not use salary reduction. The Section 128 limit for 2026 and 2027 is $2,500 per employee.',
    funding_salary_reduction_only: 'Salary reduction for this benefit is allowed only through a Section 125 cafeteria plan, and only for a dependent’s Trump account. It does not reduce Social Security or Medicare tax. This choice includes no employer grant.',
    funding_combined: 'The employer pays a uniform annual grant, and employees may also elect salary reduction for dependents’ accounts. The employer grant and employee salary reduction together can\'t exceed the $2,500 annual limit per employee. Example: with a $1,000 grant, an employee can elect up to $1,500 through payroll.',
    employer_annual_grant: 'The proposed rules say the written plan states the contribution amount. This sample uses one whole-dollar grant per eligible employee once each calendar year. It is not prorated. For 2026 and 2027 the Section 128 limit is $2,500 per employee.',
    grant_recipients: 'Trump accounts are opened for children under 18. Most employers fund only employees’ children’s (dependents’) accounts. “Employee’s own account” matters only if the employer has employees age 17 or younger who have their own Trump account. Salary reduction can never fund an employee’s own account, and choosing own accounts adds extra legal conditions that are flagged for professional review.',
    grant_dependents: 'An employer Section 128 contribution can be made only while the child is in the growth period. That period ends on December 31 of the year the child turns 17. The separate $1,000 Treasury contribution is only for children born in 2025 through 2028. A child who was not born in those years, or who did not get that $1,000, can still have a Trump account and can still receive employer Section 128 contributions, as long as the child is under 18 and the account is opened and active. Anyone under 18 with a Social Security number can have an account opened. Dependent means someone the employee anticipates will be a Section 152 dependent for the contribution year.',
    grant_own_account: 'An employee’s own Trump account can receive an employer grant only during the growth period, which ends on December 31 of the year the beneficiary turns 17. That situation is limited to employees age 17 or younger. Department of Labor conditions apply. Salary reduction still cannot fund the employee’s own account.',
    annual_cap: 'The program limit is the lesser of the Section 128(b) amount and any lower amount the written plan states. For 2026 and 2027 the statutory amount is $2,500 per employee, for all employers combined. It is not a per-child limit.',
    cap_statutory: 'Section 128(b) sets $2,500 for 2026 and 2027. After 2027 the statute adjusts the amount, and the increase is rounded down to the next lower $100. No indexed dollar amount for 2028 has been published, so this sample does not state one.',
    cap_fixed: 'A fixed cap is a whole-dollar ceiling the employer writes into the plan. It does not rise when a later statutory adjustment is published. It still cannot exceed the Section 128 limit that applies for the year.',
    fixed_annual_cap: 'Enter the ceiling in whole dollars. For 2026 and 2027 a figure above $2,500 cannot be checked, because $2,500 is the published Section 128 limit. This sample does not invent an indexed amount.',
    eligibility_class: 'The written plan must name the eligible class. Proposed rules say the class uses objective business criteria. Listing employees by name, or something with the same effect, does not qualify. An employee counts as eligible only with a meaningful opportunity to participate.',
    eligibility_all: '“All common-law employees” is one objective class. Self-employed partners and sole proprietors are not employees for this program under the proposed rules. A director is not eligible only because of director service.',
    eligibility_other: 'A narrower class must still be objective, such as full-time employees or employees at one location. Proposed rules also describe testing exclusions for some employees under age 21 with less than a year of service, and for some collectively bargained employees. A list of names is not a class.',
    eligibility_class_other: 'The words typed here are printed as the eligible class. Use objective terms. A description that names individual people is not accepted by this sample.',
    waiting_days: 'The sample uses a waiting period of 0 to 365 calendar days before entry. Zero means eligible on hire. Entry is not before the effective date. Proposed rules require a meaningful opportunity to participate.',
    effective_date: 'No Trump account contribution can be accepted before July 4, 2026. The effective date is the date the sample says the program would begin if the employer adopts it. The signature line and the date line stay blank.',
    plan_name: 'This is the name of the separate written plan. Proposed rules require a written plan and a stated plan year. This sample uses the calendar year January 1 through December 31. The annual dollar limit is also measured by calendar year.',
    participating_employers: 'Employers treated as one employer under Section 414(b), (c), (m), or (o) are one employer for Section 128. List any other employer that would use the same written terms. If the list is empty, the sample names only the sponsoring employer.',
    entity_type: 'The proposed rules define an employee as a common-law employee. The preamble to REG-101355-26 discusses partners, sole proprietors, and 2-percent S corporation shareholders as not employees for this program. The entity type is stored with the sample.',
    related_businesses: 'Related employers under Section 414 are aggregated for the Section 128 limit and for nondiscrimination tests. “Yes” or “Not sure” is marked on the submission because those rules may apply. The employer confirms the group with its own advisors.',
    owners_or_family: 'A partner or sole proprietor is not an eligible employee. A 2-percent S corporation shareholder is not treated as an employee under the proposed-regulation preamble, and a shareholder’s spouse, children, grandchildren, and parents are treated the same way because the shares are attributed to them. A C corporation owner who is a common-law employee may participate and is often highly compensated for the average-benefits test.',
    collectively_bargained: 'Proposed rules allow certain collectively bargained employees to be left out of nondiscrimination tests when the stated conditions are met. This question records whether any employees are covered by a collective bargaining agreement.',
    has_existing_125_plan: 'Salary reduction for a dependent’s Trump account has to run through a written Section 125 cafeteria plan. The plan must describe the benefit and must allow prospective election changes at least monthly. If no cafeteria plan is confirmed, the sample program is still prepared and no amendment file is created.',
    administrator_name: 'The administrator named in the sample applies the written terms, checks designations, and keeps records. Naming an administrator does not remove the employer’s duty to follow the written plan. Proposed rules say the plan must be operated according to its terms.',
    administrator_contact: 'Eligible employees receive reasonable notice of the program’s availability and terms. The proposed rules do not prescribe a notice form. This contact is the one the sample says employees can use.',
    signer_name: 'The representative’s name is printed above a blank signature line. Printing it does not adopt the plan. The employer signs only if it decides to adopt the sample.',
    signer_title: 'The representative’s title is printed with the name above the blank signature line. It is not a signature and it is not an adoption date.',
    cafeteria_plan_name: 'The amendment file is a sample change to the cafeteria plan named here. The cafeteria plan must specifically describe the Section 128 benefit. Creating the file does not amend that plan.',
    cafeteria_amendment_date: 'A cafeteria-plan change for this benefit is prospective. The date has to be today or later, and not before July 4, 2026. Salary reduction starts only after the cafeteria plan permits the benefit.',
    election_cutoff_days: 'Proposed rules require that a salary-reduction election for this benefit can be changed or revoked at least monthly, before the pay is currently available. No life event is required. This number is the payroll processing notice in the sample, from 0 to 30 days.'
  };

  function place(button, panel) {
    var rect = button.getBoundingClientRect();
    var width = Math.min(280, window.innerWidth - 16);
    var left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    panel.style.width = width + 'px';
    panel.hidden = false;
    var top = rect.bottom + 6;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    var height = panel.offsetHeight;
    if (top + height > window.innerHeight - 8) {
      panel.style.top = Math.max(8, rect.top - height - 6) + 'px';
    }
  }

  function mount() {
    var buttons = [];
    document.querySelectorAll('.tip-slot').forEach(function (slot) {
      var id = slot.getAttribute('data-tip');
      var text = TEXT[id];
      if (!text) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'tip-btn';
      button.textContent = 'i';
      button.setAttribute('aria-label', 'About this question');
      var panelId = 'tip-panel-' + id;
      button.setAttribute('aria-describedby', panelId);
      button.setAttribute('aria-expanded', 'false');
      button.dataset.tipId = id;
      var panel = document.createElement('div');
      panel.className = 'tip-panel';
      panel.id = panelId;
      panel.setAttribute('role', 'tooltip');
      panel.hidden = true;
      panel.textContent = text;
      document.body.appendChild(panel);
      button._tipPanel = panel;
      slot.replaceWith(button);
      buttons.push(button);
    });

    var hoverButton = null;
    var focusButton = null;

    function hide(button) {
      button.setAttribute('aria-expanded', 'false');
      button._tipPanel.hidden = true;
      if (button.dataset.pinned === '1' && button !== hoverButton && button !== focusButton) delete button.dataset.pinned;
    }

    function show(button) {
      buttons.forEach(function (other) {
        if (other !== button) hide(other);
      });
      button.setAttribute('aria-expanded', 'true');
      place(button, button._tipPanel);
    }

    function visible(button) {
      return button === hoverButton || button === focusButton || button.dataset.pinned === '1';
    }

    function render() {
      buttons.forEach(function (button) {
        if (visible(button)) show(button);
        else hide(button);
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener('mouseenter', function () {
        hoverButton = button;
        render();
      });
      button.addEventListener('mouseleave', function (event) {
        if (event.relatedTarget === button._tipPanel) return;
        if (hoverButton === button) hoverButton = null;
        render();
      });
      button._tipPanel.addEventListener('mouseenter', function () {
        hoverButton = button;
        render();
      });
      button._tipPanel.addEventListener('mouseleave', function () {
        if (hoverButton === button) hoverButton = null;
        render();
      });
      button.addEventListener('focus', function () {
        focusButton = button;
        render();
      });
      button.addEventListener('blur', function () {
        if (focusButton === button) focusButton = null;
        render();
      });
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (button.dataset.pinned === '1') delete button.dataset.pinned;
        else button.dataset.pinned = '1';
        render();
      });
    });

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (target.closest && (target.closest('.tip-btn') || target.closest('.tip-panel'))) return;
      buttons.forEach(function (button) { delete button.dataset.pinned; });
      hoverButton = null;
      render();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      buttons.forEach(function (button) { delete button.dataset.pinned; });
      hoverButton = null;
      focusButton = null;
      render();
    });
    window.addEventListener('resize', render);
    window.addEventListener('scroll', render, true);
  }

  return { TEXT: TEXT, mount: mount };
})();
