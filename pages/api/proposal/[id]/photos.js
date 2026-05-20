/**
 * Photo upload / delete for a proposal.
 *
 * POST /api/proposal/[id]/photos
 *   Body (JSON): { image: "data:image/jpeg;base64,...", contentType?: "image/jpeg" }
 *     - image: the photo as a data URL (frontend converts File via FileReader)
 *     - contentType: optional; we parse it from the data URL if missing
 *   Returns: { ok, photoUrl, photo_urls } — photo_urls is the full updated array
 *
 * DELETE /api/proposal/[id]/photos
 *   Body (JSON): { url: "https://...supabase.co/storage/v1/object/public/proposal-photos/..." }
 *   Returns: { ok, photo_urls }
 *
 * Server-side multipart parsing would let us skip the base64 step, but base64-in-JSON
 * keeps the frontend simple (no FormData, no extra deps) and is plenty fast for
 * 3-10 MB roof photos.
 */

import { serverClient } from '../../../../lib/supabase'
import { uploadPhoto, deletePhoto, pathFromPublicUrl } from '../../../../lib/photos'

export const config = {
  api: {
    bodyParser: {
      // Bumped from Next.js default 1mb to handle 10MB photos
      // (base64 inflates ~33%, so a 10MB photo becomes ~13.5MB JSON)
      sizeLimit: '15mb',
    },
  },
}

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'proposal id required' })

  const sb = serverClient()

  // Verify the proposal exists before touching storage
  const { data: proposal, error: lookupErr } = await sb
    .from('proposals')
    .select('id, photo_urls')
    .eq('id', id)
    .single()

  if (lookupErr || !proposal) {
    return res.status(404).json({ error: 'proposal not found' })
  }

  if (req.method === 'POST') return handleUpload({ req, res, sb, proposal })
  if (req.method === 'DELETE') return handleDelete({ req, res, sb, proposal })

  return res.status(405).json({ error: 'POST or DELETE only' })
}

async function handleUpload({ req, res, sb, proposal }) {
  const { image, contentType: providedType } = req.body || {}
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image (data URL) required in body' })
  }

  // Parse a data URL into { contentType, buffer }
  const parsed = parseDataUrl(image)
  if (!parsed) {
    return res.status(400).json({ error: 'image must be a data URL like data:image/jpeg;base64,...' })
  }
  const contentType = providedType || parsed.contentType

  const uploadResult = await uploadPhoto({
    proposalId: proposal.id,
    buffer: parsed.buffer,
    contentType,
  })

  if (!uploadResult.ok) {
    return res.status(500).json({ error: uploadResult.error })
  }

  // Append to the proposal's photo_urls array
  const nextPhotos = [...(proposal.photo_urls || []), uploadResult.publicUrl]
  const { error: updateErr } = await sb
    .from('proposals')
    .update({ photo_urls: nextPhotos })
    .eq('id', proposal.id)

  if (updateErr) {
    // Storage succeeded but DB update failed; leave the file orphaned rather than
    // double-failing. Worst case is a small bit of unreachable storage.
    console.error('photo uploaded but proposal update failed:', updateErr)
    return res.status(500).json({
      error: 'photo stored but proposal update failed: ' + updateErr.message,
      photoUrl: uploadResult.publicUrl,
    })
  }

  return res.status(200).json({
    ok: true,
    photoUrl: uploadResult.publicUrl,
    photo_urls: nextPhotos,
  })
}

async function handleDelete({ req, res, sb, proposal }) {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url required in body' })

  // Refuse to delete a URL that isn't actually one of this proposal's photos.
  // Prevents a buggy client from accidentally nuking another proposal's files.
  const currentPhotos = proposal.photo_urls || []
  if (!currentPhotos.includes(url)) {
    return res.status(400).json({ error: 'url is not in this proposal photo_urls' })
  }

  const path = pathFromPublicUrl(url)
  if (path) {
    const delResult = await deletePhoto({ path })
    if (!delResult.ok) {
      // Log and proceed; better to clean the DB reference than to leave a dangling URL.
      console.error('storage delete failed but continuing:', delResult.error)
    }
  }

  const nextPhotos = currentPhotos.filter(u => u !== url)
  const { error: updateErr } = await sb
    .from('proposals')
    .update({ photo_urls: nextPhotos })
    .eq('id', proposal.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  return res.status(200).json({ ok: true, photo_urls: nextPhotos })
}

/** Parse a data URL into { contentType, buffer } */
function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  try {
    return {
      contentType: m[1],
      buffer: Buffer.from(m[2], 'base64'),
    }
  } catch {
    return null
  }
}
