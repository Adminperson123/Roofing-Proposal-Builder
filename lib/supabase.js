import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

export function browserClient() {
  return createClient(url, anon, { auth: { persistSession: false } })
}

export function serverClient() {
  if (!service) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, service, { auth: { persistSession: false } })
}
