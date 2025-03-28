import { Router } from 'express';

import TokenServiceRoutes from './token';

const router = Router();

router.use('/core', TokenServiceRoutes);

export default router;
