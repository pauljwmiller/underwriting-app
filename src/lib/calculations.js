// src/lib/calculations.js
//
// Self-employed qualifying income calculation engine.
// Implements the key rules from each agency's guidelines.
// References:
//   Fannie Mae:    Selling Guide B3-3.2, B3-3.2-01
//   Freddie Mac:   Seller/Servicer Guide Chapter 5304, Form 91
//   FHA/HUD:       HUD 4000.1 Single Family Housing Policy Handbook
//   VA:            VA Lender's Handbook Chapter 4
//
// The function calcAgencyIncome() is the main entry point.
// It expects a borrower object with tax return data attached.

// IRS standard mileage rates (business use)
export const MILEAGE_RATES = {
  2020: 0.575,
  2021: 0.56,
  2022: 0.585,
  2023: 0.655,
  2024: 0.67,
}

// ─── MERGE FIELDS WITH OVERRIDES ─────────────────────────────────────────
// Apply any user-corrected values on top of raw extracted fields.
// overrides is an array of { field_name, overridden_value } rows from the DB.

export function mergeFieldsWithOverrides(rawFields, overrides = []) {
  const merged = { ...(rawFields || {}) }
  for (const ov of overrides) {
    merged[ov.field_name] = ov.overridden_value
  }
  return merged
}

// ─── ADJUSTED INCOME FOR ONE TAX YEAR ────────────────────────────────────
// Computes add-backs and returns a detailed breakdown.
// This is agency-agnostic — differences are handled in calcAgencyIncome().

export function calcAdjustedIncome(fields, year) {
  if (!fields) return null

  const mileageRate = MILEAGE_RATES[year] ?? 0.655

  const netProfit       = fields.schedC_net_profit_loss     ?? 0
  const depreciation    = fields.schedC_depreciation        ?? 0
  const homeOffice      = fields.schedC_business_use_home   ?? 0
  const meals           = fields.schedC_meals               ?? 0  // already at 50% on the form
  const carTruck        = fields.schedC_car_truck_expenses  ?? 0
  const businessMiles   = fields.business_miles             ?? 0
  const wages           = fields.wages_salaries             ?? 0
  const schedEIncome    = fields.schedE_income              ?? 0
  const schedELoss      = fields.schedE_loss                ?? 0

  // Mileage add-back: the standard mileage method deducts depreciation inside it.
  // We add back the depreciation component (~28¢/mile in 2023) to avoid double-counting
  // with the explicit depreciation deduction. If actual expense method was used, this is 0.
  // Heuristic: if business_miles > 0 and car_truck_expenses > 0, assume standard method.
  const mileageDeprecComponent = businessMiles > 0 && carTruck > 0
    ? businessMiles * (mileageRate * 0.35)   // ~35% of standard rate is depreciation
    : 0

  const schedENet = schedEIncome - schedELoss

  return {
    netProfit,
    depreciation,
    homeOffice,
    meals,                                  // the 50% already deducted on Sch C
    mealsAddback: meals,                    // add the deducted portion back
    mileageAddback: mileageDeprecComponent,
    schedENet,
    wages,
    // Full adjusted income before agency-specific treatment
    adjustedBase: netProfit + depreciation + homeOffice + meals + mileageDeprecComponent + schedENet,
    totalWithWages: netProfit + depreciation + homeOffice + meals + mileageDeprecComponent + schedENet + wages,
  }
}

// ─── AGENCY-SPECIFIC QUALIFYING INCOME ───────────────────────────────────
// Takes a borrower object with .taxReturns (array of tax return rows from DB).
// Each tax return has .extracted_fields and .overrides (array of override rows).

export function calcAgencyIncome(borrower) {
  const returns = borrower.taxReturns ?? []

  // Find 2-year and 1-year returns
  const ret2022 = returns.find(r => r.tax_year === 2022)
  const ret2023 = returns.find(r => r.tax_year === 2023)
  // TODO: Update year references as tax years advance. In 2025 filings,
  // the most recent 2 years would be 2023 and 2024.

  const fields2022 = ret2022
    ? mergeFieldsWithOverrides(ret2022.extracted_fields, ret2022.overrides)
    : null

  const fields2023 = ret2023
    ? mergeFieldsWithOverrides(ret2023.extracted_fields, ret2023.overrides)
    : null

  const y1 = calcAdjustedIncome(fields2022, 2022)
  const y2 = calcAdjustedIncome(fields2023, 2023)

  if (!y1 && !y2) return null

  const income1 = y1?.totalWithWages ?? 0
  const income2 = y2?.totalWithWages ?? 0

  // Year-over-year change (positive = increase, negative = decline)
  const pctChange = y1 && income1 > 0 ? (income2 - income1) / income1 : null
  const isDecline      = pctChange !== null && pctChange < 0
  const isSharpDecline = pctChange !== null && pctChange < -0.25

  const twoYearAvg   = y1 && y2 ? (income1 + income2) / 2 : (income2 || income1)
  const lowerYear    = y1 && y2 ? Math.min(income1, income2) : (income2 || income1)
  const mostRecent   = income2 || income1
  const hasBothYears = !!(y1 && y2)

  // ── FANNIE MAE B3-3.2 ──
  // Stable/increasing: 24-month average
  // Declining 0-25%: use lower of the two years
  // Declining >25%: lower year + flag for additional analysis
  // Add-backs: depreciation, home office, business mileage dep component, meals (50%)
  // Source: https://selling-guide.fanniemae.com/sel/b3-3.2/self-employment-income
  const fnmaIncome = isDecline ? lowerYear : twoYearAvg
  // fnmaIncome is an annual qualifying income figure; convert to monthly on a 12-month basis
  const fnmaMonthly = fnmaIncome / 12
  const fnmaFlag = isSharpDecline ? 'SHARP_DECLINE'
    : isDecline ? 'DECLINING'
    : null

  // ── FREDDIE MAC Guide 5304 / Form 91 ──
  // Declining income: use most recent year only (not the lower year)
  // This is a key difference from FNMA — Freddie is slightly more generous
  // when income is declining because it uses the more recent (presumably
  // recovering) year rather than the lowest point.
  // Source: https://guide.freddiemac.com/app/guide/section/5304.1
  const fhlmcIncome = isDecline ? mostRecent : twoYearAvg
  // Freddie uses a similar annual figure but with different declining-income rules; still converted over 12 months
  const fhlmcMonthly = fhlmcIncome / 12
  const fhlmcFlag = isDecline ? 'DECLINING_USE_RECENT' : null

  // ── FHA / HUD 4000.1 ──
  // REQUIRES 2 full years of returns. Single year not acceptable.
  // Home office deduction is NOT added back (more conservative than GSEs).
  // Any decline triggers use of the lower year.
  // Source: https://www.hud.gov/hud-partners/single-family-handbook-4000-1
  let fhaIncome = null
  let fhaFlag = null

  if (!hasBothYears) {
    fhaFlag = 'MISSING_YEAR'
    // fhaIncome stays null — ineligible
  } else {
    // Recalculate without home office add-back
    const fha1 = income1 - (y1?.homeOffice ?? 0)
    const fha2 = income2 - (y2?.homeOffice ?? 0)
    fhaIncome = isDecline ? Math.min(fha1, fha2) : (fha1 + fha2) / 2
    fhaFlag = isDecline ? 'DECLINING' : null
  }
  const fhaMonthly = fhaIncome != null ? fhaIncome / 12 : null

  // ── VA Lender's Handbook Chapter 4 ──
  // More flexible than GSEs in some ways:
  //   - Negative income is treated as $0, not a liability offset
  //   - Full meals deduction can be added back (not just 50%)
  //   - 1-year history acceptable with compensating factors
  //   - 2-year average is the standard approach
  // Source: https://www.benefits.va.gov/WARMS/docs/admin26/m26-07/Ch4_Underwriting_NEW.pdf
  const vaAdjust = (calcObj) => {
    if (!calcObj) return 0
    // VA allows full meals add-back vs Fannie/Freddie 50%
    const extraMealsAddback = calcObj.meals  // add the other 50% Sch C already deducted
    return Math.max(0, calcObj.totalWithWages + extraMealsAddback)
  }

  const va1 = vaAdjust(y1)
  const va2 = vaAdjust(y2)
  const vaIncome = hasBothYears
    ? (isDecline ? Math.min(va1, va2) : (va1 + va2) / 2)
    : va2 || va1
  const vaMonthly = vaIncome / 12
  const vaFlag = !hasBothYears ? 'ONE_YEAR_ONLY'
    : isDecline ? 'DECLINING'
    : null

  return {
    year2022: y1,
    year2023: y2,
    pctChange,
    isDecline,
    isSharpDecline,
    hasBothYears,
    agencies: {
      FNMA: {
        label:   'Fannie Mae',
        annual:  fnmaMonthly * 12,
        monthly: fnmaMonthly,
        flag:    fnmaFlag,
        eligible: true,
      },
      FHLMC: {
        label:   'Freddie Mac',
        annual:  fhlmcMonthly * 12,
        monthly: fhlmcMonthly,
        flag:    fhlmcFlag,
        eligible: true,
      },
      FHA: {
        label:   'FHA / HUD',
        annual:  fhaMonthly * 12,
        monthly: fhaMonthly,
        flag:    fhaFlag,
        eligible: fhaIncome != null,
      },
      VA: {
        label:   'VA',
        annual:  vaMonthly * 12,
        monthly: vaMonthly,
        flag:    vaFlag,
        eligible: true,
      },
    }
  }
}

// ─── LOAN-LEVEL TOTAL ────────────────────────────────────────────────────
// Sum qualifying income across all borrowers for a given agency.
// W-2 co-borrowers are added at their annual / 12.

export function calcLoanTotal(borrowers, agency) {
  let total = 0
  for (const borrower of borrowers) {
    if (borrower.is_self_employed) {
      const calc = calcAgencyIncome(borrower)
      if (calc?.agencies[agency]?.monthly) {
        total += calc.agencies[agency].monthly
      }
    } else if (borrower.w2_annual_income) {
      // W-2 income is the same under all agency guidelines
      total += borrower.w2_annual_income / 12
    }
  }
  return total
}
