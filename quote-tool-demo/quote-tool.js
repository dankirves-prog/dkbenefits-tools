const questionHost = document.getElementById('questionHost');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const heroStartBtn = document.getElementById('heroStartBtn');
const funnelSection = document.getElementById('funnelSection');
const resultsSection = document.getElementById('resultsSection');
const resultsSummary = document.getElementById('resultsSummary');
const participationNote = document.getElementById('participationNote');
const heroAsideTitle = document.getElementById('heroAsideTitle');
const heroAsideList = document.getElementById('heroAsideList');
const heroAsideLinks = document.getElementById('heroAsideLinks');

const employerContribution = document.getElementById('employerContribution');
const contributionLabel = document.getElementById('contributionLabel');
const flatContributionSelect = document.getElementById('flatContributionSelect');
const flatContributionCustom = document.getElementById('flatContributionCustom');
const flatLabel = document.getElementById('flatLabel');
const percentControl = document.getElementById('percentControl');
const flatControl = document.getElementById('flatControl');
const contribModelWrap = document.getElementById('contribModelWrap');

const mixEe = document.getElementById('mixEe');
const mixEs = document.getElementById('mixEs');
const mixEc = document.getElementById('mixEc');
const mixFam = document.getElementById('mixFam');
const mixNote = document.getElementById('mixNote');

const topPlansGrid = document.getElementById('topPlansGrid');
const lowCostPlansGrid = document.getElementById('lowCostPlansGrid');
const mecPlansGrid = document.getElementById('mecPlansGrid');
const mecPlansWrap = document.getElementById('mecPlansWrap');
const toggleMecBtn = document.getElementById('toggleMecBtn');
const sortOptions = document.getElementById('sortOptions');

const editAnswersBtn = document.getElementById('editAnswersBtn');
const startOverBtn = document.getElementById('startOverBtn');
const leadForm = document.getElementById('leadForm');
const leadSuccess = document.getElementById('leadSuccess');
const leadError = document.getElementById('leadError');
const firstName = document.getElementById('firstName');
const email = document.getElementById('email');
const phone = document.getElementById('phone');
const leadWebhookUrl = 'https://script.google.com/macros/s/AKfycby4-ZxTQfsAgIBO0JYSngccVoj5HRKtNshy6N2XlJhbxaEk2oW7b_xIRBGlcSq0CZ0z/exec';

const plans = [
  {
    id: 'cigna-epo-1000',
    group: 'top',
    name: 'Cigna EPO 1000',
    network: 'Utilizes Cigna network',
    typeBadge: 'Strong Network',
    rates: { employeeOnly: 459, employeeSpouse: 779, employeeChildren: 769, family: 1079 },
    details: { deductible: '$1,000', oopMax: '$8,500', pcp: '$50 after deductible', specialist: '$50 after deductible', urgentCare: '$50', rx: 'Generic $0' },
    notes: ['Richer first-dollar structure with deductible-aware office visit treatment.']
  },
  {
    id: 'cigna-epo-1750-hsa',
    group: 'top',
    name: 'Cigna EPO 1750 HSA',
    network: 'Utilizes Cigna network',
    typeBadge: 'HSA Friendly',
    rates: { employeeOnly: 414, employeeSpouse: 739, employeeChildren: 729, family: 1009 },
    details: { deductible: '$1,750', oopMax: '$8,500', pcp: 'Deductible then plan share', specialist: 'Deductible then plan share', urgentCare: 'Deductible then plan share', rx: 'HSA-compatible structure' },
    notes: ['Lower monthly rate profile with deductible-first plan behavior.']
  },
  {
    id: 'phcs-ppo-8300-hsa',
    group: 'top',
    name: 'PHCS PPO 8300 HSA',
    network: 'Utilizes PHCS PPO network',
    typeBadge: 'HSA Friendly',
    rates: { employeeOnly: 499.01, employeeSpouse: 859.47, employeeChildren: 969.62, family: 1214.63 },
    details: { deductible: '$8,300', oopMax: '$9,100', pcp: 'Deductible then coinsurance', specialist: 'Deductible then coinsurance', urgentCare: 'Deductible then coinsurance', rx: 'Integrated with deductible' },
    notes: ['Best fit for groups prioritizing lower fixed premiums and high-deductible design.']
  },
  {
    id: 'phcs-ppo-4500',
    group: 'top',
    name: 'PHCS PPO 4500 Copay',
    network: 'Utilizes PHCS PPO network',
    typeBadge: 'Richer Benefits',
    rates: { employeeOnly: 649.8, employeeSpouse: 1339.23, employeeChildren: 1213.73, family: 1796.94 },
    details: { deductible: '$4,500', oopMax: '$9,100', pcp: '$40', specialist: '$75', urgentCare: '$90', rx: 'Tiered copay Rx' },
    notes: ['Balanced PPO option with stronger copay predictability.']
  },
  {
    id: 'phcs-ppo-3500',
    group: 'top',
    name: 'PHCS PPO 3500 Copay',
    network: 'Utilizes PHCS PPO network',
    typeBadge: 'Richer Benefits',
    rates: { employeeOnly: 749.9, employeeSpouse: 1415.49, employeeChildren: 1379.88, family: 2071.67 },
    details: { deductible: '$3,500', oopMax: '$8,700', pcp: '$40', specialist: '$75', urgentCare: '$90', rx: 'Tiered copay Rx' },
    notes: ['Higher premium in exchange for richer deductible and benefit posture.']
  },
  {
    id: 'phcs-ppo-4500-option',
    group: 'top',
    name: 'PHCS PPO 4500 Copay Option',
    network: 'Utilizes PHCS PPO network',
    typeBadge: 'Strong Network',
    rates: { employeeOnly: 697.12, employeeSpouse: 1364.23, employeeChildren: 1247.86, family: 1816.47 },
    details: { deductible: '$4,500', oopMax: '$9,100', pcp: '$40', specialist: '$75', urgentCare: '$90', rx: '$20 / $65 / $95' },
    notes: ['Alternative 4500-lane option for comparison within PHCS PPO structures.']
  },
  {
    id: 'phcs-ppo-3500-option',
    group: 'top',
    name: 'PHCS PPO 3500 Copay Option',
    network: 'Utilizes PHCS PPO network',
    typeBadge: 'Strong Network',
    rates: { employeeOnly: 789.94, employeeSpouse: 1434.95, employeeChildren: 1401.93, family: 2071.22 },
    details: { deductible: '$3,500', oopMax: '$8,700', pcp: '$40', specialist: '$75', urgentCare: '$90', rx: 'Tiered copay Rx' },
    notes: ['Alternative richer-design PPO option for side-by-side planning.']
  },
  {
    id: 'phcs-lower-cost-choice',
    group: 'low',
    name: 'PHCS Lower Cost Choice',
    network: 'Utilizes PHCS network',
    typeBadge: 'Lower Cost',
    rates: { employeeOnly: 198.9, employeeSpouse: 290.7, employeeChildren: 290.7, family: 402.9 },
    details: { deductible: 'Limited schedule', oopMax: 'Not equivalent to major medical OOP', pcp: '$35', specialist: 'Limited visits', urgentCare: 'Limited fixed benefits', rx: 'Limited Rx schedule' },
    notes: ['This is not traditional major medical coverage. It may be useful in the right situation, but benefits are limited.'],
    limitedNotes: ['may not cover hospital care', 'may limit doctor/specialist visits', 'may limit imaging, ER, ambulance, or surgery benefits', 'may not cover brand-name drugs depending on the plan']
  },
  {
    id: 'phcs-lower-cost-care',
    group: 'low',
    name: 'PHCS Lower Cost Care',
    network: 'Utilizes PHCS network',
    typeBadge: 'Participation Helper',
    rates: { employeeOnly: 292.7, employeeSpouse: 417.5, employeeChildren: 386.09, family: 510.89 },
    details: { deductible: 'Limited schedule', oopMax: 'Not equivalent to major medical OOP', pcp: '$25', specialist: 'Limited visit structure', urgentCare: 'Includes select outpatient support', rx: 'Restricted Rx categories' },
    notes: ['This is not traditional major medical coverage. It may be useful in the right situation, but benefits are limited.'],
    limitedNotes: ['may not cover hospital care', 'may limit doctor/specialist visits', 'may limit imaging, ER, ambulance, or surgery benefits', 'may not cover brand-name drugs depending on the plan']
  },
  {
    id: 'phcs-visit-limit-1000',
    group: 'low',
    name: 'PHCS Visit Limit 1000',
    network: 'Utilizes PHCS network',
    typeBadge: 'Lower Cost',
    rates: { employeeOnly: 374, employeeSpouse: 679, employeeChildren: 669, family: 959 },
    details: { deductible: '$1,000 equivalent schedule', oopMax: 'Limited by plan schedule', pcp: 'Limited visit plan', specialist: 'Limited visit plan', urgentCare: 'Limited visit plan', rx: 'Select generic support' },
    notes: ['This is not traditional major medical coverage. It may be useful in the right situation, but benefits are limited.'],
    limitedNotes: ['may not cover hospital care', 'may limit doctor/specialist visits', 'may limit imaging, ER, ambulance, or surgery benefits', 'may not cover brand-name drugs depending on the plan']
  },
  {
    id: 'phcs-visit-limit-1750-hsa',
    group: 'low',
    name: 'PHCS Visit Limit 1750 HSA',
    network: 'Utilizes PHCS network',
    typeBadge: 'HSA Friendly',
    rates: { employeeOnly: 334, employeeSpouse: 639, employeeChildren: 629, family: 889 },
    details: { deductible: '$1,750 equivalent schedule', oopMax: 'Limited by plan schedule', pcp: 'Limited visit HSA style', specialist: 'Limited visit HSA style', urgentCare: 'Limited visit HSA style', rx: 'Restricted Rx support' },
    notes: ['This is not traditional major medical coverage. It may be useful in the right situation, but benefits are limited.'],
    limitedNotes: ['may not cover hospital care', 'may limit doctor/specialist visits', 'may limit imaging, ER, ambulance, or surgery benefits', 'may not cover brand-name drugs depending on the plan']
  },
  {
    id: 'minimum-essential-coverage',
    group: 'mec',
    name: 'Minimum Essential Coverage',
    network: 'Utilizes PHCS network',
    typeBadge: 'Preventive Focused',
    rates: { employeeOnly: 127.5, employeeSpouse: 193.8, employeeChildren: 193.8, family: 260.1 },
    details: { deductible: 'Preventive-focused schedule', oopMax: 'Not traditional major medical OOP structure', pcp: 'Preventive-focused', specialist: 'Limited/non-core', urgentCare: 'Limited/non-core', rx: 'Preventive/Rx limitations apply' },
    notes: ['This is not traditional major medical coverage. It may be useful in the right situation, but benefits are limited.'],
    limitedNotes: ['may not cover hospital care', 'may limit doctor/specialist visits', 'may limit imaging, ER, ambulance, or surgery benefits', 'may not cover brand-name drugs depending on the plan']
  }
];

const questions = [
  { key: 'state', title: 'What state is your business located in?', kind: 'select', options: [{ label: 'Florida', value: 'Florida' }, { label: 'Georgia', value: 'Georgia' }] },
  { key: 'employees', title: 'How many full-time employees are benefits eligible?', kind: 'number', placeholder: 'Example: 12' },
  { key: 'enrolling', title: 'How many do you expect to enroll?', kind: 'number', placeholder: 'Example: 8' },
  { key: 'priority', title: 'What matters most right now?', kind: 'choice', options: [{ label: 'Lower monthly cost', value: 'cost' }, { label: 'Balanced value', value: 'balanced' }, { label: 'Broad network access', value: 'network' }, { label: 'HSA-friendly option', value: 'hsa' }] },
  { key: 'coverage', title: 'Do you currently offer a group health plan?', kind: 'choice', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] },
  { key: 'timeline', title: 'When are you hoping to start?', kind: 'choice', options: [{ label: 'Next 30 days', value: '30' }, { label: '1-3 months', value: '90' }, { label: '3+ months', value: 'later' }] }
];

let current = 0;
let contributionModel = 'percent';
let sortMode = 'recommended';
const answers = {};
const selectedPlans = new Map();

const heroAsideContent = {
  default: {
    title: 'What you’ll walk away with',
    bullets: [
      'Real current starting rates, not placeholders',
      'Employer contribution modeling',
      'Employee payroll share estimates',
      'Network and benefit comparisons',
      'A real broker to contact when ready'
    ],
    showLinks: false
  },
  state: {
    title: 'Why we ask this',
    bullets: [
      'State helps narrow plan availability.',
      'This version is focused on Florida and Georgia employers.'
    ],
    showLinks: false
  },
  employees: {
    title: 'Why we ask this',
    bullets: [
      'Group size helps determine which options may be available.',
      'No company name or employee details are needed.'
    ],
    showLinks: false
  },
  enrolling: {
    title: 'Why we ask this',
    bullets: [
      'Expected enrollment helps estimate participation and monthly cost.',
      'If you are close to qualifying, we can help review the best path.'
    ],
    showLinks: false
  },
  priority: {
    title: 'Why we ask this',
    bullets: [
      'Your priority helps organize the options.',
      'It does not lock you into one plan or strategy.'
    ],
    showLinks: false
  },
  coverage: {
    title: 'Why we ask this',
    bullets: [
      'Current coverage helps determine whether published rates may apply right away or need review.',
      'These are still real planning rates, not fake placeholders.'
    ],
    showLinks: false
  },
  timeline: {
    title: 'Why we ask this',
    bullets: [
      'Timing helps determine how quickly rates and effective dates need to be verified.',
      'You can call or text Daniel when you are ready.'
    ],
    showLinks: false
  },
  results: {
    title: 'Ready for the next step?',
    bullets: [
      'Many groups qualify for rates like these',
      'Daniel can help verify eligibility',
      'Additional market options may be available',
      'Call, text, or email when ready'
    ],
    showLinks: true
  }
};

function money(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

function estimateSmartMix(enrolling) {
  const employeeOnly = Math.max(1, Math.round(enrolling * 0.55));
  const employeeSpouse = Math.round(enrolling * 0.15);
  const employeeChildren = Math.round(enrolling * 0.2);
  const family = Math.max(0, enrolling - employeeOnly - employeeSpouse - employeeChildren);
  return { employeeOnly, employeeSpouse, employeeChildren, family };
}

function calcGrossPremium(rates, mix) {
  return (
    mix.employeeOnly * rates.employeeOnly +
    mix.employeeSpouse * rates.employeeSpouse +
    mix.employeeChildren * rates.employeeChildren +
    mix.family * rates.family
  );
}

function getFlatAmount() {
  return flatContributionSelect.value === 'custom' ? Number(flatContributionCustom.value || 0) : Number(flatContributionSelect.value || 0);
}

function getTierMix(enrolling) {
  const mix = {
    employeeOnly: Number(mixEe.value || 0),
    employeeSpouse: Number(mixEs.value || 0),
    employeeChildren: Number(mixEc.value || 0),
    family: Number(mixFam.value || 0)
  };

  const totalEntered = mix.employeeOnly + mix.employeeSpouse + mix.employeeChildren + mix.family;
  if (totalEntered === 0) {
    const smart = estimateSmartMix(enrolling);
    mixNote.textContent = `Using smart estimated mix because no tier mix was entered (${smart.employeeOnly}/${smart.employeeSpouse}/${smart.employeeChildren}/${smart.family}).`;
    return smart;
  }

  if (totalEntered !== enrolling) {
    mixNote.textContent = `Tier mix totals ${totalEntered}. Expected enrolling is ${enrolling}; estimates use your entered mix.`;
  } else {
    mixNote.textContent = 'Based on estimated enrollment mix entered above.';
  }

  return mix;
}

function setInitialMix(enrolling) {
  const smart = estimateSmartMix(enrolling);
  mixEe.value = smart.employeeOnly;
  mixEs.value = smart.employeeSpouse;
  mixEc.value = smart.employeeChildren;
  mixFam.value = smart.family;
  mixNote.textContent = 'Based on estimated enrollment mix entered above.';
}

function updateModelUI() {
  contribModelWrap.querySelectorAll('.model-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.model === contributionModel);
  });
  percentControl.classList.toggle('hidden', contributionModel !== 'percent');
  flatControl.classList.toggle('hidden', contributionModel !== 'flat');
}

function updateHeroAside(mode) {
  const config = heroAsideContent[mode] || heroAsideContent.default;
  heroAsideTitle.textContent = config.title;
  heroAsideList.innerHTML = config.bullets.map((item) => `<li>${item}</li>`).join('');
  heroAsideLinks.classList.toggle('hidden', !config.showLinks);
}

function parseFirstDollar(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const match = String(value).match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1].replace(/,/g, ''));
}

function sortPlansByMode(planList, mix) {
  const list = [...planList];
  if (sortMode === 'recommended') return list;

  const direction = sortMode === 'highestEmployer' ? -1 : 1;
  return list.sort((a, b) => {
    const grossA = calcGrossPremium(a.rates, mix);
    const grossB = calcGrossPremium(b.rates, mix);
    const employerA = calculateEmployerCost(a, mix, grossA);
    const employerB = calculateEmployerCost(b, mix, grossB);
    const deductibleA = parseFirstDollar(a.details.deductible);
    const deductibleB = parseFirstDollar(b.details.deductible);
    const oopA = parseFirstDollar(a.details.oopMax);
    const oopB = parseFirstDollar(b.details.oopMax);

    if (sortMode === 'lowestEmployer' || sortMode === 'highestEmployer') return direction * (employerA - employerB);
    if (sortMode === 'lowestGross') return grossA - grossB;
    if (sortMode === 'lowestDeductible') return deductibleA - deductibleB;
    if (sortMode === 'lowestOop') return oopA - oopB;
    return 0;
  });
}

function getCurrentTierMix() {
  const enrolling = Number(answers.enrolling || 1);
  return getTierMix(enrolling);
}

function getVisiblePlans() {
  const enrolling = Number(answers.enrolling || 1);
  const mix = getCurrentTierMix(enrolling);
  const topPlans = sortPlansByMode(plans.filter((p) => p.group === 'top'), mix);
  const lowPlans = sortPlansByMode(plans.filter((p) => p.group === 'low'), mix);
  const mecPlans = sortPlansByMode(plans.filter((p) => p.group === 'mec'), mix);
  const mecVisible = mecPlansWrap.classList.contains('hidden') ? [] : mecPlans;
  return [...topPlans, ...lowPlans, ...mecVisible].map((plan) => ({
    id: plan.id,
    name: plan.name,
    network: plan.network,
    typeBadge: plan.typeBadge
  }));
}

function renderQuestion() {
  const q = questions[current];
  const value = answers[q.key] || '';

  const control = q.kind === 'select'
    ? `<select id="qInput">${q.options.map((opt) => `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}</select>`
    : q.kind === 'number'
      ? `<input id="qInput" type="number" min="1" value="${value}" placeholder="${q.placeholder || ''}" />`
      : `<div class="option-grid">${q.options.map((opt) => `<button type="button" class="option-pill ${value === opt.value ? 'selected' : ''}" data-choice="${opt.value}">${opt.label}</button>`).join('')}</div>`;

  questionHost.innerHTML = `<article class="question active"><h3>${q.title}</h3>${control}</article>`;

  if (q.kind === 'choice') {
    questionHost.querySelectorAll('.option-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        answers[q.key] = btn.dataset.choice;
        renderQuestion();
      });
    });
  }
  if (q.kind === 'select') {
    const select = document.getElementById('qInput');
    select.addEventListener('change', () => {
      answers[q.key] = select.value;
      renderQuestion();
    });
  }

  progressBar.style.width = `${((current + 1) / questions.length) * 100}%`;
  progressText.textContent = `Question ${current + 1} of ${questions.length}`;
  backBtn.disabled = current === 0;
  nextBtn.textContent = current === questions.length - 1 ? 'See Real Rates Now' : 'Continue';
  updateHeroAside(q.key);
}

function readAnswer() {
  const q = questions[current];
  if (q.kind === 'choice') return;
  const input = document.getElementById('qInput');
  answers[q.key] = input ? input.value.trim() : '';
}

function validateCurrent() {
  const q = questions[current];
  const value = answers[q.key];
  if (!value) return false;
  if (q.kind === 'number') return Number(value) > 0;
  return true;
}

function calculateEmployerCost(plan, mix, grossPremium) {
  const totalEnrolling = mix.employeeOnly + mix.employeeSpouse + mix.employeeChildren + mix.family;

  if (contributionModel === 'percent') {
    const basePerEmployee = plan.rates.employeeOnly * (Number(employerContribution.value) / 100);
    const employer =
      mix.employeeOnly * Math.min(basePerEmployee, plan.rates.employeeOnly) +
      mix.employeeSpouse * Math.min(basePerEmployee, plan.rates.employeeSpouse) +
      mix.employeeChildren * Math.min(basePerEmployee, plan.rates.employeeChildren) +
      mix.family * Math.min(basePerEmployee, plan.rates.family);
    return Math.min(employer, grossPremium, basePerEmployee * totalEnrolling);
  }

  const flatPerEmployee = getFlatAmount();
  const employer =
    mix.employeeOnly * Math.min(flatPerEmployee, plan.rates.employeeOnly) +
    mix.employeeSpouse * Math.min(flatPerEmployee, plan.rates.employeeSpouse) +
    mix.employeeChildren * Math.min(flatPerEmployee, plan.rates.employeeChildren) +
    mix.family * Math.min(flatPerEmployee, plan.rates.family);

  return Math.min(employer, grossPremium, flatPerEmployee * totalEnrolling);
}

function renderPlanCard(plan, mix) {
  const grossPremium = calcGrossPremium(plan.rates, mix);
  const employer = calculateEmployerCost(plan, mix, grossPremium);
  const employee = grossPremium - employer;

  const limitationsHtml = plan.limitedNotes
    ? `<div class="limit-note">${plan.limitedNotes.map((n) => `<div>${n}</div>`).join('')}</div>`
    : '<div class="limit-note">Coverage and access tradeoffs vary by option and should be reviewed against your goals.</div>';

  const notesHtml = `${plan.notes.map((n) => `<div>${n}</div>`).join('')}<div>${plan.network}</div>`;

  return `
    <article class="plan-card">
      <div class="plan-head">
        <div>
          <h3>${plan.name}</h3>
          <p class="plan-meta">${plan.network}</p>
        </div>
        <div class="plan-head-side">
          <label class="interest-toggle top">
            <input type="checkbox" class="plan-interest" data-plan-id="${plan.id}" ${selectedPlans.has(plan.id) ? 'checked' : ''} />
            <span>Interested</span>
          </label>
          <span class="badge">${plan.typeBadge}</span>
        </div>
      </div>

      <div class="card-section">
        <h4>Rates</h4>
        <div class="metric-row employer">
          <strong>Estimated Employer Monthly Cost</strong>
          <div class="big-number">${money(employer)}</div>
        </div>
        <div class="metric-row"><strong>Gross Monthly Premium:</strong> ${money(grossPremium)}</div>
        <div class="metric-row"><strong>Estimated Employee Monthly Share:</strong> ${money(employee)}</div>

        <ul class="benefit-list">
          <li><span>Employee Only</span><strong>${money(plan.rates.employeeOnly)}</strong></li>
          <li><span>Employee + Spouse</span><strong>${money(plan.rates.employeeSpouse)}</strong></li>
          <li><span>Employee + Child(ren)</span><strong>${money(plan.rates.employeeChildren)}</strong></li>
          <li><span>Family</span><strong>${money(plan.rates.family)}</strong></li>
        </ul>
      </div>

      <div class="card-section">
        <h4>Benefits</h4>
        <ul class="benefit-list">
          <li><span>Deductible</span><strong>${plan.details.deductible}</strong></li>
          <li><span>Out-of-Pocket Max</span><strong>${plan.details.oopMax}</strong></li>
          <li><span>PCP</span><strong>${plan.details.pcp}</strong></li>
          <li><span>Specialist</span><strong>${plan.details.specialist}</strong></li>
          <li><span>Urgent Care</span><strong>${plan.details.urgentCare}</strong></li>
          <li><span>RX Summary</span><strong>${plan.details.rx}</strong></li>
        </ul>
      </div>

      <div class="card-section">
        <h4>Important Notes</h4>
        <div class="limit-note">${notesHtml}</div>
        ${limitationsHtml}
      </div>

      <p class="card-note">Based on estimated enrollment mix entered above.</p>
    </article>
  `;
}

function updateParticipationNote() {
  const eligible = Number(answers.employees || 0);
  const enrolling = Number(answers.enrolling || 0);
  const minParticipation = Math.max(3, Math.ceil(eligible * 0.5));

  if (!eligible || !enrolling) {
    participationNote.classList.add('hidden');
    return;
  }

  if (enrolling <= minParticipation) {
    participationNote.textContent = 'Based on your entries, some options may need additional review or additional enrollment to qualify. We’ll still show useful starting points and can help you identify the best path.';
    participationNote.classList.remove('hidden');
    return;
  }

  participationNote.classList.add('hidden');
}

function renderResults() {
  const enrolling = Number(answers.enrolling || 1);
  const employees = Number(answers.employees || enrolling);
  const mix = getTierMix(enrolling);

  contributionLabel.textContent = `${employerContribution.value}%`;
  flatLabel.textContent = money(getFlatAmount());
  resultsSummary.textContent = `${answers.state || 'Your state'} · ${employees} eligible employees · about ${enrolling} enrolling. These are real current starting rates based on the information provided.`;

  updateParticipationNote();

  const topPlans = sortPlansByMode(plans.filter((p) => p.group === 'top'), mix);
  const lowPlans = sortPlansByMode(plans.filter((p) => p.group === 'low'), mix);
  const mecPlans = sortPlansByMode(plans.filter((p) => p.group === 'mec'), mix);

  topPlansGrid.innerHTML = topPlans.map((plan) => renderPlanCard(plan, mix)).join('');
  lowCostPlansGrid.innerHTML = lowPlans.map((plan) => renderPlanCard(plan, mix)).join('');
  mecPlansGrid.innerHTML = mecPlans.map((plan) => renderPlanCard(plan, mix)).join('');

  document.querySelectorAll('.plan-interest').forEach((input) => {
    input.addEventListener('change', () => {
      const planId = input.dataset.planId;
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return;
      if (input.checked) {
        selectedPlans.set(plan.id, {
          id: plan.id,
          name: plan.name,
          network: plan.network,
          typeBadge: plan.typeBadge,
          rates: plan.rates
        });
      } else {
        selectedPlans.delete(plan.id);
      }
    });
  });

  updateHeroAside('results');
}

function resetLeadForm() {
  leadForm.reset();
  firstName.value = '';
  email.value = '';
  phone.value = '';
  leadForm.classList.remove('hidden');
  leadSuccess.classList.add('hidden');
  leadError.classList.add('hidden');
}

function startOver() {
  Object.keys(answers).forEach((key) => delete answers[key]);
  selectedPlans.clear();
  answers[questions[0].key] = questions[0].options[0].value;
  current = 0;

  contributionModel = 'percent';
  sortMode = 'recommended';
  sortOptions.value = 'recommended';
  employerContribution.value = 50;
  flatContributionSelect.value = '300';
  flatContributionCustom.value = '';
  flatContributionCustom.classList.add('hidden');
  mixEe.value = '';
  mixEs.value = '';
  mixEc.value = '';
  mixFam.value = '';
  mixNote.textContent = '';
  participationNote.classList.add('hidden');
  updateModelUI();

  mecPlansWrap.classList.add('hidden');
  toggleMecBtn.textContent = 'Show MEC Section';

  resetLeadForm();

  resultsSection.classList.add('hidden');
  funnelSection.classList.remove('hidden');
  renderQuestion();
}

nextBtn.addEventListener('click', () => {
  readAnswer();
  if (!validateCurrent()) {
    alert('Please answer this question before continuing.');
    return;
  }

  if (current === questions.length - 1) {
    const enrolling = Number(answers.enrolling || 1);
    setInitialMix(enrolling);
    funnelSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    renderResults();
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  current += 1;
  renderQuestion();
});

backBtn.addEventListener('click', () => {
  readAnswer();
  if (current > 0) {
    current -= 1;
    renderQuestion();
  }
});

heroStartBtn.addEventListener('click', () => {
  funnelSection.scrollIntoView({ behavior: 'smooth' });
});

contribModelWrap.addEventListener('click', (event) => {
  const btn = event.target.closest('.model-btn');
  if (!btn) return;
  contributionModel = btn.dataset.model;
  updateModelUI();
  renderResults();
});

employerContribution.addEventListener('input', renderResults);
flatContributionSelect.addEventListener('change', () => {
  flatContributionCustom.classList.toggle('hidden', flatContributionSelect.value !== 'custom');
  renderResults();
});
flatContributionCustom.addEventListener('input', renderResults);
[mixEe, mixEs, mixEc, mixFam].forEach((input) => input.addEventListener('input', renderResults));

editAnswersBtn.addEventListener('click', () => {
  resultsSection.classList.add('hidden');
  funnelSection.classList.remove('hidden');
  current = 0;
  renderQuestion();
  funnelSection.scrollIntoView({ behavior: 'smooth' });
});

startOverBtn.addEventListener('click', startOver);

sortOptions.addEventListener('change', () => {
  sortMode = sortOptions.value;
  if (!resultsSection.classList.contains('hidden')) {
    renderResults();
  }
});

toggleMecBtn.addEventListener('click', () => {
  mecPlansWrap.classList.toggle('hidden');
  toggleMecBtn.textContent = mecPlansWrap.classList.contains('hidden') ? 'Show MEC Section' : 'Hide MEC Section';
});

leadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!firstName.value.trim() || !email.value.trim()) {
    alert('Please add your first name and work email.');
    return;
  }
  const tierMix = getCurrentTierMix();
  const leadPayload = {
    firstName: firstName.value.trim(),
    email: email.value.trim(),
    phone: phone.value.trim(),
    answers: { ...answers },
    tierMix,
    contribution: {
      model: contributionModel,
      percent: contributionModel === 'percent' ? Number(employerContribution.value) : null,
      flatDollar: contributionModel === 'flat' ? getFlatAmount() : null
    },
    selectedPlans: Array.from(selectedPlans.values()),
    visiblePlans: getVisiblePlans(),
    submittedAt: new Date().toISOString(),
    pageUrl: window.location.href
  };
  console.log('DK Benefits lead payload:', leadPayload);
  leadError.classList.add('hidden');

  try {
    const response = await fetch(leadWebhookUrl, {
      method: 'POST',
      body: JSON.stringify(leadPayload)
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}: ${responseText}`);
    }

    leadSuccess.classList.remove('hidden');
    leadForm.classList.add('hidden');
  } catch (error) {
    console.error('Lead webhook error:', error);
    leadError.classList.remove('hidden');
  }
});

answers[questions[0].key] = questions[0].options[0].value;
updateModelUI();
renderQuestion();
