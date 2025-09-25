import { Request, Response } from 'express';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  result: any;
  id: string | number | null;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  error: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  // Application specific errors (custom range)
  AUTHENTICATION_ERROR = -32001,
  AUTHORIZATION_ERROR = -32002,
  VALIDATION_ERROR = -32003,
  NOT_FOUND = -32004,
  RATE_LIMIT_EXCEEDED = -32005
}

export class JsonRpcService {
  static createSuccessResponse(result: any, id: string | number | null): JsonRpcSuccessResponse {
    return {
      jsonrpc: '2.0',
      result,
      id
    };
  }

  static createErrorResponse(
    code: JsonRpcErrorCode,
    message: string,
    id: string | number | null,
    data?: any
  ): JsonRpcErrorResponse {
    return {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        data
      },
      id
    };
  }

  static sendSuccess(res: Response, result: any, id: string | number | null): void {
    const response = this.createSuccessResponse(result, id);
    res.status(200).json(response);
  }

  static sendError(
    res: Response,
    code: JsonRpcErrorCode,
    message: string,
    id: string | number | null,
    data?: any
  ): void {
    const response = this.createErrorResponse(code, message, id, data);
    res.status(200).json(response);
  }

  static parseRequest(req: Request): JsonRpcRequest {
    const { jsonrpc, method, params, id } = req.body;
    
    if (jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version');
    }
    
    if (!method || typeof method !== 'string') {
      throw new Error('Invalid method');
    }

    return { jsonrpc, method, params, id };
  }

  static validateRequest(req: Request): boolean {
    try {
      this.parseRequest(req);
      return true;
    } catch {
      return false;
    }
  }
}

export const jsonRpcMiddleware = (req: Request, res: Response, next: any) => {
  try {
    const jsonRpcRequest = JsonRpcService.parseRequest(req);
    req.body = jsonRpcRequest;
    next();
  } catch (error) {
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.INVALID_REQUEST,
      'Invalid JSON-RPC request format',
      null,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
};