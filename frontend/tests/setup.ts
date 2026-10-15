import { config } from '@vue/test-utils'
import type { Component } from 'vue'

// FR-F23 (Decision — FR-F23 component resolution in Vitest, B): SFCs rely on Nuxt component auto-imports, which plain
// Vitest doesn't run. Register every SFC under components/ globally under the name Nuxt gives it.
const modules = import.meta.glob<{ default: Component }>('../components/**/*.vue', { eager: true })

// Port of Nuxt's naming rule (nuxt/src/components/scan.ts + resolveComponentNameSegments, default pathPrefix): words
// are split on - _ / . and case changes, directories become a PascalCase prefix, and a trailing run of directory words
// is dropped only when the file name starts with those whole words (ui/UiButton → UiButton, ui/Uiverse → UiUiverse).
// `.client`/`.server` suffixes are stripped and `index` takes the directory's name.
// ponytail: tests/component-names.test.ts pins this against Nuxt-generated names and against .nuxt/components.d.ts.
const words = (s: string): string[] => s.split(/[-_/.]+/).flatMap(part => part.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z\d]+/g) ?? [])

export function componentName(path: string): string {
  const parts = path.replace(/^.*\/components\//, '').replace(/\.vue$/, '').split('/')
  const file = (parts.pop() ?? '').replace(/(\.(client|server))?(\.global|\.island)*$/, '')
  const fileWords = words(file.toLowerCase() === 'index' ? '' : file)
  const fileKey = fileWords.join('/').toLowerCase()
  const prefix = parts.flatMap(words)
  let keep = prefix.length
  for (let i = prefix.length - 1; i >= 0; i--) {
    const suffix = prefix.slice(i).join('/').toLowerCase()
    if (fileKey === suffix || fileKey.startsWith(`${suffix}/`)) keep = i
  }
  return [...prefix.slice(0, keep), ...fileWords].map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

export const components: Record<string, Component> = Object.fromEntries(
  Object.entries(modules).map(([path, module]) => [componentName(path), module.default]),
)

config.global.components = { ...config.global.components, ...components }

// A component missing from the registry renders as an unknown element and only warns; fail the test instead.
config.global.config.warnHandler = (msg) => {
  if (msg.includes('Failed to resolve component')) throw new Error(msg)
  console.warn(`[Vue warn]: ${msg}`)
}
