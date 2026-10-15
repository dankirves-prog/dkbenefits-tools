/**
 * Plain-English help. Shown from the (i) control beside the matching field.
 */
var WpTips = (function () {
  var TIPS = {
    plan_number: 'Welfare plans use a three-digit number from 501 through 999. 501 is the usual first welfare plan.',
    ein: 'This is the employer\'s federal employer identification number. Type the digits. The hyphen is added for you.',
    employee_count: 'About how many employees did you have last year, full-time and part-time? This is a headcount, not a full-time-equivalent calculation.',
    restatement: 'A restatement replaces an older wrap with this one. The plan keeps the date it first started. That original date is asked only when you answer yes.',
    wrap_effective: 'This is the date this wrap plan document takes effect. If this is a restatement, it is the date of the restatement.',
    census_a: 'Count each current employee once if that person is enrolled in, or automatically covered by, at least one wrapped benefit. Employer-paid benefits that need no enrollment, such as basic life, count everyone eligible.',
    census_b: 'Current employees who are not already in the first count and who contribute, for example a health FSA only.',
    census_c: 'Former employees on COBRA.',
    census_d: 'Covered retirees. Do not count dependents.',
    cobra: 'Federal COBRA applies when the employer had 20 or more employees on more than half of its typical business days in the prior calendar year. Count a part-timer as a fraction: hours that person worked, divided by full-time hours. Count related employers together.',
    certificates: 'The wrap works only if each certificate or booklet is attached. Answering no does not stop the download. The findings report will remind you.',
    vol_consideration: 'The safe harbor also asks whether the employer receives any payment for offering the benefit, beyond reasonable pay for collecting payroll deductions.',
    agent: 'This is the person who receives a lawsuit for the plan. It can be the employer.',
    phi: 'Protected health information is health information that identifies a person, beyond a simple list of who is enrolled. Self-funded and level-funded plans usually need the privacy amendment because the employer sees claim information to run the plan.',
    discretion: 'This clause lets the plan administrator interpret the plan. Some states do not allow it in an insured policy. You can leave it out.',
    trust: 'Money held in a trust or a separate account is a plan asset. A trust usually means a Form 5500 filing, even when the covered-person count is under 100.',
    filing: 'Form 5500 is the annual report some welfare plans file with the federal government. A prior small-plan filing does not keep a plan off the filing list once the covered-person count reaches 100.',
    remitted: 'Employee premium that the employer sends to the insurer within three months can still fit the small-plan filing exemption for an insured plan that has no trust.',
    section125: 'A cafeteria plan lets employees pay some premiums before tax. It is a separate document. This wrap is not that plan.',
    waiting_period: 'This is how long a new employee waits before coverage starts. A group health plan cannot make a person wait more than 90 days, so coverage can start on the 90th day. A plan may use an orientation period of up to one month before that 90-day clock starts. One month means one calendar month minus one day. First of the month after 90 days runs past 90 days for most hire dates, so it is not listed. Life and disability can use a different wait.',
    funding: 'Fully insured means an insurance company pays the claims. Level-funded and the self-funded choices mean the employer pays the claims, usually through a third-party administrator.',
    stop_loss: 'The stop-loss policy covers the employer, not participants.',
    hra_type: 'An integrated HRA works with the group medical plan. An excepted-benefit HRA is limited. An individual coverage HRA works with individual insurance. A qualified small employer HRA is for a small employer that does not offer a group health plan.',
    appeals: 'This is who makes the last internal decision on a medical claim. For a fully insured plan, that is the insurance company, so this question stays hidden.'
  };
  function text(id) { return TIPS[id] || ''; }
  return { TIPS: TIPS, text: text };
})();
