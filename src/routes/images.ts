import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../auth';
import { AIServiceFactory, PromptPart, SupportedPlatform } from '../services/ai-service';
import { JsonRpcService, JsonRpcErrorCode, jsonRpcMiddleware } from '../jsonrpc';
import { database } from '../database';

const router = Router();

// Apply JSON-RPC middleware to all routes
router.use(jsonRpcMiddleware);

interface GenerationParams {
  platform: SupportedPlatform;
  prompt: PromptPart[];
}

// POST /images/generations - JSON-RPC endpoint for AI content generation
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { method, params, id } = req.body;

    if (method !== 'images.generate') {
      return JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.METHOD_NOT_FOUND,
        'Method not found',
        id
      );
    }

    const { platform, prompt }: GenerationParams = params || {};

    // Validate request
    if (!platform) {
      return JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        'Platform parameter is required',
        id,
        { supportedPlatforms: ['gemini', 'openai'] }
      );
    }

    if (!prompt || !Array.isArray(prompt)) {
      return JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        'Invalid prompt format. Expected PromptPart[]',
        id
      );
    }

    // Validate platform
    if (!['gemini', 'openai'].includes(platform)) {
      return JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        `Unsupported platform: ${platform}`,
        id,
        { supportedPlatforms: ['gemini', 'openai'] }
      );
    }

    // Validate that at least one text part exists
    const hasText = prompt.some(part => part.text && part.text.trim().length > 0);
    if (!hasText) {
      return JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        'At least one text part is required in the prompt',
        id
      );
    }

    // Validate prompt parts
    for (const part of prompt) {
      if (!part.text && !part.inlineData) {
        return JsonRpcService.sendError(
          res,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Each prompt part must have either text or inlineData',
          id
        );
      }

      if (part.inlineData) {
        if (!part.inlineData.mimeType || !part.inlineData.data) {
          return JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INVALID_PARAMS,
            'inlineData must have both mimeType and data',
            id
          );
        }
      }
    }

    // Check user points before allowing generation
    const user = await database.getUserById(req.user!.userId);
    if (!user) {
      return JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'User not found',
        id
      );
    }

    if (user.points <= 0) {
      return JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_REQUEST,
        'Insufficient points. You need at least 1 point to generate images.',
        id,
        { currentPoints: user.points, requiredPoints: 1 }
      );
    }

    // Generate content using the specified platform
    const results = await AIServiceFactory.generateContent(platform, prompt);

    // Deduct 1 point from user after successful generation
    await database.subtractUserPoints(req.user!.userId, 1);

    // Return successful JSON-RPC response
    JsonRpcService.sendSuccess(res, {
      platform,
      data: results,
      generated_at: new Date().toISOString()
    }, id);

  } catch (error) {
    console.error('AI generation error:', error);

    if (error instanceof Error && error.message.includes('not yet implemented')) {
      return JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Platform not implemented',
        req.body.id,
        { message: error.message }
      );
    }

    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.INTERNAL_ERROR,
      'Failed to generate content',
      req.body.id,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
});

export default router;