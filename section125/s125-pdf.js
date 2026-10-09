/**
 * Matching PDF for the Section 125 sample.
 * The Word file uses Calibri. This vendored pdf-lib build can embed only the
 * standard fonts (it has no fontkit), so Carlito or another Calibri-like file
 * cannot be embedded. Times is the closest built-in serif. Letters outside
 * that font, such as Ł, are transliterated so the PDF still builds. The Word
 * file keeps the original characters.
 * Page size is letter, with 0.65 in top and bottom and 0.8 in side margins.
 */
var S125Pdf = (function () {
  function lib() {
    var root = typeof globalThis !== 'undefined' ? globalThis : this;
    return root.PDFLib || null;
  }

  var FOLD = { 'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd', 'Œ': 'OE', 'œ': 'oe', 'Ø': 'O', 'ø': 'o', 'Æ': 'AE', 'æ': 'ae', 'Þ': 'Th', 'þ': 'th', 'ß': 'ss' };
  var encodeCache = {};

  function foldChar(ch) {
    if (FOLD[ch]) return FOLD[ch];
    var base = ch.normalize ? ch.normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
    if (base && base !== ch && /^[\u0020-\u007E]+$/.test(base)) return base;
    return '';
  }

  function pdfSafe(text, font) {
    var s = String(text || '');
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (!Object.prototype.hasOwnProperty.call(encodeCache, ch)) {
        try {
          font.widthOfTextAtSize(ch, 10);
          encodeCache[ch] = ch;
        } catch (err) {
          encodeCache[ch] = foldChar(ch);
        }
      }
      out += encodeCache[ch];
    }
    return out;
  }

  function wrap(text, font, size, maxWidth) {
    var words = pdfSafe(text, font).split(/\s+/).filter(Boolean);
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
      doc.setTitle(props.title || 'Section 125 Cafeteria Plan');
      doc.setAuthor('DK Benefits LLC');
      doc.setSubject('Section 125 Cafeteria Plan');
      doc.setCreator('DK Benefits LLC');
      doc.setProducer('DK Benefits Section 125 ' + (S125Model.TEMPLATE_VERSION || ''));
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

      function typeFor(style) {
        var size = style === 'Title' ? 16 : style === 'Heading1' ? 13 : style === 'Heading2' ? 12 : 11;
        var before = style === 'Heading1' ? 11 : style === 'Heading2' ? 8 : 0;
        var gap = style === 'Title' ? 10 : style === 'Heading1' ? 4 : style === 'Heading2' ? 3 : 5;
        return {
          size: size,
          before: before,
          gap: gap,
          lineHeight: size + 4,
          useFont: style ? bold : font,
          color: style ? navy : body
        };
      }

      function metricsFor(row) {
        if (row.table) {
          var labelWidth = 150;
          var valueWidth = maxWidth - labelWidth - 12;
          var prepared = row.table.map(function (item) {
            var valueLines = wrap(item.value, font, 11, valueWidth);
            var labelLines = wrap(item.label, bold, 11, labelWidth);
            var count = Math.max(valueLines.length, labelLines.length);
            return { labelLines: labelLines, valueLines: valueLines, h: count * 15 + 8 };
          });
          var height = prepared.reduce(function (sum, item) { return sum + item.h; }, 0) + 10;
          return { table: true, prepared: prepared, height: height, before: 0, labelWidth: labelWidth };
        }
        var text = row.text || '';
        var style = row.style;
        var type = typeFor(style);
        var before = row.spaceBefore ? row.spaceBefore / 20 : type.before;
        if (!text) {
          return { empty: true, before: before, height: before + 8, size: type.size, useFont: type.useFont, color: type.color, lines: [], lineHeight: type.lineHeight, gap: type.gap, style: style };
        }
        var lines = wrap(text, type.useFont, type.size, maxWidth);
        return {
          empty: false,
          before: before,
          height: before + lines.length * type.lineHeight + type.gap,
          size: type.size,
          useFont: type.useFont,
          color: type.color,
          lines: lines,
          lineHeight: type.lineHeight,
          gap: type.gap,
          style: style
        };
      }

      function drawTable(metrics) {
        var labelWidth = metrics.labelWidth;
        var topY = y;
        metrics.prepared.forEach(function (item) {
          var rowTop = y;
          item.labelLines.forEach(function (line, i) {
            page.drawText(line, { x: left + 6, y: rowTop - 14 - i * 15, size: 11, font: bold, color: navy });
          });
          item.valueLines.forEach(function (line, i) {
            page.drawText(line, { x: left + labelWidth + 8, y: rowTop - 14 - i * 15, size: 11, font: font, color: body });
          });
          page.drawLine({ start: { x: left, y: rowTop }, end: { x: left + maxWidth, y: rowTop }, thickness: 0.4, color: navy });
          y -= item.h;
        });
        page.drawLine({ start: { x: left, y: y }, end: { x: left + maxWidth, y: y }, thickness: 0.4, color: navy });
        page.drawLine({ start: { x: left, y: topY }, end: { x: left, y: y }, thickness: 0.4, color: navy });
        page.drawLine({ start: { x: left + labelWidth, y: topY }, end: { x: left + labelWidth, y: y }, thickness: 0.4, color: navy });
        page.drawLine({ start: { x: left + maxWidth, y: topY }, end: { x: left + maxWidth, y: y }, thickness: 0.4, color: navy });
        y -= 10;
      }

      function drawMeasured(metrics) {
        if (metrics.table) {
          drawTable(metrics);
          return;
        }
        if (metrics.before && y < pageHeight - top - 1) y -= metrics.before;
        if (metrics.empty) {
          y -= 8;
          return;
        }
        metrics.lines.forEach(function (line) {
          page.drawText(line, { x: left, y: y - metrics.size, size: metrics.size, font: metrics.useFont, color: metrics.color });
          y -= metrics.lineHeight;
        });
        y -= metrics.gap;
      }

      function drawLegacy(row) {
        if (row.table) {
          var metrics = metricsFor(row);
          if (!page || y - metrics.height < bottom) newPage();
          drawTable(metrics);
          return;
        }
        var text = row.text || '';
        var style = row.style;
        var type = typeFor(style);
        var size = type.size;
        var useFont = type.useFont;
        var color = type.color;
        var gap = type.gap;
        var lineHeight = type.lineHeight;
        var before = row.spaceBefore ? row.spaceBefore / 20 : type.before;
        if (before && y < pageHeight - top - 1) {
          ensure(before);
          if (y < pageHeight - top - 1) y -= before;
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
      }

      newPage();
      var list = rows || [];
      var index = 0;
      var contentRoom = (pageHeight - top) - bottom;
      while (index < list.length) {
        var row = list[index];
        if (row.pageBreak) {
          newPage();
          index++;
          continue;
        }
        var end = index;
        while (list[end].keepNext && end + 1 < list.length && !list[end + 1].pageBreak) end++;
        if (end > index) {
          var metrics = [];
          var total = 0;
          for (var g = index; g <= end; g++) {
            var measured = metricsFor(list[g]);
            metrics.push(measured);
            total += measured.height;
          }
          if (total <= contentRoom) {
            if (!page || y - total < bottom) newPage();
            metrics.forEach(drawMeasured);
          } else {
            for (var h = index; h <= end; h++) drawLegacy(list[h]);
          }
          index = end + 1;
          continue;
        }
        drawLegacy(row);
        index++;
      }

      var footerName = props.footer || props.title || '';
      pages.forEach(function (pg, index) {
        var label = (footerName ? footerName + ' | ' : '') + 'Page ' + (index + 1) + ' of ' + pages.length;
        var size = 8;
        var lines = wrap(label, font, size, maxWidth);
        var fy = 28 + (lines.length - 1) * 10;
        lines.forEach(function (line) {
          var lineWidth = font.widthOfTextAtSize(line, size);
          pg.drawText(line, {
            x: left + Math.max(0, (maxWidth - lineWidth) / 2),
            y: fy,
            size: size,
            font: font,
            color: muted
          });
          fy -= 10;
        });
      });
      return doc.save();
    });
  }

  return { buildPdf: buildPdf };
})();
