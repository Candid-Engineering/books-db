import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface VersionPair {
  name: string
  jsVersion: string
  rustVersion: string
}

export function findMismatches(pairs: VersionPair[]): VersionPair[] {
  return pairs.filter((pair) => pair.jsVersion !== pair.rustVersion)
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const JS_PLUGIN_PREFIX = '@tauri-apps/plugin-'

export function collectPluginVersionPairs(): VersionPair[] {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
    dependencies: Record<string, string>
  }
  const cargoLock = readFileSync(join(REPO_ROOT, 'Cargo.lock'), 'utf-8')

  const pluginNames = Object.keys(packageJson.dependencies)
    .filter((dep) => dep.startsWith(JS_PLUGIN_PREFIX))
    .map((dep) => dep.slice(JS_PLUGIN_PREFIX.length))

  return pluginNames.map((name) => ({
    name,
    jsVersion: installedJsVersion(`${JS_PLUGIN_PREFIX}${name}`),
    rustVersion: rustCrateVersion(cargoLock, `tauri-plugin-${name}`),
  }))
}

function installedJsVersion(packageName: string): string {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'node_modules', packageName, 'package.json'), 'utf-8')) as {
    version: string
  }
  return pkg.version
}

function rustCrateVersion(cargoLock: string, crateName: string): string {
  const match = cargoLock.match(new RegExp(`name = "${crateName}"\\nversion = "([^"]+)"`))
  if (!match) {
    throw new Error(`Couldn't find crate "${crateName}" in Cargo.lock`)
  }
  return match[1]
}
