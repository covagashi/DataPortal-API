// lib/services/eplan-client.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  EplanPartSearchResponse,
  EplanPartResponse,
  EplanMacroResponse,
  ApiError
} from '@/types/api';

export interface EplanPartInfo {
  id: string;
  description: string;
  partNumber: string;
}

export interface EplanMacroInfo {
  id: string;
  name: string;
  is3D: boolean;
  variants: string[];
}

export class EplanApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: string
  ) {
    super(message);
    this.name = 'EplanApiError';
  }
}

export class EplanClient {
  private readonly baseURL = 'https://dataportal.eplan.com/api';
  private client: AxiosInstance;

  constructor(private pat: string) {
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer PAT:${pat}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000, // 30 seconds
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          const message = data?.message || data?.error || error.message;
          throw new EplanApiError(message, status, JSON.stringify(data));
        }
        throw new EplanApiError(error.message);
      }
    );
  }

  public async searchPart(partNumber: string): Promise<EplanPartInfo | null> {
    try {
      const response: AxiosResponse<EplanPartSearchResponse> = await this.client.get(
        `/parts?search=${encodeURIComponent(partNumber)}&fuzziness=0`
      );

      if (response.data.meta.page.total === 0) {
        return null;
      }

      const partData = response.data.data[0];
      return {
        id: partData.id,
        description: partData.attributes.description.en_US,
        partNumber
      };
    } catch (error) {
      if (error instanceof EplanApiError) {
        throw error;
      }
      throw new EplanApiError('Failed to search for part', undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  public async getPartInfo(partId: string): Promise<EplanPartResponse> {
    try {
      const response: AxiosResponse<EplanPartResponse> = await this.client.get(`/parts/${partId}`);
      return response.data;
    } catch (error) {
      if (error instanceof EplanApiError) {
        throw error;
      }
      throw new EplanApiError('Failed to get part info', undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  public async getMacroInfo(macroId: string): Promise<EplanMacroInfo> {
    try {
      const response: AxiosResponse<EplanMacroResponse> = await this.client.get(`/macros/${macroId}`);
      const macroData = response.data.data;

      const is3D = this.is3DMacro(macroData);
      const variants = macroData.relationships.macro_variants.data.map(v => v.id);

      return {
        id: macroId,
        name: macroData.attributes.name,
        is3D,
        variants
      };
    } catch (error) {
      if (error instanceof EplanApiError) {
        throw error;
      }
      throw new EplanApiError('Failed to get macro info', undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  public async downloadE3DData(variantId: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/download/e3d_data/${variantId}`, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      if (error instanceof EplanApiError) {
        throw error;
      }
      throw new EplanApiError('Failed to download E3D data', undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  public async downloadPartAs3D(partNumber: string): Promise<{
    buffer: Buffer;
    partInfo: EplanPartInfo;
    macroInfo: EplanMacroInfo;
  }> {
    // Step 1: Search for part
    const partInfo = await this.searchPart(partNumber);
    if (!partInfo) {
      throw new EplanApiError(`Part not found: ${partNumber}`, 404);
    }

    // Step 2: Get part details
    const partResponse = await this.getPartInfo(partInfo.id);
    if (!partResponse.data.relationships.graphic_macro) {
      throw new EplanApiError('No graphic macro found for this part', 404);
    }

    // Step 3: Get macro info
    const macroId = partResponse.data.relationships.graphic_macro.data.id;
    const macroInfo = await this.getMacroInfo(macroId);

    if (!macroInfo.is3D) {
      throw new EplanApiError('This part does not have 3D data available', 400);
    }

    if (macroInfo.variants.length === 0) {
      throw new EplanApiError('No 3D variants found for this part', 404);
    }

    // Step 4: Download first available variant
    const variantId = macroInfo.variants[0];
    const buffer = await this.downloadE3DData(variantId);

    return {
      buffer,
      partInfo,
      macroInfo
    };
  }

  private is3DMacro(macroData: EplanMacroResponse['data']): boolean {
    // Check if macro name ends with '3d'
    if (macroData.attributes.name.toLowerCase().endsWith('3d')) {
      return true;
    }

    // Check if preview ID ends with '3d.ema'
    const previewId = macroData.relationships.preview.data.id;
    if (previewId.toLowerCase().endsWith('3d.ema')) {
      return true;
    }

    return false;
  }

  public validatePAT(): Promise<boolean> {
    return this.client.get('/parts?limit=1')
      .then(() => true)
      .catch(() => false);
  }

  public static sanitizePartNumber(partNumber: string): string {
    // Remove invalid characters and normalize
    return partNumber
      .trim()
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_');
  }

  public static validatePartNumber(partNumber: string): { isValid: boolean; error?: string } {
    if (!partNumber || partNumber.trim().length === 0) {
      return { isValid: false, error: 'Part number is required' };
    }

    if (partNumber.length > 100) {
      return { isValid: false, error: 'Part number is too long (max 100 characters)' };
    }

    // Basic pattern validation (adjust as needed)
    const validPattern = /^[A-Za-z0-9_\-\.]+$/;
    if (!validPattern.test(partNumber)) {
      return { isValid: false, error: 'Part number contains invalid characters' };
    }

    return { isValid: true };
  }

  public static validatePAT(pat: string): { isValid: boolean; error?: string } {
    if (!pat || pat.trim().length === 0) {
      return { isValid: false, error: 'PAT token is required' };
    }

    if (pat.length < 10) {
      return { isValid: false, error: 'PAT token is too short' };
    }

    if (pat.length > 500) {
      return { isValid: false, error: 'PAT token is too long' };
    }

    return { isValid: true };
  }
}
