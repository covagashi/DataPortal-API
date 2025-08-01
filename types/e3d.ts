// types/e3d.ts
export interface E3DColor extends Float32Array {
  readonly 0: number;
  readonly 1: number;
  readonly 2: number;
  readonly 3: number;
}

export interface E3DVector extends Float32Array {
  readonly 0: number;
  readonly 1: number;
  readonly 2: number;
}

export interface E3DTransform extends Array<number> {
  readonly length: 16;
}

export interface E3DMaterial {
  bColorValid: boolean;
  oColor: E3DColor;
  nTextureId: number;
}

export interface E3DEdgeStyle {
  oColor: E3DColor;
  fLineWidth: number;
  ucLineType: number;
}

export interface E3DElements {
  bCenterValid: boolean;
  vCenter?: E3DVector;
  mode: 'points' | 'lineStrip' | 'lineLoop' | 'lines' | 'triangleStrip' | 'triangleFan' | 'triangles';
  length: number;
  type: 'unsignedByte' | 'unsignedShort';
  vArray: Uint8Array | Uint16Array;
}

export interface E3DVertexBuffer {
  bPoints: boolean;
  bNormals: boolean;
  bTexCoords: boolean;
  vArray: Float32Array;
}

export interface E3DFaceElement {
  material: E3DMaterial;
  elements: E3DElements;
}

export interface E3DEdgeElement {
  edgestyle: E3DEdgeStyle;
  elements: E3DElements;
}

export interface E3DMesh {
  vertexbuffer: E3DVertexBuffer;
  faceElements: E3DFaceElement[];
  edgeElements: E3DEdgeElement[];
}

export interface E3DLight {
  nLightType: number;
  color: E3DColor;
  position?: E3DVector;
  direction?: E3DVector;
  fAngle?: number;
  fExponent?: number;
}

export interface E3DTexture {
  sWidth: number;
  sHeight: number;
  nComponents: number;
  nSize: number;
  vData: Uint8Array;
}

export interface E3DTextLine {
  oTransform: E3DTransform;
  fHeight: number;
  vecTextJust: Float32Array;
  strText: string;
}

export interface E3DPart {
  nMeshId: number;
  oTransform: E3DTransform;
  oColor: E3DColor;
  nTypeId?: number;
  nTblObjId?: number;
  textLines: E3DTextLine[];
}

export interface E3DView {
  modelTransform: E3DTransform;
  viewBox: E3DVector;
  viewColors: {
    top: E3DColor;
    bottom: E3DColor;
  };
}

export interface E3DSceneData {
  view: E3DView;
  lights: E3DLight[];
  textures: E3DTexture[];
  meshes: E3DMesh[];
  parts: E3DPart[];
}