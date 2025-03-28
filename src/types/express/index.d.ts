export {};

declare global {
  namespace Express {
    export interface Request {
      requestId: string;
      requestEpoch: number;
      UTCOffset: string;
    }

    export interface Response {
      customResponse(
        httpStatusCode: number,
        data: any,
        success: boolean,
      ): Response;
    }
  }
}
