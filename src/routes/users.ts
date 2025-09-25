import { Router, Request, Response } from 'express';
import { database } from '../database';
import { authenticateAdmin } from '../auth';
import { JsonRpcService, JsonRpcErrorCode, jsonRpcMiddleware } from '../jsonrpc';

const router = Router();

// Apply JSON-RPC middleware to all routes
router.use(jsonRpcMiddleware);

// POST /users - JSON-RPC endpoint for user management operations
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { method, params, id } = req.body;

    switch (method) {
      case 'users.list':
        try {
          const users = await database.getAllUsers();
          JsonRpcService.sendSuccess(res, users, id);
        } catch (error) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INTERNAL_ERROR,
            'Failed to retrieve users',
            id,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
        break;

      case 'users.get':
        try {
          if (!params || typeof params.id !== 'number') {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'User ID is required',
              id
            );
            return;
          }

          const user = await database.getUserById(params.id);
          if (!user) {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.NOT_FOUND,
              'User not found',
              id
            );
            return;
          }

          // Don't return password hash
          const { password, ...userWithoutPassword } = user;
          JsonRpcService.sendSuccess(res, userWithoutPassword, id);
        } catch (error) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INTERNAL_ERROR,
            'Failed to retrieve user',
            id,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
        break;

      case 'users.updatePoints':
        try {
          if (!params || typeof params.userId !== 'number' || typeof params.points !== 'number') {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'User ID and points are required',
              id
            );
            return;
          }

          const { userId, points } = params;

          if (points < 0) {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'Points cannot be negative',
              id
            );
            return;
          }

          // Check if user exists
          const user = await database.getUserById(userId);
          if (!user) {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.NOT_FOUND,
              'User not found',
              id
            );
            return;
          }

          await database.updateUserPoints(userId, points);
          const updatedUser = await database.getUserById(userId);
          const { password, ...userWithoutPassword } = updatedUser!;

          JsonRpcService.sendSuccess(res, {
            message: 'User points updated successfully',
            user: userWithoutPassword
          }, id);
        } catch (error) {
          JsonRpcService.sendError(
            res,
            JsonRpcErrorCode.INTERNAL_ERROR,
            'Failed to update user points',
            id,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
        break;

      case 'users.addPoints':
        try {
          if (!params || typeof params.userId !== 'number' || typeof params.points !== 'number') {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'User ID and points are required',
              id
            );
            return;
          }

          const { userId, points } = params;

          if (points <= 0) {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'Points to add must be positive',
              id
            );
            return;
          }

          const newPoints = await database.addUserPoints(userId, points);
          const updatedUser = await database.getUserById(userId);
          const { password, ...userWithoutPassword } = updatedUser!;

          JsonRpcService.sendSuccess(res, {
            message: `Added ${points} points successfully`,
            user: userWithoutPassword,
            newPoints
          }, id);
        } catch (error) {
          if (error instanceof Error && error.message === 'User not found') {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.NOT_FOUND,
              'User not found',
              id
            );
          } else {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INTERNAL_ERROR,
              'Failed to add user points',
              id,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        }
        break;

      case 'users.subtractPoints':
        try {
          if (!params || typeof params.userId !== 'number' || typeof params.points !== 'number') {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'User ID and points are required',
              id
            );
            return;
          }

          const { userId, points } = params;

          if (points <= 0) {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INVALID_PARAMS,
              'Points to subtract must be positive',
              id
            );
            return;
          }

          const newPoints = await database.subtractUserPoints(userId, points);
          const updatedUser = await database.getUserById(userId);
          const { password, ...userWithoutPassword } = updatedUser!;

          JsonRpcService.sendSuccess(res, {
            message: `Subtracted ${points} points successfully`,
            user: userWithoutPassword,
            newPoints
          }, id);
        } catch (error) {
          if (error instanceof Error && error.message === 'User not found') {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.NOT_FOUND,
              'User not found',
              id
            );
          } else {
            JsonRpcService.sendError(
              res,
              JsonRpcErrorCode.INTERNAL_ERROR,
              'Failed to subtract user points',
              id,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
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