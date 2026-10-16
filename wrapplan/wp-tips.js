/**
 * Plain-English help. Shown from the (i) control beside the matching question.
 */
var WpTips = (function () {
  var TIPS = {
    ein: 'This is the employer\'s federal employer identification number. Type the digits. The hyphen is added for you.',
    business_type: 'The business type sets who adopts the plan. An LLC is adopted by its members. A corporation or nonprofit is adopted by its board, and you can change that on the last step.',
    plan_year: 'The plan year is the 12 months the plan uses for filings and notices. Usually the month your medical plan renews. January is a calendar year. Any other start month ends the month before.',
    first_wrap: 'Choose yes if this is the first wrap plan document for these benefits. Choose no if it replaces an older document, and then enter the date the benefits first started.',
    effective: 'This is the date this document takes effect. Most employers use the start of the current plan year. If it replaces an older document, this is the date the new one takes over.',
    plan_name: 'The plan name is printed on the documents. Welfare plans use a number from 501 through 999, and 501 is the usual first welfare plan.',
    employee_count: 'Include part-time employees and any related companies you own. This headcount decides whether the federal COBRA question is shown. Under 20, federal COBRA does not apply. It is also used for the small-plan size tests.',
    funding: 'Fully insured means you pay a premium and the insurer pays the claims. The other choices mean you fund the claims, usually through a third-party administrator.',
    tpa_document: 'This is the booklet or plan document the administrator gives you for the medical plan. The wrap names it, and employees receive it with the summary.',
    stop_loss: 'Stop-loss covers the employer, not the employees. It is not a benefit you list for them.',
    who_pays: 'Employer pays means employees pay nothing for that benefit. Employees pay, pre-tax is a payroll deduction before income tax, which needs a Section 125 plan. Employees pay, after tax comes out of pay the employee already paid tax on.',
    self_funded: 'Leave this unchecked when an insurance company pays the claims. Check it when the employer pays the claims for this benefit.',
    hra_type: 'An integrated HRA works with the group medical plan. An excepted benefit HRA is limited, and an individual coverage HRA works with individual insurance. A small employer HRA is for an employer that does not offer a group health plan.',
    eap_type: 'Counseling sessions are a real benefit, so the plan includes the program. A line that only refers people to outside help is left out of the plan.',
    std_type: 'An insured policy is part of the plan. Pay from the employer\'s general assets is usually a payroll practice and is left out. Pay from a trust is part of the plan, and that fund is plan money.',
    vol_include: 'Include these benefits when the plan should describe them. Leave them out only for a true add-on that the employer does not pay for, promote, or get paid to offer.',
    classes: 'Name the group that can join, such as all full-time employees. The plan and the summary both print this line, so match it to the certificates.',
    waiting_period: 'You may add an orientation period of up to one month before the 90-day wait. One month means one calendar month minus one day. First of the month after 90 days is not listed, because coverage would start late for most hire dates, and life or disability can use a different wait.',
    census: 'This is the count used for Form 5500. A plan with 100 covered people on the first day of a plan year has to file.',
    section125: 'A cafeteria plan, sometimes called a premium-only plan, lets employees pay some premiums before tax. It is a separate document. This wrap is not that plan.',
    cobra: 'Yes means federal COBRA applies, and the plan names who sends the notices. No means federal COBRA does not apply. State continuation may still apply, and the certificate describes it.',
    cobra_who: 'This is who the plan names as the sender of COBRA notices. It can be the employer, the insurance company, or a COBRA administrator.',
    appeals: 'This is who makes the last internal decision on a medical claim. The TPA is the usual answer. Choose the employer only if the agreement says the employer decides that appeal.',
    phi: 'Protected health information is health information that identifies a person, beyond a list of who is enrolled. Name the jobs that may see it to run the plan. You can leave this blank and fill it in before you sign.',
    trust: 'Money held in a trust or a separate account is plan money. A trust usually means a Form 5500 filing, even when fewer than 100 people are covered.',
    bargaining: 'Answer yes if a union contract sets any of these benefits. The plan will say that the contract controls those bargained benefits.',
    discretion: 'This clause lets the plan administrator interpret the plan. Some states limit it in an insured policy. You can leave it out.',
    admin: 'The plan administrator runs the plan and is named in the summary. For most employers, that is the company. Choose someone else only if a different person or firm is the administrator.',
    agent: 'This is who receives a lawsuit for the plan. It can be the company. Service may also be made on the plan administrator.',
    signer: 'This name and title print on the signature pages. The date line stays blank until the day you actually sign.'
  };
  function text(id) { return TIPS[id] || ''; }
  return { TIPS: TIPS, text: text };
})();
