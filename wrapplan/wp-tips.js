/**
 * Plain-English help. Shown beside the matching field.
 */
var WpTips = (function () {
  var TIPS = {
    plan_number: 'Welfare plans use a three-digit number from 501 through 999. 501 is the usual first welfare plan.',
    employee_count: 'About how many employees did you have last year, full-time and part-time? This is a headcount, not a full-time-equivalent calculation.',
    census_a: 'Count each current employee once if that person is enrolled in, or automatically covered by, at least one wrapped benefit. Employer-paid benefits that need no enrollment, such as basic life, count everyone eligible.',
    census_b: 'Current employees who are not already in the first count and who contribute, for example a health FSA only.',
    census_c: 'Former employees on COBRA.',
    census_d: 'Covered retirees. Do not count dependents.',
    cobra: 'Federal COBRA looks at the prior calendar year. Count employees of related companies under common control. A part-timer counts as a fraction: hours worked divided by full-time hours. See 26 CFR 54.4980B-2, Q&A-5.',
    certificates: 'The wrap works only if each certificate or booklet is attached. Answering no does not stop the download. The findings report will remind you.',
    vol_consideration: 'The safe harbor also asks whether the employer receives any payment for offering the benefit, beyond reasonable pay for collecting payroll deductions.',
    agent: 'Service of process is on the employer unless you name someone else.',
    phi: 'Self-funded and level-funded plans usually need the privacy amendment because the employer sees claim information to run the plan.'
  };
  function text(id) { return TIPS[id] || ''; }
  return { TIPS: TIPS, text: text };
})();
