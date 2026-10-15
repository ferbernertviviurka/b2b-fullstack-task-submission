import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiButton from '~/components/ui/UiButton.vue'

describe('UiButton (FR-F21)', () => {
  it('base owns shape, cursors, disabled look and the AA focus ring', () => {
    expect(mount(UiButton, { props: { label: 'Go' } }).classes()).toEqual(expect.arrayContaining([
      'rounded-lg', 'font-medium', 'transition', 'cursor-pointer', 'disabled:cursor-not-allowed', 'disabled:opacity-50',
      'focus-visible:outline-hidden', 'focus-visible:ring-2', 'focus-visible:ring-gray-900', 'focus-visible:ring-offset-2',
    ]))
  })

  it.each([
    ['primary', ['bg-emerald-700', 'text-white', 'hover:bg-emerald-800']],
    ['danger-soft', ['bg-red-50', 'text-red-700']],
    ['danger-ghost', ['text-red-700', 'hover:bg-red-50', 'dark:hover:bg-red-950/40']], // kept (OCP): FR-F31 extends, not modifies
    ['neutral-outline', ['border', 'border-gray-300', 'bg-white', 'text-gray-900']],
  ] as const)('intent %s → %j', (intent, classes) => {
    expect(mount(UiButton, { props: { label: 'Go', intent } }).classes()).toEqual(expect.arrayContaining([...classes]))
  })

  // FR-F32 regression guard (Decision — FR-F32 hover fix, A): the diagnosis showed the classes were never dropped by the
  // merge but the feedback was invisible (1.05–1.09:1 shades) and touch had none. Each intent must render EXACTLY the
  // decided hover and pressed shades, even with a parent class merged in (StatusActions passes layout classes), so a
  // swap back to (or an extra) imperceptible shade fails.
  it.each([
    ['primary', ['hover:bg-emerald-800'], ['active:bg-emerald-900']],
    ['danger-soft', ['hover:bg-red-100', 'dark:hover:bg-red-950/60'], ['active:bg-red-200', 'active:text-red-800']],
    ['danger-ghost', ['hover:bg-red-50', 'dark:hover:bg-red-950/40'], ['active:bg-red-100']],
    ['neutral-outline', ['hover:border-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-800'], ['active:bg-gray-200']],
  ] as const)('FR-F32: intent %s renders exactly hover %j and pressed %j after a parent class merge', (intent, hover, active) => {
    const classes = mount(UiButton, { props: { label: 'Go', intent, class: 'min-h-11 w-full sm:min-h-0 sm:w-auto' } }).classes()
    expect(classes.filter(c => /^(dark:)?hover:/.test(c)).sort()).toEqual([...hover].sort())
    expect(classes.filter(c => /^(dark:)?active:/.test(c)).sort()).toEqual([...active].sort())
  })

  it('FR-F31: danger-soft is exactly the row\'s classes plus active:text-red-800 (Decision — FR-F31 pressed-state contrast, A)', () => {
    const classes = mount(UiButton, { props: { label: 'Reject', intent: 'danger-soft' } }).classes()
    expect(classes).toEqual(expect.arrayContaining([
      'bg-red-50', 'text-red-700', 'hover:bg-red-100', 'active:bg-red-200', 'dark:bg-red-950/40', 'dark:text-red-300', 'dark:hover:bg-red-950/60',
      'active:text-red-800',
    ]))
    expect(classes.filter(c => c.startsWith('active:text-'))).toEqual(['active:text-red-800']) // red-700 on red-200 is 4.42:1
  })

  it.each([
    ['sm', ['px-3.5', 'py-2', 'text-sm']],
    ['md', ['px-4', 'py-2.5', 'text-sm']],
  ] as const)('size %s → %j', (size, classes) => {
    expect(mount(UiButton, { props: { label: 'Go', size } }).classes()).toEqual(expect.arrayContaining([...classes]))
  })

  it("merges a parent class through tailwind-variants' built-in merge: conflicts are replaced, not stacked", () => {
    const classes = mount(UiButton, { props: { label: 'Go', size: 'sm', class: 'px-0 mt-4' } }).classes()

    expect(classes).toEqual(expect.arrayContaining(['px-0', 'mt-4', 'py-2']))
    expect(classes).not.toContain('px-3.5')
  })

  it('loading: disabled, spinner shown, label kept transparent for width and accessible name', async () => {
    const wrapper = mount(UiButton, { props: { label: 'Save', loading: true } })

    expect(wrapper.get<HTMLButtonElement>('button').element.disabled).toBe(true)
    expect(wrapper.get('[data-test="spinner"]').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('Save')
    expect(wrapper.get('span').classes()).toContain('opacity-0')

    await wrapper.setProps({ loading: false })
    expect(wrapper.get<HTMLButtonElement>('button').element.disabled).toBe(false)
    expect(wrapper.find('[data-test="spinner"]').exists()).toBe(false)
    expect(wrapper.get('span').classes()).not.toContain('opacity-0')
  })

  it('disabled without loading: no spinner, no click', async () => {
    const wrapper = mount(UiButton, { props: { label: 'Go', disabled: true } })

    expect(wrapper.get<HTMLButtonElement>('button').element.disabled).toBe(true)
    expect(wrapper.find('[data-test="spinner"]').exists()).toBe(false)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
