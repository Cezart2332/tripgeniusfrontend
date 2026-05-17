import React, { type PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import type { PreloadedState } from '@reduxjs/toolkit'
import { render } from '@testing-library/react'
import authReducer from '../data/authSlice'

type AuthState = ReturnType<typeof authReducer>
export type RootState = {
  auth: AuthState
}

export const createTestStore = (preloadedState?: PreloadedState<RootState>) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState,
  })

interface RenderWithProvidersOptions {
  preloadedState?: PreloadedState<RootState>
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
