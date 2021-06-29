import cannonDebugger from 'cannon-es-debugger'
import React, { useContext, useState, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Scene, Vector3 } from 'three'

import type { Body, Quaternion as CQuaternion, Vec3 } from 'cannon-es'
import type { DebugOptions } from 'cannon-es-debugger'
import type { PropsWithChildren } from 'react'
import type { Color } from 'three'

import { context, debugContext } from './hooks'
import propsToBody from './propsToBody'

import type { DebugApi } from './shared'

type DebugInstance = {
  update: () => void
}

export type DebuggerInterface = (scene: Scene, bodies: Body[], props?: DebugOptions) => DebugInstance

export type DebugInfo = { bodies: Body[]; refs: { [uuid: string]: Body } }

export type DebugProps = PropsWithChildren<{
  color?: string | number | Color
  scale?: number
  impl?: DebuggerInterface
}>

const v = new Vector3()
const s = new Vector3(1, 1, 1)
const q = new Quaternion()

export function Debug({
  color = 'black',
  scale = 1,
  children,
  impl = cannonDebugger,
}: DebugProps): JSX.Element {
  const [debugInfo] = useState<DebugInfo>({ bodies: [], refs: {} })
  const { refs } = useContext(context)
  const [scene] = useState(() => new Scene())
  const instance = useRef<DebugInstance>()

  let lastBodies = 0
  useFrame(() => {
    if (!instance.current || lastBodies !== debugInfo.bodies.length) {
      lastBodies = debugInfo.bodies.length
      scene.children = []
      instance.current = impl(scene, debugInfo.bodies, {
        color,
        scale,
        autoUpdate: false,
      })
    }

    for (const uuid in debugInfo.refs) {
      refs[uuid].matrix.decompose(v, q, s)
      debugInfo.refs[uuid].position.copy(v as unknown as Vec3)
      debugInfo.refs[uuid].quaternion.copy(q as unknown as CQuaternion)
    }

    instance.current.update()
  })

  const api: DebugApi = useMemo(
    () => ({
      add(uuid, props, shapeType) {
        const body = propsToBody(uuid, props, shapeType)
        debugInfo.bodies.push(body)
        debugInfo.refs[uuid] = body
      },
      remove(uuid) {
        const debugBodyIndex = debugInfo.bodies.indexOf(debugInfo.refs[uuid])
        if (debugBodyIndex > -1) debugInfo.bodies.splice(debugBodyIndex, 1)
        delete debugInfo.refs[uuid]
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
