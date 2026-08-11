import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const url = process.env.VITE_SUPABASE_URL
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
const email =
  process.env.SEED_USER_EMAIL ||
  process.env.DEV_LOGIN_EMAIL ||
  'dev@ghostshopper.dev'
const password =
  process.env.SEED_USER_PASSWORD || process.env.DEV_LOGIN_PASSWORD

if (!url || !serviceKey || !password) {
  console.error(
    'Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY), or SEED_USER_PASSWORD (or DEV_LOGIN_PASSWORD) in .env.local'
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listError) throw listError

  const existing = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: 'GhostShopper Dev' },
    })
    if (error) throw error
    console.log(`Updated seed user ${email} (${existing.id})`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'GhostShopper Dev' },
    })
    if (error) throw error
    console.log(`Created seed user ${email} (${data.user?.id})`)
  }

  // Verify password login works with the anon client.
  const anon = createClient(url, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: signedIn, error: signInError } =
    await anon.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  console.log(`Verified sign-in for ${signedIn.user.email}`)
  await anon.auth.signOut()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
