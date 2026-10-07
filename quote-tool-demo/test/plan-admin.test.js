const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { roundTripPlan } = require('../plan-admin.js');

const PLANS_PATH = path.join(__dirname, '../plans.json');

test('plan admin load-then-export keeps every plan, including the HSA tag', () => {
  const plans = JSON.parse(fs.readFileSync(PLANS_PATH, 'utf8'));
  assert.equal(plans.length, 18);
  const exported = plans.map((plan) => roundTripPlan(plan));
  assert.deepEqual(exported, plans);
  const tagged = exported.filter((plan) => plan.details && plan.details.hsaTag).map((plan) => plan.id);
  assert.deepEqual(tagged, [
    'cigna-epo-1750-hsa',
    'cigna-ppo-8300-hsa',
    'UHC-ppo-8300-hsa',
    'phcs-ppo-8300-hsa',
    'phcs-visit-limit-1750-HSA'
  ]);
  exported.forEach((plan) => {
    if (plan.details.hsaTag) assert.equal(plan.details.hsaTag, 'Incl $25 Monthly HSA');
  });
});
