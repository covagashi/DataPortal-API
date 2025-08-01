// lib/parsers/stl-converter.ts
import { E3DSceneData } from '@/types/e3d';
import { Vector3D, Triangle, BoundingBox, STLData } from '@/types/geometry';

export class STLConverter {
  public static convertE3DtoSTL(sceneData: E3DSceneData): string {
    const stlData = this.convertToSTLData(sceneData);
    return this.generateSTLContent(stlData);
  }

  public static convertToSTLData(sceneData: E3DSceneData): STLData {
    const triangles: Triangle[] = [];
    const bounds = this.initializeBounds();

    sceneData.meshes.forEach((mesh, meshIndex) => {
      mesh.faceElements.forEach((faceElement, faceIndex) => {
        if (faceElement.elements.mode === 'triangles') {
          const meshTriangles = this.processMesh(mesh, faceElement, meshIndex, faceIndex);
          triangles.push(...meshTriangles);
          
          // Update bounds
          meshTriangles.forEach(triangle => {
            this.updateBounds(bounds, triangle.v1);
            this.updateBounds(bounds, triangle.v2);
            this.updateBounds(bounds, triangle.v3);
          });
        }
      });
    });

    const boundingBox = this.calculateBoundingBox(bounds);
    
    return {
      triangles,
      boundingBox,
      triangleCount: triangles.length
    };
  }

  private static processMesh(
    mesh: any, 
    faceElement: any, 
    meshIndex: number, 
    faceIndex: number
  ): Triangle[] {
    const vertices = mesh.vertexbuffer.vArray;
    const indices = faceElement.elements.vArray;
    const triangles: Triangle[] = [];

    const vertexStride = this.getVertexStride(mesh.vertexbuffer);
    const maxIndex = Math.max(...Array.from(indices));
    const expectedVertexCount = (maxIndex + 1) * vertexStride;
    
    if (vertices.length < expectedVertexCount) {
      console.warn(`Insufficient vertex data in mesh ${meshIndex}, face ${faceIndex}: expected ${expectedVertexCount}, got ${vertices.length}`);
      return triangles;
    }

    for (let i = 0; i < indices.length; i += 3) {
      if (i + 2 >= indices.length) break;

      const i1 = indices[i];
      const i2 = indices[i + 1];
      const i3 = indices[i + 2];

      if (!this.areValidIndices([i1, i2, i3], vertices.length, vertexStride)) {
        continue;
      }

      const v1 = this.extractVertex(vertices, i1, vertexStride);
      const v2 = this.extractVertex(vertices, i2, vertexStride);
      const v3 = this.extractVertex(vertices, i3, vertexStride);

      if (!this.areValidVertices([v1, v2, v3])) {
        continue;
      }

      const normal = this.calculateNormal(v1, v2, v3);
      
      if (!this.isValidVertex(normal)) {
        continue;
      }

      triangles.push({ v1, v2, v3, normal });
    }

    return triangles;
  }

  private static getVertexStride(vertexBuffer: any): number {
    let stride = 3; // x, y, z
    if (vertexBuffer.bNormals) stride += 3; // nx, ny, nz
    if (vertexBuffer.bTexCoords) stride += 2; // u, v
    return stride;
  }

  private static areValidIndices(indices: number[], vertexCount: number, stride: number): boolean {
    return indices.every(index => index * stride + 2 < vertexCount);
  }

  private static extractVertex(vertices: Float32Array, index: number, stride: number): Vector3D {
    const offset = index * stride;
    return {
      x: vertices[offset],
      y: vertices[offset + 1],
      z: vertices[offset + 2]
    };
  }

  private static areValidVertices(vertices: Vector3D[]): boolean {
    return vertices.every(v => this.isValidVertex(v));
  }

  private static isValidVertex(vertex: Vector3D): boolean {
    return isFinite(vertex.x) && isFinite(vertex.y) && isFinite(vertex.z) &&
           !isNaN(vertex.x) && !isNaN(vertex.y) && !isNaN(vertex.z);
  }

  private static calculateNormal(v1: Vector3D, v2: Vector3D, v3: Vector3D): Vector3D {
    // Calculate two edges of the triangle
    const u = {
      x: v2.x - v1.x,
      y: v2.y - v1.y,
      z: v2.z - v1.z
    };

    const v = {
      x: v3.x - v1.x,
      y: v3.y - v1.y,
      z: v3.z - v1.z
    };

    // Cross product
    const normal = {
      x: u.y * v.z - u.z * v.y,
      y: u.z * v.x - u.x * v.z,
      z: u.x * v.y - u.y * v.x
    };

    // Calculate length
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    
    // Handle degenerate triangles
    if (length < 1e-10) {
      return { x: 0, y: 0, z: 1 }; // Default normal pointing up
    }
    
    // Normalize
    return {
      x: normal.x / length,
      y: normal.y / length,
      z: normal.z / length
    };
  }

  private static initializeBounds() {
    return {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    };
  }

  private static updateBounds(bounds: any, vertex: Vector3D): void {
    bounds.min.x = Math.min(bounds.min.x, vertex.x);
    bounds.min.y = Math.min(bounds.min.y, vertex.y);
    bounds.min.z = Math.min(bounds.min.z, vertex.z);
    bounds.max.x = Math.max(bounds.max.x, vertex.x);
    bounds.max.y = Math.max(bounds.max.y, vertex.y);
    bounds.max.z = Math.max(bounds.max.z, vertex.z);
  }

  private static calculateBoundingBox(bounds: any): BoundingBox {
    // Handle empty geometry
    if (!isFinite(bounds.min.x)) {
      const zero = { x: 0, y: 0, z: 0 };
      return {
        min: zero,
        max: zero,
        center: zero,
        size: zero
      };
    }

    const center = {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2
    };

    const size = {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z
    };

    return {
      min: bounds.min,
      max: bounds.max,
      center,
      size
    };
  }

  private static generateSTLContent(stlData: STLData): string {
    const lines = ['solid Model'];
    
    stlData.triangles.forEach(triangle => {
      lines.push(`  facet normal ${triangle.normal.x} ${triangle.normal.y} ${triangle.normal.z}`);
      lines.push('    outer loop');
      lines.push(`      vertex ${triangle.v1.x} ${triangle.v1.y} ${triangle.v1.z}`);
      lines.push(`      vertex ${triangle.v2.x} ${triangle.v2.y} ${triangle.v2.z}`);
      lines.push(`      vertex ${triangle.v3.x} ${triangle.v3.y} ${triangle.v3.z}`);
      lines.push('    endloop');
      lines.push('  endfacet');
    });
    
    lines.push('endsolid Model');
    return lines.join('\n');
  }

  public static generateBinarySTL(stlData: STLData): Buffer {
    const triangleCount = stlData.triangles.length;
    const bufferSize = 80 + 4 + (triangleCount * 50); // Header + count + triangles
    const buffer = Buffer.alloc(bufferSize);
    
    let offset = 0;
    
    // Write 80-byte header
    buffer.write('Binary STL generated by E3D Converter', offset, 'ascii');
    offset += 80;
    
    // Write triangle count
    buffer.writeUInt32LE(triangleCount, offset);
    offset += 4;
    
    // Write triangles
    stlData.triangles.forEach(triangle => {
      // Normal vector (3 floats)
      buffer.writeFloatLE(triangle.normal.x, offset); offset += 4;
      buffer.writeFloatLE(triangle.normal.y, offset); offset += 4;
      buffer.writeFloatLE(triangle.normal.z, offset); offset += 4;
      
      // Vertex 1 (3 floats)
      buffer.writeFloatLE(triangle.v1.x, offset); offset += 4;
      buffer.writeFloatLE(triangle.v1.y, offset); offset += 4;
      buffer.writeFloatLE(triangle.v1.z, offset); offset += 4;
      
      // Vertex 2 (3 floats)
      buffer.writeFloatLE(triangle.v2.x, offset); offset += 4;
      buffer.writeFloatLE(triangle.v2.y, offset); offset += 4;
      buffer.writeFloatLE(triangle.v2.z, offset); offset += 4;
      
      // Vertex 3 (3 floats)
      buffer.writeFloatLE(triangle.v3.x, offset); offset += 4;
      buffer.writeFloatLE(triangle.v3.y, offset); offset += 4;
      buffer.writeFloatLE(triangle.v3.z, offset); offset += 4;
      
      // Attribute byte count (2 bytes, usually 0)
      buffer.writeUInt16LE(0, offset); offset += 2;
    });
    
    return buffer;
  }

  public static validateSTLData(stlData: STLData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (stlData.triangles.length === 0) {
      errors.push('No triangles found in the model');
    }
    
    if (stlData.triangleCount !== stlData.triangles.length) {
      errors.push('Triangle count mismatch');
    }
    
    // Check for degenerate triangles
    let degenerateCount = 0;
    stlData.triangles.forEach((triangle, index) => {
      if (this.isDegenerate(triangle)) {
        degenerateCount++;
      }
    });
    
    if (degenerateCount > 0) {
      errors.push(`Found ${degenerateCount} degenerate triangles`);
    }
    
    // Check bounding box
    if (!this.isValidVertex(stlData.boundingBox.center)) {
      errors.push('Invalid bounding box');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private static isDegenerate(triangle: Triangle): boolean {
    const EPSILON = 1e-10;
    
    // Check if any two vertices are too close
    const d1 = this.distance(triangle.v1, triangle.v2);
    const d2 = this.distance(triangle.v2, triangle.v3);
    const d3 = this.distance(triangle.v3, triangle.v1);
    
    return d1 < EPSILON || d2 < EPSILON || d3 < EPSILON;
  }
  
  private static distance(v1: Vector3D, v2: Vector3D): number {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}