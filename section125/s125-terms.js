/**
 * Educational-tool terms. Version s125-terms-2026-10-09.
 * Draft wording for DK Benefits LLC's own attorney to review before go-live.
 * Not itself legal advice.
 */
var S125Terms = (function () {
  var VERSION = 's125-terms-2026-10-09';
  var AS_OF = 'October 9, 2026';

  var PARAGRAPHS = [
    'DK Benefits LLC provides this Section 125 cafeteria plan tool as an educational resource to help employers. It produces a sample template only.',
    'The tool and the documents are not legal advice, tax advice, accounting advice, or ERISA advice. Using the tool, downloading a document, or receiving a note by email does not create an attorney-client relationship, a tax-advisor relationship, or any other advisory relationship.',
    'DK Benefits LLC and Daniel Kirves do not review, approve, or verify the documents or the information the employer enters. The employer is solely responsible for the accuracy of that information, for deciding whether to adopt a plan, for customizing the documents, for adoption and implementation, and for ongoing compliance and operation.',
    'Consult your own attorney, tax advisor, and third-party administrator before adopting or operating a cafeteria plan. This sample reflects publicly available rules as of ' + AS_OF + ', including the 2007 proposed cafeteria plan regulations (which taxpayers may rely on), IRC §§105, 125, 129, 1372, and 223, and IRS notices and revenue rulings cited in the research record. Law and guidance may change. Dollar limits change by year.',
    'The documents are a sample draft for the employer’s review with its own advisors. They are not adopted until the employer signs them. The signature line and the date line are left blank. Generating or downloading a file does not adopt a plan.',
    'A health FSA or dependent care FSA also needs the administrator’s claims procedures. This sample states the cafeteria-plan election rules and the unused-funds rule the employer chose. It does not replace a carrier contract, a stop-loss policy, or an insurance certificate.',
    'The tool and the documents are provided “as is” and “as available,” without warranties of any kind, express or implied, including warranties of accuracy, fitness for a particular purpose, and non-infringement.',
    'To the fullest extent permitted by law, DK Benefits LLC and Daniel Kirves have no liability for any use of, or reliance on, the tool or the documents, including a decision to adopt, not to adopt, or to operate a plan.',
    'The employer agrees to indemnify and hold harmless DK Benefits LLC and Daniel Kirves from claims, damages, losses, and reasonable expenses arising out of the employer’s use of the tool, reliance on the sample documents, or adoption or operation of a plan, except to the extent caused by DK Benefits LLC’s intentional misconduct. This indemnity applies only to the extent the law allows.',
    'Checking the box means the employer agrees to these terms, version ' + VERSION + ', and that the person submitting the form is authorized to agree for the employer.'
  ];

  var CHECKBOX = 'I understand this is an educational tool, not legal or tax advice, and my company is responsible for what it adopts. I agree to the Terms of use.';

  var FOOTER = 'Prepared with DK Benefits\' educational tool. Not effective until signed by the employer.';

  return {
    VERSION: VERSION,
    AS_OF: AS_OF,
    PARAGRAPHS: PARAGRAPHS,
    CHECKBOX: CHECKBOX,
    FOOTER: FOOTER
  };
})();
