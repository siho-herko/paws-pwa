/**
 * charts.js — Zero-dependency canvas charts for PAWS modeller
 * Uses HTML5 Canvas 2D API only — no external libraries.
 *
 * Chart colour palette (per Prompt 4 spec):
 *   Timber revenue  #2d6a4f  (NFCA mid green)
 *   FGS grants      #52b788  (NFCA leaf green)
 *   ESG income      #f4c542  (NFCA gold light)
 *   Contractor cost #9b2226  (negative red)
 *   DIY cost        #ef4444  (lighter red)
 *   Sweat saving    #b5830a  (NFCA gold)
 *   Net positive    #166534
 *   Net negative    #9b2226
 */

export const CHART_COLORS = {
  timber:     '#2d6a4f',
  fgs:        '#52b788',
  esg:        '#f4c542',
  contractor: '#9b2226',
  diy:        '#ef4444',
  sweat:      '#b5830a',
  positive:   '#166534',
  negative:   '#9b2226',
};

// ─────────────────────────────────────────────────
// Singleton tooltip element
// ─────────────────────────────────────────────────

let _tooltip = null;

function getTooltip() {
  if (_tooltip) return _tooltip;
  _tooltip = document.createElement('div');
  Object.assign(_tooltip.style, {
    position:      'fixed',
    pointerEvents: 'none',
    zIndex:        '9999',
    display:       'none',
    background:    'rgba(26,61,43,.93)',
    color:         '#fff',
    padding:       '8px 12px',
    borderRadius:  '8px',
    fontFamily:    '"JetBrains Mono", monospace',
    fontSize:      '0.75rem',
    lineHeight:    '1.65',
    boxShadow:     '0 4px 16px rgba(0,0,0,.28)',
    maxWidth:      '220px',
  });
  document.body.appendChild(_tooltip);
  return _tooltip;
}

// ─────────────────────────────────────────────────
// setupCanvas
// ─────────────────────────────────────────────────

/**
 * Initialises a canvas for DPR-aware drawing.
 * Always call this first — it clears the canvas and sets up the context scale.
 *
 * @param {string} canvasId
 * @param {number} heightPx   — CSS height of the canvas
 * @returns {{ canvas, ctx, w, h } | null}
 */
export function setupCanvas(canvasId, heightPx = 280) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.parentElement?.clientWidth
            || canvas.offsetWidth
            || 600;
  const h   = heightPx;

  canvas.width        = Math.round(w * dpr);
  canvas.height       = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset any previous scale
  ctx.scale(dpr, dpr);

  return { canvas, ctx, w, h };
}

// ─────────────────────────────────────────────────
// donutChart
// ─────────────────────────────────────────────────

/**
 * Donut / pie chart — shows funding source proportions.
 *
 * Uses getBoundingClientRect() to measure the canvas's CSS-constrained
 * width (respects max-width), then draws on a square canvas so the
 * donut is always round — not distorted by a mismatched width/height.
 *
 * @param {string} canvasId
 * @param {Array<{ label: string, value: number, color: string }>} segments
 * @param {string} centreLabel  — text shown in the hole (use \n for 2 lines)
 */
export function donutChart(canvasId, segments, centreLabel) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  if (total === 0) return;

  // getBoundingClientRect forces a synchronous reflow, so it correctly
  // returns the CSS-constrained width even immediately after display:block.
  // Fall back to 180 if the element is still not rendered.
  const dpr  = window.devicePixelRatio || 1;
  const rect  = canvas.getBoundingClientRect();
  const size  = Math.round(rect.width > 10 ? rect.width : 180);

  // Set canvas bitmap resolution (square, for a round donut)
  canvas.width        = size * dpr;
  canvas.height       = size * dpr;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const cx    = size / 2;
  const cy    = size / 2;
  const outer = Math.min(cx, cy) - 10;
  const inner = outer * 0.56;
  const gap   = 0.022; // radians of gap between slices

  ctx.clearRect(0, 0, size, size);

  let angle = -Math.PI / 2;
  for (const seg of segments) {
    const val = Math.max(0, seg.value);
    if (val === 0) continue;
    const slice = (val / total) * (Math.PI * 2) - gap;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outer, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    angle += slice + gap;
  }

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Centre label — font size scales with donut size
  const lines   = String(centreLabel).split('\n');
  const fs0     = Math.max(11, Math.round(size * 0.075)); // first line (value)
  const fs1     = Math.max(9,  Math.round(size * 0.063)); // second line (label)
  const lineH   = fs0 * 1.35;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const y = cy + (i - (lines.length - 1) / 2) * lineH;
    ctx.font      = i === 0
      ? `700 ${fs0}px "JetBrains Mono", monospace`
      : `400 ${fs1}px "Source Sans 3", system-ui, sans-serif`;
    ctx.fillStyle = i === 0 ? '#1a3d2b' : '#6b7280';
    ctx.fillText(line, cx, y);
  });
}

// ─────────────────────────────────────────────────
// stackedBar (canvas version)
// ─────────────────────────────────────────────────

/**
 * Canvas horizontal stacked bar — single row.
 * Useful as a canvas alternative to the HTML .funding-bar.
 *
 * @param {string} canvasId
 * @param {Array<{ label: string, value: number, color: string }>} segments
 */
export function stackedBar(canvasId, segments) {
  const setup = setupCanvas(canvasId, 40);
  if (!setup) return;
  const { ctx, w, h } = setup;

  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  if (total === 0) return;

  ctx.clearRect(0, 0, w, h);

  const barH = 28;
  const barY = (h - barH) / 2;
  const r    = 6;
  let   x    = 0;

  segments.forEach((seg, i) => {
    const val  = Math.max(0, seg.value);
    const segW = (val / total) * w;
    if (segW < 1) return;

    ctx.beginPath();
    const isFirst = i === 0;
    const isLast  = i === segments.length - 1;
    _roundRect(ctx,
      x, barY, segW, barH,
      [isFirst ? r : 0, isLast ? r : 0, isLast ? r : 0, isFirst ? r : 0]);
    ctx.fillStyle = seg.color;
    ctx.fill();

    if (segW > 36) {
      ctx.fillStyle    = 'rgba(255,255,255,.9)';
      ctx.font         = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round((val / total) * 100)}%`, x + segW / 2, h / 2);
    }
    x += segW;
  });
}

// ─────────────────────────────────────────────────
// lineChart — stacked area chart
// ─────────────────────────────────────────────────

/**
 * Stacked area line chart for 15-year projection.
 * Datasets are drawn as stacked areas; each dataset's values are
 * the INDIVIDUAL (non-cumulative) contribution — this function stacks them.
 *
 * @param {string} canvasId
 * @param {string[]} xLabels       — e.g. ['Yr1'..'Yr15']
 * @param {Array<{ label: string, color: string, values: number[] }>} datasets
 * @param {string|null} legendId   — optional HTML element id for legend
 */
export function lineChart(canvasId, xLabels, datasets, legendId) {
  const setup = setupCanvas(canvasId, 260);
  if (!setup) return;
  const { canvas, ctx, w, h } = setup;

  const pad = { top: 22, right: 18, bottom: 38, left: 60 };
  const cw  = w - pad.left - pad.right;
  const ch  = h - pad.top  - pad.bottom;
  const n   = xLabels.length;

  // Build cumulative stacks
  const stacks = [];
  let prev = new Array(n).fill(0);
  for (const ds of datasets) {
    const cum = ds.values.map((v, i) => prev[i] + Math.max(0, v));
    stacks.push(cum);
    prev = cum;
  }

  const maxVal  = Math.max(...stacks[stacks.length - 1], 200);
  const step    = _niceStep(maxVal);
  const yMax    = Math.ceil(maxVal / step) * step;

  const xPos = i => pad.left + (n > 1 ? (i / (n - 1)) * cw : cw / 2);
  const yPos = v => pad.top  + ch - (Math.max(0, v) / yMax) * ch;

  ctx.clearRect(0, 0, w, h);

  // Horizontal grid lines + Y-axis labels
  for (let v = 0; v <= yMax; v += step) {
    const y = yPos(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = '#e8e4dc';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle    = '#9ca3af';
    ctx.font         = '10px "JetBrains Mono", monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('£' + _formatK(v), pad.left - 6, y);
  }

  // X-axis baseline
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + ch);
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // FIX [2 mobile]: reduce font size on narrow canvases so labels don't overlap
  const xFontSize = w < 280 ? 9 : 10;
  // X-axis labels (every other to avoid crowding)
  xLabels.forEach((label, i) => {
    if (i % 2 === 0) {
      ctx.fillStyle    = '#9ca3af';
      ctx.font         = `${xFontSize}px "Source Sans 3", system-ui, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, xPos(i), pad.top + ch + 6);
    }
  });

  // Draw stacked areas from bottom to top
  for (let d = 0; d < datasets.length; d++) {
    const topStack = stacks[d];
    const botStack = d === 0 ? new Array(n).fill(0) : stacks[d - 1];

    // Filled area
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(topStack[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(xPos(i), yPos(topStack[i]));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(xPos(i), yPos(botStack[i]));
    ctx.closePath();
    ctx.fillStyle = datasets[d].color + 'aa'; // ~67% opacity
    ctx.fill();

    // Top stroke line
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(topStack[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(xPos(i), yPos(topStack[i]));
    ctx.strokeStyle = datasets[d].color;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  // Data point dots on the topmost stack
  const topStack = stacks[stacks.length - 1];
  topStack.forEach((v, i) => {
    if (v === 0) return;
    ctx.beginPath();
    ctx.arc(xPos(i), yPos(v), 3.5, 0, Math.PI * 2);
    ctx.fillStyle   = datasets[datasets.length - 1].color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  });

  // "Establishment" label for years 1–3 (zero values)
  const zeroEnd = stacks[stacks.length - 1].findIndex(v => v > 0);
  if (zeroEnd > 0) {
    const midX = (xPos(0) + xPos(zeroEnd - 1)) / 2;
    const midY = pad.top + ch / 2;
    ctx.fillStyle    = '#d1d5db';
    ctx.font         = 'italic 11px "Source Sans 3", system-ui, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Establishment', midX, midY);
  }

  // Attach hover tooltip (idempotent — removes previous listener)
  _attachLineTooltip(canvas, { xPos, xLabels, stacks, datasets, n });

  // HTML legend
  if (legendId) htmlLegend(legendId, datasets);
}

// ─────────────────────────────────────────────────
// htmlLegend
// ─────────────────────────────────────────────────

/**
 * Renders a row of colour-swatch + label items into a DOM element.
 *
 * @param {string} legendId
 * @param {Array<{ label: string, color: string }>} datasets
 */
export function htmlLegend(legendId, datasets) {
  const container = document.getElementById(legendId);
  if (!container) return;
  container.innerHTML = datasets.map(ds => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${ds.color};"></span>
      ${ds.label}
    </span>`).join('');
}

// ─────────────────────────────────────────────────
// Tooltip helper
// ─────────────────────────────────────────────────

function _attachLineTooltip(canvas, { xPos, xLabels, stacks, datasets, n }) {
  if (canvas._pawsTooltipMove) {
    canvas.removeEventListener('mousemove',  canvas._pawsTooltipMove);
    canvas.removeEventListener('mouseleave', canvas._pawsTooltipHide);
    canvas.removeEventListener('touchmove',  canvas._pawsTooltipMove);
  }

  const tip = getTooltip();

  canvas._pawsTooltipMove = (e) => {
    const rect   = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const mouseX  = clientX - rect.left;

    // Snap to nearest year index
    let idx = 0, minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xPos(i) - mouseX);
      if (d < minDist) { minDist = d; idx = i; }
    }
    if (minDist > 32) { tip.style.display = 'none'; return; }

    const total = stacks[stacks.length - 1][idx];
    if (total === 0) { tip.style.display = 'none'; return; }

    const rows = datasets.map((ds, d) => {
      const val = d === 0
        ? stacks[0][idx]
        : stacks[d][idx] - stacks[d - 1][idx];
      if (val === 0) return '';
      return `<span style="color:${ds.color};">●</span> ${ds.label}: £${val.toLocaleString('en-GB')}`;
    }).filter(Boolean).join('<br>');

    tip.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px;">${xLabels[idx]}</div>
      ${rows}
      <div style="border-top:1px solid rgba(255,255,255,.2);margin-top:5px;padding-top:4px;font-weight:700;">
        Total: £${total.toLocaleString('en-GB')}/yr
      </div>`;

    tip.style.display = 'block';
    tip.style.left    = (clientX + 14) + 'px';
    tip.style.top     = (clientY - 12) + 'px';
  };

  canvas._pawsTooltipHide = () => { tip.style.display = 'none'; };

  canvas.addEventListener('mousemove',  canvas._pawsTooltipMove);
  canvas.addEventListener('mouseleave', canvas._pawsTooltipHide);
  canvas.addEventListener('touchmove',  canvas._pawsTooltipMove, { passive: true });
}

// ─────────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────────

function _niceStep(maxVal) {
  if (maxVal <= 0) return 100;
  const mag  = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const norm = maxVal / mag;
  const step = norm <= 1.5 ? 0.2 : norm <= 3 ? 0.5 : norm <= 7 ? 1 : 2;
  return step * mag;
}

function _formatK(v) {
  if (v === 0)          return '0';
  if (v >= 1_000_000)   return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1000)        return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
  return String(Math.round(v));
}

function _roundRect(ctx, x, y, w, h, [tl, tr, br, bl]) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y,         x + tl, y);
  ctx.closePath();
}
