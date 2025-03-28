declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: string;
    PORT: string;
   
    REDIS_ENABLED: string;
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_USERNAME: string;
    REDIS_PASSWORD: string;
    REDIS_PROCESS_EXIST_ON_FAILURE: string;
  }
}
