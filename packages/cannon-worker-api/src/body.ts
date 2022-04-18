import type { MaterialOptions } from 'cannon-es'
import type { Vector3 } from 'three'

import type { CollideBeginEvent, CollideEndEvent, CollideEvent, Quad, Triplet, VectorName } from './types'

export type AtomicProps = {
  allowSleep: boolean
  angularDamping: number
  collisionFilterGroup: number
  collisionFilterMask: number
  collisionResponse: boolean
  fixedRotation: boolean
  isTrigger: boolean
  linearDamping: number
  mass: number
  material: MaterialOptions
  sleepSpeedLimit: number
  sleepTimeLimit: number
  userData: Record<PropertyKey, any>
}

export type VectorProps = Record<VectorName, Triplet>
type VectorTypes = Vector3 | Triplet

export type BodyProps<T extends Record<PropertyKey, unknown> = {}> = Partial<AtomicProps> &
  Partial<VectorProps> & {
    onCollide?: (e: CollideEvent) => void
    onCollideBegin?: (e: CollideBeginEvent) => void
    onCollideEnd?: (e: CollideEndEvent) => void
    quaternion?: Quad
    rotation?: Triplet
    type?: 'Dynamic' | 'Static' | 'Kinematic'
  } & T

export type ShapeType =
  | 'Box'
  | 'ConvexPolyhedron'
  | 'Cylinder'
  | 'Heightfield'
  | 'Particle'
  | 'Plane'
  | 'Sphere'
  | 'Trimesh'
export type BodyShapeType = ShapeType | 'Compound'

export type BodyPropMap = {
  Box: { extents?: Triplet; type: 'Box' }
  CompoundBody: { shapes: (Omit<BodyProps, 'type'> & { type: ShapeType })[]; type: 'CompoundBody' }
  ConvexPolyhedron: {
    vertices?: VectorTypes[],
    faces?: number[][],
    normals?: VectorTypes[],
    axes?: VectorTypes[],
    boundingSphereRadius?: number,
    type: 'ConvexPolyHedron'
  }
  Cylinder: { height?: number, numSegments?: number, radiusBottom?: number, radiusTop?: number; type: 'Cylinder' }
  Heightfield: { data: number[][], options: { elementSize?: number, maxValue?: number, minValue?: number }; type: 'Heightfield' }
  Particle: { type: 'Particle' }
  Plane: { type: 'Plane' }
  Sphere: { radius?: number; type: 'Sphere' }
  Trimesh: { vertices: ArrayLike<number>, indices: ArrayLike<number>; type: 'Trimesh' }
}
