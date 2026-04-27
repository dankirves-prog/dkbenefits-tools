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
const leadForm = document.getElementById('leadForm');
const leadSuccess = document.getElementById('leadSuccess');

const samplePlans = [
  {
    name: 'Lower Cost Essential Coverage Option',
    type: 'MEC',
    rates: { ee: 182, es: 356, ec: 322, fam: 489 },
    tradeoff: 'Lowest monthly cost, but not comprehensive major medical.'
  },
  {
    name: 'Cigna Network EPO Option',
    type: 'Major Medical',
    rates: { ee: 451, es: 887, ec: 799, fam: 1218 },
    tradeoff: 'Good network access and value, limited out-of-network coverage.'
  },
  {
    name: 'PHCS PPO Value Option',
    type: 'Major Medical',
    rates: { ee: 468, es: 919, ec: 828, fam: 1264 },
    tradeoff: 'Familiar PPO structure, slightly higher premium than EPO.'
  },
  {
    name: 'Broad Network HSA Option',
    type: 'HSA',
    rates: { ee: 429, es: 844, ec: 759, fam: 1172 },
    tradeoff: 'Lower premium potential with deductible-first plan design.'
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
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
      { label: 'Not sure', value: 'unsure' }
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
  return `$${n.toLocaleString()}`;
}

function renderResults() {
  const enrolling = Number(answers.enrolling || 1);
  const employees = Number(answers.employees || enrolling);
  const mix = estimateMix(enrolling);
  const pct = Number(employerContribution.value) / 100;

  contributionLabel.textContent = `${employerContribution.value}%`;
  resultsSummary.textContent = `${answers.state || 'Your state'} · ${employees} eligible employees · about ${enrolling} enrolling. Sorted by lowest estimated monthly total for your team mix.`;

  const plans = samplePlans.map((plan) => {
    const total = calcTotal(plan.rates, mix);
    const employer = Math.round(total * pct);
    return { ...plan, total, employer, employee: total - employer };
  }).sort((a, b) => a.total - b.total);

  plansGrid.innerHTML = plans.map((plan) => `
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
      <p class="tradeoff"><strong>Tradeoff:</strong> ${plan.tradeoff}</p>
    </article>
  `).join('');
}

nextBtn.addEventListener('click', () => {
  readAnswer();
  if (!validateCurrent()) {
    alert('Please answer this question before continuing.');
    return;
  }

  if (current === questions.length - 1) {
    document.getElementById('funnelSection').classList.add('hidden');
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

employerContribution.addEventListener('input', renderResults);

leadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!document.getElementById('firstName').value.trim() || !document.getElementById('email').value.trim()) {
    alert('Please add your first name and work email.');
    return;
  }
  leadSuccess.classList.remove('hidden');
  leadForm.classList.add('hidden');
});

answers[questions[0].key] = questions[0].options[0].value;
renderQuestion();
