import { Suspense } from 'react'
import { Provider } from './Provider'

import type { FC } from 'react'
import type { ProviderProps } from './setup'

export * from './Debug'
export * from './hooks'
export * from './setup'

export const Physics: FC<ProviderProps> = (props) => {
  return (
    <Suspense fallback={null}>
      <Provider {...props} />
    </Suspense>
  )
}
