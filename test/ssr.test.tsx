// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { createStore } from '../src/createStore'

test('renderToString works with no DOM/browser globals available', () => {
  const useStore = createStore({ theme: 'dark', unreadCount: 3 })

  function ThemeLabel() {
    const { theme, unreadCount } = useStore()
    return (
      <p>
        {theme}/{unreadCount}
      </p>
    )
  }

  const html = renderToString(<ThemeLabel />)

  expect(html).toContain('dark')
  expect(html).toContain('3')
})

test('renderToString reflects state set before the render call', () => {
  const useStore = createStore({ theme: 'light' })
  useStore.setState({ theme: 'dark' })

  function ThemeLabel() {
    const { theme } = useStore()
    return <p>{theme}</p>
  }

  const html = renderToString(<ThemeLabel />)

  expect(html).toContain('dark')
})
