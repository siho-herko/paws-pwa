/**
 * app.js — PAWS Business Case Modeller
 * Main application controller
 *
 * Architecture:
 *   _state       — single source of truth for all inputs & overrides
 *   _constants   — base constants from IndexedDB (never mutated)
 *   patchConstants() — deep-clones _constants and applies _state overrides
 *   buildInputs() — extracts calc-facing input object from _state
 *   runCalculation() — patches constants, calculates, renders, encodes URL
 */

import { dbReady, getConstants, resetConstants } from './db.js';
import {
  calculate,
  suggestPerimeter,
  difficultyLabel,
  difficultyClass,
  speciesLabel,
  speciesIcon,
} from './calc.js';
import { donutChart, lineChart, CHART_COLORS } from './charts.js';

// ─────────────────────────────────────────────────
// Application state — single source of truth
// ─────────────────────────────────────────────────

const _state = {
  // Primary inputs
  hectares:          4.0,
  species:           'sitka_spruce',
  difficulty:        2,
  fencing_m:         400,
  natural_regen_pct: 40,
  esg_per_ha:        750,
  hire_agent:        false,

  // Advanced overrides (null = use base constant)
  adv_yield:              null,  // → inputs.override_yield
  adv_fencing_grant:      null,  // → inputs.override_fencing_grant
  adv_restocking_grant:   null,  // → inputs.override_restocking_grant
  adv_sitka_price:        null,  // patches constants
  adv_scots_price:        null,  // patches constants (Scots Pine + Larch)
  adv_trees_per_ha:       null,  // patches constants
  adv_tree_cost:          null,  // patches constants
  adv_agent_fee_pct:      null,  // patches constants (as %, converted to fraction)
};

let _constants   = null;
let _lastResults = null;
let _activeTab   = 'contractor';

// ─────────────────────────────────────────────────
// DOM shorthand
// ─────────────────────────────────────────────────

const el = id => document.getElementById(id);

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

// ─────────────────────────────────────────────────
// Constants patching
// ─────────────────────────────────────────────────

/** Deep-clones base constants and applies state-level overrides. */
function patchConstants(state, base) {
  const needsPatch = state.adv_sitka_price  != null
    || state.adv_scots_price  != null
    || state.adv_trees_per_ha != null
    || state.adv_tree_cost    != null
    || state.adv_agent_fee_pct != null;

  if (!needsPatch) return base;

  const c = JSON.parse(JSON.stringify(base));

  if (state.adv_sitka_price != null)
    c.timber.species.sitka_spruce.price_per_ton = state.adv_sitka_price;

  if (state.adv_scots_price != null) {
    c.timber.species.scots_pine.price_per_ton = state.adv_scots_price;
    c.timber.species.larch.price_per_ton      = state.adv_scots_price;
  }

  if (state.adv_trees_per_ha != null)
    c.costs.trees_per_ha    = state.adv_trees_per_ha;

  if (state.adv_tree_cost != null)
    c.costs.tree_cost_each  = state.adv_tree_cost;

  if (state.adv_agent_fee_pct != null)
    c.costs.agent_fee_pct   = state.adv_agent_fee_pct / 100;

  return c;
}

/** Builds the calc-facing inputs object from _state. */
function buildInputs(state) {
  return {
    hectares:          state.hectares,
    species:           state.species,
    difficulty:        state.difficulty,
    fencing_m:         state.fencing_m,
    natural_regen_pct: state.natural_regen_pct,
    esg_per_ha:        state.esg_per_ha,
    hire_agent:        state.hire_agent,
    override_yield:             state.adv_yield,
    override_fencing_grant:     state.adv_fencing_grant,
    override_restocking_grant:  state.adv_restocking_grant,
  };
}

// ─────────────────────────────────────────────────
// URL state encode / decode
// ─────────────────────────────────────────────────

function encodeURL(state) {
  const p = new URLSearchParams();
  p.set('ha',    state.hectares);
  p.set('sp',    state.species);
  p.set('diff',  state.difficulty);
  p.set('fence', state.fencing_m);
  p.set('regen', state.natural_regen_pct);
  p.set('esg',   state.esg_per_ha);
  p.set('agent', state.hire_agent ? '1' : '0');

  // Only encode non-null overrides
  const enc = (key, val) => { if (val != null) p.set(key, val); };
  enc('yield', state.adv_yield);
  enc('fg',    state.adv_fencing_grant);
  enc('rg',    state.adv_restocking_grant);
  enc('sitka', state.adv_sitka_price);
  enc('scots', state.adv_scots_price);
  enc('tph',   state.adv_trees_per_ha);
  enc('tc',    state.adv_tree_cost);
  enc('af',    state.adv_agent_fee_pct);

  history.replaceState(null, '', '?' + p.toString());
}

// FIX [3 malformed-URL]: valid species keys — anything else falls back to default
const VALID_SPECIES = new Set(['sitka_spruce', 'scots_pine', 'larch', 'mixed_conifer']);

function decodeURL() {
  const p = new URLSearchParams(window.location.search);
  if (!p.has('ha')) return null;

  const pn    = (k, d) => { const v = parseFloat(p.get(k)); return isNaN(v) ? d : v; };
  const pi    = (k, d) => { const v = parseInt(p.get(k), 10); return isNaN(v) ? d : v; };
  const pN    = (k)    => { const v = parseFloat(p.get(k)); return isNaN(v) ? null : v; };
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const sp  = p.get('sp') || 'sitka_spruce';

  return {
    // FIX [3 malformed-URL]: clamp all numeric params to valid ranges
    hectares:          clamp(pn('ha',    4),   0.5, 20),
    species:           VALID_SPECIES.has(sp) ? sp : 'sitka_spruce',
    difficulty:        clamp(pi('diff',  2),   1,   5),
    fencing_m:         clamp(pi('fence', 400), 0,   3000),
    natural_regen_pct: clamp(pi('regen', 40),  0,   100),
    esg_per_ha:        clamp(pi('esg',   750), 0,   2500),
    hire_agent:        p.get('agent') === '1',
    adv_yield:              pN('yield'),
    adv_fencing_grant:      pN('fg'),
    adv_restocking_grant:   pN('rg'),
    adv_sitka_price:        pN('sitka'),
    adv_scots_price:        pN('scots'),
    adv_trees_per_ha:       pN('tph'),
    adv_tree_cost:          pN('tc'),
    adv_agent_fee_pct:      pN('af'),
  };
}

// ─────────────────────────────────────────────────
// Apply state → DOM inputs (used on init / URL restore)
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

  const noFence = s.fencing_m === 0;
  chk('input-no-fence', noFence);
  const row    = el('fencing-slider-row');
  const slider = el('input-perimeter');
  if (row)    row.style.opacity = noFence ? '0.35' : '1';
  if (slider) slider.disabled  = noFence;

  // Advanced overrides — only set if non-null (blank = use default)
  // Only write to the DOM if we have an actual override — leave blank fields
  // untouched so populateAdvancedFields can fill them with constant defaults.
  const setIfSet = (id, v) => { const e = el(id); if (e && v != null) e.value = v; };
  setIfSet('adv-yield',           s.adv_yield);
  setIfSet('adv-fencing-grant',   s.adv_fencing_grant);
  setIfSet('adv-restocking-grant', s.adv_restocking_grant);
  setIfSet('adv-sitka-price',     s.adv_sitka_price);
  setIfSet('adv-scots-price',     s.adv_scots_price);
  setIfSet('adv-trees-per-ha',    s.adv_trees_per_ha);
  setIfSet('adv-tree-cost',       s.adv_tree_cost);
  setIfSet('adv-agent-fee',       s.adv_agent_fee_pct);
}

// ─────────────────────────────────────────────────
// Populate Advanced Settings from loaded constants
// ─────────────────────────────────────────────────

function populateAdvancedFields(c) {
  const set = (id, v) => { const e = el(id); if (e && v != null && e.value === '') e.value = v; };
  set('adv-yield',             c.timber?.yield_tons_per_ha);
  set('adv-sitka-price',       c.timber?.species?.sitka_spruce?.price_per_ton);
  set('adv-scots-price',       c.timber?.species?.scots_pine?.price_per_ton);
  set('adv-fencing-grant',     c.fgs_grants?.deer_fencing_grant_per_m);
  set('adv-restocking-grant',  c.fgs_grants?.restocking_grant_per_ha);
  set('adv-trees-per-ha',      c.costs?.trees_per_ha);
  set('adv-tree-cost',         c.costs?.tree_cost_each);
  set('adv-agent-fee',         (c.costs?.agent_fee_pct ?? 0.12) * 100);
}

// ─────────────────────────────────────────────────
// Live label updates (fast — no calculation)
// ─────────────────────────────────────────────────

function updateLiveLabels(s) {
  const set = (id, v) => { const e = el(id); if (e) e.textContent = v; };

  // Size
  set('val-size', s.hectares.toFixed(1) + ' ha');

  // Species chip
  const chip = el('species-chip');
  if (chip) chip.textContent = speciesIcon(s.species) + ' ' + speciesLabel(s.species);

  // Difficulty
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

  // ESG
  set('val-esg', '£' + s.esg_per_ha.toLocaleString('en-GB') + '/ha');

  // Agent toggle labels
  el('label-diy')?.classList.toggle('active', !s.hire_agent);
  el('label-agent')?.classList.toggle('active', s.hire_agent);
  el('agent-fee-notice')?.classList.toggle('visible', s.hire_agent);

  // Sister tool nudge — show once a calculation is in progress, with live ha
  const nudge   = el('sister-nudge');
  const nudgeHa = el('nudge-hectares');
  if (nudge)   nudge.style.display = 'block';
  if (nudgeHa) nudgeHa.textContent = s.hectares.toFixed(1);
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
    const bk   = BREAKEVEN_COPY[r.breakeven_status] ?? BREAKEVEN_COPY.DEFICIT;
    bkWrap.textContent = '';
    const badge = document.createElement('span');
    badge.className   = `breakeven-badge ${bk.cls}`;
    badge.textContent = `${bk.icon} ${bk.text}`;
    bkWrap.appendChild(badge);
  }

  const subEl = el('hero-sub');
  if (subEl) subEl.textContent = `${r.species_label} · ${r.difficulty_label} · ${r.hectares} ha`;

  el('tab-contractor')?.classList.toggle('active', tab === 'contractor');
  el('tab-diy')?.classList.toggle('active', tab === 'diy');
}

// ── Section 1: Breakdown table ───────────────────

function renderBreakdown(r) {
  const wrap = el('net-breakdown');
  if (!wrap) return;

  const row = (label, value, color) => `
    <tr>
      <td>${label}</td>
      <td class="val" style="color:${color};">${fmt(value)}</td>
    </tr>`;

  const sub = (label, value) => `
    <tr class="sub-row">
      <td>↳ ${label}</td>
      <td class="val">${fmt(value)}</td>
    </tr>`;

  wrap.innerHTML = `
    <table class="breakdown-table">
      <tbody>
        <tr class="income-header">
          <td colspan="2">Income</td>
        </tr>
        ${row('Timber sale', r.timber_revenue, r.timber_revenue >= 0 ? 'var(--c-positive)' : 'var(--c-negative)')}
        ${row('FGS grants total', r.fgs_total, 'var(--c-positive)')}
        ${sub('Deer fencing grant',        r.fgs_breakdown.fencing_grant)}
        ${sub('Tree protection (stakes)',   r.fgs_breakdown.tree_protection_grant)}
        ${sub('Restocking grant',          r.fgs_breakdown.restocking_grant)}
        ${sub('Rhododendron clearance',    r.fgs_breakdown.rhododendron_grant)}
        ${row('ESG / private BNG', r.esg_income, 'var(--c-positive)')}
        <tr class="subtotal-row">
          <td>Gross inflow</td>
          <td class="val">${fmt(r.gross_inflow)}</td>
        </tr>
        <tr class="cost-header">
          <td colspan="2">Costs — Contractor scenario</td>
        </tr>
        ${row('Deer fencing (installed)',   -r.contractor_fencing,  'var(--c-ink)')}
        ${row('Planting (supply + labour)', -r.contractor_planting, 'var(--c-ink)')}
        ${r.agent_fee > 0 ? row('Forestry agent fee (12%)', -r.agent_fee, 'var(--c-negative)') : ''}
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
      { label: 'Timber revenue',  value: r.timber_revenue, color: CHART_COLORS.timber, pct: timber_pct },
      { label: 'FGS grants',      value: r.fgs_total,      color: CHART_COLORS.fgs,    pct: fgs_pct    },
      { label: 'ESG sponsorship', value: r.esg_income,     color: CHART_COLORS.esg,    pct: esg_pct    },
    ].filter(i => i.value > 0);

    // FIX [T3-C]: when timber revenue is negative (high difficulty), show a muted
    // notice rather than a negative bar or silent omission.
    const timberNotice = r.timber_revenue < 0
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

  const maxCost = Math.max(
    r.contractor_fencing, r.diy_fencing,
    r.contractor_planting, r.diy_planting, 1);

  const pct   = v => Math.round((v / maxCost) * 100);
  const block = (label, cVal, dVal) => {
    const saving  = cVal - dVal;
    const savePct = cVal > 0 ? Math.round((saving / cVal) * 100) : 0;
    return `
      <div class="compare-block">
        <div class="compare-block-label">${label}</div>
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

  compareEl.innerHTML =
    block('Deer Fencing', r.contractor_fencing,  r.diy_fencing)
  + block('Planting',     r.contractor_planting, r.diy_planting);

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

  lineChart('chart-projection', xLabels, [
    { label: 'Firewood / Biomass',  color: CHART_COLORS.timber, values: years.map(y => y.firewood)        },
    { label: 'Sporting Rights',     color: CHART_COLORS.fgs,    values: years.map(y => y.sporting)        },
    { label: 'Natural Capital',     color: CHART_COLORS.sweat,  values: years.map(y => y.natural_capital) },
    { label: 'BNG Credits',         color: CHART_COLORS.esg,    values: years.map(y => y.bng)             },
  ], 'legend-projection');

  const yr15 = years[14];
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
        <div class="stat-box-value" style="color:var(--c-gold);font-size:1rem;">Year 4</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────
// Main calculation cycle
// ─────────────────────────────────────────────────

function runCalculation() {
  if (!_constants) return;
  updateLiveLabels(_state);
  const inputs    = buildInputs(_state);
  const constants = patchConstants(_state, _constants);
  const results   = calculate(inputs, constants);
  renderResults(results);
  encodeURL(_state);
}

// ─────────────────────────────────────────────────
// Debounce utility
// ─────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
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

function initInputEvents() {
  // Site size slider
  el('input-size')?.addEventListener('input', () => {
    _state.hectares = parseFloat(el('input-size').value) || 4;
    el('input-size-num').value = _state.hectares;
    runCalculation();
  });

  // FIX [3 validation]: reject 0 or negative in number input; revert on blur
  el('input-size-num')?.addEventListener('input', () => {
    const v = parseFloat(el('input-size-num').value);
    if (!isNaN(v) && v >= 0.5 && v <= 20) {
      _state.hectares = v;
      el('input-size').value = v;
      el('input-size-num').setCustomValidity('');
      runCalculation();
    } else {
      el('input-size-num').setCustomValidity('Enter a value between 0.5 and 20 hectares');
    }
  });
  el('input-size-num')?.addEventListener('blur', () => {
    const v = parseFloat(el('input-size-num').value);
    if (isNaN(v) || v < 0.5 || v > 20) {
      el('input-size-num').value = _state.hectares;
      el('input-size-num').setCustomValidity('');
    }
  });

  // Species dropdown
  el('input-species')?.addEventListener('change', () => {
    _state.species = el('input-species').value;
    runCalculation();
  });

  // Difficulty slider
  el('input-difficulty')?.addEventListener('input', () => {
    _state.difficulty = parseInt(el('input-difficulty').value, 10);
    runCalculation();
  });

  // Fencing perimeter slider
  el('input-perimeter')?.addEventListener('input', () => {
    _state.fencing_m = parseInt(el('input-perimeter').value, 10) || 0;
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

  // Natural regen slider
  el('input-regen')?.addEventListener('input', () => {
    _state.natural_regen_pct = parseInt(el('input-regen').value, 10) || 0;
    runCalculation();
  });

  // ESG slider
  el('input-esg')?.addEventListener('input', () => {
    _state.esg_per_ha = parseInt(el('input-esg').value, 10) || 0;
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
    console.error('PAWS init error:', err);
    hideOverlay();
  });
}

async function _initAsync() {
  await dbReady;
  _constants = await getConstants();

  // Restore state from URL if present
  const urlState = decodeURL();
  if (urlState) Object.assign(_state, urlState);

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
    'chart-donut':      'Funding mix donut chart showing timber, FGS grants, and ESG income proportions',
    'chart-projection': '15-year stacked area chart showing woodland value projection by income stream',
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

window.pawsTest = async (overrides = {}) => {
  const inputs = { ...buildInputs(_state), ...overrides };
  const c      = patchConstants({ ..._state, ...overrides }, _constants);
  const r      = calculate(inputs, c);
  renderResults(r);
  console.table({
    'Net contractor': fmt(r.net_year1_contractor),
    'Net DIY':        fmt(r.net_year1_diy),
    'Breakeven':      r.breakeven_status,
    'Timber':         fmt(r.timber_revenue),
    'FGS total':      fmt(r.fgs_total),
    'ESG':            fmt(r.esg_income),
  });
  return r;
};
