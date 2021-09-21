import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Debug, Physics, usePlane, useSphere } from '@react-three/cannon'

import type { SphereProps } from '@react-three/cannon'

function Ball(props: SphereProps) {
  const [ref, api] = useSphere(() => ({
    args: 1,
    ...props,
  }))
  const [sleeping, setSleeping] = useState(false)

  // Very quick demo to test forced sleep states. Catch ball mid-air to stop it.
  const toggle = () => {
    if (sleeping) {
      setSleeping(false)
      api.wakeUp()
    } else {
      setSleeping(true)
      api.sleep()
    }
  }

  return (
    <mesh castShadow receiveShadow ref={ref} onClick={toggle}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="blue" transparent opacity={0.5} />
    </mesh>
  )
}

function Plane() {
  const [ref] = usePlane(() => ({ type: 'Static', rotation: [-Math.PI / 2, 0, 0] }))
  return (
    <mesh receiveShadow ref={ref}>
      <planeBufferGeometry args={[20, 20]} />
      <shadowMaterial color="#171717" />
    </mesh>
  )
}

export default function App() {
  return (
    <Canvas shadows camera={{ position: [-1, 2, 4] }}>
      <color attach="background" args={['#a6d1f6']} />
      <hemisphereLight />
      <directionalLight position={[5, 10, 5]} castShadow />
      <Physics allowSleep>
        <Debug scale={1.1}>
          <Plane />
          <Ball mass={1} position={[0, 5, 0]} />
        </Debug>
      </Physics>
    </Canvas>
  )
}
