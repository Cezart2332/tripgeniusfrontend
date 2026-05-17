const { spawnSync } = require('node:child_process')

const args = process.argv.slice(2)
let watchAll = null
let coverage = false
const passthrough = []

for (const arg of args) {
  if (arg === '--coverage') {
    coverage = true
    continue
  }
  if (arg.startsWith('--coverage=')) {
    coverage = arg.split('=')[1] !== 'false'
    continue
  }
  if (arg === '--watchAll') {
    watchAll = true
    continue
  }
  if (arg.startsWith('--watchAll=')) {
    watchAll = arg.split('=')[1] !== 'false'
    continue
  }
  if (arg === '--watch') {
    watchAll = true
    continue
  }
  if (arg.startsWith('--watch=')) {
    watchAll = arg.split('=')[1] !== 'false'
    continue
  }
  passthrough.push(arg)
}

const vitestArgs = []
if (watchAll) {
  vitestArgs.push('--watch')
} else {
  vitestArgs.push('--run')
}

if (coverage) {
  vitestArgs.push('--coverage')
}

vitestArgs.push(...passthrough)

const vitestBin = require.resolve('vitest/vitest.mjs')
const result = spawnSync(process.execPath, [vitestBin, ...vitestArgs], { stdio: 'inherit' })

if (result.error) {
  console.error(result.error)
}

process.exit(result.status ?? 1)
