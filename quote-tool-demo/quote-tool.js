const questionHost = document.getElementById('questionHost');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const heroStartBtn = document.getElementById('heroStartBtn');
const heroSection = document.getElementById('heroSection');
const funnelSection = document.getElementById('funnelSection');
const resultsSection = document.getElementById('resultsSection');
const resultsSummary = document.getElementById('resultsSummary');
const participationNote = document.getElementById('participationNote');
const heroAsideTitle = document.getElementById('heroAsideTitle');
const heroAsideList = document.getElementById('heroAsideList');
const heroAsideLinks = document.getElementById('heroAsideLinks');

const employerContribution = document.getElementById('employerContribution');
const contributionLabel = document.getElementById('contributionLabel');
const dependentContribution = document.getElementById('dependentContribution');
const dependentContributionLabel = document.getElementById('dependentContributionLabel');
const flatContributionSelect = document.getElementById('flatContributionSelect');
const flatContributionCustom = document.getElementById('flatContributionCustom');
const flatLabel = document.getElementById('flatLabel');
const payrollSchedule = document.getElementById('payrollSchedule');
const flatModeNote = document.getElementById('flatModeNote');
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

let plans = [];

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
let heroCompactActive = false;

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
      'Most groups qualify for these rates',
      'Daniel can help verify eligibility',
      'Additional market options may be available',
      'Call, text, or email when ready'
    ],
    showLinks: true
  }
};

async function loadPlans() {
  const response = await fetch('plans.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load plans.json (${response.status})`);
  }

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`plans.json is not valid JSON. ${error.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error('plans.json did not return an array');
  }

  plans = data;
}

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
  flatModeNote.classList.toggle('hidden', contributionModel !== 'flat');
}

function setHeroCompact(compact) {
  heroCompactActive = compact;
  heroSection.classList.toggle('hero-compact', compact);
}

function updateHeroAside(mode) {
  if (!heroAsideTitle || !heroAsideList || !heroAsideLinks) return;
  const config = heroAsideContent[mode] || heroAsideContent.default;
  heroAsideTitle.textContent = config.title;
  heroAsideList.innerHTML = config.bullets.map((item) => `<li>${item}</li>`).join('');
  heroAsideLinks.classList.toggle('hidden', !config.showLinks);
}


function getPayrollScheduleLabel() {
  return payrollSchedule.options[payrollSchedule.selectedIndex]?.text?.toLowerCase() || 'bi-weekly';
}

function getStickyHeaderOffset() {
  const header = document.querySelector('.site-header');
  return header ? header.getBoundingClientRect().height + 8 : 0;
}

function scrollToElement(el, { mobileOnly = false } = {}) {
  if (!el) return;
  if (mobileOnly && !window.matchMedia('(max-width: 768px)').matches) return;
  requestAnimationFrame(() => {
    const offset = getStickyHeaderOffset();
    const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
}

function scrollActiveQuestionIntoView() {
  if (funnelSection.classList.contains('hidden')) return;
  scrollToElement(funnelSection, { mobileOnly: true });
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

  return list.sort((a, b) => {
    const grossA = calcGrossPremium(a.rates, mix);
    const grossB = calcGrossPremium(b.rates, mix);
    const employerA = calculateEmployerCost(a, mix, grossA);
    const employerB = calculateEmployerCost(b, mix, grossB);
    if (sortMode === 'lowestCost') return employerA - employerB;
    if (sortMode === 'strongestCoverage') return grossB - grossA;
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
  if (current > 0 || heroCompactActive) {
    setHeroCompact(true);
  }
  scrollActiveQuestionIntoView();
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

function calculateEmployerContributionForTier(plan, tierKey) {
  const tierRate = Number(plan.rates[tierKey] || 0);
  if (contributionModel === 'flat') {
    return Math.min(getFlatAmount(), tierRate);
  }

  const employeeOnlyRate = Number(plan.rates.employeeOnly || 0);
  const dependentPortion = Math.max(tierRate - employeeOnlyRate, 0);
  const employeePct = Number(employerContribution.value || 0) / 100;
  const dependentPct = Number(dependentContribution.value || 0) / 100;
  const employerTierContribution = employeeOnlyRate * employeePct + dependentPortion * dependentPct;
  return Math.min(employerTierContribution, tierRate);
}

function calculateEmployerCost(plan, mix, grossPremium) {
  const eeContribution = calculateEmployerContributionForTier(plan, 'employeeOnly');
  const esContribution = calculateEmployerContributionForTier(plan, 'employeeSpouse');
  const ecContribution = calculateEmployerContributionForTier(plan, 'employeeChildren');
  const famContribution = calculateEmployerContributionForTier(plan, 'family');
  const employer =
    mix.employeeOnly * eeContribution +
    mix.employeeSpouse * esContribution +
    mix.employeeChildren * ecContribution +
    mix.family * famContribution;
  return Math.min(employer, grossPremium);
}

function renderPlanCard(plan, mix) {
  const grossPremium = calcGrossPremium(plan.rates, mix);
  const employer = calculateEmployerCost(plan, mix, grossPremium);
  const annualGross = grossPremium * 12;
  const payPeriods = Number(payrollSchedule.value || 26);
  const perTierDeduction = {
    employeeOnly: Math.max(0, (plan.rates.employeeOnly - calculateEmployerContributionForTier(plan, 'employeeOnly')) * 12 / payPeriods),
    employeeSpouse: Math.max(0, (plan.rates.employeeSpouse - calculateEmployerContributionForTier(plan, 'employeeSpouse')) * 12 / payPeriods),
    employeeChildren: Math.max(0, (plan.rates.employeeChildren - calculateEmployerContributionForTier(plan, 'employeeChildren')) * 12 / payPeriods),
    family: Math.max(0, (plan.rates.family - calculateEmployerContributionForTier(plan, 'family')) * 12 / payPeriods)
  };

  const hasLimitedNotes = Array.isArray(plan.limitedNotes) && plan.limitedNotes.length > 0;
  const limitationsHtml = hasLimitedNotes
    ? `<div class="limit-note">${plan.limitedNotes.map((n) => `<div>${n}</div>`).join('')}</div>`
    : '';

  const notesHtml = `${plan.notes.map((n) => `<div>${n}</div>`).join('')}`;

  return `
    <article class="plan-card">
      <div class="plan-head">
        <div>
          <h3>${plan.name}</h3>
          <p class="plan-meta">${plan.network}</p>
        </div>
        <div class="plan-head-side">
          <label class="interest-toggle top">
            <span>Interested</span>
            <input type="checkbox" class="plan-interest" data-plan-id="${plan.id}" ${selectedPlans.has(plan.id) ? 'checked' : ''} />
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
        <div class="metric-row"><strong>Total Gross Annual Premium:</strong> ${money(annualGross)}</div>

        <ul class="benefit-list">
          <li><span>Employee Only</span><strong>${money(plan.rates.employeeOnly)}</strong></li>
          <li><span>Employee + Spouse</span><strong>${money(plan.rates.employeeSpouse)}</strong></li>
          <li><span>Employee + Child(ren)</span><strong>${money(plan.rates.employeeChildren)}</strong></li>
          <li><span>Family</span><strong>${money(plan.rates.family)}</strong></li>
        </ul>
        <div class="metric-row"><strong>Employee Cost Per Pay Period (${getPayrollScheduleLabel()})</strong></div>
        <div class="card-note">Estimated employee cost per pay period after employer contribution.</div>
        <ul class="benefit-list">
          <li><span>Employee Only</span><strong>${money(perTierDeduction.employeeOnly)}</strong></li>
          <li><span>Employee + Spouse</span><strong>${money(perTierDeduction.employeeSpouse)}</strong></li>
          <li><span>Employee + Child(ren)</span><strong>${money(perTierDeduction.employeeChildren)}</strong></li>
          <li><span>Family</span><strong>${money(perTierDeduction.family)}</strong></li>
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
          ${plan.details.emergencyRoom ? `<li><span>Emergency Room</span><strong>${plan.details.emergencyRoom}</strong></li>` : ''}
          <li><span>RX Summary</span><strong>${plan.details.rx}</strong></li>
        </ul>
      </div>

      <div class="card-section">
        <h4>Important Notes</h4>
        <div class="limit-note">${notesHtml}</div>
      </div>

      ${hasLimitedNotes ? `<div class="card-section"><h4>Limitations</h4>${limitationsHtml}</div>` : ''}

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
  dependentContributionLabel.textContent = `${dependentContribution.value}%`;
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
  dependentContribution.value = 0;
  payrollSchedule.value = '26';
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
  setHeroCompact(false);
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
    scrollToElement(document.querySelector('.contribution'));
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
  setHeroCompact(true);
  scrollToElement(funnelSection);
});

contribModelWrap.addEventListener('click', (event) => {
  const btn = event.target.closest('.model-btn');
  if (!btn) return;
  contributionModel = btn.dataset.model;
  updateModelUI();
  renderResults();
  scrollToElement(contribModelWrap, { mobileOnly: true });
});

employerContribution.addEventListener('input', renderResults);
dependentContribution.addEventListener('input', renderResults);
payrollSchedule.addEventListener('change', renderResults);
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
  scrollToElement(funnelSection);
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

(async () => {
  try {
    await loadPlans();
    renderQuestion();
  } catch (error) {
    console.error('Plan load error:', error);
    questionHost.innerHTML = `<article class="question active"><h3>We're having trouble loading plan options right now.</h3><p>Please refresh and try again, or call/text Daniel at 407-476-5076.</p><p class="subtle">Technical detail: ${error.message}</p></article>`;
  }
})();
