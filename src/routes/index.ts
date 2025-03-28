import { Request, Response, Router } from "express";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

const router = Router();

import v1Routes from "./v1";

router.use(`/health-check`, async (req: Request, res: Response) => {
  return res.status(
    StatusCodes.OK
    ).json({
    statusCode: StatusCodes.OK,
    status: ReasonPhrases.OK,
  });
});

router.use(`/v1`, v1Routes);

export default router;
