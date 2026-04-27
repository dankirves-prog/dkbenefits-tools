const questionHost = document.getElementById('questionHost');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const resultsSection = document.getElementById('resultsSection');
const resultsSummary = document.getElementById('resultsSummary');
const plansGrid = document.getElementById('plansGrid');
const employerContribution = document.getElementById('employerContribution');
const contributionLabel = document.getElementById('contributionLabel');
const flatContributionSelect = document.getElementById('flatContributionSelect');
const flatContributionCustom = document.getElementById('flatContributionCustom');
const flatLabel = document.getElementById('flatLabel');
const percentControl = document.getElementById('percentControl');
const flatControl = document.getElementById('flatControl');
const contribModelWrap = document.getElementById('contribModelWrap');
const leadForm = document.getElementById('leadForm');
const leadSuccess = document.getElementById('leadSuccess');
const editAnswersBtn = document.getElementById('editAnswersBtn');
const startOverBtn = document.getElementById('startOverBtn');
const funnelSection = document.getElementById('funnelSection');

const samplePlans = [
  {
    name: 'Cigna Network EPO Option',
    type: 'Major Medical',
    rates: { ee: 451, es: 887, ec: 799, fam: 1218 },
    tradeoff: 'Solid value and broad access, but limited out-of-network coverage.',
    benefits: {
      deductible: '$4,000 individual / $8,000 family',
      oop: '$8,550 individual / $17,100 family',
      pcp: '$35 copay after eligibility',
      specialist: '$75 copay',
      urgent: '$95 copay',
      rx: 'Generic/preferred tiers with copay and deductible interactions'
    }
  },
  {
    name: 'PHCS PPO Value Option',
    type: 'Major Medical',
    rates: { ee: 468, es: 919, ec: 828, fam: 1264 },
    tradeoff: 'Familiar PPO access with slightly higher monthly cost.',
    benefits: {
      deductible: '$5,000 individual / $10,000 family',
      oop: '$9,100 individual / $18,200 family',
      pcp: '$40 copay with deductible for some services',
      specialist: '$85 copay',
      urgent: '$110 copay',
      rx: 'Tiered Rx with deductible on selected drugs'
    }
  },
  {
    name: 'Broad Network HSA Option',
    type: 'HSA',
    rates: { ee: 429, es: 844, ec: 759, fam: 1172 },
    tradeoff: 'Lower premiums and HSA compatibility, but more deductible-first cost sharing.',
    benefits: {
      deductible: '$3,200 individual / $6,400 family',
      oop: '$7,500 individual / $15,000 family',
      pcp: 'Subject to deductible, then coinsurance',
      specialist: 'Subject to deductible, then coinsurance',
      urgent: 'Subject to deductible, then coinsurance',
      rx: 'Integrated with deductible; HSA-friendly structure'
    }
  },
  {
    name: 'Lower Cost Essential Coverage Option',
    type: 'MEC',
    rates: { ee: 182, es: 356, ec: 322, fam: 489 },
    tradeoff: 'Very low monthly cost but narrower protection than major medical.',
    limitations: [
      'may not cover hospital care',
      'may limit doctor and specialist visits',
      'may limit imaging, ER, ambulance, or surgery benefits',
      'may not cover brand-name drugs, depending on the plan'
    ],
    benefits: {
      deductible: 'Varies by option and service schedule',
      oop: 'Not structured like traditional major medical OOP limits',
      pcp: 'Preventive/basic visit allowances may apply',
      specialist: 'Limited visit structure may apply',
      urgent: 'Limited fixed-benefit treatment',
      rx: 'Formulary and class limitations may apply'
    }
  }
];

const questions = [
  {
    key: 'state',
    title: 'Where is your business located?',
    kind: 'select',
    options: [
      { label: 'Florida', value: 'Florida' },
      { label: 'Georgia', value: 'Georgia' }
    ]
  },
  {
    key: 'employees',
    title: 'How many full-time employees are benefits eligible?',
    kind: 'number',
    placeholder: 'Example: 12'
  },
  {
    key: 'enrolling',
    title: 'How many do you expect to enroll?',
    kind: 'number',
    placeholder: 'Example: 8'
  },
  {
    key: 'priority',
    title: 'What matters most right now?',
    kind: 'choice',
    options: [
      { label: 'Lower monthly cost', value: 'cost' },
      { label: 'Balanced value', value: 'balanced' },
      { label: 'Broad network access', value: 'network' },
      { label: 'HSA-friendly option', value: 'hsa' }
    ]
  },
  {
    key: 'coverage',
    title: 'Do you currently offer a group health plan?',
    kind: 'choice',
    options: [
      { label: 'Yes, we currently offer group health benefits', value: 'yes' },
      { label: 'No, this would be our first group health plan', value: 'no' }
    ]
  },
  {
    key: 'timeline',
    title: 'When are you hoping to start?',
    kind: 'choice',
    options: [
      { label: 'Next 30 days', value: '30' },
      { label: '1-3 months', value: '90' },
      { label: '3+ months', value: 'later' }
    ]
  }
];

let current = 0;
let contributionModel = 'percent';
const answers = {};

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

function calcTotal(rates, mix) {
  return rates.ee * mix.ee + rates.es * mix.es + rates.ec * mix.ec + rates.fam * mix.fam;
}

function estimateMix(enrolling) {
  return {
    ee: Math.max(1, Math.round(enrolling * 0.55)),
    es: Math.round(enrolling * 0.15),
    ec: Math.round(enrolling * 0.2),
    fam: Math.max(0, enrolling - Math.round(enrolling * 0.55) - Math.round(enrolling * 0.15) - Math.round(enrolling * 0.2))
  };
}

function money(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

function getFlatAmount() {
  if (flatContributionSelect.value === 'custom') {
    return Number(flatContributionCustom.value || 0);
  }
  return Number(flatContributionSelect.value || 0);
}

function updateModelUI() {
  contribModelWrap.querySelectorAll('.model-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.model === contributionModel);
  });
  percentControl.classList.toggle('hidden', contributionModel !== 'percent');
  flatControl.classList.toggle('hidden', contributionModel !== 'flat');
}

function renderResults() {
  const enrolling = Number(answers.enrolling || 1);
  const employees = Number(answers.employees || enrolling);
  const mix = estimateMix(enrolling);
  const pct = Number(employerContribution.value) / 100;
  const flatAmount = getFlatAmount();

  contributionLabel.textContent = `${employerContribution.value}%`;
  flatLabel.textContent = money(flatAmount);
  resultsSummary.textContent = `${answers.state || 'Your state'} · ${employees} eligible employees · about ${enrolling} enrolling. Sorted by lowest estimated monthly total for your team mix.`;

  const plans = samplePlans.map((plan) => {
    const total = calcTotal(plan.rates, mix);
    const employerByPercent = plan.rates.ee * pct * enrolling;
    const employerByFlat = flatAmount * enrolling;
    const employer = contributionModel === 'percent' ? employerByPercent : employerByFlat;
    const cappedEmployer = Math.min(total, employer);
    return { ...plan, total, employer: cappedEmployer, employee: total - cappedEmployer };
  }).sort((a, b) => a.total - b.total);

  plansGrid.innerHTML = plans.map((plan) => {
    const limitedCoverage = plan.type === 'MEC' || plan.type === 'Limited Benefit';
    const benefitList = `
      <ul class="glance-list">
        <li><strong>Deductible:</strong> ${plan.benefits.deductible}</li>
        <li><strong>Out-of-pocket max:</strong> ${plan.benefits.oop}</li>
        <li><strong>PCP/office visit:</strong> ${plan.benefits.pcp}</li>
        <li><strong>Specialist:</strong> ${plan.benefits.specialist}</li>
        <li><strong>Urgent care:</strong> ${plan.benefits.urgent}</li>
        <li><strong>Rx summary:</strong> ${plan.benefits.rx}</li>
      </ul>`;

    const limitationBlock = limitedCoverage
      ? `<p class="limit-note"><strong>This is limited coverage, not traditional major medical.</strong></p>
         <ul class="glance-list">${plan.limitations.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '';

    return `
      <article class="plan-card">
        <div class="plan-head">
          <div>
            <h3>${plan.name}</h3>
            <p>${plan.type}</p>
          </div>
          <span class="badge">Likely Eligible</span>
        </div>
        <ul class="rate-list">
          <li><span>Employee only</span><strong>${money(plan.rates.ee)}</strong></li>
          <li><span>EE + Spouse</span><strong>${money(plan.rates.es)}</strong></li>
          <li><span>EE + Child(ren)</span><strong>${money(plan.rates.ec)}</strong></li>
          <li><span>Family</span><strong>${money(plan.rates.fam)}</strong></li>
        </ul>
        <div class="metric"><strong>Estimated monthly employer cost:</strong> ${money(plan.employer)}</div>
        <div class="metric"><strong>Estimated employee deduction:</strong> ${money(plan.employee)}</div>
        <p class="tradeoff"><strong>Major tradeoff:</strong> ${plan.tradeoff}</p>

        <details class="benefit-details">
          <summary>See benefit highlights</summary>
          ${benefitList}
          ${limitationBlock}
        </details>
      </article>
    `;
  }).join('');
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
  updateModelUI();

  resultsSection.classList.add('hidden');
  funnelSection.classList.remove('hidden');
  leadForm.classList.remove('hidden');
  leadSuccess.classList.add('hidden');
  renderQuestion();
}

nextBtn.addEventListener('click', () => {
  readAnswer();
  if (!validateCurrent()) {
    alert('Please answer this question before continuing.');
    return;
  }

  if (current === questions.length - 1) {
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

leadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!document.getElementById('firstName').value.trim() || !document.getElementById('email').value.trim()) {
    alert('Please add your first name and work email.');
    return;
  }
  leadSuccess.classList.remove('hidden');
  leadForm.classList.add('hidden');
});

editAnswersBtn.addEventListener('click', () => {
  resultsSection.classList.add('hidden');
  funnelSection.classList.remove('hidden');
  current = 0;
  renderQuestion();
  funnelSection.scrollIntoView({ behavior: 'smooth' });
});

startOverBtn.addEventListener('click', startOver);

answers[questions[0].key] = questions[0].options[0].value;
updateModelUI();
renderQuestion();
