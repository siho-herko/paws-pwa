// tests/calc.test.js
import {
  calculate, timberRevenue, fgsGrants, esgIncome, grossInflow,
  contractorCosts, diyCosts, agentFee, grossOutflow, netCashYear1,
  sweatEquitySaving, fundingMix, longTermProjection, breakevenStatus
} from '../calc.js';
import { decodeState, encodeState, defaultState, buildInputs, patchConstants } from '../state.js';
import { readFileSync } from 'fs';

const constants = JSON.parse(readFileSync('./data/constants.json', 'utf8'));

let passed = 0, failed = 0;
function assert(condition, label, expected, actual) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}  →  expected: ${expected}  got: ${actual}`);
    failed++;
  }
}
function near(a, b, tol = 1.0) { return Math.abs(a - b) <= tol; }
function pct(a, b, tol = 0.5)  { return Math.abs(a - b) <= tol; }

// ── TC1: Default 4ha Sitka, diff=1, 400m fence, 40% regen ──────────────────

console.log('\n=== TC1: Default 4ha Sitka, diff=1, 400m fence, 40% regen ===');
const tc1 = { hectares:4, species:'sitka_spruce', difficulty:1, fencing_m:400,
               natural_regen_pct:40, esg_per_ha:750, hire_agent:false,
               override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const r1 = calculate(tc1, constants);

assert(near(r1.timber_revenue, 35000),                    'TC1 timber_revenue',              35000,    r1.timber_revenue);
assert(near(r1.fgs_breakdown.fencing_grant, 3960),        'TC1 fgs_fencing_grant',           3960,     r1.fgs_breakdown.fencing_grant);
assert(near(r1.fgs_breakdown.restocking_grant, 8448),     'TC1 fgs_restocking_grant',        8448,     r1.fgs_breakdown.restocking_grant);
assert(near(r1.fgs_breakdown.tree_protection_grant, 10560),'TC1 fgs_tree_protection',        10560,    r1.fgs_breakdown.tree_protection_grant);
assert(near(r1.fgs_breakdown.rhododendron_grant, 6000),   'TC1 fgs_rhododendron',            6000,     r1.fgs_breakdown.rhododendron_grant);
assert(near(r1.fgs_total, 28968),                         'TC1 fgs_total',                   28968,    r1.fgs_total);
assert(near(r1.esg_income, 3000),                         'TC1 esg_income',                  3000,     r1.esg_income);
assert(near(r1.gross_inflow, 66968),                      'TC1 gross_inflow',                66968,    r1.gross_inflow);
assert(near(r1.contractor_fencing, 4800),                 'TC1 contractor_fencing',          4800,     r1.contractor_fencing);
assert(near(r1.contractor_planting, 12000),               'TC1 contractor_planting',         12000,    r1.contractor_planting);
assert(r1.agent_fee === 0,                                'TC1 agent_fee zero (no agent)',    0,        r1.agent_fee);
assert(near(r1.gross_outflow_contractor, 16800),          'TC1 gross_outflow_contractor',    16800,    r1.gross_outflow_contractor);
assert(near(r1.net_year1_contractor, 50168),              'TC1 net_year1_contractor',        50168,    r1.net_year1_contractor);
assert(near(r1.diy_fencing, 3000),                        'TC1 diy_fencing',                 3000,     r1.diy_fencing);
assert(near(r1.diy_planting, 3840),                       'TC1 diy_planting',                3840,     r1.diy_planting);
assert(near(r1.net_year1_diy, 60128),                     'TC1 net_year1_diy',               60128,    r1.net_year1_diy);
assert(near(r1.sweat_equity_saving, 9960),                'TC1 sweat_equity_saving',         9960,     r1.sweat_equity_saving);
assert(pct(r1.funding_mix.timber_pct, 52.3),              'TC1 funding_mix timber%',         '52.3%',  r1.funding_mix.timber_pct);
assert(pct(r1.funding_mix.fgs_pct, 43.3),                 'TC1 funding_mix fgs%',            '43.3%',  r1.funding_mix.fgs_pct);
assert(r1.breakeven_status === 'POSITIVE',                'TC1 breakeven POSITIVE',          'POSITIVE', r1.breakeven_status);

// ── TC2: Difficulty 5 Sitka — timber negative, grants rescue ───────────────

console.log('\n=== TC2: Difficulty 5 Sitka — timber negative, grants rescue ===');
const tc2 = { hectares:4, species:'sitka_spruce', difficulty:5, fencing_m:400,
               natural_regen_pct:40, esg_per_ha:750, hire_agent:false,
               override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const r2 = calculate(tc2, constants);

assert(near(r2.timber_revenue, -7000),           'TC2 timber_revenue negative',                              -7000,  r2.timber_revenue);
assert(near(r2.fgs_total, 28968),                'TC2 fgs_total unchanged',                                  28968,  r2.fgs_total);
assert(near(r2.gross_inflow, 24968),             'TC2 gross_inflow (timber negative but grants positive)',    24968,  r2.gross_inflow);
assert(near(r2.net_year1_contractor, 8168),      'TC2 net_year1_contractor still positive',                  8168,   r2.net_year1_contractor);
assert(r2.breakeven_status === 'GRANTS_NEEDED',  'TC2 breakeven GRANTS_NEEDED',                              'GRANTS_NEEDED', r2.breakeven_status);

// ── TC3: Larch diff=1 — peak timber value ──────────────────────────────────

console.log('\n=== TC3: Larch diff=1 — peak timber value ===');
const tc3 = { hectares:4, species:'larch', difficulty:1, fencing_m:400,
               natural_regen_pct:40, esg_per_ha:750, hire_agent:false,
               override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const r3 = calculate(tc3, constants);

assert(near(r3.timber_revenue, 49000),          'TC3 timber_revenue Larch',     49000,  r3.timber_revenue);
assert(near(r3.gross_inflow, 80968),            'TC3 gross_inflow',             80968,  r3.gross_inflow);
assert(near(r3.net_year1_contractor, 64168),    'TC3 net_year1_contractor',     64168,  r3.net_year1_contractor);
assert(r3.breakeven_status === 'POSITIVE',      'TC3 breakeven POSITIVE',       'POSITIVE', r3.breakeven_status);
assert(r3.net_year1_contractor > r1.net_year1_contractor, 'TC3 Larch > Sitka net', 'Larch > Sitka', '');

// ── TC4: Zero fencing ──────────────────────────────────────────────────────

console.log('\n=== TC4: Zero fencing ===');
const tc4 = { hectares:4, species:'sitka_spruce', difficulty:2, fencing_m:0,
               natural_regen_pct:40, esg_per_ha:0, hire_agent:false,
               override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const r4 = calculate(tc4, constants);

assert(r4.fgs_breakdown.fencing_grant === 0,    'TC4 fencing_grant is zero',        0,      r4.fgs_breakdown.fencing_grant);
assert(r4.contractor_fencing === 0,             'TC4 contractor_fencing is zero',   0,      r4.contractor_fencing);
assert(r4.diy_fencing === 0,                   'TC4 diy_fencing is zero',           0,      r4.diy_fencing);
assert(near(r4.gross_inflow, 53008),            'TC4 gross_inflow no fence',        53008,  r4.gross_inflow);
assert(near(r4.net_year1_contractor, 41008),    'TC4 net_year1_contractor no fence',41008,  r4.net_year1_contractor);

// ── TC5: 100% natural regen — zero planting ────────────────────────────────

console.log('\n=== TC5: 100% natural regen — zero planting ===');
const tc5 = { hectares:4, species:'sitka_spruce', difficulty:2, fencing_m:400,
               natural_regen_pct:100, esg_per_ha:0, hire_agent:false,
               override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const r5 = calculate(tc5, constants);

assert(r5.fgs_breakdown.tree_protection_grant === 0, 'TC5 tree_protection_grant zero', 0,    r5.fgs_breakdown.tree_protection_grant);
assert(r5.contractor_planting === 0,                 'TC5 contractor_planting zero',   0,    r5.contractor_planting);
assert(r5.diy_planting === 0,                        'TC5 diy_planting zero',          0,    r5.diy_planting);
assert(near(r5.fgs_breakdown.restocking_grant, 6720),'TC5 restocking_grant at 70%',    6720, r5.fgs_breakdown.restocking_grant);
assert(near(r5.sweat_equity_saving, 1800),           'TC5 sweat_equity_saving fencing only', 1800, r5.sweat_equity_saving);
assert(near(r5.net_year1_contractor, 39880),         'TC5 net_year1_contractor',       39880, r5.net_year1_contractor);

// ── TC6: Agent hired — fee reduces net ─────────────────────────────────────

console.log('\n=== TC6: Agent hired — fee reduces net ===');
const tc6 = { hectares:4, species:'sitka_spruce', difficulty:2, fencing_m:400,
               natural_regen_pct:40, esg_per_ha:750, hire_agent:true,
               override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const r6 = calculate(tc6, constants);

assert(near(r6.gross_inflow, 59968),                    'TC6 gross_inflow diff=2',              59968,      r6.gross_inflow);
assert(near(r6.agent_fee, 7196.16, 0.10),               'TC6 agent_fee 12%',                    7196.16,    r6.agent_fee);
assert(near(r6.net_year1_contractor, 35971.84, 1.0),    'TC6 net_year1_contractor with agent',  35971.84,   r6.net_year1_contractor);
assert(r6.net_year1_contractor < r1.net_year1_contractor, 'TC6 agent reduces net vs no-agent diff=1', '', '');

// ── TC7: Minimum site 0.5ha ────────────────────────────────────────────────

console.log('\n=== TC7: Minimum site 0.5ha ===');
const tc7 = { hectares:0.5, species:'scots_pine', difficulty:3, fencing_m:100,
               natural_regen_pct:50, esg_per_ha:500, hire_agent:false,
               override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const r7 = calculate(tc7, constants);

assert(near(r7.timber_revenue, 4375),           'TC7 timber_revenue 0.5ha',             4375,   r7.timber_revenue);
assert(near(r7.fgs_total, 3860),                'TC7 fgs_total 0.5ha',                  3860,   r7.fgs_total);
assert(near(r7.net_year1_contractor, 6035),     'TC7 net_year1_contractor 0.5ha',       6035,   r7.net_year1_contractor);
assert(!isNaN(r7.net_year1_contractor),         'TC7 no NaN at boundary',               'number', 'NaN');
assert(isFinite(r7.net_year1_contractor),       'TC7 no Infinity at boundary',          'finite', 'Infinity');

// ── TC8: Maximum site 20ha ─────────────────────────────────────────────────

console.log('\n=== TC8: Maximum site 20ha ===');
const tc8 = { hectares:20, species:'mixed_conifer', difficulty:2, fencing_m:1800,
               natural_regen_pct:20, esg_per_ha:1000, hire_agent:false,
               override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const r8 = calculate(tc8, constants);

assert(near(r8.timber_revenue, 175000),         'TC8 timber_revenue 20ha',              175000, r8.timber_revenue);
assert(near(r8.net_year1_contractor, 256740),   'TC8 net_year1_contractor 20ha',        256740, r8.net_year1_contractor);
assert(near(r8.sweat_equity_saving, 62500),     'TC8 sweat_equity_saving 20ha',         62500,  r8.sweat_equity_saving);
assert(!isNaN(r8.gross_inflow),                 'TC8 no NaN at max size',               '',     '');

// ── TC9: Advanced override — yield 500 t/ha ───────────────────────────────

console.log('\n=== TC9: Advanced override — yield 500 t/ha ===');
const tc9 = { ...tc1, override_yield: 500 };
const r9 = calculate(tc9, constants);

assert(near(r9.timber_revenue, 50000),          'TC9 override_yield 500 t/ha',          50000,  r9.timber_revenue);
assert(r9.timber_revenue > r1.timber_revenue,   'TC9 override increases timber vs default', '', '');

// ── TC10: 15-year projection ───────────────────────────────────────────────

console.log('\n=== TC10: 15-year projection ===');
const proj = r1.projection;  // from TC1 (4ha)

assert(proj.length === 15,              'projection has 15 years',                 15,     proj.length);
assert(proj[0].total === 0,             'Year 1 total = 0 (establishment)',         0,      proj[0].total);
assert(proj[1].total === 0,             'Year 2 total = 0',                         0,      proj[1].total);
assert(proj[2].total === 0,             'Year 3 total = 0',                         0,      proj[2].total);
assert(near(proj[3].total, 744),        'Year 4 total = 20% mature × 4ha',         744,    proj[3].total);
assert(near(proj[6].total, 744),        'Year 7 total = 20% mature × 4ha',         744,    proj[6].total);
assert(near(proj[7].total, 2232),       'Year 8 total = 60% mature × 4ha',         2232,   proj[7].total);
assert(near(proj[12].total, 3720),      'Year 13 total = 100% mature × 4ha',       3720,   proj[12].total);
assert(near(proj[14].total, 3720),      'Year 15 total = 100% mature × 4ha',       3720,   proj[14].total);
assert(near(r1.projection_15yr_total, 25296, 10), 'projection_15yr_total',         25296,  r1.projection_15yr_total);
assert(proj[14].firewood >= 0,          'firewood non-negative',                   '≥0',   proj[14].firewood);
assert(proj[14].sporting >= 0,          'sporting non-negative',                   '≥0',   proj[14].sporting);
assert(proj[14].natural_capital >= 0,   'natural_capital non-negative',            '≥0',   proj[14].natural_capital);
assert(proj[14].bng >= 0,              'bng non-negative',                         '≥0',   proj[14].bng);

// ── TC11: NaN sweep across all results ────────────────────────────────────

console.log('\n=== TC11: NaN sweep across all results ===');
const allResults = [r1, r2, r3, r4, r5, r6, r7, r8, r9];
const numericKeys = [
  'timber_revenue','fgs_total','esg_income','gross_inflow',
  'contractor_fencing','contractor_planting','contractor_total',
  'diy_fencing','diy_planting','diy_total',
  'agent_fee','gross_outflow_contractor','gross_outflow_diy',
  'net_year1_contractor','net_year1_diy','sweat_equity_saving','projection_15yr_total',
];
for (let i = 0; i < allResults.length; i++) {
  for (const key of numericKeys) {
    const v = allResults[i][key];
    assert(!isNaN(v),    `TC${i+1}.${key} not NaN`,   'number', String(v));
    assert(isFinite(v),  `TC${i+1}.${key} finite`,    'finite', String(v));
  }
}

// ── TC1b: funding mix is integer and sums to exactly 100 ──────────────────

console.log('\n=== TC1b: funding mix integers sum to 100 ===');
for (const [i, r] of [r1, r2, r3, r4, r5, r6, r7, r8, r9].entries()) {
  const m = r.funding_mix;
  assert(Number.isInteger(m.timber_pct) && Number.isInteger(m.fgs_pct) && Number.isInteger(m.esg_pct),
    `TC${i+1} funding_mix are integers`, 'integers', JSON.stringify(m));
  assert(m.timber_pct + m.fgs_pct + m.esg_pct === 100 || (m.timber_pct + m.fgs_pct + m.esg_pct === 0),
    `TC${i+1} funding_mix sums to 100`, 100, m.timber_pct + m.fgs_pct + m.esg_pct);
}
assert(r1.funding_mix.timber_pct === 52 && r1.funding_mix.fgs_pct === 43 && r1.funding_mix.esg_pct === 5,
  'TC1 funding_mix exact 52/43/5', '52/43/5', JSON.stringify(r1.funding_mix));

// ── TC12: PAWS regression — explicit project_type matches legacy inputs ────

console.log('\n=== TC12: project_type paws equals legacy inputs ===');
const r12 = calculate({ ...tc1, project_type: 'paws' }, constants);
assert(near(r12.net_year1_contractor, r1.net_year1_contractor, 0.001), 'TC12 net identical', r1.net_year1_contractor, r12.net_year1_contractor);
assert(near(r12.fgs_total, 28968, 0.001), 'TC12 fgs_total 28968 (rhodo on at 100% by default)', 28968, r12.fgs_total);
const r12b = calculate({ ...tc1, rhodo_enabled: false }, constants);
assert(r12b.fgs_breakdown.rhododendron_grant === 0, 'TC12 PAWS rhodo toggle off removes grant', 0, r12b.fgs_breakdown.rhododendron_grant);
assert(near(r12b.fgs_total, 22968, 0.001), 'TC12 PAWS fgs_total without rhodo', 22968, r12b.fgs_total);
const r12c = calculate({ ...tc1, rhodo_pct: 50 }, constants);
assert(near(r12c.fgs_breakdown.rhododendron_grant, 3000, 0.001), 'TC12 PAWS rhodo 50% of area', 3000, r12c.fgs_breakdown.rhododendron_grant);
assert(r1.cost_items.length === 2, 'TC12 PAWS has no extra cost lines', 2, r1.cost_items.length);

// ── Area-type helpers ──────────────────────────────────────────────────────

const areaBase = { hectares:4, difficulty:2, fencing_m:400, natural_regen_pct:40, esg_per_ha:1000,
                   hire_agent:false, override_yield:null, override_fencing_grant:null, override_restocking_grant:null };
const profileInputs = type => ({ ...areaBase, ...constants.profiles[type].defaults, project_type: type });

// ── TC13: native woodland ──────────────────────────────────────────────────

console.log('\n=== TC13: native woodland — zero timber by default, optional timber, rhodo toggle ===');
const nw = profileInputs('native_woodland');
const r13 = calculate(nw, constants);
assert(r13.timber_revenue === 0 && r13.timber_enabled === false, 'TC13 zero timber by default', 0, r13.timber_revenue);
assert(r13.funding_mix.timber_pct === 0, 'TC13 timber share of mix is 0', 0, r13.funding_mix.timber_pct);
// 4ha, 70% regen: trees = 4*1100*0.3 = 1320; regen ha = 2.8; rhodo 20% = 0.8ha
assert(near(r13.grant_items.find(g => g.key === 'planting_grant').amount, 1320 * 3.00),  'TC13 planting grant', 3960, r13.grant_items.find(g => g.key === 'planting_grant').amount);
assert(near(r13.grant_items.find(g => g.key === 'regen_grant').amount, 2.8 * 300),        'TC13 regen grant', 840, r13.grant_items.find(g => g.key === 'regen_grant').amount);
assert(near(r13.grant_items.find(g => g.key === 'rhododendron_grant').amount, 0.8 * 3400),'TC13 rhodo grant on 20% of area', 2720, r13.grant_items.find(g => g.key === 'rhododendron_grant').amount);
assert(near(r13.annual_grants_per_year, 4 * 25), 'TC13 SMF native annual grant', 100, r13.annual_grants_per_year);
const r13off = calculate({ ...nw, rhodo_enabled: false }, constants);
assert(r13off.fgs_breakdown.rhododendron_grant === 0, 'TC13 rhodo off => no rhodo grant', 0, r13off.fgs_breakdown.rhododendron_grant);
assert(near(r13.contractor_total - r13off.contractor_total, 0.8 * 3000), 'TC13 rhodo off removes 0.8 ha of clearance cost', 2400, r13.contractor_total - r13off.contractor_total);
const r13t = calculate({ ...nw, timber_enabled: true }, constants);
assert(near(r13t.timber_revenue, 4 * 60 * (30 - 5)), 'TC13 optional standing timber when entered', 6000, r13t.timber_revenue);
assert(near(r13t.gross_inflow - r13.gross_inflow, 6000), 'TC13 timber adds to inflow', 6000, r13t.gross_inflow - r13.gross_inflow);

// ── TC14: new woodland ─────────────────────────────────────────────────────

console.log('\n=== TC14: new native woodland (FGS Woodland Creation) ===');
const r14 = calculate(profileInputs('new_woodland'), constants);
assert(near(r14.grant_items.find(g => g.key === 'wc_initial').amount, 4 * 1840), 'TC14 initial planting grant 4ha x £1,840', 7360, r14.grant_items.find(g => g.key === 'wc_initial').amount);
assert(near(r14.annual_grants_per_year, 4 * 272), 'TC14 annual maintenance £272/ha', 1088, r14.annual_grants_per_year);
assert(near(r14.fgs_breakdown.fencing_grant, 960 * 7.60), 'TC14 deer fence £7.60/m', 7296, r14.fgs_breakdown.fencing_grant);
assert(r14.timber_revenue === 0, 'TC14 no timber', 0, r14.timber_revenue);
assert(r14.fgs_breakdown.rhododendron_grant === 0, 'TC14 no rhodo grant', 0, r14.fgs_breakdown.rhododendron_grant);
const r14r = calculate({ ...profileInputs('new_woodland'), natural_regen_pct: 100 }, constants);
assert(r14r.contractor_planting === 0 && near(r14r.grant_items.find(g => g.key === 'wc_initial').amount, 0), 'TC14 100% regen: no planting cost or initial grant', 0, r14r.contractor_planting);
assert(near(r14r.grant_items.find(g => g.key === 'regen_grant').amount, 4 * 300), 'TC14 100% regen pays regen grant', 1200, r14r.grant_items.find(g => g.key === 'regen_grant').amount);

// ── TC15: wood pasture ─────────────────────────────────────────────────────

console.log('\n=== TC15: wood pasture ===');
const r15 = calculate(profileInputs('wood_pasture'), constants);
assert(near(r15.grant_items.find(g => g.key === 'standard_trees').amount, 6 * 40 * 100), 'TC15 standard trees 240 x £100', 24000, r15.grant_items.find(g => g.key === 'standard_trees').amount);
assert(near(r15.grant_items.find(g => g.key === 'grazing_plan').amount, 1200), 'TC15 grazing plan £1,200', 1200, r15.grant_items.find(g => g.key === 'grazing_plan').amount);
assert(near(r15.annual_grants_per_year, 6 * 100), 'TC15 woodland grazing £100/ha/yr', 600, r15.annual_grants_per_year);
assert(r15.timber_revenue === 0, 'TC15 no timber', 0, r15.timber_revenue);

// ── TC16: agroforestry (low density) ───────────────────────────────────────

console.log('\n=== TC16: agroforestry density tiers ===');
const af = profileInputs('agroforestry');
const cAf = (tph) => patchConstants({ ...defaultState('agroforestry', constants), adv_trees_per_ha: tph }, constants);
const r16 = calculate(af, constants);   // 200 trees/ha, 5 ha
assert(near(r16.fgs_total, 5 * 2790), 'TC16 150-200 tph pays £2,790/ha', 13950, r16.fgs_total);
assert(near(r16.annual_grants_per_year, 5 * 72), 'TC16 annual £72/ha', 360, r16.annual_grants_per_year);
assert(near(r16.quantities.trees, 1000), 'TC16 trees = 5ha x 200', 1000, r16.quantities.trees);
const r16h = calculate(af, cAf(350));
assert(near(r16h.fgs_total, 5 * 5400) && near(r16h.annual_grants_per_year, 5 * 126), 'TC16 300-400 tph pays high rate', 27000, r16h.fgs_total);
const r16mid = calculate(af, cAf(250));
assert(near(r16mid.fgs_total, 5 * 2790), 'TC16 201-299 tph is modelled at the lower rate', 13950, r16mid.fgs_total);
const r16low = calculate(af, cAf(100));
assert(near(r16low.fgs_total, 0), 'TC16 below 150 tph pays nothing', 0, r16low.fgs_total);
assert(r16.timber_revenue === 0, 'TC16 no timber', 0, r16.timber_revenue);

// ── Hedgerow ───────────────────────────────────────────────────────────────

const hedge = (over = {}) => ({ project_type:'hedgerow', length_m:400, hedge_mode:'restore', gap_pct:0, plants_per_m:6,
  lay_m:0, coppice_m:0, stock_fence_m:0, guards:'none', esg_per_m:0, hire_agent:false,
  override_fencing_grant:null, override_restocking_grant:null, ...over });

console.log('\n=== TC17: hedgerow gapping only ===');
const r17 = calculate(hedge({ gap_pct: 25, guards: 'rabbit' }), constants);   // 100 m gaps, 600 plants
assert(near(r17.quantities.plant_m, 100) && near(r17.quantities.plants, 600), 'TC17 100 m gaps => 600 plants', 600, r17.quantities.plants);
assert(near(r17.grant_items.find(g => g.key === 'hedge_planting').amount, 100 * 5.40), 'TC17 planting grant £5.40/m', 540, r17.grant_items.find(g => g.key === 'hedge_planting').amount);
assert(near(r17.grant_items.find(g => g.key === 'rabbit_guards').amount, 100 * 1.80), 'TC17 rabbit guard grant £1.80/m', 180, r17.grant_items.find(g => g.key === 'rabbit_guards').amount);
assert(near(r17.annual_grants_per_year, 400 * 0.11), 'TC17 AECS management £0.11/m/yr on full length', 44, r17.annual_grants_per_year);
assert(near(r17.contractor_planting, 600 * 1.60 + 600 * 0.95), 'TC17 contractor planting + guards', 1530, r17.contractor_planting);
assert(near(r17.diy_planting, 600 * 0.60 + 600 * 0.55), 'TC17 DIY planting + guards', 690, r17.diy_planting);
assert(r17.timber_revenue === 0 && r17.timber_enabled === false, 'TC17 no timber', 0, r17.timber_revenue);
assert(r17.model === 'linear' && r17.length_m === 400 && r17.hectares === 0, 'TC17 linear result echo', 'linear', r17.model);
assert(r17.grant_scheme === 'AECS', 'TC17 grant scheme AECS', 'AECS', r17.grant_scheme);

console.log('\n=== TC18: hedgerow laying + coppicing ===');
const r18 = calculate(hedge({ lay_m: 150, coppice_m: 100, stock_fence_m: 400 }), constants);
assert(near(r18.grant_items.find(g => g.key === 'hedge_laying').amount, 150 * 12.50), 'TC18 laying grant £12.50/m', 1875, r18.grant_items.find(g => g.key === 'hedge_laying').amount);
assert(near(r18.grant_items.find(g => g.key === 'hedge_coppicing').amount, 100 * 3.75), 'TC18 coppicing grant £3.75/m', 375, r18.grant_items.find(g => g.key === 'hedge_coppicing').amount);
assert(near(r18.fgs_breakdown.fencing_grant, 400 * 5.50), 'TC18 stock fence grant £5.50/m', 2200, r18.fgs_breakdown.fencing_grant);
assert(r18.quantities.plants === 0 && r18.grant_items.find(g => g.key === 'hedge_planting').amount === 0, 'TC18 no gaps => no planting grant', 0, r18.quantities.plants);
const lay = r18.cost_items.find(i => i.key === 'laying'), cop = r18.cost_items.find(i => i.key === 'coppicing');
assert(near(lay.contractor, 150 * 16) && near(lay.diy, 150 * 3), 'TC18 laying contractor/DIY costs', '2400/450', `${lay.contractor}/${lay.diy}`);
assert(near(cop.contractor, 100 * 5) && near(cop.diy, 100 * 1), 'TC18 coppicing contractor/DIY costs', '500/100', `${cop.contractor}/${cop.diy}`);
assert(near(r18.sweat_equity_saving, r18.contractor_total - r18.diy_total), 'TC18 sweat equity = contractor - DIY', '', '');
const r18cap = calculate(hedge({ lay_m: 900, coppice_m: 900 }), constants);
assert(near(r18cap.quantities.lay_m, 400) && near(r18cap.quantities.coppice_m, 0), 'TC18 lay/coppice capped at existing length', '400/0', `${r18cap.quantities.lay_m}/${r18cap.quantities.coppice_m}`);

console.log('\n=== TC19: hedgerow create + density rule ===');
const r19 = calculate(hedge({ hedge_mode: 'create', lay_m: 100, guards: 'vole' }), constants);
assert(near(r19.quantities.plant_m, 400) && r19.quantities.lay_m === 0, 'TC19 create plants full length, ignores laying', 400, r19.quantities.plant_m);
assert(near(r19.annual_grants_per_year, 400 * 1.20), 'TC19 AECS creation £1.20/m/yr', 480, r19.annual_grants_per_year);
const r19low = calculate(hedge({ hedge_mode: 'create', plants_per_m: 4 }), constants);
assert(r19low.grant_items.find(g => g.key === 'hedge_planting') === undefined, 'TC19 <6 plants/m excluded from AECS planting grant', 'excluded', 'present');

console.log('\n=== TC20: hedgerow zero length ===');
const r20 = calculate(hedge({ length_m: 0, gap_pct: 50, lay_m: 100, coppice_m: 100, stock_fence_m: 0, guards: 'rabbit' }), constants);
for (const k of ['gross_inflow','contractor_total','diy_total','net_year1_contractor','net_year1_diy','sweat_equity_saving','projection_15yr_total','annual_grants_per_year']) {
  assert(r20[k] === 0, `TC20 ${k} is 0`, 0, r20[k]);
}
assert(r20.funding_mix.timber_pct + r20.funding_mix.fgs_pct + r20.funding_mix.esg_pct === 0, 'TC20 funding mix all zero', 0, '');

console.log('\n=== TC21: hedgerow projection is per km, plus annual grants ===');
const r21 = calculate(hedge({ length_m: 1000, esg_per_m: 1 }), constants);
const lt = constants.profiles.hedgerow.long_term_values;
assert(near(r21.projection[14].total - r21.projection[14].annual_grants, lt.firewood + lt.sporting + lt.natural_capital + lt.bng, 4), 'TC21 Yr15 value = per-km streams x 1 km', 730, r21.projection[14].total);
assert(r21.projection[0].annual_grants === 110 && r21.projection[4].annual_grants === 110 && r21.projection[5].annual_grants === 0, 'TC21 annual grant paid yrs 1-5 only', '110/110/0', '');
assert(near(r21.esg_income, 1000), 'TC21 sponsorship £1/m', 1000, r21.esg_income);

// ── TC22: agent, overrides and mixed conifer ───────────────────────────────

console.log('\n=== TC22: agent %, overrides ===');
const r22 = calculate({ ...hedge({ lay_m: 150, stock_fence_m: 400, esg_per_m: 1 }), hire_agent: true }, constants);
assert(near(r22.agent_fee, r22.gross_inflow * 0.12, 0.01), 'TC22 hedgerow agent fee 12% of inflow', '', r22.agent_fee);
assert(r22.agent_fee_pct === 0.12, 'TC22 result echoes agent_fee_pct', 0.12, r22.agent_fee_pct);
const cAgent = patchConstants({ ...defaultState('paws', constants), adv_agent_fee_pct: 8 }, constants);
const r22b = calculate({ ...tc6 }, cAgent);
assert(r22b.agent_fee_pct === 0.08 && near(r22b.agent_fee, r22b.gross_inflow * 0.08, 0.01), 'TC22 agent % override flows through', 0.08, r22b.agent_fee_pct);
const cMixed = patchConstants({ ...defaultState('paws', constants), adv_mixed_price: 40 }, constants);
const r22c = calculate({ ...tc8 }, cMixed);
assert(near(r22c.timber_revenue, 20 * 350 * (40 - 5)), 'TC22 mixed_conifer price override', 245000, r22c.timber_revenue);
const cFence = calculate({ ...tc1, override_fencing_grant: 5 }, constants);
assert(near(cFence.fgs_breakdown.fencing_grant, 400 * 5), 'TC22 fencing grant override', 2000, cFence.fgs_breakdown.fencing_grant);

// ── TC23: constants integrity ──────────────────────────────────────────────

console.log('\n=== TC23: every grant rate carries source + verify ===');
const missing = [];
for (const section of ['fgs_grants', 'aecs_grants']) {
  for (const [k, v] of Object.entries(constants[section])) {
    if (v && typeof v === 'object') {
      if (typeof v.value !== 'number' || !v.source || !v.verify || !v.unit) missing.push(`${section}.${k}`);
    }
  }
}
assert(missing.length === 0, 'TC23 all grant rates have value/unit/source/verify', 'none missing', missing.join(', '));
assert(constants.fife_paws_context === undefined, 'TC23 fife_paws_context not in runtime constants', 'absent', 'present');
let refsOk = true, badRef = '';
for (const [type, p] of Object.entries(constants.profiles)) {
  for (const g of p.grants) {
    const r = g.rate.split('.').reduce((o, k) => o?.[k], constants);
    if (r == null) { refsOk = false; badRef = `${type}:${g.rate}`; }
  }
}
assert(refsOk, 'TC23 every profile grant rate resolves', 'resolved', badRef);
assert(constants.esg.default_per_ha >= constants.esg.min_per_ha, 'TC23 ESG default is not below its minimum', '>=', `${constants.esg.default_per_ha} vs ${constants.esg.min_per_ha}`);
assert(constants.timber.species.mixed_conifer.price_per_ton === 30, 'TC23 mixed_conifer price present', 30, constants.timber.species.mixed_conifer.price_per_ton);

// ── TC24: URL backward compatibility ───────────────────────────────────────

console.log('\n=== TC24: URL state backward compatibility ===');
const legacy = decodeState('?ha=4&sp=sitka_spruce&diff=1&fence=400&regen=40&esg=750&agent=0', constants);
assert(legacy.project_type === 'paws', 'TC24 legacy link (no type) decodes as paws', 'paws', legacy.project_type);
const rLegacy = calculate(buildInputs(legacy), constants);
assert(near(rLegacy.net_year1_contractor, r1.net_year1_contractor, 0.001) && near(rLegacy.gross_inflow, r1.gross_inflow, 0.001),
  'TC24 legacy link reproduces TC1 results exactly', r1.net_year1_contractor, rLegacy.net_year1_contractor);
const legacyOv = decodeState('?ha=4&sp=larch&diff=3&fence=0&regen=100&esg=0&agent=1&yield=500&fg=12&rg=3000&sitka=30&scots=40&tph=1500&tc=3&af=10', constants);
assert(legacyOv.species === 'larch' && legacyOv.adv_yield === 500 && legacyOv.adv_restocking_grant === 3000 && legacyOv.adv_agent_fee_pct === 10 && legacyOv.hire_agent === true,
  'TC24 legacy advanced params decode', 'decoded', JSON.stringify(legacyOv));
assert(legacyOv.rhodo_enabled === true && legacyOv.rhodo_pct === 100, 'TC24 legacy link keeps rhodo at 100% of site', '100', legacyOv.rhodo_pct);
const bad = decodeState('?ha=999&sp=bogus&diff=9&fence=-5&regen=500&esg=abc', constants);
assert(bad.hectares === 20 && bad.species === 'sitka_spruce' && bad.difficulty === 5 && bad.fencing_m === 0 && bad.natural_regen_pct === 100 && bad.esg_per_ha === 1000,
  'TC24 malformed params are clamped / defaulted', 'clamped', JSON.stringify(bad));
const unk = decodeState('?type=nonsense&ha=4', constants);
assert(unk.project_type === 'paws', 'TC24 unknown type falls back to paws', 'paws', unk.project_type);
assert(decodeState('', constants) === null, 'TC24 empty query decodes to null', null, '');
for (const type of ['paws', 'native_woodland', 'new_woodland', 'wood_pasture', 'agroforestry', 'hedgerow']) {
  const st = defaultState(type, constants);
  const back = decodeState('?' + encodeState(st), constants);
  assert(JSON.stringify(back) === JSON.stringify(st), `TC24 ${type} state round-trips through URL`, 'equal', '');
  const rr = calculate(buildInputs(back), patchConstants(back, constants));
  assert(Number.isFinite(rr.net_year1_contractor) && Number.isFinite(rr.net_year1_diy) && Number.isFinite(rr.projection_15yr_total),
    `TC24 ${type} default scenario is finite`, 'finite', rr.net_year1_contractor);
}
const hSp = decodeState('?type=hedgerow&len=400&sp=sitka_spruce', constants);
assert(hSp.species === 'hawthorn_mix', 'TC24 species from another type falls back to type default', 'hawthorn_mix', hSp.species);

// ── TC25: NaN sweep across all new scenarios ───────────────────────────────

console.log('\n=== TC25: NaN sweep across all project types ===');
const newResults = { nw: r13, nwt: r13t, new: r14, newregen: r14r, pasture: r15, agro: r16, agroH: r16h, h1: r17, h2: r18, h3: r19, h0: r20, h4: r21, agent: r22 };
for (const [name, r] of Object.entries(newResults)) {
  for (const key of numericKeys.concat(['annual_grants_per_year', 'grants_total'])) {
    assert(Number.isFinite(r[key]), `${name}.${key} finite`, 'finite', String(r[key]));
  }
  assert(r.projection.every(y => Object.values(y).every(Number.isFinite)), `${name} projection finite`, 'finite', '');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${ failed === 0 ? '✓' : '✗' } ${passed} passed · ${failed} failed\n`);
if (failed > 0) process.exit(1);
