/**
 * Educational-tool terms. Version s128-terms-2026-10-08.
 * Draft wording for DK Benefits LLC's own attorney to review before go-live.
 * Not itself legal advice.
 */
var S128Terms = (function () {
  var VERSION = 's128-terms-2026-10-08';
  var AS_OF = 'October 8, 2026';

  var PARAGRAPHS = [
    'DK Benefits LLC provides this Section 128 Trump Account contribution program tool as an educational resource to help employers. It produces a sample template only.',
    'The tool and the documents are not legal advice, tax advice, accounting advice, or ERISA advice. Using the tool, downloading a document, or receiving a copy by email does not create an attorney-client relationship, a tax-advisor relationship, or any other advisory relationship.',
    'DK Benefits LLC and Daniel Kirves do not review, approve, or verify the documents or the information the employer enters. The employer is solely responsible for the accuracy of that information, for deciding whether to adopt a program, for customizing the documents, for adoption and implementation, and for ongoing compliance and operation.',
    'Consult your own attorney and tax advisor before adopting or operating any program. Final Section 128 regulations have not been issued. This sample reflects guidance as of ' + AS_OF + ', including the proposed regulations in REG-101355-26 and Treasury Decision 10056. Law and guidance may change.',
    'The documents are a sample draft for the employer’s review with its own advisors. They are not adopted until the employer signs them. The signature line and the date line are left blank. Generating or downloading a file does not adopt a program and does not amend a cafeteria plan.',
    'The tool and the documents are provided “as is” and “as available,” without warranties of any kind, express or implied, including warranties of accuracy, fitness for a particular purpose, and non-infringement.',
    'To the fullest extent permitted by law, DK Benefits LLC and Daniel Kirves have no liability for any use of, or reliance on, the tool or the documents, including a decision to adopt, not to adopt, or to operate a program.',
    'The employer agrees to indemnify and hold harmless DK Benefits LLC and Daniel Kirves from claims, damages, losses, and reasonable expenses arising out of the employer’s use of the tool, reliance on the sample documents, or adoption or operation of a program, except to the extent caused by DK Benefits LLC’s intentional misconduct. This indemnity applies only to the extent the law allows.',
    'Checking the box means the employer agrees to these terms, version ' + VERSION + ', and that the person submitting the form is authorized to agree for the employer.'
  ];

  var CHECKBOX = 'I agree to the Terms of use (' + VERSION + '). This is an educational tool and a sample template only. It is not legal, tax, accounting, or ERISA advice, and it does not create an attorney-client or advisory relationship. DK Benefits LLC and Daniel Kirves do not review, approve, or verify the documents or the information entered. The employer is solely responsible for deciding whether to adopt, for customizing, for adoption and implementation, and for ongoing compliance and operation. Consult your own attorney and tax advisor before adopting. The materials are provided “as is,” without warranties of any kind. To the fullest extent permitted by law, there is no liability for any use of or reliance on the tool or documents. Law and guidance may change, and the template reflects guidance as of ' + AS_OF + '. The employer agrees to hold harmless and indemnify DK Benefits LLC and Daniel Kirves as the Terms of use describe.';

  var HEADER = 'SAMPLE DRAFT — for the employer’s review with its own advisors. Not adopted until signed by the Employer. Template v0.3 (guidance as of ' + AS_OF + ').';

  var OPENING = 'SAMPLE DRAFT — for the employer’s review with its own advisors. Not adopted until signed by the Employer. This file is an educational sample template provided to help employers. It is not legal, tax, accounting, or ERISA advice. DK Benefits LLC and Daniel Kirves do not review, approve, or verify it. The employer is solely responsible for any use. It reflects guidance as of ' + AS_OF + ' and is provided as is, without warranties. Generating or downloading it does not adopt the program.';

  var CLOSING = 'Closing notice. This sample is for the employer’s review with its own advisors. It is not adopted until the employer signs it. The signature and date above are blank. DK Benefits LLC does not review, approve, or verify this file. Consult your own attorney and tax advisor before adopting. Guidance as of ' + AS_OF + '. Provided as is, without warranties. To the fullest extent permitted by law, there is no liability for use of or reliance on this sample.';

  var SHORT_NOTICE = OPENING;

  return {
    VERSION: VERSION,
    AS_OF: AS_OF,
    PARAGRAPHS: PARAGRAPHS,
    CHECKBOX: CHECKBOX,
    HEADER: HEADER,
    OPENING: OPENING,
    CLOSING: CLOSING,
    SHORT_NOTICE: SHORT_NOTICE
  };
})();
