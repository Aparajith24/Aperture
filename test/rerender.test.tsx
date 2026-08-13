import { StrictMode } from 'react'
import { render, act } from '@testing-library/react'
import { createStore } from '../src/createStore'

test('a component only re-renders when a key it actually read changes', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  const bearRenders: number[] = []
  const fishRenders: number[] = []

  function BearCounter() {
    const { bears } = useStore()
    bearRenders.push(bears)
    return <p>bears: {bears}</p>
  }

  function FishCounter() {
    const { fish } = useStore()
    fishRenders.push(fish)
    return <p>fish: {fish}</p>
  }

  render(
    <>
      <BearCounter />
      <FishCounter />
    </>,
  )

  act(() => {
    useStore.setState((s) => ({ bears: s.bears + 1 }))
  })

  expect(bearRenders).toEqual([0, 1])
  expect(fishRenders).toEqual([100]) // never re-rendered
})

test('a component reading multiple keys re-renders when any of them changes', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  const renders: Array<{ bears: number; fish: number }> = []

  function Both() {
    const { bears, fish } = useStore()
    renders.push({ bears, fish })
    return (
      <p>
        {bears}/{fish}
      </p>
    )
  }

  render(<Both />)

  act(() => useStore.setState((s) => ({ bears: s.bears + 1 })))
  act(() => useStore.setState((s) => ({ fish: s.fish + 1 })))

  expect(renders).toEqual([
    { bears: 0, fish: 100 },
    { bears: 1, fish: 100 },
    { bears: 1, fish: 101 },
  ])
})

test('setting a tracked key to the same value does not trigger a re-render', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  const bearRenders: number[] = []

  function BearCounter() {
    const { bears } = useStore()
    bearRenders.push(bears)
    return <p>bears: {bears}</p>
  }

  render(<BearCounter />)

  act(() => {
    useStore.setState({ bears: 0 }) // same value as current state
  })

  expect(bearRenders).toEqual([0]) // no second render
})

test('unmounting a component removes its listener from the store', () => {
  const useStore = createStore({ bears: 0 })

  function BearCounter() {
    const { bears } = useStore()
    return <p>bears: {bears}</p>
  }

  const { unmount } = render(<BearCounter />)
  unmount()

  // If the listener leaked, this would throw or otherwise misbehave when
  // trying to notify an unmounted component's forceRender.
  expect(() => {
    act(() => {
      useStore.setState({ bears: 1 })
    })
  }).not.toThrow()
})

test('StrictMode double-invoke does not break tracking or leak subscribers', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  const bearRenders: number[] = []
  const fishRenders: number[] = []

  function BearCounter() {
    const { bears } = useStore()
    bearRenders.push(bears)
    return <p>bears: {bears}</p>
  }

  function FishCounter() {
    const { fish } = useStore()
    fishRenders.push(fish)
    return <p>fish: {fish}</p>
  }

  const { unmount } = render(
    <StrictMode>
      <BearCounter />
      <FishCounter />
    </StrictMode>,
  )

  act(() => {
    useStore.setState((s) => ({ bears: s.bears + 1 }))
  })

  // StrictMode renders each component twice on mount (and re-invokes effects
  // via a synthetic mount/unmount/remount cycle) purely to surface impurity
  // bugs - it should not change the *outcome*: FishCounter still never
  // re-renders for a bears-only update, and the final value is still correct.
  expect(bearRenders[bearRenders.length - 1]).toBe(1)
  expect(fishRenders.every((fish) => fish === 100)).toBe(true)

  // No leaked subscribers from the StrictMode mount/unmount/remount cycle:
  // updating after a full unmount should not throw.
  unmount()
  expect(() => {
    act(() => {
      useStore.setState({ bears: 2 })
    })
  }).not.toThrow()
})
