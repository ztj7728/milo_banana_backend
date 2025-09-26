import { Router, Response } from 'express';
import { database } from '../database';
import { authenticateToken, AuthenticatedRequest } from '../auth';
import { JsonRpcService, JsonRpcErrorCode, jsonRpcMiddleware } from '../jsonrpc';

const router = Router();

// Apply JSON-RPC middleware to all routes
router.use(jsonRpcMiddleware);

// POST /me - JSON-RPC compliant user profile endpoint (requires authentication)
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { method, id } = req.body;

    if (method !== 'user.profile') {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.METHOD_NOT_FOUND,
        `Method '${method}' not found`,
        id
      );
      return;
    }

    if (!req.user) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.AUTHENTICATION_ERROR,
        'Authentication required',
        id
      );
      return;
    }

    const user = await database.getUserById(req.user.userId);
    if (!user) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.NOT_FOUND,
        'User not found',
        id
      );
      return;
    }

    JsonRpcService.sendSuccess(res, {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      points: user.points,
      wechat_openid: user.wechat_openid,
      wechat_unionid: user.wechat_unionid,
      avatar_url: user.avatar_url,
      created_at: user.created_at
    }, id);

  } catch (error) {
    console.error('Get user profile error:', error);
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.INTERNAL_ERROR,
      'Failed to retrieve user profile',
      req.body?.id || null,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

export default router;