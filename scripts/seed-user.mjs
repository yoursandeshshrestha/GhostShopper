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

const SEED_SUPERADMINS = [
  { email: 'yoursandeshshrestha@gmail.com', fullName: 'Sandesh Shrestha' },
  { email: 'levi@milktreeagency.com', fullName: 'Levi' },
]

if (!url || !serviceKey) {
  console.error(
    'Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.local'
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seedSuperadmin({ email, fullName }) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listError) throw listError

  const existing = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  let userId = existing?.id
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) throw error
    console.log(`Updated seed user ${email} (${existing.id})`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) throw error
    userId = data.user?.id
    console.log(`Created seed user ${email} (${userId})`)
  }

  if (!userId) throw new Error(`No user id after seed for ${email}`)

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    org_id: null,
    email,
    full_name: fullName,
    role: 'superadmin',
  })
  if (profileError) throw profileError
  console.log(`Promoted ${email} to superadmin`)
}

async function main() {
  const extraEmail = process.env.SEED_USER_EMAIL?.trim()
  const users = extraEmail
    ? [
        ...SEED_SUPERADMINS,
        ...(!SEED_SUPERADMINS.some(
          (u) => u.email.toLowerCase() === extraEmail.toLowerCase()
        )
          ? [{ email: extraEmail, fullName: extraEmail.split('@')[0] }]
          : []),
      ]
    : SEED_SUPERADMINS

  for (const user of users) {
    await seedSuperadmin(user)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
