
// lib/services/file-validator.ts
export class FileValidator {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly ALLOWED_EXTENSIONS = ['.e3d'];
  private static readonly E3D_SIGNATURE = Buffer.from([0x04]); // E3D format version byte

  public static validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }

    // Check file extension
    const extension = this.getFileExtension(file.name);
    if (!this.ALLOWED_EXTENSIONS.includes(extension)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed extensions: ${this.ALLOWED_EXTENSIONS.join(', ')}`
      };
    }

    return { isValid: true };
  }

  public static async validateE3DBuffer(buffer: Buffer): Promise<{ isValid: boolean; error?: string }> {
    if (buffer.length < 1) {
      return { isValid: false, error: 'Empty file' };
    }

    // Check E3D format version (first byte should be 1-4)
    const formatVersion = buffer[0];
    if (formatVersion < 1 || formatVersion > 4) {
      return {
        isValid: false,
        error: `Unsupported E3D format version: ${formatVersion}`
      };
    }

    return { isValid: true };
  }

  private static getFileExtension(filename: string): string {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }

  public static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }
}