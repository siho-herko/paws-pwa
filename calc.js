/**
 * calc.js — Woodland Restoration Calculator
 * Pure calculation engine. No DOM access.
 * All functions are exported ES module exports.
 *
 * calculate(inputs, constants) dispatches on inputs.project_type:
 *   area types (paws, native_woodland, new_woodland, wood_pasture, agroforestry) → areaModel (ha)
 * Both return the same result shape so rendering and charts stay shared.
 * Inputs without project_type are treated as 'paws'.
 */

export const PROJECT_TYPES = [
  'paws', 'native_woodland', 'new_woodland', 'wood_pasture', 'agroforestry',
];
export const DEFAULT_PROJECT_TYPE = 'paws';

// ─────────────────────────────────────────────────
// Constants helpers
// ─────────────────────────────────────────────────

/** Rates are either plain numbers or { value, unit, source, verify } objects. */
export function rateValue(r) {
  if (r == null) return 0;
  return typeof r === 'object' ? (r.value ?? 0) : r;
}

function lookup(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function resolveRef(constants, ref) {
  return typeof ref === 'string' ? lookup(constants, ref) : ref;
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Used when constants predate profiles (e.g. a stale cached record).
const LEGACY_PAWS_PROFILE = {
  label: 'PAWS restoration',
  model: 'area',
  grant_scheme: 'FGS',
  timber_enabled: true,
  sections: { harvest: true, regen: true, rhodo: true },
  defaults: { rhodo_enabled: true, rhodo_pct: 100 },
  grants: [
    { key: 'fencing_grant',         role: 'fencing',       rate: 'fgs_grants.deer_fencing_grant_per_m',      basis: 'fence_m', override: 'fencing' },
    { key: 'tree_protection_grant', role: 'protection',    rate: 'fgs_grants.tree_protection_per_tree',      basis: 'trees' },
    { key: 'restocking_grant',      role: 'establishment', rate: 'fgs_grants.restocking_grant_per_ha',       basis: 'ha_establish', regen_factor: 'fgs_grants.natural_regen_discount', override: 'establishment' },
    { key: 'rhododendron_grant',    role: 'rhodo',         rate: 'fgs_grants.rhododendron_clearance_per_ha', basis: 'rhodo_ha' },
  ],
  costs: {},
};

export function projectType(inputs) {
  return PROJECT_TYPES.includes(inputs?.project_type) ? inputs.project_type : DEFAULT_PROJECT_TYPE;
}

export function getProfile(constants, type) {
  return constants.profiles?.[type]
      ?? constants.profiles?.[DEFAULT_PROJECT_TYPE]
      ?? LEGACY_PAWS_PROFILE;
}

/** Top-level costs with the profile's cost overrides applied. */
export function effectiveCosts(constants, profile) {
  return { ...(constants.costs ?? {}), ...(profile.costs ?? {}) };
}

function isLinear(profile) {
  return profile.model === 'linear';
}

function matchesWhen(when, ctx) {
  if (!when) return true;
  if (when.tph_min    != null && !(ctx.tph >= when.tph_min))   return false;
  if (when.tph_max    != null && !(ctx.tph <= when.tph_max))   return false;
  if (when.ppm_min    != null && !(ctx.ppm >= when.ppm_min))   return false;
  if (when.guards     != null && ctx.guards     !== when.guards)     return false;
  if (when.hedge_mode != null && ctx.hedge_mode !== when.hedge_mode) return false;
  return true;
}

/**
 * Evaluates a profile's grant items against physical quantities.
 * Annual items (annual_years) are returned separately and feed the projection.
 */
function evaluateGrants(profile, constants, q, ctx, inputs) {
  const year1 = [];
  const annual = [];
  for (const item of profile.grants ?? []) {
    if (!matchesWhen(item.when, ctx)) continue;
    const rateObj = resolveRef(constants, item.rate);
    let rate = rateValue(rateObj);
    if (item.override === 'fencing'       && inputs.override_fencing_grant    != null) rate = inputs.override_fencing_grant;
    if (item.override === 'establishment' && inputs.override_restocking_grant != null) rate = inputs.override_restocking_grant;

    const qty = item.basis === 'ha_establish'
      ? q.ha_active + q.ha_regen * rateValue(resolveRef(constants, item.regen_factor ?? 1))
      : (q[item.basis] ?? 0);

    const entry = {
      key:    item.key,
      role:   item.role,
      label:  item.label ?? rateObj?.label ?? item.key,
      unit:   rateObj?.unit ?? '',
      rate,
      amount: rate * qty,
    };
    if (item.annual_years) annual.push({ ...entry, years: item.annual_years });
    else year1.push(entry);
  }
  return { year1, annual };
}

// ─────────────────────────────────────────────────
// Area model (hectares)
// ─────────────────────────────────────────────────

function areaQuantities(inputs, constants, profile) {
  const c   = effectiveCosts(constants, profile);
  const ha  = Math.max(0, inputs.hectares ?? 0);
  const regenPct = profile.sections?.regen === false ? 0 : clamp(inputs.natural_regen_pct ?? 0, 0, 100);
  const activeFraction = (100 - regenPct) / 100;
  const regenFraction  = regenPct / 100;
  const tph = c.trees_per_ha;

  const rhodoAllowed = profile.sections?.rhodo !== false;
  const rhodoOn  = rhodoAllowed && (inputs.rhodo_enabled ?? profile.defaults?.rhodo_enabled ?? false);
  const rhodoPct = rhodoOn ? clamp(inputs.rhodo_pct ?? profile.defaults?.rhodo_pct ?? 100, 0, 100) : 0;

  const q = {
    ha,
    ha_active: ha * activeFraction,
    ha_regen:  ha * regenFraction,
    trees:     ha * tph * activeFraction,
    fence_m:   Math.max(0, inputs.fencing_m ?? 0),
    rhodo_ha:  ha * rhodoPct / 100,
    fixed:     ha > 0 ? 1 : 0,
  };
  return { q, c, ctx: { tph }, regenPct, rhodoPct };
}

function areaCostItems(q, c, profile) {
  const fenceLabel = profile.fence_type === 'stock' ? 'Stock fencing (installed)' : 'Deer fencing (installed)';
  const items = [
    { key: 'fencing',  label: fenceLabel, compare_label: profile.fence_type === 'stock' ? 'Stock Fencing' : 'Deer Fencing',
      contractor: q.fence_m * c.fencing_contractor_per_m, diy: q.fence_m * c.diy_fencing_per_m },
    { key: 'planting', label: 'Planting (supply + labour)', compare_label: 'Planting',
      contractor: q.trees * c.tree_cost_each,             diy: q.trees * c.diy_planting_per_tree },
  ];
  const rhodoC = q.rhodo_ha * (c.rhodo_contractor_per_ha ?? 0);
  const rhodoD = q.rhodo_ha * (c.rhodo_diy_per_ha ?? 0);
  if (rhodoC > 0 || rhodoD > 0) {
    const label = profile.rhodo_label ?? 'Invasive clearance';
    items.push({ key: 'rhodo', label, compare_label: label, contractor: rhodoC, diy: rhodoD });
  }
  return items;
}

/**
 * Area model: physical quantities, grants and cost items for hectare-based types.
 */
export function areaModel(inputs, constants) {
  const type    = projectType(inputs);
  const profile = getProfile(constants, type);
  const { q, c, ctx, regenPct, rhodoPct } = areaQuantities(inputs, constants, profile);
  const grants  = evaluateGrants(profile, constants, q, ctx, inputs);
  return {
    type, profile, quantities: q, costs: c,
    grants, cost_items: areaCostItems(q, c, profile),
    size: q.ha, unit: 'ha',
    regen_pct: regenPct, rhodo_pct: rhodoPct, trees_per_ha: ctx.tph,
  };
}

function runModel(inputs, constants) {
  return areaModel(inputs, constants);
}

// ─────────────────────────────────────────────────
// timberRevenue
// ─────────────────────────────────────────────────

/**
 * Timber revenue after applying difficulty penalty.
 * Returns £ total for the site (can be negative at high difficulty).
 * Always on for PAWS; optional (inputs.timber_enabled) where the profile allows standing timber.
 */
export function timberRevenue(inputs, constants) {
  const profile = getProfile(constants, projectType(inputs));
  if (isLinear(profile)) return 0;
  const enabled = profile.timber_enabled || (profile.timber_optional && inputs.timber_enabled === true);
  if (!enabled) return 0;

  const { hectares, difficulty, override_yield } = inputs;
  const t       = constants.timber;
  const species = profile.timber_species ?? inputs.species;

  const yieldPerHa     = override_yield ?? profile.timber_yield_t_per_ha ?? t.yield_tons_per_ha;
  const pricePerTon    = t.species[species]?.price_per_ton ?? 25;
  const penalty        = t.difficulty_penalty_per_ton[String(difficulty)] ?? 0;
  const netPricePerTon = pricePerTon - penalty;

  return hectares * yieldPerHa * netPricePerTon;
}

// ─────────────────────────────────────────────────
// fgsGrants
// ─────────────────────────────────────────────────

const LEGACY_ROLE_KEYS = {
  fencing:       'fencing_grant',
  protection:    'tree_protection_grant',
  establishment: 'restocking_grant',
  regen:         'restocking_grant',
  rhodo:         'rhododendron_grant',
};

/**
 * Year-1 grant breakdown for the project's scheme (FGS for woodland types, AECS for hedgerows).
 *
 * For PAWS the restocking grant is pro-rated:
 *   • Active-planting portion  → full rate × active_fraction
 *   • Natural-regen portion    → full rate × regen_fraction × natural_regen_discount (0.7)
 * Rhododendron clearance applies to the % of site affected (100% by default for PAWS).
 *
 * @returns {{ fencing_grant, tree_protection_grant, restocking_grant,
 *             rhododendron_grant, total_fgs, items, annual_items }}
 */
export function fgsGrants(inputs, constants) {
  const m = runModel(inputs, constants);
  const out = {
    fencing_grant: 0, tree_protection_grant: 0, restocking_grant: 0, rhododendron_grant: 0,
  };
  let total = 0;
  for (const g of m.grants.year1) {
    const legacy = LEGACY_ROLE_KEYS[g.role];
    if (legacy) out[legacy] += g.amount;
    total += g.amount;
  }
  return {
    ...out,
    total_fgs:    total,
    items:        m.grants.year1,
    annual_items: m.grants.annual,
  };
}

// ─────────────────────────────────────────────────
// esgIncome
// ─────────────────────────────────────────────────

/**
 * ESG / private BNG income. £/ha for area types, £/m for hedgerows.
 * @returns {number}
 */
export function esgIncome(inputs) {
  return inputs.hectares * inputs.esg_per_ha;
}

// ─────────────────────────────────────────────────
// grossInflow
// ─────────────────────────────────────────────────

/**
 * Gross inflow = timberRevenue + fgsGrants.total_fgs + esgIncome
 * @returns {number}
 */
export function grossInflow(inputs, constants) {
  return timberRevenue(inputs, constants)
       + fgsGrants(inputs, constants).total_fgs
       + esgIncome(inputs);
}

// ─────────────────────────────────────────────────
// contractorCosts / diyCosts
// ─────────────────────────────────────────────────

function sumCosts(items, field) {
  return items.reduce((s, i) => s + i[field], 0);
}

function costOf(items, key, field) {
  return items.filter(i => i.key === key).reduce((s, i) => s + i[field], 0);
}

/**
 * Full contractor costs at contractor rates.
 * fencing_cost / planting_cost are kept for compatibility; items lists every line.
 *
 * @returns {{ fencing_cost, planting_cost, total_contractor, items }}
 */
export function contractorCosts(inputs, constants) {
  const items = runModel(inputs, constants).cost_items;
  return {
    fencing_cost:     costOf(items, 'fencing', 'contractor'),
    planting_cost:    costOf(items, 'planting', 'contractor') + costOf(items, 'guards', 'contractor'),
    total_contractor: sumCosts(items, 'contractor'),
    items,
  };
}

/**
 * DIY costs — materials only, no contractor labour.
 *
 * @returns {{ fencing_diy, planting_diy, total_diy, items }}
 */
export function diyCosts(inputs, constants) {
  const items = runModel(inputs, constants).cost_items;
  return {
    fencing_diy:  costOf(items, 'fencing', 'diy'),
    planting_diy: costOf(items, 'planting', 'diy') + costOf(items, 'guards', 'diy'),
    total_diy:    sumCosts(items, 'diy'),
    items,
  };
}

// ─────────────────────────────────────────────────
// agentFee
// ─────────────────────────────────────────────────

/**
 * Agent fee = grossInflow × agent_fee_pct (if hire_agent, else 0).
 * Applies to gross inflow only, not contractor costs.
 *
 * @returns {number}
 */
export function agentFee(inputs, constants) {
  if (!inputs.hire_agent) return 0;
  return grossInflow(inputs, constants) * constants.costs.agent_fee_pct;
}

// ─────────────────────────────────────────────────
// grossOutflow
// ─────────────────────────────────────────────────

/**
 * Gross outflow (contractor scenario).
 * = contractorCosts.total_contractor + agentFee
 *
 * @returns {number}
 */
export function grossOutflow(inputs, constants) {
  return contractorCosts(inputs, constants).total_contractor
       + agentFee(inputs, constants);
}

// ─────────────────────────────────────────────────
// netCashYear1
// ─────────────────────────────────────────────────

/**
 * Net cash position Year 1 (contractor scenario).
 * Positive = surplus, negative = deficit.
 *
 * @returns {number}
 */
export function netCashYear1(inputs, constants) {
  return grossInflow(inputs, constants) - grossOutflow(inputs, constants);
}

// ─────────────────────────────────────────────────
// sweatEquitySaving
// ─────────────────────────────────────────────────

/**
 * Sweat equity saving = contractorCosts.total - diyCosts.total
 * @returns {number}
 */
export function sweatEquitySaving(inputs, constants) {
  return contractorCosts(inputs, constants).total_contractor
       - diyCosts(inputs, constants).total_diy;
}

// ─────────────────────────────────────────────────
// fundingMix
// ─────────────────────────────────────────────────

/**
 * Funding mix as integer percentages summing to 100.
 * Negative timber revenue is floored to 0 for the mix display.
 *
 * @returns {{ timber_pct, fgs_pct, esg_pct }}
 */
export function fundingMix(inputs, constants) {
  const timber = Math.max(0, timberRevenue(inputs, constants));
  const fgs    = fgsGrants(inputs, constants).total_fgs;
  const esg    = esgIncome(inputs);
  const total  = timber + fgs + esg;

  if (total === 0) return { timber_pct: 0, fgs_pct: 0, esg_pct: 0 };

  // Round individually; ESG takes the remainder so the sum is exactly 100
  let timber_pct = Math.round((timber / total) * 100);
  let fgs_pct    = Math.round((fgs    / total) * 100);
  let esg_pct    = 100 - timber_pct - fgs_pct;

  return { timber_pct, fgs_pct, esg_pct };
}

// ─────────────────────────────────────────────────
// longTermProjection
// ─────────────────────────────────────────────────

function ltvStreams(ltv) {
  return {
    firewood:        ltv.firewood        ?? ltv.firewood_biomass_per_ha_yr      ?? 0,
    sporting:        ltv.sporting        ?? ltv.sporting_rights_per_ha_yr       ?? 0,
    natural_capital: ltv.natural_capital ?? ltv.natural_capital_audit_per_ha_yr ?? 0,
    bng:             ltv.bng             ?? ltv.bng_credit_annual_per_ha        ?? 0,
  };
}

/**
 * 15-year annual value projection.
 * Value streams are per ha (area types) or per km (hedgerows), phased:
 *   Year  1–3:  0%   (establishment)
 *   Year  4–7:  20%  (early canopy)
 *   Year  8–12: 60%  (maturing woodland)
 *   Year 13–15: 100% (mature values)
 * Annual maintenance/management grants (e.g. FGS 5-year maintenance, AECS hedgerow
 * management) are added as their own stream for the years they are paid.
 *
 * @returns {Array<{ year, firewood, sporting, natural_capital, bng, annual_grants, total }>}
 */
export function longTermProjection(inputs, constants) {
  const m       = runModel(inputs, constants);
  const profile = m.profile;
  const ltv     = ltvStreams(profile.long_term_values ?? constants.long_term_values);
  const scale   = isLinear(profile) ? m.quantities.length_m / 1000 : m.quantities.ha;

  const mature = {
    firewood:        scale * ltv.firewood,
    sporting:        scale * ltv.sporting,
    natural_capital: scale * ltv.natural_capital,
    bng:             scale * ltv.bng,
  };
  const matureTotal = mature.firewood + mature.sporting
                    + mature.natural_capital + mature.bng;

  const phaseFactor = yr => {
    if (yr <= 3)  return 0;
    if (yr <= 7)  return 0.2;
    if (yr <= 12) return 0.6;
    return 1.0;
  };

  return Array.from({ length: 15 }, (_, i) => {
    const year = i + 1;
    const f    = phaseFactor(year);
    const annual_grants = Math.round(
      m.grants.annual.filter(g => year <= g.years).reduce((s, g) => s + g.amount, 0));
    return {
      year,
      firewood:        Math.round(mature.firewood        * f),
      sporting:        Math.round(mature.sporting        * f),
      natural_capital: Math.round(mature.natural_capital * f),
      bng:             Math.round(mature.bng             * f),
      annual_grants,
      total:           Math.round(matureTotal            * f) + annual_grants,
    };
  });
}

// ─────────────────────────────────────────────────
// breakevenStatus
// ─────────────────────────────────────────────────

/**
 * Breakeven message string.
 *
 * Compares outflow against income sources cumulatively:
 *   'POSITIVE'      — timber alone covers all costs
 *   'GRANTS_NEEDED' — timber + grants covers costs
 *   'ESG_NEEDED'    — timber + grants + ESG covers costs
 *   'DEFICIT'       — all income sources insufficient
 *
 * @returns {string}
 */
export function breakevenStatus(inputs, constants) {
  const timber  = timberRevenue(inputs, constants);
  const grants  = fgsGrants(inputs, constants).total_fgs;
  const esg     = esgIncome(inputs);
  const outflow = grossOutflow(inputs, constants);

  if (timber           >= outflow) return 'POSITIVE';
  if (timber + grants  >= outflow) return 'GRANTS_NEEDED';
  if (timber + grants + esg >= outflow) return 'ESG_NEEDED';
  return 'DEFICIT';
}

// ─────────────────────────────────────────────────
// calculate — master dispatcher
// ─────────────────────────────────────────────────

/**
 * Master function. Takes inputs + constants, returns the shared results object.
 * This is the single call app.js makes on every input change.
 *
 * @param {object} inputs     — includes project_type (defaults to 'paws')
 * @param {object} constants  — from getConstants() / data/constants.json
 * @returns {object}
 */
export function calculate(inputs, constants) {
  const t       = constants.timber;
  const species = inputs.species;
  const m       = runModel(inputs, constants);
  const profile = m.profile;
  const linear  = isLinear(profile);

  // ── Income ──
  const timber_revenue  = timberRevenue(inputs, constants);
  const fgs             = fgsGrants(inputs, constants);
  const esg_income      = esgIncome(inputs);
  const gross_inflow    = timber_revenue + fgs.total_fgs + esg_income;

  // ── Costs ──
  const cc              = contractorCosts(inputs, constants);
  const dc              = diyCosts(inputs, constants);
  const agent_fee       = agentFee(inputs, constants);
  const gross_outflow_contractor = cc.total_contractor + agent_fee;
  const gross_outflow_diy        = dc.total_diy        + agent_fee;

  // ── Net positions ──
  const net_year1_contractor = gross_inflow - gross_outflow_contractor;
  const net_year1_diy        = gross_inflow - gross_outflow_diy;
  const sweat_equity_saving  = sweatEquitySaving(inputs, constants);

  // ── Mix ──
  const funding_mix = fundingMix(inputs, constants);

  // ── Status ──
  const breakeven_status = breakevenStatus(inputs, constants);

  // ── Projection ──
  const projection = longTermProjection(inputs, constants);
  const projection_15yr_total = projection.reduce((sum, yr) => sum + yr.total, 0);

  const timber_enabled  = !linear && (profile.timber_enabled || (profile.timber_optional && inputs.timber_enabled === true));
  const species_label   = profile.species?.[species]?.label ?? t.species[species]?.label ?? species;
  const difficulty_label = timber_enabled ? (t.difficulty_labels[String(inputs.difficulty)] ?? '') : '';
  const sizeText = linear
    ? `${Math.round(m.size).toLocaleString('en-GB')} m`
    : `${inputs.hectares} ha`;
  const summary_label = projectType(inputs) === 'paws'
    ? `${species_label} · ${difficulty_label} · ${inputs.hectares} ha`
    : [profile.label, species_label, difficulty_label, sizeText].filter(Boolean).join(' · ');

  const annual_grants_per_year = fgs.annual_items.reduce((s, g) => s + g.amount, 0);

  return {
    // Input echo
    project_type:      projectType(inputs),
    model:             linear ? 'linear' : 'area',
    unit:              m.unit,
    size:              m.size,
    hectares:          linear ? 0 : inputs.hectares,
    length_m:          linear ? m.size : 0,
    species_label,
    difficulty_label,
    summary_label,
    grant_scheme:      profile.grant_scheme ?? 'FGS',
    timber_enabled,
    quantities:        m.quantities,
    stream_labels:     profile.stream_labels ?? {},

    // Income
    timber_revenue,
    fgs_total:         fgs.total_fgs,
    grants_total:      fgs.total_fgs,
    fgs_breakdown: {
      fencing_grant:         fgs.fencing_grant,
      restocking_grant:      fgs.restocking_grant,
      tree_protection_grant: fgs.tree_protection_grant,
      rhododendron_grant:    fgs.rhododendron_grant,
    },
    grant_items:        fgs.items,
    annual_grant_items: fgs.annual_items,
    annual_grants_per_year,
    esg_income,
    gross_inflow,

    // Costs
    cost_items:          cc.items,
    contractor_fencing:  cc.fencing_cost,
    contractor_planting: cc.planting_cost,
    contractor_total:    cc.total_contractor,
    diy_fencing:         dc.fencing_diy,
    diy_planting:        dc.planting_diy,
    diy_total:           dc.total_diy,
    agent_fee,
    agent_fee_pct:       constants.costs.agent_fee_pct,
    gross_outflow_contractor,
    gross_outflow_diy,

    // Net
    net_year1_contractor,
    net_year1_diy,
    sweat_equity_saving,

    // Mix
    funding_mix,

    // Status
    breakeven_status,

    // Projection
    projection,
    projection_15yr_total,
  };
}

// ─────────────────────────────────────────────────
// UI helper exports (used by app.js for live labels)
// ─────────────────────────────────────────────────

/**
 * suggestPerimeter(hectares) → number
 * Auto-suggest fence perimeter from site area.
 */
export function suggestPerimeter(hectares) {
  return Math.round(Math.sqrt(hectares * 10000) * 4 * 1.2);
}

/**
 * difficultyLabel(level) → string
 * Hardcoded so it's available before constants load.
 */
export function difficultyLabel(level) {
  return {
    1: 'Easy — flat, road access',
    2: 'Moderate — some slope',
    3: 'Challenging — tracked machinery',
    4: 'Difficult — steep terrain',
    5: 'Severe — skyline winching',
  }[level] ?? 'Unknown';
}

/**
 * difficultyClass(level) → CSS modifier string
 */
export function difficultyClass(level) {
  return { 1: 'easy', 2: 'moderate', 3: 'challenging',
           4: 'difficult', 5: 'severe' }[level] ?? 'moderate';
}

/**
 * speciesLabel(key) → display string
 * Handles both snake_case keys (sitka_spruce) and legacy short keys (sitka).
 */
export function speciesLabel(key) {
  return {
    sitka_spruce:  'Sitka Spruce',
    scots_pine:    'Scots Pine',
    larch:         'Larch',
    mixed_conifer: 'Mixed Conifer',
    // legacy short-key fallbacks
    sitka: 'Sitka Spruce',
    scots: 'Scots Pine',
    mixed: 'Mixed Conifer',
  }[key] ?? key;
}

/**
 * speciesIcon(key) → emoji
 */
export function speciesIcon(key) {
  return {
    sitka_spruce:  '🌲',
    scots_pine:    '🌳',
    larch:         '🍂',
    mixed_conifer: '🌿',
    sitka: '🌲',
    scots: '🌳',
    mixed: '🌿',
  }[key] ?? '🌲';
}

/**
 * formatCurrency(value) → string
 * e.g.  12450 → "£12,450"
 *       -4200 → "–£4,200"
 */
export function formatCurrency(value) {
  const abs  = Math.abs(Math.round(value));
  const sign = value < 0 ? '–£' : '£';
  return sign + abs.toLocaleString('en-GB');
}
