import { Router, Request, Response } from 'express';
import { database } from '../database';
import { authenticateAdmin } from '../auth';
import { JsonRpcService, JsonRpcErrorCode, jsonRpcMiddleware } from '../jsonrpc';

const router = Router();

// Apply JSON-RPC middleware to all routes
router.use(jsonRpcMiddleware);

// POST /config - JSON-RPC endpoint for configuration operations
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { method, params, id } = req.body;

    switch (method) {
      case 'config.get':
        try {
          const config = await database.getConfig();
          JsonRpcService.sendSuccess(res, config, id);
        } catch (error) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INTERNAL_ERROR,
            'Failed to retrieve configuration',
            id,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
        break;

      case 'config.update':
        try {
          if (!params || typeof params !== 'object') {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'Configuration parameters are required',
              id
            );
            return;
          }

          const { baseUrl, apiKey, model } = params;
          
          if (!baseUrl && !apiKey && !model) {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'At least one configuration field is required',
              id
            );
            return;
          }

          const updates: any = {};
          if (baseUrl) updates.baseUrl = baseUrl;
          if (apiKey) updates.apiKey = apiKey;
          if (model) updates.model = model;

          await database.updateConfig(updates);
          const updatedConfig = await database.getConfig();
          
          JsonRpcService.sendSuccess(res, {
            message: 'Configuration updated successfully',
            config: updatedConfig
          }, id);
        } catch (error) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INTERNAL_ERROR,
            'Failed to update configuration',
            id,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
        break;

      default:
        JsonRpcService.sendError(
          res,
          JsonRpcErrorCode.METHOD_NOT_FOUND,
          `Method '${method}' not found`,
          id
        );
    }
  } catch (error) {
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req.body?.id || null,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

export default router;