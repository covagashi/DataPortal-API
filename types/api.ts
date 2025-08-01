// types/api.ts
export interface ConvertFileRequest {
  file: File;
}

export interface ConvertFileResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface EplanPartSearchResponse {
  meta: {
    page: {
      total: number;
    };
  };
  data: Array<{
    id: string;
    attributes: {
      description: {
        en_US: string;
      };
    };
  }>;
}

export interface EplanPartResponse {
  data: {
    relationships: {
      graphic_macro?: {
        data: {
          id: string;
        };
      };
    };
  };
}

export interface EplanMacroResponse {
  data: {
    attributes: {
      name: string;
    };
    relationships: {
      preview: {
        data: {
          id: string;
        };
      };
      macro_variants: {
        data: Array<{
          id: string;
        }>;
      };
    };
  };
}

export interface EplanDownloadRequest {
  partNumber: string;
  pat: string;
}

export interface ApiError {
  error: string;
  details?: string;
}