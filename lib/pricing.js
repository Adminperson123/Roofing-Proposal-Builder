// Deterministic price calculator + financing math.
// Settings shape: { shingle:{good,better,best}, tile:{...}, adders:{steep,story2,layer}, addons:{key:price,...}, financing:{enabled,apr,termMonths} }

export const ADDON_DEFS = [
  { id: 'icewater',  label: 'Ice & Water Shield Upgrade' },
  { id: 'ridgevent', label: 'Ridge Vent (full length)'   },
  { id: 'boots',     label: 'Pipe Boot Replacements'     },
  { id: 'chimney',   label: 'Chimney Flashing'           },
  { id: 'skylight',  label: 'Skylight Flashing/Cricket'  },
  { id: 'drip',      label: 'Drip Edge Upgrade'          },
  { id: 'gutters',   label: 'Gutter Remove & Replace'    },
  { id: 'solar',     label: 'Solar Panel Remove/Reset'   },
]

// Default outbound copy for the Send modal. Placeholders: {{firstName}} {{rep}} {{propNum}} {{link}}
export const DEFAULT_TEMPLATES = {
  smsBody: "Hi {{firstName}}, this is {{rep}} at Good People Roofing. Here's your roofing proposal #{{propNum}}: {{link}}\n\nIt has three options to choose from — reply with any questions.",
  emailSubject: "Your Good People Roofing proposal #{{propNum}}",
  emailBody: "Hi {{firstName}},\n\nThank you for the opportunity to earn your business. Your personalized roofing proposal is ready — it walks through three package options, all backed by the same crew and the same workmanship guarantee.\n\nView your proposal here:\n{{link}}\n\nReply to this email or call us any time with questions.\n\n— {{rep}}, Good People Roofing",
}

export const DEFAULT_SETTINGS = {
  shingle: { good: 680, better: 780, best: 900 },
  tile:    { good: 600, better: 700, best: 850 },
  adders:  { steep: 50, story2: 40, layer: 25, decking: 85 },
  addons:  { icewater:350, ridgevent:450, boots:65, chimney:550, skylight:400, drip:280, gutters:1200, solar:850 },
  financing: { enabled: true, apr: 7.99, termMonths: 120 },
  messageTemplates: DEFAULT_TEMPLATES,
  changeOrders: [],
  // Per-panel solar detach/reset rate. 0 = use the flat addons.solar price instead.
  solarPerPanel: 0,
  reps:    [],
}

export function calcPrices(scope, settings = DEFAULT_SETTINGS) {
  const sq    = +scope.squares || 14
  const pitch = +scope.pitch   || 5
  const stor  = +scope.stories || 1
  const lay   = +scope.layers  || 1
  const perm  = +scope.permit  || 0
  const addons = scope.addons || []
  const solarPanels = +scope.solarPanels || 0

  let adder = 0
  if (pitch >= 7) adder += settings.adders.steep
  if (stor  >= 2) adder += settings.adders.story2
  if (lay   >= 2) adder += settings.adders.layer * (lay - 1)

  const tbl = scope.roofType === 'tile' ? settings.tile : settings.shingle
  // Solar add-on: per-panel pricing when a per-panel rate is configured AND a
  // panel count is given; otherwise the flat addons.solar price applies.
  const perPanel = +settings.solarPerPanel || 0
  const addonsTotal = addons.reduce((t, id) => {
    if (id === 'solar' && perPanel > 0 && solarPanels > 0) return t + perPanel * solarPanels
    return t + (settings.addons[id] || 0)
  }, 0)

  const tier = (psf) => Math.round((psf + adder) * sq) + perm + addonsTotal

  return {
    sq, pitch, stories: stor, layers: lay, permit: perm, adder, addonsTotal,
    good:   { psf: tbl.good,   total: tier(tbl.good)   },
    better: { psf: tbl.better, total: tier(tbl.better) },
    best:   { psf: tbl.best,   total: tier(tbl.best)   },
  }
}

export function newPropNum() {
  return 'GP-' + Date.now().toString().slice(-6)
}
