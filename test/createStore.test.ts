import { createStore } from '../src/createStore'

test('getState returns the initial state', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  expect(useStore.getState()).toEqual({ bears: 0, fish: 100 })
})

test('setState with a partial object merges into existing state', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  useStore.setState({ bears: 1 })
  expect(useStore.getState()).toEqual({ bears: 1, fish: 100 })
})

test('setState with an updater function receives the current state', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  useStore.setState((s) => ({ bears: s.bears + 1 }))
  useStore.setState((s) => ({ bears: s.bears + 1 }))
  expect(useStore.getState()).toEqual({ bears: 2, fish: 100 })
})

test('setState produces a new state object reference, not a mutation', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  const before = useStore.getState()
  useStore.setState({ bears: 1 })
  const after = useStore.getState()
  expect(after).not.toBe(before)
  expect(before).toEqual({ bears: 0, fish: 100 }) // untouched
})

test('subscribe calls the listener with the new state on every setState', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  const seen: Array<{ bears: number; fish: number }> = []
  useStore.subscribe((state) => seen.push(state))

  useStore.setState({ bears: 1 })
  useStore.setState({ fish: 101 })

  expect(seen).toEqual([
    { bears: 1, fish: 100 },
    { bears: 1, fish: 101 },
  ])
})

test('subscribe returns an unsubscribe function that stops further notifications', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  const seen: number[] = []
  const unsubscribe = useStore.subscribe((state) => seen.push(state.bears))

  useStore.setState({ bears: 1 })
  unsubscribe()
  useStore.setState({ bears: 2 })

  expect(seen).toEqual([1]) // the post-unsubscribe update was never recorded
})

test('unsubscribing one listener does not affect other listeners', () => {
  const useStore = createStore({ bears: 0, fish: 100 })
  const seenA: number[] = []
  const seenB: number[] = []

  const unsubscribeA = useStore.subscribe((state) => seenA.push(state.bears))
  useStore.subscribe((state) => seenB.push(state.bears))

  useStore.setState({ bears: 1 })
  unsubscribeA()
  useStore.setState({ bears: 2 })

  expect(seenA).toEqual([1])
  expect(seenB).toEqual([1, 2])
})

test('rapid consecutive setState calls all apply, in order, with no dropped updates', () => {
  const useStore = createStore({ bears: 0 })
  const seen: number[] = []
  useStore.subscribe((state) => seen.push(state.bears))

  for (let i = 0; i < 5; i++) {
    useStore.setState((s) => ({ bears: s.bears + 1 }))
  }

  expect(useStore.getState().bears).toBe(5)
  expect(seen).toEqual([1, 2, 3, 4, 5])
})
