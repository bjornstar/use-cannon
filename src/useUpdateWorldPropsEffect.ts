import { useEffect } from 'react'
import type { CannonWorker, ProviderProps } from './shared'

type WorldPropName = 'axisIndex' | 'broadphase' | 'gravity' | 'iterations' | 'step' | 'tolerance'

type useUpdateWorldPropsEffect = Pick<
  ProviderProps,
  WorldPropName
> & { worker: CannonWorker }

export function useUpdateWorldPropsEffect({
  worker,
  gravity,
  tolerance,
  step,
  iterations,
  broadphase,
  axisIndex,
}: useUpdateWorldPropsEffect) {
  useEffect(() => void worker.postMessage({ op: 'setGravity', props: gravity }), [gravity])
  useEffect(() => void worker.postMessage({ op: 'setTolerance', props: tolerance }), [tolerance])
  useEffect(() => void worker.postMessage({ op: 'setStep', props: step }), [step])
  useEffect(() => void worker.postMessage({ op: 'setIterations', props: iterations }), [iterations])
  useEffect(() => void worker.postMessage({ op: 'setBroadphase', props: broadphase }), [broadphase])
  useEffect(() => void worker.postMessage({ op: 'setAxisIndex', props: axisIndex }), [axisIndex])
}
