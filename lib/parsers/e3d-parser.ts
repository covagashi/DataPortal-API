// lib/parsers/e3d-parser.ts
import {
  E3DSceneData,
  E3DColor,
  E3DVector,
  E3DTransform,
  E3DMaterial,
  E3DEdgeStyle,
  E3DElements,
  E3DMesh,
  E3DLight,
  E3DTexture,
  E3DPart,
  E3DTextLine
} from '@/types/e3d';

export class E3DParser {
  private buffer: Buffer;
  private filePos: number = 0;
  private formatVersion: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  private getViewAndAdvance(size: number): DataView {
    const view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset + this.filePos,
      size
    );
    this.filePos += size;
    return view;
  }

  private loadByte(): number {
    return this.getViewAndAdvance(1).getUint8(0);
  }

  private loadShort(): number {
    return this.getViewAndAdvance(2).getInt16(0, true);
  }

  private loadLong(): number {
    return this.getViewAndAdvance(4).getInt32(0, true);
  }

  private loadFloat(): number {
    return this.getViewAndAdvance(4).getFloat32(0, true);
  }

  private loadColor(): E3DColor {
    const view = this.getViewAndAdvance(4);
    const color = new Float32Array(4) as E3DColor;
    for (let i = 0; i < 4; i++) {
      color[i] = view.getUint8(i) / 255;
    }
    color[3] = 1 - color[3]; // Invert alpha
    return color;
  }

  private loadVector(): E3DVector {
    const view = this.getViewAndAdvance(12);
    const vector = new Float32Array(3) as E3DVector;
    vector[0] = view.getFloat32(0, true);
    vector[1] = view.getFloat32(4, true);
    vector[2] = view.getFloat32(8, true);
    return vector;
  }

  private loadFloatBuffer(): Float32Array {
    const length = this.loadLong();
    const view = this.getViewAndAdvance(length);
    const count = length / 4;
    const buffer = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      buffer[i] = view.getFloat32(i * 4, true);
    }
    return buffer;
  }

  private loadShortBuffer(): Uint16Array {
    const length = this.loadLong();
    const view = this.getViewAndAdvance(length);
    const count = length / 2;
    const buffer = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      buffer[i] = view.getUint8(i * 2) + 256 * view.getUint8(i * 2 + 1);
    }
    return buffer;
  }

  private loadByteBuffer(): Uint8Array {
    const length = this.loadLong();
    const view = this.getViewAndAdvance(length);
    const buffer = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      buffer[i] = view.getUint8(i);
    }
    return buffer;
  }

  private loadString(): string {
    const length = this.loadLong();
    const view = this.getViewAndAdvance(length);
    let str = '';
    for (let i = 0; i < Math.floor(length / 2); i++) {
      const charCode = view.getUint8(i * 2) + 256 * view.getUint8(i * 2 + 1);
      if (charCode !== 0) {
        str += String.fromCharCode(charCode);
      }
    }
    return str;
  }

  private loadTransform(): E3DTransform {
    const v1 = this.loadVector();
    const v2 = this.loadVector();
    const v3 = this.loadVector();
    const v4 = this.loadVector();
    return [
      v1[0], v1[1], v1[2], 0,
      v2[0], v2[1], v2[2], 0,
      v3[0], v3[1], v3[2], 0,
      v4[0], v4[1], v4[2], 1
    ] as E3DTransform;
  }

  private loadLight(): E3DLight {
    const light: E3DLight = {
      nLightType: this.loadByte(),
      color: this.loadColor()
    };
    
    if (light.nLightType === 2 || light.nLightType === 3) {
      light.position = this.loadVector();
    }
    if (light.nLightType === 1 || light.nLightType === 3) {
      light.direction = this.loadVector();
    }
    if (light.nLightType === 3) {
      light.fAngle = this.loadFloat();
      light.fExponent = this.loadFloat();
    }
    return light;
  }

  private loadTexture(): E3DTexture {
    const texture: Partial<E3DTexture> = {};
    this.loadByte(); // Skip first byte
    texture.sWidth = this.loadShort();
    texture.sHeight = this.loadShort();
    texture.nComponents = 4;
    texture.nSize = texture.sWidth! * texture.sHeight! * texture.nComponents;
    
    // Read texture data
    texture.vData = new Uint8Array(
      this.buffer.buffer,
      this.buffer.byteOffset + this.filePos,
      texture.nSize
    );
    this.filePos += texture.nSize;
    
    return texture as E3DTexture;
  }

  private loadMaterial(): E3DMaterial {
    return {
      bColorValid: this.loadByte() > 0,
      oColor: this.loadColor(),
      nTextureId: this.loadShort()
    };
  }

  private loadEdgeStyle(): E3DEdgeStyle {
    return {
      oColor: this.loadColor(),
      fLineWidth: this.loadFloat(),
      ucLineType: this.loadByte()
    };
  }

  private loadElements(): E3DElements {
    const elements: Partial<E3DElements> = { bCenterValid: false };
    
    if (this.formatVersion >= 2) {
      elements.vCenter = this.loadVector();
      elements.bCenterValid = true;
    }
    
    const modeIndex = this.loadByte();
    const modes = ['points', 'lineStrip', 'lineLoop', 'lines', 'triangleStrip', 'triangleFan', 'triangles'] as const;
    elements.mode = modes[modeIndex];
    elements.length = this.loadLong();
    
    const typeIndex = this.loadByte();
    const types = ['unsignedByte', 'unsignedShort'] as const;
    elements.type = types[typeIndex];
    
    if (elements.type === 'unsignedByte') {
      elements.vArray = this.loadByteBuffer();
    } else {
      elements.vArray = this.loadShortBuffer();
    }
    
    return elements as E3DElements;
  }

  private loadMesh(): E3DMesh {
    const mesh: Partial<E3DMesh> = { vertexbuffer: {} as any };
    
    const flags = this.loadByte();
    mesh.vertexbuffer!.bPoints = (flags & 1) > 0;
    mesh.vertexbuffer!.bNormals = (flags & 2) > 0;
    mesh.vertexbuffer!.bTexCoords = (flags & 4) > 0;
    mesh.vertexbuffer!.vArray = this.loadFloatBuffer();
    
    // Load face elements
    const faceElementCount = this.loadLong();
    mesh.faceElements = Array.from({ length: faceElementCount }, () => ({
      material: this.loadMaterial(),
      elements: this.loadElements()
    }));
    
    // Load edge elements
    const edgeElementCount = this.loadLong();
    mesh.edgeElements = Array.from({ length: edgeElementCount }, () => ({
      edgestyle: this.loadEdgeStyle(),
      elements: this.loadElements()
    }));
    
    return mesh as E3DMesh;
  }

  private loadPart(): E3DPart {
    const part: Partial<E3DPart> = {};
    part.nMeshId = this.loadShort();
    part.oTransform = this.loadTransform();
    part.oColor = this.loadColor();
    
    if (this.formatVersion >= 3) {
      part.nTypeId = this.loadShort();
      part.nTblObjId = this.loadLong();
    }
    
    if (this.formatVersion >= 4) {
      const textLineCount = this.loadLong();
      part.textLines = Array.from({ length: textLineCount }, () => {
        const textLine: Partial<E3DTextLine> = {};
        textLine.oTransform = this.loadTransform();
        textLine.fHeight = this.loadFloat();
        
        const justification = this.loadShort();
        textLine.vecTextJust = new Float32Array([0, 0, 0.1, 1]);
        
        // Set horizontal justification
        switch (justification) {
          case 2: case 5: case 8: case 11:
            textLine.vecTextJust[0] = -0.5;
            break;
          case 3: case 6: case 9: case 12:
            textLine.vecTextJust[0] = -1;
            break;
        }
        
        // Set vertical justification
        switch (justification) {
          case 1: case 2: case 3:
            textLine.vecTextJust[1] = -1;
            break;
          case 4: case 5: case 6:
            textLine.vecTextJust[1] = -0.5;
            break;
        }
        
        textLine.strText = this.loadString();
        return textLine as E3DTextLine;
      });
    } else {
      part.textLines = [];
    }
    
    return part as E3DPart;
  }

  public loadSceneData(): E3DSceneData {
    try {
      this.formatVersion = this.loadByte();
      
      if (this.formatVersion > 4) {
        throw new Error(`Unsupported E3D format version: ${this.formatVersion}`);
      }
      
      const sceneData: E3DSceneData = {
        view: {
          modelTransform: this.loadTransform(),
          viewBox: this.loadVector(),
          viewColors: {
            top: this.loadColor(),
            bottom: this.loadColor()
          }
        },
        lights: [],
        textures: [],
        meshes: [],
        parts: []
      };
      
      // Helper function to load arrays
      const loadArray = <T>(loadFunction: () => T): T[] => {
        const count = this.loadLong();
        return Array.from({ length: count }, () => loadFunction.call(this));
      };
      
      // Load lights, textures, meshes, and parts
      sceneData.lights = loadArray(() => this.loadLight());
      sceneData.textures = loadArray(() => this.loadTexture());
      sceneData.meshes = loadArray(() => this.loadMesh());
      sceneData.parts = loadArray(() => this.loadPart());
      
      // Validate file was fully read
      if (this.filePos !== this.buffer.length) {
        console.warn(`Warning: File position ${this.filePos} does not match buffer length ${this.buffer.length}`);
      }
      
      return sceneData;
    } catch (error) {
      throw new Error(`Error parsing E3D file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}