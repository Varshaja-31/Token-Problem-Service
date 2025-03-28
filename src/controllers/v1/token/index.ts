import {  Request, Response } from "express";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { get } from "lodash";
import { TokenLayer } from "services";
import { uuid } from "uuidv4";
import { POOL_TYPES , APPLICATION_MESSAGES } from "../../../utils/constants";
import moment from "moment";


const TokenLayerInstance = TokenLayer.getInstance();

/**
 * This API is used to generate unique tokens to Available Pools.
 * Implementation - 
 * It checks the size of the pool. If size of the pool exceeds the Configured Max Tokens throws Max Tokens Exceeded Error.
 * Tokens are Injected to Available Tokens Pool with Uniz Timestamp of 5 mins. 
 */

export const generate = async (req: Request, res: Response) => {
  try {
    const MAX_TOKENS = parseInt(process.env.MAX_TOKENS, 10); 

    const availablePoolCount = await TokenLayerInstance.getPoolSize(POOL_TYPES.AVAILABLE_TOKENS_POOL);
    const currentCount = get(availablePoolCount, 'data') as number;


    if (currentCount >= MAX_TOKENS) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: APPLICATION_MESSAGES.MAX_TOKENS_EXCEEDED,
        data: currentCount
      });
    }

    const tokensToGenerate = currentCount === 0 ? MAX_TOKENS : (MAX_TOKENS - currentCount);

     const timestamp = moment().add(5, "minutes").unix();
     const tokens: string[] = Array.from({ length: tokensToGenerate }).flatMap(() => [timestamp.toString(), uuid()]);

    const generatedTokens = await TokenLayerInstance.injectBulkTokensToPool(
      tokens,
      POOL_TYPES.AVAILABLE_TOKENS_POOL
    );

    return res.status(StatusCodes.OK).json({
      message: APPLICATION_MESSAGES.TOKENS_GENERATED_SUCCESSFULLY,
      data : generatedTokens
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: ReasonPhrases.INTERNAL_SERVER_ERROR,
      error: error?.message || {}
    });
  }
};


/**
 * This API is used to remove the Token From Available Pools and moves to Assigned Tokens Pool with 60 seconds unix timestamo.
 */

export const assign = async (
  req: Request,
  res: Response,
) => {
  try {
    const returnTokenFromPool = await TokenLayerInstance.removeTokenFromPool(
      POOL_TYPES.AVAILABLE_TOKENS_POOL
    );
    if (!get(returnTokenFromPool, "data"))
      return res.status(StatusCodes.NOT_FOUND).json({
        message: APPLICATION_MESSAGES.TOKEN_NOT_AVAILABLE,
    })

    const token = returnTokenFromPool?.data[0]

    const assignToken = await TokenLayerInstance.assignToken(
      token,
      POOL_TYPES.ASSIGNED_TOKENS_POOL
    );

    return res.status(StatusCodes.OK).json({
      message: APPLICATION_MESSAGES.TOKEN_ASSIGNED_SUCCESSFULLY,
      data: assignToken
    })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: ReasonPhrases.INTERNAL_SERVER_ERROR,
      error: error
    })
  }
};

/**
 * This API is used to check if the token to Release is present in Assigned Tokens Pool.
 * If Not - Throws and Error Else
 * Adds Token Back to Available Pool with default unix timestamp of 5 mins
 */

export const release = async (
  req: Request,
  res: Response,
) => {
  try {
    const {
      body: { token },
    } = req;

    const isTokenExists = await TokenLayerInstance.checkIfTokenExists(
      token,
      POOL_TYPES.ASSIGNED_TOKENS_POOL
    );
    if (!isTokenExists?.success)
      return res.status(StatusCodes.NOT_FOUND).json({
        message: APPLICATION_MESSAGES.TOKEN_NOT_FOUND
      })

    const [, addTokenBackToPool] = await Promise.all([
      TokenLayerInstance.releaseToken(token, POOL_TYPES.ASSIGNED_TOKENS_POOL),
      TokenLayerInstance.addTokenBackToPool(
        token,
        POOL_TYPES.AVAILABLE_TOKENS_POOL
      ),
    ]);

    return res.status(StatusCodes.OK).json({
      message: APPLICATION_MESSAGES.TOKEN_RELEASED,
      data : addTokenBackToPool
    })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: ReasonPhrases.INTERNAL_SERVER_ERROR,
      error: error
    })
  }
};

/**
 * This API is used to check if token not Found in assigned and available - return token not found
 * If Token is in assigned tokens Pool - It cannot be deleted since token is currently in use.
 * If Not Found - Delete the Token from the available Pool.
 */

export const deleteToken = async (
  req: Request,
  res: Response,
) => {
  try {
    const {
      body: { token },
    } = req;

    const [isTokenAssigned , isTokenAvailable] = await Promise.all([
      TokenLayerInstance.checkIfTokenExists(
        token,
        POOL_TYPES.ASSIGNED_TOKENS_POOL
      ),
      TokenLayerInstance.checkIfTokenExists(
        token,
        POOL_TYPES.AVAILABLE_TOKENS_POOL
      )
    ])

    if (!isTokenAvailable?.success && !isTokenAssigned?.success)
      return res.status(StatusCodes.NOT_FOUND).json({
        message: APPLICATION_MESSAGES.TOKEN_NOT_FOUND
      })

    if(isTokenAssigned?.success) return res.status(StatusCodes.BAD_REQUEST).json({
        message: APPLICATION_MESSAGES.TOKEN_CURRENTLY_IN_USE
    })
  

    const deleteToken = await TokenLayerInstance.releaseToken(
      token,
      POOL_TYPES.AVAILABLE_TOKENS_POOL
    );
    if (!deleteToken?.success)
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: ReasonPhrases.BAD_REQUEST
      })

    return res.status(StatusCodes.OK).json({
      message: APPLICATION_MESSAGES.TOKEN_REMOVED_FROM_POOL
    })
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: ReasonPhrases.INTERNAL_SERVER_ERROR,
      error: error
    })
  }
};


/**
 * This API is used to check If the token exists in available or assigned. If Not Found throw error.
 * If token is available and not assigned - Refresh the Token to 5 mins unix timestamp.
 * If Token is assigned - Refresh the expiration of token to 60 seconds. 
 * 
 */
export const keepAlive = async (
  req: Request,
  res: Response,
) => {
  try {
    const {
      body: { token },
    } = req;

    const [isTokenAssigned, isTokenAvailable] = await Promise.all([
      TokenLayerInstance.checkIfTokenExists(
        token,
        POOL_TYPES.ASSIGNED_TOKENS_POOL
      ),
      TokenLayerInstance.checkIfTokenExists(
        token,
        POOL_TYPES.AVAILABLE_TOKENS_POOL
      ),
    ]);

    if (!isTokenAssigned?.success && !isTokenAvailable?.success) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: APPLICATION_MESSAGES.TOKEN_NOT_FOUND
      })
    }

    if (isTokenAvailable?.success) {
      await TokenLayerInstance.addTokenBackToPool(
        token,
        POOL_TYPES.AVAILABLE_TOKENS_POOL
      );
    } else {
      await TokenLayerInstance.assignToken(
        token,
        POOL_TYPES.ASSIGNED_TOKENS_POOL
      );
    }

    return res.status(StatusCodes.OK).json({
      message: ReasonPhrases.OK,
      data: token
    })

  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: ReasonPhrases.INTERNAL_SERVER_ERROR,
      error: error
    })
  }
};

