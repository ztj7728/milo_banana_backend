import { Router, Request, Response } from 'express';
import { database } from '../database';
import { authenticateAdmin, AuthenticatedRequest } from '../auth';
import { JsonRpcService, JsonRpcErrorCode, jsonRpcMiddleware } from '../jsonrpc';

const router = Router();

// Apply JSON-RPC middleware to all routes
router.use(jsonRpcMiddleware);

// POST /prompt_store - JSON-RPC endpoint for prompt store operations
router.post('/', async (req: Request, res: Response) => {
  try {
    const { method, params, id } = req.body;

    // Read operations are publicly accessible
    if (method === 'prompts.list' || method === 'prompts.get') {
      await handleReadOperations(req, res, method, params, id);
    } else if (method === 'prompts.create' || method === 'prompts.update' || method === 'prompts.delete') {
      // Write operations require admin authentication
      return authenticateAdmin(req as AuthenticatedRequest, res, async () => {
        await handleWriteOperations(req as AuthenticatedRequest, res, method, params, id);
      });
    } else {
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

async function handleReadOperations(req: Request, res: Response, method: string, params: any, id: any) {
  switch (method) {
    case 'prompts.list':
      try {
        const prompts = await database.getAllPrompts();
        JsonRpcService.sendSuccess(res, prompts, id);
      } catch (error) {
        JsonRpcService.sendError(
          res,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Failed to retrieve prompts',
          id,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      break;

    case 'prompts.get':
      try {
        if (!params || typeof params.id !== 'number') {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INVALID_PARAMS,
            'Prompt ID is required',
            id
          );
          return;
        }

        const prompt = await database.getPromptById(params.id);
        if (!prompt) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.NOT_FOUND,
            'Prompt not found',
            id
          );
          return;
        }

        JsonRpcService.sendSuccess(res, prompt, id);
      } catch (error) {
        JsonRpcService.sendError(
          res,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Failed to retrieve prompt',
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
}

async function handleWriteOperations(req: AuthenticatedRequest, res: Response, method: string, params: any, id: any) {
  switch (method) {
    case 'prompts.create':
      try {
        if (!params || typeof params !== 'object') {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INVALID_PARAMS,
            'Prompt data is required',
            id
          );
          return;
        }

        const { prompt, category, title, description, cover_image, image_required, variable_required } = params;

        if (!prompt || !category || !title) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INVALID_PARAMS,
            'Prompt, category, and title are required',
            id
          );
          return;
        }

        const promptId = await database.createPrompt({
          prompt,
          category,
          title,
          description,
          cover_image,
          image_required: typeof image_required === 'number' ? image_required : (image_required ? 1 : 0),
          variable_required: typeof variable_required === 'boolean' ? variable_required : Boolean(variable_required)
        });

        const newPrompt = await database.getPromptById(promptId);
        JsonRpcService.sendSuccess(res, {
          message: 'Prompt created successfully',
          prompt: newPrompt
        }, id);
      } catch (error) {
        JsonRpcService.sendError(
          res,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Failed to create prompt',
          id,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      break;

    case 'prompts.update':
      try {
        if (!params || typeof params !== 'object' || typeof params.id !== 'number') {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INVALID_PARAMS,
            'Prompt ID and update data are required',
            id
          );
          return;
        }

        const { id: promptId, ...rawUpdateData } = params;

        // Convert data types properly
        const updateData: any = {};
        Object.keys(rawUpdateData).forEach(key => {
          if (key === 'image_required') {
            updateData[key] = typeof rawUpdateData[key] === 'number' ? rawUpdateData[key] : (rawUpdateData[key] ? 1 : 0);
          } else if (key === 'variable_required') {
            updateData[key] = typeof rawUpdateData[key] === 'boolean' ? rawUpdateData[key] : Boolean(rawUpdateData[key]);
          } else {
            updateData[key] = rawUpdateData[key];
          }
        });

        // Check if prompt exists
        const existingPrompt = await database.getPromptById(promptId);
        if (!existingPrompt) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.NOT_FOUND,
            'Prompt not found',
            id
          );
          return;
        }

        await database.updatePrompt(promptId, updateData);
        const updatedPrompt = await database.getPromptById(promptId);

        JsonRpcService.sendSuccess(res, {
          message: 'Prompt updated successfully',
          prompt: updatedPrompt
        }, id);
      } catch (error) {
        JsonRpcService.sendError(
          res,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Failed to update prompt',
          id,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      break;

    case 'prompts.delete':
      try {
        if (!params || typeof params.id !== 'number') {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INVALID_PARAMS,
            'Prompt ID is required',
            id
          );
          return;
        }

        // Check if prompt exists
        const existingPrompt = await database.getPromptById(params.id);
        if (!existingPrompt) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.NOT_FOUND,
            'Prompt not found',
            id
          );
          return;
        }

        await database.deletePrompt(params.id);

        JsonRpcService.sendSuccess(res, {
          message: 'Prompt deleted successfully'
        }, id);
      } catch (error) {
        JsonRpcService.sendError(
          res,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Failed to delete prompt',
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
}

export default router;