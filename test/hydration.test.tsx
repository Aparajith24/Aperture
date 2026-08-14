import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act } from '@testing-library/react'
import { createStore } from '../src/createStore'

test('client hydration matches server-rendered markup with no mismatch warning', async () => {
  const useStore = createStore({ theme: 'dark', unreadCount: 3 })

  function ThemeLabel() {
    const { theme, unreadCount } = useStore()
    return (
      <p>
        {theme}/{unreadCount}
      </p>
    )
  }

  const serverHtml = renderToString(<ThemeLabel />)

  const container = document.createElement('div')
  container.innerHTML = serverHtml
  document.body.appendChild(container)

  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  await act(async () => {
    hydrateRoot(container, <ThemeLabel />)
  })

  expect(container.textContent).toBe('dark/3')
  expect(consoleError).not.toHaveBeenCalled()

  consoleError.mockRestore()
  document.body.removeChild(container)
})
