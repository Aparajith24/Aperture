import { useEffect, useReducer, useRef } from 'react'

type Listener<T> = (state: T) => void
type SetStateAction<T> = Partial<T> | ((state: T) => Partial<T>)

export function createStore<T extends object>(initialState: T) {
  let state = initialState
  const listeners = new Set<Listener<T>>()

  const getState = (): T => state

  const setState = (partial: SetStateAction<T>): void => {
    const partialState = typeof partial === 'function' ? (partial as (state: T) => Partial<T>)(state) : partial
    state = { ...state, ...partialState }
    listeners.forEach((listener) => listener(state))
  }

  const subscribe = (listener: Listener<T>): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function useStore(): T {
    const [, forceRender] = useReducer((c: number) => c + 1, 0)
    const tracked = useRef<Map<keyof T, T[keyof T]>>(new Map()).current
    tracked.clear()

    useEffect(() => {
      return subscribe((newState) => {
        for (const [key, lastValue] of tracked) {
          if (!Object.is(newState[key], lastValue)) {
            forceRender()
            return
          }
        }
      })
    }, [])

    return new Proxy(state, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        tracked.set(prop as keyof T, value as T[keyof T])
        return value
      },
    })
  }

  return Object.assign(useStore, { getState, setState, subscribe })
}
