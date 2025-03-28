import redis from "ioredis";

import { CacheConfiguration } from "../../types";
import moment from "moment";
import scheduler from "node-schedule";
import { POOL_TYPES } from "../../utils/constants";

class TokenLayer {
  public static _instance: TokenLayer;
  private configuration: CacheConfiguration;
  private client: redis;

  constructor(configuration: CacheConfiguration) {
    if (!TokenLayer._instance) {
      this.configuration = configuration;
      TokenLayer._instance = this;
    }

    return TokenLayer._instance;
  }

  static getInstance(): TokenLayer {
    return this._instance;
  }

  private createClient() {
    this.client = new redis({
      host: this.configuration.host,
      port: this.configuration.port,
      ...(this.configuration.password && {
        password: this.configuration.password,
      }),
      ...(this.configuration.username && {
        username: this.configuration.username,
      }),
    } as any);
  }

  private setEvents() {
    this.client.on("connect", () => {
      console.log("CONNECTED", { component: "TOKEN-SERVICE" });
      this.startValidatorJob();
    });

    this.client.on("ready", () => {
      console.log("CLIENT IS READY", { component: "TOKEN-SERVICE" });
    });

    this.client.on("error", (error) => {
      console.error(`CONNECTION ERROR`, { component: "TOKEN-SERVICE", error });
      process.exit(1);
    });

    this.client.on("end", () => {
      console.error(`DISCONNECTED`, { component: "TOKEN-SERVICE" });
      process.exit(1);
    });
  }

  // Events to work on Redis Connection.
  async connect() {
    try {
      this.createClient();
      this.setEvents();
      await this.client.connect();
      await this.pingRedis();
    } catch (error) {
    }
  }

  // Disconnect Redis Function
  async disconnect() {
    try {
      await this.client.quit();
    } catch (error) {
      console.log(`DISCONNECTION FAILURE`, { component: "TOKEN-SERVICE", error });
    }
  }


  // Ping Redus 
  async pingRedis() {
    try {
      const resp = await this.client.ping();
      console.log(`PING - ${resp}`, { component: "TOKEN-SERVICE" });
    } catch (error) {
      console.error(`PING FAILURE`, { component: "TOKEN-SERVICE", error });
    }
  }

  // Get Current Pool Size.
  async getPoolSize(
    poolType : string
  ): Promise<{ success: boolean; data?: number; message?: string }> {
    try {
      const getCount = await this.client.zcard(poolType);
      return {
        success: true,
        data : getCount
      }
    }
    catch(error){
      return {
        success: false,
        data : 0
      };
    }
  }

  // Pipeline to inject multiple bulk tokens to avaialble pools. 
  async injectBulkTokensToPool(
    tokens: string[],
    poolType: string
  ): Promise<{ success: boolean; data?: string[]; message?: string }> {
    try {
      const timestamp = moment().add(5, "minutes").unix();
      const pipeline = this.client.pipeline();
      pipeline.zadd(
        poolType,
        ...tokens.flatMap((eachToken) => [timestamp, eachToken])
      );
      await pipeline.exec();

      return {
        success: true,
        data: tokens,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

 

  // Function to Pop the Token from the Pool to move to assisgned,
  async removeTokenFromPool(poolType: string): 
  Promise<{
      success: boolean;
      data?: string[];
      message?: string;
    }>  {
    try {
      const data = await this.client.zpopmin(poolType);
      if (!data.length)
        return {
          success: false,
          data: null,
        };
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Function to Add token to Assigned Pools.
  async assignToken(
    token: string,
    poolType: string
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const expiryTimeStamp = moment().add(60, "seconds").unix();

      await this.client.zadd(poolType, expiryTimeStamp, token);
      return {
        success: true,
        data: token,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Function to check if token exists in Pool.
  async checkIfTokenExists(
    token: string,
    poolType: string
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const data = await this.client.zscore(poolType, token);
      if (data === null)
        return {
          success: false,
          message: null,
        };

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }


  // Function to add Token to pool.
  async addTokenBackToPool(
    token: string,
    poolType: string
  ): Promise<{ success: boolean; data?: string; message?: string }> {
    try {
      const timestamp = moment().add(5, "minutes").unix();
      this.client.zadd(poolType, timestamp, token);

      return {
        success: true,
        data: token,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Function to Remove token from the pool.
  async releaseToken(
    token: string,
    poolType: string
  ): Promise<{ success: boolean; data?: string; message?: string }> {
    try {
      this.client.zrem(poolType, token);

      return {
        success: true,
        data: token,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * A Scheduler that Runs every 1 minute to check the token expration time.
   * In Available Tokens Pool - Check all the tokens that have exceeded 5 mins. If yes Remove all the tokens from available pools.
   * In Assigned Tokens Pool - Check all the tokens that have exceeded 60 seconds, If Yes Remove all the tokens from assigned pools.
   */

  async startValidatorJob() {
    scheduler.scheduleJob("*/1 * * * *", async () => {
      try {
        const currentTime = moment().unix();

        // Fetch expired tokens in parallel
        const [expiredAvailableTokens, expiredAssignedTokens] =
          await Promise.all([
            this.client.zrangebyscore(
              POOL_TYPES.AVAILABLE_TOKENS_POOL,
              "-inf",
              currentTime
            ),
            this.client.zrangebyscore(
              POOL_TYPES.ASSIGNED_TOKENS_POOL,
              "-inf",
              currentTime
            ),
          ]);

        const pipeline = this.client.pipeline(); 
        if (expiredAssignedTokens.length) {
          const newExpiryTime = moment().add(4, "minutes").unix();

          expiredAssignedTokens.forEach((token) => {
            pipeline.zadd(
              POOL_TYPES.AVAILABLE_TOKENS_POOL,
              newExpiryTime,
              token
            );
            pipeline.zrem(POOL_TYPES.ASSIGNED_TOKENS_POOL, token);
          });
        }

        if (expiredAvailableTokens.length) {
          pipeline.zrem(
            POOL_TYPES.AVAILABLE_TOKENS_POOL,
            ...expiredAvailableTokens
          );
        }

        await pipeline.exec(); 
      } catch (error) {
        console.error(`Validator Job] Error:`, error);
      }
    });
  }
}

export { TokenLayer };
