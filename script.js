// Foldwell — folio tab switcher
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tool-list');

  tabs.forEach(tab => {/* ============================================================
   MyDocverter — front-end app
   Tab switcher + real, in-browser file tools.
   Nothing here uploads a file anywhere — pdf-lib, pdf.js,
   mammoth, SheetJS and PptxGenJS all run locally in the tab.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Folio tab switcher ---------- */
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tool-list');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === target));
    });
    tab.addEventListener('keydown', (e) => {
      const list = Array.from(tabs);
      const i = list.indexOf(tab);
      if (e.key === 'ArrowRight') list[(i + 1) % list.length].focus();
      if (e.key === 'ArrowLeft') list[(i - 1 + list.length) % list.length].focus();
    });
  });

  /* pdf.js needs a worker file to run */
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  /* ---------- small helpers ---------- */
  const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib || {};

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function baseName(name) {
    return (name || 'file').replace(/\.[^/.]+$/, '');
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  async function fileToArrayBuffer(file) {
    return await file.arrayBuffer();
  }

  /* holds a file dropped via the header "Open a file" button so the
     next opened tool can pick it up automatically */
  let pendingFile = null;

  function matchesAccept(file, accept) {
    if (!accept) return true;
    const name = file.name.toLowerCase();
    return accept.split(',').some(token => {
      token = token.trim().toLowerCase();
      if (token.startsWith('.')) return name.endsWith(token);
      if (token.endsWith('/*')) return file.type.startsWith(token.slice(0, -1));
      return file.type === token;
    });
  }

  function maybePreload(fileInput, accept) {
    if (pendingFile && matchesAccept(pendingFile, accept)) {
      const dt = new DataTransfer();
      dt.items.add(pendingFile);
      fileInput.files = dt.files;
      pendingFile = null;
    }
  }

  /* ---------- modal shell ---------- */
  const overlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');

  function openModal(title, desc) {
    modalTitle.textContent = title;
    modalDesc.textContent = desc;
    modalBody.innerHTML = '';
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    modalBody.innerHTML = '';
  }

  modalClose.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

  function setStatus(el, msg, type) {
    el.textContent = msg;
    el.className = 'status' + (type ? ' ' + type : '');
  }

  /* ---------- generic single/multi file form builder ---------- */
  function buildForm(container, { accept, multiple = false, fields = [], actionLabel, onRun }) {
    container.innerHTML = `
      <div class="field">
        <label>Choose file${multiple ? 's' : ''}</label>
        <input type="file" class="file-input" accept="${accept || ''}" ${multiple ? 'multiple' : ''}>
      </div>
      ${fields.map(f => `
        <div class="field">
          <label>${f.label}</label>
          ${f.html}
          ${f.hint ? `<div class="field-hint">${f.hint}</div>` : ''}
        </div>`).join('')}
      <button type="button" class="btn btn-primary btn-block run-btn">${actionLabel}</button>
      <div class="status" id="toolStatus"></div>
      <div class="output" id="toolOutput"></div>
    `;

    const fileInput = container.querySelector('.file-input');
    const runBtn = container.querySelector('.run-btn');
    const statusEl = container.querySelector('#toolStatus');
    const outputEl = container.querySelector('#toolOutput');

    maybePreload(fileInput, accept);

    runBtn.addEventListener('click', async () => {
      outputEl.innerHTML = '';
      const files = Array.from(fileInput.files || []);
      if (!files.length) { setStatus(statusEl, 'Please choose a file first.', 'err'); return; }

      const values = {};
      fields.forEach(f => {
        const el = container.querySelector('#' + f.id);
        values[f.name] = el ? el.value : '';
      });

      runBtn.disabled = true;
      setStatus(statusEl, 'Working…', 'info');
      try {
        await onRun({ files, values, statusEl, outputEl });
      } catch (err) {
        console.error(err);
        setStatus(statusEl, 'Something went wrong: ' + err.message, 'err');
      } finally {
        runBtn.disabled = false;
      }
    });

    return { fileInput, runBtn, statusEl, outputEl };
  }

  /* ============================================================
     TOOL DEFINITIONS
     ============================================================ */
  const TOOLS = {

    merge: {
      title: 'Merge PDF',
      desc: 'Choose two or more PDFs. They\u2019ll be combined in the order you pick them, into one file.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          multiple: true,
          actionLabel: 'Merge files',
          async onRun({ files, statusEl }) {
            if (files.length < 2) throw new Error('Choose at least two PDF files.');
            const out = await PDFDocument.create();
            for (const f of files) {
              const bytes = await fileToArrayBuffer(f);
              const src = await PDFDocument.load(bytes);
              const pages = await out.copyPages(src, src.getPageIndices());
              pages.forEach(p => out.addPage(p));
            }
            const bytes = await out.save();
            downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
            setStatus(statusEl, `Done — merged ${files.length} files into one PDF.`, 'ok');
          }
        });
      }
    },

    split: {
      title: 'Split PDF',
      desc: 'Pull specific pages out of a PDF, or cut it into single pages.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          fields: [{
            id: 'splitRanges', name: 'ranges', label: 'Pages to extract',
            html: '<input type="text" id="splitRanges" placeholder="e.g. 1-3,5">',
            hint: 'Each comma-separated group becomes its own file. Leave blank to split into one file per page.'
          }],
          actionLabel: 'Split file',
          async onRun({ files, values, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const src = await PDFDocument.load(bytes);
            const total = src.getPageCount();

            let groups;
            const raw = values.ranges.trim();
            if (!raw) {
              groups = Array.from({ length: total }, (_, i) => [i]);
            } else {
              groups = raw.split(',').map(token => {
                token = token.trim();
                const m = token.match(/^(\d+)(?:-(\d+))?$/);
                if (!m) return [];
                const start = parseInt(m[1], 10) - 1;
                const end = m[2] ? parseInt(m[2], 10) - 1 : start;
                const idx = [];
                for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                  if (i >= 0 && i < total) idx.push(i);
                }
                return idx;
              }).filter(g => g.length);
            }
            if (!groups.length) throw new Error('Couldn\u2019t read those page numbers — try something like 1-3,5.');

            const outputs = [];
            for (let g = 0; g < groups.length; g++) {
              const out = await PDFDocument.create();
              const pages = await out.copyPages(src, groups[g]);
              pages.forEach(p => out.addPage(p));
              const outBytes = await out.save();
              outputs.push({ name: `${baseName(file.name)}-part${g + 1}.pdf`, bytes: outBytes });
            }

            if (outputs.length === 1) {
              downloadBlob(new Blob([outputs[0].bytes], { type: 'application/pdf' }), outputs[0].name);
            } else {
              const zip = new JSZip();
              outputs.forEach(o => zip.file(o.name, o.bytes));
              const zipBlob = await zip.generateAsync({ type: 'blob' });
              downloadBlob(zipBlob, `${baseName(file.name)}-split.zip`);
            }
            setStatus(statusEl, `Done — created ${outputs.length} file${outputs.length > 1 ? 's' : ''}.`, 'ok');
          }
        });
      }
    },

    organize: {
      title: 'Organize PDF',
      desc: 'Reorder or delete pages by typing the new page order.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          fields: [{
            id: 'organizeOrder', name: 'order', label: 'New page order',
            html: '<input type="text" id="organizeOrder" placeholder="e.g. 3,1,2,4">',
            hint: 'List page numbers in the order you want them. Leave a number out to delete that page.'
          }],
          actionLabel: 'Rebuild file',
          async onRun({ files, values, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const src = await PDFDocument.load(bytes);
            const total = src.getPageCount();
            const order = values.order.split(',')
              .map(s => parseInt(s.trim(), 10) - 1)
              .filter(n => n >= 0 && n < total);
            if (!order.length) throw new Error(`Enter a page order using numbers 1 to ${total}.`);

            const out = await PDFDocument.create();
            const pages = await out.copyPages(src, order);
            pages.forEach(p => out.addPage(p));
            const outBytes = await out.save();
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-organized.pdf`);
            setStatus(statusEl, `Done — new file has ${order.length} page${order.length > 1 ? 's' : ''}.`, 'ok');
          }
        });
      }
    },

    compress: {
      title: 'Compress PDF',
      desc: 'Resaves the file more efficiently to shrink its size.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          actionLabel: 'Compress file',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const src = await PDFDocument.load(bytes, { updateMetadata: false });
            const outBytes = await src.save({ useObjectStreams: true });
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-compressed.pdf`);
            const before = bytes.byteLength, after = outBytes.byteLength;
            if (after < before) {
              const pct = Math.round((1 - after / before) * 100);
              setStatus(statusEl, `Done — ${formatBytes(before)} → ${formatBytes(after)} (${pct}% smaller). Browser-only compression can't re-encode embedded images, so image-heavy PDFs shrink less than text-heavy ones.`, 'ok');
            } else {
              setStatus(statusEl, `Done — resaved at ${formatBytes(after)}. This file was already tightly packed, so size barely moved.`, 'ok');
            }
          }
        });
      }
    },

    pdf2word: {
      title: 'PDF to Word',
      desc: 'Pulls the text out of your PDF into a Word-compatible .doc file.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          actionLabel: 'Convert to Word',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
            const parts = ['<html><head><meta charset="utf-8"></head><body style="font-family:Calibri,Arial,sans-serif;">'];
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const text = content.items.map(it => it.str).join(' ');
              parts.push(`<p>${escapeHtml(text) || '&nbsp;'}</p>`);
              if (i < pdf.numPages) parts.push('<br style="page-break-before:always">');
            }
            parts.push('</body></html>');
            const blob = new Blob([parts.join('')], { type: 'application/msword' });
            downloadBlob(blob, `${baseName(file.name)}.doc`);
            setStatus(statusEl, `Done — ${pdf.numPages} page(s) converted. Layout and images aren't preserved in this browser-only conversion, just the text.`, 'ok');
          }
        });
      }
    },

    word2pdf: {
      title: 'Word to PDF',
      desc: 'Converts a .docx file\u2019s text and basic formatting into a PDF.',
      render(container) {
        buildForm(container, {
          accept: '.doc,.docx',
          actionLabel: 'Convert to PDF',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            await new Promise((resolve, reject) => {
              try {
                doc.html(`<div style="font-family:Helvetica;font-size:11pt;line-height:1.4;width:480pt;">${result.value}</div>`, {
                  x: 30, y: 30, width: 480, windowWidth: 700,
                  callback: (d) => {
                    const blob = d.output('blob');
                    downloadBlob(blob, `${baseName(file.name)}.pdf`);
                    resolve();
                  }
                });
              } catch (err) { reject(err); }
            });
            setStatus(statusEl, 'Done — converted using your document\u2019s text content. Complex tables or images may not carry over perfectly.', 'ok');
          }
        });
      }
    },

    pdf2excel: {
      title: 'PDF to Excel',
      desc: 'Pulls text into spreadsheet rows, grouped by position on the page.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          actionLabel: 'Convert to Excel',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
            const wsData = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const rows = {};
              content.items.forEach(it => {
                const y = Math.round(it.transform[5]);
                rows[y] = rows[y] || [];
                rows[y].push(it.str);
              });
              Object.keys(rows).sort((a, b) => b - a).forEach(y => wsData.push(rows[y]));
              wsData.push([]);
            }
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            const outBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            downloadBlob(new Blob([outBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${baseName(file.name)}.xlsx`);
            setStatus(statusEl, 'Done — text grouped into rows by position on the page. Works best on simple tables; complex multi-column layouts may need cleanup.', 'ok');
          }
        });
      }
    },

    pdf2ppt: {
      title: 'PDF to PowerPoint',
      desc: 'Turns each page into a full-slide image inside a .pptx.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          actionLabel: 'Convert to PowerPoint',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
            const pptx = new PptxGenJS();
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 2 });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width; canvas.height = viewport.height;
              await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
              const imgData = canvas.toDataURL('image/jpeg', 0.85);
              const slide = pptx.addSlide();
              slide.addImage({ data: imgData, x: 0, y: 0, w: '100%', h: '100%' });
            }
            await pptx.writeFile({ fileName: `${baseName(file.name)}.pptx` });
            setStatus(statusEl, `Done — ${pdf.numPages} page(s), each as a full-slide image.`, 'ok');
          }
        });
      }
    },

    pdf2jpg: {
      title: 'PDF to JPG',
      desc: 'Renders each page as a JPG image.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          actionLabel: 'Convert to JPG',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

            async function pageToBlob(pageNum) {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 2 });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width; canvas.height = viewport.height;
              await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
              return await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
            }

            if (pdf.numPages === 1) {
              const blob = await pageToBlob(1);
              downloadBlob(blob, `${baseName(file.name)}.jpg`);
            } else {
              const zip = new JSZip();
              for (let i = 1; i <= pdf.numPages; i++) {
                const blob = await pageToBlob(i);
                zip.file(`page-${i}.jpg`, blob);
              }
              const zipBlob = await zip.generateAsync({ type: 'blob' });
              downloadBlob(zipBlob, `${baseName(file.name)}-pages.zip`);
            }
            setStatus(statusEl, `Done — ${pdf.numPages} page(s) converted.`, 'ok');
          }
        });
      }
    },

    jpg2pdf: {
      title: 'JPG to PDF',
      desc: 'Stacks one or more images into a single PDF, one per page.',
      render(container) {
        buildForm(container, {
          accept: 'image/*',
          multiple: true,
          actionLabel: 'Convert to PDF',
          async onRun({ files, statusEl }) {
            const out = await PDFDocument.create();
            for (const f of files) {
              const bytes = await fileToArrayBuffer(f);
              const img = f.type.includes('png') ? await out.embedPng(bytes) : await out.embedJpg(bytes);
              const page = out.addPage([img.width, img.height]);
              page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
            }
            const outBytes = await out.save();
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), 'images.pdf');
            setStatus(statusEl, `Done — combined ${files.length} image${files.length > 1 ? 's' : ''} into one PDF.`, 'ok');
          }
        });
      }
    },

    edit: {
      title: 'Edit PDF',
      desc: 'Stamps a line of text onto a page — quick fixes without redoing the whole file.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          fields: [
            { id: 'editPage', name: 'page', label: 'Page number', html: '<input type="number" id="editPage" min="1" value="1">' },
            { id: 'editText', name: 'text', label: 'Text to add', html: '<input type="text" id="editText" placeholder="Type the text you want on the page">' },
            { id: 'editPos', name: 'pos', label: 'Position', html: '<select id="editPos"><option value="top">Top</option><option value="center" selected>Center</option><option value="bottom">Bottom</option></select>' }
          ],
          actionLabel: 'Apply and download',
          async onRun({ files, values, statusEl }) {
            if (!values.text.trim()) throw new Error('Type something to add to the page.');
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const doc = await PDFDocument.load(bytes);
            const pages = doc.getPages();
            const idx = clamp(parseInt(values.page, 10) - 1 || 0, 0, pages.length - 1);
            const page = pages[idx];
            const { width, height } = page.getSize();
            const y = values.pos === 'top' ? height - 60 : values.pos === 'bottom' ? 40 : height / 2;
            page.drawText(values.text, { x: 50, y, size: 18, color: rgb(0.7, 0.22, 0.17) });
            const outBytes = await doc.save();
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-edited.pdf`);
            setStatus(statusEl, `Done — added your text to page ${idx + 1}.`, 'ok');
          }
        });
      }
    },

    sign: {
      title: 'Sign PDF',
      desc: 'Draw a signature and drop it onto a page.',
      render(container) {
        container.innerHTML = `
          <div class="field">
            <label>Choose PDF</label>
            <input type="file" class="file-input" accept=".pdf">
          </div>
          <div class="field">
            <label>Draw your signature</label>
            <canvas class="sig-pad" id="sigPad" width="500" height="160"></canvas>
            <div class="field-hint">Click / touch and drag to draw. <a href="#" id="sigClear" style="text-decoration:underline;">Clear</a></div>
          </div>
          <div class="field">
            <label>Page number</label>
            <input type="number" id="signPage" min="1" value="1">
          </div>
          <div class="field">
            <label>Position</label>
            <select id="signPos">
              <option value="br" selected>Bottom right</option>
              <option value="bl">Bottom left</option>
              <option value="bc">Bottom center</option>
            </select>
          </div>
          <button type="button" class="btn btn-primary btn-block run-btn">Sign and download</button>
          <div class="status" id="toolStatus"></div>
        `;
        const fileInput = container.querySelector('.file-input');
        const canvas = container.querySelector('#sigPad');
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1E1C18';
        let drawing = false, hasDrawn = false;

        function pos(e) {
          const r = canvas.getBoundingClientRect();
          const p = e.touches ? e.touches[0] : e;
          return { x: (p.clientX - r.left) * (canvas.width / r.width), y: (p.clientY - r.top) * (canvas.height / r.height) };
        }
        function start(e) { drawing = true; hasDrawn = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); }
        function move(e) { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); }
        function end() { drawing = false; }
        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove', move, { passive: false });
        canvas.addEventListener('touchend', end);
        container.querySelector('#sigClear').addEventListener('click', (e) => {
          e.preventDefault();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          hasDrawn = false;
        });

        maybePreload(fileInput, '.pdf');

        const runBtn = container.querySelector('.run-btn');
        const statusEl = container.querySelector('#toolStatus');
        runBtn.addEventListener('click', async () => {
          const file = fileInput.files[0];
          if (!file) { setStatus(statusEl, 'Please choose a PDF first.', 'err'); return; }
          if (!hasDrawn) { setStatus(statusEl, 'Draw a signature first.', 'err'); return; }
          runBtn.disabled = true;
          setStatus(statusEl, 'Working…', 'info');
          try {
            const sigDataUrl = canvas.toDataURL('image/png');
            const bytes = await fileToArrayBuffer(file);
            const doc = await PDFDocument.load(bytes);
            const pages = doc.getPages();
            const pageNum = clamp(parseInt(container.querySelector('#signPage').value, 10) - 1 || 0, 0, pages.length - 1);
            const page = pages[pageNum];
            const { width, height } = page.getSize();
            const pngImage = await doc.embedPng(sigDataUrl);
            const dims = pngImage.scale(0.28);
            const posChoice = container.querySelector('#signPos').value;
            let x, y = 40;
            if (posChoice === 'bl') x = 40;
            else if (posChoice === 'bc') x = width / 2 - dims.width / 2;
            else x = width - dims.width - 40;
            page.drawImage(pngImage, { x, y, width: dims.width, height: dims.height });
            const outBytes = await doc.save();
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-signed.pdf`);
            setStatus(statusEl, `Done — signature placed on page ${pageNum + 1}.`, 'ok');
          } catch (err) {
            console.error(err);
            setStatus(statusEl, 'Something went wrong: ' + err.message, 'err');
          } finally {
            runBtn.disabled = false;
          }
        });
      }
    },

    watermark: {
      title: 'Watermark PDF',
      desc: 'Stamps diagonal text across every page.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          fields: [{ id: 'wmText', name: 'text', label: 'Watermark text', html: '<input type="text" id="wmText" placeholder="e.g. CONFIDENTIAL" value="CONFIDENTIAL">' }],
          actionLabel: 'Apply watermark',
          async onRun({ files, values, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const doc = await PDFDocument.load(bytes);
            const font = await doc.embedFont(StandardFonts.HelveticaBold);
            const text = values.text.trim() || 'WATERMARK';
            doc.getPages().forEach(page => {
              const { width, height } = page.getSize();
              const textWidth = font.widthOfTextAtSize(text, 40);
              page.drawText(text, {
                x: width / 2 - textWidth / 2, y: height / 2, size: 40, font,
                color: rgb(0.7, 0.22, 0.17), opacity: 0.22, rotate: degrees(-30)
              });
            });
            const outBytes = await doc.save();
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-watermarked.pdf`);
            setStatus(statusEl, 'Done — watermark applied to every page.', 'ok');
          }
        });
      }
    },

    protect: {
      title: 'Protect PDF',
      desc: 'Wraps your PDF in a password-gated file for casual sharing.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          fields: [{ id: 'pwField', name: 'password', label: 'Set a password', html: '<input type="password" id="pwField" placeholder="Choose a password">' }],
          actionLabel: 'Lock file',
          async onRun({ files, values, statusEl }) {
            if (!values.password) throw new Error('Choose a password first.');
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            let binary = '';
            const arr = new Uint8Array(bytes);
            for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
            const base64 = btoa(binary);

            const enc = new TextEncoder();
            const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(values.password));
            const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Locked file</title>
<style>body{font-family:sans-serif;max-width:420px;margin:80px auto;text-align:center;color:#1E1C18;}
input{padding:10px;width:100%;box-sizing:border-box;margin:12px 0;border:1px solid #ccc;border-radius:4px;}
button{padding:10px 20px;border:none;background:#1E1C18;color:#EDE8DC;border-radius:4px;cursor:pointer;}
#msg{color:#B3392C;font-size:0.9rem;min-height:1.2em;}</style></head>
<body>
<h2>This file is locked</h2>
<p>Enter the password to open it.</p>
<input type="password" id="pw" placeholder="Password">
<button id="go">Unlock</button>
<p id="msg"></p>
<script>
const stored = "${hashHex}";
const data = "${base64}";
async function hash(s){const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
document.getElementById('go').addEventListener('click', async () => {
  const val = document.getElementById('pw').value;
  const h = await hash(val);
  if (h === stored) {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const blob = new Blob([bytes], {type:'application/pdf'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "${baseName(file.name)}.pdf";
    a.click();
    document.getElementById('msg').style.color = '#56624A';
    document.getElementById('msg').textContent = 'Correct — your download has started.';
  } else {
    document.getElementById('msg').textContent = 'Wrong password, try again.';
  }
});
<\/script>
</body></html>`;
            const blob = new Blob([html], { type: 'text/html' });
            downloadBlob(blob, `${baseName(file.name)}-locked.html`);
            setStatus(statusEl, 'Done — downloaded a password-gated HTML file. Open it and enter the password to get the PDF. Heads up: this is a convenience lock for casual sharing, not standard PDF encryption — don\u2019t rely on it for sensitive documents.', 'ok');
          }
        });
      }
    },

    unlock: {
      title: 'Unlock PDF',
      desc: 'Removes owner-password restrictions (like disabled printing/editing) that you have the right to remove.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          actionLabel: 'Unlock file',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            try {
              const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
              const outBytes = await doc.save();
              downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-unlocked.pdf`);
              setStatus(statusEl, 'Done — resaved without the restrictions we could detect. Note: if this PDF needs a password just to open it (not just to restrict editing), browser-only tools can\u2019t decrypt that — you\u2019ll need the original password in a PDF reader first.', 'ok');
            } catch (err) {
              throw new Error('Couldn\u2019t process this file — it may require a password just to open, which needs the original password entered in a PDF reader first.');
            }
          }
        });
      }
    },

    ocr: {
      title: 'OCR PDF',
      desc: 'Pulls the existing text layer out of a PDF into a plain text file.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          actionLabel: 'Extract text',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += `--- Page ${i} ---\n` + content.items.map(it => it.str).join(' ') + '\n\n';
            }
            if (text.replace(/---.*?---/g, '').trim().length < 5) {
              setStatus(statusEl, 'This PDF doesn\u2019t seem to have a text layer — it\u2019s likely scanned pages, which needs full image OCR. That\u2019s a heavier engine than this lightweight browser tool includes.', 'err');
              return;
            }
            downloadBlob(new Blob([text], { type: 'text/plain' }), `${baseName(file.name)}.txt`);
            setStatus(statusEl, 'Done — extracted the text layer already embedded in the PDF to a .txt file.', 'ok');
          }
        });
      }
    },

    repair: {
      title: 'Repair PDF',
      desc: 'Tries to reload and resave a damaged PDF, which fixes many minor structural issues.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          actionLabel: 'Repair file',
          async onRun({ files, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            try {
              const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
              const outBytes = await doc.save();
              downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-repaired.pdf`);
              setStatus(statusEl, 'Done — the file loaded and resaved cleanly, which often fixes minor corruption.', 'ok');
            } catch (err) {
              throw new Error('Couldn\u2019t parse this file well enough to repair it in the browser. It may be too damaged, or password protected.');
            }
          }
        });
      }
    },

    rotate: {
      title: 'Rotate PDF',
      desc: 'Rotates every page by the same amount — handy for sideways scans.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          fields: [{ id: 'rotateDeg', name: 'deg', label: 'Rotate by', html: '<select id="rotateDeg"><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">90° counter-clockwise</option></select>' }],
          actionLabel: 'Rotate and download',
          async onRun({ files, values, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const doc = await PDFDocument.load(bytes);
            const deg = parseInt(values.deg, 10);
            doc.getPages().forEach(page => {
              const current = page.getRotation().angle;
              page.setRotation(degrees((current + deg) % 360));
            });
            const outBytes = await doc.save();
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-rotated.pdf`);
            setStatus(statusEl, 'Done — every page rotated.', 'ok');
          }
        });
      }
    },

    numberpages: {
      title: 'Number Pages',
      desc: 'Adds a running page number to the bottom of every page.',
      render(container) {
        buildForm(container, {
          accept: '.pdf',
          fields: [{ id: 'startNum', name: 'start', label: 'Start at', html: '<input type="number" id="startNum" value="1" min="0">' }],
          actionLabel: 'Add page numbers',
          async onRun({ files, values, statusEl }) {
            const file = files[0];
            const bytes = await fileToArrayBuffer(file);
            const doc = await PDFDocument.load(bytes);
            const font = await doc.embedFont(StandardFonts.Helvetica);
            let n = parseInt(values.start, 10) || 1;
            doc.getPages().forEach(page => {
              const { width } = page.getSize();
              const label = String(n);
              const w = font.widthOfTextAtSize(label, 11);
              page.drawText(label, { x: width / 2 - w / 2, y: 24, size: 11, font, color: rgb(0.35, 0.33, 0.28) });
              n++;
            });
            const outBytes = await doc.save();
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-numbered.pdf`);
            setStatus(statusEl, 'Done — page numbers added.', 'ok');
          }
        });
      }
    },

    compare: {
      title: 'Compare PDFs',
      desc: 'Extracts the text of two PDFs and highlights what changed between them.',
      render(container) {
        container.innerHTML = `
          <div class="compare-cols">
            <div class="field">
              <label>File A</label>
              <input type="file" class="file-input" id="cmpA" accept=".pdf">
            </div>
            <div class="field">
              <label>File B</label>
              <input type="file" class="file-input" id="cmpB" accept=".pdf">
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-block run-btn">Compare</button>
          <div class="status" id="toolStatus"></div>
          <div class="diff-box" id="diffBox" hidden></div>
        `;
        const runBtn = container.querySelector('.run-btn');
        const statusEl = container.querySelector('#toolStatus');
        const diffBox = container.querySelector('#diffBox');

        async function extractWords(file) {
          const bytes = await fileToArrayBuffer(file);
          const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(' ') + ' ';
          }
          return text.trim().split(/\s+/).filter(Boolean);
        }

        function diffWords(a, b) {
          const n = a.length, m = b.length;
          const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
          for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
              dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
          }
          let i = 0, j = 0; const ops = [];
          while (i < n && j < m) {
            if (a[i] === b[j]) { ops.push({ t: 'same', w: a[i] }); i++; j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: 'del', w: a[i] }); i++; }
            else { ops.push({ t: 'add', w: b[j] }); j++; }
          }
          while (i < n) { ops.push({ t: 'del', w: a[i] }); i++; }
          while (j < m) { ops.push({ t: 'add', w: b[j] }); j++; }
          return ops;
        }

        runBtn.addEventListener('click', async () => {
          const fileA = container.querySelector('#cmpA').files[0];
          const fileB = container.querySelector('#cmpB').files[0];
          if (!fileA || !fileB) { setStatus(statusEl, 'Choose both files first.', 'err'); return; }
          runBtn.disabled = true;
          setStatus(statusEl, 'Reading and comparing…', 'info');
          diffBox.hidden = true;
          try {
            let [wordsA, wordsB] = await Promise.all([extractWords(fileA), extractWords(fileB)]);
            let truncated = false;
            const CAP = 1200;
            if (wordsA.length > CAP) { wordsA = wordsA.slice(0, CAP); truncated = true; }
            if (wordsB.length > CAP) { wordsB = wordsB.slice(0, CAP); truncated = true; }
            const ops = diffWords(wordsA, wordsB);
            const html = ops.map(op => {
              if (op.t === 'same') return escapeHtml(op.w);
              if (op.t === 'add') return `<ins>${escapeHtml(op.w)}</ins>`;
              return `<del>${escapeHtml(op.w)}</del>`;
            }).join(' ');
            diffBox.innerHTML = html;
            diffBox.hidden = false;
            const added = ops.filter(o => o.t === 'add').length;
            const removed = ops.filter(o => o.t === 'del').length;
            setStatus(statusEl, `Done — ${added} word(s) added, ${removed} removed.${truncated ? ' (Compared the first ' + CAP + ' words of each file for speed.)' : ''}`, 'ok');
          } catch (err) {
            console.error(err);
            setStatus(statusEl, 'Something went wrong: ' + err.message, 'err');
          } finally {
            runBtn.disabled = false;
          }
        });
      }
    }
  };

  /* ---------- open a tool ---------- */
  function openTool(id) {
    const tool = TOOLS[id];
    if (!tool) return;
    openModal(tool.title, tool.desc);
    tool.render(modalBody);
  }

  /* click delegation for every element with data-tool */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-tool]');
    if (!el) return;
    e.preventDefault();
    openTool(el.dataset.tool);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest('[data-tool][role="button"]');
    if (!el) return;
    e.preventDefault();
    openTool(el.dataset.tool);
  });

  /* ---------- "Open a file" header button ---------- */
  const openFileBtn = document.getElementById('openFileBtn');
  const quickOpenInput = document.getElementById('quickOpenInput');

  openFileBtn.addEventListener('click', () => quickOpenInput.click());

  quickOpenInput.addEventListener('change', () => {
    const file = quickOpenInput.files[0];
    if (!file) return;
    pendingFile = file;
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) {
      openModal('What would you like to do?', 'Pick a tool for this PDF — it\u2019ll already be loaded in.');
      modalBody.innerHTML = `
        <div class="card-grid" style="grid-template-columns:repeat(2,1fr);">
          <article class="tool-card" data-tool="compress" tabindex="0" role="button"><h3>Compress</h3></article>
          <article class="tool-card" data-tool="pdf2word" tabindex="0" role="button"><h3>To Word</h3></article>
          <article class="tool-card" data-tool="pdf2jpg" tabindex="0" role="button"><h3>To JPG</h3></article>
          <article class="tool-card" data-tool="sign" tabindex="0" role="button"><h3>Sign</h3></article>
          <article class="tool-card" data-tool="watermark" tabindex="0" role="button"><h3>Watermark</h3></article>
          <article class="tool-card" data-tool="split" tabindex="0" role="button"><h3>Split</h3></article>
        </div>`;
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      openTool('word2pdf');
    } else if (name.match(/\.(jpg|jpeg|png)$/)) {
      openTool('jpg2pdf');
    } else {
      openModal('Unsupported file', 'This file type isn\u2019t handled by any tool here yet — try a PDF, Word document, or image.');
    }
    quickOpenInput.value = '';
  });

});
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach(p => {
        p.classList.toggle('is-active', p.dataset.panel === target);
      });
    });

    // keyboard support: left/right arrows move between tabs
    tab.addEventListener('keydown', (e) => {
      const list = Array.from(tabs);
      const i = list.indexOf(tab);
      if (e.key === 'ArrowRight') list[(i + 1) % list.length].focus();
      if (e.key === 'ArrowLeft') list[(i - 1 + list.length) % list.length].focus();
    });
  });
});