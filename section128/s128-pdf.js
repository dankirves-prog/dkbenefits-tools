/**
 * Matching PDF for the Section 128 draft. Uses pdf-lib standard fonts.
 * Page size and margins follow the employer plan (letter, 0.65 in top/bottom, 0.8 in sides).
 */
var S128Pdf = (function () {
  function lib() {
    var root = typeof globalThis !== 'undefined' ? globalThis : this;
    return root.PDFLib || null;
  }

  function wrap(text, font, size, maxWidth) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var trial = line ? line + ' ' + words[i] : words[i];
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) line = trial;
      else {
        if (line) lines.push(line);
        line = words[i];
      }
    }
    if (line) lines.push(line);
    if (!lines.length) lines.push('');
    return lines;
  }

  function buildPdf(rows, props) {
    var PDFLib = lib();
    if (!PDFLib) return Promise.reject(new Error('PDF library is not loaded'));
    props = props || {};
    return PDFLib.PDFDocument.create().then(function (doc) {
      doc.setTitle(props.title || 'Section 128 Trump Account Contribution Program');
      doc.setAuthor('DK Benefits LLC');
      doc.setSubject('Section 128 Trump Account Contribution Program');
      doc.setCreator('DK Benefits LLC');
      doc.setProducer('DK Benefits Section 128 ' + (S128Model.TEMPLATE_VERSION || ''));
      var font = doc.embedStandardFont(PDFLib.StandardFonts.TimesRoman);
      var bold = doc.embedStandardFont(PDFLib.StandardFonts.TimesRomanBold);
      var pageWidth = 612;
      var pageHeight = 792;
      var left = 58;
      var right = 58;
      var top = 62;
      var bottom = 56;
      var maxWidth = pageWidth - left - right;
      var navy = PDFLib.rgb(0.102, 0.180, 0.290);
      var body = PDFLib.rgb(0.1, 0.12, 0.16);
      var muted = PDFLib.rgb(0.35, 0.42, 0.49);
      var pages = [];
      var page = null;
      var y = 0;

      function newPage() {
        page = doc.addPage([pageWidth, pageHeight]);
        pages.push(page);
        y = pageHeight - top;
      }

      function ensure(height) {
        if (!page || y - height < bottom) newPage();
      }

      newPage();
      (rows || []).forEach(function (row) {
        if (row.pageBreak) {
          newPage();
          return;
        }
        var text = row.text || '';
        var style = row.style;
        var size = style === 'Title' ? 16 : style === 'Heading1' ? 13 : style === 'Heading2' ? 12 : 11;
        var useFont = style ? bold : font;
        var color = style ? navy : body;
        var gap = style === 'Title' ? 8 : style ? 6 : 3;
        var lineHeight = size + 3;
        if (row.spaceBefore) {
          var before = row.spaceBefore / 20;
          ensure(before);
          y -= before;
        }
        if (!text) {
          ensure(10);
          y -= 8;
          return;
        }
        var lines = wrap(text, useFont, size, maxWidth);
        var block = lines.length * lineHeight + gap;
        if (style && y - block < bottom + 36) newPage();
        ensure(lineHeight);
        lines.forEach(function (line) {
          ensure(lineHeight);
          page.drawText(line, { x: left, y: y - size, size: size, font: useFont, color: color });
          y -= lineHeight;
        });
        y -= gap;
      });

      pages.forEach(function (pg) {
        var label = S128Docgen.FOOTER;
        var size = 8;
        var lines = wrap(label, font, size, maxWidth);
        var fy = 28 + (lines.length - 1) * 10;
        lines.forEach(function (line) {
          pg.drawText(line, { x: left, y: fy, size: size, font: font, color: muted });
          fy -= 10;
        });
      });
      return doc.save();
    });
  }

  return { buildPdf: buildPdf };
})();
