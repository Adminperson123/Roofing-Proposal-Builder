/**
 * Address autocomplete proxy.
 *
 * Returns prediction suggestions for an address query. Uses Google Places API
 * (New) when GOOGLE_MAPS_API_KEY is set; otherwise falls back to free
 * OpenStreetMap Nominatim so the feature keeps working with no key. Proxying
 * server-side keeps the Google key out of the browser and dodges CORS + the
 * browser-side Nominatim rate limit.
 *
 * Response shape (provider-agnostic — the client handles both):
 *   { provider, suggestions: [{ compact, placeId?, structured? }] }
 *   - Google items carry placeId (client fetches /api/places/details on pick)
 *   - Nominatim items carry structured {city,state,zip,lat,lng} inline
 */
export default async function handler(req, res) {
  const q = (req.query.q || '').toString().trim()
  if (q.length < 3) return res.status(200).json({ provider: 'none', suggestions: [] })

  const key = process.env.GOOGLE_MAPS_API_KEY
  try {
    if (key) {
      const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
        body: JSON.stringify({ input: q, includedRegionCodes: ['us'] }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error?.message || 'Places autocomplete failed')
      const suggestions = (data.suggestions || [])
        .map(s => s.placePrediction)
        .filter(Boolean)
        .map(p => ({ compact: p.text?.text || '', placeId: p.placeId }))
        .filter(s => s.compact && s.placeId)
      return res.status(200).json({ provider: 'google', suggestions })
    }

    // Fallback: OpenStreetMap Nominatim (free, no key). A descriptive
    // User-Agent is required by Nominatim's usage policy.
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(q)}`
    const r = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'GoodPeopleRoofing-ProposalBuilder/1.0 (admin@parawavai.com)' },
    })
    const data = await r.json()
    const suggestions = (data || [])
      .map(d => ({
        compact: formatNominatim(d.address),
        structured: {
          city:  d.address?.city || d.address?.town || d.address?.village || d.address?.hamlet || d.address?.suburb || '',
          state: d.address?.state || '',
          zip:   d.address?.postcode || '',
          lat:   d.lat ? Number(d.lat) : null,
          lng:   d.lon ? Number(d.lon) : null,
        },
      }))
      .filter(s => s.compact)
    return res.status(200).json({ provider: 'nominatim', suggestions })
  } catch (e) {
    // Never 500 the typeahead — return empty so the input stays usable.
    return res.status(200).json({ provider: 'error', suggestions: [], error: e.message })
  }
}

function formatNominatim(a) {
  if (!a) return ''
  const street = [a.house_number, a.road].filter(Boolean).join(' ')
  const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.county || ''
  const state = a.state || ''
  const zip = a.postcode || ''
  if (!street || !city) return ''
  return [street, city, state, zip].filter(Boolean).join(', ')
}
