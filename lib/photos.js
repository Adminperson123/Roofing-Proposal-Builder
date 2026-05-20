/**
 * Photo storage helpers — Supabase Storage edition.
 *
 * What lives here:
 *   uploadPhoto()  → uploads a single file buffer to Supabase Storage, returns the public URL
 *   deletePhoto()  → removes a stored photo by its storage path
 *   publicUrl()    → builds the public URL for a stored path (no API call needed)
 *
 * Conventions:
 *   - Bucket name: "proposal-photos"
 *   - Object path: "<proposalId>/<timestamp>-<randomHex>.<ext>"
 *     (path includes proposalId so we can list/delete a proposal's photos with one prefix query)
 *
 * All functions use the SERVICE_ROLE Supabase client (bypasses RLS) — they should
 * only be called from server-side API routes, never from client code.
 */

import { serverClient } from './supabase'
import crypto from 'crypto'

const BUCKET = 'proposal-photos'

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

/**
 * Build a storage path for a new photo.
 * Example: "20fcb946-26a1-4bce-91e7-f32603a307de/1716178235-a3b9.jpg"
 */
export function buildPhotoPath({ proposalId, contentType }) {
  const ext = MIME_TO_EXT[contentType] || 'jpg'
  const ts = Date.now()
  const rand = crypto.randomBytes(3).toString('hex')
  return `${proposalId}/${ts}-${rand}.${ext}`
}

/**
 * Upload a photo buffer to Supabase Storage.
 * @param buffer  Node Buffer (or Uint8Array) with the image bytes
 * @param contentType  e.g. "image/jpeg"
 * @returns { ok, path, publicUrl, error? }
 */
export async function uploadPhoto({ proposalId, buffer, contentType }) {
  if (!proposalId) return { ok: false, error: 'proposalId required' }
  if (!buffer)     return { ok: false, error: 'buffer required' }
  if (!contentType || !MIME_TO_EXT[contentType]) {
    return { ok: false, error: `unsupported content-type: ${contentType}` }
  }

  const path = buildPhotoPath({ proposalId, contentType })
  const sb = serverClient()

  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    cacheControl: '31536000',  // 1 year — file is immutable (unique random name)
    upsert: false,
  })

  if (error) return { ok: false, error: error.message || String(error) }

  return {
    ok: true,
    path,
    publicUrl: publicUrl(path),
  }
}

/**
 * Delete a photo by its storage path.
 * @param path  the stored path (e.g. "<proposalId>/<filename>")
 */
export async function deletePhoto({ path }) {
  if (!path) return { ok: false, error: 'path required' }
  const sb = serverClient()
  const { error } = await sb.storage.from(BUCKET).remove([path])
  if (error) return { ok: false, error: error.message || String(error) }
  return { ok: true }
}

/**
 * Convert a storage path -> public URL.
 * (Doesn't hit the network; just composes the URL from env config.)
 */
export function publicUrl(path) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base || !path) return null
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}`
}

/**
 * Extract the storage path from a full public URL.
 * Used when deleting — we store full URLs in the proposals table.
 */
export function pathFromPublicUrl(url) {
  if (!url) return null
  const m = String(url).match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`))
  return m ? m[1] : null
}
