import { Router, Request, Response } from 'express';
import { database } from '../database';
import { AuthService } from '../auth';
import { JsonRpcService, JsonRpcErrorCode, jsonRpcMiddleware } from '../jsonrpc';

const router = Router();

// Apply JSON-RPC middleware to all routes
router.use(jsonRpcMiddleware);

// POST /signup - JSON-RPC compliant user registration endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const { method, params, id } = req.body;

    if (method !== 'auth.signup') {
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
        'Registration parameters are required',
        id
      );
      return;
    }

    const { username, password, nickname } = params;

    if (!username || !password) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INVALID_PARAMS,
        'Username and password are required',
        id
      );
      return;
    }

    // Validate username format
    if (username.length < 3 || username.length > 50) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.VALIDATION_ERROR,
        'Username must be between 3 and 50 characters',
        id
      );
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.VALIDATION_ERROR,
        'Password must be at least 6 characters long',
        id
      );
      return;
    }

    // Check if username already exists
    const existingUser = await database.getUserByUsername(username);
    if (existingUser) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.VALIDATION_ERROR,
        'Username already exists',
        id,
        { conflict: true }
      );
      return;
    }

    // Hash password and create user
    const hashedPassword = await AuthService.hashPassword(password);
    const userId = await database.createUser(username, hashedPassword, nickname);

    // Fetch the created user to get the actual data including default points
    const createdUser = await database.getUserById(userId);
    if (!createdUser) {
      JsonRpcService.sendError(
        res,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Failed to retrieve created user',
        id
      );
      return;
    }

    // Generate token for immediate login
    const token = AuthService.generateToken({
      userId,
      username
    });

    JsonRpcService.sendSuccess(res, {
      message: 'User created successfully',
      user: {
        id: createdUser.id,
        username: createdUser.username,
        nickname: createdUser.nickname,
        points: createdUser.points
      },
      access_token: token,
      token_type: 'Bearer',
      expires_in: 86400
    }, id);

  } catch (error) {
    console.error('Signup error:', error);
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.INTERNAL_ERROR,
      'Failed to create user account',
      req.body?.id || null,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

export default router;