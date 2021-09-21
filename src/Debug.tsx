import React, { useContext, useState, useRef, useMemo } from 'react'
import cannonDebugger from 'cannon-es-debugger'
import { useFrame } from '@react-three/fiber'
import { Vector3, Quaternion, Scene } from 'three'
import type { Body, Vec3, Quaternion as CQuaternion } from 'cannon-es'
import type { DebugOptions } from 'cannon-es-debugger'
import { context, debugContext } from './setup'
import propsToBody from './propsToBody'

import type { BodyProps, BodyShapeType } from './hooks'

type CannonDebugger = typeof cannonDebugger

export type DebugProps = Pick<DebugOptions, 'color' | 'scale'> & {
  children: React.ReactNode
  impl?: CannonDebugger
}

const v = new Vector3()
const s = new Vector3(1, 1, 1)
const q = new Quaternion()

export function Debug({
  children,
  color = 'black',
  impl = cannonDebugger,
  scale = 1,
}: DebugProps): JSX.Element {
  const [bodies] = useState<Body[]>([])
  const [refs] = useState<{ [uuid: string]: Body }>({})
  const [scene] = useState(() => new Scene())

  const { refs: cannonRefs } = useContext(context)

  const ref = useRef<ReturnType<CannonDebugger> | null>(null)

  let reset = true
  useFrame(() => {
    if (!ref.current || reset) {
      reset = false
      scene.children = []
      ref.current = impl(scene, bodies, {
        autoUpdate: false,
        color,
        scale,
      })
    }

    for (const uuid in refs) {
      cannonRefs[uuid].matrix.decompose(v, q, s)
      refs[uuid].position.copy(v as unknown as Vec3)
      refs[uuid].quaternion.copy(q as unknown as CQuaternion)
    }

    ref.current.update()
  })

  const api = useMemo(
    () => ({
      add(uuid: string, props: BodyProps, type: BodyShapeType) {
        const body = propsToBody(uuid, props, type)
        bodies.push(body)
        refs[uuid] = body
        reset = true
      },
      remove(uuid: string) {
        const index = bodies.indexOf(refs[uuid])
        if (index !== -1) bodies.splice(index, 1)
        delete refs[uuid]
        reset = true
      },
    }),
    [],
  )

  return (
    <debugContext.Provider value={api}>
      <primitive object={scene} />
      {children}
    </debugContext.Provider>
  )
}
