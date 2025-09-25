import { Router, Request, Response } from 'express';
import { database } from '../database';
import { AuthService, authenticateToken, AuthenticatedRequest } from '../auth';
import { JsonRpcService, JsonRpcErrorCode, jsonRpcMiddleware } from '../jsonrpc';

const router = Router();

// Apply JSON-RPC middleware to all routes
router.use(jsonRpcMiddleware);

// POST /login - JSON-RPC compliant login endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const { method, params, id } = req.body;

    if (method !== 'auth.login') {
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
        'Login parameters are required',
        id
      );
      return;
    }

    const { username, password, grant_type } = params;

    // OAuth2 compliance - check grant_type
    if (grant_type && grant_type !== 'password') {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        'Only password grant type is supported',
        id,
        { error: 'unsupported_grant_type' }
      );
      return;
    }

    if (!username || !password) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        'Username and password are required',
        id,
        { error: 'invalid_request' }
      );
      return;
    }

    const user = await database.getUserByUsername(username);
    if (!user) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.AUTHENTICATION_ERROR,
        'Invalid username or password',
        id,
        { error: 'invalid_grant' }
      );
      return;
    }

    const isValidPassword = await AuthService.comparePassword(password, user.password);
    if (!isValidPassword) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.AUTHENTICATION_ERROR,
        'Invalid username or password',
        id,
        { error: 'invalid_grant' }
      );
      return;
    }

    const token = AuthService.generateToken({
      userId: user.id,
      username: user.username
    });

    // OAuth2-compliant response wrapped in JSON-RPC
    JsonRpcService.sendSuccess(res, {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours in seconds
      scope: 'read write'
    }, id);

  } catch (error) {
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.INTERNAL_ERROR,
      'Internal server error during authentication',
      req.body?.id || null,
      { 
        error: 'server_error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
});

export default router;