import type { RayOptions } from 'cannon-es'
import type { MutableRefObject } from 'react'
import type { Euler } from 'three'
import { Object3D, InstancedMesh, DynamicDrawUsage, Vector3, MathUtils } from 'three'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  AtomicProps,
  BodyProps,
  CannonEvent,
  CannonEvents,
  DebugApi,
  PreparedArgs,
  PreparedBodyProps,
  ProviderContext,
  PublicArgs,
  PublicBodyProps,
  ShapeType,
  Subscriptions,
  Triplet,
  VectorProps,
} from './shared'

export const context = createContext<ProviderContext>({} as ProviderContext)
export const debugContext = createContext<DebugApi>(null!)

interface WorkerVec {
  set: (x: number, y: number, z: number) => void
  copy: ({ x, y, z }: Vector3 | Euler) => void
  subscribe: (callback: (value: Triplet) => void) => void
}

export type WorkerProps<T> = {
  [K in keyof T]: {
    set: (value: T[K]) => void
    subscribe: (callback: (value: T[K]) => void) => () => void
  }
}
export interface WorkerApi extends WorkerProps<AtomicProps> {
  position: WorkerVec
  rotation: WorkerVec
  velocity: WorkerVec
  angularVelocity: WorkerVec
  linearFactor: WorkerVec
  angularFactor: WorkerVec
  applyForce: (force: Triplet, worldPoint: Triplet) => void
  applyImpulse: (impulse: Triplet, worldPoint: Triplet) => void
  applyLocalForce: (force: Triplet, localPoint: Triplet) => void
  applyLocalImpulse: (impulse: Triplet, localPoint: Triplet) => void
  wakeUp: () => void
  sleep: () => void
}

interface PublicApi extends WorkerApi {
  at: (index: number) => WorkerApi
}
export type Api = [MutableRefObject<Object3D | undefined>, PublicApi]

export type ConstraintTypes = 'PointToPoint' | 'ConeTwist' | 'Distance' | 'Lock'

export interface ConstraintOptns {
  maxForce?: number
  collideConnected?: boolean
  wakeUpBodies?: boolean
}

export interface PointToPointConstraintOpts extends ConstraintOptns {
  pivotA: Triplet
  pivotB: Triplet
}

export interface ConeTwistConstraintOpts extends ConstraintOptns {
  pivotA?: Triplet
  axisA?: Triplet
  pivotB?: Triplet
  axisB?: Triplet
  angle?: number
  twistAngle?: number
}
export interface DistanceConstraintOpts extends ConstraintOptns {
  distance?: number
}

export interface HingeConstraintOpts extends ConstraintOptns {
  pivotA?: Triplet
  axisA?: Triplet
  pivotB?: Triplet
  axisB?: Triplet
}

export type LockConstraintOpts = ConstraintOptns

export interface SpringOptns {
  restLength?: number
  stiffness?: number
  damping?: number
  worldAnchorA?: Triplet
  worldAnchorB?: Triplet
  localAnchorA?: Triplet
  localAnchorB?: Triplet
}

const temp = new Object3D()

function opString(action: string, type: string) {
  return action + type.charAt(0).toUpperCase() + type.slice(1)
}

function getUUID(ref: MutableRefObject<Object3D>, index?: number) {
  return index !== undefined ? `${ref.current.uuid}/${index}` : ref.current.uuid
}

function post(ref: MutableRefObject<Object3D>, worker: Worker, op: string, index?: number, props?: any) {
  return ref.current && worker.postMessage({ op, uuid: getUUID(ref, index), props })
}

function subscribe(
  ref: MutableRefObject<Object3D>,
  worker: Worker,
  subscriptions: Subscriptions,
  type: string,
  index?: number,
  target?: string,
) {
  return (callback: (value: any) => void) => {
    const id = subscriptionGuid++
    subscriptions[id] = callback
    post(ref, worker, 'subscribe', index, {
      id,
      type,
      target: target === undefined || target === null ? 'bodies' : target,
    })
    return () => {
      delete subscriptions[id]
      worker.postMessage({ op: 'unsubscribe', props: id })
    }
  }
}

function prepare(
  object: Object3D,
  {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    userData = {},
  }: Pick<BodyProps, 'position' | 'rotation' | 'userData'>,
) {
  object.position.set(...position)
  object.rotation.set(...rotation)
  object.updateMatrix()
  object.userData = userData
}

function setupCollision(
  events: CannonEvents,
  {
    onCollide,
    onCollideBegin,
    onCollideEnd,
  }: Pick<BodyProps, 'onCollide' | 'onCollideBegin' | 'onCollideEnd'>,
  uuid: string,
) {
  if (onCollide || onCollideBegin || onCollideEnd) {
    events[uuid] = (ev: CannonEvent) => {
      switch (ev.type) {
        case 'collide':
          if (onCollide) onCollide(ev)
          break
        case 'collideBegin':
          if (onCollideBegin) onCollideBegin(ev)
          break
        case 'collideEnd':
          if (onCollideEnd) onCollideEnd(ev)
          break
      }
    }
  }
}

let subscriptionGuid = 0

type GetByIndex<T extends ShapeType | 'Compound'> = (index: number) => PublicBodyProps<T>

function useBody<T extends ShapeType | 'Compound'>(
  shapeType: T,
  fn: GetByIndex<T>,
  fwdRef?: MutableRefObject<Object3D>,
  deps: any[] = [],
): Api {
  const ref = fwdRef ? fwdRef : useRef(new Object3D())
  const { worker, refs, events, subscriptions } = useContext(context)
  const debugApi = useContext(debugContext)

  useLayoutEffect(() => {
    if (!ref.current) {
      // When the reference isn't used we create a stub
      // The body doesn't have a visual representation but can still be constrained
      ref.current = new Object3D()
    }

    const object = ref.current
    const currentWorker = worker
    const objectCount =
      object instanceof InstancedMesh ? (object.instanceMatrix.setUsage(DynamicDrawUsage), object.count) : 1
    const uuid =
      object instanceof InstancedMesh
        ? new Array(objectCount).fill(0).map((_, i) => `${object.uuid}/${i}`)
        : [object.uuid]

    const props: PreparedBodyProps<T>[] = uuid.map((uuid: string, i: number): PreparedBodyProps<T> => {
      const { args = [], ...props } = fn(i)

      if (object instanceof InstancedMesh) {
        prepare(temp, props)
        object.setMatrixAt(i, temp.matrix)
        object.instanceMatrix.needsUpdate = true
      } else {
        prepare(object, props)
      }

      refs[uuid] = object
      setupCollision(events, props, uuid)
      const preparedArgs: PreparedArgs[T] = prepareArgs[shapeType](...args)
      const preparedProps: PreparedBodyProps<T> = { ...props, args: preparedArgs }
      if (debugApi) debugApi.add(uuid, preparedProps, shapeType)
      return preparedProps
    })

    // Register on mount, unregister on unmount
    currentWorker.postMessage({
      op: 'addBodies',
      type: shapeType,
      uuid,
      props: props.map(({ onCollide, onCollideBegin, onCollideEnd, ...serializableProps }) => {
        return { onCollide: Boolean(onCollide), ...serializableProps }
      }),
    })

    return () => {
      uuid.forEach((id) => {
        delete refs[id]
        if (debugApi) debugApi.remove(id)
        delete events[id]
      })
      currentWorker.postMessage({ op: 'removeBodies', uuid })
    }
  }, deps)

  const api = useMemo(() => {
    const makeVec = (type: Exclude<keyof VectorProps, 'rotation'> | 'quaternion', index?: number) => ({
      set: (x: number, y: number, z: number) => post(ref, worker, opString('set', type), index, [x, y, z]),
      copy: ({ x, y, z }: Vector3 | Euler) => post(ref, worker, opString('set', type), index, [x, y, z]),
      subscribe: subscribe(ref, worker, subscriptions, type, index),
    })
    const makeAtomic = (type: keyof AtomicProps, index?: number) => ({
      set: (value: any) => post(ref, worker, opString('set', type), index, value),
      subscribe: subscribe(ref, worker, subscriptions, type, index),
    })

    function makeApi(index?: number): WorkerApi {
      return {
        // Vectors
        angularFactor: makeVec('angularFactor', index),
        angularVelocity: makeVec('angularVelocity', index),
        linearFactor: makeVec('linearFactor', index),
        position: makeVec('position', index),
        rotation: makeVec('quaternion', index),
        velocity: makeVec('velocity', index),
        // Atomic props
        allowSleep: makeAtomic('allowSleep', index),
        angularDamping: makeAtomic('angularDamping', index),
        collisionFilterGroup: makeAtomic('collisionFilterGroup', index),
        collisionFilterMask: makeAtomic('collisionFilterMask', index),
        collisionResponse: makeAtomic('collisionResponse', index),
        fixedRotation: makeAtomic('fixedRotation', index),
        isTrigger: makeAtomic('isTrigger', index),
        linearDamping: makeAtomic('linearDamping', index),
        mass: makeAtomic('mass', index),
        material: makeAtomic('material', index),
        sleepSpeedLimit: makeAtomic('sleepSpeedLimit', index),
        sleepTimeLimit: makeAtomic('sleepTimeLimit', index),
        userData: makeAtomic('userData', index),
        // Apply functions
        applyForce(force: Triplet, worldPoint: Triplet) {
          post(ref, worker, 'applyForce', index, [force, worldPoint])
        },
        applyImpulse(impulse: Triplet, worldPoint: Triplet) {
          post(ref, worker, 'applyImpulse', index, [impulse, worldPoint])
        },
        applyLocalForce(force: Triplet, localPoint: Triplet) {
          post(ref, worker, 'applyLocalForce', index, [force, localPoint])
        },
        applyLocalImpulse(impulse: Triplet, localPoint: Triplet) {
          post(ref, worker, 'applyLocalImpulse', index, [impulse, localPoint])
        },
        // force particular sleep state
        wakeUp() {
          post(ref, worker, 'wakeUp', index)
        },
        sleep() {
          post(ref, worker, 'sleep', index)
        },
      }
    }

    const cache: { [index: number]: WorkerApi } = {}
    return {
      ...makeApi(undefined),
      at: (index: number) => cache[index] || (cache[index] = makeApi(index)),
    }
  }, [])
  return [ref, api]
}

function makeTriplet(v: Vector3 | Triplet): Triplet {
  return v instanceof Vector3 ? [v.x, v.y, v.z] : v
}

const prepareArgs: {
  [K in ShapeType | 'Compound']: (args: PublicArgs[K]) => PreparedArgs[K]
} = {
  Box: (args = [1, 1, 1]) => args,
  Compound: (args = []) => args,
  ConvexPolyhedron: (args = []) => {
    const [vertices, faces, normals, axes, boundingSphereRadius] = args
    return [
      vertices && vertices.map(makeTriplet),
      faces,
      normals && normals.map(makeTriplet),
      axes && axes.map(makeTriplet),
      boundingSphereRadius,
    ]
  },
  Cylinder: (args = []) => args,
  Heightfield: (args) => args,
  Particle: (args = []) => args,
  Plane: (args = []) => args,
  Sphere: (args = 1) => (Array.isArray(args) ? args : [args]),
  Trimesh: (args) => args,
}

export function useBox(fn: GetByIndex<'Box'>, fwdRef?: MutableRefObject<Object3D>, deps?: any[]) {
  return useBody('Box', fn, fwdRef, deps)
}
export function useCompoundBody(
  fn: GetByIndex<'Compound'>,
  fwdRef?: MutableRefObject<Object3D>,
  deps?: any[],
) {
  return useBody('Compound', fn, fwdRef, deps)
}
export function useConvexPolyhedron(
  fn: GetByIndex<'ConvexPolyhedron'>,
  fwdRef?: MutableRefObject<Object3D>,
  deps?: any[],
) {
  return useBody('ConvexPolyhedron', fn, fwdRef, deps)
}
export function useCylinder(fn: GetByIndex<'Cylinder'>, fwdRef?: MutableRefObject<Object3D>, deps?: any[]) {
  return useBody('Cylinder', fn, fwdRef, deps)
}
export function useHeightfield(
  fn: GetByIndex<'Heightfield'>,
  fwdRef?: MutableRefObject<Object3D>,
  deps?: any[],
) {
  return useBody('Heightfield', fn, fwdRef, deps)
}
export function useParticle(fn: GetByIndex<'Particle'>, fwdRef?: MutableRefObject<Object3D>, deps?: any[]) {
  return useBody('Particle', fn, fwdRef, deps)
}
export function usePlane(fn: GetByIndex<'Plane'>, fwdRef?: MutableRefObject<THREE.Object3D>, deps?: any[]) {
  return useBody('Plane', fn, fwdRef, deps)
}
export function useSphere(fn: GetByIndex<'Sphere'>, fwdRef?: MutableRefObject<Object3D>, deps?: any[]) {
  return useBody('Sphere', fn, fwdRef, deps)
}
export function useTrimesh(fn: GetByIndex<'Trimesh'>, fwdRef?: MutableRefObject<Object3D>, deps?: any[]) {
  return useBody('Trimesh', fn, fwdRef, deps)
}

type ConstraintApi = [
  MutableRefObject<Object3D | undefined>,
  MutableRefObject<Object3D | undefined>,
  {
    enable: () => void
    disable: () => void
  },
]

type HingeConstraintApi = [
  MutableRefObject<Object3D | undefined>,
  MutableRefObject<Object3D | undefined>,
  {
    enable: () => void
    disable: () => void
    enableMotor: () => void
    disableMotor: () => void
    setMotorSpeed: (value: number) => void
    setMotorMaxForce: (value: number) => void
  },
]

type SpringApi = [
  MutableRefObject<Object3D | undefined>,
  MutableRefObject<Object3D | undefined>,
  {
    setStiffness: (value: number) => void
    setRestLength: (value: number) => void
    setDamping: (value: number) => void
  },
]

type ConstraintORHingeApi<T extends 'Hinge' | ConstraintTypes> = T extends ConstraintTypes
  ? ConstraintApi
  : HingeConstraintApi

function useConstraint<T extends 'Hinge' | ConstraintTypes>(
  type: T,
  bodyA: MutableRefObject<Object3D | undefined>,
  bodyB: MutableRefObject<Object3D | undefined>,
  optns: any = {},
  deps: any[] = [],
): ConstraintORHingeApi<T> {
  const { worker } = useContext(context)
  const uuid = MathUtils.generateUUID()

  const nullRef1 = useRef<Object3D>(null!)
  const nullRef2 = useRef<Object3D>(null!)
  bodyA = bodyA === undefined || bodyA === null ? nullRef1 : bodyA
  bodyB = bodyB === undefined || bodyB === null ? nullRef2 : bodyB

  useEffect(() => {
    if (bodyA.current && bodyB.current) {
      worker.postMessage({
        op: 'addConstraint',
        uuid,
        type,
        props: [bodyA.current.uuid, bodyB.current.uuid, optns],
      })
      return () => worker.postMessage({ op: 'removeConstraint', uuid })
    }
  }, deps)

  const api = useMemo(() => {
    const enableDisable = {
      enable: () => worker.postMessage({ op: 'enableConstraint', uuid }),
      disable: () => worker.postMessage({ op: 'disableConstraint', uuid }),
    }

    if (type === 'Hinge') {
      return {
        ...enableDisable,
        enableMotor: () => worker.postMessage({ op: 'enableConstraintMotor', uuid }),
        disableMotor: () => worker.postMessage({ op: 'disableConstraintMotor', uuid }),
        setMotorSpeed: (value: number) =>
          worker.postMessage({ op: 'setConstraintMotorSpeed', uuid, props: value }),
        setMotorMaxForce: (value: number) =>
          worker.postMessage({ op: 'setConstraintMotorMaxForce', uuid, props: value }),
      }
    }

    return enableDisable
  }, deps)

  return [bodyA, bodyB, api] as ConstraintORHingeApi<T>
}

export function usePointToPointConstraint(
  bodyA: MutableRefObject<Object3D | undefined>,
  bodyB: MutableRefObject<Object3D | undefined>,
  optns: PointToPointConstraintOpts,
  deps: any[] = [],
) {
  return useConstraint('PointToPoint', bodyA, bodyB, optns, deps)
}
export function useConeTwistConstraint(
  bodyA: MutableRefObject<Object3D | undefined>,
  bodyB: MutableRefObject<Object3D | undefined>,
  optns: ConeTwistConstraintOpts,
  deps: any[] = [],
) {
  return useConstraint('ConeTwist', bodyA, bodyB, optns, deps)
}
export function useDistanceConstraint(
  bodyA: MutableRefObject<Object3D | undefined>,
  bodyB: MutableRefObject<Object3D | undefined>,
  optns: DistanceConstraintOpts,
  deps: any[] = [],
) {
  return useConstraint('Distance', bodyA, bodyB, optns, deps)
}
export function useHingeConstraint(
  bodyA: MutableRefObject<Object3D | undefined>,
  bodyB: MutableRefObject<Object3D | undefined>,
  optns: HingeConstraintOpts,
  deps: any[] = [],
) {
  return useConstraint('Hinge', bodyA, bodyB, optns, deps)
}
export function useLockConstraint(
  bodyA: MutableRefObject<Object3D | undefined>,
  bodyB: MutableRefObject<Object3D | undefined>,
  optns: LockConstraintOpts,
  deps: any[] = [],
) {
  return useConstraint('Lock', bodyA, bodyB, optns, deps)
}

export function useSpring(
  bodyA: MutableRefObject<Object3D | undefined>,
  bodyB: MutableRefObject<Object3D | undefined>,
  optns: SpringOptns,
  deps: any[] = [],
): SpringApi {
  const { worker } = useContext(context)
  const [uuid] = useState(() => MathUtils.generateUUID())

  const nullRef1 = useRef<Object3D>(null!)
  const nullRef2 = useRef<Object3D>(null!)
  bodyA = bodyA === undefined || bodyA === null ? nullRef1 : bodyA
  bodyB = bodyB === undefined || bodyB === null ? nullRef2 : bodyB

  useEffect(() => {
    if (bodyA.current && bodyB.current) {
      worker.postMessage({
        op: 'addSpring',
        uuid,
        props: [bodyA.current.uuid, bodyB.current.uuid, optns],
      })
      return () => {
        worker.postMessage({ op: 'removeSpring', uuid })
      }
    }
  }, deps)

  const api = useMemo(
    () => ({
      setStiffness: (value: number) => worker.postMessage({ op: 'setSpringStiffness', props: value, uuid }),
      setRestLength: (value: number) => worker.postMessage({ op: 'setSpringRestLength', props: value, uuid }),
      setDamping: (value: number) => worker.postMessage({ op: 'setSpringDamping', props: value, uuid }),
    }),
    deps,
  )

  return [bodyA, bodyB, api]
}

type RayOptns = Omit<RayOptions, 'mode' | 'from' | 'to' | 'result' | 'callback'> & {
  from?: Triplet
  to?: Triplet
}

function useRay(
  mode: 'Closest' | 'Any' | 'All',
  options: RayOptns,
  callback: (e: CannonEvent) => void,
  deps: any[] = [],
) {
  const { worker, events } = useContext(context)
  const [uuid] = useState(() => MathUtils.generateUUID())
  useEffect(() => {
    events[uuid] = callback
    worker.postMessage({ op: 'addRay', uuid, props: { mode, ...options } })
    return () => {
      worker.postMessage({ op: 'removeRay', uuid })
      delete events[uuid]
    }
  }, deps)
}

export function useRaycastClosest(options: RayOptns, callback: (e: CannonEvent) => void, deps: any[] = []) {
  useRay('Closest', options, callback, deps)
}

export function useRaycastAny(options: RayOptns, callback: (e: CannonEvent) => void, deps: any[] = []) {
  useRay('Any', options, callback, deps)
}

export function useRaycastAll(options: RayOptns, callback: (e: CannonEvent) => void, deps: any[] = []) {
  useRay('All', options, callback, deps)
}

export interface RaycastVehiclePublicApi {
  applyEngineForce: (value: number, wheelIndex: number) => void
  setBrake: (brake: number, wheelIndex: number) => void
  setSteeringValue: (value: number, wheelIndex: number) => void
  sliding: {
    subscribe: (callback: (sliding: boolean) => void) => void
  }
}

export interface WheelInfoOptions {
  radius?: number
  directionLocal?: Triplet
  suspensionStiffness?: number
  suspensionRestLength?: number
  maxSuspensionForce?: number
  maxSuspensionTravel?: number
  dampingRelaxation?: number
  dampingCompression?: number
  sideAcceleration?: number
  frictionSlip?: number
  rollInfluence?: number
  axleLocal?: Triplet
  chassisConnectionPointLocal?: Triplet
  isFrontWheel?: boolean
  useCustomSlidingRotationalSpeed?: boolean
  customSlidingRotationalSpeed?: number
}

export interface RaycastVehicleProps {
  chassisBody: MutableRefObject<Object3D | undefined>
  wheels: MutableRefObject<Object3D | undefined>[]
  wheelInfos: WheelInfoOptions[]
  indexForwardAxis?: number
  indexRightAxis?: number
  indexUpAxis?: number
}

export function useRaycastVehicle(
  fn: () => RaycastVehicleProps,
  fwdRef?: MutableRefObject<Object3D>,
  deps: any[] = [],
): [MutableRefObject<Object3D | undefined>, RaycastVehiclePublicApi] {
  const ref = fwdRef ? fwdRef : useRef<Object3D>(null!)
  const { worker, subscriptions } = useContext(context)

  useLayoutEffect(() => {
    if (!ref.current) {
      // When the reference isn't used we create a stub
      // The body doesn't have a visual representation but can still be constrained
      ref.current = new Object3D()
    }

    const currentWorker = worker
    const uuid: string[] = [ref.current.uuid]
    const raycastVehicleProps = fn()

    currentWorker.postMessage({
      op: 'addRaycastVehicle',
      uuid,
      props: [
        raycastVehicleProps.chassisBody.current?.uuid,
        raycastVehicleProps.wheels.map((wheel) => wheel.current?.uuid),
        raycastVehicleProps.wheelInfos,
        raycastVehicleProps?.indexForwardAxis || 2,
        raycastVehicleProps?.indexRightAxis || 0,
        raycastVehicleProps?.indexUpAxis || 1,
      ],
    })
    return () => {
      currentWorker.postMessage({ op: 'removeRaycastVehicle', uuid })
    }
  }, deps)

  const api = useMemo<RaycastVehiclePublicApi>(() => {
    const post = (op: string, props?: any) =>
      ref.current && worker.postMessage({ op, uuid: ref.current.uuid, props })
    return {
      sliding: {
        subscribe: subscribe(ref, worker, subscriptions, 'sliding', undefined, 'vehicles'),
      },
      setSteeringValue(value: number, wheelIndex: number) {
        post('setRaycastVehicleSteeringValue', [value, wheelIndex])
      },
      applyEngineForce(value: number, wheelIndex: number) {
        post('applyRaycastVehicleEngineForce', [value, wheelIndex])
      },
      setBrake(brake: number, wheelIndex: number) {
        post('setRaycastVehicleBrake', [brake, wheelIndex])
      },
    }
  }, deps)
  return [ref, api]
}
