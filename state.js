/**
 * state.js — Woodland Restoration Calculator
 * Pure state helpers: per-type defaults, URL encode/decode, calc input building.
 * No DOM access, so it can be unit-tested in Node.
 */

import { PROJECT_TYPES, DEFAULT_PROJECT_TYPE, getProfile } from './calc.js';

export const ADV_KEYS = [
  'adv_yield', 'adv_fencing_grant', 'adv_restocking_grant',
  'adv_sitka_price', 'adv_scots_price', 'adv_mixed_price',
  'adv_trees_per_ha', 'adv_tree_cost', 'adv_agent_fee_pct',
];

/** Overrides whose meaning depends on the project type; cleared on type change. */
export const TYPE_SPECIFIC_ADV_KEYS = [
  'adv_fencing_grant', 'adv_restocking_grant', 'adv_trees_per_ha', 'adv_tree_cost',
];

const BASE_STATE = {
  project_type:      DEFAULT_PROJECT_TYPE,
  // Area inputs
  hectares:          4.0,
  species:           'sitka_spruce',
  difficulty:        2,
  fencing_m:         400,
  natural_regen_pct: 40,
  esg_per_ha:        1000,
  rhodo_enabled:     true,
  rhodo_pct:         100,
  timber_enabled:    false,
  // Hedgerow inputs
  length_m:          400,
  hedge_mode:        'restore',
  gap_pct:           20,
  plants_per_m:      6,
  lay_m:             0,
  coppice_m:         0,
  stock_fence_m:     0,
  guards:            'none',
  esg_per_m:         1,
  // Shared
  hire_agent:        false,
};

export function isValidType(type) {
  return PROJECT_TYPES.includes(type);
}

/** Full state for a project type, seeded from its profile defaults. */
export function defaultState(type, constants) {
  const t       = isValidType(type) ? type : DEFAULT_PROJECT_TYPE;
  const profile = getProfile(constants, t);
  const state   = { ...BASE_STATE, ...(profile.defaults ?? {}), project_type: t };
  for (const k of ADV_KEYS) state[k] = null;
  return state;
}

// ─────────────────────────────────────────────────
// URL encode / decode
// ─────────────────────────────────────────────────

/** Returns the query string (without '?') for a state object. */
export function encodeState(state) {
  const p = new URLSearchParams();
  p.set('type', state.project_type);

  if (state.project_type === 'hedgerow') {
    p.set('len',  state.length_m);
    p.set('sp',   state.species);
    p.set('hm',   state.hedge_mode);
    p.set('gap',  state.gap_pct);
    p.set('ppm',  state.plants_per_m);
    p.set('lay',  state.lay_m);
    p.set('cop',  state.coppice_m);
    p.set('sf',   state.stock_fence_m);
    p.set('grd',  state.guards);
    p.set('esgm', state.esg_per_m);
  } else {
    p.set('ha',    state.hectares);
    p.set('sp',    state.species);
    p.set('diff',  state.difficulty);
    p.set('fence', state.fencing_m);
    p.set('regen', state.natural_regen_pct);
    p.set('esg',   state.esg_per_ha);
    p.set('rh',    state.rhodo_enabled ? '1' : '0');
    p.set('rhp',   state.rhodo_pct);
    if (state.project_type !== 'paws') p.set('tim', state.timber_enabled ? '1' : '0');
  }
  p.set('agent', state.hire_agent ? '1' : '0');

  // Only encode non-null overrides
  const enc = (key, val) => { if (val != null) p.set(key, val); };
  enc('yield', state.adv_yield);
  enc('fg',    state.adv_fencing_grant);
  enc('rg',    state.adv_restocking_grant);
  enc('sitka', state.adv_sitka_price);
  enc('scots', state.adv_scots_price);
  enc('mixed', state.adv_mixed_price);
  enc('tph',   state.adv_trees_per_ha);
  enc('tc',    state.adv_tree_cost);
  enc('af',    state.adv_agent_fee_pct);

  return p.toString();
}

/**
 * Decodes a query string into a full state, or null if it holds no scenario.
 * Links without `type` (pre-2.0 PAWS links) decode as 'paws'. Every numeric
 * param is clamped and unknown species fall back to the type's default.
 */
export function decodeState(search, constants) {
  const p = new URLSearchParams(search);
  if (!p.has('ha') && !p.has('len') && !p.has('type')) return null;

  const rawType = p.get('type');
  const type    = isValidType(rawType) ? rawType : DEFAULT_PROJECT_TYPE;
  const d       = defaultState(type, constants);
  const profile = getProfile(constants, type);

  const pn    = (k, def) => { const v = parseFloat(p.get(k)); return isNaN(v) ? def : v; };
  const pi    = (k, def) => { const v = parseInt(p.get(k), 10); return isNaN(v) ? def : v; };
  const pN    = (k)      => { const v = parseFloat(p.get(k)); return isNaN(v) ? null : v; };
  const pb    = (k, def) => (p.has(k) ? p.get(k) === '1' : def);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const sp = p.get('sp');
  const species = sp && profile.species?.[sp] ? sp : d.species;

  const state = { ...d, species, hire_agent: p.get('agent') === '1' };

  if (type === 'hedgerow') {
    Object.assign(state, {
      length_m:      clamp(pi('len',  d.length_m),      0, 5000),
      hedge_mode:    p.get('hm') === 'create' ? 'create' : 'restore',
      gap_pct:       clamp(pi('gap',  d.gap_pct),       0, 100),
      plants_per_m:  clamp(pn('ppm',  d.plants_per_m),  1, 10),
      lay_m:         clamp(pi('lay',  d.lay_m),         0, 5000),
      coppice_m:     clamp(pi('cop',  d.coppice_m),     0, 5000),
      stock_fence_m: clamp(pi('sf',   d.stock_fence_m), 0, 10000),
      guards:        ['none', 'vole', 'rabbit'].includes(p.get('grd')) ? p.get('grd') : d.guards,
      esg_per_m:     clamp(pn('esgm', d.esg_per_m),     0, 10),
    });
  } else {
    Object.assign(state, {
      hectares:          clamp(pn('ha',    d.hectares),          0.5, 20),
      difficulty:        clamp(pi('diff',  d.difficulty),        1,   5),
      fencing_m:         clamp(pi('fence', d.fencing_m),         0,   3000),
      natural_regen_pct: clamp(pi('regen', d.natural_regen_pct), 0,   100),
      esg_per_ha:        clamp(pi('esg',   d.esg_per_ha),        0,   2500),
      rhodo_enabled:     pb('rh', d.rhodo_enabled),
      rhodo_pct:         clamp(pi('rhp',   d.rhodo_pct),         0,   100),
      timber_enabled:    pb('tim', d.timber_enabled),
    });
  }

  Object.assign(state, {
    adv_yield:            pN('yield'),
    adv_fencing_grant:    pN('fg'),
    adv_restocking_grant: pN('rg'),
    adv_sitka_price:      pN('sitka'),
    adv_scots_price:      pN('scots'),
    adv_mixed_price:      pN('mixed'),
    adv_trees_per_ha:     pN('tph'),
    adv_tree_cost:        pN('tc'),
    adv_agent_fee_pct:    pN('af'),
  });

  return state;
}

// ─────────────────────────────────────────────────
// Calc inputs + constants patching
// ─────────────────────────────────────────────────

/** Builds the calc-facing inputs object from state. */
export function buildInputs(state) {
  const common = {
    project_type:              state.project_type,
    species:                   state.species,
    hire_agent:                state.hire_agent,
    override_yield:            state.adv_yield,
    override_fencing_grant:    state.adv_fencing_grant,
    override_restocking_grant: state.adv_restocking_grant,
  };
  if (state.project_type === 'hedgerow') {
    return {
      ...common,
      length_m:      state.length_m,
      hedge_mode:    state.hedge_mode,
      gap_pct:       state.gap_pct,
      plants_per_m:  state.plants_per_m,
      lay_m:         state.lay_m,
      coppice_m:     state.coppice_m,
      stock_fence_m: state.stock_fence_m,
      guards:        state.guards,
      esg_per_m:     state.esg_per_m,
    };
  }
  return {
    ...common,
    hectares:          state.hectares,
    difficulty:        state.difficulty,
    fencing_m:         state.fencing_m,
    natural_regen_pct: state.natural_regen_pct,
    esg_per_ha:        state.esg_per_ha,
    rhodo_enabled:     state.rhodo_enabled,
    rhodo_pct:         state.rhodo_pct,
    timber_enabled:    state.timber_enabled,
  };
}

/** Deep-clones base constants and applies state-level overrides. */
export function patchConstants(state, base) {
  const needsPatch = state.adv_sitka_price  != null
    || state.adv_scots_price   != null
    || state.adv_mixed_price   != null
    || state.adv_trees_per_ha  != null
    || state.adv_tree_cost     != null
    || state.adv_agent_fee_pct != null;

  if (!needsPatch) return base;

  const c = JSON.parse(JSON.stringify(base));

  if (state.adv_sitka_price != null)
    c.timber.species.sitka_spruce.price_per_ton = state.adv_sitka_price;

  if (state.adv_scots_price != null) {
    c.timber.species.scots_pine.price_per_ton = state.adv_scots_price;
    c.timber.species.larch.price_per_ton      = state.adv_scots_price;
  }

  if (state.adv_mixed_price != null)
    c.timber.species.mixed_conifer.price_per_ton = state.adv_mixed_price;

  const profile = c.profiles?.[state.project_type];
  const profileCosts = profile ? (profile.costs ??= {}) : null;

  if (state.adv_trees_per_ha != null) {
    c.costs.trees_per_ha = state.adv_trees_per_ha;
    if (profileCosts && 'trees_per_ha' in profileCosts) profileCosts.trees_per_ha = state.adv_trees_per_ha;
  }

  if (state.adv_tree_cost != null) {
    if (state.project_type === 'hedgerow' && profileCosts) {
      profileCosts.plant_contractor_each = state.adv_tree_cost;
    } else {
      c.costs.tree_cost_each = state.adv_tree_cost;
      if (profileCosts && 'tree_cost_each' in profileCosts) profileCosts.tree_cost_each = state.adv_tree_cost;
    }
  }

  if (state.adv_agent_fee_pct != null)
    c.costs.agent_fee_pct = state.adv_agent_fee_pct / 100;

  return c;
}

/** Picks the advanced overrides out of a state object (for persistence). */
export function pickOverrides(state) {
  const o = {};
  for (const k of ADV_KEYS) if (state[k] != null) o[k] = state[k];
  return o;
}
