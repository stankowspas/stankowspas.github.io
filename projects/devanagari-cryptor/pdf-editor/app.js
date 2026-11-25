// PDF Studio: an in-browser PDF editor. Nothing is uploaded; all work happens on this page.
// The open-source PDF engines (pdf.js, pdf-lib) load from a public code CDN; your PDF itself never leaves the page.
const CDNS = ['https://cdn.jsdelivr.net/npm/', 'https://unpkg.com/'];
const PDFJS_PKG = 'pdfjs-dist@4.10.38/';
let CDN = CDNS[0];
async function importAny(path) {
  let err;
  for (const c of CDNS) { try { const m = await import(c + path); CDN = c; return m; } catch (e) { err = e; } }
  throw err;
}
function loadScript(path, globalName) {
  return new Promise((res, rej) => {
    if (window[globalName]) return res(window[globalName]);
    const list = [CDN, ...CDNS.filter(c => c !== CDN)];
    const next = i => {
      if (i >= list.length) return rej(new Error('Could not load ' + globalName + '. Check your internet connection.'));
      const s = document.createElement('script'); s.src = list[i] + path; s.crossOrigin = 'anonymous';
      s.onload = () => (window[globalName] ? res(window[globalName]) : next(i + 1)); s.onerror = () => { s.remove(); next(i + 1); };
      document.head.append(s);
    };
    next(0);
  });
}
let pdfjsLib;
const pdfReady = importAny(PDFJS_PKG + 'legacy/build/pdf.min.mjs').then(m => { pdfjsLib = m; return m; });
pdfReady.catch(() => setTimeout(() => toast('Could not load the PDF engine. Check your internet connection and reload.', 8000), 0));
const workerReady = pdfReady.then(async () => {
  for (const c of [CDN, ...CDNS.filter(x => x !== CDN)]) {
    try { const r = await fetch(c + PDFJS_PKG + 'legacy/build/pdf.worker.min.mjs'); if (!r.ok) continue; const txt = await r.text();
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' })); return; } catch (e) { /* try the next mirror */ }
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + PDFJS_PKG + 'legacy/build/pdf.worker.min.mjs';
});
const libReady = loadScript('pdf-lib@1.17.1/dist/pdf-lib.min.js', 'PDFLib');
libReady.catch(e => setTimeout(() => toast(e.message, 8000), 0));
const DOC_OPTS = () => ({ cMapUrl: CDN + PDFJS_PKG + 'cmaps/', cMapPacked: true, standardFontDataUrl: CDN + PDFJS_PKG + 'standard_fonts/', isEvalSupported: false });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PAD = 2;          // inner padding of text boxes, in PDF points
const LH = 1.25;        // line height multiple
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isPhone = () => window.matchMedia('(max-width: 820px)').matches;
const ICON = {
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  rotate: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 1-2.3-5.6L20 8"/><path d="M20 3v5h-5"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  alignL: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
  alignC: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
  alignR: '<svg viewBox="0 0 24 24"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>',
  done: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
};

/* ---------------- fonts ---------------- */
const FONTS = {
  Helvetica: { label: 'Helvetica (sans)', std: { r: 'Helvetica', b: 'Helvetica-Bold', i: 'Helvetica-Oblique', bi: 'Helvetica-BoldOblique' }, web: 'arimo', css: 'Arial, Helvetica, sans-serif', m: [0.905, 0.212] },
  Times: { label: 'Times (serif)', std: { r: 'Times-Roman', b: 'Times-Bold', i: 'Times-Italic', bi: 'Times-BoldItalic' }, web: 'tinos', css: '"Times New Roman", Times, serif', m: [0.891, 0.216] },
  Courier: { label: 'Courier (mono)', std: { r: 'Courier', b: 'Courier-Bold', i: 'Courier-Oblique', bi: 'Courier-BoldOblique' }, web: 'cousine', css: '"Courier New", Courier, monospace', m: [0.833, 0.3] },
  Poppins: { label: 'Poppins', files: { r: 'Poppins-Regular.ttf', b: 'Poppins-Bold.ttf', i: 'Poppins-Italic.ttf', bi: 'Poppins-BoldItalic.ttf' }, css: 'sans-serif', m: [1.05, 0.35] },
  Lato: { label: 'Lato', files: { r: 'https://cdn.jsdelivr.net/gh/google/fonts@6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/lato/Lato-Regular.ttf', b: 'https://cdn.jsdelivr.net/gh/google/fonts@6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/lato/Lato-Bold.ttf', i: 'https://cdn.jsdelivr.net/gh/google/fonts@6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/lato/Lato-Italic.ttf', bi: 'https://cdn.jsdelivr.net/gh/google/fonts@6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/lato/Lato-BoldItalic.ttf' }, css: 'sans-serif', m: [0.987, 0.213] },
  'Great Vibes': { label: 'Great Vibes (signature)', files: { r: 'https://cdn.jsdelivr.net/gh/google/fonts@6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/greatvibes/GreatVibes-Regular.ttf' }, css: 'cursive', m: [0.9, 0.4] },
  Pacifico: { label: 'Pacifico (fun)', files: { r: 'https://cdn.jsdelivr.net/gh/google/fonts@6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/pacifico/Pacifico-Regular.ttf' }, css: 'cursive', m: [1.3, 0.45] },
};
const VARIANT_CSS = { r: ['400', 'normal'], b: ['700', 'normal'], i: ['400', 'italic'], bi: ['700', 'italic'] };
const faces = {};   // key|v -> FontFace
function fontFile(key, v) {
  const F = FONTS[key];
  if (F.std) return `fonts/${F.web}-latin-${VARIANT_CSS[v][0]}-${VARIANT_CSS[v][1]}.woff2`;
  const f = F.files[v];
  return /^https?:/.test(f) ? f : `fonts/${f}`;
}
function registerFaces() {
  if (!('FontFace' in window)) return;
  for (const [key, F] of Object.entries(FONTS)) {
    const set = F.std || F.files;
    for (const v of Object.keys(set)) {
      const [w, s] = VARIANT_CSS[v];
      const face = new FontFace(`pe-${key}`, `url(${fontFile(key, v)})`, { weight: w, style: s, display: 'swap' });
      document.fonts.add(face);
      faces[key + '|' + v] = face;
    }
  }
}
const cssFamily = key => `"pe-${key}", ${FONTS[key].css}`;
function variantOf(o, key) {
  const set = FONTS[key].std || FONTS[key].files;
  const v = (o.bold ? 'b' : '') + (o.italic ? 'i' : '') || 'r';
  return set[v] ? v : 'r';
}
const hasStyles = key => !!(FONTS[key].std || FONTS[key].files.b);
async function ensureFace(key, v) {
  const f = faces[key + '|' + v];
  if (!f || f.status === 'loaded') return;
  try { await f.load(); } catch (e) { /* fall back to the system font */ }
}
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function winAnsiOK(t) {
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if (c === 10 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WINANSI_EXTRA.includes(ch)) continue;
    return false;
  }
  return true;
}
// Standard PDF fonts only cover Western characters; switch to Lato (which has ₹ and more) when needed.
const effKey = o => (FONTS[o.font]?.std && !winAnsiOK(o.text || '')) ? 'Lato' : (FONTS[o.font] ? o.font : 'Helvetica');

let stdMetrics = null; // pdf-lib standard fonts, for exact widths
async function initStdMetrics() {
  const d = await PDFLib.PDFDocument.create();
  const m = {};
  for (const F of Object.values(FONTS)) if (F.std) for (const n of Object.values(F.std)) m[n] = await d.embedFont(n);
  stdMetrics = m;
}
const mctx = document.createElement('canvas').getContext('2d');
function cssFont(key, v, size) {
  const [w, s] = VARIANT_CSS[v];
  return `${s === 'italic' ? 'italic ' : ''}${w} ${size}px ${cssFamily(key)}`;
}
function textWidth(str, key, v, size) {
  const F = FONTS[key];
  if (F.std && stdMetrics) {
    try { return stdMetrics[F.std[v] || F.std.r].widthOfTextAtSize(str, size); } catch (e) { /* fall through */ }
  }
  mctx.font = cssFont(key, v, 100);
  return mctx.measureText(str).width * size / 100;
}
const metricCache = {};
function fontMetrics(key, v) { // [ascent, descent] as fractions of size, as the browser lays out lines
  const ck = key + '|' + v;
  if (metricCache[ck]) return metricCache[ck];
  const face = faces[ck];
  let m = FONTS[key].m;
  if (face && face.status === 'loaded') {
    mctx.font = cssFont(key, v, 100);
    const t = mctx.measureText('Hg');
    if (t.fontBoundingBoxAscent) { m = [t.fontBoundingBoxAscent / 100, t.fontBoundingBoxDescent / 100]; metricCache[ck] = m; }
  }
  return m;
}
function baselineOffset(o, key, v) { // from the top of a line box to its baseline
  const [a, d] = fontMetrics(key, v);
  return (LH - (a + d)) / 2 * o.size + a * o.size;
}
function wrapText(o) {
  const key = effKey(o), v = variantOf(o, key), size = o.size;
  const maxW = Math.max(o.w - 2 * PAD, size * 0.8);
  const W = s => textWidth(s, key, v, size);
  const out = [];
  const paras = (o.text || '').replace(/\t/g, '    ').replace(/\r/g, '').split('\n');
  for (const para of paras) {
    if (para === '') { out.push(''); continue; }
    const toks = para.match(/\s+|\S+/g) || [];
    let line = '';
    for (const tok of toks) {
      if (W(line + tok) <= maxW + 0.01) { line += tok; continue; }
      if (/^\s+$/.test(tok)) { out.push(line); line = ''; continue; }
      if (line.trim()) { out.push(line.replace(/\s+$/, '')); line = ''; }
      if (W(tok) <= maxW) { line = tok; continue; }
      for (const ch of tok) { if (line && W(line + ch) > maxW) { out.push(line); line = ch; } else line += ch; }
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out;
}
function fitTextHeight(o) {
  if (o.autoW) { // box grows with what is typed until the page edge, then wraps
    const key = effKey(o), v = variantOf(o, key);
    const lines = (o.text || '').replace(/\t/g, '    ').split('\n');
    let w = Math.max(...lines.map(l => textWidth(l, key, v, o.size)), o.text ? 0 : textWidth('Type here', key, v, o.size));
    w += 2 * PAD + Math.max(2, o.size * 0.3);
    const [, pid] = findObj(o.id); const p = pid ? pageById(pid) : null;
    const maxW = p ? Math.max(o.size * 2, p.w - Math.max(0, o.x) - 4) : w;
    o.w = Math.min(w, maxW);
  }
  const n = Math.max(1, wrapText(o).length); o.h = n * o.size * LH + 2 * PAD;
}

/* ---------------- state ---------------- */
const S = {
  fileName: 'document.pdf', base: null, pdf: null,
  pages: [],          // {id, src, view:[x0,y0,x1,y1], rot, w, h}
  objects: {},        // pageId -> [obj]
  images: {},         // imageId -> {bytes, mime, url, w, h}
  zoom: 1, tool: 'select', sel: null, editing: null, dirty: false, curPage: 0,
  style: { font: 'Helvetica', size: 16, color: '#111827', bold: false, italic: false, underline: false, align: 'left', bg: null,
           fill: '#ffffff', stroke: '#e11d48', strokeW: 2, rectFill: null, opacity: 1, hl: '#fde047', pen: '#1d4ed8', penW: 3 },
};
const pageEls = new Map();   // pageId -> {el, canvas, layer, tlayer}
const textCache = new Map(); // src index -> textContent
function pageById(id) { return S.pages.find(p => p.id === id); }
function findObj(id) { for (const [pid, arr] of Object.entries(S.objects)) { const o = arr.find(x => x.id === id); if (o) return [o, pid]; } return [null, null]; }
function sizeFromView(view, rot) { const w = view[2] - view[0], h = view[3] - view[1]; return rot % 180 ? [h, w] : [w, h]; }

/* the same mapping pdf.js uses between page user space and the displayed (rotated) page, at scale 1 */
function vpTransform(view, rot) {
  const cx = (view[2] + view[0]) / 2, cy = (view[3] + view[1]) / 2;
  let A, B, C, D;
  switch (((rot % 360) + 360) % 360) {
    case 90: A = 0; B = 1; C = 1; D = 0; break;
    case 180: A = -1; B = 0; C = 0; D = 1; break;
    case 270: A = 0; B = -1; C = -1; D = 0; break;
    default: A = 1; B = 0; C = 0; D = -1;
  }
  let ox, oy;
  if (A === 0) { ox = Math.abs(cy - view[1]); oy = Math.abs(cx - view[0]); }
  else { ox = Math.abs(cx - view[0]); oy = Math.abs(cy - view[1]); }
  return [A, B, C, D, ox - A * cx - C * cy, oy - B * cx - D * cy];
}
function toPdf(t, x, y) {
  const d = t[0] * t[3] - t[1] * t[2];
  return [(x * t[3] - y * t[2] + t[2] * t[5] - t[4] * t[3]) / d, (-x * t[1] + y * t[0] + t[4] * t[1] - t[5] * t[0]) / d];
}

/* ---------------- history ---------------- */
const H = { stack: [], idx: -1 };
const snap = () => JSON.stringify({ pages: S.pages, objects: S.objects });
function commit() {
  const s = snap();
  if (H.stack[H.idx] === s) return;
  H.stack = H.stack.slice(0, H.idx + 1); H.stack.push(s);
  if (H.stack.length > 200) H.stack.shift();
  H.idx = H.stack.length - 1;
  if (H.idx > 0) S.dirty = true;
  updateUndo();
}
function updateUndo() { $('#btnUndo').disabled = H.idx <= 0; $('#btnRedo').disabled = H.idx >= H.stack.length - 1; }
function restore(s) {
  const st = JSON.parse(s);
  const pagesChanged = JSON.stringify(S.pages) !== JSON.stringify(st.pages);
  S.pages = st.pages; S.objects = st.objects; S.sel = null; S.editing = null;
  if (pagesChanged) { buildPages(); buildThumbs(); } else renderAllObjects();
  renderProps(); updateUndo();
}
function undo() { finishEdit(); if (H.idx <= 0) return; H.idx--; restore(H.stack[H.idx]); }
function redo() { finishEdit(); if (H.idx >= H.stack.length - 1) return; H.idx++; restore(H.stack[H.idx]); }

/* ---------------- ui helpers ---------------- */
let toastT;
function toast(msg, ms = 2400) { const t = $('#toast'); t.textContent = msg; window.pdfEditorUI.localize(t); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function busy(on, text = 'Working…') { $('#busy').hidden = !on; $('#busyText').textContent = text; window.pdfEditorUI.localize($('#busyText')); }
function hexToRgb(hex) { const h = (hex || '#000000').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); }
const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

/* ---------------- opening documents ---------------- */
async function openFile(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) { toast('That is not a PDF file. Please choose a .pdf'); return; }
  if (S.base && S.dirty && !confirm(window.pdfEditorUI.translate('Open a new PDF? Your unsaved edits to the current one will be lost.'))) return;
  busy(true, 'Opening…');
  try { await openBytes(new Uint8Array(await file.arrayBuffer()), file.name); }
  catch (e) { console.error(e); toast('Could not open this PDF: ' + (e.message || e), 4500); }
  finally { busy(false); }
}
async function openBytes(bytes, name) {
  if (S.pdf) { try { await S.pdf.destroy(); } catch (e) {} }
  textCache.clear();
  await workerReady;
  const task = pdfjsLib.getDocument({ data: bytes.slice(), ...DOC_OPTS() });
  task.onPassword = (cb, reason) => {
    const p = prompt(window.pdfEditorUI.translate(reason === 2 ? 'Wrong password. Try again:' : 'This PDF is password protected. Enter its password:'));
    if (p === null) task.destroy(); else cb(p);
  };
  const pdf = await task.promise;
  S.pdf = pdf; S.base = bytes; S.fileName = name || 'document.pdf';
  S.pages = []; S.objects = {}; S.images = {}; S.sel = null; S.editing = null;
  for (let i = 0; i < pdf.numPages; i++) {
    const pg = await pdf.getPage(i + 1);
    const view = pg.view.slice(), rot = pg.rotate || 0;
    const [w, h] = sizeFromView(view, rot);
    S.pages.push({ id: 'p' + uid(), src: i, view, rot, w, h });
  }
  H.stack = []; H.idx = -1; commit(); S.dirty = false;
  document.body.classList.remove('no-doc');
  $('#landing').hidden = true; $('#editor').hidden = false;
  $('#docName').textContent = S.fileName; $('#docName').title = S.fileName;
  S.zoom = fitZoom();
  buildPages(); buildThumbs(); setTool('select', true); renderProps();
  $('#viewer').scrollTop = 0;
  toast(`${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} ready. Pick a tool to start editing.`);
}

/* ---------------- page rendering ---------------- */
let io;
function fitZoom() {
  const vw = $('#viewer').clientWidth || window.innerWidth;
  const maxW = Math.max(...S.pages.map(p => p.w), 200);
  const pad = isPhone() ? 20 : 48;
  return clamp((vw - pad) / maxW, 0.2, isPhone() ? 2 : 1.5);
}
function buildPages() {
  const wrap = $('#pagesWrap');
  wrap.innerHTML = ''; pageEls.clear();
  if (io) io.disconnect();
  io = new IntersectionObserver(ents => {
    for (const en of ents) { const pe = pageEls.get(en.target.dataset.id); if (!pe) continue; pe.visible = en.isIntersecting; if (en.isIntersecting) ensureRendered(en.target.dataset.id); }
  }, { root: $('#viewer'), rootMargin: '600px 0px' });
  S.pages.forEach((p, i) => {
    const el = document.createElement('div'); el.className = 'page'; el.dataset.id = p.id;
    const layer = document.createElement('div'); layer.className = 'layer'; layer.dataset.id = p.id;
    const tlayer = document.createElement('div'); tlayer.className = 'tlayer';
    const num = document.createElement('div'); num.className = 'pnum'; num.textContent = `${i + 1} / ${S.pages.length}`;
    layer.append(tlayer); el.append(layer, num); wrap.append(el);
    pageEls.set(p.id, { el, layer, tlayer, canvas: null, renderedZoom: 0, task: null, visible: false, tbuilt: false });
    layer.addEventListener('pointerdown', onLayerDown);
    layer.addEventListener('click', onLayerClick);
    io.observe(el);
  });
  applyZoom();
  renderAllObjects();
  updatePageInd();
}
function applyZoom() {
  for (const p of S.pages) {
    const pe = pageEls.get(p.id); if (!pe) continue;
    pe.el.style.width = p.w * S.zoom + 'px'; pe.el.style.height = p.h * S.zoom + 'px';
    pe.layer.style.width = p.w + 'px'; pe.layer.style.height = p.h + 'px';
    pe.layer.style.transform = `scale(${S.zoom})`;
  }
  document.documentElement.style.setProperty('--iz', (1 / S.zoom).toFixed(4));
  $('#zoomVal').textContent = Math.round(S.zoom * 100) + '%';
  clearTimeout(applyZoom.t);
  applyZoom.t = setTimeout(() => { for (const [id, pe] of pageEls) if (pe.visible) ensureRendered(id); }, 160);
}
function setZoom(z, ax, ay) {
  const v = $('#viewer'); const r = v.getBoundingClientRect();
  ax = ax ?? r.left + r.width / 2; ay = ay ?? r.top + r.height / 2;
  const old = S.zoom; z = clamp(z, 0.2, 5); if (Math.abs(z - old) < 0.001) return;
  const cx = v.scrollLeft + (ax - r.left), cy = v.scrollTop + (ay - r.top);
  S.zoom = z; applyZoom();
  const k = z / old;
  v.scrollLeft = cx * k - (ax - r.left); v.scrollTop = cy * k - (ay - r.top);
}
async function ensureRendered(id) {
  const pe = pageEls.get(id); const p = pageById(id);
  if (!pe || !p) return;
  const want = S.zoom;
  if (pe.renderedZoom === want) return;
  if (pe.task) { try { pe.task.cancel(); } catch (e) {} pe.task = null; }
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  let scale = want * dpr;
  const maxPx = 14e6; if (p.w * p.h * scale * scale > maxPx) scale = Math.sqrt(maxPx / (p.w * p.h));
  const c = document.createElement('canvas'); c.className = 'pc';
  c.width = Math.max(1, Math.round(p.w * scale)); c.height = Math.max(1, Math.round(p.h * scale));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  pe.renderedZoom = want;
  if (p.src >= 0) {
    try {
      const pg = await S.pdf.getPage(p.src + 1); pe.pdfPage = pg;
      const vp = pg.getViewport({ scale, rotation: p.rot });
      const task = pg.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS });
      pe.task = task; await task.promise; if (pe.task === task) pe.task = null;
    } catch (e) { if (e?.name === 'RenderingCancelledException') { if (pe.renderedZoom === want) pe.renderedZoom = 0; return; } console.warn(e); }
  }
  if (pageEls.get(id) !== pe || pe.renderedZoom !== want) return;
  if (pe.canvas) pe.canvas.replaceWith(c); else pe.el.prepend(c);
  pe.canvas = c;
  if (S.tool === 'edittext' && !pe.tbuilt) buildTextItems(id);
}
function updatePageInd() {
  const v = $('#viewer'); const mid = v.getBoundingClientRect().top + v.clientHeight / 3;
  let cur = 0;
  S.pages.forEach((p, i) => { const pe = pageEls.get(p.id); if (pe && pe.el.getBoundingClientRect().top < mid) cur = i; });
  $('#pageInd').textContent = `Page ${cur + 1} of ${S.pages.length}`; window.pdfEditorUI.localize($('#pageInd'));
  $$('.thumb').forEach((t, i) => t.classList.toggle('current', i === cur));
  S.curPage = cur;
}

/* ---------------- thumbnails & page operations ---------------- */
let tio;
function buildThumbs() {
  const ol = $('#thumbs'); ol.innerHTML = '';
  if (tio) tio.disconnect();
  tio = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) renderThumb(en.target); }), { root: $('#pagesPanel'), rootMargin: '400px 0px' });
  S.pages.forEach((p, i) => {
    const li = document.createElement('li'); li.className = 'thumb'; li.dataset.id = p.id;
    const tw = 120, th = Math.round(tw * p.h / p.w);
    li.innerHTML = `<canvas class="tcanvas" width="${tw * 2}" height="${th * 2}" style="width:${tw}px;height:${th}px" role="button" tabindex="0" aria-label="Go to page ${i + 1}"></canvas>
      <span class="tnum">${i + 1}</span>
      <div class="tops">
        <button data-op="up" title="Move up" aria-label="Move page ${i + 1} up" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
        <button data-op="down" title="Move down" aria-label="Move page ${i + 1} down" ${i === S.pages.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
        <button data-op="rot-left" title="Rotate left 90°" aria-label="Rotate left 90°"><svg viewBox="0 0 24 24"><path d="M4 11a8 8 0 1 1 2.3 5.6L4 12M4 4v7h7"/></svg></button>
        <button data-op="rot" title="Rotate right 90°" aria-label="Rotate right 90°"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.6L20 12m0-8v7h-7"/></svg></button>
        <button data-op="del" title="Delete page" aria-label="Delete page ${i + 1}" ${S.pages.length === 1 ? 'disabled' : ''}>${ICON.trash}</button>
      </div>`;
    window.pdfEditorUI.localize(li); ol.append(li); tio.observe(li);
  });
  updatePageInd();
}
async function renderThumb(li) {
  if (li._done) return; li._done = true;
  const p = pageById(li.dataset.id); if (!p) return;
  const c = li.querySelector('canvas'); const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  if (p.src < 0) return;
  try {
    const pg = await S.pdf.getPage(p.src + 1);
    const vp = pg.getViewport({ scale: c.width / p.w, rotation: p.rot });
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
  } catch (e) { console.warn(e); }
}
function scrollToPage(id) { const pe = pageEls.get(id); if (pe) pe.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.body.classList.remove('pages-open'); }
function pageOp(id, op) {
  finishEdit();
  const i = S.pages.findIndex(p => p.id === id); if (i < 0) return;
  if (op === 'del') {
    if (S.pages.length === 1) return;
    const n = (S.objects[id] || []).length;
    if (!confirm(window.pdfEditorUI.translate(`Delete page ${i + 1}${n ? ' and its ' + n + ' edit' + (n > 1 ? 's' : '') : ''}?`))) return;
    S.pages.splice(i, 1); delete S.objects[id];
  } else if (op === 'up' && i > 0) { [S.pages[i - 1], S.pages[i]] = [S.pages[i], S.pages[i - 1]]; }
  else if (op === 'down' && i < S.pages.length - 1) { [S.pages[i + 1], S.pages[i]] = [S.pages[i], S.pages[i + 1]]; }
  else if (op === 'rot' || op === 'rot-left') {
    const p = S.pages[i]; const h0 = p.h, w0 = p.w, left = op === 'rot-left';
    p.rot = (p.rot + (left ? 270 : 90)) % 360; [p.w, p.h] = sizeFromView(p.view, p.rot);
    for (const o of S.objects[id] || []) { // keep each edit upright and move it with the page
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2; const ncx = left ? cy : h0 - cy, ncy = left ? w0 - cx : cx;
      o.x = clamp(ncx - o.w / 2, 0, Math.max(0, p.w - o.w)); o.y = clamp(ncy - o.h / 2, 0, Math.max(0, p.h - o.h));
    }
  } else return;
  S.sel = null; commit(); buildPages(); buildThumbs(); renderProps();
  if (op !== 'del') setTimeout(() => scrollToPage(id), 50);
}
function addBlankPage() {
  finishEdit();
  const ref = S.pages[S.pages.length - 1];
  const w = ref ? ref.view[2] - ref.view[0] : 595.28, h = ref ? ref.view[3] - ref.view[1] : 841.89;
  const p = { id: 'p' + uid(), src: -1, view: [0, 0, w, h], rot: 0, w, h };
  S.pages.push(p); commit(); buildPages(); buildThumbs();
  setTimeout(() => scrollToPage(p.id), 60);
  toast('Blank page added at the end');
}

/* ---------------- objects in the DOM ---------------- */
function renderAllObjects() { for (const p of S.pages) renderPageObjects(p.id); }
function renderPageObjects(pid) {
  const pe = pageEls.get(pid); if (!pe) return;
  $$('.obj', pe.layer).forEach(e => { if (e.dataset.id !== S.editing) e.remove(); });
  for (const o of S.objects[pid] || []) {
    if (o.id === S.editing) { const e = pe.layer.querySelector(`.obj[data-id="${o.id}"]`); if (e) { pe.layer.append(e); continue; } }
    pe.layer.append(makeObjEl(o));
  }
}
function makeObjEl(o) {
  const e = document.createElement('div'); e.className = 'obj ' + o.type; e.dataset.id = o.id;
  if (o.type === 'image') { const img = document.createElement('img'); img.alt = ''; img.src = S.images[o.img]?.url || ''; e.append(img); }
  if (o.type === 'text') { const c = document.createElement('div'); c.className = 'tcontent'; e.append(c); }
  if (o.type === 'draw') e.innerHTML = '<svg class="draw" preserveAspectRatio="none"><path fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  styleObj(e, o);
  return e;
}
function drawPathD(o) {
  const pts = o.pts; if (!pts || !pts.length) return '';
  const P = i => [pts[i][0] * o.w, pts[i][1] * o.h];
  const f = n => n.toFixed(2);
  if (pts.length < 3) { const [a, b] = P(0); const [c, d] = P(pts.length - 1); return `M ${f(a)} ${f(b)} L ${f(c + 0.01)} ${f(d)}`; }
  let s = `M ${f(P(0)[0])} ${f(P(0)[1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x1, y1] = P(i), [x2, y2] = P(i + 1);
    s += ` Q ${f(x1)} ${f(y1)} ${f((x1 + x2) / 2)} ${f((y1 + y2) / 2)}`;
  }
  const [lx, ly] = P(pts.length - 1); s += ` L ${f(lx)} ${f(ly)}`;
  return s;
}
function styleObj(e, o) {
  if (o.type === 'text') fitTextHeight(o);
  Object.assign(e.style, { left: o.x + 'px', top: o.y + 'px', width: o.w + 'px', height: o.h + 'px' });
  e.classList.toggle('sel', S.sel === o.id);
  e.classList.toggle('editing', S.editing === o.id);
  if (o.type === 'text') {
    const key = effKey(o), v = variantOf(o, key);
    const c = e.querySelector('.tcontent');
    const [w, s] = VARIANT_CSS[v];
    Object.assign(c.style, { fontFamily: cssFamily(key), fontSize: o.size + 'px', fontWeight: w, fontStyle: s, color: o.color,
      lineHeight: (o.size * LH) + 'px', padding: PAD + 'px', textAlign: o.align, textDecoration: o.underline ? 'underline' : 'none',
      background: o.bg || 'transparent', whiteSpace: (S.editing === o.id && !o.autoW) ? 'pre-wrap' : 'pre' });
    if (S.editing !== o.id) {
      c.textContent = '';
      if (o.text) for (const ln of wrapText(o)) { const d = document.createElement('div'); d.className = 'ln'; d.textContent = ln; c.append(d); }
    }
    const face = faces[key + '|' + v];
    if (face && face.status !== 'loaded') ensureFace(key, v).then(() => { if (e.isConnected) styleObj(e, o); });
  } else if (o.type === 'rect') {
    Object.assign(e.style, { background: o.fill || 'transparent', border: o.stroke && o.strokeW ? `${o.strokeW}px solid ${o.stroke}` : 'none',
      opacity: o.opacity ?? 1, mixBlendMode: o.role === 'highlight' ? 'multiply' : 'normal' });
  } else if (o.type === 'image') {
    e.style.opacity = o.opacity ?? 1;
  } else if (o.type === 'draw') {
    const svg = e.querySelector('svg'); svg.setAttribute('viewBox', `0 0 ${o.w} ${o.h}`);
    const path = svg.querySelector('path'); path.setAttribute('d', drawPathD(o));
    path.setAttribute('stroke', o.color); path.setAttribute('stroke-width', o.width); e.style.opacity = o.opacity ?? 1;
  }
  $$(':scope > .h, :scope > .ftb', e).forEach(x => x.remove());
  if (S.sel === o.id) {
    const hs = o.type === 'text' ? ['w', 'e'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const h of hs) { const d = document.createElement('div'); d.className = 'h'; d.dataset.h = h; e.append(d); }
    const tb = document.createElement('div'); tb.className = 'ftb';
    if (o.y * S.zoom < 56) tb.classList.add('below');
    tb.innerHTML = (o.type === 'text' ? (S.editing === o.id ? `<button data-act="done">${ICON.done}Done</button>` : `<button data-act="edit">${ICON.edit}Edit</button>`) : '') +
      `<button data-act="dup" title="Duplicate" aria-label="Duplicate">${ICON.copy}</button><button class="del" data-act="del" title="Delete" aria-label="Delete">${ICON.trash}</button>`;
    window.pdfEditorUI.localize(tb); e.append(tb);
  }
}
function refreshObj(o) { const e = document.querySelector(`.obj[data-id="${o.id}"]`); if (e) styleObj(e, o); }

/* ---------------- selection & editing ---------------- */
function select(id) {
  const prev = S.sel;
  if (S.editing && S.editing !== id) finishEdit();
  S.sel = id;
  if (prev && prev !== id) { const [po] = findObj(prev); if (po) refreshObj(po); }
  if (id) { const [o] = findObj(id); if (o) refreshObj(o); }
  renderProps();
}
function deselect() { if (S.editing) finishEdit(); if (S.sel) select(null); }
function enterEdit(o, cx, cy) {
  if (o.type !== 'text') return;
  if (S.editing && S.editing !== o.id) finishEdit();
  const prevSel = S.sel; S.sel = o.id; S.editing = o.id;
  if (prevSel && prevSel !== o.id) { const [po] = findObj(prevSel); if (po) refreshObj(po); }
  const e = document.querySelector(`.obj[data-id="${o.id}"]`); if (!e) return;
  styleObj(e, o);
  const c = e.querySelector('.tcontent');
  c.textContent = o.text || '';
  try { c.contentEditable = 'plaintext-only'; } catch (er) { /* older browsers */ }
  if (c.contentEditable !== 'plaintext-only') c.contentEditable = 'true';
  c.spellcheck = false;
  c.focus({ preventScroll: true });
  let placed = false;
  if (cx != null && document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(cx, cy);
    if (r && c.contains(r.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); placed = true; }
  }
  if (!placed) { const r = document.createRange(); r.selectNodeContents(c); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  if (isPhone()) setTimeout(() => {
    const v = $('#viewer'), r = e.getBoundingClientRect(), sheet = $('#props').getBoundingClientRect();
    const limit = Math.min(v.getBoundingClientRect().bottom, sheet.height ? sheet.top : 1e9) - 16;
    if (r.bottom > limit) v.scrollBy({ top: r.bottom - limit + 40, behavior: 'smooth' });
    else if (r.top < v.getBoundingClientRect().top + 50) v.scrollBy({ top: r.top - v.getBoundingClientRect().top - 60, behavior: 'smooth' });
  }, 60);
  c.oninput = () => {
    let t = c.innerText; if (c.lastChild && c.lastChild.nodeName === 'BR') t = t.replace(/\n$/, '');
    o.text = t.replace(/\u00a0/g, ' ');
    fitTextHeight(o); e.style.height = o.h + 'px'; e.style.width = o.w + 'px';
    c.style.fontFamily = cssFamily(effKey(o));
  };
  c.onblur = () => setTimeout(() => {
    const a = document.activeElement;
    if (S.editing === o.id && a !== c && !(a && a.closest && a.closest('.props'))) finishEdit();
  }, 0);
  c.onkeydown = ev => { if (ev.key === 'Escape') { ev.preventDefault(); finishEdit(); } };
  renderProps();
}
function finishEdit() {
  const id = S.editing; if (!id) return;
  S.editing = null;
  const [o, pid] = findObj(id);
  const e = document.querySelector(`.obj[data-id="${id}"]`);
  if (e) { const c = e.querySelector('.tcontent'); c.contentEditable = 'false'; c.oninput = c.onblur = c.onkeydown = null; }
  if (o) {
    if (!o.text || !o.text.trim()) { S.objects[pid] = S.objects[pid].filter(x => x.id !== id); if (S.sel === id) S.sel = null; e?.remove(); }
    else if (e) styleObj(e, o);
  }
  try { if (document.activeElement && document.activeElement.classList.contains('tcontent')) document.activeElement.blur(); getSelection().removeAllRanges(); } catch (er) {}
  commit(); renderProps();
}
function addObj(pid, o, { sel = true } = {}) {
  o.id = o.id || 'o' + uid();
  (S.objects[pid] ||= []).push(o);
  const pe = pageEls.get(pid); if (pe) pe.layer.append(makeObjEl(o));
  if (sel) select(o.id);
  return o;
}
function deleteObj(id) {
  const [o, pid] = findObj(id); if (!o) return;
  if (S.editing === id) S.editing = null;
  S.objects[pid] = S.objects[pid].filter(x => x.id !== id);
  document.querySelector(`.obj[data-id="${id}"]`)?.remove();
  if (S.sel === id) S.sel = null;
  commit(); renderProps();
}
function duplicateObj(id) {
  finishEdit();
  const [o, pid] = findObj(id); if (!o) return;
  const p = pageById(pid);
  const c = JSON.parse(JSON.stringify(o)); c.id = 'o' + uid();
  c.x = clamp(o.x + 14, 0, Math.max(0, p.w - o.w)); c.y = clamp(o.y + 14, 0, Math.max(0, p.h - o.h));
  addObj(pid, c); commit();
}
function bringFront(id) {
  const [o, pid] = findObj(id); if (!o) return;
  S.objects[pid] = S.objects[pid].filter(x => x.id !== id).concat(o);
  renderPageObjects(pid); commit();
}

/* ---------------- pointer interaction ---------------- */
function toPt(ev, layer) { const r = layer.getBoundingClientRect(); return { x: (ev.clientX - r.left) / S.zoom, y: (ev.clientY - r.top) / S.zoom }; }
const CREATE_TOOLS = ['whiteout', 'highlight', 'rect', 'draw'];
function onLayerDown(ev) {
  if (ev.button && ev.button !== 0) return;
  const layer = ev.currentTarget; const pid = layer.dataset.id;
  if (ev.target.closest('.ftb')) return;
  const handle = ev.target.closest('.h');
  const objEl = ev.target.closest('.obj');
  if (handle && objEl) { ev.preventDefault(); ev.stopPropagation(); startResize(ev, layer, objEl.dataset.id, handle.dataset.h); return; }
  if (objEl && !CREATE_TOOLS.includes(S.tool)) {
    const id = objEl.dataset.id;
    if (S.editing === id) return; // caret placement inside the box being edited
    if (S.tool !== 'select') setTool('select', true);
    const was = S.sel === id;
    if (!was) select(id);
    startMove(ev, layer, id, was);
    return;
  }
  if (ev.target.closest('.titem') && S.tool === 'edittext') return;
  if (CREATE_TOOLS.includes(S.tool)) {
    ev.preventDefault();
    if (S.editing) finishEdit();
    if (S.tool === 'draw') startDraw(ev, layer, pid); else startBox(ev, layer, pid);
    return;
  }
  if (S.tool === 'select') deselect();
}
function onLayerClick(ev) {
  const layer = ev.currentTarget, pid = layer.dataset.id;
  if (ev.target.closest('.obj') || ev.target.closest('.ftb')) return;
  const ti = ev.target.closest('.titem');
  if (ti && S.tool === 'edittext') { replaceTextItem(pid, +ti.dataset.i); return; }
  const pt = toPt(ev, layer); const p = pageById(pid);
  if (S.tool === 'text') {
    if (S.editing) { finishEdit(); return; }
    const st = S.style;
    const o = { type: 'text', text: '', font: st.font, size: st.size, color: st.color, bold: st.bold, italic: st.italic, underline: st.underline, align: st.align, bg: st.bg,
      x: clamp(pt.x - 4, 0, p.w - 20), y: 0, w: 40, autoW: true, id: 'o' + uid() };
    (S.objects[pid] ||= []).push(o); fitTextHeight(o); S.objects[pid].pop();
    o.y = clamp(pt.y - o.h / 2, 0, p.h - o.h);
    addObj(pid, o, { sel: false }); setTool('select', true); enterEdit(o);
  } else if (S.tool === 'image') {
    pendingImage = { pid, x: pt.x, y: pt.y }; $('#fileImg').click();
  }
}
function trackPointer(ev, onMove, onUp) {
  const id = ev.pointerId;
  const mv = e => { if (e.pointerId === id) { e.preventDefault(); onMove(e); } };
  const up = e => { if (e.pointerId !== id) return; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); onUp(e); };
  window.addEventListener('pointermove', mv, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
function startMove(ev, layer, id, wasSelected) {
  const [o, pid] = findObj(id); const p = pageById(pid);
  const p0 = toPt(ev, layer), x0 = o.x, y0 = o.y; let moved = false;
  const e = layer.querySelector(`.obj[data-id="${id}"]`);
  trackPointer(ev, m => {
    const pt = toPt(m, layer); const dx = pt.x - p0.x, dy = pt.y - p0.y;
    if (!moved && Math.hypot(dx, dy) * S.zoom < 5) return;
    moved = true;
    o.x = clamp(x0 + dx, -o.w + 10, p.w - 10); o.y = clamp(y0 + dy, -o.h + 10, p.h - 10);
    e.style.left = o.x + 'px'; e.style.top = o.y + 'px';
  }, up => {
    if (moved) { commit(); refreshObj(o); }
    else if (wasSelected && o.type === 'text' && up.type === 'pointerup') enterEdit(o, up.clientX, up.clientY);
  });
}
function startResize(ev, layer, id, dir) {
  const [o] = findObj(id); const s = { x: o.x, y: o.y, w: o.w, h: o.h }; const p0 = toPt(ev, layer);
  const e = layer.querySelector(`.obj[data-id="${id}"]`);
  trackPointer(ev, m => {
    const pt = toPt(m, layer); const dx = pt.x - p0.x, dy = pt.y - p0.y;
    let { x, y, w, h } = s;
    if (dir.includes('e')) w = s.w + dx;
    if (dir.includes('w')) w = s.w - dx;
    if (dir.includes('s')) h = s.h + dy;
    if (dir.includes('n')) h = s.h - dy;
    const minW = o.type === 'text' ? Math.max(12, o.size) : 6;
    w = Math.max(minW, w); h = Math.max(4, h);
    if (o.type === 'image' && dir.length === 2) { const r = s.w / s.h; if (w / h > r) h = w / r; else w = h * r; }
    if (dir.includes('w')) x = s.x + s.w - w;
    if (dir.includes('n')) y = s.y + s.h - h;
    o.x = x; o.w = w;
    if (o.type === 'text') o.autoW = false; else { o.y = y; o.h = h; }
    styleObj(e, o);
  }, () => { commit(); refreshObj(o); });
}
function startBox(ev, layer, pid) {
  const p0 = toPt(ev, layer); const d = document.createElement('div'); d.className = 'draft'; layer.append(d);
  let box = { x: p0.x, y: p0.y, w: 0, h: 0 };
  const tool = S.tool;
  trackPointer(ev, m => {
    const pt = toPt(m, layer);
    box = { x: Math.min(pt.x, p0.x), y: Math.min(pt.y, p0.y), w: Math.abs(pt.x - p0.x), h: Math.abs(pt.y - p0.y) };
    Object.assign(d.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
  }, () => {
    d.remove();
    if (box.w * S.zoom < 6 && box.h * S.zoom < 6) { // a tap makes a default-sized box
      const dw = tool === 'highlight' ? 120 : 110, dh = tool === 'highlight' ? 18 : 40;
      box = { x: p0.x - dw / 2, y: p0.y - dh / 2, w: dw, h: dh };
    }
    box.w = Math.max(box.w, 4); box.h = Math.max(box.h, 4);
    const st = S.style;
    const o = { type: 'rect', role: tool, ...box,
      fill: tool === 'whiteout' ? st.fill : tool === 'highlight' ? st.hl : st.rectFill,
      stroke: tool === 'rect' ? st.stroke : null, strokeW: tool === 'rect' ? st.strokeW : 0,
      opacity: tool === 'highlight' ? 0.45 : (tool === 'rect' ? st.opacity : 1) };
    addObj(pid, o, { sel: false }); commit();
  });
}
function startDraw(ev, layer, pid) {
  const pts = [toPt(ev, layer)];
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  const p = pageById(pid);
  Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, width: p.w + 'px', height: p.h + 'px', pointerEvents: 'none', overflow: 'visible' });
  svg.setAttribute('viewBox', `0 0 ${p.w} ${p.h}`);
  const path = document.createElementNS(svgNS, 'path');
  Object.entries({ fill: 'none', stroke: S.style.pen, 'stroke-width': S.style.penW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }).forEach(([k, v]) => path.setAttribute(k, v));
  svg.append(path); layer.append(svg);
  const upd = () => path.setAttribute('d', 'M ' + pts.map(q => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L ') + (pts.length === 1 ? ' l 0.01 0' : ''));
  upd();
  trackPointer(ev, m => {
    let evs = m.getCoalescedEvents ? m.getCoalescedEvents() : [];
    if (!evs.length) evs = [m];
    for (const ce of evs) { const q = toPt(ce, layer); const l = pts[pts.length - 1]; if (Math.hypot(q.x - l.x, q.y - l.y) > 0.8 / S.zoom) pts.push(q); }
    upd();
  }, () => {
    svg.remove();
    const pw = S.style.penW / 2;
    const minX = Math.min(...pts.map(q => q.x)) - pw, maxX = Math.max(...pts.map(q => q.x)) + pw;
    const minY = Math.min(...pts.map(q => q.y)) - pw, maxY = Math.max(...pts.map(q => q.y)) + pw;
    const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);
    const o = { type: 'draw', x: minX, y: minY, w, h, color: S.style.pen, width: S.style.penW, opacity: 1,
      pts: pts.map(q => [+((q.x - minX) / w).toFixed(4), +((q.y - minY) / h).toFixed(4)]) };
    addObj(pid, o, { sel: false }); commit();
  });
}

/* ---------------- edit existing text ---------------- */
async function getText(src) {
  if (!textCache.has(src)) { const pg = await S.pdf.getPage(src + 1); textCache.set(src, await pg.getTextContent()); }
  return textCache.get(src);
}
async function buildTextItems(pid) {
  const pe = pageEls.get(pid), p = pageById(pid);
  if (!pe || !p || p.src < 0) return;
  pe.tbuilt = true;
  const tc = await getText(p.src);
  pe.tlayer.innerHTML = '';
  const T = vpTransform(p.view, p.rot);
  pe.items = [];
  tc.items.forEach((it, i) => {
    if (!it.str || !it.str.trim()) return;
    const tx = pdfjsLib.Util.transform(T, it.transform);
    if (Math.abs(tx[1]) > 0.01 || Math.abs(tx[2]) > 0.01 || tx[0] <= 0) return; // horizontal text only
    const fh = Math.hypot(tx[2], tx[3]) || Math.abs(tx[3]); if (fh < 2) return;
    const st = tc.styles[it.fontName] || {};
    const asc = clamp(st.ascent || 0.8, 0.7, 1.1), desc = clamp(-(st.descent ?? -0.2), 0.18, 0.4);
    const item = { i, str: it.str, x: tx[4], base: tx[5], top: tx[5] - fh * asc, h: fh * (asc + desc), w: it.width, size: fh, fontName: it.fontName, family: st.fontFamily || '' };
    pe.items[i] = item;
    const d = document.createElement('div'); d.className = 'titem'; d.dataset.i = i; d.title = 'Tap to edit this text';
    Object.assign(d.style, { left: item.x + 'px', top: item.top + 'px', width: Math.max(item.w, 4) + 'px', height: item.h + 'px' });
    pe.tlayer.append(d);
  });
}
function sampleColors(pid, box) {
  const pe = pageEls.get(pid), p = pageById(pid); const c = pe?.canvas;
  const fallback = { bg: '#ffffff', fg: '#111111' };
  if (!c) return fallback;
  try {
    const k = c.width / p.w;
    const x0 = Math.max(0, Math.floor((box.x - 2) * k)), y0 = Math.max(0, Math.floor((box.y - 2) * k));
    const x1 = Math.min(c.width, Math.ceil((box.x + box.w + 2) * k)), y1 = Math.min(c.height, Math.ceil((box.y + box.h + 2) * k));
    const w = x1 - x0, h = y1 - y0; if (w < 5 || h < 5) return fallback;
    const data = c.getContext('2d').getImageData(x0, y0, w, h).data;
    const ring = [], inner = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4; const px = [data[j], data[j + 1], data[j + 2]];
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) ring.push(px); else inner.push(px);
    }
    const med = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const bg = [0, 1, 2].map(ch => med(ring.map(q => q[ch])));
    let maxD = 0; const ds = inner.map(q => { const d = Math.hypot(q[0] - bg[0], q[1] - bg[1], q[2] - bg[2]); if (d > maxD) maxD = d; return d; });
    let fg = [17, 17, 17];
    if (maxD > 60) { const sel = inner.filter((q, i) => ds[i] > maxD * 0.8); fg = [0, 1, 2].map(ch => sel.reduce((a, q) => a + q[ch], 0) / sel.length); }
    return { bg: toHex(...bg), fg: toHex(...fg) };
  } catch (e) { return fallback; }
}
function guessFont(name) {
  const n = (name || '').toLowerCase();
  let font = 'Helvetica';
  if (/times|serif|georgia|garamond|cambria|minion|roman|book/.test(n) && !/sans/.test(n)) font = 'Times';
  if (/courier|mono|consol/.test(n)) font = 'Courier';
  if (/poppins/.test(n)) font = 'Poppins';
  if (/lato/.test(n)) font = 'Lato';
  return { font, bold: /bold|black|heavy|semibold|demi/.test(n), italic: /italic|oblique/.test(n) };
}
async function replaceTextItem(pid, i) {
  const pe = pageEls.get(pid); const it = pe?.items?.[i]; if (!it) return;
  let name = it.family;
  try { // stays synchronous where possible so the phone keyboard opens on the same tap
    const pg = pe.pdfPage;
    if (pg && pg.commonObjs.has(it.fontName)) { const f = pg.commonObjs.get(it.fontName); name += ' ' + (f.name || '') + (f.bold ? ' bold' : '') + (f.italic ? ' italic' : '') + (f.isSerifFont ? ' serif' : '') + (f.isMonospace ? ' mono' : ''); }
  } catch (e) {}
  const cover = { x: it.x - 1.5, y: it.top - 1, w: it.w + 3, h: it.h + 2 };
  const col = sampleColors(pid, cover);
  const g = guessFont(name);
  const o = { type: 'text', text: it.str, font: g.font, size: Math.round(it.size * 10) / 10, color: col.fg, bold: g.bold, italic: g.italic, underline: false, align: 'left', bg: null, x: 0, y: 0, w: 10, autoW: true };
  const key = effKey(o), v = variantOf(o, key);
  if (faces[key + '|' + v] && faces[key + '|' + v].status !== 'loaded') await ensureFace(key, v);
  o.x = it.x - PAD;
  o.y = it.base - PAD - baselineOffset(o, key, v);
  addObj(pid, { type: 'rect', role: 'whiteout', ...cover, fill: col.bg, stroke: null, strokeW: 0, opacity: 1 }, { sel: false });
  addObj(pid, o, { sel: false });
  pe.tlayer.querySelector(`.titem[data-i="${i}"]`)?.remove();
  commit();
  setTool('select', true);
  enterEdit(o);
  toast('Old text covered. Type the new text.');
}

/* ---------------- images ---------------- */
let pendingImage = null;
async function addImageFile(file, at) {
  if (!file || !file.type.startsWith('image/')) { toast('Please choose an image (PNG or JPG)'); return; }
  busy(true, 'Adding image…');
  try {
    let bytes = new Uint8Array(await file.arrayBuffer()); let mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    const url0 = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Your browser cannot read this image format. Try a PNG or JPG.')); i.src = url0; });
    let w = img.naturalWidth, h = img.naturalHeight;
    const tooBig = w * h > 9e6;
    if (!/^image\/(png|jpeg)$/.test(mime) || tooBig) { // convert webp/heic/gif or huge photos
      const k = tooBig ? Math.sqrt(9e6 / (w * h)) : 1;
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      mime = /png|webp|gif/.test(mime) ? 'image/png' : 'image/jpeg';
      const blob = await new Promise(r => c.toBlob(r, mime, 0.9));
      bytes = new Uint8Array(await blob.arrayBuffer()); w = c.width; h = c.height;
    }
    URL.revokeObjectURL(url0);
    const id = 'i' + uid();
    S.images[id] = { bytes, mime, url: URL.createObjectURL(new Blob([bytes], { type: mime })), w, h };
    const pid = at?.pid || S.pages[S.curPage || 0].id;
    const p = pageById(pid);
    const k = Math.min(1, (p.w * 0.5) / w, (p.h * 0.4) / h);
    const ow = w * k, oh = h * k;
    const x = clamp(at ? at.x - ow / 2 : (p.w - ow) / 2, 0, p.w - ow), y = clamp(at ? at.y - oh / 2 : (p.h - oh) / 3, 0, p.h - oh);
    setTool('select', true);
    addObj(pid, { type: 'image', img: id, x, y, w: ow, h: oh, opacity: 1 }); commit();
    toast('Image added. Drag to move, pull a corner to resize.');
  } catch (e) { toast(e.message || 'Could not add that image', 3500); }
  finally { busy(false); }
}

/* ---------------- tools & properties panel ---------------- */
function setTool(t, quiet) {
  if (t !== S.tool && S.editing) finishEdit();
  S.tool = t;
  $$('.tool[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  document.body.classList.forEach(c => { if (c.startsWith('tool-')) document.body.classList.remove(c); });
  document.body.classList.add('tool-' + t);
  if (t !== 'select' && S.sel) select(null);
  if (t === 'edittext') for (const [id, pe] of pageEls) if (!pe.tbuilt) buildTextItems(id);
  if (!quiet) {
    const tips = { text: 'Tap on the page where you want to type', edittext: 'Tap any line of text in the PDF to change it', draw: 'Draw with your finger or mouse. Tap Select when done.',
      whiteout: 'Drag over what you want to hide', highlight: 'Drag across the text to highlight', rect: 'Drag to draw a box', image: 'Choose an image to add' };
    if (tips[t]) toast(tips[t]);
    if (t === 'image') { pendingImage = null; $('#fileImg').click(); }
  }
  renderProps();
}
const SW_TEXT = ['#111827', '#ffffff', '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#db2777'];
const SW_FILL = ['#ffffff', '#111827', '#fde047', '#bbf7d0', '#bfdbfe', '#fecaca', '#e5e7eb'];
function swatches(list, cur, attr, allowNone) {
  const c0 = (cur || '').toLowerCase();
  return `<div class="row">${allowNone ? `<button class="sw none ${!cur ? 'on' : ''}" data-${attr}="" title="None" aria-label="No color"></button>` : ''}${list.map(c => `<button class="sw ${c0 === c ? 'on' : ''}" style="background:${c}" data-${attr}="${c}" aria-label="Color ${c}"></button>`).join('')}<input type="color" data-${attr}-pick value="${cur || '#ffffff'}" aria-label="Custom color" title="Any color"></div>`;
}
function curObj() { return S.sel ? findObj(S.sel)[0] : null; }
function kindOf(o) { return o ? (o.type === 'rect' ? (o.role || 'rect') : o.type) : S.tool; }
function renderProps() {
  const el = $('#props'); if (!el) return;
  const o = curObj(); const t = kindOf(o); const st = S.style;
  let h = '';
  if (t === 'text' || (t === 'edittext' && !o)) {
    const src = o || st; const key = FONTS[src.font] ? src.font : 'Helvetica'; const styles = hasStyles(key);
    h += `<h3>${o ? 'Text' : (t === 'edittext' ? 'Edit existing text' : 'New text')}</h3>`;
    if (t === 'edittext') h += `<p class="tip">Tap a line in the PDF. It gets covered in the page's color and turns into a text box you can retype and restyle.</p>`;
    h += `<div class="field"><label for="pFont">Font &amp; size</label><div class="row nowrap"><select id="pFont">${Object.entries(FONTS).map(([k, F]) => `<option value="${k}" ${k === key ? 'selected' : ''}>${F.label}</option>`).join('')}</select>
        <span class="stepper"><button type="button" data-size="-1" aria-label="Smaller">−</button><input type="number" id="pSize" min="4" max="300" step="1" value="${Math.round(src.size * 10) / 10}" aria-label="Font size"><button type="button" data-size="1" aria-label="Bigger">+</button></span></div></div>
      <div class="field"><span class="flabel">Style</span><div class="row">
        <span class="seg"><button type="button" data-tog="bold" class="${src.bold ? 'on' : ''}" ${styles ? '' : 'disabled'} aria-label="Bold" aria-pressed="${!!src.bold}"><b>B</b></button><button type="button" data-tog="italic" class="${src.italic ? 'on' : ''}" ${styles ? '' : 'disabled'} aria-label="Italic" aria-pressed="${!!src.italic}"><i>I</i></button><button type="button" data-tog="underline" class="${src.underline ? 'on' : ''}" aria-label="Underline" aria-pressed="${!!src.underline}"><u>U</u></button></span>
        <span class="seg"><button type="button" data-align="left" class="${src.align === 'left' ? 'on' : ''}" aria-label="Align left">${ICON.alignL}</button><button type="button" data-align="center" class="${src.align === 'center' ? 'on' : ''}" aria-label="Align center">${ICON.alignC}</button><button type="button" data-align="right" class="${src.align === 'right' ? 'on' : ''}" aria-label="Align right">${ICON.alignR}</button></span>
      </div></div>
      <div class="field"><span class="flabel">Color</span>${swatches(SW_TEXT, src.color, 'tcolor')}</div>
      <div class="field"><span class="flabel">Background</span>${swatches(SW_FILL, src.bg, 'tbg', true)}</div>`;
  } else if (t === 'rect' || t === 'whiteout' || t === 'highlight') {
    const fill = o ? o.fill : (t === 'whiteout' ? st.fill : t === 'highlight' ? st.hl : st.rectFill);
    h += `<h3>${t === 'whiteout' ? 'Whiteout' : t === 'highlight' ? 'Highlight' : 'Box'}</h3>`;
    if (!o) h += `<p class="tip">${t === 'whiteout' ? 'Drag over anything to hide it. Pick a fill that matches the page, then use <b>Text</b> to write on top.' : t === 'highlight' ? 'Drag across text to highlight it.' : 'Drag to draw a box or frame.'}</p>`;
    h += `<div class="field"><span class="flabel">Fill</span>${swatches(t === 'highlight' ? ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74'] : SW_FILL, fill, 'fill', t === 'rect')}</div>`;
    if (t === 'rect') {
      const stroke = o ? o.stroke : st.stroke, sw = o ? o.strokeW : st.strokeW, op = o ? o.opacity : st.opacity;
      h += `<div class="field"><span class="flabel">Border</span>${swatches(SW_TEXT, stroke, 'stroke', true)}</div>
        <div class="field"><label for="pStrokeW">Border width: <span id="pStrokeWv">${sw}</span> pt</label><input type="range" id="pStrokeW" min="0" max="12" step="0.5" value="${sw}"></div>
        <div class="field"><label for="pOpacity">Opacity: <span id="pOpacityv">${Math.round(op * 100)}</span>%</label><input type="range" id="pOpacity" min="0.1" max="1" step="0.05" value="${op}"></div>`;
    }
  } else if (t === 'draw') {
    const color = o ? o.color : st.pen, w = o ? o.width : st.penW;
    h += `<h3>${o ? 'Drawing' : 'Draw / sign'}</h3>${o ? '' : '<p class="tip">Draw freely, for example a signature. Each stroke becomes a piece you can move or delete.</p>'}
      <div class="field"><span class="flabel">Pen color</span>${swatches(SW_TEXT, color, 'pen')}</div>
      <div class="field"><label for="pPenW">Thickness: <span id="pPenWv">${w}</span> pt</label><input type="range" id="pPenW" min="0.5" max="16" step="0.5" value="${w}"></div>`;
  } else if (t === 'image') {
    h += `<h3>Image</h3>`;
    if (o) h += `<div class="field"><label for="pOpacity">Opacity: <span id="pOpacityv">${Math.round((o.opacity ?? 1) * 100)}</span>%</label><input type="range" id="pOpacity" min="0.1" max="1" step="0.05" value="${o.opacity ?? 1}"></div><p class="tip">Corner handles keep the shape; side handles stretch it.</p>`;
    else h += `<p class="tip">Add a PNG or JPG: a logo, a photo, a scanned signature. Tip: with this tool active, tap a spot on the page to place it there.</p><button class="btn small" id="pPickImg" type="button">Choose image</button>`;
  } else {
    h += `<h3>How it works</h3><p class="tip"><b>Text</b>: tap the page and type.<br><b>Edit text</b>: tap words already in the PDF to change them.<br><b>Image</b>: add a photo, logo or signature.<br><b>Whiteout</b>: hide anything.<br>Tap any edit to move, resize, restyle or delete it.<br><br>When you are done, <b>Download</b> saves a new PDF with your edits built in.</p>`;
  }
  if (o) h += `<div class="objactions">${o.type === 'text' ? `<button type="button" data-act="${S.editing === o.id ? 'done' : 'edit'}">${S.editing === o.id ? 'Done' : 'Edit text'}</button>` : ''}<button type="button" data-act="dup">Duplicate</button><button type="button" data-act="front">To front</button><button type="button" class="danger" data-act="del">Delete</button></div>`;
  el.innerHTML = h; window.pdfEditorUI.localize(el);
  document.body.classList.toggle('props-open', !!o || ['text', 'whiteout', 'highlight', 'rect', 'draw'].includes(S.tool));
}
function applyStyle(change) {
  const o = curObj();
  Object.assign(S.style, change.style || {});
  if (o) {
    Object.assign(o, change.obj || {});
    if (o.type === 'text') fitTextHeight(o);
    refreshObj(o);
    if (S.editing === o.id) { const c = document.querySelector(`.obj[data-id="${o.id}"] .tcontent`); if (c) c.focus({ preventScroll: true }); }
    else commit();
  }
  renderProps();
}
function fillChange(t, v) {
  const key = t === 'whiteout' ? 'fill' : t === 'highlight' ? 'hl' : 'rectFill';
  applyStyle({ style: { [key]: v || null }, obj: { fill: v || null } });
}
function onPropsInput(ev) {
  const tg = ev.target; const o = curObj(); const t = kindOf(o); const fin = ev.type === 'change';
  if (tg.id === 'pFont') applyStyle({ style: { font: tg.value }, obj: { font: tg.value } });
  else if (tg.id === 'pSize') { if (fin) { const size = clamp(parseFloat(tg.value) || 12, 4, 300); applyStyle({ style: { size }, obj: { size } }); } }
  else if (tg.id === 'pStrokeW') { const v = +tg.value; $('#pStrokeWv').textContent = v; S.style.strokeW = v; if (o) { o.strokeW = v; refreshObj(o); if (fin) commit(); } }
  else if (tg.id === 'pOpacity') { const v = +tg.value; $('#pOpacityv').textContent = Math.round(v * 100); if (!o || o.type === 'rect') S.style.opacity = v; if (o) { o.opacity = v; refreshObj(o); if (fin) commit(); } }
  else if (tg.id === 'pPenW') { const v = +tg.value; $('#pPenWv').textContent = v; S.style.penW = v; if (o) { o.width = v; refreshObj(o); if (fin) commit(); } }
  else if (fin && tg.matches('[data-tcolor-pick]')) applyStyle({ style: { color: tg.value }, obj: { color: tg.value } });
  else if (fin && tg.matches('[data-tbg-pick]')) applyStyle({ style: { bg: tg.value }, obj: { bg: tg.value } });
  else if (fin && tg.matches('[data-fill-pick]')) fillChange(t, tg.value);
  else if (fin && tg.matches('[data-stroke-pick]')) applyStyle({ style: { stroke: tg.value }, obj: { stroke: tg.value, strokeW: (o?.strokeW || S.style.strokeW || 2) } });
  else if (fin && tg.matches('[data-pen-pick]')) applyStyle({ style: { pen: tg.value }, obj: { color: tg.value } });
}
function onPropsClick(ev) {
  const b = ev.target.closest('button'); if (!b) return;
  const o = curObj(); const t = kindOf(o);
  if (b.id === 'pPickImg') { $('#fileImg').click(); return; }
  if (b.dataset.size) { const cur = o ? o.size : S.style.size; const size = clamp(Math.round(cur) + (+b.dataset.size), 4, 300); applyStyle({ style: { size }, obj: { size } }); return; }
  if (b.dataset.tog) { const k = b.dataset.tog; const v = !(o ? o[k] : S.style[k]); applyStyle({ style: { [k]: v }, obj: { [k]: v } }); return; }
  if (b.dataset.align) { applyStyle({ style: { align: b.dataset.align }, obj: { align: b.dataset.align } }); return; }
  if ('tcolor' in b.dataset) { applyStyle({ style: { color: b.dataset.tcolor }, obj: { color: b.dataset.tcolor } }); return; }
  if ('tbg' in b.dataset) { const v = b.dataset.tbg || null; applyStyle({ style: { bg: v }, obj: { bg: v } }); return; }
  if ('fill' in b.dataset) { fillChange(t, b.dataset.fill); return; }
  if ('stroke' in b.dataset) { const v = b.dataset.stroke || null; applyStyle({ style: { stroke: v }, obj: { stroke: v, strokeW: v ? (o?.strokeW || S.style.strokeW || 2) : 0 } }); return; }
  if ('pen' in b.dataset) { applyStyle({ style: { pen: b.dataset.pen }, obj: { color: b.dataset.pen } }); return; }
  if (b.dataset.act && o) objAction(b.dataset.act, o);
}
function objAction(act, o) {
  if (act === 'del') deleteObj(o.id);
  else if (act === 'dup') duplicateObj(o.id);
  else if (act === 'front') bringFront(o.id);
  else if (act === 'edit') enterEdit(o);
  else if (act === 'done') { finishEdit(); select(o.id); }
}

/* ---------------- export: bake edits into a real PDF ---------------- */
let fontkitPromise;
function loadFontkit() {
  fontkitPromise ||= loadScript('@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js', 'fontkit').catch(e => { fontkitPromise = null; throw e; });
  return fontkitPromise;
}
const fontBytesCache = {};
function fontBytes(file) {
  return fontBytesCache[file] ||= fetch(/^https?:/.test(file) ? file : 'fonts/' + file).then(r => { if (!r.ok) throw new Error('Font download failed'); return r.arrayBuffer(); }).catch(e => { delete fontBytesCache[file]; throw e; });
}
async function renderPageJpeg(p, scale) {
  const pg = await S.pdf.getPage(p.src + 1);
  const vp = pg.getViewport({ scale, rotation: 0 });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: ctx, viewport: vp }).promise;
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  return new Uint8Array(await blob.arrayBuffer());
}
async function buildPdf() {
  finishEdit();
  await libReady;
  const { PDFDocument, degrees, BlendMode, LineCapStyle } = PDFLib;
  let src = null, flatten = false;
  try { src = await PDFDocument.load(S.base, { ignoreEncryption: true, updateMetadata: false }); if (src.isEncrypted) flatten = true; }
  catch (e) { console.warn('PDF structure not editable, flattening pages', e); flatten = true; }
  let out; const views = [];
  if (!flatten) {
    const n = src.getPageCount();
    const identity = S.pages.length === n && S.pages.every((p, i) => p.src === i);
    if (identity) { out = src; S.pages.forEach(p => views.push(p.view)); }
    else {
      out = await PDFDocument.create();
      const idx = S.pages.filter(p => p.src >= 0).map(p => p.src);
      const copied = idx.length ? await out.copyPages(src, idx) : [];
      let k = 0;
      for (const p of S.pages) { if (p.src >= 0) out.addPage(copied[k++]); else out.addPage([p.view[2] - p.view[0], p.view[3] - p.view[1]]); views.push(p.view); }
    }
  } else { // encrypted or damaged files: keep each original page as a high-resolution picture
    out = await PDFDocument.create();
    for (const p of S.pages) {
      const w = p.view[2] - p.view[0], h = p.view[3] - p.view[1];
      const pg = out.addPage([w, h]);
      if (p.src >= 0) { const jpg = await out.embedJpg(await renderPageJpeg(p, 2.5)); pg.drawImage(jpg, { x: 0, y: 0, width: w, height: h }); }
      views.push([0, 0, w, h]);
    }
  }
  const fontCache = {}, imgCache = {};
  const getFont = async (key, v) => {
    const ck = key + '|' + v; if (fontCache[ck]) return fontCache[ck];
    const F = FONTS[key];
    if (F.std) fontCache[ck] = await out.embedFont(F.std[v] || F.std.r);
    else { out.registerFontkit(await loadFontkit()); fontCache[ck] = await out.embedFont(await fontBytes(F.files[v] || F.files.r), { subset: true }); }
    return fontCache[ck];
  };
  const getImg = async id => {
    if (imgCache[id]) return imgCache[id];
    const im = S.images[id]; if (!im) return null;
    imgCache[id] = im.mime === 'image/png' ? await out.embedPng(im.bytes) : await out.embedJpg(im.bytes);
    return imgCache[id];
  };
  const pages = out.getPages();
  for (let i = 0; i < S.pages.length; i++) {
    const p = S.pages[i], pg = pages[i];
    pg.setRotation(degrees(p.rot));
    const T = vpTransform(views[i], p.rot); const R = degrees(p.rot);
    const at = (x, y) => { const [px, py] = toPdf(T, x, y); return { x: px, y: py }; };
    for (const o of S.objects[p.id] || []) {
      if (o.type === 'rect') {
        if (!o.fill && !(o.stroke && o.strokeW)) continue;
        const op = o.opacity ?? 1;
        if (o.fill) pg.drawRectangle({ ...at(o.x, o.y + o.h), width: o.w, height: o.h, rotate: R, color: hexToRgb(o.fill), opacity: op, blendMode: o.role === 'highlight' ? BlendMode.Multiply : undefined });
        if (o.stroke && o.strokeW) { // CSS draws borders inside the box; PDF strokes on the edge, so inset by half the width
          const hw = o.strokeW / 2;
          pg.drawRectangle({ ...at(o.x + hw, o.y + o.h - hw), width: Math.max(0, o.w - o.strokeW), height: Math.max(0, o.h - o.strokeW), rotate: R, borderColor: hexToRgb(o.stroke), borderWidth: o.strokeW, borderOpacity: op });
        }
      } else if (o.type === 'image') {
        const im = await getImg(o.img); if (!im) continue;
        pg.drawImage(im, { ...at(o.x, o.y + o.h), width: o.w, height: o.h, rotate: R, opacity: o.opacity ?? 1 });
      } else if (o.type === 'draw') {
        pg.drawSvgPath(drawPathD(o), { ...at(o.x, o.y), rotate: R, borderColor: hexToRgb(o.color), borderWidth: o.width, borderLineCap: LineCapStyle.Round, borderOpacity: o.opacity ?? 1 });
      } else if (o.type === 'text') {
        if (!o.text || !o.text.trim()) continue;
        const key = effKey(o), v = variantOf(o, key);
        await ensureFace(key, v);
        fitTextHeight(o);
        if (o.bg) pg.drawRectangle({ ...at(o.x, o.y + o.h), width: o.w, height: o.h, rotate: R, color: hexToRgb(o.bg) });
        const font = await getFont(key, v);
        const lines = wrapText(o); const L = o.size * LH; const inner = o.w - 2 * PAD;
        const bo = baselineOffset(o, key, v); const color = hexToRgb(o.color);
        lines.forEach((ln, li) => {
          if (!ln) return;
          const lw = font.widthOfTextAtSize(ln, o.size);
          const dx = o.align === 'center' ? (inner - lw) / 2 : o.align === 'right' ? inner - lw : 0;
          const x = o.x + PAD + dx, y = o.y + PAD + li * L + bo;
          pg.drawText(ln, { ...at(x, y), size: o.size, font, color, rotate: R });
          if (o.underline) { const uy = y + o.size * 0.12; pg.drawLine({ start: at(x, uy), end: at(x + lw, uy), thickness: Math.max(0.5, o.size * 0.06), color }); }
        });
      }
    }
  }
  out.setProducer('PDF Studio (in-browser)');
  return await out.save();
}
const outName = () => S.fileName.replace(/\.pdf$/i, '') + '-edited.pdf';
async function exportBlob(label) {
  busy(true, label || 'Building your PDF…');
  try { const bytes = await buildPdf(); return { bytes, blob: new Blob([bytes], { type: 'application/pdf' }) }; }
  catch (e) { console.error(e); toast('Could not build the PDF: ' + (e.message || e), 5000); return null; }
  finally { busy(false); }
}
async function download() {
  const r = await exportBlob(); if (!r) return;
  const url = URL.createObjectURL(r.blob);
  const a = document.createElement('a'); a.href = url; a.download = outName(); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  S.dirty = false;
  toast('Downloaded ' + outName());
}
async function share() {
  const r = await exportBlob(); if (!r) return;
  const file = new File([r.blob], outName(), { type: 'application/pdf' });
  try { await navigator.share({ files: [file], title: outName() }); S.dirty = false; }
  catch (e) { if (e.name !== 'AbortError') toast('Sharing is not available here. Use Download instead.'); }
}
function canIframePrint() {
  const ua = navigator.userAgent;
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(ua) && !(navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) && /Chrome|Chromium|Edg|Firefox/.test(ua);
}
async function printPdf() {
  const r = await exportBlob('Preparing to print…'); if (!r) return;
  if (canIframePrint()) {
    const url = URL.createObjectURL(r.blob);
    const f = document.createElement('iframe');
    Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0', opacity: '0' });
    f.src = url; document.body.append(f);
    f.onload = () => setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { printViaImages(r.bytes); } }, 500);
    setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 180000);
  } else printViaImages(r.bytes);
}
async function printViaImages(bytes) { // phones and Safari: print crisp page pictures of the edited PDF
  busy(true, 'Preparing pages for printing…');
  try {
    await workerReady;
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(), ...DOC_OPTS() }).promise;
    const area = $('#printArea'); area.innerHTML = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i); const vp0 = pg.getViewport({ scale: 1 });
      const scale = Math.min(2.4, Math.sqrt(9e6 / (vp0.width * vp0.height)));
      const vp = pg.getViewport({ scale });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      const img = new Image(); img.src = c.toDataURL('image/jpeg', 0.92); img.alt = 'Page ' + i;
      area.append(img);
    }
    await Promise.all($$('img', area).map(im => (im.decode ? im.decode().catch(() => {}) : null)));
    doc.destroy();
    busy(false);
    const clean = () => { area.innerHTML = ''; window.removeEventListener('afterprint', clean); };
    window.addEventListener('afterprint', clean);
    setTimeout(() => window.print(), 60);
  } catch (e) { busy(false); toast('Printing failed: ' + (e.message || e), 4500); }
}

/* ---------------- sample document ---------------- */
async function makeSample() {
  await libReady;
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const d = await PDFDocument.create();
  const HB = await d.embedFont(StandardFonts.HelveticaBold), R = await d.embedFont(StandardFonts.Helvetica), T = await d.embedFont(StandardFonts.TimesRoman);
  const ink = rgb(0.1, 0.1, 0.15), grey = rgb(0.35, 0.37, 0.42), line = rgb(0.85, 0.87, 0.9);
  const p1 = d.addPage([595.28, 841.89]);
  p1.drawRectangle({ x: 0, y: 772, width: 595.28, height: 70, color: rgb(0.31, 0.27, 0.9) });
  p1.drawText('Sunrise Traders Pvt. Ltd.', { x: 48, y: 800, size: 22, font: HB, color: rgb(1, 1, 1) });
  p1.drawText('12 Anna Salai, Chennai 600002', { x: 48, y: 783, size: 10, font: R, color: rgb(0.88, 0.9, 1) });
  p1.drawText('INVOICE', { x: 48, y: 716, size: 26, font: HB, color: ink });
  p1.drawText('Invoice no: INV-2041', { x: 48, y: 690, size: 12, font: R, color: grey });
  p1.drawText('Date: 28 October 2026', { x: 48, y: 672, size: 12, font: R, color: grey });
  p1.drawText('Billed to: Rahul Sharma, Chennai', { x: 48, y: 654, size: 12, font: R, color: grey });
  const rows = [['Item', 'Qty', 'Price', 'Amount'], ['Cotton shirts', '10', 'Rs 450', 'Rs 4,500'], ['Denim jeans', '6', 'Rs 1,200', 'Rs 7,200'], ['Silk scarves', '12', 'Rs 300', 'Rs 3,600'], ['Delivery', '1', 'Rs 250', 'Rs 250']];
  const cols = [48, 300, 380, 470]; let y = 610;
  rows.forEach((r, i) => {
    if (i === 0) p1.drawRectangle({ x: 40, y: y - 8, width: 515, height: 26, color: rgb(0.94, 0.95, 0.99) });
    r.forEach((c, j) => p1.drawText(c, { x: cols[j], y, size: 12, font: i === 0 ? HB : R, color: ink }));
    p1.drawLine({ start: { x: 40, y: y - 10 }, end: { x: 555, y: y - 10 }, thickness: 0.8, color: line });
    y -= 30;
  });
  p1.drawText('Total due: Rs 15,550', { x: 380, y: y - 14, size: 15, font: HB, color: rgb(0.31, 0.27, 0.9) });
  p1.drawText('Payment within 15 days by bank transfer. Thank you for your business!', { x: 48, y: 330, size: 11, font: T, color: grey });
  p1.drawText('Authorised signatory: ____________________', { x: 48, y: 200, size: 12, font: R, color: ink });
  const p2 = d.addPage([595.28, 841.89]);
  p2.drawText('Terms and conditions', { x: 48, y: 780, size: 20, font: HB, color: ink });
  const para = ['1. Goods once sold will not be taken back after 7 days.', '2. Please check all items at the time of delivery.', '3. Interest at 2% per month applies to late payments.', '4. All disputes are subject to Chennai jurisdiction.'];
  para.forEach((t, i) => p2.drawText(t, { x: 48, y: 740 - i * 24, size: 12, font: T, color: grey }));
  p2.drawText('Try it: tap "Edit text", then tap any line above to change it.', { x: 48, y: 560, size: 12, font: HB, color: rgb(0.31, 0.27, 0.9) });
  return await d.save();
}

/* PDF document operations: reuse the existing PDF library and editor state. */
let documentOperation = false;
async function mergePdfFiles(files) {
  if (documentOperation || !files.length) return;
  if (files.length < 2) { toast('Choose at least two PDF files.'); return; }
  if (S.base && S.dirty && !confirm(window.pdfEditorUI.translate('Open a new PDF? Your unsaved edits to the current one will be lost.'))) return;
  documentOperation = true; busy(true, 'Merging PDFs…');
  try {
    await libReady;
    const out = await PDFLib.PDFDocument.create();
    for (const file of files) {
      const src = await PDFLib.PDFDocument.load(await file.arrayBuffer());
      for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
    }
    if (!out.getPageCount()) throw Error('Empty PDF');
    await openBytes(await out.save(), 'merged.pdf');
    toast('PDF files merged.');
  } catch (e) { console.error(e); toast('Could not merge PDFs.', 5000); }
  finally { documentOperation = false; busy(false); }
}
// Uncompressed ZIP: a single download avoids browser limits on multiple automatic downloads.
function pageZip(files) {
  if (files.length > 65535) throw Error('Too many pages for ZIP');
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0, centralSize = 0;
  function crc32(bytes) {
    let c = -1;
    for (const x of bytes) { c ^= x; for (let i=0;i<8;i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
    return (c ^ -1) >>> 0;
  }
  for (const {name, bytes} of files) {
    const n = enc.encode(name), size = bytes.length, crc = crc32(bytes);
    if (n.length > 65535 || offset + size + 30 + n.length > 0xffffffff) throw Error('ZIP size limit');
    const l = new Uint8Array(30+n.length), ld = new DataView(l.buffer);
    ld.setUint32(0,0x04034b50,true); ld.setUint16(4,20,true); ld.setUint16(6,0x800,true); ld.setUint16(12,33,true);
    ld.setUint32(14,crc,true); ld.setUint32(18,size,true); ld.setUint32(22,size,true); ld.setUint16(26,n.length,true); l.set(n,30);
    const c = new Uint8Array(46+n.length), cd = new DataView(c.buffer);
    cd.setUint32(0,0x02014b50,true); cd.setUint16(4,20,true); cd.setUint16(6,20,true); cd.setUint16(8,0x800,true); cd.setUint16(14,33,true);
    cd.setUint32(16,crc,true); cd.setUint32(20,size,true); cd.setUint32(24,size,true); cd.setUint16(28,n.length,true); cd.setUint32(42,offset,true); c.set(n,46);
    parts.push(l,bytes); central.push(c); offset += l.length+size; centralSize += c.length;
  }
  if (offset + centralSize + 22 > 0xffffffff) throw Error('ZIP size limit');
  const end = new Uint8Array(22), ed = new DataView(end.buffer);
  ed.setUint32(0,0x06054b50,true); ed.setUint16(8,files.length,true); ed.setUint16(10,files.length,true); ed.setUint32(12,centralSize,true); ed.setUint32(16,offset,true);
  return new Blob([...parts,...central,end], {type:'application/zip'});
}
async function splitPdfPages() {
  if (documentOperation || !S.base) return;
  documentOperation = true; busy(true, 'Splitting PDF…');
  try {
    await libReady;
    const src = await PDFLib.PDFDocument.load(await buildPdf());
    const files = [], stem = S.fileName.replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_') || 'document';
    const digits = Math.max(3,String(src.getPageCount()).length);
    for (const i of src.getPageIndices()) {
      const out = await PDFLib.PDFDocument.create();
      const [page] = await out.copyPages(src,[i]); out.addPage(page);
      files.push({name:stem+'-page-'+String(i+1).padStart(digits,'0')+'.pdf',bytes:await out.save()});
    }
    const url = URL.createObjectURL(pageZip(files));
    const a = document.createElement('a'); a.href=url; a.download=stem+'-pages.zip'; document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    toast('PDF pages exported.');
  } catch(e) { console.error(e); toast('Could not split PDF.',5000); }
  finally { documentOperation=false; busy(false); }
}
function rotateCurrentPage(op) {
  const p = S.pages[S.curPage] || S.pages[0]; if (p) pageOp(p.id,op);
}

/* ---------------- wiring ---------------- */
function bind() {
  const pick = () => $('#filePdf').click();
  $('#btnOpen').addEventListener('click', e => { e.stopPropagation(); pick(); });
  $('#btnOpen2').addEventListener('click', pick);
  $('#dropzone').addEventListener('click', pick);
  $('#dropzone').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  $('#filePdf').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; openFile(f); });
  $('#fileImg').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; const at = pendingImage; pendingImage = null; if (f) addImageFile(f, at); else if (S.tool === 'image') setTool('select', true); });
  $('#btnSample').addEventListener('click', async () => { busy(true, 'Making a sample…'); try { await openBytes(await makeSample(), 'sample-invoice.pdf'); } catch (e) { toast('Could not create the sample: ' + e.message); } finally { busy(false); } });
  $('#btnMergePdf').addEventListener('click', () => $('#fileMergePdf').click());
  $('#fileMergePdf').addEventListener('change', e => { const files = Array.from(e.target.files); e.target.value = ''; void mergePdfFiles(files); });
  $('#btnSplitPdf').addEventListener('click', splitPdfPages);
  $('#btnRotateLeft').addEventListener('click', () => rotateCurrentPage('rot-left'));
  $('#btnRotateRight').addEventListener('click', () => rotateCurrentPage('rot'));
  $('#btnDownload').addEventListener('click', download);
  $('#btnPrint').addEventListener('click', printPdf);
  $('#btnShare').addEventListener('click', share);
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnAddPage').addEventListener('click', addBlankPage);
  $('#btnPagesM').addEventListener('click', () => document.body.classList.toggle('pages-open'));
  $('#btnClosePages').addEventListener('click', () => document.body.classList.remove('pages-open'));
  $('#tools').addEventListener('click', e => { const b = e.target.closest('.tool[data-tool]'); if (b) { if (b.dataset.tool === S.tool && b.dataset.tool !== 'image') setTool('select', true); else setTool(b.dataset.tool); } });
  $('#thumbs').addEventListener('click', e => {
    const li = e.target.closest('.thumb'); if (!li) return;
    const b = e.target.closest('button[data-op]');
    if (b) pageOp(li.dataset.id, b.dataset.op); else if (e.target.closest('.tcanvas')) scrollToPage(li.dataset.id);
  });
  $('#thumbs').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tcanvas')) { e.preventDefault(); scrollToPage(e.target.closest('.thumb').dataset.id); } });
  const props = $('#props');
  props.addEventListener('pointerdown', e => { if (S.editing && e.target.closest('button')) e.preventDefault(); }); // keep the keyboard up while styling
  props.addEventListener('click', onPropsClick);
  props.addEventListener('input', onPropsInput);
  props.addEventListener('change', onPropsInput);
  // floating mini toolbar on a selected edit
  $('#pagesWrap').addEventListener('pointerdown', e => { if (e.target.closest('.ftb')) { e.stopPropagation(); if (S.editing) e.preventDefault(); } }, true);
  $('#pagesWrap').addEventListener('click', e => { const b = e.target.closest('.ftb button'); if (!b) return; e.stopPropagation(); const o = curObj(); if (o) objAction(b.dataset.act, o); });
  // zoom
  $('#zoomIn').addEventListener('click', () => setZoom(S.zoom * 1.2));
  $('#zoomOut').addEventListener('click', () => setZoom(S.zoom / 1.2));
  $('#zoomVal').addEventListener('click', () => setZoom(fitZoom()));
  const viewer = $('#viewer');
  viewer.addEventListener('wheel', e => {
    if (!S.base || !e.deltaY) return;
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewer.clientHeight : 1);
    e.preventDefault();
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) { viewer.scrollTop += dy; return; }
    setZoom(S.zoom * Math.exp(-dy * 0.0025), e.clientX, e.clientY);
  }, { passive: false });
  viewer.addEventListener('scroll', () => { clearTimeout(viewer._t); viewer._t = setTimeout(updatePageInd, 80); }, { passive: true });
  let pinch = null; // two-finger zoom on phones
  viewer.addEventListener('touchstart', e => { if (e.touches.length === 2) { const [a, b] = e.touches; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: S.zoom }; } }, { passive: true });
  viewer.addEventListener('touchmove', e => {
    if (pinch && e.touches.length === 2) { e.preventDefault(); const [a, b] = e.touches; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); setZoom(pinch.z * d / pinch.d, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2); }
  }, { passive: false });
  viewer.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
  // drag and drop: PDFs open, images get placed where they land
  let dragDepth = 0;
  window.addEventListener('dragenter', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { dragDepth++; $('#dropOverlay').hidden = false; $('#dropzone').classList.add('over'); } });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { $('#dropOverlay').hidden = true; $('#dropzone').classList.remove('over'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; $('#dropOverlay').hidden = true; $('#dropzone').classList.remove('over');
    const f = e.dataTransfer?.files?.[0]; if (!f) return;
    if (f.type.startsWith('image/') && S.base) {
      const layer = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList?.contains('layer'));
      const at = layer ? { pid: layer.dataset.id, ...toPt(e, layer) } : null;
      addImageFile(f, at);
    } else openFile(f);
  });
  // keyboard
  window.addEventListener('keydown', e => {
    if (!S.base) return;
    const typing = e.target.closest?.('input,select,textarea,[contenteditable="true"],[contenteditable="plaintext-only"]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !S.editing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !S.editing) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); download(); return; }
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); printPdf(); return; }
    if (typing) return;
    const o = curObj();
    if (o && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); deleteObj(o.id); return; }
    if (o && e.key === 'Enter' && o.type === 'text') { e.preventDefault(); enterEdit(o); return; }
    if (e.key === 'Escape') { deselect(); setTool('select', true); return; }
    if (o && e.key.startsWith('Arrow')) {
      e.preventDefault(); const s = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') o.x -= s; if (e.key === 'ArrowRight') o.x += s; if (e.key === 'ArrowUp') o.y -= s; if (e.key === 'ArrowDown') o.y += s;
      refreshObj(o); clearTimeout(bind._n); bind._n = setTimeout(commit, 400); return;
    }
    const map = { v: 'select', t: 'text', e: 'edittext', i: 'image', w: 'whiteout', h: 'highlight', r: 'rect', d: 'draw' };
    if (!mod && !e.altKey && map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
  });
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  let rw = window.innerWidth;
  window.addEventListener('resize', () => { if (!S.base || Math.abs(window.innerWidth - rw) < 40) return; rw = window.innerWidth; clearTimeout(bind._r); bind._r = setTimeout(() => setZoom(fitZoom()), 200); });
  // share button where the phone supports sharing files (WhatsApp, mail…)
  try { if (navigator.canShare && navigator.canShare({ files: [new File([new Uint8Array([37])], 'x.pdf', { type: 'application/pdf' })] })) $('#btnShare').hidden = false; } catch (e) {}
}

function boot() {
  registerFaces();
  bind();
  libReady.then(initStdMetrics).catch(e => console.warn('metrics', e));
  for (const k of ['Helvetica', 'Times', 'Courier']) for (const v of ['r', 'b', 'i', 'bi']) ensureFace(k, v);
  window.__pdfStudio = { S, buildPdf, openBytes, makeSample, setTool, setZoom, wrapText }; // handy for testing
}
boot();
