/**
 * app.js — Woodland Restoration Calculator
 * Main application controller
 *
 * Architecture:
 *   _state       — single source of truth for all inputs & overrides
 *   _constants   — base constants from IndexedDB (never mutated)
 *   patchConstants() — deep-clones _constants and applies _state overrides (state.js)
 *   buildInputs() — extracts calc-facing input object from _state (state.js)
 *   runCalculation() — patches constants, calculates, renders, encodes URL
 *   configureForType() — shows/hides form sections for the selected project type
 */

import { dbReady, getConstants, resetConstants } from './db.js';
import {
  calculate,
  suggestPerimeter,
  difficultyLabel,
  difficultyClass,
  getProfile,
  effectiveCosts,
  rateValue,
  PROJECT_TYPES,
} from './calc.js';
import {
  defaultState,
  decodeState,
  encodeState,
  buildInputs,
  patchConstants,
  TYPE_SPECIFIC_ADV_KEYS,
} from './state.js';
import { donutChart, lineChart, CHART_COLORS } from './charts.js';

// ─────────────────────────────────────────────────
// Application state — single source of truth
// ─────────────────────────────────────────────────

let _state       = null;
let _constants   = null;
let _lastResults = null;
let _activeTab   = 'contractor';

// ─────────────────────────────────────────────────
// DOM shorthand
// ─────────────────────────────────────────────────

const el = id => document.getElementById(id);

const show = (id, visible) => { const e = el(id); if (e) e.hidden = !visible; };

// ─────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────

/**
 * formatGBP — returns "£X,XXX" or "-£X,XXX". Never shows pence for values > £100.
 */
function formatGBP(n) {
  if (n == null || isNaN(n)) return '£0';
  const abs    = Math.abs(Math.round(n));
  const prefix = n < 0 ? '-£' : '£';
  return prefix + abs.toLocaleString('en-GB');
}

// Alias used internally
const fmt = formatGBP;

const fmtM = m => Math.round(m).toLocaleString('en-GB') + ' m';

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// ─────────────────────────────────────────────────
// Profile helpers
// ─────────────────────────────────────────────────

const profile  = () => getProfile(_constants, _state.project_type);
const isLinear = () => profile().model === 'linear';

function overrideItem(kind) {
  return (profile().grants ?? []).filter(g => g.override === kind);
}

function rateFor(item) {
  return item ? item.rate.split('.').reduce((o, k) => o?.[k], _constants) : null;
}

// ─────────────────────────────────────────────────
// Project type selector + per-type form configuration
// ─────────────────────────────────────────────────

function buildTypeSelector() {
  const wrap = el('type-selector');
  if (!wrap) return;
  wrap.textContent = '';
  for (const type of PROJECT_TYPES) {
    const p   = getProfile(_constants, type);
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'type-option';
    btn.dataset.type = type;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    const icon = document.createElement('span');
    icon.className   = 'type-icon';
    icon.textContent = p.icon ?? '🌳';
    icon.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className   = 'type-name';
    name.textContent = p.label ?? type;
    btn.append(icon, name);
    btn.addEventListener('click', () => setProjectType(type));
    wrap.appendChild(btn);
  }

  // Radio-group keyboard behaviour: arrows move the selection
  wrap.addEventListener('keydown', e => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const idx  = PROJECT_TYPES.indexOf(_state.project_type);
    const next = PROJECT_TYPES[(idx + keys[e.key] + PROJECT_TYPES.length) % PROJECT_TYPES.length];
    setProjectType(next);
    wrap.querySelector(`[data-type="${next}"]`)?.focus();
  });
}

function setProjectType(type) {
  if (type === _state.project_type) return;
  const keep = {
    hire_agent:        _state.hire_agent,
    adv_yield:         _state.adv_yield,
    adv_sitka_price:   _state.adv_sitka_price,
    adv_scots_price:   _state.adv_scots_price,
    adv_agent_fee_pct: _state.adv_agent_fee_pct,
  };
  _state = { ...defaultState(type, _constants), ...keep };

  const advIds = {
    adv_fencing_grant: 'adv-fencing-grant', adv_restocking_grant: 'adv-restocking-grant',
    adv_trees_per_ha:  'adv-trees-per-ha',  adv_tree_cost:        'adv-tree-cost',
  };
  TYPE_SPECIFIC_ADV_KEYS.forEach(k => { const e = el(advIds[k]); if (e) e.value = ''; });

  configureForType();
  applyStateToDOM(_state);
  populateAdvancedFields(_constants);
  runCalculation();
}

function populateSpecies(p) {
  const sel = el('input-species');
  if (!sel) return;
  sel.textContent = '';
  for (const [key, sp] of Object.entries(p.species ?? {})) {
    const opt = document.createElement('option');
    opt.value       = key;
    opt.textContent = sp.label;
    sel.appendChild(opt);
  }
  const label = el('species-label');
  if (label) label.textContent = p.species_label ?? 'Species';
}

function renumberSections() {
  let n = 0;
  document.querySelectorAll('.panel-controls .input-section').forEach(section => {
    if (section.hidden) return;
    n += 1;
    const num = section.querySelector('.section-number');
    if (num) num.textContent = String(n).padStart(2, '0');
  });
}

/** Static per-type layout: which blocks exist, labels, species list. */
function configureForType() {
  const p      = profile();
  const linear = isLinear();
  const s      = p.sections ?? {};

  document.querySelectorAll('.type-option').forEach(btn => {
    const on = btn.dataset.type === _state.project_type;
    btn.setAttribute('aria-checked', String(on));
    btn.tabIndex = on ? 0 : -1;
  });
  const desc = el('type-description');
  if (desc) desc.textContent = p.description ?? '';

  // 01 Size + species
  el('title-woodland').textContent = linear ? 'Your Hedge' : 'Your Woodland';
  show('block-area-size',   !linear);
  show('block-linear-size',  linear);
  show('block-density',     !linear && s.density === true);
  populateSpecies(p);

  // 02 Harvest
  const timberPossible = !linear && (p.timber_enabled || p.timber_optional);
  show('section-harvest',     timberPossible);
  show('block-timber-toggle', timberPossible && !p.timber_enabled);

  // 03 Fencing
  const stock = linear || p.fence_type === 'stock';
  el('title-fencing').textContent = stock ? 'Stock Fencing' : 'Deer Fencing';
  el('no-fence-label').textContent = stock
    ? 'No stock fencing needed'
    : 'No deer pressure — fencing not needed';
  show('block-area-fence',   !linear);
  show('block-linear-fence',  linear);
  const hasFenceGrant = (p.grants ?? []).some(g => g.role === 'fencing');
  const note = el('fence-note');
  if (note) {
    note.hidden      = hasFenceGrant;
    note.textContent = hasFenceGrant ? '' : 'No fencing grant for this project type — the grant rate already covers tree protection, so any fence here is a cost only.';
  }

  // 04 Regeneration / restoration works / hedge works
  const showRegen = !linear && s.regen !== false;
  const showRhodo = !linear && s.rhodo !== false;
  show('section-regen', linear || showRegen || showRhodo);
  el('title-regen').textContent = linear ? 'Hedge Works' : (showRegen ? 'Regeneration Strategy' : 'Restoration Works');
  show('block-regen',       showRegen);
  show('block-rhodo',       showRhodo);
  show('block-hedge-works', linear);
  el('block-rhodo')?.classList.toggle('mt-12', showRegen);
  el('rhodo-label').textContent = p.rhodo_label ?? 'Rhododendron / invasive clearance';

  // 05 Funding
  show('block-esg-ha', !linear);
  show('block-esg-m',   linear);

  // Advanced settings
  show('adv-group-timber', timberPossible);
  const pawsPrices = _state.project_type === 'paws';
  ['adv-sitka-price', 'adv-scots-price'].forEach(id => {
    const field = el(id)?.closest('.advanced-field');
    if (field) field.hidden = !pawsPrices;
  });
  el('adv-grants-label').textContent = `${p.grant_scheme ?? 'FGS'} Grants`;

  const fenceItem = overrideItem('fencing')[0];
  show('adv-field-fencing-grant', !!fenceItem);
  if (fenceItem) {
    const r = rateFor(fenceItem);
    el('adv-fencing-grant-label').textContent = `${r?.label ?? 'Fencing grant'} (${r?.unit ?? '£/m'})`;
  }
  const estItems = overrideItem('establishment');
  show('adv-field-restocking-grant', estItems.length > 0);
  if (estItems.length) {
    const r = rateFor(estItems[0]);
    el('adv-restocking-grant-label').textContent = estItems.length > 1
      ? `Establishment grant (${r?.unit ?? '£/ha'})`
      : `${r?.label ?? 'Establishment grant'} (${r?.unit ?? '£/ha'})`;
  }
  show('adv-field-trees', !linear);
  el('adv-tree-cost-label').textContent = linear ? 'Plant cost each, contractor (£)' : 'Tree cost each (£)';

  // Results copy
  el('projection-title').textContent = linear
    ? '15-Year Hedgerow Value Projection'
    : '15-Year Woodland Value Projection';
  el('projection-helper').textContent = _state.project_type === 'paws'
    ? 'What your restored broadleaf woodland earns once the canopy establishes. Hover over the chart for year-by-year detail.'
    : 'Annual value once established, plus any multi-year maintenance or management grants. Hover over the chart for year-by-year detail.';

  renumberSections();
}

// ─────────────────────────────────────────────────
// Apply state → DOM inputs (used on init / URL restore / type change)
// ─────────────────────────────────────────────────

function applyStateToDOM(s) {
  const set  = (id, v) => { const e = el(id); if (e) e.value   = v; };
  const chk  = (id, v) => { const e = el(id); if (e) e.checked = v; };

  set('input-size',       s.hectares);
  set('input-size-num',   s.hectares);
  set('input-species',    s.species);
  set('input-difficulty', s.difficulty);
  set('input-perimeter',  s.fencing_m);
  set('input-regen',      s.natural_regen_pct);
  set('input-esg',        s.esg_per_ha);
  chk('input-agent',      s.hire_agent);
  chk('input-timber',     s.timber_enabled);
  chk('input-rhodo',      s.rhodo_enabled);
  set('input-rhodo-pct',  s.rhodo_pct);

  set('input-length',      s.length_m);
  set('input-length-num',  s.length_m);
  set('input-hedge-mode',  s.hedge_mode);
  set('input-gap',         s.gap_pct);
  set('input-ppm',         s.plants_per_m);
  set('input-lay',         s.lay_m);
  set('input-coppice',     s.coppice_m);
  set('input-stock-fence', s.stock_fence_m);
  set('input-guards',      s.guards);
  set('input-esg-m',       s.esg_per_m);

  const density = s.adv_trees_per_ha ?? effectiveCosts(_constants, profile()).trees_per_ha;
  set('input-density', density);

  const noFence = s.fencing_m === 0;
  chk('input-no-fence', noFence);
  const row    = el('fencing-slider-row');
  const slider = el('input-perimeter');
  if (row)    row.style.opacity = noFence ? '0.35' : '1';
  if (slider) slider.disabled  = noFence;

  // Advanced overrides — only write actual overrides; blank fields are filled
  // with constant defaults by populateAdvancedFields.
  const setIfSet = (id, v) => { const e = el(id); if (e && v != null) e.value = v; };
  setIfSet('adv-yield',            s.adv_yield);
  setIfSet('adv-fencing-grant',    s.adv_fencing_grant);
  setIfSet('adv-restocking-grant', s.adv_restocking_grant);
  setIfSet('adv-sitka-price',      s.adv_sitka_price);
  setIfSet('adv-scots-price',      s.adv_scots_price);
  setIfSet('adv-trees-per-ha',     s.adv_trees_per_ha);
  setIfSet('adv-tree-cost',        s.adv_tree_cost);
  setIfSet('adv-agent-fee',        s.adv_agent_fee_pct);
}

// ─────────────────────────────────────────────────
// Populate Advanced Settings from loaded constants
// ─────────────────────────────────────────────────

function establishmentDefault(c) {
  const items = overrideItem('establishment');
  const tph   = effectiveCosts(c, profile()).trees_per_ha;
  const item  = items.find(g => !g.when || (tph >= (g.when.tph_min ?? -Infinity) && tph <= (g.when.tph_max ?? Infinity))) ?? items[0];
  return item ? rateValue(rateFor(item)) : null;
}

function populateAdvancedFields(c) {
  const p     = profile();
  const costs = effectiveCosts(c, p);
  const set = (id, v) => { const e = el(id); if (e && v != null && e.value === '') e.value = v; };
  set('adv-yield',            p.timber_yield_t_per_ha ?? c.timber?.yield_tons_per_ha);
  set('adv-sitka-price',      c.timber?.species?.sitka_spruce?.price_per_ton);
  set('adv-scots-price',      c.timber?.species?.scots_pine?.price_per_ton);
  set('adv-fencing-grant',    rateValue(rateFor(overrideItem('fencing')[0])) || null);
  set('adv-restocking-grant', establishmentDefault(c));
  set('adv-trees-per-ha',     costs.trees_per_ha);
  set('adv-tree-cost',        isLinear() ? costs.plant_contractor_each : costs.tree_cost_each);
  set('adv-agent-fee',        (c.costs?.agent_fee_pct ?? 0.12) * 100);
}

// ─────────────────────────────────────────────────
// Debounce utility
// ─────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ─────────────────────────────────────────────────
// Live label updates (fast — no calculation)
// ─────────────────────────────────────────────────

function updateLiveLabels(s) {
  const set = (id, v) => { const e = el(id); if (e) e.textContent = v; };
  const p   = profile();

  // Size
  set('val-size', s.hectares.toFixed(1) + ' ha');

  // Agroforestry density
  const tph = s.adv_trees_per_ha ?? effectiveCosts(_constants, p).trees_per_ha;
  set('val-density', tph + ' trees/ha');

  // Species chip
  const chip = el('species-chip');
  const sp   = p.species?.[s.species];
  if (chip) chip.textContent = `${sp?.icon ?? '🌳'} ${sp?.label ?? s.species}`;

  // Timber / difficulty
  const timberOn = p.timber_enabled || (p.timber_optional && s.timber_enabled);
  show('block-difficulty', !!timberOn);
  set('val-difficulty', s.difficulty);
  const badge = el('difficulty-badge');
  if (badge) {
    badge.textContent = difficultyLabel(s.difficulty);
    badge.className   = 'difficulty-label ' + difficultyClass(s.difficulty);
  }

  // Perimeter display + fencing hint
  const noFence = el('input-no-fence')?.checked;
  set('val-perimeter', noFence ? '— (no fence needed)' : s.fencing_m.toLocaleString('en-GB') + ' m');

  // Fencing auto-suggest: hint only, never auto-sets the slider
  const suggest = suggestPerimeter(s.hectares);
  set('perimeter-auto', suggest.toLocaleString('en-GB'));

  // Regen chips
  set('val-regen',     s.natural_regen_pct + '%');
  set('regen-chip',    s.natural_regen_pct + '% natural regen');
  set('planting-chip', (100 - s.natural_regen_pct) + '% active planting');

  // Rhododendron / invasives
  set('val-rhodo-pct', s.rhodo_pct + '%');
  const rhodoRow = el('rhodo-slider-row');
  if (rhodoRow) rhodoRow.style.opacity = s.rhodo_enabled ? '1' : '0.35';
  const rhodoSlider = el('input-rhodo-pct');
  if (rhodoSlider) rhodoSlider.disabled = !s.rhodo_enabled;

  // Hedgerow
  const create   = s.hedge_mode === 'create';
  const gapPct   = create ? 100 : s.gap_pct;
  const plantM   = s.length_m * gapPct / 100;
  const existing = s.length_m - plantM;
  set('val-length', fmtM(s.length_m));
  set('val-gap',    gapPct + '%');
  show('gap-row', !create);
  set('plant-chip',  fmtM(plantM) + ' to plant');
  set('plants-chip', Math.round(plantM * s.plants_per_m).toLocaleString('en-GB') + ' plants');
  ['input-lay', 'input-coppice'].forEach(id => {
    const e = el(id);
    if (!e) return;
    e.max      = Math.max(existing, 0);
    e.disabled = create;
  });
  const layEff     = create ? 0 : Math.min(s.lay_m, existing);
  const coppiceEff = create ? 0 : Math.min(s.coppice_m, Math.max(existing - layEff, 0));
  set('val-lay',         fmtM(layEff));
  set('val-coppice',     fmtM(coppiceEff));
  set('hedge-works-note', create
    ? 'Laying and coppicing apply to existing hedges only.'
    : `Laying and coppicing apply to the existing hedge (${fmtM(existing)}), not the gaps.`);
  set('val-stock-fence', fmtM(s.stock_fence_m));

  // ESG
  set('val-esg',   '£' + s.esg_per_ha.toLocaleString('en-GB') + '/ha');
  set('val-esg-m', '£' + s.esg_per_m.toFixed(2) + '/m');

  // Agent toggle labels
  el('label-diy')?.classList.toggle('active', !s.hire_agent);
  el('label-agent')?.classList.toggle('active', s.hire_agent);
  el('agent-fee-notice')?.classList.toggle('visible', s.hire_agent);

  // Sister tool nudge — show once a calculation is in progress, with live size
  const nudge     = el('sister-nudge');
  const nudgeSize = el('nudge-size');
  if (nudge)     nudge.style.display = 'block';
  if (nudgeSize) nudgeSize.textContent = isLinear() ? fmtM(s.length_m) : s.hectares.toFixed(1) + ' ha';
}

// ─────────────────────────────────────────────────
// renderResults — idempotent master render
// ─────────────────────────────────────────────────

const BREAKEVEN_COPY = {
  POSITIVE:      { cls: 'positive', icon: '✓', text: 'Timber alone covers costs'          },
  GRANTS_NEEDED: { cls: 'warn',     icon: '◑', text: 'Grants tip this into surplus'        },
  ESG_NEEDED:    { cls: 'warn',     icon: '◐', text: 'ESG sponsorship needed for surplus'  },
  DEFICIT:       { cls: 'negative', icon: '✗', text: 'Review site conditions'              },
};

export function renderResults(r) {
  _lastResults = r;
  renderHero(r, _activeTab);
  renderNotices(r);
  renderBreakdown(r);
  renderFundingMix(r);
  renderSweatEquity(r);
  renderProjection(r);
}

// ── Section 1: Hero ──────────────────────────────

function renderHero(r, tab) {
  const net   = tab === 'diy' ? r.net_year1_diy : r.net_year1_contractor;
  const isPos = net >= 0;
  const near  = Math.abs(net) <= 500;
  const color = near ? 'var(--c-gold-lt)' : isPos ? 'var(--c-gold-lt)' : '#fca5a5';

  const heroEl = el('hero-number');
  if (heroEl) {
    // FIX [T3-B]: use createElement + textContent so the formatted currency value
    // is never parsed as HTML — prevents any future injection via calculated strings.
    heroEl.textContent = '';
    const span = document.createElement('span');
    span.style.cssText = `font-family:'Playfair Display',Georgia,serif;font-size:3rem;font-weight:900;line-height:1;color:${color};`;
    span.textContent = fmt(net);
    heroEl.appendChild(span);
  }

  const bkWrap = el('breakeven-badge-wrap');
  if (bkWrap) {
    // FIX [T3-B]: breakeven text comes from a hardcoded lookup table (not user data),
    // but we still use createElement + textContent as a defence-in-depth practice.
    let bk = BREAKEVEN_COPY[r.breakeven_status] ?? BREAKEVEN_COPY.DEFICIT;
    if (r.breakeven_status === 'POSITIVE' && !r.timber_enabled) {
      bk = { ...bk, text: 'No net cost before grants' };
    }
    bkWrap.textContent = '';
    const badge = document.createElement('span');
    badge.className   = `breakeven-badge ${bk.cls}`;
    badge.textContent = `${bk.icon} ${bk.text}`;
    bkWrap.appendChild(badge);
  }

  const subEl = el('hero-sub');
  if (subEl) subEl.textContent = r.summary_label;

  el('tab-contractor')?.classList.toggle('active', tab === 'contractor');
  el('tab-diy')?.classList.toggle('active', tab === 'diy');
}

// ── Eligibility notices ──────────────────────────

function eligibilityNotices(r, s) {
  const notes = [];
  if (r.project_type === 'hedgerow') {
    const q = r.quantities;
    if (q.plant_m > 0 && s.plants_per_m < 6) {
      notes.push('AECS hedge planting needs a double row of at least 6 plants/m — the planting grant is excluded at this density.');
    }
    if (q.plant_m > 0 && s.guards === 'none' && s.stock_fence_m === 0) {
      notes.push('AECS hedge planting must be combined with a stock fence or guards (an existing stock-proof fence also counts).');
    }
    if (s.hedge_mode === 'create') {
      notes.push('AECS Creation of Hedgerows is only available inside its target area — check the AECS targeting tool.');
    }
    if (s.hedge_mode !== 'create' && (s.lay_m > q.lay_m || s.coppice_m > q.coppice_m)) {
      notes.push(`Laying and coppicing are capped at the existing hedge length (${fmtM(q.existing_m)}).`);
    }
    if (s.species === 'beech') {
      notes.push('Single-species beech hedges need prior AECS approval.');
    }
  }
  if (r.project_type === 'agroforestry') {
    const tph = s.adv_trees_per_ha ?? effectiveCosts(_constants, profile()).trees_per_ha;
    if (tph < 150 || tph > 400) {
      notes.push('FGS Agroforestry pays at 150–200 or 300–400 trees/ha — no establishment grant at this density.');
    } else if (tph > 200 && tph < 300) {
      notes.push('Between 200 and 300 trees/ha is paid at the lower (150–200 trees/ha) agroforestry rate.');
    }
    if (s.hectares > 15) {
      notes.push('FGS Agroforestry is capped at 15 ha per farm business.');
    }
  }
  return notes;
}

function renderNotices(r) {
  const wrap = el('result-notices');
  if (!wrap) return;
  wrap.textContent = '';
  for (const text of eligibilityNotices(r, _state)) {
    const div = document.createElement('div');
    div.className   = 'result-notice';
    div.textContent = '⚠ ' + text;
    wrap.appendChild(div);
  }
}

// ── Section 1: Breakdown table ───────────────────

function renderBreakdown(r) {
  const wrap = el('net-breakdown');
  if (!wrap) return;

  // Labels come from bundled constants and are escaped; values are fmt()-formatted numbers.
  const row = (label, value, color) => `
    <tr>
      <td>${escapeHTML(label)}</td>
      <td class="val" style="color:${color};">${fmt(value)}</td>
    </tr>`;

  const sub = (label, value) => `
    <tr class="sub-row">
      <td>↳ ${escapeHTML(label)}</td>
      <td class="val">${fmt(value)}</td>
    </tr>`;

  const annualRows = r.annual_grant_items.map(g => `
    <tr class="sub-row">
      <td>↳ ${escapeHTML(g.label)} <span class="text-muted">— ${fmt(g.amount)}/yr, in projection</span></td>
      <td class="val text-muted">—</td>
    </tr>`).join('');

  const linear     = r.model === 'linear';
  const costRows   = r.cost_items
    .filter(i => i.contractor > 0 || (!linear && (i.key === 'fencing' || i.key === 'planting')) || (linear && i.key === 'planting'))
    .map(i => row(i.label, -i.contractor, 'var(--c-ink)'))
    .join('');
  const agentLabel = 'Forestry agent fee (12%)';

  wrap.innerHTML = `
    <table class="breakdown-table">
      <tbody>
        <tr class="income-header">
          <td colspan="2">Income</td>
        </tr>
        ${r.timber_enabled ? row('Timber sale', r.timber_revenue, r.timber_revenue >= 0 ? 'var(--c-positive)' : 'var(--c-negative)') : ''}
        ${row(`${r.grant_scheme} grants total`, r.fgs_total, 'var(--c-positive)')}
        ${r.grant_items.map(g => sub(g.label, g.amount)).join('')}
        ${annualRows}
        ${row(linear ? 'Private sponsorship' : 'ESG / private BNG', r.esg_income, 'var(--c-positive)')}
        <tr class="subtotal-row">
          <td>Gross inflow</td>
          <td class="val">${fmt(r.gross_inflow)}</td>
        </tr>
        <tr class="cost-header">
          <td colspan="2">Costs — Contractor scenario</td>
        </tr>
        ${costRows}
        ${r.agent_fee > 0 ? row(agentLabel, -r.agent_fee, 'var(--c-negative)') : ''}
        <tr class="subtotal-row" style="background:rgba(155,34,38,.04);">
          <td>Gross outflow</td>
          <td class="val">${fmt(-r.gross_outflow_contractor)}</td>
        </tr>
        <tr class="total-row">
          <td>Net Year 1 — Contractor</td>
          <td class="val" style="color:${r.net_year1_contractor >= 0 ? 'var(--c-positive)' : 'var(--c-negative)'};">${fmt(r.net_year1_contractor)}</td>
        </tr>
        <tr class="diy-row">
          <td>Net Year 1 — DIY (materials only)</td>
          <td class="val" style="color:${r.net_year1_diy >= 0 ? 'var(--c-positive)' : 'var(--c-negative)'};">${fmt(r.net_year1_diy)}</td>
        </tr>
      </tbody>
    </table>`;
}

// ── Section 2: Funding Mix ────────────────────────

function renderFundingMix(r) {
  const { timber_pct, fgs_pct, esg_pct } = r.funding_mix;

  el('funding-placeholder').style.display = 'none';
  el('funding-bar').style.display = 'flex';

  const setSeg = (id, pct, label) => {
    const e = el(id);
    if (!e) return;
    e.style.width = pct + '%';
    e.textContent = pct >= 9 ? label : '';
    e.title       = label;
  };
  setSeg('seg-timber', timber_pct, `Timber ${timber_pct}%`);
  setSeg('seg-grant',  fgs_pct,    `Grants ${fgs_pct}%`);
  setSeg('seg-esg',    esg_pct,    `ESG ${esg_pct}%`);

  // Detail rows
  // FIX [T3-B security]: labels are hardcoded constants; values are fmt()-formatted
  // numbers only (£X,XXX). No user-typed text enters these innerHTML blocks.
  const rowsEl = el('funding-rows');
  if (rowsEl) {
    rowsEl.style.display = 'block';
    const items = [
      { label: 'Timber revenue',            value: r.timber_revenue, color: CHART_COLORS.timber, pct: timber_pct },
      { label: `${r.grant_scheme} grants`,  value: r.fgs_total,      color: CHART_COLORS.fgs,    pct: fgs_pct    },
      { label: r.model === 'linear' ? 'Private sponsorship' : 'ESG sponsorship',
        value: r.esg_income,     color: CHART_COLORS.esg,    pct: esg_pct    },
    ].filter(i => i.value > 0);

    // FIX [T3-C]: when timber revenue is negative (high difficulty), show a muted
    // notice rather than a negative bar or silent omission.
    const timberNotice = r.timber_enabled && r.timber_revenue < 0
      ? `<div class="funding-timber-negative">
           ⚠ Timber revenue: ${fmt(r.timber_revenue)} — extraction costs exceed sale value at this difficulty.
           Grant funding is carrying the project.
         </div>`
      : '';

    rowsEl.innerHTML = items.map(i => `
      <div class="funding-row">
        <div class="funding-row-left">
          <span class="funding-row-swatch" style="background:${i.color};"></span>
          ${i.label}
        </div>
        <div class="funding-row-right">
          <span class="funding-row-value">${fmt(i.value)}</span>
          <span class="funding-row-pct">${i.pct}%</span>
        </div>
      </div>`).join('') + timberNotice;
  }

  // Donut chart — show gross inflow as centre label
  const donutWrap = el('funding-donut-wrap');
  if (donutWrap && (timber_pct + fgs_pct + esg_pct) > 0) {
    donutWrap.style.display = 'block';
    donutChart('chart-donut', [
      { label: 'Timber', value: Math.max(0, r.timber_revenue), color: CHART_COLORS.timber },
      { label: 'Grants', value: r.fgs_total,                   color: CHART_COLORS.fgs    },
      { label: 'ESG',    value: r.esg_income,                  color: CHART_COLORS.esg    },
    ].filter(s => s.value > 0),
    `${fmt(r.gross_inflow)}\nGross inflow`);
  } else if (donutWrap) {
    donutWrap.style.display = 'none';
  }
}

// ── Section 3: Sweat Equity ───────────────────────

function renderSweatEquity(r) {
  el('sweat-placeholder').style.display = 'none';

  const compareEl = el('sweat-compare');
  const totalEl   = el('sweat-total');
  if (!compareEl || !totalEl) return;

  compareEl.style.display = 'block';
  totalEl.style.display   = 'block';

  const linear = r.model === 'linear';
  const items  = r.cost_items.filter(i =>
    i.contractor > 0 || (!linear && (i.key === 'fencing' || i.key === 'planting')));

  const maxCost = Math.max(1, ...items.flatMap(i => [i.contractor, i.diy]));

  const pct   = v => Math.round((v / maxCost) * 100);
  const block = (label, cVal, dVal) => {
    const saving  = cVal - dVal;
    const savePct = cVal > 0 ? Math.round((saving / cVal) * 100) : 0;
    return `
      <div class="compare-block">
        <div class="compare-block-label">${escapeHTML(label)}</div>
        <div class="compare-bar-item">
          <span class="compare-bar-name">Contractor</span>
          <div class="compare-bar-track">
            <div class="compare-bar-fill" style="width:${pct(cVal)}%;background:${CHART_COLORS.contractor};">
              ${cVal > 800 ? fmt(cVal) : ''}
            </div>
          </div>
          <span class="compare-bar-value">${fmt(cVal)}</span>
        </div>
        <div class="compare-bar-item">
          <span class="compare-bar-name">DIY</span>
          <div class="compare-bar-track">
            <div class="compare-bar-fill" style="width:${pct(dVal)}%;background:${CHART_COLORS.diy};">
              ${dVal > 800 ? fmt(dVal) : ''}
            </div>
          </div>
          <span class="compare-bar-value">${fmt(dVal)}</span>
        </div>
        <div class="compare-saving-row">
          <span class="compare-saving-label">💪 DIY saving</span>
          <span class="compare-saving-value">${fmt(saving)} (${savePct}%)</span>
        </div>
      </div>`;
  };

  compareEl.innerHTML = items.length
    ? items.map(i => block(i.compare_label ?? i.label, i.contractor, i.diy)).join('')
    : '<p class="helper-text">No works costed yet.</p>';

  const totalSaving = r.sweat_equity_saving;
  const savePct     = r.contractor_total > 0
    ? Math.round((totalSaving / r.contractor_total) * 100) : 0;

  const flipMsg = r.net_year1_contractor < 0 && r.net_year1_diy >= 0
    ? `<div class="sweat-flip-msg">
         ★ Your sweat equity of ${fmt(totalSaving)} would turn this deficit to profit — DIY makes it viable.
       </div>`
    : (r.net_year1_diy < 0 && r.net_year1_contractor < 0)
    ? `<div class="sweat-flip-msg" style="color:var(--c-warn);border-color:var(--c-warn);">
         Your DIY saving of ${fmt(totalSaving)} reduces the deficit — but full viability needs grant support.
       </div>`
    : '';

  totalEl.innerHTML = `
    <div class="sweat-total-box">
      <span class="sweat-total-label">Total DIY saving</span>
      <span class="sweat-total-value">${fmt(totalSaving)}</span>
    </div>
    <div style="margin-top:6px;font-size:0.78rem;color:var(--c-muted);text-align:right;">
      ${savePct}% of full contractor cost — this is the value of your labour
    </div>
    ${flipMsg}`;
}

// ── Section 4: 15-Year Projection ────────────────

function renderProjection(r) {
  el('projection-placeholder').style.display = 'none';

  const chartWrap = el('projection-chart-wrap');
  const statsEl   = el('projection-stats');
  if (!chartWrap || !statsEl) return;

  chartWrap.style.display = 'block';
  statsEl.style.display   = 'block';

  const years   = r.projection;
  const xLabels = years.map(yr => `Yr${yr.year}`);
  const labels  = r.stream_labels ?? {};

  const datasets = [
    { label: labels.firewood ?? 'Firewood / Biomass', color: CHART_COLORS.timber, values: years.map(y => y.firewood)        },
    { label: labels.sporting ?? 'Sporting Rights',    color: CHART_COLORS.fgs,    values: years.map(y => y.sporting)        },
    { label: 'Natural Capital',                       color: CHART_COLORS.sweat,  values: years.map(y => y.natural_capital) },
    { label: 'BNG Credits',                           color: CHART_COLORS.esg,    values: years.map(y => y.bng)             },
  ];
  if (years.some(y => y.annual_grants > 0)) {
    datasets.push({ label: `${r.grant_scheme} annual grants`, color: CHART_COLORS.annual_grants, values: years.map(y => y.annual_grants) });
  }
  lineChart('chart-projection', xLabels, datasets, 'legend-projection');

  const yr15      = years[14];
  const firstYear = years.find(y => y.total > 0)?.year;
  statsEl.innerHTML = `
    <div class="stat-boxes">
      <div class="stat-box">
        <div class="stat-box-label">Year 15 annual value</div>
        <div class="stat-box-value">${fmt(yr15.total)}<span style="font-size:.7em;color:var(--c-muted);font-weight:400;">/yr</span></div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">15-year cumulative</div>
        <div class="stat-box-value">${fmt(r.projection_15yr_total)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-label">First income year</div>
        <div class="stat-box-value" style="color:var(--c-gold);font-size:1rem;">${firstYear ? 'Year ' + firstYear : '—'}</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────
// Main calculation cycle
// ─────────────────────────────────────────────────

function runCalculation() {
  if (!_constants || !_state) return;
  updateLiveLabels(_state);
  const inputs    = buildInputs(_state);
  const constants = patchConstants(_state, _constants);
  const results   = calculate(inputs, constants);
  renderResults(results);
  history.replaceState(null, '', '?' + encodeState(_state));
}

// ─────────────────────────────────────────────────
// Collapsible sections
// ─────────────────────────────────────────────────

function initCollapsibles() {
  document.querySelectorAll('.input-section-header').forEach(header => {
    const toggle = () => {
      const section = header.closest('.input-section');
      const open    = section.classList.toggle('open');
      header.setAttribute('aria-expanded', String(open));
    };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  document.querySelectorAll('.advanced-accordion-header').forEach(advHeader => {
    const toggle = () => {
      const acc  = advHeader.closest('.advanced-accordion');
      const open = acc.classList.toggle('open');
      advHeader.setAttribute('aria-expanded', String(open));
    };
    advHeader.addEventListener('click', toggle);
    advHeader.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

// ─────────────────────────────────────────────────
// Event wiring — all inputs update _state then recalc
// ─────────────────────────────────────────────────

/** Wires a slider/select/number input to a state key with a parser. */
function bind(id, key, parse, event = 'input') {
  el(id)?.addEventListener(event, () => {
    _state[key] = parse(el(id).value);
    runCalculation();
  });
}

const toInt   = d => v => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };
const toFloat = d => v => { const n = parseFloat(v);   return isNaN(n) ? d : n; };

/** Paired range + number inputs with validation on the number field. */
function bindPaired(rangeId, numId, key, lo, hi, fallback, unitMsg) {
  el(rangeId)?.addEventListener('input', () => {
    _state[key] = parseFloat(el(rangeId).value) || fallback;
    el(numId).value = _state[key];
    runCalculation();
  });

  // FIX [3 validation]: reject out-of-range values in number input; revert on blur
  el(numId)?.addEventListener('input', () => {
    const v = parseFloat(el(numId).value);
    if (!isNaN(v) && v >= lo && v <= hi) {
      _state[key] = v;
      el(rangeId).value = v;
      el(numId).setCustomValidity('');
      runCalculation();
    } else {
      el(numId).setCustomValidity(unitMsg);
    }
  });
  el(numId)?.addEventListener('blur', () => {
    const v = parseFloat(el(numId).value);
    if (isNaN(v) || v < lo || v > hi) {
      el(numId).value = _state[key];
      el(numId).setCustomValidity('');
    }
  });
}

function initInputEvents() {
  bindPaired('input-size',   'input-size-num',   'hectares', 0.5, 20,   4,   'Enter a value between 0.5 and 20 hectares');
  bindPaired('input-length', 'input-length-num', 'length_m', 0,   5000, 0,   'Enter a value between 0 and 5,000 metres');

  bind('input-species',     'species',           v => v, 'change');
  bind('input-difficulty',  'difficulty',        toInt(2));
  bind('input-perimeter',   'fencing_m',         toInt(0));
  bind('input-regen',       'natural_regen_pct', toInt(0));
  bind('input-esg',         'esg_per_ha',        toInt(0));
  bind('input-esg-m',       'esg_per_m',         toFloat(0));
  bind('input-rhodo-pct',   'rhodo_pct',         toInt(0));
  bind('input-hedge-mode',  'hedge_mode',        v => (v === 'create' ? 'create' : 'restore'), 'change');
  bind('input-gap',         'gap_pct',           toInt(0));
  bind('input-lay',         'lay_m',             toInt(0));
  bind('input-coppice',     'coppice_m',         toInt(0));
  bind('input-stock-fence', 'stock_fence_m',     toInt(0));
  bind('input-guards',      'guards',            v => v, 'change');

  el('input-ppm')?.addEventListener('input', () => {
    const v = parseFloat(el('input-ppm').value);
    if (!isNaN(v) && v >= 1 && v <= 10) { _state.plants_per_m = v; runCalculation(); }
  });

  el('input-timber')?.addEventListener('change', () => {
    _state.timber_enabled = el('input-timber').checked;
    runCalculation();
  });

  el('input-rhodo')?.addEventListener('change', () => {
    _state.rhodo_enabled = el('input-rhodo').checked;
    runCalculation();
  });

  // Agroforestry density drives the trees/ha override (and the grant tier)
  el('input-density')?.addEventListener('input', () => {
    _state.adv_trees_per_ha = parseInt(el('input-density').value, 10) || null;
    const adv = el('adv-trees-per-ha');
    if (adv) adv.value = _state.adv_trees_per_ha ?? '';
    if (_state.adv_restocking_grant == null) {
      const rg = el('adv-restocking-grant');
      if (rg) { rg.value = ''; populateAdvancedFields(_constants); }
    }
    runCalculation();
  });

  // No fencing checkbox
  el('input-no-fence')?.addEventListener('change', () => {
    const checked    = el('input-no-fence').checked;
    _state.fencing_m = checked ? 0 : (parseInt(el('input-perimeter').value, 10) || 0);
    const row    = el('fencing-slider-row');
    const slider = el('input-perimeter');
    if (row)    row.style.opacity = checked ? '0.35' : '1';
    if (slider) slider.disabled  = checked;
    runCalculation();
  });

  // Agent/DIY toggle
  el('input-agent')?.addEventListener('change', () => {
    _state.hire_agent = el('input-agent').checked;
    runCalculation();
  });

  // Advanced overrides — debounced 500ms (number inputs can fire many events)
  const dCalc = debounce(runCalculation, 500);
  const advMap = [
    ['adv-yield',             'adv_yield'],
    ['adv-fencing-grant',     'adv_fencing_grant'],
    ['adv-restocking-grant',  'adv_restocking_grant'],
    ['adv-sitka-price',       'adv_sitka_price'],
    ['adv-scots-price',       'adv_scots_price'],
    ['adv-trees-per-ha',      'adv_trees_per_ha'],
    ['adv-tree-cost',         'adv_tree_cost'],
    ['adv-agent-fee',         'adv_agent_fee_pct'],
  ];
  advMap.forEach(([id, key]) => {
    el(id)?.addEventListener('input', () => {
      const v = parseFloat(el(id).value);
      _state[key] = isNaN(v) ? null : v;
      if (key === 'adv_trees_per_ha' && _state.adv_trees_per_ha != null) {
        const d = el('input-density');
        if (d) d.value = _state.adv_trees_per_ha;
      }
      dCalc();
    });
  });

  // Reset button
  el('adv-reset-btn')?.addEventListener('click', async () => {
    await resetConstants();
    _constants = await getConstants();

    // Clear all advanced overrides in state
    Object.assign(_state, {
      adv_yield: null, adv_fencing_grant: null, adv_restocking_grant: null,
      adv_sitka_price: null, adv_scots_price: null,
      adv_trees_per_ha: null, adv_tree_cost: null, adv_agent_fee_pct: null,
    });

    // Re-populate fields with fresh constants and clear overrides
    document.querySelectorAll('.adv-override').forEach(e => e.value = '');
    populateAdvancedFields(_constants);
    applyStateToDOM(_state);
    runCalculation();
  });
}

// ─────────────────────────────────────────────────
// Scenario tabs
// ─────────────────────────────────────────────────

function initTabs() {
  ['tab-contractor', 'tab-diy'].forEach(id => {
    el(id)?.addEventListener('click', () => {
      _activeTab = el(id).dataset.tab;
      el('tab-contractor')?.classList.toggle('active', _activeTab === 'contractor');
      el('tab-diy')?.classList.toggle('active', _activeTab === 'diy');
      if (_lastResults) renderHero(_lastResults, _activeTab);
    });
  });
}

// ─────────────────────────────────────────────────
// Loading overlay
// ─────────────────────────────────────────────────

function showOverlay() {
  const o = el('loading-overlay');
  if (o) o.style.display = 'flex';
}

function hideOverlay() {
  const o = el('loading-overlay');
  if (!o) return;
  o.style.opacity = '0';
  setTimeout(() => { o.style.display = 'none'; o.style.opacity = '1'; }, 350);
}

// ─────────────────────────────────────────────────
// PWA service worker
// ─────────────────────────────────────────────────

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ─────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────

// FIX [5c slow-network]: show overlay synchronously so it paints before
// any fetch/await begins. Split into sync init() + async _initAsync().
function init() {
  showOverlay();       // synchronous — browser can paint before first await
  _initAsync().catch(err => {
    console.error('Woodland calculator init error:', err);
    hideOverlay();
  });
}

async function _initAsync() {
  await dbReady;
  _constants = await getConstants();

  // Restore state from URL if present (links without `type` decode as PAWS)
  const urlState = decodeState(window.location.search, _constants);
  _state = urlState ?? defaultState('paws', _constants);

  buildTypeSelector();
  configureForType();

  // Apply URL override values first, then fill any remaining blank advanced
  // fields with constant defaults (populateAdvancedFields only writes to empty fields).
  applyStateToDOM(_state);
  populateAdvancedFields(_constants);

  initCollapsibles();
  initInputEvents();
  initTabs();
  registerServiceWorker();

  // First calculation
  runCalculation();

  hideOverlay();

  // FIX [8 print]: re-render canvases before the browser rasterises the page
  window.addEventListener('beforeprint', () => {
    if (_lastResults) renderResults(_lastResults);
  });

  // FIX [9 a11y]: add ARIA roles to canvas elements after first render
  const ariaMap = {
    'chart-donut':      'Funding mix donut chart showing timber, grants, and ESG income proportions',
    'chart-projection': '15-year stacked area chart showing value projection by income stream',
  };
  Object.entries(ariaMap).forEach(([id, label]) => {
    const c = el(id);
    if (c) { c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); }
  });
}

init();

// ─────────────────────────────────────────────────
// DevTools test helper
// ─────────────────────────────────────────────────

window.woodlandTest = async (overrides = {}) => {
  const inputs = { ...buildInputs(_state), ...overrides };
  const c      = patchConstants({ ..._state, ...overrides }, _constants);
  const r      = calculate(inputs, c);
  renderResults(r);
  console.table({
    'Net contractor': fmt(r.net_year1_contractor),
    'Net DIY':        fmt(r.net_year1_diy),
    'Breakeven':      r.breakeven_status,
    'Timber':         fmt(r.timber_revenue),
    'Grants':         fmt(r.fgs_total),
    'ESG':            fmt(r.esg_income),
  });
  return r;
};
window.pawsTest = window.woodlandTest;
