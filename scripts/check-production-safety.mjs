import { readFileSync, readdirSync, statSync } from 'node:fs'
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
const photoIntegrityMigration = read('supabase/migrations/20261109070314_store_listing_photo_paths_not_absolute_urls.sql')
const moderationMigration = read('supabase/migrations/20261109071933_add_atomic_listing_moderation_audit.sql')
const staticDemo = read('index.html')
const ignore = read('.gitignore')
const envExample = read('.env.example')
const nextConfig = read('next.config.ts')
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
  && /webp\(\{ quality: 82/.test(uploadRoute)
  && /upsert:\s*false/.test(uploadRoute),
  'Image upload API must enforce size/rate limits and decode, sanitize, and re-encode images.')
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
check(/SUPABASE_SERVICE_ROLE_KEY/.test(staffRoute)
  && !/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(appSource),
  'Privileged Supabase keys must remain server-side.')
check(/No live exchange connection|DEMO DATA/.test(staticDemo),
  'Static GitHub Pages page must remain labelled as demo-only.')
check(/MFPI DEMO/.test(staticDemo) && !/TUSK AI RUNNING/i.test(staticDemo),
  'Static demo must not claim live AI or live index data.')
check(/X-Content-Type-Options/.test(nextConfig) && /X-Frame-Options/.test(nextConfig)
  && /Referrer-Policy/.test(nextConfig) && /Permissions-Policy/.test(nextConfig)
  && /Strict-Transport-Security/.test(nextConfig) && /poweredByHeader:\\s*false/.test(nextConfig),
  'Next.js must send baseline security headers and disable the X-Powered-By header.')
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
