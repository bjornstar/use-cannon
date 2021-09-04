import React, { Suspense } from 'react'
import { default as Provider } from './Provider'
import type { ProviderProps } from './shared'

export * from './Debug'
export * from './hooks'

function Physics(props: ProviderProps) {
  return (
    <Suspense fallback={null}>
      <Provider {...props} />
    </Suspense>
  )
}

export { Physics }
