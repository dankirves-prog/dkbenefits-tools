/**
 * Mid-year election change decisions for DK Benefits.
 * Guidance reviewed October 2026. General rules only.
 * The employer's plan document and carrier rules govern.
 * Same object runs in the browser and in node tests.
 */
var QEModel = (function () {
  var PLAN_URL = 'https://www.dkbenefits.net/section125plantool';
  var LATE30 = 'Past the standard 30-day window. Generally not allowed unless your plan document allows a longer window.';
  var LATE60 = 'Past the standard 60-day window for Medicaid and CHIP. Generally not allowed unless your plan document allows a longer window.';
  var DOC = 'Your Section 125 plan document has to allow this kind of change for the premium to stay pre-tax.';
  var CARRIER_LINE = 'The carrier also has to be able to process the change.';
  var DIVORCE_LATE_LINE = 'Ask the carrier whether it will accept a late or retro removal, and what its policy is.';

  var EVENTS = [
    { id: 'marriage', label: 'Marriage' },
    { id: 'birth', label: 'Birth, adoption, or placement' },
    { id: 'divorce', label: 'Divorce or legal separation' },
    { id: 'lost_coverage', label: 'Lost other health coverage' },
    { id: 'gained_coverage', label: 'Gained other health coverage' },
    { id: 'job_leave', label: 'Job, hours, or leave' },
    { id: 'aged_out', label: 'Dependent no longer eligible' },
    { id: 'death', label: 'Death' },
    { id: 'medicaid_chip', label: 'Medicaid or CHIP' },
    { id: 'medicare', label: 'Medicare' },
    { id: 'move', label: 'Move or network area' },
    { id: 'cost_change', label: 'Employer changed the cost of coverage' },
    { id: 'coverage_change', label: 'Plan coverage changed' },
    { id: 'court_order', label: 'Court order or child support' },
    { id: 'marketplace', label: 'Marketplace enrollment' },
    { id: 'other', label: 'Not sure or something else' }
  ];

  var BENEFITS = [
    { id: 'medical', label: 'Medical' },
    { id: 'dental_vision', label: 'Dental or vision' },
    { id: 'hfsa', label: 'Health FSA' },
    { id: 'dcap', label: 'Dependent care FSA' },
    { id: 'hsa', label: 'HSA paycheck contribution' },
    { id: 'pretax_other', label: 'Other benefit paid pre-tax' },
    { id: 'aftertax', label: 'Other benefit paid after tax' }
  ];

  var PROFILES = [
    ['medical'],
    ['dental_vision'],
    ['hfsa'],
    ['dcap'],
    ['hsa'],
    ['pretax_other'],
    ['aftertax'],
    ['medical', 'hfsa'],
    ['medical', 'dcap'],
    ['medical', 'hsa'],
    ['medical', 'aftertax'],
    ['medical', 'dental_vision'],
    ['medical', 'pretax_other'],
    ['hfsa', 'dcap']
  ];

  var TITLES = {
    allowed: 'Generally allowed',
    late: 'Past the usual window',
    plan: 'Check the plan document',
    eligibility: 'Process this for eligibility',
    not_permitted: 'Not a permitted change',
    need_fact: 'Need one more fact',
    carrier: 'Carrier rules decide this',
    split: 'Different answer by benefit'
  };

  var LABEL = {};
  var PROMPT = {};

  function has(state, id) {
    return state.benefits && state.benefits.indexOf(id) !== -1;
  }

  function only(state, ids) {
    if (!state.benefits || !state.benefits.length) return false;
    if (state.benefits.length !== ids.length) return false;
    for (var i = 0; i < state.benefits.length; i++) {
      if (ids.indexOf(state.benefits[i]) === -1) return false;
    }
    return true;
  }

  function hsaOnly(state) { return only(state, ['hsa']); }
  function aftertaxOnly(state) { return only(state, ['aftertax']); }

  function q(eventId, id, prompt, options) {
    PROMPT[id] = prompt;
    options.forEach(function (opt) {
      LABEL[eventId + ':' + id + ':' + opt.value] = opt.label;
    });
    return { id: id, prompt: prompt, options: options };
  }

  function optionLabel(eventId, id, value) {
    return LABEL[eventId + ':' + id + ':' + value] || value || '';
  }

  function lossReasonOptions() {
    return [
      { value: 'eligibility', label: 'Lost eligibility (job ended, hours were cut, divorce, death, aged out, or moved out of an HMO area with no other option)' },
      { value: 'contributions', label: 'The other employer stopped paying toward the coverage' },
      { value: 'cobra_exhausted', label: 'COBRA or state continuation ran its full term' },
      { value: 'chip_or_medicaid', label: 'Medicaid or CHIP eligibility ended' },
      { value: 'other_government', label: 'Lost a state risk pool, tribal plan, or other governmental plan' },
      { value: 'voluntary', label: 'They chose to drop it, or it ended for nonpayment or fraud' },
      { value: 'unknown', label: 'Not sure why it ended' }
    ];
  }

  function visibleQuestions(state) {
    var event = state.event;
    var a = state.answers || {};
    if (!event) return [];
    if (hsaOnly(state)) {
      return [q(event, 'hsa_change', 'What should happen to the HSA paycheck contribution?', [
        { value: 'change_amount', label: 'Start, stop, or change the amount for future paychecks' }
      ])];
    }
    if (event === 'marriage') {
      var list = [q(event, 'change', 'What change is being requested?', [
        { value: 'add_family', label: 'Enroll the employee, add the spouse or the spouse\'s children, or move to family coverage' },
        { value: 'drop_to_spouse', label: 'Drop this plan because coverage will move to the spouse\'s plan' },
        { value: 'switch_plan', label: 'Switch to a different benefit package' }
      ])];
      if (a.change === 'drop_to_spouse') {
        list.push(q(event, 'covered', 'Who will the spouse\'s plan actually cover?', [
          { value: 'family', label: 'The employee and the family members who would be dropped here' },
          { value: 'employee_only', label: 'The employee only' },
          { value: 'no', label: 'It will not cover this employee' },
          { value: 'unknown', label: 'Not sure' }
        ]));
      }
      return list;
    }
    if (event === 'birth') {
      return [q(event, 'change', 'What change is being requested?', [
        { value: 'add_or_switch', label: 'Add the child, enroll the employee or spouse, or switch benefit package' },
        { value: 'drop', label: 'Drop coverage' }
      ])];
    }
    if (event === 'divorce') {
      var divorce = [q(event, 'change', 'What change is being requested?', [
        { value: 'drop_spouse', label: 'Remove the former spouse only' },
        { value: 'drop_child', label: 'Remove a child' },
        { value: 'drop_all', label: 'Also drop the employee, or drop everyone' },
        { value: 'add_child', label: 'Add a child' },
        { value: 'switch_plan', label: 'Switch medical options without adding or removing anyone' }
      ])];
      if (a.change === 'drop_child') {
        divorce.push(q(event, 'child_reason', 'Why is the child coming off the plan?', [
          { value: 'other_parent', label: 'A court order requires the other parent to cover the child, and that coverage is in place' },
          { value: 'not_eligible', label: 'The child no longer meets this plan\'s eligibility rules' },
          { value: 'still_eligible', label: 'The child is still eligible. The employee just wants the child off.' },
          { value: 'unknown', label: 'Not sure' }
        ]));
      }
      if (a.change === 'add_child') {
        divorce.push(q(event, 'affected', 'How did the divorce affect the child?', [
          { value: 'lost_other', label: 'The child lost other health coverage because of the divorce' },
          { value: 'newly_eligible', label: 'The child newly meets this plan\'s dependent rules because of the divorce' },
          { value: 'not_affected', label: 'The child\'s eligibility and other coverage did not change' },
          { value: 'unknown', label: 'Not sure' }
        ]));
      }
      return divorce;
    }
    if (event === 'lost_coverage') {
      var lost = [q(event, 'who', 'Who lost the other health coverage?', [
        { value: 'employee', label: 'The employee' },
        { value: 'spouse', label: 'The spouse' },
        { value: 'child', label: 'A child' },
        { value: 'family', label: 'The employee and family members' },
        { value: 'unknown', label: 'Not sure' }
      ])];
      if (a.who && a.who !== 'unknown') {
        lost.push(q(event, 'reason', 'Why did that coverage end?', lossReasonOptions()));
        if (a.reason && a.reason !== 'unknown') {
          lost.push(q(event, 'change', 'What change is being requested?', [
            { value: 'enroll', label: 'Enroll the people who lost coverage, and the employee if a dependent needs the employee enrolled' },
            { value: 'drop', label: 'Drop coverage' }
          ]));
        }
      }
      return lost;
    }
    if (event === 'gained_coverage') {
      var gained = [q(event, 'who', 'Who is enrolled in the new plan?', [
        { value: 'employee_only', label: 'The employee only' },
        { value: 'spouse_only', label: 'The spouse only' },
        { value: 'child_only', label: 'A child only' },
        { value: 'everyone', label: 'The employee, spouse, and children' },
        { value: 'spouse_and_children', label: 'The spouse and children, not the employee' },
        { value: 'unknown', label: 'Not sure' }
      ])];
      if (a.who && a.who !== 'unknown') {
        gained.push(q(event, 'change', 'Who is being dropped from this plan?', [
          { value: 'drop_employee', label: 'The employee only' },
          { value: 'drop_spouse', label: 'The spouse only' },
          { value: 'drop_child', label: 'A child only' },
          { value: 'drop_all', label: 'The employee and all covered family members' }
        ]));
      }
      return gained;
    }
    if (event === 'job_leave') {
      var job = [q(event, 'situation', 'What changed for this employee?', [
        { value: 'gained_eligibility', label: 'The employee became eligible for this plan' },
        { value: 'lost_eligibility', label: 'The employee lost eligibility for this plan' },
        { value: 'hours_under_30', label: 'Hours fell below 30, and the employee is still eligible' },
        { value: 'fmla', label: 'FMLA leave' },
        { value: 'userra', label: 'Military leave (USERRA)' },
        { value: 'other_leave', label: 'Other unpaid leave, and eligibility did not change' },
        { value: 'class_or_tier', label: 'The employee moved to a different class, status, or tier' },
        { value: 'unknown', label: 'Not sure' }
      ])];
      if (a.situation === 'gained_eligibility') {
        job.push(q(event, 'change', 'What change is being requested?', [
          { value: 'enroll', label: 'Enroll the employee and any eligible dependents' },
          { value: 'drop', label: 'Drop coverage' }
        ]));
      }
      if (a.situation === 'lost_eligibility') {
        job.push(q(event, 'change', 'What should happen to coverage?', [
          { value: 'end_coverage', label: 'End coverage because the employee is no longer eligible' }
        ]));
      }
      if (a.situation === 'hours_under_30') {
        job.push(q(event, 'change', 'What change is being requested?', [
          { value: 'revoke', label: 'Drop this plan so the employee can enroll in other minimum essential coverage' },
          { value: 'enroll', label: 'Newly enroll the employee' }
        ]));
      }
      if (a.situation === 'fmla') {
        job.push(q(event, 'change', 'What does the employee want for health coverage?', [
          { value: 'revoke', label: 'Stop health coverage during the leave' },
          { value: 'keep', label: 'Keep health coverage during the leave' },
          { value: 'reinstate', label: 'Restart health coverage when the employee returns' }
        ]));
      }
      if (a.situation === 'userra') {
        job.push(q(event, 'change', 'What does the employee want for health coverage?', [
          { value: 'continue', label: 'Continue coverage during military service' },
          { value: 'drop', label: 'Drop coverage during military service' },
          { value: 'reinstate', label: 'Reinstate coverage on return from service' }
        ]));
      }
      if (a.situation === 'other_leave') {
        job.push(q(event, 'change', 'What change is being requested?', [
          { value: 'drop', label: 'Drop coverage because of the leave' },
          { value: 'enroll', label: 'Start coverage because of the leave' }
        ]));
      }
      if (a.situation === 'class_or_tier') {
        job.push(q(event, 'change', 'What change is being requested?', [
          { value: 'switch', label: 'Switch to the option that matches the new class or tier' },
          { value: 'unrelated', label: 'Change the election in a way the new class or tier does not require' }
        ]));
      }
      return job;
    }
    if (event === 'aged_out') {
      var ageOpts = [
        { value: 'no_longer', label: 'No longer eligible under this plan (for example, medical coverage ended at 26)' },
        { value: 'still', label: 'The dependent still meets the plan\'s eligibility rules' },
        { value: 'unknown', label: 'Not sure' }
      ];
      if (has(state, 'dcap')) {
        ageOpts.splice(1, 0, { value: 'turned_13', label: 'A dependent care child turned 13 or otherwise stopped qualifying for dependent care' });
      }
      return [q(event, 'status', 'What happened to eligibility?', ageOpts)];
    }
    if (event === 'death') {
      var death = [q(event, 'who', 'Who died?', [
        { value: 'employee', label: 'The employee' },
        { value: 'spouse', label: 'The spouse' },
        { value: 'child', label: 'A child' },
        { value: 'unknown', label: 'Not sure' }
      ])];
      if (a.who && a.who !== 'unknown') {
        death.push(q(event, 'change', 'What change is being requested?', [
          { value: 'remove_deceased', label: 'Remove only the person who died, or end the employee\'s coverage if the employee died' },
          { value: 'drop_others', label: 'Also drop the employee or someone else who is still living' }
        ]));
      }
      return death;
    }
    if (event === 'medicaid_chip') {
      var med = [q(event, 'what', 'What happened with Medicaid or CHIP?', [
        { value: 'lost_eligibility', label: 'Lost Medicaid or CHIP because eligibility ended' },
        { value: 'premium_assistance', label: 'Became eligible for Medicaid or CHIP premium assistance for this employer plan' },
        { value: 'gained_medicaid', label: 'Enrolled in Medicaid' },
        { value: 'unknown', label: 'Not sure' }
      ])];
      if (a.what && a.what !== 'unknown') {
        med.push(q(event, 'who', 'Who does this apply to?', [
          { value: 'employee', label: 'The employee' },
          { value: 'spouse', label: 'The spouse' },
          { value: 'child', label: 'A child' },
          { value: 'unknown', label: 'Not sure' }
        ]));
      }
      if (a.what && a.what !== 'unknown' && a.who && a.who !== 'unknown') {
        if (a.what === 'gained_medicaid') {
          med.push(q(event, 'change', 'What change is being requested?', [
            { value: 'drop_person', label: 'Drop or reduce coverage for the person who enrolled in Medicaid' },
            { value: 'drop_others', label: 'Drop someone who did not enroll in Medicaid' },
            { value: 'enroll_person', label: 'Newly enroll someone because of this' }
          ]));
        } else {
          med.push(q(event, 'change', 'What change is being requested?', [
            { value: 'enroll_person', label: 'Enroll the person this applies to, and the employee if a dependent needs the employee enrolled' },
            { value: 'drop_person', label: 'Drop coverage' }
          ]));
        }
      }
      return med;
    }
    if (event === 'medicare') {
      var mc = [q(event, 'what', 'What happened with Medicare?', [
        { value: 'gained', label: 'Enrolled in Medicare Part A or Part B' },
        { value: 'lost', label: 'Lost Medicare' },
        { value: 'unknown', label: 'Not sure' }
      ])];
      if (a.what && a.what !== 'unknown') {
        mc.push(q(event, 'who', 'Who does this apply to?', [
          { value: 'employee', label: 'The employee' },
          { value: 'spouse', label: 'The spouse' },
          { value: 'child', label: 'A child or other dependent' },
          { value: 'unknown', label: 'Not sure' }
        ]));
      }
      if (a.what && a.what !== 'unknown' && a.who && a.who !== 'unknown') {
        if (a.what === 'gained') {
          mc.push(q(event, 'change', 'What change is being requested?', [
            { value: 'reduce_person', label: 'Drop or reduce coverage for the person who enrolled in Medicare' },
            { value: 'drop_others', label: 'Drop someone who did not enroll in Medicare' }
          ]));
        } else {
          mc.push(q(event, 'change', 'What change is being requested?', [
            { value: 'increase_person', label: 'Start or increase coverage for the person who lost Medicare' },
            { value: 'drop_person', label: 'Drop coverage' }
          ]));
        }
      }
      return mc;
    }
    if (event === 'move') {
      var move = [q(event, 'effect', 'Does the current option still cover the new address?', [
        { value: 'out_other', label: 'No. Another option from this employer does cover it.' },
        { value: 'out_none', label: 'No. No option from this employer covers it.' },
        { value: 'still', label: 'Yes. The current option still covers the new address.' },
        { value: 'unknown', label: 'Not sure' }
      ])];
      if (a.effect && a.effect !== 'unknown') {
        move.push(q(event, 'change', 'What change is being requested?', [
          { value: 'switch', label: 'Switch to another option' },
          { value: 'drop', label: 'Drop coverage' }
        ]));
      }
      return move;
    }
    if (event === 'cost_change') {
      var sizes = [
        { value: 'small', label: 'The employer made a small change. The paycheck amount needs an update.' },
        { value: 'increase', label: 'The employer significantly raised what the employee pays, or cut its contribution' },
        { value: 'decrease', label: 'The employer significantly lowered what the employee pays, or raised its contribution' }
      ];
      if (has(state, 'dcap')) {
        sizes.push({ value: 'daycare', label: 'The dependent care provider changed the rate or the hours of care' });
      }
      sizes.push({ value: 'unknown', label: 'Not sure' });
      var cost = [q(event, 'size', 'What kind of cost change was it? Use this when the employer changed the cost during the year, or a dependent care provider changed the rate. If the employee switched their own tier or class, use Job, hours, or leave. The plan decides what counts as significant. The IRS rules do not set a percentage.', sizes)];
      if (a.size === 'increase') {
        cost.push(q(event, 'change', 'What change is being requested?', [
          { value: 'pay_more', label: 'Keep the plan and pay the higher amount' },
          { value: 'switch_similar', label: 'Switch to a similar option' },
          { value: 'drop', label: 'Drop the coverage' }
        ]));
        if (a.change === 'drop') {
          cost.push(q(event, 'similar', 'Is a similar benefit package still available?', [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unknown', label: 'Not sure' }
          ]));
        }
      }
      if (a.size === 'decrease') {
        cost.push(q(event, 'change', 'What change is being requested?', [
          { value: 'elect', label: 'Start this option, or keep it and pay the lower amount' }
        ]));
      }
      if (a.size === 'daycare') {
        cost.push(q(event, 'relative', 'Is the provider a relative of the employee?', [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Yes' },
          { value: 'unknown', label: 'Not sure' }
        ]));
      }
      return cost;
    }
    if (event === 'coverage_change') {
      var cov = [q(event, 'kind', 'What changed?', [
        { value: 'partial', label: 'Coverage was cut back, but not lost (for example a higher deductible or a smaller network)' },
        { value: 'loss', label: 'The option ended, or the cut is a real loss of coverage' },
        { value: 'improved', label: 'A new option was added, or an option got significantly better' },
        { value: 'other_employer', label: 'A spouse or child can change coverage at their own job' },
        { value: 'unknown', label: 'Not sure' }
      ])];
      if (a.kind === 'partial') {
        cov.push(q(event, 'change', 'What change is being requested?', [
          { value: 'switch_similar', label: 'Switch to a similar option' },
          { value: 'drop', label: 'Drop coverage' }
        ]));
      }
      if (a.kind === 'loss') {
        cov.push(q(event, 'change', 'What change is being requested?', [
          { value: 'switch_similar', label: 'Switch to a similar option' },
          { value: 'drop', label: 'Drop coverage' }
        ]));
        if (a.change === 'drop') {
          cov.push(q(event, 'similar', 'Is a similar option still available? The plan may treat a spouse\'s plan as similar.', [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unknown', label: 'Not sure' }
          ]));
        }
      }
      if (a.kind === 'improved') {
        cov.push(q(event, 'change', 'What change is being requested?', [
          { value: 'elect_new', label: 'Elect the new or improved option' },
          { value: 'drop_away', label: 'Drop coverage without taking the new or improved option' }
        ]));
      }
      if (a.kind === 'other_employer') {
        cov.push(q(event, 'direction', 'What is happening on the other employer\'s plan?', [
          { value: 'add_there', label: 'They are adding coverage there, so this employee wants to drop coverage here' },
          { value: 'drop_there', label: 'They are losing coverage there, so this employee wants to add coverage here' },
          { value: 'different_year', label: 'The other plan has a different plan year, and this change lines up with that election' },
          { value: 'unrelated', label: 'The change here does not match what they can do on the other plan' }
        ]));
      }
      return cov;
    }
    if (event === 'court_order') {
      var court = [q(event, 'change', 'What does the order require?', [
        { value: 'enroll', label: 'Enroll the child on this plan' },
        { value: 'drop', label: 'Remove the child because the other parent must provide the coverage' }
      ])];
      if (a.change === 'drop') {
        court.push(q(event, 'covered_elsewhere', 'Is that other coverage actually in place?', [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'unknown', label: 'Not sure' }
        ]));
      }
      return court;
    }
    if (event === 'marketplace') {
      return [q(event, 'change', 'What change is being requested?', [
        { value: 'revoke', label: 'Drop this employer plan so the employee can enroll in a Marketplace plan' },
        { value: 'join_here', label: 'Join this employer plan because of the Marketplace' }
      ])];
    }
    if (event === 'other') {
      return [q(event, 'change', 'Can you name the event?', [
        { value: 'unspecified', label: 'No. It does not match the events in this tool.' }
      ])];
    }
    return [];
  }

  function windowMode(state) {
    if (!state || !state.event) return 'gate30';
    if (hsaOnly(state) || aftertaxOnly(state)) return 'none';
    var event = state.event;
    var a = state.answers || {};
    if (event === 'other') return 'none';
    if (event === 'death' || event === 'aged_out') return 'record';
    if (event === 'court_order' && a.change !== 'drop') return 'none';
    if (event === 'divorce' && a.change === 'drop_child' && a.child_reason === 'not_eligible') return 'record';
    if (event === 'job_leave' && (a.situation === 'fmla' || a.situation === 'userra' || a.situation === 'unknown')) return 'none';
    if (event === 'job_leave' && a.situation === 'lost_eligibility') return 'record';
    if (event === 'cost_change' && (a.size === 'small' || a.size === 'unknown' || !a.size)) return 'none';
    if (event === 'medicaid_chip' && (a.what === 'lost_eligibility' || a.what === 'premium_assistance')) return 'gate60';
    if (event === 'lost_coverage' && a.reason === 'chip_or_medicaid') return 'gate60';
    return 'gate30';
  }

  function timingOptions(mode) {
    if (mode === 'none') {
      return [{ value: 'not_applicable', label: 'The 30-day window is not the test for this request' }];
    }
    if (mode === 'gate60') {
      return [
        { value: 'within_60', label: 'Within 60 days' },
        { value: 'over_60', label: 'More than 60 days ago' },
        { value: 'unknown', label: 'Not sure of the date' }
      ];
    }
    return [
      { value: 'within_30', label: 'Within 30 days' },
      { value: 'over_30', label: 'More than 30 days ago' },
      { value: 'unknown', label: 'Not sure of the date' }
    ];
  }

  function timingPrompt(mode) {
    if (mode === 'gate60') return 'Medicaid and CHIP use 60 days. When did the eligibility change happen, compared with the request?';
    if (mode === 'record') return 'When did the plan learn about this? The usual 30-day election window is not what decides an eligibility change, but the date still matters for COBRA and pre-tax treatment.';
    return 'When did the event happen, compared with the employee\'s request? The usual window is 30 days unless the plan document allows longer.';
  }

  function decision(code, summary, steps, bases, hipaa) {
    return {
      code: code,
      summary: summary,
      steps: steps || [],
      bases: bases || [],
      hipaa: !!hipaa
    };
  }

  function coveredPeople(who) {
    if (who === 'employee_only') return ['employee'];
    if (who === 'spouse_only') return ['spouse'];
    if (who === 'child_only') return ['child'];
    if (who === 'everyone') return ['employee', 'spouse', 'child'];
    if (who === 'spouse_and_children') return ['spouse', 'child'];
    return [];
  }

  function droppedPeople(change) {
    if (change === 'drop_employee') return ['employee'];
    if (change === 'drop_spouse') return ['spouse'];
    if (change === 'drop_child') return ['child'];
    if (change === 'drop_all') return ['employee', 'spouse', 'child'];
    return [];
  }

  function dropFits(change, who) {
    var covered = coveredPeople(who);
    var dropped = droppedPeople(change);
    if (!dropped.length || !covered.length) return false;
    for (var i = 0; i < dropped.length; i++) {
      if (covered.indexOf(dropped[i]) === -1) return false;
    }
    return true;
  }

  function goodLoss(reason) {
    return reason === 'eligibility' || reason === 'contributions' || reason === 'cobra_exhausted' || reason === 'chip_or_medicaid' || reason === 'other_government';
  }

  function cobraFamilyNote() {
    return 'Federal COBRA applies when the employer had 20 or more employees on a typical business day in the prior year. Count part-time employees as a fraction of a full-time employee. Related employers under common control are counted together. Employers with fewer than 20 employees are generally outside federal COBRA. Small groups may have separate state continuation rules.';
  }

  function qbNoticeNote() {
    return 'For divorce or a child\'s loss of dependent status, the employee or the family member generally has 60 days after the later of the event or the loss of coverage to notify the plan (29 CFR 2590.606-3). The administrator then sends the COBRA election notice (29 CFR 2590.606-4). Do not treat the right as already lost until you check those dates and whether notice was given.';
  }

  function decideHealth(state) {
    var event = state.event;
    var a = state.answers || {};
    if (hsaOnly(state)) {
      return decision('allowed', 'The HSA change does not depend on a qualifying event.', ['Change the HSA amount for a future paycheck only.'], ['IRS Notice 2004-50, Q&A-58']);
    }
    if (event === 'other') {
      return decision(
        'need_fact',
        'A mid-year change needs a specific permitted reason. "Other" is not enough.',
        ['Name the event and run the tool again. Common reasons are marriage, birth or adoption, loss of other health coverage, a job or hours change that affects eligibility, Medicaid or CHIP, Medicare, a court order, or a cost or coverage change the plan allows.'],
        ['Treas. Reg. 1.125-4(a)']
      );
    }
    if (event === 'marriage') {
      if (a.change === 'add_family' || a.change === 'switch_plan') {
        return decision(
          'allowed',
          'Marriage lets the employee enroll, add the new spouse, and add the spouse\'s children if your plan counts them as dependents. The health plan has to offer any benefit package available to people who enroll when first eligible. Coverage starts no later than the first day of the next month after the plan receives the request. It does not start on the wedding date. The pre-tax deduction changes going forward, not backward.',
          [
            'Get the request date, not just the wedding date.',
            'Enroll the employee if they had waived, the spouse, and stepchildren who meet the plan\'s dependent rules.',
            'Let them choose a benefit package. Do not limit them to the option they would have had at open enrollment.',
            DOC,
            CARRIER_LINE
          ],
          [
            'Treas. Reg. 1.125-4(b) and (c)',
            '29 CFR 2590.701-6(b) and (d); 45 CFR 146.117 (any benefit package; marriage coverage starts no later than the first of the next month)'
          ],
          true
        );
      }
      if (a.change === 'drop_to_spouse') {
        if (a.covered === 'family') {
          return decision(
            'allowed',
            'The employee can drop this plan when the spouse\'s plan will cover the employee and the family members being dropped. The change has to match who is actually moving.',
            ['Get proof of the other plan\'s effective date.', 'Drop only the people that other plan will cover.', DOC],
            ['Treas. Reg. 1.125-4(c)(3) and (c)(4) Example 1']
          );
        }
        if (a.covered === 'employee_only') {
          return decision(
            'plan',
            'The employee can drop their own coverage to join the spouse\'s plan. Do not drop a spouse or child who will not be on that plan. Many plans will not cover dependents once the employee leaves. Check the plan before you drop anyone who is staying.',
            ['Drop only the employee unless the other plan covers the rest of the family.', DOC],
            ['Treas. Reg. 1.125-4(c)(3)']
          );
        }
        if (a.covered === 'no') {
          return decision('not_permitted', 'Dropping this plan after marriage is permitted when the employee is moving onto the spouse\'s plan. It is not permitted if that plan will not cover the employee.', ['Ask where the employee will be covered. If nowhere, do not drop this plan for the marriage.'], ['Treas. Reg. 1.125-4(c)(3)']);
        }
        return decision('need_fact', 'Confirm whether the spouse\'s plan will cover the people being dropped.', ['Get the other plan\'s enrollment and effective date, then run this again.'], ['Treas. Reg. 1.125-4(c)(3)']);
      }
    }
    if (event === 'birth') {
      if (a.change === 'add_or_switch') {
        return decision(
          'allowed',
          'Birth, adoption, or placement for adoption lets the employee enroll, add the spouse, and add the child. The health plan has to let them choose a benefit package. The coverage they elect because of this event starts on the date of birth, adoption, or placement. The pre-tax deduction can reflect the cost from that date if the Section 125 plan allows the change.',
          [
            'Use the date of birth, adoption, or placement.',
            'The child\'s coverage, and coverage for the employee or spouse if they enroll because of this event, starts on that date.',
            'Offer any benefit package, not only the one from open enrollment.',
            DOC,
            CARRIER_LINE
          ],
          [
            'Treas. Reg. 1.125-4(b) (the cafeteria election can reflect the cost from the date of adoption or birth)',
            '29 CFR 2590.701-6(b)(3); 45 CFR 146.117 (retroactive to birth, adoption, or placement; any benefit package)'
          ],
          true
        );
      }
      return decision('not_permitted', 'Birth, adoption, or placement is a reason to add the child and to enroll the employee or spouse. It is not a reason to drop coverage.', ['If they need to drop coverage, look for a different event, such as other coverage they actually gained.'], ['Treas. Reg. 1.125-4(c)(3)']);
    }
    if (event === 'divorce') {
      if (a.change === 'drop_spouse') {
        return decision(
          'allowed',
          'Remove the former spouse. Divorce allows that cancellation. The removal is effective under the plan\'s eligibility rule, and the Section 125 election uses the standard 30-day window. Do not drop the employee or a child who is still eligible.',
          [
            'Remove only the former spouse. Use the date the plan says a former spouse stops being eligible.',
            'Make the Section 125 election change within the standard 30-day window.',
            'If federal COBRA applies, offer COBRA to the former spouse. The employee or family member generally has 60 days after the later of the divorce or the loss of coverage to notify the plan.'
          ],
          [
            'Treas. Reg. 1.125-4(c)(3)(iii) and Example 3 (divorce does not let the employee cancel their own coverage or a child who remains eligible)',
            '29 CFR 2590.606-3 and 2590.606-4'
          ]
        );
      }
      if (a.change === 'drop_all') {
        return decision(
          'not_permitted',
          'Divorce lets you remove the former spouse. It does not let the employee drop their own coverage, or a child who is still eligible. If the former spouse later covers the child, a matching drop of that child can be allowed under the other-employer rule.',
          ['Remove the former spouse only, unless a child is independently losing eligibility or is covered by the other parent under an order.'],
          ['Treas. Reg. 1.125-4(c)(3)(iii) and (c)(4) Example 3']
        );
      }
      if (a.change === 'drop_child') {
        if (a.child_reason === 'other_parent') {
          return decision(
            'allowed',
            'You can cancel the child\'s coverage when an order requires the other parent (or another person) to provide it, and that coverage is actually in place.',
            ['Keep a copy of the order and proof the other coverage started.', DOC],
            ['Treas. Reg. 1.125-4(d)(1)(ii)']
          );
        }
        if (a.child_reason === 'not_eligible') {
          return decision(
            'eligibility',
            'If the child no longer meets the plan\'s rules, remove the child. Divorce by itself does not do that. For medical plans that cover children, coverage generally continues through age 26. ' + qbNoticeNote(),
            ['Confirm the plan\'s dependent rule before you remove a child under 26.', 'If federal COBRA applies, send the COBRA notice when this is a loss of dependent status.', cobraFamilyNote()],
            ['Treas. Reg. 1.125-4(c)(2)(iv)', '45 CFR 147.120 (age 26)', '29 CFR 2590.606-3']
          );
        }
        if (a.child_reason === 'still_eligible') {
          return decision('not_permitted', 'A child who is still eligible is not removed just because of the divorce.', ['Leave the child on the plan unless an order requires the other parent to cover the child and that coverage is in place, or the child has lost eligibility.'], ['Treas. Reg. 1.125-4(c)(3)(iii)']);
        }
        return decision('need_fact', 'Confirm whether the child lost eligibility or is covered by the other parent under an order.', ['Get the order or the plan\'s eligibility rule, then run this again.'], ['Treas. Reg. 1.125-4(c) and (d)']);
      }
      if (a.change === 'add_child') {
        if (a.affected === 'lost_other') {
          return decision(
            'allowed',
            'The child can be added when the divorce caused a loss of other health coverage. The employee can enroll too if the plan requires the employee to be enrolled. The health plan has to offer a benefit package. The usual special enrollment timing is 30 days, and coverage starts no later than the first of the next month after the plan receives the request.',
            ['Confirm the other coverage ended because of the divorce, not because someone chose to drop it.', DOC, CARRIER_LINE],
            ['Treas. Reg. 1.125-4(b)', '29 CFR 2590.701-6(a); 45 CFR 146.117'],
            true
          );
        }
        if (a.affected === 'newly_eligible') {
          return decision(
            'allowed',
            'The child can be added if the divorce is why the child now meets this plan\'s dependent rules. Add the child, not unrelated people.',
            ['Check the plan\'s dependent definition against the new custody or residence facts.', DOC],
            ['Treas. Reg. 1.125-4(c)(2) and (c)(3)']
          );
        }
        if (a.affected === 'not_affected') {
          return decision('not_permitted', 'A divorce does not let you add a child whose eligibility and other coverage did not change.', ['If the child lost other coverage, or newly meets the plan\'s rules, run this again with that fact.'], ['Treas. Reg. 1.125-4(c)(3)']);
        }
        return decision('need_fact', 'Confirm how the divorce changed the child\'s coverage or eligibility.', ['You need that fact before this add is a permitted change.'], ['Treas. Reg. 1.125-4(c)(3)']);
      }
      if (a.change === 'switch_plan') {
        return decision(
          'not_permitted',
          'Divorce does not, by itself, require a switch to a different medical option while the same people stay covered. Removing the former spouse, and moving to the tier that fits the people who remain, is the change that matches the divorce. Group term life is different: the plan may allow an increase or a decrease.',
          ['If the real request is to remove the former spouse, choose that instead.'],
          ['Treas. Reg. 1.125-4(c)(3)(iii)', 'Treas. Reg. 1.125-4(c)(4) Example 6 (group-term life may increase or decrease on divorce)']
        );
      }
    }
    if (event === 'lost_coverage') {
      if (!a.who || a.who === 'unknown' || !a.reason || a.reason === 'unknown') {
        return decision('need_fact', 'The result depends on who lost coverage and why it ended.', ['A voluntary drop, nonpayment, or fraud is not a special enrollment right. Loss of eligibility, the other employer stopping contributions, or COBRA running out can be.'], ['29 CFR 2590.701-6(a)']);
      }
      if (a.change === 'drop') {
        return decision('not_permitted', 'Losing other coverage is a reason to enroll in this plan, not a reason to drop this plan.', ['If they gained different coverage and want to drop this plan, use Gained other health coverage.'], ['Treas. Reg. 1.125-4(b)']);
      }
      if (a.reason === 'voluntary') {
        return decision('not_permitted', 'Choosing to drop other coverage, or losing it for nonpayment or fraud, is not a HIPAA special enrollment right and is not a permitted Section 125 change by itself.', ['If COBRA later runs its full term, that exhaustion can create a new special enrollment right.'], ['29 CFR 2590.701-6(a)(3)']);
      }
      if (goodLoss(a.reason)) {
        var chip = a.reason === 'chip_or_medicaid';
        var when = chip
          ? 'Loss of Medicaid or CHIP eligibility is a special enrollment right. The request has to be made within 60 days after that eligibility ends. Coverage is effective no later than the first of the month after the plan receives the request. '
          : 'This loss of other coverage can be a special enrollment right if the person declined this plan because they had that other coverage. ';
        var effective = chip
          ? ''
          : 'Coverage starts no later than the first of the next month after the plan receives the request, unless the plan is more generous. ';
        return decision(
          'allowed',
          when +
            'Enroll the person who lost coverage. If the employee lost coverage, dependents can enroll too. If a dependent lost coverage, enroll that dependent and the employee if the plan requires the employee to be enrolled. The health plan has to offer any benefit package. ' +
            effective +
            'Ending COBRA early is not exhaustion. If the other employer stopped contributing, the right starts then, even if the person could have paid the full cost and kept that plan.',
          [
            'Confirm they declined this plan because of the other coverage. If your plan required a written statement then, check the file.',
            chip ? 'Count 60 days from the date Medicaid or CHIP eligibility ended.' : 'Count 30 days from the loss, from the date contributions stopped, or from the date COBRA was exhausted.',
            DOC,
            CARRIER_LINE
          ],
          chip
            ? ['ERISA section 701(f)(3)', 'Treas. Reg. 1.125-4(b) and (f)(5)', '29 CFR 2590.701-6; 45 CFR 146.117']
            : ['Treas. Reg. 1.125-4(b) and (c)', '29 CFR 2590.701-6(a); 45 CFR 146.117', a.reason === 'other_government' ? 'Treas. Reg. 1.125-4(f)(5)' : 'Treas. Reg. 1.125-4(b)'],
          true
        );
      }
    }
    if (event === 'gained_coverage') {
      if (!a.who || a.who === 'unknown') {
        return decision('need_fact', 'You can drop only the people the new plan actually covers. Confirm who enrolled.', ['Get the other plan\'s names and effective date.'], ['Treas. Reg. 1.125-4(c)(3) and (f)(4)']);
      }
      if (dropFits(a.change, a.who)) {
        var extra = a.change === 'drop_employee' && a.who === 'employee_only'
          ? ' If dependents stay on this plan, confirm the plan allows that once the employee drops.'
          : '';
        return decision(
          'allowed',
          'The employee can drop the people who are enrolled in the other plan. The drop has to match that enrollment.' + extra + ' A health FSA does not change just because other health coverage started.',
          ['Get the other plan\'s effective date and who it covers.', 'Drop only those people.', DOC],
          ['Treas. Reg. 1.125-4(c)(3) and (f)(4)', 'Treas. Reg. 1.125-4(f)(6) Example 3 (no health FSA change for this kind of revocation)']
        );
      }
      return decision(
        'not_permitted',
        'The drop includes someone the new plan does not cover. That does not match the event. Drop only the people who will actually be covered elsewhere.',
        ['Compare the drop list to the other plan\'s enrollment.'],
        ['Treas. Reg. 1.125-4(c)(3)']
      );
    }
    if (event === 'job_leave') {
      if (a.situation === 'unknown' || !a.situation) {
        return decision('need_fact', 'The answer depends on whether eligibility changed, and on whether this is FMLA or military leave.', ['If a spouse or child lost or gained coverage because of their own job, use Lost other health coverage or Gained other health coverage.'], ['Treas. Reg. 1.125-4(c)(2)(iii)']);
      }
      if (a.situation === 'gained_eligibility') {
        if (a.change === 'enroll') {
          return decision(
            'allowed',
            'An employee who becomes eligible can enroll, and can enroll eligible dependents. Confirm the plan\'s waiting period. Eligibility may not start on the date the hours changed. This is a change in status. It is not, by itself, a HIPAA special enrollment.',
            ['Confirm the eligibility date in the plan.', 'If they also lost other coverage, that can be a separate special enrollment right.', DOC],
            ['Treas. Reg. 1.125-4(c)(2)(iii) and (c)(3)']
          );
        }
        return decision('not_permitted', 'Becoming eligible is a reason to enroll, not a reason to drop coverage.', ['If they want to drop because of other coverage, use that event.'], ['Treas. Reg. 1.125-4(c)(3)']);
      }
      if (a.situation === 'lost_eligibility') {
        return decision(
          'eligibility',
          'End coverage if the employee is no longer eligible. Do not wait out a 30-day election window to take an ineligible person off the plan. If the change caused a loss of health coverage, federal COBRA may apply. The employer generally notifies the plan administrator within 30 days for a termination or reduction of hours. ' + cobraFamilyNote(),
          [
            'Use the plan\'s eligibility rule for the end date.',
            'Stop the pre-tax deduction when eligibility ends.',
            'Send the federal COBRA notice if coverage was lost.'
          ],
          ['Treas. Reg. 1.125-4(c)(2)(iii)', '29 CFR 2590.606-2']
        );
      }
      if (a.situation === 'hours_under_30') {
        if (a.change === 'revoke') {
          return decision(
            'plan',
            'This drop is allowed only if the Section 125 plan has been amended for IRS Notice 2014-55. It applies when the employee was reasonably expected to average at least 30 hours, is now reasonably expected to average under 30, and is still eligible for the plan. The employee must intend to enroll in other minimum essential coverage that starts no later than the first day of the second month after the month this coverage ends. A health FSA cannot be revoked under that notice. If the hour cut made the employee ineligible, use lost eligibility instead.',
            [
              'Read the Section 125 plan for a Notice 2014-55 amendment. The standard change-in-status list is not enough.',
              'Get the employee\'s statement that they will enroll in other minimum essential coverage by that deadline.',
              'If there is no amendment, do not process the drop while they remain eligible.'
            ],
            ['IRS Notice 2014-55', 'Treas. Reg. 1.125-4(c) (no change when eligibility does not change)']
          );
        }
        return decision('not_permitted', 'Staying eligible after an hour cut is not a reason to newly enroll. If they were not eligible before and are eligible now, use became eligible.', ['Use the situation that matches eligibility.'], ['Treas. Reg. 1.125-4(c)(3)']);
      }
      if (a.situation === 'fmla') {
        if (a.change === 'revoke') {
          return decision('allowed', 'During FMLA leave, the employee may stop health coverage. You cannot force that drop. The 30-day qualifying-event window is not the test.', ['Let the employee choose.', 'If they stop a health FSA, follow your plan\'s FMLA reinstatement rule when they return.'], ['Treas. Reg. 1.125-4(g)', 'Treas. Reg. 1.125-3']);
        }
        if (a.change === 'keep') {
          return decision('allowed', 'The employee may keep health coverage during FMLA leave. On unpaid leave, payment is usually pre-pay, pay as they go, or catch up, using the method in your plan.', ['Do not drop them just because the leave is unpaid.', 'Set the payment method your plan uses.'], ['Treas. Reg. 1.125-3']);
        }
        return decision('allowed', 'When the employee returns from FMLA leave, they must be allowed back on health coverage without a new waiting period or medical exam, on the terms the FMLA rules require.', ['Reinstate health coverage on return if they ask, or if your plan reinstates it automatically.', 'Non-health benefits follow the plan. FMLA reinstatement is aimed at health coverage.'], ['Treas. Reg. 1.125-3', 'Treas. Reg. 1.125-4(g)']);
      }
      if (a.situation === 'userra') {
        if (a.change === 'continue') {
          return decision('allowed', 'The employee can keep health coverage for up to 24 months during military service. For service under 31 days, charge only the normal employee share. For 31 days or more, the charge can be up to 102 percent of the full premium.', ['Confirm the service dates with the employee.', 'Use your USERRA continuation process.'], ['38 USC 4317']);
        }
        if (a.change === 'drop') {
          return decision('allowed', 'The employee can drop health coverage during military service. The 30-day cafeteria window is not the test for USERRA.', ['Stop deductions when coverage stops.', 'Tell them about reinstatement on a timely return.'], ['38 USC 4317', 'Treas. Reg. 1.125-4(c)(2)(iii)']);
        }
        return decision('allowed', 'On a timely return from military service, reinstate health coverage with no new waiting period if the USERRA return-to-work conditions are met and the employee is still in an eligible class.', ['Check the return date against the USERRA deadlines.', 'Do not impose a new waiting period.'], ['38 USC 4317']);
      }
      if (a.situation === 'other_leave') {
        return decision('not_permitted', 'Other unpaid leave does not allow a mid-year drop or enrollment when eligibility stays the same. If this is FMLA or military leave, use that event. If eligibility changed, use gained eligibility or lost eligibility. If their class or tier changed, use that situation. A spouse or child\'s own job change belongs under lost or gained other coverage.', ['Pick the event that matches the eligibility change.'], ['Treas. Reg. 1.125-4(c)(2)(iii) and (c)(3)']);
      }
      if (a.situation === 'class_or_tier') {
        if (a.change === 'switch') {
          return decision(
            'allowed',
            'A change in employment status can support an election change that matches the new class or tier. Switching to the option that class or tier can have is that kind of change. If the employee only wanted a different tier and their status did not change, this rule does not apply. A cost change the employer imposed belongs under Employer changed the cost of coverage.',
            ['Confirm the plan treats the new class or tier as eligible for the option they want.', 'Make the election change consistent with that status change.', DOC],
            ['Treas. Reg. 1.125-4(c)(2)(iii) and (c)(3)']
          );
        }
        return decision(
          'not_permitted',
          'The election change has to correspond to the change in status. A switch that the new class or tier does not require is not permitted under this event.',
          ['If the employer changed the cost for everyone, use Employer changed the cost of coverage. If they want a different option and their status did not change, this is not a mid-year right.'],
          ['Treas. Reg. 1.125-4(c)(3)']
        );
      }
    }
    if (event === 'aged_out') {
      if (a.status === 'no_longer') {
        return decision(
          'eligibility',
          'Remove a dependent who no longer meets the plan\'s rules. For a medical plan that covers children, that is generally not before age 26, even if the child is married, not a student, or not a tax dependent. A standalone dental or vision plan that is an excepted benefit can use a different age. Disability rules can extend eligibility. ' + qbNoticeNote() + ' ' + cobraFamilyNote(),
          ['Confirm the plan\'s age and disability rules before removing a child under 26.', 'Loss of dependent status is a COBRA qualifying event.', 'The 30-day cafeteria window does not let you leave an ineligible dependent on the plan.'],
          ['Treas. Reg. 1.125-4(c)(2)(iv) and (c)(3)(iii)', '45 CFR 147.120', '29 CFR 2590.606-3']
        );
      }
      if (a.status === 'turned_13') {
        return decision(
          'allowed',
          'Turning 13 ends dependent care eligibility for that child. It does not, by itself, end medical coverage. Stop or reduce the dependent care election. Do that even if you are past 30 days.',
          ['Stop dependent care contributions for a child who is no longer a qualifying person.', 'Leave medical coverage in place unless the plan\'s own age rule has been reached.'],
          ['Treas. Reg. 1.125-4(c)(2)(iv) and (c)(4) Example 9', 'IRC 21(b)']
        );
      }
      if (a.status === 'still') {
        return decision('not_permitted', 'A dependent who still meets the plan\'s rules stays on the plan. Do not remove them early.', ['If this is medical coverage for a child under 26, they generally stay eligible.'], ['45 CFR 147.120', 'Treas. Reg. 1.125-4(c)(3)']);
      }
      return decision('need_fact', 'Confirm whether the dependent still meets the plan\'s eligibility rules.', ['Check the plan\'s age, student, and disability rules.'], ['Treas. Reg. 1.125-4(c)(2)(iv)']);
    }
    if (event === 'death') {
      if (!a.who || a.who === 'unknown') {
        return decision('need_fact', 'The steps depend on who died.', ['If the person who died was covering this employee on another plan, also look at Lost other health coverage for the survivor\'s enrollment.'], ['Treas. Reg. 1.125-4(c)(2)']);
      }
      if (a.change === 'drop_others') {
        return decision(
          'not_permitted',
          'You can take off the person who died. You cannot cancel the employee, or anyone else who is still living, just because of that death. If survivors lost coverage that the employee was providing, that loss is a special enrollment event for another employer\'s plan.',
          ['Remove only the person who died, and lower the tier only if that tier change does not drop someone who is still eligible.'],
          ['Treas. Reg. 1.125-4(c)(3)(iii)']
        );
      }
      if (a.who === 'employee') {
        return decision(
          'eligibility',
          'The employee\'s coverage ends. A surviving spouse and dependent children may elect federal COBRA for up to 36 months if COBRA applies. The employer generally has 30 days to notify the plan administrator of the death. ' + cobraFamilyNote(),
          [
            'End the employee\'s coverage and stop deductions.',
            'Offer federal COBRA to the spouse and dependent children.',
            'Do not use this screen to enroll survivors on a different employer\'s plan. That plan has its own special enrollment rule.'
          ],
          ['Treas. Reg. 1.125-4(c)(2)', '29 CFR 2590.606-2', 'COBRA death of the covered employee, generally up to 36 months']
        );
      }
      return decision(
        'eligibility',
        'Remove the ' + (a.who === 'spouse' ? 'spouse' : 'child') + ' who died. You can lower the coverage tier when that only removes the person who died. You cannot drop the employee or other living dependents because of this death. A death of a dependent is not a COBRA qualifying event for the people who remain covered.',
        ['Ask the carrier what they need, often a death certificate.', 'Adjust the tier and the pre-tax deduction.', 'Do not cancel anyone else.'],
        ['Treas. Reg. 1.125-4(c)(2) and (c)(3)(iii)']
      );
    }
    if (event === 'medicaid_chip') {
      if (!a.what || a.what === 'unknown' || !a.who || a.who === 'unknown') {
        return decision('need_fact', 'Medicaid, CHIP, and premium assistance are not the same event, and they are not the same as Medicare.', ['Loss of Medicaid or CHIP, and new premium assistance, are 60-day enrollment rights. Enrolling in Medicaid is a reason to drop or reduce that person\'s coverage, on the plan\'s normal window.'], ['Treas. Reg. 1.125-4(e)', 'ERISA section 701(f)(3)']);
      }
      if (a.what === 'lost_eligibility' && a.change === 'enroll_person') {
        return decision(
          'allowed',
          'Loss of Medicaid or CHIP eligibility gives the employee or dependent a special enrollment right. The request must be made within 60 days after eligibility ends. Coverage is effective no later than the first of the month after the plan receives the request. Enroll the person who lost Medicaid or CHIP, and the employee if a dependent needs the employee enrolled. This is not the Medicare rule.',
          ['Count 60 days from the date Medicaid or CHIP eligibility ended.', 'Make coverage effective no later than the first of the month after the plan receives the request.', DOC, CARRIER_LINE],
          ['ERISA section 701(f)(3)', 'Treas. Reg. 1.125-4(b) and (e)', '29 CFR 2590.701-6; 45 CFR 146.117'],
          true
        );
      }
      if (a.what === 'premium_assistance' && a.change === 'enroll_person') {
        return decision(
          'allowed',
          'If the employee or dependent becomes eligible for a Medicaid or CHIP subsidy that helps pay for this employer plan, the group health plan has to allow enrollment. The request must be made within 60 days after they are found eligible for that assistance. Coverage is effective no later than the first of the month after the plan receives the request. This is a right to join the employer plan, not a right to drop it.',
          ['Get the premium assistance determination.', 'Count 60 days from that determination.', 'Make coverage effective no later than the first of the month after the plan receives the request.', DOC],
          ['ERISA section 701(f)(3)', 'Treas. Reg. 1.125-4(b)'],
          true
        );
      }
      if (a.what === 'gained_medicaid' && a.change === 'drop_person') {
        return decision(
          'allowed',
          'Once the employee, spouse, or dependent is enrolled in Medicaid (not merely eligible to apply), the plan may let the employee cancel or reduce coverage for that person. The change is prospective. Use the plan\'s normal window, usually 30 days, not the 60-day CHIP enrollment window. Do not drop family members who did not enroll in Medicaid. Medicaid coverage that is only the children\'s vaccine program does not count.',
          ['Confirm they are enrolled in Medicaid.', 'Drop or reduce only that person.', 'Make the change prospective.', DOC],
          ['Treas. Reg. 1.125-4(e)']
        );
      }
      if (a.what === 'gained_medicaid' && a.change === 'drop_others') {
        return decision('not_permitted', 'Medicaid enrollment lets you cancel or reduce coverage for the person who enrolled. It does not let you drop someone else.', ['Limit the drop to the person enrolled in Medicaid.'], ['Treas. Reg. 1.125-4(e)']);
      }
      if (a.change === 'drop_person' || a.change === 'enroll_person') {
        return decision('not_permitted', 'That change does not match what happened. Loss of Medicaid or CHIP, and new premium assistance, are reasons to enroll. Gaining Medicaid is a reason to drop or reduce the person who enrolled.', ['Match the request to the event, or run Medicare separately if this is Medicare.'], ['Treas. Reg. 1.125-4(e)', 'ERISA section 701(f)(3)']);
      }
    }
    if (event === 'medicare') {
      if (!a.what || a.what === 'unknown' || !a.who || a.who === 'unknown') {
        return decision('need_fact', 'Medicare is separate from Medicaid and CHIP. The usual window is 30 days, not 60. Turning 65 is not enough. The person has to be enrolled in Part A or Part B, or has to have lost that enrollment.', ['Confirm Part A or Part B enrollment before you change the election.'], ['Treas. Reg. 1.125-4(e)']);
      }
      if (a.what === 'gained' && a.change === 'reduce_person') {
        return decision(
          'allowed',
          'Enrollment in Medicare Part A or Part B lets the plan cancel or reduce coverage for that employee, spouse, or dependent. The change is prospective. This is not a 60-day Medicaid or CHIP right. Do not drop someone who did not enroll in Medicare. If the employee\'s Medicare entitlement causes a spouse or child to lose this plan\'s coverage, that loss can be a COBRA qualifying event.',
          ['Confirm Medicare enrollment, not just a 65th birthday.', 'Change only that person\'s coverage, prospectively.', DOC],
          ['Treas. Reg. 1.125-4(e)']
        );
      }
      if (a.what === 'gained' && a.change === 'drop_others') {
        return decision('not_permitted', 'You can cancel or reduce coverage only for the person who enrolled in Medicare. Dropping someone else does not match the rule.', ['If those other people gained their own coverage, use Gained other health coverage.'], ['Treas. Reg. 1.125-4(e)']);
      }
      if (a.what === 'lost' && a.change === 'increase_person') {
        return decision(
          'allowed',
          'If the employee, spouse, or dependent loses Medicare, the plan may let the employee start or increase coverage for that person. The change is prospective. This is a Section 125 rule. It is not a HIPAA special enrollment right, and it is not a 60-day Medicaid window.',
          ['Confirm Medicare actually ended.', 'Increase coverage only for that person.', DOC],
          ['Treas. Reg. 1.125-4(e)']
        );
      }
      if (a.what === 'lost' && a.change === 'drop_person') {
        return decision('not_permitted', 'Losing Medicare is a reason to start or increase that person\'s coverage, not a reason to drop it.', ['If they want to drop because of different coverage, use that event.'], ['Treas. Reg. 1.125-4(e)']);
      }
    }
    if (event === 'move') {
      if (!a.effect || a.effect === 'unknown') {
        return decision('need_fact', 'A move allows a change only if it affects eligibility for the current option.', ['Ask whether the new address is outside the current network, and whether another option from this employer covers it.'], ['Treas. Reg. 1.125-4(c)(2)(v)']);
      }
      if (a.effect === 'still') {
        return decision('not_permitted', 'If the current option still covers the new address, the move did not change eligibility. Do not switch or drop because of the move alone.', ['A health FSA also does not change just because of a move.'], ['Treas. Reg. 1.125-4(c)(3)']);
      }
      if (a.effect === 'out_none' && a.change === 'switch') {
        return decision('not_permitted', 'There is no other employer option that covers the new address, so there is nothing to switch to. Dropping coverage can be permitted.', ['Use the drop request if they want off the plan. Mention Marketplace coverage as a separate option. Marketplace enrollment does not, by itself, change this plan unless the Section 125 plan has a Notice 2014-55 amendment.'], ['Treas. Reg. 1.125-4(c)(3)']);
      }
      if (a.effect === 'out_other' || a.effect === 'out_none') {
        return decision(
          'allowed',
          'The IRS example allows a switch to an option that covers the new work or home area, or a cancellation, when the employee is outside the current option\'s area. Your Section 125 plan has to include this change in status. A health FSA does not change just because of the move. One doctor leaving a network is not, by itself, a significant curtailment.',
          ['Confirm the new address is outside the current option.', a.effect === 'out_other' ? 'A switch to the option that covers the new area is available. A cancellation is also permitted under the IRS example.' : 'No other option covers the area, so a drop can fit.', DOC, CARRIER_LINE],
          ['Treas. Reg. 1.125-4(c)(2)(iii) and (c)(4) Example 4 (worksite move; health FSA unchanged)']
        );
      }
    }
    if (event === 'cost_change') {
      if (!a.size || a.size === 'unknown') {
        return decision('need_fact', 'A small employer cost change and a significant employer cost change are treated differently. Your plan decides what is significant. There is no IRS percentage. This event is the employer raising premiums or changing its contribution during the year. If the employee changed their own tier or class, use Job, hours, or leave.', ['Classify the employer\'s change, then run this again.'], ['Treas. Reg. 1.125-4(f)(2)']);
      }
      if (a.size === 'small') {
        return decision('allowed', 'If the employer makes a small cost change, the plan can update the paycheck amount to match the new cost. The employee does not get a new choice of plans. A health FSA cannot be changed because a premium changed. An employee who changed their own tier or class is not in this rule.', ['Update deductions on a consistent, prospective basis.', 'Do not open a plan switch for a small change.', 'If the employee switched tier or class, use Job, hours, or leave.'], ['Treas. Reg. 1.125-4(f)(1) and (f)(2)(i)']);
      }
      if (a.size === 'daycare') {
        if (a.relative === 'yes') {
          return decision('not_permitted', 'A dependent care rate increase charged by a relative does not support a new dependent care election. A change of provider, or a change in hours of care, can still support one.', ['If they changed providers, use Plan coverage changed or describe it as a provider change, not a relative\'s rate hike.'], ['Treas. Reg. 1.125-4(f)(2)(iv)']);
        }
        if (a.relative === 'no') {
          return decision('allowed', 'A dependent care cost change imposed by a provider who is not a relative can support a prospective change to the dependent care election. The plan has to allow it.', ['Update the dependent care election prospectively.', 'A relative is defined from IRC 152(a)(1) through (8).'], ['Treas. Reg. 1.125-4(f)(2)(ii) and (f)(2)(iv)']);
        }
        return decision('need_fact', 'Ask whether the daycare provider is a relative. A relative\'s rate change does not qualify. A non-relative\'s rate change can.', ['IRC 152 is the relationship test used in the regulation.'], ['Treas. Reg. 1.125-4(f)(2)(iv)']);
      }
      if (a.size === 'decrease') {
        return decision('allowed', 'If the employer significantly lowers what the employee pays, or raises its contribution, employees can start that option, including people who had waived it, or the enrolled employee can pay the new lower amount. A health FSA cannot be changed for this. An employee who changed their own tier or class is not in this rule.', ['Apply your plan\'s election window for the cost change.', 'If the employee switched tier or class, use Job, hours, or leave.', DOC, CARRIER_LINE], ['Treas. Reg. 1.125-4(f)(2)(ii)']);
      }
      if (a.size === 'increase') {
        if (a.change === 'pay_more' || a.change === 'switch_similar') {
          return decision('allowed', 'If the employer significantly raises premiums or cuts its contribution, the employee can pay the higher amount, or revoke that option and elect a similar benefit package. Similar coverage means the same kind of benefit for the same people. The plan may treat another employer\'s plan as similar. A health FSA is not similar coverage to major medical, and a health FSA election cannot change for this. An employee who changed their own tier or class, such as a downgrade to a class with a lower employer contribution, is not this event. Use Job, hours, or leave for that status change.', ['Confirm the employer made the increase and that you have called it significant under the plan\'s own rule.', 'If the employee switched their own tier or class, use Job, hours, or leave.', DOC, CARRIER_LINE], ['Treas. Reg. 1.125-4(f)(2)(ii) and (i)(9)']);
        }
        if (a.change === 'drop') {
          if (a.similar === 'no') {
            return decision('allowed', 'The employee can drop the coverage when the employer\'s cost increase is significant and no similar benefit package is available. The plan may treat a spouse\'s plan as similar. If it does, dropping with no replacement may not fit. This is the employer\'s change in cost, not an employee tier change.', ['Document that no similar option is available.', 'If the employee switched their own tier or class, use Job, hours, or leave.', DOC], ['Treas. Reg. 1.125-4(f)(2)(ii) and (i)(9)']);
          }
          if (a.similar === 'yes') {
            return decision('not_permitted', 'When a similar option is available, the employee can switch to it or pay the higher cost the employer set. They cannot simply drop because of that cost increase.', ['Offer the similar option instead of a drop.', 'If the employee switched their own tier or class, use Job, hours, or leave.'], ['Treas. Reg. 1.125-4(f)(2)(ii)']);
          }
          return decision('need_fact', 'A drop after the employer\'s cost increase is allowed only if no similar option is available. Confirm that. If the employee changed their own tier or class, use Job, hours, or leave instead.', ['Similar coverage can include another option, and the plan may treat a spouse\'s plan as similar.'], ['Treas. Reg. 1.125-4(f)(2)(ii)']);
        }
      }
    }
    if (event === 'coverage_change') {
      if (!a.kind || a.kind === 'unknown') {
        return decision('need_fact', 'A cutback, a real loss of the option, a new or better option, and another employer\'s election are different rules.', ['Pick the one that matches, including a spouse\'s open enrollment or different plan year.'], ['Treas. Reg. 1.125-4(f)(3) and (f)(4)']);
      }
      if (a.kind === 'partial') {
        if (a.change === 'switch_similar') {
          return decision('allowed', 'If coverage is significantly curtailed but not lost, the employee can revoke it and elect a similar option. They cannot drop with no replacement. A significant curtailment means an overall reduction, not the loss of one doctor. A health FSA cannot be changed for this.', [DOC, CARRIER_LINE], ['Treas. Reg. 1.125-4(f)(3)(i)']);
        }
        return decision('not_permitted', 'A curtailment that is not a loss of coverage does not let the employee drop the benefit. They can switch to a similar option.', ['If the option actually ended, or the employee lost all access to it, classify it as a loss of coverage.'], ['Treas. Reg. 1.125-4(f)(3)(i)']);
      }
      if (a.kind === 'loss') {
        if (a.change === 'switch_similar') {
          return decision('allowed', 'If the employee lost the option, they can elect a similar option. A loss includes elimination of the option, an HMO that no longer covers the area, or hitting an overall annual or lifetime limit. The plan may also treat a major provider pullout, or a cut in benefits for a condition currently being treated, as a loss. A health FSA cannot be changed for this.', [DOC, CARRIER_LINE], ['Treas. Reg. 1.125-4(f)(3)(ii)']);
        }
        if (a.similar === 'no') {
          return decision('allowed', 'The employee can drop the coverage when the option was lost and no similar benefit package is available.', ['Document that nothing similar remains.', DOC], ['Treas. Reg. 1.125-4(f)(3)(ii)']);
        }
        if (a.similar === 'yes') {
          return decision('not_permitted', 'A similar option is available, so the employee can switch to it. They cannot drop solely because of this loss.', ['Offer the similar option.'], ['Treas. Reg. 1.125-4(f)(3)(ii)']);
        }
        return decision('need_fact', 'A drop is allowed only when no similar option remains.', ['Confirm whether another similar option, including a spouse\'s plan if you treat it as similar, is available.'], ['Treas. Reg. 1.125-4(f)(3)(ii) and (i)(9)']);
      }
      if (a.kind === 'improved') {
        if (a.change === 'elect_new') {
          return decision('allowed', 'Employees can elect a new or significantly improved option, including people who had waived coverage. The new election has to be for that option. Do not use it as a reason to drop people the change did not affect. The IRS example did not allow a move to employee-only under the new option when the employee had employee-plus-one coverage, except as needed to elect the new option itself. A health FSA cannot be changed for this.', [DOC, CARRIER_LINE], ['Treas. Reg. 1.125-4(f)(3)(iii) and (f)(6) Example 8']);
        }
        return decision('not_permitted', 'Adding or improving an option lets people elect that option. It does not let them drop coverage without taking it.', ['If they want to drop because of other coverage, use that event.'], ['Treas. Reg. 1.125-4(f)(3)(iii)']);
      }
      if (a.kind === 'other_employer') {
        if (a.direction === 'unrelated') {
          return decision('not_permitted', 'The change on this plan has to correspond to the change on the other employer\'s plan. An unrelated change is not permitted.', ['Match the direction: if they add coverage there, this employee can drop here. If they lose it there, this employee can add here.'], ['Treas. Reg. 1.125-4(f)(4)']);
        }
        if (a.direction === 'add_there' || a.direction === 'drop_there' || a.direction === 'different_year') {
          return decision(
            'allowed',
            'The plan may allow a prospective change that matches a change under another employer\'s plan, if that other plan\'s change is one the IRS rules would allow, or if the two plans have different periods of coverage. The employee\'s election here has to correspond. If the spouse adds family coverage there, this employee can drop here. If the other plan\'s year starts on a different date, this employee can make the matching election as of that date. A health FSA cannot be changed for this.',
            ['Get proof of the other plan\'s election and effective date.', 'Line this change up with that date.', DOC],
            ['Treas. Reg. 1.125-4(f)(4) and Examples 2 and 3']
          );
        }
      }
    }
    if (event === 'court_order') {
      if (a.change === 'enroll') {
        return decision(
          'eligibility',
          'Enroll the child if the order requires this plan to cover the child. A valid QMCSO, including a National Medical Support Notice, is not optional and is not limited to open enrollment or the 30-day window. The plan administrator decides whether the order is qualified. The Section 125 plan may change the employee\'s election to provide that coverage. If the document does not allow a pre-tax change, the child is still enrolled.',
          [
            'Follow your QMCSO procedure before you treat the paper as qualified.',
            'Enroll the child as the order requires. The employee may have to be enrolled for the child to be covered.',
            'Set the effective date from the order and the plan\'s QMCSO rules.',
            DOC
          ],
          ['Treas. Reg. 1.125-4(d)(1)(i)', 'ERISA section 609']
        );
      }
      if (a.covered_elsewhere === 'yes') {
        return decision('allowed', 'The plan may let the employee cancel the child when the order requires someone else to provide the coverage and that coverage is actually in place.', ['Keep the order and proof of the other coverage.', DOC], ['Treas. Reg. 1.125-4(d)(1)(ii)']);
      }
      if (a.covered_elsewhere === 'no') {
        return decision('not_permitted', 'You cannot drop the child under the order rule unless the other person is required to provide coverage and that coverage is actually in place.', ['Leave the child enrolled until the other coverage exists.'], ['Treas. Reg. 1.125-4(d)(1)(ii)']);
      }
      return decision('need_fact', 'Confirm that the other parent\'s coverage is actually in place before you remove the child.', ['The order alone is not enough if the other coverage has not started.'], ['Treas. Reg. 1.125-4(d)(1)(ii)']);
    }
    if (event === 'marketplace') {
      if (a.change === 'revoke') {
        return decision(
          'plan',
          'The employee can drop this plan to enroll in Marketplace coverage only if the Section 125 plan has been amended for IRS Notice 2014-55. They must have a Marketplace special enrollment period, or it must be Marketplace open enrollment. The Marketplace plan has to start no later than the day after this coverage ends. A health FSA cannot be revoked under that notice. Wanting a subsidy is not enough if the plan was never amended. A real loss of eligibility, marriage, or birth is a different rule. Use that event if it is the real reason.',
          [
            'Read the Section 125 plan for a Notice 2014-55 Marketplace amendment.',
            'Check the Marketplace effective date before you end this coverage.',
            'If there is no amendment, do not process the drop.'
          ],
          ['IRS Notice 2014-55']
        );
      }
      return decision('not_permitted', 'Shopping for Marketplace coverage does not create a right to join this employer plan.', ['Join this plan only for a real eligibility change or special enrollment event.'], ['IRS Notice 2014-55 (revocation to leave for the Marketplace, not a right to join the employer plan)']);
    }
    return decision('need_fact', 'This combination needs a clearer fact before it has a reliable answer.', ['Check the event, who is affected, and whether the requested change matches that event.'], ['Treas. Reg. 1.125-4']);
  }

  function part(benefit, code, text, bases, steps) {
    return { benefit: benefit, code: code, text: text, bases: bases || [], steps: steps || [] };
  }

  function hfsaPart(state, health) {
    var event = state.event;
    var a = state.answers || {};
    var blocked = 'A health FSA cannot be changed for a cost or coverage change, for a move that does not affect health FSA eligibility, or under IRS Notice 2014-55. Treas. Reg. 1.125-4(f) does not apply to a health FSA.';
    if (event === 'cost_change' || event === 'coverage_change' || event === 'move' || event === 'marketplace') {
      return part('hfsa', 'not_permitted', blocked, ['Treas. Reg. 1.125-4(f)(1)', 'IRS Notice 2014-55']);
    }
    if (event === 'job_leave' && a.situation === 'hours_under_30') {
      return part('hfsa', 'not_permitted', 'IRS Notice 2014-55 does not let the employee change a health FSA when hours fall but eligibility continues.', ['IRS Notice 2014-55']);
    }
    if (event === 'gained_coverage') {
      if (health.code === 'not_permitted' || health.code === 'need_fact') {
        return part('hfsa', health.code, health.summary, health.bases, health.steps);
      }
      return part('hfsa', 'not_permitted', 'The IRS example does not allow a health FSA change when the employee revokes health coverage because a spouse enrolled in other employer coverage. If a job change is the real event and health FSA expenses will change, run Job, hours, or leave and read the health FSA line there.', ['Treas. Reg. 1.125-4(f)(6) Example 3']);
    }
    if (health.code === 'not_permitted' || health.code === 'need_fact') {
      return part('hfsa', health.code, 'The health FSA follows the same consistency problem. ' + health.summary, health.bases, health.steps);
    }
    if (event === 'marriage' && (a.change === 'add_family' || a.change === 'switch_plan')) {
      return part('hfsa', 'allowed', 'The employee may increase or start a health FSA when a spouse is added. A decrease is not the change the IRS example allows for a marriage.', ['Treas. Reg. 1.125-4(c)(4) Example 1'], ['Increase the health FSA only if the employee wants more coverage for the new expenses.']);
    }
    if (event === 'marriage' && a.change === 'drop_to_spouse' && (a.covered === 'family' || a.covered === 'employee_only')) {
      return part('hfsa', 'plan', 'Stopping a health FSA because medical coverage moved to a spouse\'s plan is not as clear as an increase when a spouse is added. Allow a decrease only if your document treats it as consistent with the revocation. Do not decrease it automatically.', ['Treas. Reg. 1.125-4(c)'], ['Read the health FSA section of the plan before you stop it.']);
    }
    if (event === 'birth' && a.change === 'add_or_switch') {
      return part('hfsa', 'allowed', 'A new child can support an increase or a new health FSA election. The change should match the new expenses. Make the election change line up with your plan\'s rule. A decrease does not fit a birth.', ['Treas. Reg. 1.125-4(c)(2)(ii) and (c)(3)']);
    }
    if (event === 'divorce' && (a.change === 'drop_spouse' || (a.change === 'drop_child' && (a.child_reason === 'other_parent' || a.child_reason === 'not_eligible')))) {
      return part('hfsa', 'allowed', 'The employee may decrease or stop a health FSA when a spouse or child comes off the plan and that matches the divorce or the loss of eligibility.', ['Treas. Reg. 1.125-4(c)(3)']);
    }
    if (event === 'divorce' && a.change === 'add_child' && (a.affected === 'lost_other' || a.affected === 'newly_eligible')) {
      return part('hfsa', 'allowed', 'Adding a child after divorce can support a health FSA increase if the child is newly covered and the increase matches that.', ['Treas. Reg. 1.125-4(c)']);
    }
    if (event === 'lost_coverage' && a.change === 'enroll' && a.reason === 'eligibility') {
      return part('hfsa', 'allowed', 'A status change such as a spouse\'s job ending can support a health FSA increase along with adding medical coverage. The IRS example allows both.', ['Treas. Reg. 1.125-4(c)(4) Example 5']);
    }
    if (event === 'lost_coverage' && a.change === 'enroll' && (a.reason === 'contributions' || a.reason === 'cobra_exhausted' || a.reason === 'other_government')) {
      return part('hfsa', 'not_permitted', 'Those loss-of-coverage paths support enrollment in the group health plan. They do not, by themselves, let the employee change a health FSA. Treas. Reg. 1.125-4(f) does not apply to a health FSA.', ['Treas. Reg. 1.125-4(f)(1)']);
    }
    if (event === 'lost_coverage' && a.reason === 'chip_or_medicaid') {
      return part('hfsa', 'plan', 'The 60-day Medicaid and CHIP right is a group health plan special enrollment. It does not automatically change a health FSA. Treas. Reg. 1.125-4(e) can support a prospective health FSA change when Medicaid eligibility is lost or gained. Check the plan document. Use the plan\'s normal window for the FSA, usually 30 days.', ['Treas. Reg. 1.125-4(e) and (f)(1)']);
    }
    if (event === 'death' && a.change === 'remove_deceased') {
      return part('hfsa', 'allowed', 'The employee may decrease a health FSA to reflect the person who died. Do not use the death to cancel the health FSA for a reason that drops living family members\' expenses unless those expenses truly ended.', ['Treas. Reg. 1.125-4(c)(3)(iii)']);
    }
    if (event === 'aged_out' && a.status === 'no_longer') {
      return part('hfsa', 'allowed', 'The employee may decrease a health FSA when a dependent loses health plan eligibility.', ['Treas. Reg. 1.125-4(c)(2)(iv)']);
    }
    if (event === 'aged_out' && a.status === 'turned_13') {
      return part('hfsa', 'not_permitted', 'Turning 13 changes dependent care, not the health FSA, unless the child also lost eligibility for the health plan.', ['Treas. Reg. 1.125-4(c)(4) Example 9']);
    }
    if (event === 'job_leave' && a.situation === 'gained_eligibility' && a.change === 'enroll') {
      return part('hfsa', 'allowed', 'Becoming eligible can support starting a health FSA if the plan offers it to the newly eligible class.', ['Treas. Reg. 1.125-4(c)(2)(iii)']);
    }
    if (event === 'job_leave' && a.situation === 'lost_eligibility') {
      return part('hfsa', 'allowed', 'Stop the health FSA when the employee loses eligibility for it.', ['Treas. Reg. 1.125-4(c)(2)(iii)']);
    }
    if (event === 'job_leave' && a.situation === 'fmla') {
      return part('hfsa', 'allowed', 'On FMLA leave the employee may revoke a health FSA, and on return the plan\'s FMLA rule decides reinstatement and how much is available. Follow the plan\'s pre-pay, pay-as-you-go, or catch-up method. Do not invent a proration the document does not use.', ['Treas. Reg. 1.125-3']);
    }
    if (event === 'job_leave' && a.situation === 'userra') {
      return part('hfsa', 'plan', 'USERRA\'s continuation and reinstatement rules are about health plan coverage. Treat a health FSA change on military leave as allowed only if your plan says so and the change matches the leave.', ['38 USC 4317', 'Treas. Reg. 1.125-4(c)']);
    }
    if (event === 'court_order' && health.code !== 'not_permitted') {
      return part('hfsa', 'plan', 'The order rule is about accident or health coverage for the child. A health FSA increase or decrease can fit if it matches adding or removing that child and the plan allows it.', ['Treas. Reg. 1.125-4(d)']);
    }
    if ((event === 'medicare' || (event === 'medicaid_chip' && a.what === 'gained_medicaid')) && (health.code === 'allowed' || health.code === 'plan')) {
      return part('hfsa', 'allowed', 'Treas. Reg. 1.125-4(e) lets the plan cancel, reduce, start, or increase accident or health coverage for the person who gained or lost Medicare or Medicaid. A health FSA change for that same person can fit. Make it prospective. Do not change the FSA for someone else.', ['Treas. Reg. 1.125-4(e)']);
    }
    if (event === 'medicaid_chip' && (a.what === 'lost_eligibility' || a.what === 'premium_assistance')) {
      return part('hfsa', 'plan', 'Premium assistance and CHIP special enrollment enroll the person in the group health plan. They are not an automatic health FSA change. Check Treas. Reg. 1.125-4(e) if Medicaid eligibility itself was lost, and use the plan\'s normal FSA window.', ['Treas. Reg. 1.125-4(e)', 'ERISA section 701(f)(3)']);
    }
    if (health.code === 'eligibility' || health.code === 'allowed' || health.code === 'plan') {
      return part('hfsa', 'plan', 'Change the health FSA only if the amount goes up or down in a way that matches this event. The plan has to allow health FSA election changes.', ['Treas. Reg. 1.125-4(c)(3)']);
    }
    return part('hfsa', health.code, health.summary, health.bases, health.steps);
  }

  function dcapPart(state, health) {
    var event = state.event;
    var a = state.answers || {};
    if (event === 'cost_change' && a.size === 'daycare') {
      if (a.relative === 'no' && (health.code === 'allowed' || health.code === 'plan')) {
        return part('dcap', 'allowed', health.summary, health.bases, health.steps);
      }
      return part('dcap', health.code, health.summary, health.bases, health.steps);
    }
    if (event === 'cost_change') {
      return part('dcap', 'not_permitted', 'A medical premium change does not change the dependent care FSA. If the daycare rate or hours changed, choose that cost reason. A relative\'s rate hike does not qualify. A new provider can.', ['Treas. Reg. 1.125-4(f)(2)(iv) and (f)(6) Examples 5 through 7']);
    }
    if (event === 'aged_out' && a.status === 'turned_13') {
      return part('dcap', 'allowed', health.summary, health.bases, health.steps);
    }
    if (event === 'birth' && a.change === 'add_or_switch') {
      return part('dcap', 'plan', 'A new child can support a higher dependent care election if there are new work-related care costs. The change is prospective. The plan has to allow it.', ['Treas. Reg. 1.125-4(c)(3)(ii)']);
    }
    if (event === 'birth') {
      return part('dcap', 'not_permitted', 'Birth is not a reason to stop dependent care contributions unless the need for care actually ended.', ['Treas. Reg. 1.125-4(c)(3)(ii)']);
    }
    if (event === 'marriage' || event === 'divorce' || event === 'death' || event === 'job_leave' || event === 'aged_out') {
      if (health.code === 'not_permitted') {
        return part('dcap', 'plan', 'Do not copy a "not permitted" medical answer onto dependent care without checking the care facts. Change the dependent care FSA only if this event changes work-related care, who qualifies, the provider, or a non-relative\'s rate.', ['Treas. Reg. 1.125-4(c)(3)(ii) and (f)(2)(iv)']);
      }
      return part('dcap', 'plan', 'Change the dependent care FSA only if this event changes the need for care, who is a qualifying person, the provider, or the cost. A child turning 13, a change in hours of care, or which parent pays for care can fit. A rate change charged by a relative does not. A new daycare provider can, even if the provider is a relative.', ['Treas. Reg. 1.125-4(c)(3)(ii), (f)(2)(iv), and (f)(6) Examples 5 through 7']);
    }
    if (health.code === 'not_permitted' || health.code === 'need_fact') {
      return part('dcap', health.code === 'need_fact' ? 'need_fact' : 'not_permitted', 'This event does not itself change dependent care. Change that election only if work-related care costs or who qualifies also changed.', ['Treas. Reg. 1.125-4(c)(3)(ii)']);
    }
    return part('dcap', 'plan', 'A dependent care change is separate from the medical answer. Allow it only if the need for care, the provider, or a non-relative\'s cost changed, and the plan allows the change.', ['Treas. Reg. 1.125-4(c)(3)(ii)']);
  }

  function dentalPart(state, health) {
    if (health.code === 'not_permitted' || health.code === 'need_fact' || health.code === 'eligibility') {
      return part('dental_vision', health.code, health.summary, health.bases.slice(), health.steps.slice());
    }
    if (health.hipaa) {
      return part(
        'dental_vision',
        'plan',
        'If this dental or vision benefit is an excepted benefit, HIPAA special enrollment does not require the carrier to enroll them. A pre-tax dental or vision election can still change when the Section 125 change-in-status rules match the event. If it is not an excepted benefit, treat it like medical. Confirm with the carrier before you promise enrollment.',
        ['Treas. Reg. 1.125-4(c)', 'HIPAA portability special enrollment does not apply to excepted dental and vision benefits'],
        ['Ask the carrier whether this plan has to accept a special enrollee.']
      );
    }
    return part('dental_vision', health.code, health.summary, health.bases.slice(), health.steps.slice());
  }

  function pretaxPart(state, health) {
    if (health.code === 'not_permitted' || health.code === 'need_fact') {
      return part('pretax_other', health.code, 'A pre-tax voluntary benefit is still a Section 125 election. ' + health.summary, health.bases.slice(), []);
    }
    if (state.event === 'divorce') {
      return part('pretax_other', 'plan', 'Group term life can be increased or decreased after a divorce if the plan allows it. The carrier may still require evidence of insurability. Coverage over $50,000 is taxable. Pre-tax does not make the change automatic.', ['Treas. Reg. 1.125-4(c)(4) Example 6'], ['Ask the carrier about evidence of insurability.']);
    }
    return part(
      'pretax_other',
      'plan',
      'Do not treat a pre-tax life, disability, or other voluntary benefit as automatically allowed. Section 125 still applies, and the change has to match the event. The carrier may require evidence of insurability. Group term life over $50,000 is taxable.',
      ['Treas. Reg. 1.125-4(a) and (c)'],
      ['Confirm the benefit is inside the Section 125 plan.', 'Check evidence of insurability before you tell the employee it is approved.']
    );
  }

  function aftertaxPart() {
    return part(
      'aftertax',
      'carrier',
      'Section 125 does not limit a benefit that is truly paid after tax and sits outside the cafeteria plan. The carrier\'s enrollment rules and evidence of insurability decide it. If employees pay this benefit pre-tax, it is not in this category, and it is not automatically allowed.',
      ['Treas. Reg. 1.125-4 applies to cafeteria plan elections'],
      ['Confirm the deduction is after tax before you rely on this.']
    );
  }

  function hsaPart() {
    return part(
      'hsa',
      'allowed',
      'An HSA paycheck contribution can be started, stopped, or changed for future pay. No qualifying event is required. The change is prospective and cannot be retroactive. Payroll still has a cutoff. If the written plan offers pre-tax HSA contributions, allow these changes at least monthly.',
      ['IRS Notice 2004-50, Q&A-58'],
      ['Put the new amount on a paycheck after the request. Do not redo past checks.']
    );
  }

  function rawPart(id, state, health) {
    if (id === 'medical') return part('medical', health.code, health.summary, health.bases.slice(), health.steps.slice());
    if (id === 'dental_vision') return dentalPart(state, health);
    if (id === 'hfsa') return hfsaPart(state, health);
    if (id === 'dcap') return dcapPart(state, health);
    if (id === 'hsa') return hsaPart();
    if (id === 'pretax_other') return pretaxPart(state, health);
    if (id === 'aftertax') return aftertaxPart();
    return part(id, 'need_fact', 'Unknown benefit.', []);
  }

  function partMode(benefit, baseMode) {
    if (benefit === 'hsa' || benefit === 'aftertax') return 'none';
    if (baseMode === 'gate60' && benefit !== 'medical') return 'gate30from60';
    return baseMode;
  }

  function copyPart(item) {
    return {
      benefit: item.benefit,
      code: item.code,
      text: item.text,
      bases: item.bases.slice(),
      steps: item.steps.slice(),
      rawText: item.rawText || item.text
    };
  }

  function applyTiming(item, state, baseMode) {
    var mode = partMode(item.benefit, baseMode);
    var out = copyPart(item);
    out.rawText = item.text;
    var timing = state.timing;
    if (out.code === 'not_permitted' || out.code === 'need_fact' || out.code === 'carrier') return out;
    if (mode === 'none') return out;
    if (mode === 'record') {
      if (timing === 'over_30' || timing === 'unknown') {
        out.text += ' The usual 30-day election window is not what decides this eligibility change. Finish the update. If that election window is already closed, later premiums should not stay pre-tax.';
      }
      return out;
    }
    if (mode === 'gate30from60') {
      if (timing === 'unknown' || !timing) {
        out.code = 'need_fact';
        out.text = 'Confirm the date. The 60-day Medicaid and CHIP window is for the group health plan. This benefit uses the plan\'s normal window, usually 30 days.';
        return out;
      }
      if (timing === 'over_60') {
        out.code = 'late';
        out.text = LATE30;
        out.bases = out.bases.concat(['Plan window, usually 30 days. The 60-day CHIP rule is for the group health plan.']);
        return out;
      }
      out.text += ' The 60-day clock is for Medicaid and CHIP enrollment in the group health plan. For this benefit, also check the plan\'s normal window, usually 30 days.';
      return out;
    }
    if (timing === 'unknown' || !timing || timing === 'not_applicable') {
      out.code = 'need_fact';
      out.text = mode === 'gate60'
        ? 'Confirm the date. Medicaid and CHIP special enrollment uses 60 days. Do not approve or refuse this until you have it.'
        : 'Confirm the date. The usual window is 30 days unless the plan document allows longer. Do not approve or refuse this until you have it.';
      return out;
    }
    var late = (mode === 'gate30' && timing === 'over_30') || (mode === 'gate60' && timing === 'over_60');
    if (!late) return out;
    out.code = 'late';
    out.text = mode === 'gate60' ? LATE60 : LATE30;
    out.bases = out.bases.concat([mode === 'gate60' ? 'ERISA section 701(f)(3) 60-day period' : 'Plan\'s election window, treated here as 30 days unless the document is longer']);
    return out;
  }

  function unique(list) {
    var out = [];
    list.forEach(function (item) {
      if (item && out.indexOf(item) === -1) out.push(item);
    });
    return out;
  }

  function rollup(parts) {
    var codes = unique(parts.map(function (item) { return item.code; }));
    if (codes.length === 1) return codes[0];
    var proceed = { allowed: true, eligibility: true, plan: true, carrier: true };
    var allProceed = codes.every(function (code) { return proceed[code]; });
    if (allProceed) {
      if (codes.indexOf('eligibility') !== -1) return 'eligibility';
      if (codes.indexOf('allowed') !== -1) return 'allowed';
      if (codes.indexOf('plan') !== -1) return 'plan';
      return 'carrier';
    }
    if (codes.length === 1) return codes[0];
    var negatives = codes.filter(function (code) { return code === 'late' || code === 'not_permitted' || code === 'need_fact'; });
    if (negatives.length === codes.length) {
      if (codes.length === 1) return codes[0];
      return 'split';
    }
    return 'split';
  }

  function benefitLabel(id) {
    for (var i = 0; i < BENEFITS.length; i++) {
      if (BENEFITS[i].id === id) return BENEFITS[i].label;
    }
    return id;
  }

  function eventLabel(id) {
    for (var i = 0; i < EVENTS.length; i++) {
      if (EVENTS[i].id === id) return EVENTS[i].label;
    }
    return id || '';
  }

  function evaluate(state) {
    var safe = {
      event: state.event,
      benefits: (state.benefits || []).slice(),
      answers: Object.assign({}, state.answers || {}),
      timing: state.timing || ''
    };
    var baseMode = windowMode(safe);
    var health = decideHealth(safe);
    var parts = safe.benefits.map(function (id) {
      return applyTiming(rawPart(id, safe, health), safe, baseMode);
    });
    var code = parts.length ? rollup(parts) : 'need_fact';
    var primary = null;
    parts.forEach(function (item) {
      if (!primary && item.benefit === 'medical') primary = item;
    });
    if (!primary && parts.length) primary = parts[0];
    var summary = primary ? primary.text : health.summary;
    var steps = [];
    if (code === 'late') {
      summary = baseMode === 'gate60' && primary && primary.benefit === 'medical' ? LATE60 : (primary && primary.code === 'late' ? primary.text : LATE30);
      steps = [
        'Confirm the event date and the date the employee asked.',
        'If the plan document allows a longer window, follow the document.',
        'If the window is closed, the employee generally waits for the next open enrollment unless a different event applies.'
      ];
      if (primary && primary.rawText && primary.code === 'late') {
        steps.push('Inside the usual window, the answer would have been: ' + clip(primary.rawText, 280));
      }
      if (safe.event === 'divorce' && safe.answers.change === 'drop_spouse') steps.push(DIVORCE_LATE_LINE);
    } else if (code === 'split') {
      summary = 'Each benefit below has its own answer. Do not use one benefit\'s answer for the others.';
      steps = ['Read every benefit before you tell the employee yes or no.'];
    } else if (primary) {
      steps = primary.steps.slice();
    }
    parts.forEach(function (item) {
      item.steps.forEach(function (step) {
        if (steps.indexOf(step) === -1 && code !== 'late') steps.push(step);
      });
    });
    if (code === 'split' && safe.event === 'divorce' && safe.answers.change === 'drop_spouse' && parts.some(function (item) { return item.code === 'late'; })) {
      steps.push(DIVORCE_LATE_LINE);
    }
    var bases = [];
    parts.forEach(function (item) {
      item.bases.forEach(function (basis) {
        if (bases.indexOf(basis) === -1) bases.push(basis);
      });
    });
    var nudge = code !== 'carrier' && !(safe.event === 'other' && code === 'need_fact');
    return {
      code: code,
      title: TITLES[code] || code,
      summary: summary,
      steps: steps,
      parts: parts.map(function (item) {
        return {
          benefit: item.benefit,
          label: benefitLabel(item.benefit),
          code: item.code,
          title: TITLES[item.code] || item.code,
          text: item.text
        };
      }),
      nudge: nudge,
      nudgeUrl: PLAN_URL,
      bases: bases,
      window: baseMode
    };
  }

  function clip(text, max) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return clean.slice(0, max - 3) + '...';
  }

  function pathId(state) {
    var keys = Object.keys(state.answers || {}).sort();
    var answers = keys.map(function (key) { return key + '=' + state.answers[key]; }).join(',');
    return [state.event, (state.benefits || []).slice().sort().join('+'), answers, state.timing || 'na'].join('~');
  }

  function cloneState(state) {
    return {
      event: state.event,
      benefits: state.benefits.slice(),
      answers: Object.assign({}, state.answers),
      timing: state.timing || ''
    };
  }

  function enumerate() {
    var out = [];
    EVENTS.forEach(function (event) {
      PROFILES.forEach(function (benefits) {
        walk({ event: event.id, benefits: benefits.slice(), answers: {}, timing: '' }, out, 0);
      });
    });
    out.sort(function (a, b) {
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
    return out;
  }

  function walk(state, out, depth) {
    if (depth > 8) throw new Error('Question depth overflow for ' + state.event);
    var questions = visibleQuestions(state);
    var pending = null;
    for (var i = 0; i < questions.length; i++) {
      if (!state.answers[questions[i].id]) {
        pending = questions[i];
        break;
      }
    }
    if (pending) {
      pending.options.forEach(function (opt) {
        var next = cloneState(state);
        next.answers[pending.id] = opt.value;
        walk(next, out, depth + 1);
      });
      return;
    }
    timingOptions(windowMode(state)).forEach(function (timing) {
      var next = cloneState(state);
      next.timing = timing.value;
      next.id = pathId(next);
      out.push(next);
    });
  }

  function scenario(state) {
    var result = evaluate(state);
    var questions = visibleQuestions(state);
    var change = { id: '', label: '' };
    var followups = [];
    questions.forEach(function (question) {
      var value = state.answers ? state.answers[question.id] : '';
      var entry = {
        id: question.id,
        question: question.prompt,
        value: value || '',
        label: optionLabel(state.event, question.id, value)
      };
      if (question.id === 'change' || question.id === 'hsa_change' || (!change.id && question.id !== 'who' && question.id !== 'reason')) {
        if (question.id === 'change' || question.id === 'hsa_change' || !change.id) {
          if (question.id === 'change' || question.id === 'hsa_change' || change.id === '') change = { id: value || question.id, label: entry.label || question.prompt };
        }
      }
      if (question.id !== 'change' && question.id !== 'hsa_change') followups.push(entry);
    });
    if (!change.id) {
      var keys = Object.keys(state.answers || {});
      change = { id: keys.length ? state.answers[keys[0]] : 'unspecified', label: keys.length ? optionLabel(state.event, keys[0], state.answers[keys[0]]) : 'Unspecified' };
    }
    var mode = windowMode(state);
    var timingLabel = 'Not applicable';
    timingOptions(mode).forEach(function (timing) {
      if (timing.value === state.timing) timingLabel = timing.label;
    });
    return {
      event: { id: state.event, label: eventLabel(state.event) },
      change: change,
      timing: { id: state.timing || 'not_applicable', label: timingLabel },
      coverage: (state.benefits || []).map(function (id) { return { id: id, label: benefitLabel(id) }; }),
      followups: followups,
      result: result
    };
  }

  function scenariosMarkdown(paths) {
    var list = paths || enumerate();
    var counts = {};
    list.forEach(function (state) {
      var code = evaluate(state).code;
      counts[code] = (counts[code] || 0) + 1;
    });
    var lines = [];
    lines.push('# Qualifying event scenarios');
    lines.push('');
    lines.push('General rules for employers and HR, reviewed against the citations below in October 2026. The employer\'s plan document and the carrier\'s rules govern. This is not legal or tax advice.');
    lines.push('');
    lines.push('Path count: ' + list.length + '.');
    lines.push('');
    lines.push('## Result counts');
    lines.push('');
    Object.keys(counts).sort().forEach(function (code) {
      lines.push('- ' + code + ': ' + counts[code]);
    });
    lines.push('');
    lines.push('## What changed and why');
    lines.push('');
    lines.push('- The page is full width, with the same navy banner, gold rule, eyebrow, serif title, white cards, and stepper as the other DK Benefits tools. The old tool was a fixed 639 by 720 box with an inner scrollbar and a blank gap under the choices.');
    lines.push('- The step counter lists the same steps as the stepper, including the result. The old screen said Step 1 of 4 next to five dots.');
    lines.push('- Emoji choices are gone. Choices are text, in the same pattern as the Section 128 and wrap plan tools.');
    lines.push('- Gold actions use #16233A text and do not use a blue focus outline.');
    lines.push('- The page posts its height so the Wix shim can size the frame. The tool itself does not scroll inside a short panel.');
    lines.push('- Over 30 days now reads as past the standard window, generally not allowed unless the plan allows a longer window. It does not say the request is illegal.');
    lines.push('- Medicaid and CHIP loss of eligibility, and premium assistance, use 60 days. Coverage is effective no later than the first of the month after the plan receives the request. Medicare is its own event and uses the normal window. Gaining Medicaid is a reason to drop or reduce that person, not a 60-day enrollment right.');
    lines.push('- A drop after someone gains other coverage is allowed only for the people that other plan covers.');
    lines.push('- Marriage can add the spouse\'s children, enroll an employee who had waived, and switch benefit package. Coverage starts no later than the first of the next month after the request, not on the wedding date.');
    lines.push('- Birth, adoption, and placement can enroll the employee and spouse as well as the child, and the elected coverage starts on the event date. A drop is not allowed for the birth itself.');
    lines.push('- Divorce lets the employee remove the former spouse. The removal is effective under the plan\'s eligibility rule, and the Section 125 election uses the standard 30-day window. A late report gets that window answer, plus one line telling HR to ask the carrier whether it will accept a late or retro removal and what its policy is. The carrier question is not the main answer. Divorce still does not let the employee drop themselves or a child who is still eligible.');
    lines.push('- Loss of other coverage now asks why it ended. Eligibility losses, the other employer stopping contributions, and exhaustion of COBRA can be special enrollment. A chosen drop, nonpayment, or fraud is not. Ending COBRA early is not exhaustion.');
    lines.push('- Job and hours changes now separate a new eligibility, a lost eligibility, an hour cut where the employee stays eligible (Notice 2014-55 only if the plan was amended), FMLA, and USERRA.');
    lines.push('- Death asks who died. Removing someone still living is not allowed. Death of the employee points to COBRA for survivors.');
    lines.push('- A court order can enroll a child, and can remove a child only when the order requires someone else to cover the child and that coverage is in place.');
    lines.push('- Cost changes are changes the employer makes during the year, such as raising premiums or cutting its contribution, under Treas. Reg. 1.125-4(f). An employee who changes their own tier or class is handled as a change in employment status, not as a cost change. Coverage changes follow the curtailment, new-option, and other-employer rules. A health FSA cannot be changed for those events.');
    lines.push('- Dependent care has its own answers, including a non-relative rate change, a provider change, and a child turning 13.');
    lines.push('- An HSA paycheck change is prospective and does not need a qualifying event. After-tax benefits outside the cafeteria plan follow the carrier, not a blanket "generally allowed." Pre-tax voluntary benefits still follow Section 125.');
    lines.push('- The result screen keeps the link to the Section 125 plan document tool. No contact form was added. `window.QE.scenario` holds the event, change, timing, coverage, follow-ups, and result for a later form.');
    lines.push('');
    lines.push('## Points that need a human confirmation');
    lines.push('');
    lines.push('- Whether a particular dental or vision plan is an excepted benefit. That decides whether HIPAA special enrollment forces the carrier to enroll.');
    lines.push('- What a plan treats as a significant cost increase. The regulation does not set a percentage. The tool treats the event as the employer changing the cost, and sends an employee tier or class change to the job event.');
    lines.push('- A health FSA decrease when medical coverage moves to a spouse\'s plan. An increase on marriage is in the examples. That decrease is less explicit, so the tool says to check the document.');
    lines.push('- Notice 2014-55 is optional, needs an amendment, and depends on the employee\'s other coverage starting on time. The tool does not decide affordability or full-time status under section 4980H.');
    lines.push('- Proposed cafeteria plan rules are widely followed for monthly HSA election changes. The solid cite used here is IRS Notice 2004-50, Q&A-58, which says the change must be prospective.');
    lines.push('');
    lines.push('## How to read a row');
    lines.push('');
    lines.push('Each row is one path the tool can take. Coverage lists the benefits in that path. The result code is the headline. Bases are the rules the answer uses. The same path is asserted in `qualifying-event/test/paths.test.js`.');
    lines.push('');
    lines.push('Codes: allowed (generally process), late (past the usual window), plan (only if the document, and sometimes a Notice 2014-55 amendment, allows it), eligibility (process because the person is no longer eligible or an order requires enrollment), not_permitted, need_fact, carrier (after-tax, outside Section 125), split (benefits disagree).');
    lines.push('');
    var current = '';
    list.forEach(function (state) {
      if (state.event !== current) {
        current = state.event;
        lines.push('## ' + eventLabel(current));
        lines.push('');
        lines.push('| Path | Change and follow-ups | Timing | Coverage | Result | Basis |');
        lines.push('| --- | --- | --- | --- | --- | --- |');
      }
      var view = scenario(state);
      var result = view.result;
      var changeBits = [view.change.label || view.change.id];
      view.followups.forEach(function (item) {
        changeBits.push(item.label || item.value);
      });
      var basis = result.bases.join('; ');
      lines.push('| ' + [
        state.id.replace(/\|/g, '/'),
        changeBits.join('; ').replace(/\|/g, '/'),
        view.timing.label.replace(/\|/g, '/'),
        view.coverage.map(function (item) { return item.label; }).join(', '),
        result.code + ': ' + clip(result.summary, 160).replace(/\|/g, '/'),
        basis.replace(/\|/g, '/')
      ].join(' | ') + ' |');
    });
    lines.push('');
    return lines.join('\n');
  }

  return {
    PLAN_URL: PLAN_URL,
    LATE30: LATE30,
    LATE60: LATE60,
    DIVORCE_LATE_LINE: DIVORCE_LATE_LINE,
    EVENTS: EVENTS,
    BENEFITS: BENEFITS,
    PROFILES: PROFILES,
    TITLES: TITLES,
    visibleQuestions: visibleQuestions,
    windowMode: windowMode,
    timingOptions: timingOptions,
    timingPrompt: timingPrompt,
    evaluate: evaluate,
    enumerate: enumerate,
    scenario: scenario,
    scenariosMarkdown: scenariosMarkdown,
    pathId: pathId,
    eventLabel: eventLabel,
    benefitLabel: benefitLabel
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QEModel;
}
