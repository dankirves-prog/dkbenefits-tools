const stepButtons = [...document.querySelectorAll('.step-btn')];
const panes = [...document.querySelectorAll('.step-pane')];
const mainProgress = document.getElementById('mainProgress');
const jumpToResults = document.getElementById('jumpToResults');
const employerPct = document.getElementById('employerPct');
const pctValue = document.getElementById('pctValue');
const plansGrid = document.getElementById('plansGrid');

const samplePlans = [
  {
    name: 'Lower Cost Essential Coverage Option',
    network: 'Value-focused access model',
    eligibility: 'Likely Eligible',
    rates: { ee: 182, es: 356, ec: 322, fam: 489 },
    tradeoff: 'Lowest price point; coverage limits compared with comprehensive major medical.'
  },
  {
    name: 'Cigna Network EPO Option',
    network: 'Cigna network access',
    eligibility: 'Likely Eligible',
    rates: { ee: 451, es: 887, ec: 799, fam: 1218 },
    tradeoff: 'Competitive cost and broad access; out-of-network usage is limited.'
  },
  {
    name: 'PHCS PPO Value Option',
    network: 'PHCS PPO access',
    eligibility: 'Likely Eligible',
    rates: { ee: 468, es: 919, ec: 828, fam: 1264 },
    tradeoff: 'Good PPO familiarity; slightly higher monthly premium profile.'
  },
  {
    name: 'Broad Network HSA Option',
    network: 'Broad multi-market network',
    eligibility: 'Likely Eligible',
    rates: { ee: 429, es: 844, ec: 759, fam: 1172 },
    tradeoff: 'HSA tax advantages; employees need comfort with deductible-first design.'
  }
];

const mix = { ee: 4, es: 1, ec: 2, fam: 1 };

function setStep(index) {
  stepButtons.forEach((btn, i) => btn.classList.toggle('is-active', i === index));
  panes.forEach((pane, i) => pane.classList.toggle('is-active', i === index));
  mainProgress.style.width = `${20 + index * 20}%`;
}

stepButtons.forEach((btn, idx) => {
  btn.addEventListener('click', () => setStep(idx));
});

if (jumpToResults) {
  jumpToResults.addEventListener('click', () => {
    document.getElementById('resultsMockup').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function money(value) {
  return `$${value.toLocaleString()}`;
}

function totalMonthly(rates) {
  return rates.ee * mix.ee + rates.es * mix.es + rates.ec * mix.ec + rates.fam * mix.fam;
}

function renderPlans() {
  const pct = Number(employerPct.value) / 100;
  pctValue.textContent = `${employerPct.value}%`;

  const sorted = [...samplePlans]
    .map((plan) => {
      const total = totalMonthly(plan.rates);
      const employer = Math.round(total * pct);
      return { ...plan, total, employer, employee: total - employer };
    })
    .sort((a, b) => a.total - b.total);

  plansGrid.innerHTML = sorted.map((plan) => `
    <article class="plan-card">
      <div class="plan-head">
        <div>
          <h3>${plan.name}</h3>
          <p>${plan.network}</p>
        </div>
        <span class="badge">${plan.eligibility}</span>
      </div>
      <ul class="rate-list">
        <li><span>Employee only</span><strong>${money(plan.rates.ee)}</strong></li>
        <li><span>EE + Spouse</span><strong>${money(plan.rates.es)}</strong></li>
        <li><span>EE + Child(ren)</span><strong>${money(plan.rates.ec)}</strong></li>
        <li><span>Family</span><strong>${money(plan.rates.fam)}</strong></li>
      </ul>
      <div class="metric"><strong>Estimated monthly employer cost:</strong> ${money(plan.employer)}</div>
      <div class="metric"><strong>Estimated employee deduction total:</strong> ${money(plan.employee)}</div>
      <p class="tradeoff"><strong>Tradeoff:</strong> ${plan.tradeoff}</p>
    </article>
  `).join('');
}

employerPct.addEventListener('input', renderPlans);
setStep(0);
renderPlans();
