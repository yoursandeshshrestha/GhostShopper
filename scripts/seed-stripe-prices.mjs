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
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const STRIPE_API = 'https://api.stripe.com/v1'
const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!stripeKey) {
  console.error('Missing STRIPE_SECRET_KEY in .env.local')
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error(
    'Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.local'
  )
  process.exit(1)
}

const PRICES = [
  {
    key: 'local_monthly',
    product: 'GhostShopper Local',
    nickname: 'Local monthly',
    unitAmount: 19900,
    interval: 'month',
  },
  {
    key: 'local_annual',
    product: 'GhostShopper Local',
    nickname: 'Local annual',
    unitAmount: 199000,
    interval: 'year',
  },
  {
    key: 'growth_monthly',
    product: 'GhostShopper Growth',
    nickname: 'Growth monthly',
    unitAmount: 54900,
    interval: 'month',
  },
  {
    key: 'growth_annual',
    product: 'GhostShopper Growth',
    nickname: 'Growth annual',
    unitAmount: 549000,
    interval: 'year',
  },
  {
    key: 'scale_monthly',
    product: 'GhostShopper Scale',
    nickname: 'Scale monthly',
    unitAmount: 129900,
    interval: 'month',
  },
  {
    key: 'scale_annual',
    product: 'GhostShopper Scale',
    nickname: 'Scale annual',
    unitAmount: 1299000,
    interval: 'year',
  },
  {
    key: 'brand_monthly',
    product: 'GhostShopper Brand',
    nickname: 'Brand monthly per location',
    unitAmount: 4000,
    interval: 'month',
  },
  {
    key: 'brand_annual',
    product: 'GhostShopper Brand',
    nickname: 'Brand annual per location',
    unitAmount: 40000,
    interval: 'year',
  },
  {
    key: 'setup_fee',
    product: 'GhostShopper Setup fee',
    nickname: 'Setup fee',
    unitAmount: 75000,
    interval: null,
  },
]

async function stripe(method, path, params) {
  const body = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === '') continue
      body.append(key, String(value))
    }
  }
  const url =
    method === 'GET' && params
      ? `${STRIPE_API}${path}?${body.toString()}`
      : `${STRIPE_API}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      ...(method === 'GET'
        ? {}
        : { 'Content-Type': 'application/x-www-form-urlencoded' }),
    },
    body: method === 'GET' ? undefined : body,
  })
  const json = await response.json()
  if (!response.ok) {
    const message = json?.error?.message || `Stripe ${method} ${path} failed`
    throw new Error(message)
  }
  return json
}

async function findOrCreateProduct(name, key) {
  const listed = await stripe('GET', '/products', { limit: 100, active: true })
  const existing = (listed.data || []).find(
    (product) =>
      product.metadata?.ghostshopper_key === key || product.name === name
  )
  if (existing) {
    if (existing.metadata?.ghostshopper_key !== key) {
      return stripe('POST', `/products/${existing.id}`, {
        'metadata[ghostshopper_key]': key,
      })
    }
    return existing
  }

  return stripe('POST', '/products', {
    name,
    'metadata[ghostshopper_key]': key,
  })
}

async function findOrCreatePrice(spec, productId) {
  const lookup = await stripe('GET', '/prices', {
    'lookup_keys[0]': spec.key,
    limit: 1,
  })
  const existing = lookup.data?.[0]
  if (existing) {
    if (existing.unit_amount !== spec.unitAmount || !existing.active) {
      console.warn(
        `Price ${spec.key} already exists (${existing.id}) with unit_amount=${existing.unit_amount}. Leaving it in place.`
      )
    }
    return existing
  }

  const params = {
    product: productId,
    currency: 'gbp',
    unit_amount: spec.unitAmount,
    nickname: spec.nickname,
    lookup_key: spec.key,
    'metadata[ghostshopper_key]': spec.key,
  }
  if (spec.interval) {
    params['recurring[interval]'] = spec.interval
  }

  return stripe('POST', '/prices', params)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const productCache = new Map()

for (const spec of PRICES) {
  let product = productCache.get(spec.product)
  if (!product) {
    product = await findOrCreateProduct(
      spec.product,
      spec.product.toLowerCase().replace(/\s+/g, '_')
    )
    productCache.set(spec.product, product)
    console.log(`Product ${spec.product} (${product.id})`)
  }

  const price = await findOrCreatePrice(spec, product.id)
  const { error } = await admin.from('stripe_prices').upsert({
    price_key: spec.key,
    stripe_product_id: product.id,
    stripe_price_id: price.id,
    nickname: spec.nickname,
    currency: 'gbp',
    unit_amount_pence: spec.unitAmount,
    interval: spec.interval,
    usage_type: spec.interval ? 'licensed' : 'one_time',
  })
  if (error) throw error
  console.log(`  ${spec.key} → ${price.id} (£${(spec.unitAmount / 100).toFixed(2)})`)
}

console.log('Stripe prices seeded.')
