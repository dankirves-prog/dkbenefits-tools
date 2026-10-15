/**
 * Benefits compliance checkup scoring.
 * No calendar years, dollar amounts, or indexed percentages in visitor copy.
 * Fixed notice dates (Oct 15, Dec 31, Mar 2, Jun 1, Jul 31) are intentional.
 */
var DKQuiz = (function () {
  var VERSION = '4.1.0';

  var URLS = {
    wrap: 'https://www.dkbenefits.net/wrap-plan-document-tool',
    section125: 'https://www.dkbenefits.net/section125plantool',
    section128: 'https://www.dkbenefits.net/section-128-tool',
    qualifyingEvent: 'https://www.dkbenefits.net/qualifying-event-decision-tool',
    rbp: 'https://www.dkbenefits.net/rbp-decision-tool',
    quote: 'https://www.dkbenefits.net/instant-group-quote',
    partD: 'https://www.cms.gov/medicare/employers-plan-sponsors/creditable-coverage/model-notice-letters',
    chip: 'https://www.dol.gov/agencies/ebsa/laws-and-regulations/laws/chipra',
    cobraGeneral: 'https://www.dol.gov/sites/dolgov/files/EBSA/laws-and-regulations/laws/cobra/model-general-notice.docx',
    cobraElection: 'https://www.dol.gov/sites/dolgov/files/EBSA/laws-and-regulations/laws/cobra/model-election-notice.docx',
    whcra: 'https://www.dol.gov/sites/dolgov/files/ebsa/about-ebsa/our-activities/resource-center/publications/compliance-assistance-guide-appendix-c.pdf',
    rxdc: 'https://www.cms.gov/marketplace/about/oversight/other-insurance-protections/prescription-drug-data-collection-rxdc',
    hipaa: 'https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/model-notices-privacy-practices/index.html',
    exchange: 'https://www.dol.gov/agencies/ebsa/laws-and-regulations/laws/affordable-care-act/for-employers-and-advisers/coverage-options-notice'
  };

  var READINESS_BANDS = [
    { min: 9, label: 'Strong', className: 'score-strong', sub: 'Your compliance posture looks solid. A periodic review is still a good idea.' },
    { min: 7, label: 'Good', className: 'score-good', sub: 'Core items appear to be in order. A few items are worth confirming.' },
    { min: 5, label: 'Needs attention', className: 'score-needs', sub: 'Some important items need attention. Most are straightforward to address.' },
    { min: 3, label: 'Action recommended', className: 'score-action', sub: 'Several items need action. Start with the top priorities.' },
    { min: 0, label: 'Significant gaps', className: 'score-gaps', sub: 'Significant gaps showed up. Most of them are fixable.' }
  ];

  var NOTICE_ITEMS = [
    { value: 'partD', label: 'Medicare Part D notice (by Oct 15)' },
    { value: 'partDCms', label: 'Part D disclosure to CMS (within 60 days of the plan year start)' },
    { value: 'chip', label: 'CHIP notice' },
    { value: 'whcra', label: 'WHCRA notice' },
    { value: 'hipaaSpecial', label: 'HIPAA special enrollment notice (at enrollment)' }
  ];

  function blank(value) {
    return value == null || value === '' || (Array.isArray(value) && !value.length);
  }

  function hasBenefit(answers, key) {
    return Array.isArray(answers.benefitsOffered) && answers.benefitsOffered.indexOf(key) !== -1;
  }

  function offersBenefits(answers) { return answers.offerBenefits === 'yes'; }
  function medical(answers) { return offersBenefits(answers) && hasBenefit(answers, 'medical'); }
  function selfOrLevel(answers) {
    return medical(answers) && (answers.medicalFunding === 'selfFunded' || answers.medicalFunding === 'levelFunded');
  }
  function church(answers) { return answers.employerType === 'church'; }
  function governmental(answers) { return answers.employerType === 'governmental'; }
  function erisaEmployer(answers) { return !church(answers) && !governmental(answers); }

  var questions = [
    {
      id: 'offerBenefits',
      text: 'Do you currently offer any benefits to your employees?',
      helper: 'Benefits include medical, dental, vision, life, disability, and other employer-sponsored benefits.',
      options: [
        { value: 'yes', label: 'Yes. We currently offer benefits' },
        { value: 'no', label: 'No. We do not currently offer benefits' }
      ],
      required: true
    },
    {
      id: 'employeeCount',
      text: 'How many full-time employees do you currently have?',
      helper: 'Full-time for this question means about 30 or more hours a week. Federal COBRA size uses a prior-year typical business day, not only today.',
      options: [
        { value: 'under20', label: 'Fewer than 20' },
        { value: '20to49', label: '20 to 49' },
        { value: '50plus', label: '50 or more' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true
    },
    {
      id: 'partTime',
      text: 'Do part-time employees make up a significant portion of your workforce?',
      helper: 'For ACA size, part-time hours are combined into full-time equivalents.',
      options: [
        { value: 'yes', label: 'Yes. Part-time employees are a significant part of the workforce' },
        { value: 'no', label: 'No. Most employees are full-time' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      showIf: function (a) { return a.employeeCount !== '50plus'; }
    },
    {
      id: 'employerType',
      text: 'What kind of employer are you?',
      helper: 'Church plans and governmental employers are generally outside ERISA. Federal COBRA generally does not apply to church plans.',
      options: [
        { value: 'private', label: 'Private or other employer' },
        { value: 'church', label: 'Church' },
        { value: 'governmental', label: 'Governmental employer' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true
    },
    {
      id: 'benefitsOffered',
      text: 'Which benefits do you offer?',
      helper: 'Select every benefit you sponsor. Medical drives several notices. An HRA, ICHRA, or QSEHRA is its own plan.',
      multiSelect: true,
      options: [
        { value: 'medical', label: 'Medical' },
        { value: 'dentalVision', label: 'Dental/Vision' },
        { value: 'lifeDisability', label: 'Life/Disability' },
        { value: 'hsa', label: 'HSA' },
        { value: 'healthFsa', label: 'Health FSA' },
        { value: 'dcap', label: 'Dependent care FSA' },
        { value: 'hra', label: 'HRA or ICHRA/QSEHRA' },
        { value: 'wellness', label: 'Wellness program' }
      ],
      required: true,
      needs: ['offerBenefits'],
      showIf: function (a) { return a.offerBenefits === 'yes'; }
    },
    {
      id: 'medicalFunding',
      text: 'How is your medical plan funded?',
      helper: 'Level-funded plans are legally self-funded, so self-funded rules apply.',
      options: [
        { value: 'fullyInsured', label: 'Fully insured through a carrier' },
        { value: 'selfFunded', label: 'Self-funded. We pay claims directly' },
        { value: 'levelFunded', label: 'Level-funded' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['offerBenefits', 'benefitsOffered'],
      showIf: function (a) { return medical(a); }
    },
    {
      id: 'wrapPlanInPlace',
      text: 'Do you have a written ERISA plan document (often called a wrap document) that covers all your benefits?',
      helper: 'Carrier certificates alone usually do not satisfy the written-plan rule for a private employer.',
      options: [
        { value: 'yes', label: 'Yes. We have a written plan document' },
        { value: 'no', label: 'No. We do not have one' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['offerBenefits'],
      showIf: function (a) { return offersBenefits(a); }
    },
    {
      id: 'wrapPlanAge',
      text: 'When was that written plan last reviewed?',
      helper: 'It should match the benefits you offer now. A carrier change or a new benefit is a reason to update it.',
      options: [
        { value: 'within1year', label: 'Within the past year' },
        { value: '1to3years', label: '1 to 3 years ago' },
        { value: 'over3years', label: 'More than 3 years ago' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['wrapPlanInPlace'],
      showIf: function (a) { return offersBenefits(a) && a.wrapPlanInPlace === 'yes'; }
    },
    {
      id: 'spdDistributed',
      text: 'Have employees received a Summary Plan Description (SPD)?',
      helper: 'An SPD explains the plan in plain language. Participants generally receive it within 90 days of enrollment. Material changes also call for a summary of material modifications.',
      options: [
        { value: 'yes', label: 'Yes. Employees have received an SPD' },
        { value: 'no', label: 'No. Employees have not received an SPD' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['offerBenefits'],
      showIf: function (a) { return offersBenefits(a); }
    },
    {
      id: 'sbcDistributed',
      text: 'Have employees received a Summary of Benefits and Coverage (SBC)?',
      helper: 'Group health coverage generally needs an SBC. The carrier usually prepares it. The employer is responsible for getting it to employees.',
      options: [
        { value: 'yes', label: 'Yes. Employees have received an SBC' },
        { value: 'no', label: 'No. Employees have not received an SBC' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['benefitsOffered'],
      showIf: function (a) { return medical(a); }
    },
    {
      id: 'employeeContrib',
      text: 'Do employees contribute toward benefits through payroll deductions?',
      options: [
        { value: 'yes', label: 'Yes. Employees contribute through payroll' },
        { value: 'no', label: 'No. The employer pays the full cost' }
      ],
      required: true,
      needs: ['offerBenefits'],
      showIf: function (a) { return offersBenefits(a); }
    },
    {
      id: 'pretax',
      text: 'Are those payroll deductions taken pre-tax?',
      helper: 'A premium-only plan is one kind of Section 125 plan. Without a written plan, pre-tax deductions can be treated as taxable wages (income tax and FICA).',
      options: [
        { value: 'yes', label: 'Yes. Deductions are pre-tax' },
        { value: 'no', label: 'No. Deductions are post-tax' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['employeeContrib'],
      showIf: function (a) { return offersBenefits(a) && a.employeeContrib === 'yes'; }
    },
    {
      id: 'section125InPlace',
      text: 'Do you have a written Section 125 cafeteria plan?',
      helper: 'A premium-only plan is one kind of Section 125 plan. Without a written plan, pre-tax deductions can be treated as taxable wages (income tax and FICA).',
      options: [
        { value: 'yes', label: 'Yes. We have a written Section 125 plan' },
        { value: 'no', label: 'No. We do not have one' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['pretax'],
      showIf: function (a) { return offersBenefits(a) && a.employeeContrib === 'yes' && a.pretax === 'yes'; }
    },
    {
      id: 'section125Tested',
      text: 'Is your Section 125 plan tested each year for nondiscrimination?',
      helper: 'Testing applies to every cafeteria plan. A premium-only plan is treated as passing if it passes the eligibility test. A dependent care FSA has its own test.',
      options: [
        { value: 'yes', label: 'Yes. It is tested each year' },
        { value: 'no', label: 'No. It is not tested' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['section125InPlace'],
      showIf: function (a) { return offersBenefits(a) && a.pretax === 'yes' && a.section125InPlace === 'yes'; }
    },
    {
      id: 'section125Age',
      text: 'When was your Section 125 plan last reviewed?',
      helper: 'The written plan should match the benefits you offer, open enrollment, and how mid-year election changes work.',
      options: [
        { value: 'within1year', label: 'Within the past year' },
        { value: '1to3years', label: '1 to 3 years ago' },
        { value: 'over3years', label: 'More than 3 years ago' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['section125InPlace'],
      showIf: function (a) { return offersBenefits(a) && a.pretax === 'yes' && a.section125InPlace === 'yes'; }
    },
    {
      id: 'noticesSent',
      text: 'Notices and filings',
      helper: 'These apply when you offer medical coverage. Select each one you already send. CMS has revised its creditable-coverage test; ask your carrier or TPA whether the plan is still creditable before sending the notice.',
      multiSelect: true,
      options: NOTICE_ITEMS.concat([
        { value: 'none', label: 'None of these yet', exclusive: true },
        { value: 'notSure', label: 'Not sure', exclusive: true }
      ]),
      required: true,
      needs: ['benefitsOffered'],
      showIf: function (a) { return medical(a); }
    },
    {
      id: 'exchangeNotice',
      text: 'Do new hires get a Marketplace coverage notice within 14 days of their start date?',
      helper: 'FLSA Section 18B requires this notice for covered employers, whether or not you offer a health plan. It is a one-time notice for each new hire. The statute does not set a penalty for missing it.',
      options: [
        { value: 'yes', label: 'Yes. It is in our new-hire packet' },
        { value: 'no', label: 'No. We do not provide this notice' },
        { value: 'notSure', label: 'Not sure' },
        { value: 'noRecognize', label: 'I do not recognize this notice' }
      ],
      required: true
    },
    {
      id: 'rxdcStatus',
      text: 'Was RxDC reporting filed for last year?',
      helper: 'Group health plans with prescription drug coverage file this each year, due Jun 1 for the prior calendar year. A carrier or TPA often files it. The plan sponsor still confirms that it happened.',
      options: [
        { value: 'carrierFiled', label: 'Carrier or TPA filed' },
        { value: 'weFiled', label: 'We filed' },
        { value: 'no', label: 'No' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['benefitsOffered'],
      showIf: function (a) { return medical(a); }
    },
    {
      id: 'gagClause',
      text: 'Was the annual gag clause attestation filed?',
      helper: 'The attestation is due by Dec 31. The carrier usually attests for an insured plan. Self-funded and level-funded plans should confirm the attestation was filed.',
      options: [
        { value: 'carrierFiled', label: 'Carrier or TPA filed' },
        { value: 'weFiled', label: 'We filed' },
        { value: 'no', label: 'No' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['benefitsOffered'],
      showIf: function (a) { return medical(a); }
    },
    {
      id: 'hraNotice',
      text: 'Have employees received the notice required for your HRA, ICHRA, or QSEHRA?',
      helper: 'An ICHRA or QSEHRA needs a written notice 90 days before the plan year. A standard HRA needs a plan document and an SPD.',
      options: [
        { value: 'yes', label: 'Yes. Employees received the notice' },
        { value: 'no', label: 'No. They have not received it' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['benefitsOffered'],
      showIf: function (a) { return offersBenefits(a) && hasBenefit(a, 'hra'); }
    },
    {
      id: 'hipaaPrivacy',
      text: 'Do you maintain a HIPAA Notice of Privacy Practices and give it to plan participants?',
      helper: 'Self-funded and level-funded health plans handle protected health information directly. Vendors that handle that information should have a business associate agreement.',
      options: [
        { value: 'yes', label: 'Yes. We have a notice and distribute it' },
        { value: 'no', label: 'No. We do not have one in place' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['medicalFunding'],
      showIf: function (a) { return selfOrLevel(a); }
    },
    {
      id: 'cobraAdmin',
      text: 'Who handles COBRA notices?',
      helper: 'The employer notifies the plan administrator within 30 days of a qualifying event. The administrator then sends the election notice within 14 days. If the employer is its own administrator, the election notice is due within 44 days of the qualifying event.',
      options: [
        { value: 'inHouse', label: 'In-house. We send the notices' },
        { value: 'thirdParty', label: 'A third-party COBRA administrator' },
        { value: 'broker', label: 'Our broker or benefits advisor' },
        { value: 'noOne', label: 'No one is handling it' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['offerBenefits', 'employeeCount', 'employerType'],
      showIf: function (a) {
        return offersBenefits(a) && !church(a) && (a.employeeCount === '20to49' || a.employeeCount === '50plus' || a.employeeCount === 'notSure');
      }
    },
    {
      id: 'employerState',
      text: 'Where is the employer based?',
      helper: 'State continuation rules differ for smaller groups. This flags the issue. It does not decide your state rule.',
      options: [
        { value: 'FL', label: 'Florida' },
        { value: 'GA', label: 'Georgia' },
        { value: 'CA', label: 'California' },
        { value: 'NV', label: 'Nevada' },
        { value: 'SC', label: 'South Carolina' },
        { value: 'other', label: 'Other' }
      ],
      required: true,
      needs: ['offerBenefits', 'benefitsOffered', 'employeeCount'],
      showIf: function (a) {
        return medical(a) && (a.employeeCount === 'under20' || a.employeeCount === 'notSure');
      }
    },
    {
      id: 'planStructure',
      text: 'Does any of the following apply to your benefits plan?',
      helper: 'Form 5500 filing follows enrolled participants, a trust, or a MEWA. It does not follow total headcount. Select all that apply.',
      multiSelect: true,
      options: [
        { value: 'mewa', label: 'Multiple unrelated employers share the plan (a MEWA or association plan)' },
        { value: 'trust', label: 'The plan is funded through a trust' },
        { value: 'prior5500', label: 'We have filed Form 5500 for this plan before' },
        { value: 'none', label: 'None of these apply', exclusive: true }
      ],
      required: true,
      needs: ['offerBenefits', 'employerType'],
      showIf: function (a) { return offersBenefits(a) && erisaEmployer(a); }
    },
    {
      id: 'enrolledCount',
      text: 'How many employees were enrolled in at least one benefit on the first day of the plan year?',
      helper: 'Count employees who were actually enrolled, not everyone who was eligible. Employer-paid life usually means everyone is enrolled.',
      options: [
        { value: 'under100', label: 'Fewer than 100 enrolled' },
        { value: '100plus', label: '100 or more enrolled' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['offerBenefits', 'employerType', 'employeeCount'],
      showIf: function (a) {
        return offersBenefits(a) && erisaEmployer(a) && a.employeeCount !== 'under20';
      }
    },
    {
      id: 'nobenGrowth',
      text: 'Are you planning to hire significantly over the next year?',
      options: [
        { value: 'yes', label: 'Yes. We expect significant growth' },
        { value: 'no', label: 'No. Headcount will stay about the same' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['offerBenefits'],
      showIf: function (a) { return a.offerBenefits === 'no'; }
    },
    {
      id: 'nobenCompetition',
      text: 'Are you competing for employees with companies that offer benefits?',
      helper: 'Benefits can matter for hiring even when the law does not require them.',
      options: [
        { value: 'yes', label: 'Yes. That comes up in hiring' },
        { value: 'no', label: 'No. Benefits are not a hiring factor' },
        { value: 'notSure', label: 'Not sure' }
      ],
      required: true,
      needs: ['offerBenefits'],
      showIf: function (a) { return a.offerBenefits === 'no'; }
    }
  ];

  function deriveFlags(answers) {
    var structure = Array.isArray(answers.planStructure) ? answers.planStructure : [];
    var ale = 'unlikely';
    if (answers.employeeCount === '50plus') ale = 'ale';
    else if (answers.employeeCount === 'notSure') ale = 'confirmSize';
    else if ((answers.employeeCount === '20to49' || answers.employeeCount === 'under20') &&
      (answers.partTime === 'yes' || answers.partTime === 'notSure')) ale = 'confirmAle';
    return {
      offersBenefits: offersBenefits(answers),
      medicalOffered: medical(answers),
      selfFunded: answers.medicalFunding === 'selfFunded',
      levelFunded: answers.medicalFunding === 'levelFunded',
      selfOrLevel: selfOrLevel(answers),
      hra: offersBenefits(answers) && hasBenefit(answers, 'hra'),
      healthFsa: offersBenefits(answers) && hasBenefit(answers, 'healthFsa'),
      dcap: offersBenefits(answers) && hasBenefit(answers, 'dcap'),
      hsa: offersBenefits(answers) && hasBenefit(answers, 'hsa'),
      life: offersBenefits(answers) && hasBenefit(answers, 'lifeDisability'),
      wellness: offersBenefits(answers) && hasBenefit(answers, 'wellness'),
      hasContrib: answers.employeeContrib === 'yes',
      pretaxYes: answers.pretax === 'yes',
      pretaxNo: answers.pretax === 'no',
      pretaxNotSure: answers.pretax === 'notSure',
      empCount: answers.employeeCount || 'notSure',
      ale: ale,
      church: church(answers),
      governmental: governmental(answers),
      erisa: erisaEmployer(answers),
      hasMewa: structure.indexOf('mewa') !== -1,
      hasTrust: structure.indexOf('trust') !== -1,
      hasPrior5500: structure.indexOf('prior5500') !== -1
    };
  }

  function determineForm5500(answers, flags) {
    if (!flags.offersBenefits || !flags.erisa) return { status: 'notApplicable', note: '' };
    if (flags.hasMewa) {
      return { status: 'required', reason: 'mewa', note: 'Confirm your association plan files its Form M-1 and Form 5500.' };
    }
    if (flags.hasTrust) {
      return { status: 'required', reason: 'trust', note: 'A plan funded through a trust generally files Form 5500 even when fewer than 100 employees are enrolled.' };
    }
    if (answers.enrolledCount === '100plus') {
      return { status: 'required', reason: 'enrolled', note: '100 or more employees were enrolled on the first day of the plan year.' };
    }
    if (answers.employeeCount === 'under20' && !flags.hasPrior5500) {
      return { status: 'notRequired', note: '' };
    }
    if (answers.enrolledCount === 'under100' || answers.employeeCount === 'under20') {
      if (flags.hasPrior5500) {
        return { status: 'confirm', note: 'You have filed Form 5500 before. Confirm whether a filing is still required.' };
      }
      return { status: 'notRequired', note: '' };
    }
    var note = 'Confirm how many employees were enrolled in at least one benefit on the first day of the plan year. Filing depends on enrolled participants, a trust, or a MEWA, not total headcount.';
    if (flags.life) note += ' Employer-paid life usually means everyone is enrolled.';
    return { status: 'confirm', note: note };
  }

  function readinessFor(score) {
    var n = Math.max(1, Math.round(score * 2) / 2);
    if (n > 10) n = 10;
    var band = READINESS_BANDS[READINESS_BANDS.length - 1];
    for (var i = 0; i < READINESS_BANDS.length; i++) {
      if (n >= READINESS_BANDS[i].min) { band = READINESS_BANDS[i]; break; }
    }
    return { score: n, label: band.label, className: band.className, sub: band.sub };
  }

  function deductUnsure(n, value, noPenalty, unsurePenalty) {
    if (value === 'no' || value === 'noOne' || value === 'notDone') return n - noPenalty;
    if (value === 'notSure' || value === 'noRecognize') return n - unsurePenalty;
    return n;
  }

  function computeReadiness(answers, flags, form5500) {
    var n = 10;
    if (!flags.offersBenefits) {
      if (flags.ale === 'ale') return readinessFor(3);
      return {
        score: null,
        label: 'Not applicable',
        className: 'score-na',
        sub: 'A readiness score starts once a plan is in place. The notes below still cover size and the Marketplace notice.'
      };
    }
    if (!flags.erisa) {
      if (answers.wrapPlanInPlace === 'notSure') n -= 1;
    } else if (answers.wrapPlanInPlace === 'no') n -= 2;
    else if (answers.wrapPlanInPlace === 'notSure' || answers.wrapPlanAge === 'over3years' || answers.wrapPlanAge === 'notSure') n -= 1;

    n = deductUnsure(n, answers.spdDistributed, 1.5, 1);
    if (flags.medicalOffered) n = deductUnsure(n, answers.sbcDistributed, 1.5, 1);

    if (flags.pretaxYes) {
      if (answers.section125InPlace === 'no') n -= 2;
      else if (answers.section125InPlace === 'notSure') n -= 1;
      else if (answers.section125InPlace === 'yes') {
        if (answers.section125Age === 'over3years' || answers.section125Age === 'notSure') n -= 1;
        if (answers.section125Tested === 'no') n -= 1.5;
        else if (answers.section125Tested === 'notSure') n -= 1;
      }
    } else if (flags.pretaxNotSure) n -= 1;

    if (flags.medicalOffered) {
      var sent = Array.isArray(answers.noticesSent) ? answers.noticesSent : [];
      if (sent.indexOf('notSure') !== -1) n -= 1;
      else if (!sent.length || sent.indexOf('none') !== -1) n -= 2;
      else {
        var missing = NOTICE_ITEMS.filter(function (item) { return sent.indexOf(item.value) === -1; }).length;
        if (missing) n -= Math.min(2, missing);
      }
      if (answers.rxdcStatus === 'no') n -= 1.5;
      else if (answers.rxdcStatus === 'notSure') n -= 1;
      else if (flags.selfOrLevel && answers.rxdcStatus !== 'carrierFiled' && answers.rxdcStatus !== 'weFiled') n -= 0.5;
      if (answers.gagClause === 'no') n -= 1.5;
      else if (answers.gagClause === 'notSure') n -= 1;
      else if (flags.selfOrLevel && answers.gagClause === 'carrierFiled') n -= 0.5;
    }

    n = deductUnsure(n, answers.exchangeNotice, 1, 1);

    if (!flags.church && (flags.empCount === '20to49' || flags.empCount === '50plus' || flags.empCount === 'notSure')) {
      if (answers.cobraAdmin === 'noOne') n -= 1.5;
      else if (answers.cobraAdmin === 'notSure') n -= 1;
    }
    if (flags.ale === 'ale' && !flags.medicalOffered) n -= 2;
    if (flags.ale === 'confirmAle' || flags.ale === 'confirmSize') n -= 1.5;
    if (flags.selfOrLevel) n = deductUnsure(n, answers.hipaaPrivacy, 1, 1);
    if (flags.hra) n = deductUnsure(n, answers.hraNotice, 1, 1);
    if (flags.medicalOffered && answers.medicalFunding === 'notSure') n -= 1;
    if ((flags.healthFsa || flags.dcap) && flags.pretaxNo) n -= 1.5;
    if (form5500.status === 'required' && !flags.hasPrior5500) n -= 1.5;
    else if (form5500.status === 'confirm') n -= 1;
    if (flags.ale === 'ale' && !flags.medicalOffered && n > 3) n = 3;
    return readinessFor(n);
  }

  function link(url, label, helper) {
    return { url: url, label: label, helper: helper || '' };
  }

  function card(spec) {
    spec.summary = spec.summary || spec.finding;
    spec.links = spec.links || [];
    spec.cta = spec.cta || null;
    spec.exposure = spec.exposure || 0;
    return spec;
  }

  function toolCta(type, label) {
    return { type: type, label: label };
  }

  function missingNotices(answers) {
    var sent = Array.isArray(answers.noticesSent) ? answers.noticesSent : [];
    if (!sent.length || sent.indexOf('none') !== -1 || sent.indexOf('notSure') !== -1) return NOTICE_ITEMS.slice();
    return NOTICE_ITEMS.filter(function (item) { return sent.indexOf(item.value) === -1; });
  }

  function buildExchangeCard(answers) {
    var status = 'confirm';
    var finding = 'Confirm the Marketplace notice is in the new-hire packet.';
    if (answers.exchangeNotice === 'yes') {
      status = 'inPlace';
      finding = 'New hires receive the Marketplace notice within 14 days of the start date.';
    } else if (answers.exchangeNotice === 'no') {
      status = 'actionNeeded';
      finding = 'New hires are not receiving the Marketplace notice.';
    } else if (answers.exchangeNotice === 'noRecognize') {
      finding = 'This notice was not recognized. It is the FLSA Section 18B Marketplace notice.';
    }
    return card({
      key: 'exchange_notice',
      title: 'Marketplace notice',
      status: status,
      exposure: status === 'actionNeeded' ? 55 : status === 'confirm' ? 34 : 0,
      summary: 'FLSA Section 18B notice for each new hire within 14 days. No penalty is written into that section.',
      description: 'FLSA Section 18B requires a Marketplace coverage notice for covered employers, whether or not a health plan is offered. Give it to each new hire within 14 days of the start date. That section does not set a penalty.',
      finding: finding,
      action: 'Use the DOL model notice that matches whether you offer a health plan. Keep it in the new-hire packet.',
      links: [link(URLS.exchange, 'DOL Marketplace notice', 'Choose the model for employers who offer a plan, or the model for employers who do not.')]
    });
  }

  function stateCard(answers, flags) {
    if (!flags.medicalOffered) return null;
    if (flags.empCount !== 'under20' && flags.empCount !== 'notSure') return null;
    var state = answers.employerState || 'other';
    var summary;
    var action;
    if (state === 'FL' && answers.medicalFunding === 'fullyInsured') {
      summary = 'Florida: insured groups under 20, the carrier sends notices. Tell departing employees to contact the carrier.';
      action = 'For insured Florida groups under 20 employees, the carrier sends continuation notices. Tell departing employees to contact the carrier.';
    } else if (state === 'FL') {
      summary = 'Florida small-group continuation is aimed at insured plans. Confirm a self-funded or level-funded plan separately.';
      action = 'Florida continuation for groups under 20 is aimed at insured coverage. Confirm how continuation works if the plan is self-funded or level-funded, and tell departing employees who to call.';
    } else if (state === 'GA') {
      summary = 'Georgia sets its own continuation rules for smaller groups. Confirm which plans are covered and who sends notices.';
      action = 'Confirm Georgia continuation for your group size, which plans it covers, and who must send notices. This checkup does not apply a single duration or premium rule.';
    } else if (state === 'CA') {
      summary = 'California sets its own continuation rules for smaller groups. Confirm which plans are covered and who sends notices.';
      action = 'Confirm California continuation for your group size, which plans it covers, and who must send notices. This checkup does not apply a single duration or premium rule.';
    } else if (state === 'NV') {
      summary = 'Nevada sets its own continuation rules for smaller groups. Confirm which plans are covered and who sends notices.';
      action = 'Confirm Nevada continuation for your group size, which plans it covers, and who must send notices. This checkup does not apply a single duration or premium rule.';
    } else if (state === 'SC') {
      summary = 'South Carolina sets its own continuation rules for smaller groups. Confirm which plans are covered and who sends notices.';
      action = 'Confirm South Carolina continuation for your group size, which plans it covers, and who must send notices. This checkup does not apply a single duration or premium rule.';
    } else {
      summary = 'State continuation rules differ. Confirm whether your state requires it, which plans are covered, and who sends notices.';
      action = 'Federal COBRA often does not apply under 20 employees. Confirm whether your state requires continuation, which plans are covered, and who sends notices.';
    }
    var flInsuredSmall = state === 'FL' && answers.medicalFunding === 'fullyInsured' && flags.empCount === 'under20';
    var status = flInsuredSmall ? 'note' : 'confirm';
    return card({
      key: 'state_cobra',
      title: 'State continuation',
      status: status,
      exposure: flInsuredSmall ? 0 : 64,
      summary: summary,
      description: 'Many states require continuation coverage for groups below the federal COBRA threshold. Duration, premiums, and which plans are covered vary.',
      finding: flags.empCount === 'notSure'
        ? 'Headcount is not confirmed, so state continuation may matter if the group is under the federal threshold.'
        : 'This group looks small enough that state continuation may be the rule that applies.',
      action: action
    });
  }

  function acaReportingCard() {
    return card({
      key: 'aca_reporting',
      title: 'ACA reporting',
      status: 'confirm',
      exposure: 68,
      summary: 'Forms 1094-C and 1095-C. IRS e-file is due Mar 31. Furnish Form 1095-C in early March, or post the allowed notice.',
      description: 'Applicable large employers file Form 1094-C with the IRS and furnish Form 1095-C to full-time employees. Electronic filing with the IRS is due Mar 31. Furnish the employee statement in early March, or post the allowed notice instead of handing a form to every employee.',
      finding: 'The group looks like an applicable large employer, so this reporting applies.',
      action: 'Put Mar 31 on the calendar for the IRS e-file, and early March for furnishing Form 1095-C or posting the notice.'
    });
  }

  function buildCards(answers, flags, form5500) {
    var cards = [];
    if (!flags.offersBenefits) {
      cards.push(buildExchangeCard(answers));
      if (flags.ale === 'ale') {
        cards.push(card({
          key: 'aca_no_coverage',
          title: 'ACA coverage may be required',
          status: 'actionNeeded',
          exposure: 100,
          summary: '50 or more full-time employees and no benefits. The employer mandate may apply.',
          description: 'Applicable large employers are generally required to offer affordable, minimum-value medical coverage to full-time employees.',
          finding: 'You reported 50 or more full-time employees and no current benefits.',
          action: 'Two different employer-shared-responsibility penalties can apply. One is for not offering coverage to enough full-time employees. The other is for coverage that is unaffordable or not minimum value when a full-time employee receives a premium tax credit.',
          cta: toolCta('quote', 'See group medical quotes')
        }));
      } else if (flags.ale === 'confirmAle') {
        cards.push(card({
          key: 'confirm_ale',
          title: 'Confirm ALE status',
          status: 'confirm',
          exposure: 78,
          summary: 'Part-time hours can change whether the group is an applicable large employer.',
          description: 'Applicable large employer status uses full-time employees plus full-time equivalents from part-time hours.',
          finding: 'Part-time hours are significant or not confirmed, so the full-time-equivalent count may cross the applicable large employer line.',
          action: 'Add part-time hours into full-time equivalents before you assume the employer mandate does not apply.',
          cta: toolCta('quote', 'See group medical quotes')
        }));
      } else if (flags.ale === 'confirmSize') {
        cards.push(card({
          key: 'confirm_size',
          title: 'Confirm your size',
          status: 'confirm',
          exposure: 80,
          summary: 'Headcount is not confirmed, so ACA and COBRA status are both open.',
          description: 'ACA size and federal COBRA size use different counts. Neither one is settled until the headcount is known.',
          finding: 'Full-time headcount was marked not sure.',
          action: 'Count full-time employees, then add part-time hours as full-time equivalents for ACA size. Federal COBRA commonly applies at 20 employees on a prior-year typical business day.',
          cta: toolCta('quote', 'See group medical quotes')
        }));
      }
      if (flags.ale === 'confirmSize' || flags.ale === 'confirmAle' || flags.empCount === '20to49' || flags.empCount === '50plus') {
        cards.push(card({
          key: 'cobra_consideration',
          title: 'COBRA consideration',
          status: 'confirm',
          exposure: flags.ale === 'confirmSize' ? 70 : 40,
          summary: 'If you add benefits, federal COBRA may apply once the group is at 20 employees.',
          description: 'Federal COBRA commonly applies at 20 employees, measured on a prior-year typical business day. Church plans are generally outside federal COBRA.',
          finding: flags.church
            ? 'Church plans are generally not subject to federal COBRA.'
            : 'You are not offering benefits yet. COBRA becomes a live duty when coverage starts, if the group is large enough.',
          action: 'Confirm the count before you assume COBRA will not apply. The employer notifies the administrator within 30 days, and the administrator sends the election notice within 14 days. An employer that administers its own plan has 44 days total. DK Benefits clients get COBRA notice handling at no extra cost, and you keep the 2% admin fee.'
        }));
      }
      if (flags.ale === 'ale') cards.push(acaReportingCard());
      if (answers.nobenGrowth === 'yes' || answers.nobenGrowth === 'notSure') {
        cards.push(card({
          key: 'growth',
          title: 'Plan ahead for hiring',
          status: 'note',
          exposure: 0,
          summary: 'Hiring can move ACA and COBRA size before the next renewal.',
          description: 'Full-time count and full-time equivalents should be checked again as the workforce grows.',
          finding: answers.nobenGrowth === 'yes'
            ? 'You expect significant hiring over the next year.'
            : 'Hiring plans are not settled.',
          action: 'Recheck size before you assume ACA or COBRA still sits where it does today.',
          cta: toolCta('quote', 'See group medical quotes')
        }));
      }
      if (answers.nobenCompetition === 'yes') {
        cards.push(card({
          key: 'competition',
          title: 'Benefits and hiring',
          status: 'note',
          exposure: 0,
          summary: 'A modest benefit package can help when you are hiring against employers who offer coverage.',
          description: 'There is no federal duty to offer benefits at a small size, but hiring can still turn on them.',
          finding: 'You said you compete with employers that offer benefits.',
          action: 'When you are ready, compare a basic package before you assume it is out of reach.',
          cta: toolCta('quote', 'See group medical quotes')
        }));
      }
      return cards;
    }

    cards.push(buildExchangeCard(answers));

    if (!flags.erisa) {
      cards.push(card({
        key: 'wrap',
        title: 'Written plan document',
        status: 'confirm',
        exposure: 30,
        summary: flags.church
          ? 'Church plans are generally not subject to ERISA.'
          : 'Governmental plans are generally not subject to ERISA.',
        description: 'ERISA written-plan and SPD rules generally apply to private employers. Church plans and governmental plans follow different rules.',
        finding: flags.church
          ? 'You marked the employer as a church.'
          : 'You marked the employer as governmental.',
        action: 'Confirm which written-plan rules apply. Do not assume the private-employer wrap document is required. Federal COBRA generally does not apply to church plans. Governmental employers can still have continuation duties under other rules.'
      }));
    } else {
      var wrapStatus = 'inPlace';
      var wrapFinding = 'A written plan document is in place.';
      var wrapExposure = 0;
      if (answers.wrapPlanInPlace === 'no') {
        wrapStatus = 'actionNeeded';
        wrapFinding = 'No written ERISA plan document is in place.';
        wrapExposure = 84;
      } else if (answers.wrapPlanInPlace === 'notSure') {
        wrapStatus = 'confirm';
        wrapFinding = 'It is not clear whether a written plan document exists.';
        wrapExposure = 60;
      } else if (answers.wrapPlanAge === 'over3years' || answers.wrapPlanAge === 'notSure') {
        wrapStatus = 'confirm';
        wrapFinding = 'The written plan should be checked against the benefits you offer now.';
        wrapExposure = 48;
      }
      cards.push(card({
        key: 'wrap',
        title: 'ERISA plan document',
        status: wrapStatus,
        exposure: wrapExposure,
        summary: 'A wrap document is the written plan that covers the benefits you sponsor.',
        description: 'Private employers generally need a written plan. Carrier certificates alone usually do not do that job. A wrap document is the usual way to cover every benefit in one instrument.',
        finding: wrapFinding,
        action: 'The document should name the benefits, the funding, and the claims path. Update it when benefits or carriers change.',
        cta: wrapStatus === 'inPlace' ? null : toolCta('wrap', 'Open the wrap plan tool')
      }));
    }

    var spdStatus = answers.spdDistributed === 'yes' ? 'inPlace' : answers.spdDistributed === 'no' ? 'actionNeeded' : 'confirm';
    cards.push(card({
      key: 'spd',
      title: 'Summary plan description',
      status: flags.erisa ? spdStatus : 'confirm',
      exposure: flags.erisa && spdStatus === 'actionNeeded' ? 58 : flags.erisa && spdStatus === 'confirm' ? 36 : 10,
      summary: 'Participants need an SPD, and a summary of material modifications when the plan changes.',
      description: 'An SPD explains eligibility, benefits, and claims rights in plain language. When the plan changes in a material way, participants also need a summary of material modifications.',
      finding: answers.spdDistributed === 'yes'
        ? 'You confirmed an SPD was distributed.'
        : answers.spdDistributed === 'no'
          ? 'Employees have not received an SPD.'
          : 'SPD distribution was not confirmed.',
      action: flags.erisa
        ? 'Keep proof of delivery. Pair a wrap SPD with the carrier certificate so the ERISA disclosures and the benefit details are both there.'
        : 'ERISA SPD rules may not apply. Confirm what your plan still has to give participants.'
    }));

    if (flags.medicalOffered) {
      var sbcStatus = answers.sbcDistributed === 'yes' ? 'inPlace' : answers.sbcDistributed === 'no' ? 'actionNeeded' : 'confirm';
      cards.push(card({
        key: 'sbc',
        title: 'Summary of benefits and coverage',
        status: sbcStatus,
        exposure: sbcStatus === 'actionNeeded' ? 56 : sbcStatus === 'confirm' ? 32 : 0,
        summary: 'Medical coverage needs an SBC at enrollment and renewal.',
        description: 'The SBC is the standardized summary of what the medical plan covers. It is not the WHCRA notice.',
        finding: answers.sbcDistributed === 'no'
          ? 'Employees have not received an SBC.'
          : answers.sbcDistributed === 'yes'
            ? 'You confirmed employees received an SBC.'
            : 'SBC distribution was not confirmed.',
        action: 'Ask the carrier for the current SBC and give it out at enrollment, at renewal, and when someone requests it in writing.'
      }));

      var missing = missingNotices(answers);
      var noticesUnsure = Array.isArray(answers.noticesSent) && answers.noticesSent.indexOf('notSure') !== -1;
      var noticeStatus = noticesUnsure ? 'confirm' : missing.length ? (missing.length === NOTICE_ITEMS.length ? 'actionNeeded' : 'confirm') : 'inPlace';
      cards.push(card({
        key: 'annual_notices',
        title: 'Notices and filings',
        status: noticeStatus,
        exposure: noticeStatus === 'actionNeeded' ? 76 : noticeStatus === 'confirm' ? 50 : 0,
        summary: noticesUnsure
          ? 'The notice checklist was not confirmed.'
          : missing.length
            ? 'Still open: ' + missing.map(function (item) { return item.label; }).join('; ') + '.'
            : 'The medical notices on the checklist are marked as sent.',
        description: 'Medical plans generally send a Part D notice by Oct 15, a Part D disclosure to CMS within 60 days of the plan year start, a CHIP notice, a WHCRA notice, and a HIPAA special enrollment notice at enrollment.',
        finding: noticesUnsure
          ? 'You were not sure which notices go out.'
          : missing.length
            ? 'One or more of those notices was not marked as sent.'
            : 'Each notice on the checklist was marked as sent.',
        action: 'CMS has revised its creditable-coverage test; ask your carrier or TPA whether the plan is still creditable before sending the notice. Put the dated items on a calendar and keep a copy of what went out.',
        links: [
          link(URLS.partD, 'CMS Part D model notices', 'Choose the creditable or non-creditable version that matches the plan.'),
          link(URLS.chip, 'DOL CHIP model notice', 'State contact details on the model change from time to time.'),
          link(URLS.whcra, 'WHCRA model language', 'This PDF includes WHCRA model language. It is not an SBC template.')
        ]
      }));

      var rxStatus = (answers.rxdcStatus === 'carrierFiled' || answers.rxdcStatus === 'weFiled') ? 'inPlace'
        : answers.rxdcStatus === 'no' ? 'actionNeeded' : 'confirm';
      cards.push(card({
        key: 'rxdc',
        title: 'RxDC reporting',
        status: rxStatus,
        exposure: rxStatus === 'actionNeeded' ? 74 : rxStatus === 'confirm' ? 46 : 0,
        summary: answers.rxdcStatus === 'carrierFiled'
          ? 'Carrier or TPA filing counts as in place. Keep written confirmation.'
          : 'RxDC for last year is due Jun 1 for the prior calendar year.',
        description: 'Plans with prescription drug coverage report each year. Fully insured, self-funded, and level-funded plans are included. The carrier or TPA often files. The sponsor confirms it.',
        finding: answers.rxdcStatus === 'carrierFiled'
          ? 'You said the carrier or TPA filed RxDC.'
          : answers.rxdcStatus === 'weFiled'
            ? 'You said the plan filed RxDC itself.'
            : answers.rxdcStatus === 'no'
              ? 'RxDC was not filed for last year.'
              : 'RxDC filing was not confirmed.',
        action: flags.selfOrLevel
          ? 'Level-funded and self-funded sponsors keep the duty even when a TPA files. Get proof of the Jun 1 submission.'
          : 'Ask the carrier to confirm, in writing, that last year was filed.',
        links: [link(URLS.rxdc, 'CMS RxDC page', 'Reporting instructions and submission guidance.')]
      }));

      var gagInPlace = answers.gagClause === 'weFiled' || (answers.gagClause === 'carrierFiled' && !flags.selfOrLevel);
      var gagStatus = answers.gagClause === 'no' ? 'actionNeeded' : gagInPlace ? 'inPlace' : 'confirm';
      cards.push(card({
        key: 'gag_clause',
        title: 'Gag clause attestation',
        status: gagStatus,
        exposure: gagStatus === 'actionNeeded' ? 72 : gagStatus === 'confirm' ? 47 : 0,
        summary: 'Due Dec 31. The carrier usually attests for an insured plan. Self-funded and level-funded plans confirm the filing.',
        description: 'Group health plans attest each year that their agreements do not include gag clauses. The due date is Dec 31.',
        finding: answers.gagClause === 'no'
          ? 'The attestation was not filed.'
          : answers.gagClause === 'weFiled'
            ? 'You said the plan filed the attestation.'
            : answers.gagClause === 'carrierFiled'
              ? 'You said a carrier or TPA filed the attestation.'
              : 'The attestation was not confirmed.',
        action: flags.selfOrLevel
          ? 'Do not assume a level-funded or self-funded carrier filed it. Confirm the Dec 31 attestation and keep the proof.'
          : 'For an insured plan, the carrier usually files. Ask for written confirmation.'
      }));

      var smallSelfFunded = flags.selfOrLevel && (flags.empCount === 'under20' || flags.empCount === '20to49');
      cards.push(card({
        key: 'parity',
        title: 'Mental health parity analysis',
        status: smallSelfFunded ? 'note' : 'confirm',
        exposure: smallSelfFunded ? 0 : 36,
        summary: smallSelfFunded
          ? 'Small self-funded and level-funded plans are generally exempt from the written NQTL analysis.'
          : 'Your plan should have a written NQTL comparative analysis available on request.',
        description: smallSelfFunded
          ? 'Self-funded and level-funded medical plans under 50 employees are generally exempt from the comparative analysis requirement. The exemption should be confirmed if the group grows.'
          : 'A written comparative analysis of nonquantitative treatment limits is required for insured plans and for larger self-funded plans.',
        finding: smallSelfFunded
          ? 'This group is under 50 and the medical plan is self-funded or level-funded.'
          : flags.selfOrLevel
            ? 'Self-funded and level-funded plans at this size should be able to produce the analysis.'
            : 'The carrier usually prepares the analysis for an insured plan.',
        action: smallSelfFunded
          ? 'Confirm the small-plan exemption still fits. If the group reaches 50 employees, ask for the written analysis.'
          : flags.selfOrLevel
            ? 'Your plan should have a written NQTL comparative analysis available on request. Confirm the TPA has it.'
            : 'The carrier usually prepares the analysis for an insured plan. Ask for a copy.'
      }));
    }

    if (flags.selfOrLevel || flags.hra) {
      cards.push(card({
        key: 'pcori',
        title: 'PCORI fee',
        status: 'confirm',
        exposure: 48,
        summary: flags.levelFunded
          ? 'Level-funded plans are self-funded for this fee. A TPA may file it. The employer confirms.'
          : 'Self-funded coverage and HRAs generally owe the PCORI fee, due Jul 31.',
        description: 'The PCORI fee is an annual filing for self-funded plans and for HRAs. Level-funded medical plans are treated as self-funded. A TPA may handle the fee for some level-funded products. The employer confirms it is filed. An HRA can owe the fee even when major medical is insured.',
        finding: flags.hra && !flags.selfOrLevel
          ? 'You offer an HRA, ICHRA, or QSEHRA.'
          : flags.levelFunded
            ? 'The medical plan is level-funded, so self-funded rules apply.'
            : 'The medical plan is self-funded.',
        action: 'Confirm the Jul 31 Form 720 filing. If a TPA prepares it, keep their confirmation.'
      }));
    }

    if (flags.selfOrLevel) {
      cards.push(card({
        key: 'nd_105h',
        title: 'Section 105(h) testing',
        status: 'confirm',
        exposure: 52,
        summary: 'Self-funded and level-funded medical plans are tested so they do not favor highly paid employees.',
        description: 'Section 105(h) applies to self-funded and level-funded medical coverage. It does not apply to a fully insured medical plan. It is separate from cafeteria-plan testing.',
        finding: 'The medical plan is self-funded or level-funded.',
        action: 'Have the TPA or tax advisor run the 105(h) tests. A failed test can change the tax result for highly compensated employees.'
      }));
      var hipaaStatus = answers.hipaaPrivacy === 'yes' ? 'inPlace' : answers.hipaaPrivacy === 'no' ? 'actionNeeded' : 'confirm';
      cards.push(card({
        key: 'hipaa_privacy',
        title: 'HIPAA privacy notice',
        status: hipaaStatus,
        exposure: hipaaStatus === 'actionNeeded' ? 66 : hipaaStatus === 'confirm' ? 40 : 0,
        summary: 'Self-funded and level-funded plans need their own privacy notice, plus business associate agreements.',
        description: 'A self-funded or level-funded health plan that handles health information keeps a Notice of Privacy Practices. Vendors that handle plan health information should have a business associate agreement.',
        finding: answers.hipaaPrivacy === 'yes'
          ? 'A privacy notice is in place.'
          : answers.hipaaPrivacy === 'no'
            ? 'No privacy notice is in place.'
            : 'The privacy notice was not confirmed.',
        action: 'Give the notice at enrollment and after a material change. Put business associate agreements in place with the TPA and other vendors that see plan health information.',
        links: [link(URLS.hipaa, 'HHS model privacy notices', 'Use the group health plan version.')]
      }));
    }

    if (flags.hra) {
      var hraStatus = answers.hraNotice === 'yes' ? 'inPlace' : answers.hraNotice === 'no' ? 'actionNeeded' : 'confirm';
      cards.push(card({
        key: 'hra_notice',
        title: 'HRA notice',
        status: hraStatus,
        exposure: hraStatus === 'actionNeeded' ? 62 : hraStatus === 'confirm' ? 42 : 0,
        summary: 'An ICHRA or QSEHRA needs a written notice 90 days before the plan year. A standard HRA needs a plan document and an SPD.',
        description: 'ICHRA and QSEHRA arrangements need their own written employee notice at least 90 days before the plan year starts. A standard HRA is documented in the plan document and the SPD, often through a wrap document.',
        finding: answers.hraNotice === 'yes'
          ? 'You confirmed the HRA notice went out.'
          : answers.hraNotice === 'no'
            ? 'Employees have not received the HRA notice.'
            : 'The HRA notice was not confirmed.',
        action: 'For an ICHRA or QSEHRA, deliver the written notice at least 90 days before the plan year. For a standard HRA, keep the plan document and SPD current. The wrap plan tool can draft that document.',
        cta: hraStatus === 'inPlace' ? null : toolCta('wrap', 'Open the wrap plan tool')
      }));
    }

    if (flags.pretaxNo) {
      cards.push(card({
        key: 'pretax_opportunity',
        title: 'Pre-tax premiums',
        status: 'confirm',
        exposure: 44,
        summary: 'You could save payroll taxes with a Section 125 premium-only plan.',
        description: 'Post-tax deductions leave payroll taxes on the table. A written premium-only plan is one kind of Section 125 plan and is what lets qualifying premiums come out pre-tax.',
        finding: 'Employee deductions are post-tax today.',
        action: 'You could save payroll taxes with a Section 125 premium-only plan. Without a written plan, pre-tax deductions can be treated as taxable wages for income tax and FICA.',
        cta: toolCta('section125', 'Open the Section 125 tool')
      }));
    }
    if (flags.pretaxYes || flags.healthFsa || flags.dcap || flags.hsa) {
      var needsWrittenForAccount = flags.pretaxNo && (flags.healthFsa || flags.dcap);
      var s125Status = 'confirm';
      var s125Finding = 'Confirm the written cafeteria plan and the annual tests.';
      var s125Exposure = 40;
      if (needsWrittenForAccount || answers.section125InPlace === 'no') {
        s125Status = 'actionNeeded';
        s125Finding = needsWrittenForAccount
          ? 'A health FSA or dependent care FSA needs a written Section 125 plan, even when premiums are post-tax.'
          : 'Pre-tax deductions are running without a written Section 125 plan.';
        s125Exposure = 86;
      } else if (answers.section125InPlace === 'notSure' || flags.pretaxNotSure) {
        s125Finding = 'It is not clear that a written Section 125 plan is in place.';
        s125Exposure = 58;
      } else if (answers.section125Tested === 'no') {
        s125Status = 'actionNeeded';
        s125Finding = 'The Section 125 plan is not tested each year.';
        s125Exposure = 64;
      } else if (answers.section125Tested === 'notSure' || answers.section125Age === 'over3years' || answers.section125Age === 'notSure') {
        s125Finding = 'The Section 125 plan should be confirmed against the benefits and tests you run now.';
        s125Exposure = 46;
      } else if (answers.section125InPlace === 'yes' && answers.section125Tested === 'yes') {
        s125Status = 'inPlace';
        s125Finding = 'A written plan is in place and you said it is tested.';
        s125Exposure = 0;
      }
      var s125Action = 'Keep the written plan with the eligibility test results.';
      if (s125Status === 'actionNeeded' && (needsWrittenForAccount || answers.section125InPlace === 'no')) {
        s125Action = 'Put a written Section 125 plan in place. Without it, pre-tax deductions and FSA amounts can be treated as taxable wages (income tax and FICA).';
      } else if (answers.section125Tested === 'no') {
        s125Action = 'Test the cafeteria plan each year. A premium-only plan is treated as passing if it passes the eligibility test.';
      } else if (answers.section125InPlace === 'notSure' || flags.pretaxNotSure) {
        s125Action = 'Confirm a written plan is on file and that it matches the benefits you offer.';
      } else if (answers.section125Tested === 'notSure' || answers.section125Age === 'over3years' || answers.section125Age === 'notSure') {
        s125Action = 'Review the written plan against the benefits you offer now, and run the tests.';
      }
      if (flags.dcap) s125Action += ' A dependent care FSA has its own nondiscrimination test.';
      if (flags.healthFsa) s125Action += ' A health FSA has to be written into the cafeteria plan.';
      if (flags.hsa) s125Action += ' Employee pre-tax HSA contributions generally run through the cafeteria plan.';
      cards.push(card({
        key: 'sec125',
        title: 'Section 125 plan',
        status: s125Status,
        exposure: s125Exposure,
        summary: 'Every cafeteria plan needs a written document and nondiscrimination testing.',
        description: 'A premium-only plan is one kind of Section 125 plan. Health FSAs and dependent care FSAs are other kinds. A premium-only plan is treated as passing nondiscrimination if it passes the eligibility test.',
        finding: s125Finding,
        action: s125Action,
        cta: s125Status === 'inPlace' ? null : toolCta('section125', 'Open the Section 125 tool')
      }));
    }

    if (flags.ale === 'ale') {
      cards.push(card({
        key: 'aca_4980h_a',
        title: 'ACA offer penalty',
        status: flags.medicalOffered ? 'confirm' : 'actionNeeded',
        exposure: flags.medicalOffered ? 50 : 96,
        summary: 'One penalty applies when an applicable large employer does not offer coverage to enough full-time employees.',
        description: 'Applicable large employers face two different shared-responsibility penalties. This one is the offer penalty: not offering medical coverage to enough full-time employees.',
        finding: flags.medicalOffered
          ? 'You offer medical coverage. Confirm it is offered widely enough to full-time employees.'
          : 'Medical coverage is not offered, and the group looks like an applicable large employer.',
        action: 'Confirm who is full-time and who received an offer of medical coverage. This is separate from the affordability penalty.',
        cta: flags.medicalOffered ? null : toolCta('quote', 'See group medical quotes')
      }));
      if (flags.medicalOffered) {
        cards.push(card({
          key: 'aca_4980h_b',
          title: 'ACA affordability penalty',
          status: 'confirm',
          exposure: 49,
          summary: 'A second penalty can apply when coverage is unaffordable or not minimum value and a full-time employee gets a premium tax credit.',
          description: 'The affordability penalty is not the same as the offer penalty. It can apply when coverage fails affordability or minimum value and a full-time employee receives a premium tax credit.',
          finding: 'Affordability and minimum value were not confirmed in this checkup.',
          action: 'The affordability measure is indexed. Confirm the current figure and the safe harbor you use with your advisor. Do not rely on a percentage printed in an old checklist.'
        }));
      }
      cards.push(acaReportingCard());
    } else if (flags.ale === 'confirmAle') {
      cards.push(card({
        key: 'confirm_ale',
        title: 'Confirm ALE status',
        status: 'confirm',
        exposure: 78,
        summary: 'Part-time hours can push this group over the applicable large employer line.',
        description: 'For ACA size, part-time hours are combined into full-time equivalents.',
        finding: flags.empCount === '20to49'
          ? 'You reported 20 to 49 full-time employees, with part-time hours that are significant or not confirmed.'
          : 'Full-time headcount is under 20, and part-time hours are significant or not confirmed.',
        action: 'Finish the full-time-equivalent count before you treat the employer mandate as off.',
        cta: toolCta('quote', 'See group medical quotes')
      }));
    } else if (flags.ale === 'confirmSize') {
      cards.push(card({
        key: 'confirm_size',
        title: 'Confirm your size',
        status: 'confirm',
        exposure: 80,
        summary: 'Headcount is not confirmed, so ACA and COBRA both stay open.',
        description: 'ACA size uses full-time equivalents. Federal COBRA uses a different employee count.',
        finding: 'Full-time headcount was marked not sure.',
        action: 'Confirm the counts. Include COBRA in that review if the group may be at 20 employees.',
        cta: toolCta('quote', 'See group medical quotes')
      }));
    }

    if (flags.church) {
      cards.push(card({
        key: 'cobra',
        title: 'Federal COBRA',
        status: 'confirm',
        exposure: 24,
        summary: 'Federal COBRA generally does not apply to church plans.',
        description: 'Church plans are generally outside federal COBRA and outside ERISA. A state rule can still matter.',
        finding: 'You marked the employer as a church.',
        action: 'Confirm with counsel before you build a federal COBRA process. If you are actually a private employer, the 30-day and 14-day notice clocks apply, or 44 days if you administer the plan yourself.',
        links: [link(URLS.qualifyingEvent, 'Qualifying Event Decision Tool', 'Use this when a covered employer has a life event to sort out.')]
      }));
    } else if (flags.empCount === '20to49' || flags.empCount === '50plus' || flags.empCount === 'notSure') {
      var cobraStatus = answers.cobraAdmin === 'noOne' ? 'actionNeeded'
        : answers.cobraAdmin === 'notSure' || !answers.cobraAdmin ? 'confirm' : 'inPlace';
      cards.push(card({
        key: 'cobra',
        title: 'COBRA notices',
        status: cobraStatus,
        exposure: cobraStatus === 'actionNeeded' ? 88 : cobraStatus === 'confirm' ? 54 : 0,
        summary: 'Employer notice in 30 days, election notice in 14 days, or 44 days if you administer COBRA yourself.',
        description: 'The employer notifies the plan administrator within 30 days of a qualifying event. The administrator sends the election notice within 14 days. If the employer is its own administrator, the election notice is due within 44 days of the qualifying event.',
        finding: answers.cobraAdmin === 'noOne'
          ? 'No one is handling COBRA notices.'
          : answers.cobraAdmin === 'notSure' || !answers.cobraAdmin
            ? 'COBRA administration was not confirmed.'
            : 'Someone is assigned to COBRA notices.',
        action: 'Track qualifying events and keep proof of mailing. A general notice also goes to new enrollees. DK Benefits clients get COBRA notice handling at no extra cost, and you keep the 2% admin fee.',
        links: [
          link(URLS.cobraGeneral, 'DOL model general notice', 'For new enrollees.'),
          link(URLS.cobraElection, 'DOL model election notice', 'For qualifying events.'),
          link(URLS.qualifyingEvent, 'Qualifying Event Decision Tool', 'Sort a life event before you send the notice.')
        ]
      }));
    }

    var continuation = stateCard(answers, flags);
    if (continuation) cards.push(continuation);

    if (flags.medicalOffered && answers.medicalFunding === 'notSure') {
      cards.push(card({
        key: 'funding_unsure',
        title: 'Confirm medical funding',
        status: 'confirm',
        exposure: 60,
        summary: 'If the plan is level-funded, self-funded duties apply.',
        description: 'Level-funded plans are legally self-funded. That brings the PCORI fee, Section 105(h) testing, a HIPAA privacy notice, gag-clause confirmation, and a closer look at parity.',
        finding: 'Medical funding was marked not sure.',
        action: 'Ask the carrier whether the contract is fully insured or level-funded. If it is level-funded, treat it as self-funded for those duties.',
        cta: toolCta('rbp', 'Open the RBP decision tool')
      }));
    }

    if (flags.levelFunded || flags.selfFunded) {
      cards.push(card({
        key: 'funding_note',
        title: 'Funding rules',
        status: 'note',
        exposure: 0,
        summary: 'Level-funded plans are legally self-funded, so self-funded rules apply.',
        description: 'Treat a level-funded plan like a self-funded plan for privacy, PCORI, 105(h), and similar duties. A reference-based design is one way some level-funded plans pay claims.',
        finding: flags.levelFunded ? 'You marked the medical plan as level-funded.' : 'You marked the medical plan as self-funded.',
        action: 'Confirm the TPA work order matches those duties.',
        cta: toolCta('rbp', 'Open the RBP decision tool')
      }));
    }

    if (form5500.status === 'required' || form5500.status === 'confirm') {
      var filedBefore = form5500.status === 'required' && flags.hasPrior5500;
      var f5500Status = filedBefore ? 'inPlace' : form5500.status === 'required' ? 'actionNeeded' : 'confirm';
      cards.push(card({
        key: 'form5500',
        title: 'Form 5500',
        status: f5500Status,
        exposure: f5500Status === 'inPlace' ? 0 : form5500.status === 'required' ? 90 : 57,
        summary: flags.hasMewa
          ? 'Confirm your association plan files its Form M-1 and Form 5500.'
          : filedBefore
            ? 'Form 5500 has been filed for this plan. Keep filing it each year.'
            : 'Filing follows enrolled participants, a trust, or a MEWA. It does not follow headcount.',
        description: 'Form 5500 is an annual filing. It is generally required at 100 enrolled participants on the first day of the plan year, when the plan is funded through a trust, or for a MEWA. It is due on the last day of the seventh month after the plan year ends. For a calendar-year plan that is Jul 31. Form 5558 extends that due date by 2.5 months.',
        finding: filedBefore
          ? 'You have filed Form 5500 for this plan before, and a filing is still required.'
          : (form5500.note || 'Confirm whether a filing is required.'),
        action: flags.hasMewa
          ? 'Confirm your association plan files its Form M-1 and Form 5500. The return is due on the last day of the seventh month after the plan year ends. Form 5558 extends that due date by 2.5 months.'
          : 'Count employees enrolled in at least one benefit on the first day of the plan year. Employer-paid life usually means everyone is enrolled. A calendar-year plan is due Jul 31. Form 5558 extends that due date by 2.5 months.',
        links: []
      }));
    }

    if (flags.wellness) {
      cards.push(card({
        key: 'wellness',
        title: 'Wellness program',
        status: 'note',
        exposure: 0,
        summary: 'A wellness program that asks health questions needs its own notice.',
        description: 'Incentive rules and notice duties depend on whether the program asks about health or requires a medical test.',
        finding: 'You offer a wellness program.',
        action: 'Confirm the notice and that any incentive stays inside the current rules.'
      }));
    }

    cards.push(card({
      key: 'section128',
      title: 'Trump Account contributions',
      status: 'note',
      exposure: 0,
      summary: 'Employer contributions to Trump Accounts need a written plan.',
      description: 'If the employer contributes to employees\' Trump Accounts, a written Section 128 program is what documents that design. The employer decides whether to adopt one.',
      finding: 'This is an optional plan design, not a finding that you already contribute.',
      action: 'The Section 128 tool drafts a written program and, when salary reduction is used, a cafeteria-plan amendment. It does not set a contribution amount.',
      cta: toolCta('section128', 'Open the Section 128 tool')
    }));

    return cards;
  }

  function sortCards(cards) {
    var rank = { actionNeeded: 0, confirm: 1, inPlace: 2, note: 3 };
    return cards.slice().sort(function (a, b) {
      var byStatus = (rank[a.status] == null ? 9 : rank[a.status]) - (rank[b.status] == null ? 9 : rank[b.status]);
      if (byStatus) return byStatus;
      return (b.exposure || 0) - (a.exposure || 0);
    });
  }

  function prioritiesFrom(cards) {
    var rank = { actionNeeded: 0, confirm: 1 };
    return cards.filter(function (item) {
      return item.status === 'actionNeeded' || item.status === 'confirm';
    }).sort(function (a, b) {
      var byStatus = rank[a.status] - rank[b.status];
      if (byStatus) return byStatus;
      return (b.exposure || 0) - (a.exposure || 0);
    }).slice(0, 3);
  }

  function calendarStamp(when) {
    var slots = {
      'Oct 15': { month: 10, day: 15 },
      'Dec 31': { month: 12, day: 31 },
      '60 days': { month: 3, day: 1 },
      'Mar 2': { month: 3, day: 2 },
      'Mar 31': { month: 3, day: 31 },
      'Jun 1': { month: 6, day: 1 },
      'Jul 31': { month: 7, day: 31 }
    };
    return slots[when] || { month: 12, day: 28 };
  }

  function sortCalendar(items) {
    var now = new Date();
    var year = now.getFullYear();
    var today = new Date(year, now.getMonth(), now.getDate()).getTime();
    function nextTime(item) {
      var slot = calendarStamp(item.when);
      var when = new Date(year, slot.month - 1, slot.day).getTime();
      if (when < today) when = new Date(year + 1, slot.month - 1, slot.day).getTime();
      return when;
    }
    return items.slice().sort(function (a, b) { return nextTime(a) - nextTime(b); });
  }

  function buildCalendar(answers, flags, form5500) {
    var items = [];
    if (flags.medicalOffered) {
      items.push({ when: 'Oct 15', text: 'Send the Medicare Part D creditable coverage notice.' });
      items.push({ when: '60 days', text: 'Send the Medicare Part D disclosure to CMS within 60 days after the plan year starts.' });
      items.push({ when: 'Jun 1', text: 'RxDC report for the prior calendar year is due.' });
      items.push({ when: 'Dec 31', text: 'Gag clause attestation is due. The carrier usually files it for an insured plan. Self-funded and level-funded plans should confirm it.' });
    }
    if (flags.selfOrLevel || flags.hra) {
      items.push({ when: 'Jul 31', text: 'PCORI fee is due for a self-funded plan or an HRA. Confirm the filing.' });
    }
    if (form5500 && (form5500.status === 'required' || form5500.status === 'confirm')) {
      items.push({ when: 'Jul 31', text: 'Form 5500 is due for a calendar-year plan. Form 5558 extends the due date by 2.5 months.' });
    }
    if (flags.ale === 'ale' || flags.ale === 'confirmAle' || flags.ale === 'confirmSize') {
      items.push({ when: 'Mar 2', text: 'Furnish Form 1095-C in early March, or post the allowed notice, if you are an applicable large employer.' });
    }
    if (flags.ale === 'ale') {
      items.push({ when: 'Mar 31', text: 'IRS e-file for Forms 1094-C and 1095-C is due.' });
    }
    return sortCalendar(items);
  }

  function buildSnapshot(answers, flags, form5500) {
    if (!flags.offersBenefits) {
      var acaValue = flags.ale === 'ale' ? 'Likely applies'
        : flags.ale === 'confirmAle' ? 'Confirm ALE status'
        : flags.ale === 'confirmSize' ? 'Confirm your size'
        : 'Likely does not apply';
      var acaStatus = flags.ale === 'ale' ? 'alert' : flags.ale === 'unlikely' ? 'good' : 'warn';
      var cobraValue = flags.church ? 'Generally does not apply to a church plan'
        : flags.empCount === 'notSure' ? 'Confirm. COBRA may apply'
        : (flags.empCount === '20to49' || flags.empCount === '50plus') ? 'Would apply when benefits start'
        : 'Likely does not apply yet';
      return {
        lines: [
          { label: 'Benefits status', value: 'Not currently offering', status: 'neutral' },
          { label: 'ACA employer mandate', value: acaValue, status: acaStatus },
          { label: 'Federal COBRA', value: cobraValue, status: flags.empCount === 'notSure' ? 'warn' : 'neutral' },
          { label: 'Marketplace notice', value: answers.exchangeNotice === 'yes' ? 'Provided to new hires' : answers.exchangeNotice === 'no' ? 'Not provided' : 'Confirm', status: answers.exchangeNotice === 'yes' ? 'good' : answers.exchangeNotice === 'no' ? 'alert' : 'warn' }
        ],
        alert: flags.ale === 'confirmAle' || flags.ale === 'ale' || flags.ale === 'confirmSize',
        alertText: flags.ale === 'confirmAle' ? 'Confirm ALE status' : flags.ale === 'confirmSize' ? 'Confirm your size' : flags.ale === 'ale' ? 'ACA coverage may be required' : '',
        alertSub: flags.ale === 'confirmAle'
          ? 'Part-time hours count toward full-time equivalents.'
          : flags.ale === 'confirmSize'
            ? 'ACA and COBRA both depend on a count you have not confirmed.'
            : flags.ale === 'ale'
              ? 'Employers at this size are generally subject to the employer mandate.'
              : ''
      };
    }
    var funding = !flags.medicalOffered ? 'Medical not offered'
      : answers.medicalFunding === 'fullyInsured' ? 'Fully insured medical'
      : answers.medicalFunding === 'selfFunded' ? 'Self-funded medical'
      : answers.medicalFunding === 'levelFunded' ? 'Level-funded medical (self-funded rules)'
      : 'Medical funding not confirmed';
    var acaLabel = flags.ale === 'ale' ? 'Likely applies'
      : flags.ale === 'confirmAle' ? 'Confirm ALE status'
      : flags.ale === 'confirmSize' ? 'Confirm your size'
      : 'Likely does not apply';
    var f5500Value = form5500.status === 'required' && flags.hasPrior5500 ? 'In place'
      : form5500.status === 'required' ? 'Likely required'
      : form5500.status === 'notRequired' ? 'Likely not required'
      : form5500.status === 'notApplicable' ? 'Not applicable'
      : 'Confirm';
    return {
      lines: [
        { label: 'Plan type', value: funding, status: flags.medicalOffered ? 'neutral' : 'warn' },
        { label: 'Full-time count', value: flags.empCount === 'under20' ? 'Under 20' : flags.empCount === '20to49' ? '20 to 49' : flags.empCount === '50plus' ? '50 or more' : 'Confirm', status: flags.empCount === 'notSure' ? 'warn' : 'neutral' },
        { label: 'ACA status', value: acaLabel, status: flags.ale === 'unlikely' ? 'good' : flags.ale === 'ale' && flags.medicalOffered ? 'neutral' : 'warn' },
        { label: 'Form 5500', value: f5500Value, status: form5500.status === 'required' && flags.hasPrior5500 ? 'good' : form5500.status === 'required' ? 'alert' : form5500.status === 'notRequired' ? 'good' : 'warn' }
      ],
      alert: flags.ale === 'confirmAle' || (flags.ale === 'ale' && !flags.medicalOffered),
      alertText: flags.ale === 'confirmAle' ? 'Confirm ALE status' : (flags.ale === 'ale' && !flags.medicalOffered) ? 'Medical coverage may be required' : '',
      alertSub: flags.ale === 'confirmAle' ? 'Part-time hours count toward full-time equivalents.' : ''
    };
  }

  function answerSummary(answers) {
    var lines = [];
    questions.forEach(function (q) {
      if (q.showIf && !q.showIf(answers)) return;
      var value = answers[q.id];
      if (blank(value)) return;
      var label = value;
      if (Array.isArray(value)) {
        label = value.map(function (item) {
          var opt = null;
          q.options.forEach(function (option) { if (option.value === item) opt = option; });
          return opt ? opt.label : item;
        }).join(', ');
      } else {
        q.options.forEach(function (option) { if (option.value === value) label = option.label; });
      }
      lines.push(q.text + ' ' + label);
    });
    return lines.join('\n');
  }

  function scoreAnswers(answers) {
    answers = answers || {};
    var flags = deriveFlags(answers);
    var form5500 = determineForm5500(answers, flags);
    var readiness = computeReadiness(answers, flags, form5500);
    var cards = sortCards(buildCards(answers, flags, form5500));
    var priorities = prioritiesFrom(cards);
    return {
      version: VERSION,
      flags: flags,
      form5500: form5500,
      readiness: readiness,
      snapshot: buildSnapshot(answers, flags, form5500),
      priorities: priorities,
      cards: cards,
      calendar: buildCalendar(answers, flags, form5500),
      summary: answerSummary(answers)
    };
  }

  function visibleQuestions(answers) {
    return questions.filter(function (q) { return !q.showIf || q.showIf(answers || {}); });
  }

  function aboutStepCount(answers) {
    return Math.max(visibleQuestions(answers).length, 1);
  }

  function stepProgress(answers, index) {
    var total = aboutStepCount(answers);
    var step = (index || 0) + 1;
    if (step < 1) step = 1;
    if (step > total) step = total;
    return { step: step, total: total };
  }

  function copyBlob() {
    var parts = [];
    questions.forEach(function (q) {
      parts.push(q.text, q.helper || '');
      q.options.forEach(function (opt) { parts.push(opt.label); });
    });
    return parts.join('\n');
  }

  return {
    VERSION: VERSION,
    URLS: URLS,
    READINESS_BANDS: READINESS_BANDS,
    questions: questions,
    scoreAnswers: scoreAnswers,
    readinessFor: readinessFor,
    visibleQuestions: visibleQuestions,
    aboutStepCount: aboutStepCount,
    stepProgress: stepProgress,
    deriveFlags: deriveFlags,
    determineForm5500: determineForm5500,
    copyBlob: copyBlob,
    answerSummary: answerSummary
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DKQuiz;
