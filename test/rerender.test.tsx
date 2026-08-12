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
