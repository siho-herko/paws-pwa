/**
 * calc.js — PAWS Business Case Modeller
 * Pure calculation engine. No DOM access.
 * All functions are exported ES module exports.
 */

// ─────────────────────────────────────────────────
// timberRevenue
// ─────────────────────────────────────────────────

/**
 * Timber revenue after applying difficulty penalty.
 * Returns £ total for the site (can be negative at high difficulty).
 *
 * @param {object} inputs
 * @param {object} constants  — paws_constants.json object
 * @returns {number}
 */
export function timberRevenue(inputs, constants) {
  const { hectares, species, difficulty, override_yield } = inputs;
  const t = constants.timber;

  const yieldPerHa     = override_yield ?? t.yield_tons_per_ha;
  const pricePerTon    = t.species[species]?.price_per_ton ?? 25;
  const penalty        = t.difficulty_penalty_per_ton[String(difficulty)] ?? 0;
  const netPricePerTon = pricePerTon - penalty;

  return hectares * yieldPerHa * netPricePerTon;
}

// ─────────────────────────────────────────────────
// fgsGrants
// ─────────────────────────────────────────────────

/**
 * FGS grant breakdown.
 *
 * Restocking grant is pro-rated:
 *   • Active-planting portion  → full rate × active_fraction
 *   • Natural-regen portion    → full rate × regen_fraction × natural_regen_discount (0.7)
 * Rhododendron clearance always applies to 100% of site ha.
 *
 * @returns {{ fencing_grant, tree_protection_grant, restocking_grant,
 *             rhododendron_grant, total_fgs }}
 */
export function fgsGrants(inputs, constants) {
  const { hectares, fencing_m, natural_regen_pct,
          override_fencing_grant, override_restocking_grant } = inputs;
  const g = constants.fgs_grants;
  const c = constants.costs;

  const activeFraction  = (100 - natural_regen_pct) / 100;
  const regenFraction   = natural_regen_pct / 100;
  const treesToPlant    = hectares * c.trees_per_ha * activeFraction;

  // Fencing grant (£/m)
  const fencingRate     = override_fencing_grant ?? g.deer_fencing_grant_per_m;
  const fencing_grant   = fencing_m * fencingRate;

  // Tree protection grant (stakes + guards, per actively-planted tree)
  const tree_protection_grant = treesToPlant * g.tree_protection_per_tree;

  // Restocking grant — pro-rated by planting method
  const restockingRate  = override_restocking_grant ?? g.restocking_grant_per_ha;
  const activePart      = hectares * activeFraction * restockingRate;
  const regenPart       = hectares * regenFraction  * restockingRate * g.natural_regen_discount;
  const restocking_grant = activePart + regenPart;

  // Rhododendron / invasive clearance — always 100% of site
  const rhododendron_grant = hectares * g.rhododendron_clearance_per_ha;

  const total_fgs = fencing_grant + tree_protection_grant
                  + restocking_grant + rhododendron_grant;

  return { fencing_grant, tree_protection_grant, restocking_grant,
           rhododendron_grant, total_fgs };
}

// ─────────────────────────────────────────────────
// esgIncome
// ─────────────────────────────────────────────────

/**
 * ESG / private BNG income.
 * Returns £ total for the site.
 *
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
// contractorCosts
// ─────────────────────────────────────────────────

/**
 * Full contractor costs — fencing + planting at contractor rates.
 *
 * @returns {{ fencing_cost, planting_cost, total_contractor }}
 */
export function contractorCosts(inputs, constants) {
  const { hectares, fencing_m, natural_regen_pct } = inputs;
  const c = constants.costs;

  const activeFraction = (100 - natural_regen_pct) / 100;
  const treesToPlant   = hectares * c.trees_per_ha * activeFraction;

  const fencing_cost  = fencing_m * c.fencing_contractor_per_m;
  const planting_cost = treesToPlant * c.tree_cost_each;

  return { fencing_cost, planting_cost, total_contractor: fencing_cost + planting_cost };
}

// ─────────────────────────────────────────────────
// diyCosts
// ─────────────────────────────────────────────────

/**
 * DIY costs — materials only, no contractor labour.
 *
 * @returns {{ fencing_diy, planting_diy, total_diy }}
 */
export function diyCosts(inputs, constants) {
  const { hectares, fencing_m, natural_regen_pct } = inputs;
  const c = constants.costs;

  const activeFraction = (100 - natural_regen_pct) / 100;
  const treesToPlant   = hectares * c.trees_per_ha * activeFraction;

  const fencing_diy  = fencing_m * c.diy_fencing_per_m;
  const planting_diy = treesToPlant * c.diy_planting_per_tree;

  return { fencing_diy, planting_diy, total_diy: fencing_diy + planting_diy };
}

// ─────────────────────────────────────────────────
// agentFee
// ─────────────────────────────────────────────────

/**
 * Agent fee = grossInflow × 12% (if hire_agent, else 0).
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
 * Funding mix as percentages summing to 100.
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

  // Round individually and adjust the largest to ensure sum = 100
  let timber_pct = Math.round((timber / total) * 100);
  let fgs_pct    = Math.round((fgs    / total) * 100);
  let esg_pct    = 100 - timber_pct - fgs_pct;

  return { timber_pct, fgs_pct, esg_pct };
}

// ─────────────────────────────────────────────────
// longTermProjection
// ─────────────────────────────────────────────────

/**
 * 15-year annual value projection.
 * Phases:
 *   Year  1–3:  0%   (establishment)
 *   Year  4–7:  20%  (early canopy)
 *   Year  8–12: 60%  (maturing woodland)
 *   Year 13–15: 100% (mature broadleaf values)
 *
 * @returns {Array<{ year, firewood, sporting, natural_capital, bng, total }>}
 */
export function longTermProjection(inputs, constants) {
  const { hectares } = inputs;
  const ltv = constants.long_term_values;

  const mature = {
    firewood:        hectares * ltv.firewood_biomass_per_ha_yr,
    sporting:        hectares * ltv.sporting_rights_per_ha_yr,
    natural_capital: hectares * ltv.natural_capital_audit_per_ha_yr,
    bng:             hectares * ltv.bng_credit_annual_per_ha,
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
    return {
      year,
      firewood:        Math.round(mature.firewood        * f),
      sporting:        Math.round(mature.sporting        * f),
      natural_capital: Math.round(mature.natural_capital * f),
      bng:             Math.round(mature.bng             * f),
      total:           Math.round(matureTotal            * f),
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
// calculate — master function
// ─────────────────────────────────────────────────

/**
 * Master function. Takes inputs + constants, returns full results object.
 * This is the single call app.js makes on every input change.
 *
 * @param {object} inputs
 * @param {object} constants  — from getConstants() / paws_constants.json
 * @returns {object}  Full results (see shape in Prompt 3 spec)
 */
export function calculate(inputs, constants) {
  const t       = constants.timber;
  const species = inputs.species;

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

  return {
    // Input echo
    hectares:          inputs.hectares,
    species_label:     t.species[species]?.label ?? species,
    difficulty_label:  t.difficulty_labels[String(inputs.difficulty)] ?? '',

    // Income
    timber_revenue,
    fgs_total:         fgs.total_fgs,
    fgs_breakdown: {
      fencing_grant:         fgs.fencing_grant,
      restocking_grant:      fgs.restocking_grant,
      tree_protection_grant: fgs.tree_protection_grant,
      rhododendron_grant:    fgs.rhododendron_grant,
    },
    esg_income,
    gross_inflow,

    // Costs
    contractor_fencing: cc.fencing_cost,
    contractor_planting: cc.planting_cost,
    contractor_total:   cc.total_contractor,
    diy_fencing:        dc.fencing_diy,
    diy_planting:       dc.planting_diy,
    diy_total:          dc.total_diy,
    agent_fee,
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
 * Auto-suggest deer fence perimeter from site area.
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
