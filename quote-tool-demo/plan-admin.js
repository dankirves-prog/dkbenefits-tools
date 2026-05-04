const planRows = document.getElementById('planRows');
const planForm = document.getElementById('planForm');
const previewCard = document.getElementById('previewCard');
const validationList = document.getElementById('validationList');

const fileInput = document.getElementById('fileInput');
const reloadBtn = document.getElementById('reloadBtn');
const addPlanBtn = document.getElementById('addPlanBtn');
const duplicatePlanBtn = document.getElementById('duplicatePlanBtn');
const moveUpBtn = document.getElementById('moveUpBtn');
const moveDownBtn = document.getElementById('moveDownBtn');
const hidePlanBtn = document.getElementById('hidePlanBtn');
const archivePlanBtn = document.getElementById('archivePlanBtn');
const deletePlanBtn = document.getElementById('deletePlanBtn');
const validateBtn = document.getElementById('validateBtn');
const downloadBtn = document.getElementById('downloadBtn');

let plans = [];
let selectedIndex = -1;

function ensureSelection() {
  if (plans.length === 0) {
    selectedIndex = -1;
    return false;
  }
  if (selectedIndex < 0 || selectedIndex >= plans.length) selectedIndex = 0;
  return true;
}

function toLines(value) {
  if (!Array.isArray(value)) return '';
  return value.join('\n');
}
function fromLines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}
function ensureObj(obj, key) {
  if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {};
}
function renderList() {
  planRows.innerHTML = plans.map((p, i) => {
    const rate = p?.rates?.employeeOnly ?? '';
    const status = p.status || 'active';
    return `<tr data-i="${i}" class="${i === selectedIndex ? 'active' : ''}"><td>${p.name || ''}</td><td>${p.id || ''}</td><td>${p.group || ''}</td><td>${p.network || ''}</td><td>${p.typeBadge || ''}</td><td>${rate}</td><td>${status}</td><td>${p.ratesValidUntil || ''}</td></tr>`;
  }).join('');
}
function selectPlan(index) {
  selectedIndex = index;
  const p = plans[index];
  if (!p) return;
  ensureObj(p, 'rates');
  ensureObj(p, 'details');
  planForm.elements['id'].value = p.id || '';
  planForm.elements['group'].value = p.group || 'top';
  planForm.elements['name'].value = p.name || '';
  planForm.elements['network'].value = p.network || '';
  planForm.elements['typeBadge'].value = p.typeBadge || '';
  planForm.elements['status'].value = p.status || 'active';
  planForm.elements['ratesValidUntil'].value = p.ratesValidUntil || '';
  planForm.elements['allowedStates'].value = Array.isArray(p.allowedStates) ? p.allowedStates.join(', ') : '';

  planForm.elements['rates.employeeOnly'].value = p.rates.employeeOnly ?? '';
  planForm.elements['rates.employeeSpouse'].value = p.rates.employeeSpouse ?? '';
  planForm.elements['rates.employeeChildren'].value = p.rates.employeeChildren ?? '';
  planForm.elements['rates.family'].value = p.rates.family ?? '';

  planForm.elements['details.deductible'].value = p.details.deductible || '';
  planForm.elements['details.oopMax'].value = p.details.oopMax || '';
  planForm.elements['details.pcp'].value = p.details.pcp || '';
  planForm.elements['details.specialist'].value = p.details.specialist || '';
  planForm.elements['details.urgentCare'].value = p.details.urgentCare || '';
  planForm.elements['details.emergencyRoom'].value = p.details.emergencyRoom || '';
  planForm.elements['details.rx'].value = p.details.rx || '';

  planForm.elements['notes'].value = toLines(p.notes);
  planForm.elements['limitedNotes'].value = toLines(p.limitedNotes);

  renderList();
  renderPreview();
}

function applyFormToSelected() {
  const p = plans[selectedIndex];
  if (!p) return;
  ensureObj(p, 'rates');
  ensureObj(p, 'details');
  p.id = planForm.elements['id'].value.trim();
  p.group = planForm.elements['group'].value;
  p.name = planForm.elements['name'].value.trim();
  p.network = planForm.elements['network'].value.trim();
  p.typeBadge = planForm.elements['typeBadge'].value.trim();
  p.status = planForm.elements['status'].value;
  p.ratesValidUntil = planForm.elements['ratesValidUntil'].value.trim() || undefined;

  const states = planForm.elements['allowedStates'].value.trim();
  p.allowedStates = states ? states.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  ['employeeOnly', 'employeeSpouse', 'employeeChildren', 'family'].forEach((k) => {
    const raw = planForm.elements[`rates.${k}`].value;
    p.rates[k] = raw === '' ? undefined : Number(raw);
  });

  p.details.deductible = planForm.elements['details.deductible'].value.trim();
  p.details.oopMax = planForm.elements['details.oopMax'].value.trim();
  p.details.pcp = planForm.elements['details.pcp'].value.trim();
  p.details.specialist = planForm.elements['details.specialist'].value.trim();
  p.details.urgentCare = planForm.elements['details.urgentCare'].value.trim();
  p.details.emergencyRoom = planForm.elements['details.emergencyRoom'].value.trim();
  p.details.rx = planForm.elements['details.rx'].value.trim();

  p.notes = fromLines(planForm.elements['notes'].value);
  p.limitedNotes = fromLines(planForm.elements['limitedNotes'].value);

  renderList();
  renderPreview();
}

function renderPreview() {
  const p = plans[selectedIndex];
  if (!p) { previewCard.innerHTML = '<p>Select a plan.</p>'; return; }
  const r = p.rates || {};
  const d = p.details || {};
  previewCard.innerHTML = `
    <div class="badge">${p.typeBadge || 'Plan'}</div>
    <h3>${p.name || '(Unnamed plan)'}</h3>
    <p><strong>Network:</strong> ${p.network || '-'}</p>
    <p><strong>Rates:</strong> EE ${r.employeeOnly ?? '-'} | ES ${r.employeeSpouse ?? '-'} | EC ${r.employeeChildren ?? '-'} | FAM ${r.family ?? '-'}</p>
    <p><strong>Benefits:</strong> Deductible ${d.deductible || '-'} · OOP ${d.oopMax || '-'} · PCP ${d.pcp || '-'}</p>
    <p><strong>Notes:</strong></p>
    <ul>${(p.notes || []).map((n) => `<li>${n}</li>`).join('') || '<li>None</li>'}</ul>
  `;
}

function blankPlan() {
  return {
    id: `new-plan-${Date.now()}`,
    group: 'top',
    name: '',
    network: '',
    typeBadge: '',
    status: 'active',
    ratesValidUntil: '',
    allowedStates: [],
    rates: { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 },
    details: { deductible: '', oopMax: '', pcp: '', specialist: '', urgentCare: '', emergencyRoom: '', rx: '' },
    notes: [],
    limitedNotes: []
  };
}


function moveSelected(direction) {
  if (!ensureSelection()) return;
  const target = selectedIndex + direction;
  if (target < 0 || target >= plans.length) return;

  const currentPlanId = plans[selectedIndex]?.id;
  const [item] = plans.splice(selectedIndex, 1);
  plans.splice(target, 0, item);

  selectedIndex = plans.findIndex((p) => p.id === currentPlanId);
  if (selectedIndex < 0) selectedIndex = target;
  selectPlan(selectedIndex);
}

function validatePlans() {
  const errors = [];
  const ids = new Set();
  const groups = new Set(['top', 'low', 'mec']);

  plans.forEach((p, i) => {
    const label = `Plan #${i + 1}${p.id ? ` (${p.id})` : ''}`;
    if (!p.id) errors.push(`${label}: missing id.`);
    if (p.id && ids.has(p.id)) errors.push(`${label}: duplicate id '${p.id}'.`);
    if (p.id) ids.add(p.id);

    const isActive = (p.status || 'active') === 'active';
    if (isActive) {
      ['name', 'group', 'network', 'typeBadge'].forEach((k) => {
        if (!p[k]) errors.push(`${label}: active plan missing ${k}.`);
      });
      if (!p.rates) errors.push(`${label}: active plan missing rates object.`);
      ['employeeOnly', 'employeeSpouse', 'employeeChildren', 'family'].forEach((k) => {
        const v = p?.rates?.[k];
        if (typeof v !== 'number' || Number.isNaN(v)) errors.push(`${label}: rate ${k} must be a number.`);
      });
    }

    if (!groups.has(p.group)) errors.push(`${label}: group must be top, low, or mec.`);
    if (!p.details || typeof p.details !== 'object') errors.push(`${label}: details object is required.`);
    if (!Array.isArray(p.notes)) errors.push(`${label}: notes must be an array.`);
    if (p.limitedNotes !== undefined && !Array.isArray(p.limitedNotes)) errors.push(`${label}: limitedNotes must be an array when present.`);
  });

  return errors;
}

function showValidation() {
  const errors = validatePlans();
  validationList.innerHTML = '';
  if (errors.length === 0) {
    validationList.innerHTML = '<li class="ok">Validation passed.</li>';
    return true;
  }
  validationList.innerHTML = errors.map((e) => `<li class="error">${e}</li>`).join('');
  return false;
}

function downloadJSON() {
  if (!showValidation()) return;
  const cleaned = JSON.stringify(plans, null, 2);
  const blob = new Blob([cleaned], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plans.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function loadFromFetch() {
  const response = await fetch('plans.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('plans.json must be an array.');
  plans = data;
  selectedIndex = 0;
  renderList();
  selectPlan(selectedIndex);
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('Uploaded file must be JSON array.');
  plans = parsed;
  selectedIndex = plans.length ? 0 : -1;
  renderList();
  if (selectedIndex >= 0) selectPlan(selectedIndex);
});

planRows.addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const i = Number(tr.dataset.i);
  if (!Number.isNaN(i)) selectPlan(i);
});
planForm.addEventListener('input', applyFormToSelected);
addPlanBtn.addEventListener('click', () => {
  plans.push(blankPlan());
  selectPlan(plans.length - 1);
});
duplicatePlanBtn.addEventListener('click', () => {
  const p = plans[selectedIndex];
  if (!p) return;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = `${p.id || 'plan'}-copy-${Date.now().toString().slice(-4)}`;
  copy.name = `${p.name || 'Plan'} (Copy)`;
  plans.splice(selectedIndex + 1, 0, copy);
  selectPlan(selectedIndex + 1);
});
moveUpBtn.addEventListener('click', () => moveSelected(-1));
moveDownBtn.addEventListener('click', () => moveSelected(1));
hidePlanBtn.addEventListener('click', () => { if (plans[selectedIndex]) { plans[selectedIndex].status = 'hidden'; selectPlan(selectedIndex); } });
archivePlanBtn.addEventListener('click', () => { if (plans[selectedIndex]) { plans[selectedIndex].status = 'archived'; selectPlan(selectedIndex); } });
deletePlanBtn.addEventListener('click', () => {
  const p = plans[selectedIndex];
  if (!p) return;
  if (!confirm(`Delete plan '${p.name || p.id}' permanently? This cannot be undone.`)) return;
  plans.splice(selectedIndex, 1);
  selectedIndex = plans.length ? Math.max(0, selectedIndex - 1) : -1;
  renderList();
  if (selectedIndex >= 0) selectPlan(selectedIndex);
  else previewCard.innerHTML = '<p>Select a plan.</p>';
});
validateBtn.addEventListener('click', showValidation);
downloadBtn.addEventListener('click', downloadJSON);
reloadBtn.addEventListener('click', async () => {
  try { await loadFromFetch(); } catch (e) { alert(`Reload failed: ${e.message}`); }
});

(async () => {
  try {
    await loadFromFetch();
  } catch (error) {
    previewCard.innerHTML = `<p>Could not auto-load plans.json (${error.message}). Use <strong>Import plans.json</strong> to continue offline.</p>`;
  }
})();
