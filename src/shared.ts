import type { MaterialOptions, RayOptions as CannonRayOptions, Shape } from 'cannon-es'
import type { MutableRefObject, ReactNode, Ref } from 'react'
import type { Object3D } from 'three'

export type Triplet = [x: number, y: number, z: number]

export const atomicNames = [
  'allowSleep',
  'angularDamping',
  'collisionFilterGroup',
  'collisionFilterMask',
  'collisionResponse',
  'fixedRotation',
  'isTrigger',
  'linearDamping',
  'mass',
  'material',
  'sleepSpeedLimit',
  'sleepTimeLimit',
  'userData',
] as const
export type AtomicName = typeof atomicNames[number]

export type AtomicProps = {
  allowSleep: boolean
  angularDamping: number
  collisionFilterGroup: number
  collisionFilterMask: number
  collisionResponse: number
  fixedRotation: boolean
  isTrigger: boolean
  linearDamping: number
  mass: number
  material: MaterialOptions
  sleepSpeedLimit: number
  sleepTimeLimit: number
  userData: {}
}

export type BodyProps<T = unknown> = Partial<AtomicProps> &
  Partial<VectorProps> & {
    args?: T
    type?: 'Dynamic' | 'Static' | 'Kinematic'
    onCollide?: (e: CollideEvent) => void
    onCollideBegin?: (e: CollideBeginEvent) => void
    onCollideEnd?: (e: CollideEndEvent) => void
  }

export type CollisionEvent = CollideEvent | CollideBeginEvent | CollideEndEvent

export type CollideEvent = Omit<WorkerCollideEvent['data'], 'body' | 'target' | 'contact'> & {
  body: Object3D
  target: Object3D
  contact: Omit<WorkerCollideEvent['data']['contact'], 'bi' | 'bj'> & {
    bi: Object3D
    bj: Object3D
  }
}
export type CollideBeginEvent = {
  op: 'event'
  type: 'collideBegin'
  target: Object3D
  body: Object3D
}
export type CollideEndEvent = {
  op: 'event'
  type: 'collideEnd'
  target: Object3D
  body: Object3D
}

export type R3CannonEvent = RayhitEvent | CollisionEvent

type Operation<T extends string, P> = { op: T } & (P extends void ? {} : { props: P })
type WithUUID<T extends string, P = void> = Operation<T, P> & { uuid: string }
type WithUUIDs<T extends string, P = void> = Operation<T, P> & { uuid: string[] }

export type RayhitEvent = Omit<WorkerRayhitEvent['data'], 'body'> & { body: Object3D | null }
export type RayOptions = Omit<AddRayMessage['props'], 'mode'>
export type RayMode = 'Closest' | 'Any' | 'All'

export type AddRayMessage = WithUUID<
  'addRay',
  {
    from?: Triplet
    mode: RayMode
    to?: Triplet
  } & Pick<
    CannonRayOptions,
    'checkCollisionResponse' | 'collisionFilterGroup' | 'collisionFilterMask' | 'skipBackfaces'
  >
>

type RemoveRayMessage = WithUUID<'removeRay'>

type RayMessage = AddRayMessage | RemoveRayMessage


export const vectorNames = [
  'angularFactor',
  'angularVelocity',
  'linearFactor',
  'position',
  'rotation',
  'velocity',
] as const
export type VectorName = typeof vectorNames[number]

export type VectorProps = Record<VectorName, Triplet>

export type Buffers = { positions: Float32Array; quaternions: Float32Array }
export type Refs = { [uuid: string]: Object3D }

export type R3CannonEvents = { [uuid: string]: (e: R3CannonEvent) => void }
export type Subscriptions = {
  [id: string]: (value: AtomicProps[AtomicName] | Triplet) => void
}

export type CannonVectorName = Exclude<VectorName, 'rotation'> | 'quaternion'

export type SetOpName<T extends AtomicName | CannonVectorName> = `set${Capitalize<T>}`
export type SubscriptionName = AtomicName | CannonVectorName | 'sliding'

export type ConstraintTypes = 'PointToPoint' | 'ConeTwist' | 'Distance' | 'Lock'

type AddConstraintMessage = WithUUID<'addConstraint', [uuidA: string, uuidB: string, options: {}]> & {
  type: 'Hinge' | ConstraintTypes
}

type DisableConstraintMessage = WithUUID<'disableConstraint'>
type EnableConstraintMessage = WithUUID<'enableConstraint'>
type RemoveConstraintMessage = WithUUID<'removeConstraint'>

type ConstraintMessage =
  | AddConstraintMessage
  | DisableConstraintMessage
  | EnableConstraintMessage
  | RemoveConstraintMessage

type DisableConstraintMotorMessage = WithUUID<'disableConstraintMotor'>
type EnableConstraintMotorMessage = WithUUID<'enableConstraintMotor'>
type SetConstraintMotorMaxForce = WithUUID<'setConstraintMotorMaxForce', number>
type SetConstraintMotorSpeed = WithUUID<'setConstraintMotorSpeed', number>

type ConstraintMotorMessage =
  | DisableConstraintMotorMessage
  | EnableConstraintMotorMessage
  | SetConstraintMotorSpeed
  | SetConstraintMotorMaxForce

export interface SpringOptions {
  restLength?: number
  stiffness?: number
  damping?: number
  worldAnchorA?: Triplet
  worldAnchorB?: Triplet
  localAnchorA?: Triplet
  localAnchorB?: Triplet
}

type AddSpringMessage = WithUUID<'addSpring', [uuidA: string, uuidB: string, options: SpringOptions]>
type RemoveSpringMessage = WithUUID<'removeSpring'>

type SetSpringDampingMessage = WithUUID<'setSpringDamping', number>
type SetSpringRestLengthMessage = WithUUID<'setSpringRestLength', number>
type SetSpringStiffnessMessage = WithUUID<'setSpringStiffness', number>

type SpringMessage =
  | AddSpringMessage
  | RemoveSpringMessage
  | SetSpringDampingMessage
  | SetSpringRestLengthMessage
  | SetSpringStiffnessMessage

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
  chassisBody: Ref<Object3D>
  wheels: Ref<Object3D>[]
  wheelInfos: WheelInfoOptions[]
  indexForwardAxis?: number
  indexRightAxis?: number
  indexUpAxis?: number
}

type AddRaycastVehicleMessage = WithUUIDs<
  'addRaycastVehicle',
  [
    chassisBodyUUID: string,
    wheelsUUID: string[],
    wheelInfos: WheelInfoOptions[],
    indexForwardAxis: number,
    indexRightAxis: number,
    indexUpAxis: number,
  ]
>
type RemoveRaycastVehicleMessage = WithUUIDs<'removeRaycastVehicle'>

type ApplyRaycastVehicleEngineForceMessage = WithUUID<
  'applyRaycastVehicleEngineForce',
  [value: number, wheelIndex: number]
>
type SetRaycastVehicleBrakeMessage = WithUUID<'setRaycastVehicleBrake', [brake: number, wheelIndex: number]>
type SetRaycastVehicleSteeringValueMessage = WithUUID<
  'setRaycastVehicleSteeringValue',
  [value: number, wheelIndex: number]
>

type RaycastVehicleMessage =
  | AddRaycastVehicleMessage
  | ApplyRaycastVehicleEngineForceMessage
  | RemoveRaycastVehicleMessage
  | SetRaycastVehicleBrakeMessage
  | SetRaycastVehicleSteeringValueMessage

type AtomicMessage = WithUUID<SetOpName<AtomicName>, any>
type VectorMessage = WithUUID<SetOpName<CannonVectorName>, Triplet>

type ApplyForceMessage = WithUUID<'applyForce', [force: Triplet, worldPoint: Triplet]>
type ApplyImpulseMessage = WithUUID<'applyImpulse', [impulse: Triplet, worldPoint: Triplet]>
type ApplyLocalForceMessage = WithUUID<'applyLocalForce', [force: Triplet, localPoint: Triplet]>
type ApplyLocalImpulseMessage = WithUUID<'applyLocalImpulse', [impulse: Triplet, localPoint: Triplet]>
type ApplyTorque = WithUUID<'applyTorque', [torque: Triplet]>

type ApplyMessage =
  | ApplyForceMessage
  | ApplyImpulseMessage
  | ApplyLocalForceMessage
  | ApplyLocalImpulseMessage
  | ApplyTorque

type SerializableBodyProps = {
  onCollide: boolean
}

export type ShapeType =
  | 'Plane'
  | 'Box'
  | 'Cylinder'
  | 'Heightfield'
  | 'Particle'
  | 'Sphere'
  | 'Trimesh'
  | 'ConvexPolyhedron'
export type BodyShapeType = ShapeType | 'Compound'

type AddBodiesMessage = WithUUIDs<'addBodies', SerializableBodyProps[]> & { type: BodyShapeType }
type RemoveBodiesMessage = WithUUIDs<'removeBodies'>

type BodiesMessage = AddBodiesMessage | RemoveBodiesMessage

type SleepMessage = WithUUID<'sleep'>
type WakeUpMessage = WithUUID<'wakeUp'>

export type SubscriptionTarget = 'bodies' | 'vehicles'

type SubscribeMessage = WithUUID<
  'subscribe',
  {
    id: number
    target: SubscriptionTarget
    type: SubscriptionName
  }
>
type UnsubscribeMessage = Operation<'unsubscribe', number>

type SubscriptionMessage = SubscribeMessage | UnsubscribeMessage

type CannonMessage =
  | ApplyMessage
  | AtomicMessage
  | BodiesMessage
  | ConstraintMessage
  | ConstraintMotorMessage
  | RaycastVehicleMessage
  | RayMessage
  | SleepMessage
  | SpringMessage
  | SubscriptionMessage
  | VectorMessage
  | WakeUpMessage

export interface CannonWorker extends Worker {
  postMessage: (message: CannonMessage) => void
}

export type ProviderContext = {
  worker: CannonWorker
  bodies: MutableRefObject<{ [uuid: string]: number }>
  buffers: Buffers
  refs: Refs
  events: R3CannonEvents
  subscriptions: Subscriptions
}

export type DebugApi = {
  add(id: string, props: BodyProps, type: BodyShapeType): void
  remove(id: string): void
}

export type ProviderProps = {
  children: ReactNode
  shouldInvalidate?: boolean

  tolerance?: number
  step?: number
  iterations?: number

  allowSleep?: boolean
  broadphase?: 'Naive' | 'SAP'
  gravity?: number[]
  quatNormalizeFast?: boolean
  quatNormalizeSkip?: number
  solver?: 'GS' | 'Split'

  axisIndex?: number
  defaultContactMaterial?: {
    friction?: number
    restitution?: number
    contactEquationStiffness?: number
    contactEquationRelaxation?: number
    frictionEquationStiffness?: number
    frictionEquationRelaxation?: number
  }
  size?: number
}

export type WorkerFrameMessage = {
  data: Buffers & {
    op: 'frame'
    observations: [key: string, value: AtomicProps[keyof AtomicProps] | number[]][]
    active: boolean
    bodies?: string[]
  }
}

export type WorkerCollideBeginEvent = {
  data: {
    op: 'event'
    type: 'collideBegin'
    bodyA: string
    bodyB: string
  }
}

export type WorkerCollideEndEvent = {
  data: {
    op: 'event'
    type: 'collideEnd'
    bodyA: string
    bodyB: string
  }
}

export type IncomingWorkerMessage = WorkerFrameMessage | WorkerEventMessage

export type WorkerEventMessage =
  | WorkerCollideEvent
  | WorkerRayhitEvent
  | WorkerCollideBeginEvent
  | WorkerCollideEndEvent

export type WorkerCollideEvent = {
  data: {
    op: 'event'
    type: 'collide'
    target: string
    body: string
    contact: {
      id: string
      ni: number[]
      ri: number[]
      rj: number[]
      impactVelocity: number
      bi: string
      bj: string
      /** Contact point in world space */
      contactPoint: number[]
      /** Normal of the contact, relative to the colliding body */
      contactNormal: number[]
    }
    collisionFilters: {
      bodyFilterGroup: number
      bodyFilterMask: number
      targetFilterGroup: number
      targetFilterMask: number
    }
  }
}

export type WorkerRayhitEvent = {
  data: {
    op: 'event'
    type: 'rayhit'
    ray: {
      from: number[]
      to: number[]
      direction: number[]
      collisionFilterGroup: number
      collisionFilterMask: number
      uuid: string
    }
    hasHit: boolean
    body: string | null
    shape: (Omit<Shape, 'body'> & { body: string }) | null
    rayFromWorld: number[]
    rayToWorld: number[]
    hitNormalWorld: number[]
    hitPointWorld: number[]
    hitFaceIndex: number
    distance: number
    shouldStop: boolean
  }
}
