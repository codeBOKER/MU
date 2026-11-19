import { createHmac } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "../..")
const coreEnvPath = resolve(root, "core/.env")
const localEnvPath = resolve(here, "../.env.local")

const DEV_KEYS = /^\s*VITE_DEV_(AUTO_LOGIN|ADMIN_TOKEN|STUB_ADMIN)\s*=/

function readEnv(path) {
  const values = {}
  if (!existsSync(path)) return values
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match) continue
    values[match[1]] = match[2].replace(/^["']|["']$/g, "")
  }
  return values
}

const mode = process.argv[2]
if (mode !== "on" && mode !== "off") {
  console.error("Usage: node scripts/dev-auth.mjs <on|off>")
  process.exit(1)
}

const lines = existsSync(localEnvPath)
  ? readFileSync(localEnvPath, "utf8").split(/\r?\n/).filter((line) => !DEV_KEYS.test(line))
  : []

if (mode === "off") {
  const env = readEnv(coreEnvPath)
  const secret = env.JWT_SECRET_KEY
  const algorithm = env.JWT_ALGORITHM || "HS256"
  const digest = { HS256: "sha256", HS384: "sha384", HS512: "sha512" }[algorithm]

  if (!secret) {
    console.error(`JWT_SECRET_KEY is missing in ${coreEnvPath} — cannot mint a dev token.`)
    process.exit(1)
  }
  if (!digest) {
    console.error(`Unsupported JWT_ALGORITHM=${algorithm} (expected HS256/HS384/HS512).`)
    process.exit(1)
  }

  const encode = (value) => Buffer.from(value).toString("base64url")
  const header = encode(JSON.stringify({ alg: algorithm, typ: "JWT" }))
  const payload = encode(
    JSON.stringify({
      sub: "00000000-0000-0000-0000-000000000001",
      email: "dev@chasqui.local",
      role: "super_admin",
      type: "admin_access",
      exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60,
    })
  )
  const signature = createHmac(digest, secret)
    .update(`${header}.${payload}`)
    .digest("base64url")

  lines.push(
    "VITE_DEV_AUTO_LOGIN=true",
    "VITE_DEV_STUB_ADMIN=true",
    `VITE_DEV_ADMIN_TOKEN=${header}.${payload}.${signature}`
  )
}

writeFileSync(localEnvPath, `${lines.filter(Boolean).join("\n")}\n`)

console.log(
  mode === "off"
    ? "Dev auto-login enabled — refresh the panel and open any page without logging in. Restore with: npm run auth:on"
    : "Dev auto-login disabled — the panel requires login again."
)
