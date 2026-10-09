/**
 * Plain-language facts for the Section 125 form. Sources are the October 9, 2026 research record.
 */
var S125Tips = (function () {
  var TEXT = {
    employer_name: 'The legal name is printed on the sample. The employer decides whether to adopt it. Printing the name does not adopt the plan.',
    employer_ein: 'The EIN is printed so payroll and the sample refer to the same employer. This tool does not check the number with the IRS. The file stays in the browser and in the email to DK Benefits. It is not posted as a public file.',
    plan_number: '501 is the usual cafeteria-plan number. Use another whole number from 501 to 999 if this employer already uses 501.',
    street: 'The street address is printed so the employer is identified. It does not adopt the plan.',
    city: 'The city is printed with the state and ZIP. The address identifies the employer.',
    state: 'An employer in any U.S. state can prepare this sample. Federal cafeteria-plan rules do not decide state income tax.',
    zip: 'The ZIP code is printed as part of the employer’s address.',
    phone: 'The phone number is stored with the submission and printed for notices. Questions about DK Benefits’ services can use 407-476-5076.',
    entity_type: 'Partners, sole proprietors, members of an LLC taxed as a partnership, and more-than-2% S corporation shareholders cannot participate in a cafeteria plan. The sample excludes them automatically. There is no “owners participating” choice.',
    llc_tax: 'An LLC taxed as an S corporation follows the more-than-2% shareholder rule, including family attribution under section 318. An LLC taxed as a partnership or as a disregarded entity follows the self-employed rule.',
    effective_date: 'A cafeteria plan is adopted prospectively. Use today or a later date. The signature line stays blank until the employer signs.',
    plan_year_type: 'A cafeteria plan year is 12 months. A short year is used only for a new plan that starts mid-year, or for a restatement that changes the plan year.',
    plan_year_start: 'The end date is the day before the next start, so the year is 12 months. February 29 is not offered, because the start date has to exist every year.',
    prior_plan: 'A restatement continues the plan that is already in place. It is not treated as a brand-new short plan year unless you are also changing the plan year.',
    plan_year_change: 'Check this only if the restatement moves the plan year. The period from the effective date to the day before the new plan year starts is a short year.',
    oe_window_days: 'Open enrollment is the window before each plan year. The dates in the sample are the first window on or after this plan exists. They are not a window from a month that already passed.',
    new_hire_window: 'A new hire has 1 to 30 days to enroll. An election made within 30 days of hire can take effect when coverage begins. A later election is prospective. A missed window is treated as an election of cash, not after-tax coverage.',
    employee_count: 'Section 125 nondiscrimination tests apply at every size. This count does not by itself decide Applicable Large Employer status.',
    funding_type: 'Level-funded and self-funded medical benefits can also face the section 105(h) nondiscrimination rules. Fully insured medical coverage generally does not.',
    full_time_hours: 'Full-time in this plan means the weekly hours you enter. The Affordable Care Act uses 30 hours for a different purpose. The two definitions can match, and they do not have to.',
    waiting_period: 'Coverage starts when this waiting period says it starts. The plan does not add an extra month on top of that date. A group health plan generally cannot make employees wait more than 90 days.',
    eligible_classes: 'The written plan has to name who is eligible. Part-time is included only if you check it. “Other” is printed with the description you type, not as the word Other alone.',
    eligible_class_other: 'Use objective terms such as job category, location, or pay basis. Do not list people by name.',
    multi_state: 'The sample states the federal cafeteria-plan rules. Some states add their own benefit rules for employees who work there.',
    benefits: 'Choose every benefit that will be paid pre-tax. Medical, dental, and vision mean the employee’s share of the premium. A health FSA and an HSA can both be offered. An employee covered by a general-purpose health FSA cannot contribute to an HSA.',
    health_fsa_design: 'A limited-purpose health FSA covers dental, vision, and preventive care, so an HSA contribution can still be allowed. A general-purpose health FSA blocks HSA contributions for the person it covers. A post-deductible FSA is another HSA-compatible design a TPA can add.',
    health_fsa_unused: 'Pick one. A grace period runs through the 15th day of the third month. Carryover is up to the maximum the IRS sets for that plan year ($680 from a plan year beginning in 2026). The plan cannot have both.',
    dcap_unused: 'Dependent care can be forfeited or given a grace period. The health FSA carryover does not apply. For 2026 the exclusion is $7,500, or $3,750 if married filing separately.',
    signer_name: 'This name is printed above a blank signature line. The employer, not the individual, is the plan administrator. The officer signs for the employer.',
    signer_title: 'The title is printed with the name. It is not a signature and it is not the adoption date.',
    signer_email: 'We use this address for a short note after you download the documents. The documents are not attached to that note. The same address is limited to three notes an hour.'
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