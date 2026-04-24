const priorityOptions = [
  ["lowest", "Lowest monthly cost"],
  ["balanced", "Balanced cost and benefits"],
  ["access", "Broad provider access"],
  ["hsa", "HSA/tax savings"],
  ["retention", "Employee retention"],
  ["unsure", "Not sure yet"]
];

const coverageOptions = [
  ["none", "No current group health plan"],
  ["yes", "Yes, we currently offer coverage"],
  ["unsure", "Not sure / prefer to discuss"]
];

const state = { step: 1, priority: "", currentCoverage: "", plans: [], config: null };

const form = document.getElementById("quoteForm");
const resultsSection = document.getElementById("resultsSection");
const cardsWrap = document.getElementById("resultsCards");

function makeChoices(containerId, options, key) {
  const root = document.getElementById(containerId);
  root.innerHTML = options.map(([value, label]) => `<button type="button" class="choice" data-${key}="${value}">${label}</button>`).join("");
  root.querySelectorAll(".choice").forEach(btn => {
    btn.addEventListener("click", () => {
      root.querySelectorAll(".choice").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state[key] = btn.dataset[key];
    });
  });
}

function updateStep() {
  document.querySelectorAll(".step").forEach(el => el.classList.remove("active"));
  document.querySelector(`.step[data-step=\"${state.step}\"]`).classList.add("active");
  document.getElementById("progressFill").style.width = `${(state.step / 6) * 100}%`;
  document.getElementById("progressText").textContent = `Step ${state.step} of 6`;
  document.getElementById("prevBtn").classList.toggle("hidden", state.step === 1);
  document.getElementById("nextBtn").classList.toggle("hidden", state.step === 6);
  document.getElementById("submitBtn").classList.toggle("hidden", state.step !== 6);
}

function getTierMix(enrolling) {
  const mix = {
    employee: Number(document.getElementById("tierEmployee").value || 0),
    spouse: Number(document.getElementById("tierSpouse").value || 0),
    children: Number(document.getElementById("tierChildren").value || 0),
    family: Number(document.getElementById("tierFamily").value || 0)
  };
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  return total === 0 ? { employee: enrolling, spouse: 0, children: 0, family: 0 } : mix;
}

function evaluateEligibility(eligible, enrolling) {
  const minEnrollForParticipation = Math.ceil(eligible * 0.5);
  const required = Math.max(3, minEnrollForParticipation);
  const gap = required - enrolling;

  if (eligible >= 5 && enrolling >= required) {
    return { status: "Likely fit", className: "fit", note: "Meets common minimums for this starting-rate lane." };
  }
  if (eligible >= 5 && gap > 0 && gap <= 2) {
    return {
      status: "Close to qualifying",
      className: "close",
      note: `You may be close to unlocking this pricing lane if additional eligible employees enroll in this same program. Estimated additional enrollees needed: ${gap}.`
    };
  }
  return { status: "Needs review", className: "review", note: "Group details likely need a custom market review for accurate options." };
}

function isRateValid(plan) {
  return new Date(plan.ratesValidUntil) >= new Date();
}

function pickPlans(allPlans, priority, eligibilityStatus) {
  const major = allPlans.filter(p => ["Major Medical", "HSA", "Major-Medical-Style"].includes(p.planTypeTag));
  const lowCost = allPlans.filter(p => ["MEC", "Limited Benefit"].includes(p.planTypeTag));

  let selected = [];
  if (priority === "lowest") {
    selected = [...lowCost.slice(0, 2), ...major.slice(0, 2)];
  } else if (priority === "hsa") {
    selected = [...allPlans.filter(p => p.planTypeTag === "HSA").slice(0, 1), ...major.slice(0, 3)];
  } else if (priority === "access") {
    selected = [...allPlans.filter(p => p.networkLabel.toLowerCase().includes("broad") || p.networkLabel.toLowerCase().includes("phcs")).slice(0, 4)];
  } else {
    selected = major.slice(0, 4);
  }

  if (eligibilityStatus.status === "Close to qualifying" && !selected.some(p => ["MEC", "Limited Benefit"].includes(p.planTypeTag))) {
    selected.push(lowCost[0]);
  }

  return [...new Map(selected.filter(Boolean).map(p => [p.publicPlanName, p])).values()].slice(0, 4);
}

function fmt(n) { return `$${n.toLocaleString()}`; }

function estimate(plan, mix) {
  return (
    plan.rates.employeeOnly * mix.employee +
    plan.rates.employeeSpouse * mix.spouse +
    plan.rates.employeeChildren * mix.children +
    plan.rates.family * mix.family
  );
}

function renderCards(plans, mix, eligibilityStatus) {
  cardsWrap.innerHTML = plans.map(plan => {
    const valid = isRateValid(plan);
    const rateRows = valid ? `
      <tr><td>Employee only</td><td>${fmt(plan.rates.employeeOnly)}</td></tr>
      <tr><td>Employee + spouse</td><td>${fmt(plan.rates.employeeSpouse)}</td></tr>
      <tr><td>Employee + child(ren)</td><td>${fmt(plan.rates.employeeChildren)}</td></tr>
      <tr><td>Family</td><td>${fmt(plan.rates.family)}</td></tr>
    ` : `<tr><td colspan="2">Current pricing needs verification</td></tr>`;

    const extraDisclosure = ["MEC", "Limited Benefit"].includes(plan.planTypeTag)
      ? `<p class="warning">This is not traditional major medical coverage. It may be useful in the right situation, but it has limits, exclusions, and benefit caps.</p>`
      : "";

    return `
      <article class="plan-card">
        <div class="plan-top">
          <div>
            <h4>${plan.publicPlanName}</h4>
            <p class="muted">${plan.networkLabel} · ${plan.planTypeTag}</p>
          </div>
          <span class="badge ${eligibilityStatus.className}">${eligibilityStatus.status}</span>
        </div>
        <table class="rate-table">${rateRows}</table>
        ${valid ? `<p><strong>Estimated monthly total:</strong> ${fmt(estimate(plan, mix))}</p>` : ""}
        <p><strong>Highlights:</strong> ${plan.highlights.join("; ")}</p>
        <p><strong>Tradeoffs:</strong> ${plan.tradeoffs.join("; ")}</p>
        <p class="disclosure">Starting rate. Final pricing depends on eligibility, participation, current coverage, underwriting, and census verification.</p>
        <p class="muted">${eligibilityStatus.note}</p>
        ${extraDisclosure}
      </article>
    `;
  }).join("");
}

async function loadData() {
  const [plansRes, configRes] = await Promise.all([fetch("plans.json"), fetch("config.json")]);
  state.plans = await plansRes.json();
  state.config = await configRes.json();
}

function validateCurrentStep() {
  const requiredByStep = { 1: "state", 2: "eligible", 3: "enrolling" };
  const field = requiredByStep[state.step];
  if (!field) return true;
  const value = document.getElementById(field).value;
  return value !== "";
}

document.getElementById("nextBtn").addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  state.step = Math.min(6, state.step + 1);
  updateStep();
});

document.getElementById("prevBtn").addEventListener("click", () => {
  state.step = Math.max(1, state.step - 1);
  updateStep();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const eligible = Number(document.getElementById("eligible").value || 0);
  const enrolling = Number(document.getElementById("enrolling").value || 0);
  const mix = getTierMix(enrolling);

  const eligibilityStatus = evaluateEligibility(eligible, enrolling);
  const plans = pickPlans(state.plans, state.priority, eligibilityStatus);
  renderCards(plans, mix, eligibilityStatus);

  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth" });
});

(async function init() {
  makeChoices("priorityChoices", priorityOptions, "priority");
  makeChoices("coverageChoices", coverageOptions, "currentCoverage");
  updateStep();
  try {
    await loadData();
  } catch {
    cardsWrap.innerHTML = '<p class="warning">Could not load demo plan data. Please run through a local web server (for example: <code>python3 -m http.server</code>).</p>';
  }
})();
