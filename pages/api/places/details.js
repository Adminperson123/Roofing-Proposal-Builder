/**
 * Place details proxy — Google Places API (New).
 *
 * Given a placeId (from /api/places/autocomplete in Google mode), returns the
 * canonical address plus parsed components and coordinates:
 *   { compact, structured: { city, state, zip, lat, lng } }
 *
 * Only used in Google mode — Nominatim suggestions already carry structured
 * data inline, so the client never calls this for the fallback path.
 */
export default async function handler(req, res) {
  const placeId = (req.query.placeId || '').toString().trim()
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return res.status(400).json({ error: 'Maps not configured' })
  if (!placeId) return res.status(400).json({ error: 'placeId required' })

  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'formattedAddress,location,addressComponents',
      },
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data?.error?.message || 'Place details failed')

    const comp = (type, useShort) => {
      const c = (data.addressComponents || []).find(a => (a.types || []).includes(type))
      return c ? (useShort ? c.shortText : c.longText) : ''
    }
    const street = [comp('street_number'), comp('route')].filter(Boolean).join(' ')
    const city = comp('locality') || comp('sublocality') || comp('postal_town') || comp('administrative_area_level_2')
    const state = comp('administrative_area_level_1', true) // short text → "CA"
    const zip = comp('postal_code')
    const compact = (street && city)
      ? [street, city, state, zip].filter(Boolean).join(', ')
      : (data.formattedAddress || '')

    return res.status(200).json({
      compact,
      structured: {
        city, state, zip,
        lat: data.location?.latitude ?? null,
        lng: data.location?.longitude ?? null,
      },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
