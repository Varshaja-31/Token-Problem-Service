import  { Router } from 'express';

import { V1Controller } from 'controllers';
import { validateRequest } from "../../../middlewares/validateRequest";
import {TokenSchema} from '../../../utils/validations'

const router = Router();


router.get(
  '/generate',
  V1Controller.TokenController.generate,
);

router.get(
  '/assign',
  V1Controller.TokenController.assign,
);

router.post(
  '/release',
  validateRequest(TokenSchema),
  V1Controller.TokenController.release
)

router.post(
  '/keep-alive',
  validateRequest(TokenSchema),
  V1Controller.TokenController.keepAlive
)

export default router;
