/**
 * Wrap plan sample documents.
 * Word uses Calibri. The PDF uses Times because the vendored pdf-lib has no fontkit.
 */
var WpDocgen = (function () {
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function xml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function row(style, text, extra) {
    var item = { style: style, text: text };
    if (extra) Object.keys(extra).forEach(function (key) { item[key] = extra[key]; });
    return item;
  }
  function h1(text) { return row('Heading1', text, { keepNext: true, keepLines: true }); }
  function h2(text) { return row('Heading2', text, { keepNext: true, keepLines: true }); }
  function longDate(iso) {
    var match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return String(iso || '');
    var month = MONTHS[parseInt(match[2], 10)] || match[2];
    return month + ' ' + parseInt(match[3], 10) + ', ' + match[1];
  }
  function carrier(plan, code) {
    return (plan.carriers && plan.carriers[code]) || 'the carrier named for this benefit';
  }
  function adminName(plan) {
    if (plan.admin_choice === 'custom' && plan.admin_name) return plan.admin_name;
    return plan.employer_name;
  }
  function agentSentence(plan) {
    if (plan.agent_choice === 'custom' && plan.agent_name) {
      return 'The agent for service of legal process is ' + plan.agent_name + (plan.agent_address ? ', ' + plan.agent_address : '') + '. Service of legal process may also be made on the plan administrator.';
    }
    return 'The agent for service of legal process is ' + plan.employer_name + ', ' + plan.address + '. Service of legal process may also be made on the plan administrator.';
  }
  function fundingSentence(plan) {
    if (plan.funding === 'insured') return 'Medical benefits are fully insured. The insurer administers claims under the certificate.';
    if (plan.funding === 'level') return 'Medical benefits are self-funded under a level-funded arrangement. ' + (plan.tpa_name || 'The TPA') + ' administers claims. The employer is the named fiduciary. Benefits are paid from the employer\'s general assets.';
    if (plan.funding === 'aso') return 'Medical benefits are self-funded. ' + (plan.tpa_name || 'The TPA') + ' administers claims under an administrative-services arrangement. The employer is the named fiduciary. Benefits are paid from the employer\'s general assets.';
    if (plan.funding === 'captive') return 'Medical benefits are self-funded through a captive arrangement. ' + (plan.tpa_name || 'The TPA') + ' administers claims. The employer is the named fiduciary.';
    if (plan.funding === 'rbp') return 'Medical benefits are self-funded and use reference-based pricing. ' + (plan.tpa_name || 'The TPA') + ' administers claims. The employer is the named fiduciary.';
    return 'Each benefit is administered as its certificate or booklet describes.';
  }
  function taxSentence(plan, code) {
    var tax = (plan.tax && plan.tax[code]) || '';
    if (tax === 'pretax') return ' Employee contributions for this benefit are intended to be pre-tax under a separate Section 125 plan. This wrap is not that plan.';
    if (tax === 'aftertax') return ' Employee contributions for this benefit are taken after tax.';
    if (tax === 'none') return ' The employer does not take an employee contribution for this benefit.';
    return '';
  }
  function cobraParagraph(plan) {
    if (!WpModel.groupHealth(plan)) return '';
    if (plan.cobra === 'yes' || plan.cobra === 'unsure') {
      var who = plan.cobra_admin || 'the plan administrator';
      return 'Federal COBRA continuation coverage applies to the group health benefits under this plan to the extent the employer met the federal employee threshold in the prior calendar year. COBRA is administered by ' + who + '. The general notice and the election notice are part of this package. Those notices state the qualifying events, the election steps, and the deadlines.';
    }
    if (plan.cobra === 'no' && plan.funding === 'insured') {
      return 'Federal COBRA is not stated as applicable based on the employer\'s answer. State continuation coverage may be available. The certificate and state law control.';
    }
    if (plan.cobra === 'no') return 'Federal COBRA is not stated as applicable based on the employer\'s answer.';
    return '';
  }
  function erisaRights() {
    return [
      'As a participant in the plan, you are entitled to certain rights and protections under the Employee Retirement Income Security Act of 1974. ERISA provides that all plan participants shall be entitled to:',
      'Examine, without charge, at the plan administrator\'s office and at other specified locations, all documents governing the plan, including insurance contracts and a copy of the latest annual report, if any, filed by the plan with the U.S. Department of Labor.',
      'Obtain, upon written request to the plan administrator, copies of documents governing the operation of the plan, including insurance contracts and copies of the latest annual report, if any, and an updated summary plan description. The administrator may make a reasonable charge for the copies.',
      'Receive a summary of the plan\'s annual financial report if the plan is required to file an annual report. The plan administrator is required by law to furnish each participant with a copy of this summary annual report.',
      'Prudent actions by plan fiduciaries. In addition to creating rights for plan participants, ERISA imposes duties upon the people who are responsible for the operation of the employee benefit plan. The people who operate your plan, called fiduciaries, have a duty to do so prudently and in the interest of you and other plan participants and beneficiaries.',
      'Enforce your rights. If your claim for a benefit is denied or ignored, in whole or in part, you have a right to know why this was done, to obtain copies of documents relating to the decision without charge, and to appeal any denial, all within certain time schedules. Under ERISA, there are steps you can take to enforce the above rights. For instance, if you request a copy of plan documents or the latest annual report from the plan and do not receive them within 30 days, you may file suit in a Federal court. In such a case, the court may require the plan administrator to provide the materials and pay you up to $110 a day until you receive the materials, unless the materials were not sent because of reasons beyond the control of the administrator.',
      'If you have a claim for benefits which is denied or ignored, in whole or in part, you may file suit in a state or Federal court. If it should happen that plan fiduciaries misuse the plan\'s money, or if you are discriminated against for asserting your rights, you may seek assistance from the U.S. Department of Labor, or you may file suit in a Federal court. The court will decide who should pay court costs and legal fees. If you are successful the court may order the person you have sued to pay these costs and fees. If you lose, the court may order you to pay these costs and fees, for example, if it finds your claim is frivolous.',
      'If you have any questions about your plan, you should contact the plan administrator. If you have any questions about this statement or about your rights under ERISA, or if you need assistance in obtaining documents from the plan administrator, you should contact the nearest office of the Employee Benefits Security Administration, U.S. Department of Labor, or the Division of Technical Assistance and Inquiries, Employee Benefits Security Administration, U.S. Department of Labor, 200 Constitution Avenue N.W., Washington, D.C. 20210. You may also find answers at the Employee Benefits Security Administration website.'
    ];
  }
  function signatureRows(plan) {
    return [
      h1('Adoption'),
      row(null, 'The employer adopts this document when the authorized person signs it. The signature line and the date line are blank until that signature.'),
      row(null, 'Authorized signature: ________________________________'),
      row(null, 'Date: ________________________________'),
      row(null, 'Name: ' + plan.signer_name),
      row(null, 'Title: ' + plan.signer_title),
      row(null, 'Governing body: ' + (plan.governing_body || 'The governing body named by the employer'))
    ];
  }
  function planParagraphs(plan) {
    var rows = [];
    var benefits = WpModel.wrappedBenefits(plan);
    rows.push(row('Title', plan.plan_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Wrap plan document and summary plan description'));
    rows.push(row(null, WpModel.DISCLAIMER));
    rows.push(h1('Plan identity'));
    rows.push(row(null, 'Plan sponsor: ' + plan.employer_name + '. EIN ' + plan.employer_ein + '. Address: ' + plan.address + '. Phone: ' + (plan.phone || 'the number on the employer\'s records') + '.'));
    rows.push(row(null, 'Plan number: ' + plan.plan_number + '. ' + WpModel.planYearSentence(plan)));
    if (plan.is_restatement === 'yes') {
      rows.push(row(null, 'This document restates the plan originally effective ' + longDate(plan.original_effective_date) + '. This restatement is effective ' + longDate(plan.restatement_date) + '.'));
    } else {
      rows.push(row(null, 'The plan is effective ' + longDate(plan.original_effective_date) + '.'));
    }
    rows.push(row(null, 'This is an employee welfare benefit plan. ' + fundingSentence(plan)));
    rows.push(h1('Plan administrator and service of process'));
    rows.push(row(null, 'The plan administrator is ' + adminName(plan) + '. The administrator\'s address and phone are the sponsor\'s unless a different administrator address is on file.'));
    rows.push(row(null, agentSentence(plan)));
    if (plan.trust === 'yes') {
      rows.push(row(null, 'The trustee is ' + plan.trustee_name + (plan.trustee_address ? ', ' + plan.trustee_address : '') + '.'));
    }
    if (plan.bargaining === 'yes') {
      rows.push(row(null, 'Some benefits are maintained under a collective bargaining agreement. A copy of that agreement is available from the plan administrator on request.'));
    }
    rows.push(h1('Benefits wrapped under this plan'));
    rows.push(row(null, 'The following benefits are part of this plan. The certificate, booklet, or TPA document for each benefit is incorporated by reference.'));
    benefits.forEach(function (code) {
      var line = WpModel.benefitLabel(code) + ' is provided through ' + carrier(plan, code) + '.';
      if (code === 'hra' && plan.hra_type) line += ' The HRA type is ' + plan.hra_type + '. The separate HRA document is incorporated.';
      if (code === 'health_fsa') line += ' The separate health FSA document is incorporated.';
      if (code === 'medical' && plan.network === 'traditional') line += ' Benefits are provided through a provider network named in the certificate.';
      if (code === 'medical' && (plan.network === 'rbp' || plan.funding === 'rbp')) {
        line += ' Reference-based pricing can leave a balance bill. The No Surprises Act protects you for emergency care, certain non-emergency care at an in-network facility, and air ambulance services, as that law applies. The certificate controls the detail.';
      }
      var wait = plan.waiting && plan.waiting[code];
      if (wait) line += ' Waiting period: ' + wait + '.';
      line += taxSentence(plan, code);
      rows.push(row(null, line));
    });
    if (plan.tpa_document && WpModel.isSelfFundedFunding(plan.funding)) {
      rows.push(row(null, 'The TPA plan document or SPD named "' + plan.tpa_document + '" is incorporated for the self-funded medical benefit.'));
    }
    rows.push(h2('Order of control'));
    rows.push(row(null, 'The certificate or self-funded booklet controls covered services, exclusions, and dependent rules for that benefit. The carrier or TPA booklet controls the claim steps and the address for that benefit. This wrap controls the ERISA frame: name, number, sponsor, administrator, fiduciary, agent for service, plan year, amendment, and termination. Enrollment records show who elected what. They do not add a benefit the certificate does not provide. If this wrap reads richer than the certificate, the certificate still controls, and the employer should issue a summary of material modifications.'));
    rows.push(h1('Eligibility'));
    rows.push(row(null, 'Eligible classes: ' + (plan.classes || 'the classes named by the employer') + '. Hours: ' + (plan.hours || 'the hours requirement in the certificate') + '. Dependents: ' + (plan.dependents || 'the dependent categories in the certificate') + '.'));
    rows.push(row(null, 'Coverage may end when employment ends, when eligibility ends, when enrollment is missed, when a required contribution is not paid, when dependent status ends, when the plan is amended or terminated, or when the certificate states a tighter rule.'));
    rows.push(h1('Contributions'));
    if (plan.employee_contributions === 'yes' && plan.remitted === 'yes') {
      rows.push(row(null, 'Where employees contribute, the employer remits those amounts to the carrier or TPA.'));
    } else if (plan.employee_contributions === 'yes') {
      rows.push(row(null, 'Employees contribute toward one or more benefits, as the enrollment materials describe.'));
    } else {
      rows.push(row(null, 'The employer pays the cost of the wrapped benefits except as a certificate states otherwise.'));
    }
    rows.push(row(null, WpModel.REVERSION));
    rows.push(h1('Claims'));
    if (plan.funding === 'insured') {
      rows.push(row(null, 'The insurer decides medical claims under the certificate. You may get a copy of the claim procedure from the plan administrator without charge.'));
    } else if (plan.appeals === 'employer') {
      rows.push(row(null, (plan.tpa_name || 'The TPA') + ' administers claims. The employer decides the final internal appeal. You may get a copy of the claim procedure from the plan administrator without charge.'));
    } else {
      rows.push(row(null, (plan.tpa_name || carrier(plan, 'medical')) + ' administers claims. The employer is the named fiduciary. You may get a copy of the claim procedure from the plan administrator without charge.'));
    }
    if (WpModel.hasBenefit(plan, 'medical')) {
      rows.push(row(null, 'Medical claims that are subject to external review follow the external review process in the certificate.'));
    }
    if (WpModel.groupHealth(plan)) {
      rows.push(h1('Group health notices'));
      var cobra = cobraParagraph(plan);
      if (cobra) rows.push(row(null, cobra));
      rows.push(row(null, 'The plan has written procedures for qualified medical child support orders, including a National Medical Support Notice. A copy is available from the plan administrator without charge. Those procedures are part of this package.'));
      rows.push(row(null, WpModel.MSP_SENTENCE));
      if (WpModel.hasBenefit(plan, 'medical')) {
        rows.push(row(null, WpModel.NEWBORNS));
        if (plan.funding === 'insured') rows.push(row(null, WpModel.NEWBORNS_INSURED));
        rows.push(row(null, 'If the plan covers mastectomy, it will provide reconstruction of the breast on which the mastectomy was performed, surgery and reconstruction of the other breast, prostheses, and treatment of physical complications including lymphedema, in the manner the certificate describes.'));
        if (WpModel.parityMode(plan) === 'print') {
          rows.push(row(null, 'Financial requirements and treatment limits on mental health and substance use benefits are not more restrictive than the limits on medical and surgical benefits, as federal law requires.'));
        } else if (WpModel.parityMode(plan) === 'booklet') {
          rows.push(row(null, 'Mental health and substance use benefits, and any limits on those benefits, are described in the certificate or booklet.'));
        }
      }
      if (plan.phi === 'yes') {
        rows.push(row(null, 'The plan may disclose protected health information to the plan sponsor only for plan administration, and only after the sponsor certifies that the plan has been amended and that the sponsor agrees to the limits in the HIPAA amendment. The sponsor will not use that information for employment decisions. The people who may see it are: ' + (plan.phi_classes || 'the classes written on the HIPAA amendment') + '.'));
      } else {
        rows.push(row(null, 'The plan sponsor does not receive protected health information for plan administration beyond enrollment and disenrollment.'));
      }
    }
    rows.push(h1('Statement of ERISA rights'));
    erisaRights().forEach(function (text) { rows.push(row(null, text)); });
    rows.push(h1('Amendment and termination'));
    rows.push(row(null, 'The employer may amend or terminate the plan by written action of ' + (plan.governing_body || 'its governing body') + '. A material change is communicated in a summary of material modifications. Welfare benefits are not vested.'));
    rows.push(row(null, WpModel.REVERSION));
    rows.push.apply(rows, signatureRows(plan));
    return rows;
  }
  function scheduleParagraphs(plan) {
    var rows = [];
    rows.push(row('Title', 'Schedule A: Documents to attach', { keepNext: true, keepLines: true }));
    rows.push(row(null, WpModel.DISCLAIMER));
    rows.push(row(null, 'This list is the employer\'s attachment list. It is not the insurance schedule filed with a Form 5500.'));
    WpModel.wrappedBenefits(plan).forEach(function (code) {
      var funding = code === 'medical' ? WpModel.fundingLabel(plan.funding || 'insured') : 'As stated in the certificate';
      var doc = code === 'medical' && plan.tpa_document ? plan.tpa_document : 'Certificate or booklet';
      rows.push(row(null, WpModel.benefitLabel(code) + '. Carrier or administrator: ' + carrier(plan, code) + '. Attach: ' + doc + '. Funding: ' + funding + '.'));
    });
    rows.push(h1('Assembly'));
    rows.push(row(null, 'Put the wrap plan document first. Then attach each certificate in the order above. Add the claim procedure if it is not already inside the certificate. Give that package to participants.'));
    rows.push(row(null, 'Give the package within 90 days after a person becomes covered, and within 120 days after the plan becomes subject to the reporting rules. A material change is described in a summary of material modifications within 210 days after the plan year ends. Restate the summary plan description every five years if material changes were made, and every ten years if they were not.'));
    rows.push(row(null, 'Keep the signed wrap, the adoption resolution, and a record of what was sent, when it was sent, and to whom.'));
    return rows;
  }
  function resolutionParagraphs(plan) {
    var when = plan.is_restatement === 'yes' ? longDate(plan.restatement_date) : longDate(plan.original_effective_date);
    var rows = [
      row('Title', 'Adoption resolution', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, plan.employer_name + ' resolves that the ' + plan.plan_name + ' is adopted effective ' + when + ' when the authorized person signs this resolution.')
    ];
    if (plan.is_restatement === 'yes') {
      rows.push(row(null, 'This resolution restates the plan originally effective ' + longDate(plan.original_effective_date) + '.'));
    }
    rows.push.apply(rows, signatureRows(plan));
    return rows;
  }
  function hipaaParagraphs(plan) {
    return [
      row('Title', 'HIPAA privacy amendment', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, 'The plan may disclose protected health information to the plan sponsor only for plan administration and only as federal privacy law allows.'),
      row(null, 'The plan sponsor certifies that the plan documents have been amended to include these limits and that the sponsor agrees to them.'),
      row(null, 'The sponsor will not use or further disclose the information except as the plan documents allow or as law requires. Agents who receive it agree to the same limits. The sponsor will not use it for employment decisions. The sponsor will report a use or disclosure that is not allowed. The sponsor will make the information available for access, amendment, and an accounting, and will make its books available to the U.S. Department of Health and Human Services. When the information is no longer needed, the sponsor will return or destroy it if that is feasible. The sponsor will apply administrative, physical, and technical safeguards.'),
      row(null, 'The classes of people who may see the information for plan administration are: ' + (plan.phi_classes || '________________________________') + '.'),
      row(null, 'Plan sponsor certification signature: ________________________________'),
      row(null, 'Date: ________________________________'),
      row(null, 'Name: ' + plan.signer_name),
      row(null, 'Title: ' + plan.signer_title)
    ];
  }
  function qmcsoParagraphs(plan) {
    return [
      row('Title', 'Qualified medical child support order procedures', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, plan.employer_name + ' will use these procedures for medical child support orders, including a National Medical Support Notice.'),
      row(null, 'When an order or a National Medical Support Notice arrives, the plan administrator notifies the participant and each alternate recipient. A National Medical Support Notice is handled as a medical child support order under federal law.'),
      row(null, 'The administrator decides whether the order is qualified and sends that decision in writing. Coverage required by a qualified order is provided as the order and the certificate allow.'),
      row(null, 'A copy of these procedures is available from the plan administrator without charge.')
    ];
  }
  function findingsParagraphs(plan, findings) {
    var rows = [
      row('Title', 'Findings report', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, 'This note is for the employer. It is not part of the summary plan description given to employees.')
    ];
    (findings || WpModel.findingsFor(plan)).forEach(function (line) { rows.push(row(null, line)); });
    return rows;
  }
  function explainParagraphs(plan) {
    var text = 'This tool drafts an ERISA wrap for a private employer. It does not fit this arrangement, so no ERISA plan document was prepared.';
    if (plan.erisa_path === 'governmental') text = 'A governmental plan is generally outside ERISA. An ERISA wrap is the wrong document. This tool did not prepare one.';
    if (plan.erisa_path === 'church') text = 'A church plan is generally outside ERISA. This tool does not draft an ERISA wrap for it.';
    if (plan.erisa_path === 'owner-only') text = 'A plan that covers only an owner and spouse, or only partners and their spouses, and no common-law employee, is generally not an ERISA plan. This tool did not draft an ERISA wrap.';
    return [
      row('Title', 'About this arrangement', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, text),
      row(null, 'DK Benefits keeps a record of this request.')
    ];
  }
  function followUpEmailText(plan, lead) {
    var first = String((lead && lead.contact_name) || '').trim().split(/\s+/)[0];
    return [
      first ? ('Hi ' + first + ',') : 'Hi there,',
      '',
      'I hope the wrap document was useful.',
      '',
      'Since this is a free tool, it\'s always a good idea to have your own counsel take a quick look before you sign.',
      '',
      'If you don\'t want to hear from me that\'s fine too just let me know.',
      '',
      'Daniel Kirves',
      'Benefits Broker | 20 Years Exp | DK Benefits',
      '407-476-5076 | www.dkbenefits.net',
      '6000 Metrowest Blvd #200 Orlando, FL 32835',
      'Agency Lic# L109331'
    ].join('\n');
  }
  function followUpEmailHtml(plan, lead) {
    return '<div>' + followUpEmailText(plan, lead).split('\n').map(function (line) {
      return xml(line);
    }).join('<br>\n') + '</div>';
  }

  function paragraphXml(item) {
    var bits = [];
    if (item.style) bits.push('<w:pStyle w:val="' + xml(item.style) + '"/>');
    if (item.keepNext) bits.push('<w:keepNext/>');
    if (item.keepLines) bits.push('<w:keepLines/>');
    var pPr = bits.length ? '<w:pPr>' + bits.join('') + '</w:pPr>' : '';
    return '<w:p>' + pPr + '<w:r><w:t xml:space="preserve">' + xml(item.text || '') + '</w:t></w:r></w:p>';
  }
  function documentXml(rows) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="' + W + '" xmlns:r="' + R + '"><w:body>' + rows.map(paragraphXml).join('') +
      '<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/>' +
      '<w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="936" w:right="1152" w:bottom="936" w:left="1152" w:header="720" w:footer="720" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
  }
  function headerXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="' + W + '"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p></w:hdr>';
  }
  function pageField(instr) {
    return '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  }
  function footerXml(label) {
    var name = xml(label || '');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="' + W + '"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr>' +
      (name ? '<w:r><w:t xml:space="preserve">' + name + ' | Page </w:t></w:r>' : '<w:r><w:t xml:space="preserve">Page </w:t></w:r>') +
      pageField('PAGE') + '<w:r><w:t xml:space="preserve"> of </w:t></w:r>' + pageField('NUMPAGES') + '</w:p></w:ftr>';
  }
  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="' + W + '">' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1A2E4A"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1A2E4A"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1A2E4A"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="Header"/><w:basedOn w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="Footer"/><w:basedOn w:val="Normal"/></w:style></w:styles>';
  }
  function coreXml(props) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<dc:title>' + xml(props.title || 'Wrap plan') + '</dc:title><dc:creator>DK Benefits LLC</dc:creator></cp:coreProperties>';
  }
  function contentTypesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>';
  }
  function rootRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  }
  function docRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
  }
  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return new Uint8Array([]);
  }
  function u16(n) { return new Uint8Array([n & 255, (n >> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]); }
  function concatBytes(parts) {
    var len = 0;
    for (var i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len);
    var o = 0;
    for (var j = 0; j < parts.length; j++) { out.set(parts[j], o); o += parts[j].length; }
    return out;
  }
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      c = c ^ bytes[i];
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function zipStore(files) {
    var locals = [];
    var centrals = [];
    var offset = 0;
    for (var i = 0; i < files.length; i++) {
      var nameBytes = utf8(files[i].name);
      var data = utf8(files[i].text);
      var crc = crc32(data);
      var local = concatBytes([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data]);
      locals.push(local);
      centrals.push(concatBytes([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]));
      offset += local.length;
    }
    var central = concatBytes(centrals);
    return concatBytes(locals.concat([central, concatBytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)])]));
  }
  function buildDocx(rows, props) {
    props = props || {};
    return zipStore([
      { name: '[Content_Types].xml', text: contentTypesXml() },
      { name: '_rels/.rels', text: rootRels() },
      { name: 'docProps/core.xml', text: coreXml(props) },
      { name: 'word/document.xml', text: documentXml(rows) },
      { name: 'word/styles.xml', text: stylesXml() },
      { name: 'word/header1.xml', text: headerXml() },
      { name: 'word/footer1.xml', text: footerXml(props.footer || props.title || '') },
      { name: 'word/_rels/document.xml.rels', text: docRels() }
    ]);
  }
  function safe(name) {
    return String(name || 'Employer').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Employer';
  }
  function planFileName(plan) { return safe(plan.employer_name) + '_Wrap_Plan.docx'; }
  function scheduleFileName(plan) { return safe(plan.employer_name) + '_Schedule_A.docx'; }
  function resolutionFileName(plan) { return safe(plan.employer_name) + '_Adoption_Resolution.docx'; }
  function hipaaFileName(plan) { return safe(plan.employer_name) + '_HIPAA_Amendment.docx'; }
  function qmcsoFileName(plan) { return safe(plan.employer_name) + '_QMCSO_Procedures.docx'; }
  function findingsFileName(plan) { return safe(plan.employer_name) + '_Findings.docx'; }
  function explainFileName(plan) { return safe(plan.employer_name) + '_Explanation.docx'; }
  function pdfFileName(docxName) { return String(docxName).replace(/\.docx$/i, '.pdf'); }
  function footerFor(plan, title) {
    return plan.employer_name + ' ' + title;
  }
  function plainText(rows) {
    return (rows || []).map(function (item) { return item.text || ''; }).join('\n');
  }
  function needsHipaa(plan) {
    return plan.phi === 'yes';
  }
  function needsQmcso(plan) {
    return WpModel.groupHealth(plan);
  }

  return {
    planParagraphs: planParagraphs,
    scheduleParagraphs: scheduleParagraphs,
    resolutionParagraphs: resolutionParagraphs,
    hipaaParagraphs: hipaaParagraphs,
    qmcsoParagraphs: qmcsoParagraphs,
    findingsParagraphs: findingsParagraphs,
    explainParagraphs: explainParagraphs,
    followUpEmailText: followUpEmailText,
    followUpEmailHtml: followUpEmailHtml,
    buildDocx: buildDocx,
    planFileName: planFileName,
    scheduleFileName: scheduleFileName,
    resolutionFileName: resolutionFileName,
    hipaaFileName: hipaaFileName,
    qmcsoFileName: qmcsoFileName,
    findingsFileName: findingsFileName,
    explainFileName: explainFileName,
    pdfFileName: pdfFileName,
    footerFor: footerFor,
    plainText: plainText,
    needsHipaa: needsHipaa,
    needsQmcso: needsQmcso,
    longDate: longDate
  };
})();
