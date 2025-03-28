import { cleanEnv, port, str , num } from 'envalid';

export const SanitizeENV = (envs) => {
  return cleanEnv(envs, {
    // Server Configurations
    NODE_ENV: str(),
    PORT: port(),

    // REDIS ENVS
    REDIS_ENABLED: str({ default: '0' }),
    REDIS_HOST: str({ default: '' }),
    REDIS_PORT: port({ default: 6379 }),
    REDIS_USERNAME: str({ default: '' }),
    REDIS_PASSWORD: str({ default: '' }),

    // Token Configurations ENVs
    MAX_TOKENS : num({ default: 0 }),

  });
};
