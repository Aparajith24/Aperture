// Benchmark harness for the research paper (docs/PAPER.md), not part of the
// unit test suite's correctness guarantees. Run with:
//   npx vitest run bench/rerender-bench.test.tsx
//
// Measures, for three re-render strategies over the same workload, (a) how
// many component re-renders a fixed sequence of updates produces and (b) how
// long that sequence takes. Strategies:
//
//  - naive:    React Context + lifted useState. Every consumer re-renders on
//              every setState, regardless of which field it reads.
//  - selector: a hand-rolled useSyncExternalStore + selector store (the
//              mechanism Zustand/Redux consumers use). Correct fine-grained
//              re-rendering, paid for with an explicit selector per call site.
//  - aperture: createStore from src/createStore.ts. Same fine-grained
//              re-rendering as `selector`, no selector authored.
import { createContext, useContext, useState, useSyncExternalStore, useRef } from 'react'
import { render, act } from '@testing-library/react'
import { createStore } from '../src/createStore'

type State = Record<string, number>

function makeInitialState(fieldCount: number): State {
  const state: State = {}
  for (let i = 0; i < fieldCount; i++) state[`field${i}`] = 0
  return state
}

// --- naive: Context + lifted useState -------------------------------------

function runNaive(fieldCount: number, componentCount: number, updateCount: number) {
  const initial = makeInitialState(fieldCount)
  const Ctx = createContext<{ state: State; setState: (s: State) => void } | null>(null)
  let setStateRef!: (s: State) => void
  let getStateRef!: () => State

  function Provider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState(initial)
    setStateRef = setState
    getStateRef = () => state
    return <Ctx.Provider value={{ state, setState }}>{children}</Ctx.Provider>
  }

  const renderCounts = new Array(componentCount).fill(0)

  function Field({ index }: { index: number }) {
    const ctx = useContext(Ctx)!
    renderCounts[index]++
    return <span>{ctx.state[`field${index % fieldCount}`]}</span>
  }

  render(
    <Provider>
      {Array.from({ length: componentCount }, (_, i) => (
        <Field key={i} index={i} />
      ))}
    </Provider>,
  )

  const start = performance.now()
  for (let i = 0; i < updateCount; i++) {
    const field = `field${i % fieldCount}`
    act(() => {
      setStateRef({ ...getStateRef(), [field]: getStateRef()[field] + 1 })
    })
  }
  const elapsedMs = performance.now() - start

  return { totalRenders: renderCounts.reduce((a, b) => a + b, 0), elapsedMs }
}

// --- selector: hand-rolled useSyncExternalStore + selector (Zustand-shape) -

function createSelectorStore(initial: State) {
  let state = initial
  const listeners = new Set<() => void>()
  const getState = () => state
  const setState = (partial: Partial<State>) => {
    state = { ...state, ...partial }
    listeners.forEach((l) => l())
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  function useStore<U>(selector: (s: State) => U): U {
    return useSyncExternalStore(subscribe, () => selector(getState()))
  }
  return Object.assign(useStore, { getState, setState })
}

function runSelector(fieldCount: number, componentCount: number, updateCount: number) {
  const initial = makeInitialState(fieldCount)
  const useStore = createSelectorStore(initial)
  const renderCounts = new Array(componentCount).fill(0)

  function Field({ index }: { index: number }) {
    const value = useStore((s) => s[`field${index % fieldCount}`])
    renderCounts[index]++
    return <span>{value}</span>
  }

  render(
    <>
      {Array.from({ length: componentCount }, (_, i) => (
        <Field key={i} index={i} />
      ))}
    </>,
  )

  const start = performance.now()
  for (let i = 0; i < updateCount; i++) {
    const field = `field${i % fieldCount}`
    act(() => {
      useStore.setState({ [field]: useStore.getState()[field] + 1 })
    })
  }
  const elapsedMs = performance.now() - start

  return { totalRenders: renderCounts.reduce((a, b) => a + b, 0), elapsedMs }
}

// --- aperture: src/createStore.ts, no selectors ----------------------------

function runAperture(fieldCount: number, componentCount: number, updateCount: number) {
  const initial = makeInitialState(fieldCount)
  const useStore = createStore(initial)
  const renderCounts = new Array(componentCount).fill(0)

  function Field({ index }: { index: number }) {
    const state = useStore()
    const value = state[`field${index % fieldCount}`]
    renderCounts[index]++
    return <span>{value}</span>
  }

  render(
    <>
      {Array.from({ length: componentCount }, (_, i) => (
        <Field key={i} index={i} />
      ))}
    </>,
  )

  const start = performance.now()
  for (let i = 0; i < updateCount; i++) {
    const field = `field${i % fieldCount}`
    act(() => {
      useStore.setState({ [field]: useStore.getState()[field] + 1 })
    })
  }
  const elapsedMs = performance.now() - start

  return { totalRenders: renderCounts.reduce((a, b) => a + b, 0), elapsedMs }
}

const SCENARIOS = [
  { fieldCount: 10, componentCount: 10, updateCount: 200 },
  { fieldCount: 50, componentCount: 50, updateCount: 200 },
  { fieldCount: 100, componentCount: 200, updateCount: 500 },
]

test('re-render + throughput benchmark across strategies', () => {
  const rows: string[] = []
  rows.push('fields\tcomponents\tupdates\tstrategy\ttotalRenders\telapsedMs')

  for (const { fieldCount, componentCount, updateCount } of SCENARIOS) {
    const naive = runNaive(fieldCount, componentCount, updateCount)
    const selector = runSelector(fieldCount, componentCount, updateCount)
    const aperture = runAperture(fieldCount, componentCount, updateCount)

    rows.push(`${fieldCount}\t${componentCount}\t${updateCount}\tnaive\t${naive.totalRenders}\t${naive.elapsedMs.toFixed(1)}`)
    rows.push(`${fieldCount}\t${componentCount}\t${updateCount}\tselector\t${selector.totalRenders}\t${selector.elapsedMs.toFixed(1)}`)
    rows.push(`${fieldCount}\t${componentCount}\t${updateCount}\taperture\t${aperture.totalRenders}\t${aperture.elapsedMs.toFixed(1)}`)

    // Sanity: aperture must match the hand-selected selector store exactly -
    // same fine-grained re-render count, with zero selectors authored.
    expect(aperture.totalRenders).toBe(selector.totalRenders)
    // And both must render strictly fewer times than the naive re-render-all baseline.
    expect(aperture.totalRenders).toBeLessThan(naive.totalRenders)
  }

  console.log('\n' + rows.join('\n') + '\n')
})
