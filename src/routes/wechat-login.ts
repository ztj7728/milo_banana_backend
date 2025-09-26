import { Router, Request, Response } from 'express';
import { database } from '../database';
import { AuthService } from '../auth';
import { JsonRpcService, JsonRpcErrorCode, jsonRpcMiddleware } from '../jsonrpc';
import { createWeChatService } from '../wechat';

const router = Router();

// Apply JSON-RPC middleware to all routes
router.use(jsonRpcMiddleware);

// POST /wechat-login - JSON-RPC compliant WeChat login endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const { method, params, id } = req.body;

    if (method !== 'auth.wechat_login') {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.METHOD_NOT_FOUND,
        `Method '${method}' not found`,
        id
      );
      return;
    }

    if (!params || typeof params !== 'object') {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        'WeChat login parameters are required',
        id
      );
      return;
    }

    const { code, platform, userInfo, encryptedData, iv, signature, rawData } = params;

    if (!code) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        'WeChat authorization code is required',
        id
      );
      return;
    }

    // Detect platform - default to 'miniprogram' if not specified for backward compatibility
    const loginPlatform = platform || 'miniprogram';

    // Initialize WeChat service
    const wechatService = createWeChatService();
    if (!wechatService) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'WeChat service not configured. Please set WeChat credentials in environment variables',
        id
      );
      return;
    }

    // Use appropriate API based on platform
    let authResponse;
    try {
      if (loginPlatform === 'miniprogram') {
        // Use Mini-Program API
        authResponse = await wechatService.getMiniProgramSession(code);
      } else {
        // Use OAuth API for web/app
        authResponse = await wechatService.getAccessToken(code);
      }
    } catch (error) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INTERNAL_ERROR,
        `WeChat API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        id
      );
      return;
    }

    if (authResponse.errcode) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.AUTHENTICATION_ERROR,
        `WeChat authentication failed: ${authResponse.errmsg || 'Unknown error'}`,
        id,
        {
          error: 'wechat_auth_failed',
          wechat_error_code: authResponse.errcode,
          wechat_error_msg: authResponse.errmsg
        }
      );
      return;
    }

    if (!authResponse.openid) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.AUTHENTICATION_ERROR,
        'WeChat openid not received',
        id,
        { error: 'invalid_wechat_response' }
      );
      return;
    }

    // Check if user already exists
    let user = await database.getUserByWeChatOpenid(authResponse.openid);
    let isNewUser = false;

    if (!user) {
      // User doesn't exist, create new account
      let nickname = userInfo?.nickName;
      let avatarUrl = userInfo?.avatarUrl;

      // If we have access_token, try to get more detailed user info
      if (authResponse.access_token) {
        try {
          const detailedUserInfo = await wechatService.getUserInfo(
            authResponse.access_token,
            authResponse.openid
          );

          if (!detailedUserInfo.errcode) {
            nickname = nickname || detailedUserInfo.nickname;
            avatarUrl = avatarUrl || detailedUserInfo.headimgurl;
          }
        } catch (error) {
          // Ignore error, use basic userInfo if available
          console.warn('Failed to fetch detailed WeChat user info:', error);
        }
      }

      // Create new user
      const userId = await database.createWeChatUser(
        authResponse.openid,
        authResponse.unionid,
        avatarUrl,
        nickname
      );

      // Fetch the created user
      user = await database.getUserById(userId);
      isNewUser = true;

      if (!user) {
        JsonRpcService.sendError(
          res,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Failed to create WeChat user',
          id
        );
        return;
      }
    }

    // Generate JWT token
    const token = AuthService.generateToken({
      userId: user.id,
      username: user.username
    });

    // Prepare user response (excluding sensitive data)
    const userResponse = {
      id: user.id,
      username: user.username,
      points: user.points,
      wechat_openid: user.wechat_openid,
      wechat_unionid: user.wechat_unionid,
      avatar_url: user.avatar_url,
      nickname: user.nickname,
      created_at: user.created_at
    };

    // Send successful response
    JsonRpcService.sendSuccess(res, {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours in seconds
      user: userResponse,
      is_new_user: isNewUser
    }, id);

  } catch (error) {
    console.error('WeChat login error:', error);
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.INTERNAL_ERROR,
      'Internal server error during WeChat authentication',
      req.body?.id || null,
      {
        error: 'server_error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
});

export default router;