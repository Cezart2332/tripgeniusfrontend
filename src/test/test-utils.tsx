import React, { type PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { combineReducers } from 'redux'
import { render } from '@testing-library/react'
import authReducer from '../data/authSlice'

const rootReducer = combineReducers({
  auth: authReducer,
})

export type RootState = ReturnType<typeof rootReducer>
type PreloadedState = Partial<RootState>

export const createTestStore = (preloadedState?: PreloadedState) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
  })

interface RenderWithProvidersOptions {
  preloadedState?: PreloadedState
  store?: ReturnType<typeof createTestStore>
}

export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedState, store = createTestStore(preloadedState) }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper }),
  }
}
