// src/lib/constants.js
// Shared lookup tables used across components.

export const STATUSES = [
  'Not Started',
  'Documents Uploaded',
  'Extracted',
  'In Review',
  'Finalized',
]

export const STATUS_COLORS = {
  'Not Started':        '#556070',
  'Documents Uploaded': '#4a90d9',
  'Extracted':          '#bc8cff',
  'In Review':          '#e8a838',
  'Finalized':          '#3fb950',
}

export const AGENCIES        = ['FNMA', 'FHLMC', 'FHA', 'VA']
export const AGENCY_LABELS   = { FNMA: 'Fannie Mae', FHLMC: 'Freddie Mac', FHA: 'FHA / HUD', VA: 'VA' }
export const AGENCY_COLORS   = { FNMA: '#4a90d9', FHLMC: '#bc8cff', FHA: '#e8a838', VA: '#3fb950' }

// ─── 1040 FIELD METADATA ─────────────────────────────────────────────────

// IRS line references — displayed next to field names in extraction review
export const FIELD_SOURCES = {
  wages_salaries:             'Form 1040, Line 1a',
  taxable_interest:           'Form 1040, Line 2b',
  adjusted_gross_income:      'Form 1040, Line 11',
  schedC_gross_receipts:      'Schedule C, Line 1',
  schedC_cost_of_goods:       'Schedule C, Line 4',
  schedC_gross_profit:        'Schedule C, Line 7 (computed)',
  schedC_advertising:         'Schedule C, Line 8',
  schedC_car_truck_expenses:  'Schedule C, Line 9',
  schedC_depreciation:        'Schedule C, Line 13',
  schedC_insurance:           'Schedule C, Line 15',
  schedC_legal_professional:  'Schedule C, Line 17',
  schedC_meals:               'Schedule C, Line 24b',
  schedC_office_expense:      'Schedule C, Line 18',
  schedC_rent_lease:          'Schedule C, Line 20b',
  schedC_supplies:            'Schedule C, Line 22',
  schedC_taxes_licenses:      'Schedule C, Line 23',
  schedC_utilities:           'Schedule C, Line 25',
  schedC_wages:               'Schedule C, Line 26',
  schedC_business_use_home:   'Schedule C, Line 30 / Form 8829',
  schedC_other_expenses:      'Schedule C, Line 27a',
  schedC_total_expenses:      'Schedule C, Line 28',
  schedC_net_profit_loss:     'Schedule C, Line 31',
  schedE_income:              'Schedule E, Line 28 (col. G)',
  schedE_loss:                'Schedule E, Line 28 (col. H)',
  business_miles:             'Schedule C, Part IV, Line 44a',
}

// Fields that are key inputs to qualifying income calculations
// Highlighted differently in the extraction review table
export const KEY_CALC_FIELDS = new Set([
  'schedC_net_profit_loss',
  'schedC_depreciation',
  'schedC_business_use_home',
  'schedC_car_truck_expenses',
  'schedC_meals',
  'wages_salaries',
  'schedE_income',
  'schedE_loss',
  'business_miles',
])

// Grouped fields for extraction review layout
export const FIELD_GROUPS = [
  {
    label: 'Form 1040 — Main Return',
    fields: [
      ['wages_salaries',        'W-2 Wages & Salaries'],
      ['taxable_interest',      'Taxable Interest Income'],
      ['adjusted_gross_income', 'Adjusted Gross Income (AGI)'],
    ]
  },
  {
    label: 'Schedule C — Business Income',
    fields: [
      ['schedC_gross_receipts',    'Gross Receipts / Sales'],
      ['schedC_cost_of_goods',     'Cost of Goods Sold'],
      ['schedC_gross_profit',      'Gross Profit'],
      ['schedC_depreciation',      'Depreciation (Form 4562)'],
      ['schedC_car_truck_expenses','Car & Truck Expenses'],
      ['schedC_business_use_home', 'Business Use of Home'],
      ['schedC_meals',             'Meals (50% deducted)'],
      ['schedC_wages',             'Employee Wages'],
      ['schedC_insurance',         'Insurance'],
      ['schedC_legal_professional','Legal & Professional'],
      ['schedC_taxes_licenses',    'Taxes & Licenses'],
      ['schedC_utilities',         'Utilities'],
      ['schedC_advertising',       'Advertising'],
      ['schedC_other_expenses',    'Other Expenses'],
      ['schedC_total_expenses',    'Total Expenses'],
      ['schedC_net_profit_loss',   'Net Profit / (Loss)'],
    ]
  },
  {
    label: 'Schedule E — Pass-Through Income',
    fields: [
      ['schedE_income', 'Partnership / S-Corp Income'],
      ['schedE_loss',   'Partnership / S-Corp Loss'],
    ]
  },
  {
    label: 'Business Use Details',
    fields: [
      ['business_miles', 'Business Miles Driven'],
    ]
  },
]

// ─── FORMATTING HELPERS ─────────────────────────────────────────────────

export const fmt$ = (n) =>
  n == null ? '—' : '$' + Math.round(Math.abs(n)).toLocaleString() + (n < 0 ? ' (loss)' : '')

export const fmtPct = (n) =>
  n == null ? '—' : (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%'

export const fmtMiles = (n) =>
  n == null ? '—' : Math.round(n).toLocaleString() + ' mi'
