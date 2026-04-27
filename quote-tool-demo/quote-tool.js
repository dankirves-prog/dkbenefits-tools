const questionHost = document.getElementById('questionHost');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const funnelSection = document.getElementById('funnelSection');
const resultsSection = document.getElementById('resultsSection');
const resultsSummary = document.getElementById('resultsSummary');

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

const editAnswersBtn = document.getElementById('editAnswersBtn');
const startOverBtn = document.getElementById('startOverBtn');
const leadForm = document.getElementById('leadForm');
const leadSuccess = document.getElementById('leadSuccess');
const firstName = document.getElementById('firstName');
const email = document.getElementById('email');
const phone = document.getElementById('phone');

const plans = [
  {
    id: 'xgb-cigna-1000',
    group: 'top',
    name: 'XGB Cigna EPO 1000',
    network: 'Cigna EPO',
    typeBadge: 'Major Medical',
    rates: { ee: 459, es: 905, ec: 815, fam: 1250 },
    details: {
      employeeRate: '$459',
      deductible: '$1,000',
      oopMax: '$8,500',
      pcp: '$50 after deductible',
      specialist: '$50 after deductible',
      urgentCare: '$50',
      rx: 'Generic $0'
    }
  },
  {
    id: 'xgb-cigna-1750-hsa',
    group: 'top',
    name: 'XGB Cigna EPO 1750 HSA',
    network: 'Cigna EPO',
    typeBadge: 'HSA',
    rates: { ee: 414, es: 830, ec: 745, fam: 1150 },
    details: {
      employeeRate: '$414',
      deductible: '$1,750',
      oopMax: '$8,500',
      pcp: 'Deductible then plan share',
      specialist: 'Deductible then plan share',
      urgentCare: 'Deductible then plan share',
      rx: 'HSA-compatible structure'
    }
  },
  {
    id: 'ep-4500-copay',
    group: 'top',
    name: 'EnrollPrime 4500 Copay',
    network: 'EnrollPrime PPO',
    typeBadge: 'Major Medical',
    rates: { ee: 697.12, es: 1320, ec: 1215, fam: 1850 },
    details: {
      employeeRate: '$697.12',
      deductible: '$4,500',
      oopMax: '$9,100',
      pcp: '$40',
      specialist: '$75',
      urgentCare: '$90',
      rx: '$20 / $65 / $95'
    }
  },
  {
    id: 'ep-3500-copay',
    group: 'top',
    name: 'EnrollPrime 3500 Copay',
    network: 'EnrollPrime PPO',
    typeBadge: 'Major Medical',
    rates: { ee: 789.94, es: 1475, ec: 1360, fam: 2085 },
    details: {
      employeeRate: '$789.94',
      deductible: '$3,500',
      oopMax: '$8,700',
      pcp: '$40',
      specialist: '$75',
      urgentCare: '$90',
      rx: 'Tiered Rx with copays'
    }
  },
  {
    id: 'ep-choice',
    group: 'low',
    name: 'EnrollPrime Choice',
    network: 'EnrollPrime Value',
    typeBadge: 'Budget Option',
    rates: { ee: 198.9, es: 376, ec: 334, fam: 505 },
    details: {
      employeeRate: '$198.90',
      deductible: 'Limited schedule',
      oopMax: 'Not equivalent to major medical OOP',
      pcp: '$35',
      specialist: 'Limited visits',
      urgentCare: 'Limited fixed benefits',
      rx: 'Limited Rx schedule'
    },
    limitedNotes: ['This is limited coverage, not traditional major medical.', 'May not cover hospital care.']
  },
  {
    id: 'ep-care',
    group: 'low',
    name: 'EnrollPrime Care',
    network: 'EnrollPrime Care Network',
    typeBadge: 'Limited Coverage',
    rates: { ee: 292.7, es: 555, ec: 500, fam: 760 },
    details: {
      employeeRate: '$292.70',
      deductible: 'Limited schedule',
      oopMax: 'Not equivalent to major medical OOP',
      pcp: '$25',
      specialist: 'Limited visit structure',
      urgentCare: 'Includes select outpatient support',
      rx: 'Restricted Rx categories'
    },
    limitedNotes: ['This is limited coverage, not traditional major medical.', 'May limit doctor/specialist visits and outpatient services.']
  },
  {
    id: 'xgb-vl-1000',
    group: 'low',
    name: 'XGB VL 1000',
    network: 'XGB Value Lane',
    typeBadge: 'Budget Option',
    rates: { ee: 374, es: 700, ec: 630, fam: 955 },
    details: {
      employeeRate: '$374',
      deductible: '$1,000 equivalent schedule',
      oopMax: 'Limited by plan schedule',
      pcp: 'Limited visit plan',
      specialist: 'Limited visit plan',
      urgentCare: 'Limited visit plan',
      rx: 'Select generic support'
    },
    limitedNotes: ['This is limited coverage, not traditional major medical.', 'May limit imaging, ER, ambulance, or surgery benefits.']
  },
  {
    id: 'xgb-vl-1750-hsa',
    group: 'low',
    name: 'XGB VL 1750 HSA',
    network: 'XGB Value Lane',
    typeBadge: 'Limited Coverage',
    rates: { ee: 334, es: 625, ec: 565, fam: 860 },
    details: {
      employeeRate: '$334',
      deductible: '$1,750 equivalent schedule',
      oopMax: 'Limited by plan schedule',
      pcp: 'Limited visit HSA style',
      specialist: 'Limited visit HSA style',
      urgentCare: 'Limited visit HSA style',
      rx: 'Restricted Rx support'
    },
    limitedNotes: ['This is limited coverage, not traditional major medical.', 'May not cover brand-name drugs depending on the plan.']
  },
  {
    id: 'ep-classic-mec',
    group: 'mec',
    name: 'EnrollPrime Classic MEC',
    network: 'EnrollPrime MEC',
    typeBadge: 'MEC',
    rates: { ee: 127.5, es: 245, ec: 220, fam: 335 },
    details: {
      employeeRate: '$127.50',
      deductible: 'Preventive-focused schedule',
      oopMax: 'Not traditional major medical OOP structure',
      pcp: 'Preventive-focused',
      specialist: 'Limited/non-core',
      urgentCare: 'Limited/non-core',
      rx: 'Preventive/Rx limitations apply'
    },
    limitedNotes: ['This is limited coverage, not traditional major medical.', 'Preventive only and no hospital coverage.']
  }
];

const questions = [
  { key: 'state', title: 'Where is your business located?', kind: 'select', options: [{ label: 'Florida', value: 'Florida' }, { label: 'Georgia', value: 'Georgia' }] },
  { key: 'employees', title: 'How many full-time employees are benefits eligible?', kind: 'number', placeholder: 'Example: 12' },
  { key: 'enrolling', title: 'How many do you expect to enroll?', kind: 'number', placeholder: 'Example: 8' },
  { key: 'priority', title: 'What matters most right now?', kind: 'choice', options: [{ label: 'Lower monthly cost', value: 'cost' }, { label: 'Balanced value', value: 'balanced' }, { label: 'Broad network access', value: 'network' }, { label: 'HSA-friendly option', value: 'hsa' }] },
  { key: 'coverage', title: 'Do you currently offer a group health plan?', kind: 'choice', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] },
  { key: 'timeline', title: 'When are you hoping to start?', kind: 'choice', options: [{ label: 'Next 30 days', value: '30' }, { label: '1-3 months', value: '90' }, { label: '3+ months', value: 'later' }] }
];

let current = 0;
let contributionModel = 'percent';
const answers = {};

function money(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

function estimateSmartMix(enrolling) {
  const ee = Math.max(1, Math.round(enrolling * 0.55));
  const es = Math.round(enrolling * 0.15);
  const ec = Math.round(enrolling * 0.2);
  const fam = Math.max(0, enrolling - ee - es - ec);
  return { ee, es, ec, fam };
}

function calcTotal(rates, mix) {
  return rates.ee * mix.ee + rates.es * mix.es + rates.ec * mix.ec + rates.fam * mix.fam;
}

function getFlatAmount() {
  return flatContributionSelect.value === 'custom' ? Number(flatContributionCustom.value || 0) : Number(flatContributionSelect.value || 0);
}

function getTierMix(enrolling) {
  const values = {
    ee: Number(mixEe.value || 0),
    es: Number(mixEs.value || 0),
    ec: Number(mixEc.value || 0),
    fam: Number(mixFam.value || 0)
  };

  const totalEntered = values.ee + values.es + values.ec + values.fam;
  if (totalEntered === 0) {
    const smart = estimateSmartMix(enrolling);
    mixNote.textContent = `Using smart estimated mix because no tier mix was entered (${smart.ee}/${smart.es}/${smart.ec}/${smart.fam}).`;
    return smart;
  }

  if (totalEntered !== enrolling) {
    mixNote.textContent = `Tier mix totals ${totalEntered}. Expected enrolling is ${enrolling}; estimates use your entered mix.`;
  } else {
    mixNote.textContent = 'Based on estimated enrollment mix entered above.';
  }

  return values;
}

function setInitialMix(enrolling) {
  const smart = estimateSmartMix(enrolling);
  mixEe.value = smart.ee;
  mixEs.value = smart.es;
  mixEc.value = smart.ec;
  mixFam.value = smart.fam;
  mixNote.textContent = 'Based on estimated enrollment mix entered above.';
}

function updateModelUI() {
  contribModelWrap.querySelectorAll('.model-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.model === contributionModel);
  });
  percentControl.classList.toggle('hidden', contributionModel !== 'percent');
  flatControl.classList.toggle('hidden', contributionModel !== 'flat');
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

  progressBar.style.width = `${((current + 1) / questions.length) * 100}%`;
  progressText.textContent = `Question ${current + 1} of ${questions.length}`;
  backBtn.disabled = current === 0;
  nextBtn.textContent = current === questions.length - 1 ? 'Show Estimates' : 'Continue';
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

function calculateContribution(plan, enrolling, grossPremium) {
  const percentAmount = plan.rates.ee * (Number(employerContribution.value) / 100) * enrolling;
  const flatAmount = getFlatAmount() * enrolling;
  const modeled = contributionModel === 'percent' ? percentAmount : flatAmount;
  return Math.min(modeled, grossPremium);
}

function renderPlanCard(plan, enrolling, mix) {
  const grossPremium = calcTotal(plan.rates, mix);
  const employer = calculateContribution(plan, enrolling, grossPremium);
  const employee = grossPremium - employer;

  const limitHtml = plan.limitedNotes
    ? `<div class="limit-note">${plan.limitedNotes.map((n) => `<div>${n}</div>`).join('')}</div>`
    : '';

  return `
    <article class="plan-card">
      <div class="plan-head">
        <div>
          <h3>${plan.name}</h3>
          <p class="plan-meta">${plan.network}</p>
        </div>
        <span class="badge">${plan.typeBadge}</span>
      </div>

      <div class="metric-row employer">
        <strong>Estimated Employer Cost</strong>
        <div class="big-number">${money(employer)}</div>
      </div>
      <div class="metric-row"><strong>Gross Monthly Premium:</strong> ${money(grossPremium)}</div>
      <div class="metric-row"><strong>Estimated Employee Payroll Share:</strong> ${money(employee)}</div>

      <ul class="benefit-list">
        <li><span>Monthly Employee Rate</span><strong>${plan.details.employeeRate}</strong></li>
        <li><span>Deductible</span><strong>${plan.details.deductible}</strong></li>
        <li><span>Out of Pocket Max</span><strong>${plan.details.oopMax}</strong></li>
        <li><span>PCP Copay</span><strong>${plan.details.pcp}</strong></li>
        <li><span>Specialist Copay</span><strong>${plan.details.specialist}</strong></li>
        <li><span>Urgent Care</span><strong>${plan.details.urgentCare}</strong></li>
        <li><span>RX Summary</span><strong>${plan.details.rx}</strong></li>
      </ul>

      <p class="card-note">Based on estimated enrollment mix entered above.</p>
      ${limitHtml}
    </article>
  `;
}

function renderResults() {
  const enrolling = Number(answers.enrolling || 1);
  const employees = Number(answers.employees || enrolling);
  const mix = getTierMix(enrolling);

  contributionLabel.textContent = `${employerContribution.value}%`;
  flatLabel.textContent = money(getFlatAmount());
  resultsSummary.textContent = `${answers.state || 'Your state'} · ${employees} eligible employees · about ${enrolling} enrolling. These are real current starting rates based on the information provided.`;

  const topPlans = plans.filter((p) => p.group === 'top');
  const lowPlans = plans.filter((p) => p.group === 'low');
  const mecPlans = plans.filter((p) => p.group === 'mec');

  topPlansGrid.innerHTML = topPlans.map((plan) => renderPlanCard(plan, enrolling, mix)).join('');
  lowCostPlansGrid.innerHTML = lowPlans.map((plan) => renderPlanCard(plan, enrolling, mix)).join('');
  mecPlansGrid.innerHTML = mecPlans.map((plan) => renderPlanCard(plan, enrolling, mix)).join('');
}

function resetLeadForm() {
  leadForm.reset();
  firstName.value = '';
  email.value = '';
  phone.value = '';
  leadForm.classList.remove('hidden');
  leadSuccess.classList.add('hidden');
}

function startOver() {
  Object.keys(answers).forEach((key) => delete answers[key]);
  answers[questions[0].key] = questions[0].options[0].value;
  current = 0;

  contributionModel = 'percent';
  employerContribution.value = 50;
  flatContributionSelect.value = '300';
  flatContributionCustom.value = '';
  flatContributionCustom.classList.add('hidden');
  mixEe.value = '';
  mixEs.value = '';
  mixEc.value = '';
  mixFam.value = '';
  mixNote.textContent = '';
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

toggleMecBtn.addEventListener('click', () => {
  mecPlansWrap.classList.toggle('hidden');
  toggleMecBtn.textContent = mecPlansWrap.classList.contains('hidden') ? 'Show MEC Section' : 'Hide MEC Section';
});

leadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!firstName.value.trim() || !email.value.trim()) {
    alert('Please add your first name and work email.');
    return;
  }
  leadSuccess.classList.remove('hidden');
  leadForm.classList.add('hidden');
});

answers[questions[0].key] = questions[0].options[0].value;
updateModelUI();
renderQuestion();
