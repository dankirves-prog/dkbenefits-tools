/**
 * Section 125 delivery settings.
 * Leave endpoint empty until Dan deploys the dedicated Apps Script and pastes its /exec URL.
 * Credentials stay in that script. This file has no secrets.
 * Do not point this at the Section 128 script or the quote-tool script.
 */
window.S125_CONFIG = {
  endpoint: '',
  templateVersion: 's125-v1.0.0-2026-10-09',
  phoneDisplay: '407-476-5076',
  phoneTel: '4074765076',
  section128Url: 'https://www.dkbenefits.net/section-128-tool',
  ratesUrl: 'https://www.dkbenefits.net/instant-group-quote'
};
