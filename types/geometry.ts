// types/geometry.ts
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Triangle {
  v1: Vector3D;
  v2: Vector3D;
  v3: Vector3D;
  normal: Vector3D;
}

export interface BoundingBox {
  min: Vector3D;
  max: Vector3D;
  center: Vector3D;
  size: Vector3D;
}

export interface STLData {
  triangles: Triangle[];
  boundingBox: BoundingBox;
  triangleCount: number;
}