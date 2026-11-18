import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

function walk(directory) {
  return readdirSync(join(root, directory)).flatMap((name) => {
    const path = join(directory, name)
    const stat = statSync(join(root, path))
    return stat.isDirectory() ? walk(path) : [path]
  })
}

const appFiles = [...walk('app'), ...walk('components'), ...walk('lib')]
  .filter((path) => /\.(ts|tsx|js|jsx)$/.test(path))
const appSource = appFiles.map(read).join('\n')
const tradeConfirm = read('components/TradeConfirm.tsx')
const authModal = read('components/auth-modal.tsx')
const supabaseClient = read('lib/supabase.ts')
const orderPanel = read('components/OrdersPanel.tsx')
const uploadRoute = read('app/api/listings/photo/route.ts')
const staffRoute = read('app/api/staff/listings/route.ts')
const staffPanel = read('components/staff-panel.tsx')
const profilePage = read('components/ProfileLoggedIn.tsx')
const marketShell = read('components/market-shell.tsx')
const tokenomicsModal = read('components/TokenomicsModal.tsx')
const hardeningMigration = read('supabase/migrations/20261117063816_harden_public_access_and_function_search_paths.sql')
const storageWriteMigration = read('supabase/migrations/20261118110548_restrict_client_storage_writes.sql')
const ledgerMigration = read('supabase/migrations/20261117070000_create_double_entry_ledger.sql')
const stkRoute = read('app/api/orders/[id]/stk/route.ts')
const mpesaCallbackRoute = read('app/api/payments/mpesa/callback/route.ts')
const paymentConfigRoute = read('app/api/payments/config/route.ts')
const orderSettlementRoute = read('app/api/orders/[id]/verify/route.ts')
const publicListingsView = hardeningMigration.match(
  /create or replace view public\.public_listings[\s\S]*?grant select on public\.public_listings to anon, authenticated;/i,
)?.[0] || ''
const photoIntegrityMigration = read('supabase/migrations/20261109070314_store_listing_photo_paths_not_absolute_urls.sql')
const moderationMigration = read('supabase/migrations/20261109071933_add_atomic_listing_moderation_audit.sql')
const staticDemo = read('index.html')
const ignore = read('.gitignore')
const envExample = read('.env.example')
const nextConfig = read('next.config.mjs')
const competingNextConfigs = ['next.config.ts', 'next.config.js', 'next.config.cjs'].filter((name) => existsSync(join(root, name)))
const packageJson = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))

check(!/\.from\(['"]trades['"]\)\s*\.\s*(insert|update|delete)/i.test(appSource),
  'Browser code must not insert, update or delete legacy trades.')
check(/\.from\(['"]orders['"]\)\s*\.\s*insert\(/i.test(tradeConfirm),
  'Trade UI must create an order request, not a fake trade.')
check(/does not reserve payment|No payment has been taken/i.test(tradeConfirm),
  'Order UI must clearly state that no payment is taken.')
check(/buyer_id|seller_id/.test(orderPanel) && /accepted|rejected|cancelled/.test(orderPanel),
  'Buyer/seller order request lifecycle UI is missing.')
check(/auth\.getUser\(token\)/.test(uploadRoute) && /detectImage/.test(uploadRoute),
  'Image upload API must verify the user and inspect image bytes.')
check(uploadRoute.includes('const MAX_IMAGE_BYTES = 4 * 1024 * 1024')
  && /consume_listing_upload_limit/.test(uploadRoute)
  && /sharp\(bytes/.test(uploadRoute)
  && /\.jpeg\(\{ quality:\s*82/.test(uploadRoute)
  && /upsert:\s*false/.test(uploadRoute),
  'Image upload API must enforce size/rate limits and decode, sanitize, and re-encode images.')
check(/\.from\('produce-listings'\)/.test(uploadRoute)
  && /bucket_id = 'produce-listings'/.test(read('supabase/migrations/20261113000000_add_listing_gps_and_camera_storage.sql')),
  'Validated listing photo uploads must use the production bucket expected by the listing integrity trigger.')
check(/auth\.getUser\(token\)/.test(staffRoute) && /app_metadata/.test(staffRoute)
  && /sellerContactConfirmed/.test(staffRoute) && /moderate_listing/.test(staffRoute)
  && /seller_verified_at/.test(moderationMigration),
  'Staff API must verify the JWT and trusted staff role.')
check(/type="email"/.test(authModal) && /emailRedirectTo/.test(authModal),
  'New accounts must use a real email for confirmation and recovery.')
check(/@supabase\/ssr/.test(supabaseClient),
  'Browser Supabase auth must share SSR cookie sessions.')
check(/not OTP verified/.test(profilePage) && /manually verify the seller/.test(staffPanel),
  'Phone verification limitations and manual seller review must be disclosed.')
check(staffPanel.includes("import { createClient } from '../lib/supabase'"),
  'Staff panel must use the same authenticated Supabase client as the profile page.')
check(/verify_listing_photo_object/.test(photoIntegrityMigration)
  && /storage\.objects/.test(photoIntegrityMigration),
  'Database must verify that listing photos exist in the seller-owned storage folder.')
check(/drop policy if exists produce_listings_insert_own_folder/i.test(hardeningMigration)
  && /drop policy if exists produce_listings_update_own_folder/i.test(hardeningMigration)
  && /revoke insert, update on storage\.objects from public, anon, authenticated/i.test(hardeningMigration)
  && /grant insert, update, select, delete on storage\.objects to service_role/i.test(hardeningMigration),
  'Browser roles must not bypass server-validated listing photo uploads.')
check(/drop policy if exists produce_listings_insert_own_folder/i.test(storageWriteMigration)
  && /drop policy if exists produce_listings_update_own_folder/i.test(storageWriteMigration)
  && /revoke insert, update on storage\.objects from public, anon, authenticated/i.test(storageWriteMigration)
  && /grant insert, update on storage\.objects to service_role/i.test(storageWriteMigration)
  && !/revoke\s+(?:all|select)|drop policy if exists produce_listings_select_public/i.test(storageWriteMigration),
  'Storage hardening must remove client writes, retain server uploads, and keep public reads available.')
check(/create or replace view public\.public_listings\s+with \(security_invoker = true\)/i.test(hardeningMigration)
  && !/(seller_id|moderated_at|seller_verified_at|verified_at|tusk_status|network_stamp)/i.test(publicListingsView)
  && /sessionUser\?await supabase\.from\('listings'\)\.select\('\*'\)/.test(marketShell)
  && /:await supabase\.from\('listings'\)\.select\('id,category,product,location,price,seller,quantity,created_at,updated_at,photo_path,variety,title,status'\)/.test(marketShell),
  'Anonymous marketplace reads must request only approved listing columns.')
check(/set search_path = ''/i.test(hardeningMigration)
  && /extensions\.digest/.test(hardeningMigration)
  && /revoke all on function public\.award_mcg[\s\S]*?from public, anon, authenticated/i.test(hardeningMigration)
  && /grant execute on function public\.award_mcg[\s\S]*?to service_role/i.test(hardeningMigration)
  && /grant execute on function public\.compute_mfpi_daily\(\) to service_role/i.test(hardeningMigration)
  && /grant execute on function public\.verify_trade_and_reward[\s\S]*?to service_role/i.test(hardeningMigration),
  'Privileged reward and MFPI functions must use pinned paths and least-privilege grants.')
check(/get_public_mcg_tokenomics/.test(tokenomicsModal)
  && /security_invoker = true/.test(hardeningMigration)
  && /function public\.get_public_mcg_tokenomics\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/i.test(hardeningMigration)
  && /grant execute on function public\.get_public_mcg_tokenomics\(\) to anon, authenticated/i.test(hardeningMigration),
  'Public tokenomics must expose only a pinned aggregate RPC, not a definer view.')
check(/enabled:\s*false/.test(paymentConfigRoute)
  && /PAYMENTS_NOT_AVAILABLE/.test(stkRoute)
  && /PAYMENT_CALLBACK_PROCESSING_DISABLED/.test(mpesaCallbackRoute)
  && /ORDER_SETTLEMENT_NOT_AVAILABLE/.test(orderSettlementRoute),
  'STK collection, payment callbacks and escrow settlement must remain fail-closed.')
check(/ledger_transactions[\s\S]*?idempotency_key text not null unique/.test(ledgerMigration)
  && /asset_code text not null check \(asset_code in \('KES', 'MCG'\)\)/.test(ledgerMigration)
  && /deferrable initially deferred/.test(ledgerMigration)
  && /Ledger rows are immutable; post a reversal instead/.test(ledgerMigration)
  && /A reversal must exactly invert the referenced transaction/.test(ledgerMigration)
  && /grant execute on function public\.post_ledger_transaction[\s\S]*?to service_role/i.test(ledgerMigration),
  'Accounting ledger must be append-only, idempotent, double-entry balanced per asset, and reversal-based.')
check(/add_mpesa_stk_and_escrow\.sql/.test(read('supabase/held-migrations/README.md'))
  && !readdirSync(join(root, 'supabase/migrations')).some((name) => /mpesa_stk_and_escrow/i.test(name)),
  'Payment and escrow migration must remain outside the deployable migrations directory.')
check(/SUPABASE_SERVICE_ROLE_KEY/.test(staffRoute)
  && !/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(appSource),
  'Privileged Supabase keys must remain server-side.')
check(/No live exchange connection|DEMO DATA/.test(staticDemo),
  'Static GitHub Pages page must remain labelled as demo-only.')
check(/MFPI DEMO/.test(staticDemo) && !/TUSK AI RUNNING/i.test(staticDemo),
  'Static demo must not claim live AI or live index data.')
check(/X-Content-Type-Options/.test(nextConfig) && /X-Frame-Options/.test(nextConfig)
  && /Referrer-Policy/.test(nextConfig) && /Permissions-Policy/.test(nextConfig)
  && /Strict-Transport-Security/.test(nextConfig) && /poweredByHeader:\s*false/.test(nextConfig),
  'Next.js must send baseline security headers and disable the X-Powered-By header (checked in next.config.mjs, the active config).')
check(competingNextConfigs.length === 0,
  `Only next.config.mjs may exist; remove competing config: ${competingNextConfigs.join(', ')}.`)
check(/node_modules\//.test(ignore) && /\.env\.\*/.test(ignore),
  'Git ignore must exclude dependencies and local environment files.')
check(/SUPABASE_SERVICE_ROLE_KEY=/.test(envExample) && /SUPABASE_SECRET_KEY=/.test(envExample),
  'Environment template must document server-only Supabase key options.')

const directDependencies = {
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
}
for (const [name, version] of Object.entries(directDependencies)) {
  check(typeof version === 'string' && !/^(latest|\*|\^|~)/.test(version),
    `Dependency ${name} must use an exact pinned version.`)
  check(lock.packages['node_modules/' + name]?.version === version,
    `Lockfile version for ${name} must match package.json.`)
}
check(lock.lockfileVersion >= 3, 'A modern npm lockfile must be committed.')

if (failures.length) {
  console.error('Production safety checks failed:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Production safety checks passed (${appFiles.length} application source files inspected).`)
}

