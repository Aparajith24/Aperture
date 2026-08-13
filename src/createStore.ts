import { useRef, useSyncExternalStore } from 'react'

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
    const trackedRef = useRef<Map<keyof T, T[keyof T]>>(new Map())
    const proxyRef = useRef<T | null>(null)

    const makeProxy = (): T => {
      const nextTracked = new Map<keyof T, T[keyof T]>()
      const proxy = new Proxy({} as T, {
        get(_target, prop, receiver) {
          const value = Reflect.get(state, prop, receiver)
          nextTracked.set(prop as keyof T, value as T[keyof T])
          return value
        },
      })
      trackedRef.current = nextTracked
      proxyRef.current = proxy
      return proxy
    }

    const getSnapshot = (): T => {
      if (proxyRef.current === null) return makeProxy()

      for (const [key, lastValue] of trackedRef.current) {
        if (!Object.is(state[key], lastValue)) {
          return makeProxy()
        }
      }

      return proxyRef.current
    }

    const subscribeForReact = (onStoreChange: () => void) => subscribe(() => onStoreChange())

    return useSyncExternalStore(subscribeForReact, getSnapshot, getSnapshot)
  }

  return Object.assign(useStore, { getState, setState, subscribe })
}
