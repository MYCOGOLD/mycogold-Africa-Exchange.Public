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
    if (stat.isDirectory()) return walk(path)
    return [path]
  })
}

const appFiles = [...walk('app'), ...walk('components'), ...walk('lib')]
  .filter((path) => /\.(ts|tsx|js|jsx)$/.test(path))
const appSource = appFiles.map(read).join('\n')
const tradeConfirm = read('components/TradeConfirm.tsx')
const orderPanel = read('components/OrdersPanel.tsx')
const uploadRoute = read('app/api/listings/photo/route.ts')
const staffRoute = read('app/api/staff/listings/route.ts')
const staffPanel = read('components/staff-panel.tsx')
const photoIntegrityMigration = read('supabase/migrations/20261109070033_verify_listing_photo_object.sql')
const staticDemo = read('index.html')
const ignore = read('.gitignore')
const envExample = read('.env.example')
const packageJson = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))

check(!/\.from\(['"]trades['"]\)\s*\.\s*(insert|update|delete)/i.test(appSource),
  'Browser code must not insert, update or delete legacy trades.')
check(/\.from\(['"]orders['"]\)\s*\.\s*insert\(/i.test(tradeConfirm),
  'Trade UI must create an order request, not a fake trade.')
check(/No payment has been taken|does not reserve payment/i.test(tradeConfirm),
  'Order UI must clearly state that no payment is taken.')
check(/buyer_id|seller_id/.test(orderPanel) && /accepted|rejected|cancelled/.test(orderPanel),
  'Buyer/seller order request lifecycle UI is missing.')
check(/auth\.getUser\(token\)/.test(uploadRoute) && /detectImage/.test(uploadRoute),
  'Image upload API must verify the user and inspect image bytes.')
check(/MAX_IMAGE_BYTES/.test(uploadRoute) && /upsert:\s*false/.test(uploadRoute),
  'Image upload API must enforce a size limit and non-overwriting object creation.')
check(/auth\.getUser\(token\)/.test(staffRoute) && /app_metadata/.test(staffRoute),
  'Staff API must verify the JWT and trusted staff role.')
check(/from \'..\\/lib\\/supabase\'/.test(staffPanel),\n  'Staff panel must use the same authenticated Supabase client as the profile page.')\ncheck(/verify_listing_photo_object/.test(photoIntegrityMigration) && /storage\\.objects/.test(photoIntegrityMigration),\n  'Database must verify that listing photos exist in the seller-owned storage folder.')\ncheck(/SUPABASE_SERVICE_ROLE_KEY/.test(staffRoute) && !/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(appSource),
  'Privileged Supabase keys must remain server-side.')
check(/No live exchange connection|DEMO DATA/.test(staticDemo),
  'Static GitHub Pages page must remain labelled as demo-only.')
check(/MFPI DEMO/.test(staticDemo) && !/TUSK AI RUNNING/.test(staticDemo),
  'Static demo must not claim live AI or live index data.')
check(/node_modules\//.test(ignore) && /\.env\.\*/.test(ignore),
  'Git ignore must exclude dependencies and local environment files.')
check(/SUPABASE_SERVICE_ROLE_KEY=/.test(envExample) && /SUPABASE_SECRET_KEY=/.test(envExample),
  'Environment template must document server-only Supabase key options.')
check(!/\b(latest|\*|\^|~)\b/.test(JSON.stringify(packageJson.dependencies || {})),
  'Direct dependencies must be pinned to exact versions.')
check(lock.lockfileVersion >= 3, 'A modern npm lockfile must be committed.')

if (failures.length) {
  console.error('Production safety checks failed:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Production safety checks passed (${appFiles.length} application source files inspected).`)
}
