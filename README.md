<h1 align="center">
🔎 Aperture
</h1>

<p align="center">
Zero-selector fine-grained state for React, sub-1kb
</p>

<p align="center">

[![npm version](https://img.shields.io/npm/v/aperture-store.svg)](https://www.npmjs.com/package/aperture-store)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)
![React](https://img.shields.io/badge/react-%3E%3D16.8-61DAFB)
![Vitest](https://img.shields.io/badge/tested%20with-vitest-6E9F18)
![Bundle size](https://img.shields.io/badge/bundle-388B%20brotli-brightgreen)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Status](https://img.shields.io/badge/status-learning%20project-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

</p>

A dependency-free React state store that automatically figures out which components need to
re-render, by watching what each component actually reads off the store during render. No
selector functions, no `shallow` comparators, no manual dependency arrays.

```js
const useStore = createStore({ theme: 'light', unreadCount: 0 })

function ThemeLabel() {
  const { theme } = useStore() // only re-renders when `theme` changes
  return <p>{theme}</p>
}
```

## What it is

A store implemented as a plain pub-sub object (`getState`/`setState`/`subscribe`), exposed to
React through a hook. The hook hands the component a `Proxy` wrapping the current state instead
of the raw object. Reading a property off that Proxy, e.g. `const { theme } = useStore()`,
silently records "this component reads `theme`" via the Proxy's `get` trap. On the next
`setState`, the store checks only the keys each individual component actually read last render,
and only forces a re-render if one of those specific values changed.

## What it solves

Sharing state across components without prop-drilling usually means picking one of two costs:

- **Re-render everything on every change** (a plain `useState`/context lifted up, or a naive
  pub-sub store): simple, but every subscriber re-renders on every update, whether or not it
  displays the thing that changed.
- **Write a selector for every value, everywhere** (Zustand-style `useStore(s => s.theme)`): fixes
  the over-rendering, but it's a manual bookkeeping tax on every call site, and forgetting a
  selector fails *silently*, with no error and no warning, just a slower app.

Aperture's Proxy-tracking removes the second cost without reintroducing the first: you write
plain destructuring, and correct fine-grained re-rendering happens as a side effect of how you
naturally read the value.

### One store, four implementations

Same shared state, `{ theme, unreadCount }`, a theme label and a notification badge that should
each only re-render for the field they display.

**Plain React (`useState` lifted up, or Context):** state has to live in a shared parent and get
passed down, or go through Context, and every consumer of that Context re-renders on any change
to the value unless you split it into multiple contexts or hand-roll memoization yourself.

```jsx
const StoreContext = createContext(null)

function Provider({ children }) {
  const [state, setState] = useState({ theme: 'light', unreadCount: 0 })
  return <StoreContext.Provider value={{ state, setState }}>{children}</StoreContext.Provider>
}

function ThemeLabel() {
  const { state } = useContext(StoreContext) // re-renders on ANY state change, incl. unreadCount
  return <p>{state.theme}</p>
}
```

**Redux (with Redux Toolkit):** a slice, a store, a `Provider`, and a selector at every call
site, correct re-rendering depends on remembering the selector.

```jsx
const slice = createSlice({
  name: 'app',
  initialState: { theme: 'light', unreadCount: 0 },
  reducers: {
    themeChanged: (state, action) => { state.theme = action.payload },
  },
})
const store = configureStore({ reducer: slice.reducer })

function ThemeLabel() {
  const theme = useSelector((state) => state.theme) // forget this selector, over-render returns
  return <p>{theme}</p>
}
```

**Zustand:** no `Provider` needed, but the same selector requirement as Redux, per call site,
per value.

```js
const useStore = create((set) => ({
  theme: 'light',
  unreadCount: 0,
  setTheme: (theme) => set({ theme }),
}))

function ThemeLabel() {
  const theme = useStore((s) => s.theme) // forget this selector, over-render returns
  return <p>{theme}</p>
}
```

**Aperture:** no `Provider`, no selector, no reducers/actions boilerplate. Destructure what you
need, correct re-rendering is automatic.

```js
const useStore = createStore({ theme: 'light', unreadCount: 0 })

function ThemeLabel() {
  const { theme } = useStore() // just works
  return <p>{theme}</p>
}
```

## What the tests show

The whole point of this project is that "only the components that need to re-render, do" is a
provable claim, not a marketing line, so it's asserted directly with render-count tracking
against real React components (React Testing Library), not eyeballed from a demo.

| test | proves |
|---|---|
| `a component only re-renders when a key it actually read changes` | updating one field never re-renders a component that only destructured a different, unrelated field |
| `a component reading multiple keys re-renders when any of them changes` | tracking isn't limited to one key per component |
| `setting a tracked key to the same value does not trigger a re-render` | `Object.is` comparison bails out on no-op updates, not just unrelated ones |
| `unmounting a component removes its listener from the store` | no dangling subscriptions / memory leak after unmount |
| 8 additional tests in `createStore.test.ts` | core store mechanics: `setState` merge/updater-function forms, immutability, `subscribe`/unsubscribe, multiple independent listeners, rapid consecutive updates all applying in order |

```
 ✓ test/createStore.test.ts (8 tests)
 ✓ test/rerender.test.tsx (4 tests)

 Test Files  2 passed (2)
      Tests  12 passed (12)
```

Bundle size is checked the same way: measured, not asserted.

```
$ npx size-limit
Size limit: 1 kB
Size:       388 B with all dependencies, minified and brotlied
```

## Install

```bash
npm install aperture-store
```

Requires React >=16.8 as a peer dependency (not bundled).

## Quick start

```js
import { createStore } from 'aperture-store'

const useStore = createStore({ theme: 'light', unreadCount: 0 })

function ThemeLabel() {
  const { theme } = useStore()
  return <p>{theme}</p>
}

function NotificationBadge() {
  const { unreadCount } = useStore()
  return <p>{unreadCount}</p>
}

// anywhere outside React
useStore.setState({ theme: 'dark' }) // NotificationBadge does not re-render
```

## Who this is for

- You want shared state across a handful of components and don't want to think about selectors,
  `shallow`, or memoization to get correct re-render behavior.
- You're comfortable with a small, unopinionated, flat-state store: no middleware, no devtools,
  no computed/derived state, no persistence.

## What this is not

- **Not a Redux/Zustand replacement for large apps.** No middleware system, no time-travel
  debugging, no async action helpers, no cross-tab sync. Deliberately out of scope, not "coming
  later."
- **Not deep-tracking.** State is flat by design. Nested object updates work the same way they do
  in any immutable-update store (spread a new nested object in), but mutating a nested object in
  place won't be detected.
- **Not safe to read outside of render.** Tracking only sees property reads that happen inside a
  component's render body. Reading the store's return value inside a `useEffect`, an event
  handler, or storing it in a variable for later use happens *after* the tracking window for that
  render has already closed. See [Known limitations](#known-limitations).
- **Not yet verified under React concurrent rendering.** The subscribe/force-render mechanism is
  hand-rolled (`useReducer` + `useEffect`), not built on `useSyncExternalStore`. It hasn't been
  tested for tearing under concurrent features. Use it for ordinary UI state, not
  correctness-critical app state, until this is addressed.

## Known limitations

**Reads outside of render don't get tracked.** The Proxy's `get` trap only fires when a property
is actually accessed, and the store only knows to compare a key on the next update if that read
happened during *this* render, so it can hand the tracked set off to the subscribe callback set up
in that render's effect.

```js
function NotificationBadge() {
  const store = useStore()

  useEffect(() => {
    console.log(store.unreadCount) // reads the real value fine, but too late to be tracked
  }, [])

  const { theme } = store // tracked correctly - this read is inside the render body
  return <p>{theme}</p>
}
```

This is a known v1 tradeoff of the design, not a bug slated for a fix this cycle.

## This is a learning project

Aperture was built to actually *understand*, not just use, the mechanisms real state libraries are
built on: pub-sub, why naive shared state over-renders, why selector-based libraries exist and
what they cost, JS `Proxy` traps, and (as an explored stretch goal) why `useSyncExternalStore`
exists and what "tearing" under concurrent rendering means. The implementation was deliberately
built up in stages: a naive re-render-everything store, then manual selectors, then Proxy
auto-tracking replacing the selectors, so each stage's problem could be felt in a real test before
the next stage fixed it, rather than jumping straight to the "clever" version. The
[Known limitations](#known-limitations) section above is left honest and unresolved on purpose: a
working v1 that's upfront about its edges is worth more than a v2 that hides them.

## License

MIT.
