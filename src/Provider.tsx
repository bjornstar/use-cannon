import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'

import { context } from './setup'

import type { FC } from 'react'
import type { Object3D } from 'three'

import type {
  ProviderContext,
  Refs,
  WorkerFrameMessage,
  ProviderProps,
  WorkerCollideEvent,
  WorkerCollideBeginEvent,
  WorkerCollideEndEvent,
  WorkerRayhitEvent,
} from './setup'

import { CannonWorkerApi } from './worker/worker-api'

const v = new Vector3()
const s = new Vector3(1, 1, 1)
const q = new Quaternion()
const m = new Matrix4()

function apply(index: number, positions: Float32Array, quaternions: Float32Array, object?: Object3D) {
  if (index !== undefined) {
    m.compose(
      v.fromArray(positions, index * 3),
      q.fromArray(quaternions, index * 4),
      object ? object.scale : s,
    )
    if (object) {
      object.matrixAutoUpdate = false
      object.matrix.copy(m)
    }
    return m
  }
  return m.identity()
}

export const Provider: FC<ProviderProps> = ({ children, shouldInvalidate, ...props }) => {
  const { invalidate } = useThree()
  const [cannonWorkerApi] = useState<CannonWorkerApi>(() => new CannonWorkerApi(props))
  const [refs] = useState<Refs>({})

  const [events] = useState<ProviderContext['events']>({})
  const [subscriptions] = useState<ProviderContext['subscriptions']>({})

  const bodies = useRef<{ [uuid: string]: number }>({})

  const loop = useCallback(() => {
    cannonWorkerApi.step()
  }, [])

  const collideHandler = ({
    body,
    contact: { bi, bj, ...contactRest },
    target,
    ...rest
  }: WorkerCollideEvent['data']) => {
    const cb = events[target]?.collide
    cb &&
      cb({
        body: refs[body],
        contact: {
          bi: refs[bi],
          bj: refs[bj],
          ...contactRest,
        },
        target: refs[target],
        ...rest,
      })
  }

  const collideBeginHandler = ({ bodyA, bodyB }: WorkerCollideBeginEvent['data']) => {
    const cbA = events[bodyA]?.collideBegin
    cbA &&
      cbA({
        body: refs[bodyB],
        op: 'event',
        target: refs[bodyA],
        type: 'collideBegin',
      })
    const cbB = events[bodyB]?.collideBegin
    cbB &&
      cbB({
        body: refs[bodyA],
        op: 'event',
        target: refs[bodyB],
        type: 'collideBegin',
      })
  }

  const collideEndHandler = ({ bodyA, bodyB }: WorkerCollideEndEvent['data']) => {
    const cbA = events[bodyA]?.collideEnd
    cbA &&
      cbA({
        body: refs[bodyB],
        op: 'event',
        target: refs[bodyA],
        type: 'collideEnd',
      })
    const cbB = events[bodyB]?.collideEnd
    cbB &&
      cbB({
        body: refs[bodyA],
        op: 'event',
        target: refs[bodyB],
        type: 'collideEnd',
      })
  }

  const rayhitHandler = ({ body, ray: { uuid, ...rayRest }, ...rest }: WorkerRayhitEvent['data']) => {
    const cb = events[uuid]?.rayhit
    cb &&
      cb({
        body: body ? refs[body] : null,
        ray: { uuid, ...rayRest },
        ...rest,
      })
  }

  const frameHandler = ({
    active,
    bodies: uuids = [],
    observations,
    positions,
    quaternions,
  }: WorkerFrameMessage['data']) => {
    for (let i = 0; i < uuids.length; i++) {
      bodies.current[uuids[i]] = i
    }
    console.log({ active, uuids })
    observations.forEach(([id, value, type]) => {
      const subscription = subscriptions[id] || {}
      const cb = subscription[type]
      // HELP: We clearly know the type of the callback, but typescript can't deal with it
      cb && cb(value as never)
    })

    if (active) {
      for (const ref of Object.values(refs)) {
        if (ref instanceof InstancedMesh) {
          for (let i = 0; i < ref.count; i++) {
            const index = bodies.current[`${ref.uuid}/${i}`]
            if (index !== undefined) {
              ref.setMatrixAt(i, apply(index, positions, quaternions))
            }
            ref.instanceMatrix.needsUpdate = true
          }
        } else {
          apply(bodies.current[ref.uuid], positions, quaternions, ref)
        }
      }
      if (shouldInvalidate) {
        invalidate()
      }
    }
  }

  // Run loop *after* all the physics objects have ran theirs!
  // Otherwise the buffers will be invalidated by the browser
  useFrame(loop)

  useLayoutEffect(() => {
    cannonWorkerApi.init()

    cannonWorkerApi.on('collide', collideHandler)
    cannonWorkerApi.on('collideBegin', collideBeginHandler)
    cannonWorkerApi.on('collideEnd', collideEndHandler)
    cannonWorkerApi.on('frame', frameHandler)
    cannonWorkerApi.on('rayhit', rayhitHandler)

    return () => {
      cannonWorkerApi.terminate()
      cannonWorkerApi.removeAllListeners()
    }
  }, [])

  const { worker } = cannonWorkerApi
  const { axisIndex, broadphase, gravity, iterations, tolerance } = props

  useEffect(() => void worker.postMessage({ op: 'setAxisIndex', props: axisIndex }), [axisIndex])
  useEffect(() => void worker.postMessage({ op: 'setBroadphase', props: broadphase }), [broadphase])
  useEffect(() => {
    if (Array.isArray(gravity)) cannonWorkerApi.gravity = gravity
  }, [gravity])
  useEffect(() => void worker.postMessage({ op: 'setIterations', props: iterations }), [iterations])
  useEffect(() => void worker.postMessage({ op: 'setTolerance', props: tolerance }), [tolerance])

  const value: ProviderContext = useMemo(
    () => ({ bodies, cannonWorkerApi, events, refs, subscriptions, worker }),
    [bodies, cannonWorkerApi, events, refs, subscriptions, worker],
  )
  return <context.Provider value={value}>{children}</context.Provider>
}
