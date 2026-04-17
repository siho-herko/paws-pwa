// tests/calc.test.js
import {
  calculate, timberRevenue, fgsGrants, esgIncome, grossInflow,
  contractorCosts, diyCosts, agentFee, grossOutflow, netCashYear1,
  sweatEquitySaving, fundingMix, longTermProjection, breakevenStatus
} from '../calc.js';
import { readFileSync } from 'fs';

const constants = JSON.parse(readFileSync('./data/paws_constants.json', 'utf8'));

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

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${ failed === 0 ? '✓' : '✗' } ${passed} passed · ${failed} failed\n`);
if (failed > 0) process.exit(1);
