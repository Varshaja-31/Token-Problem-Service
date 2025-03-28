import { Request, Response, NextFunction } from "express";
import { AnySchema } from "yup";

export const validateRequest =
  (schema: AnySchema) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.validate(req.body, { abortEarly: false, stripUnknown: true });
      next();
    } catch (error) {
      res.status(400).json({ success: false, errors: error.errors });
    }
  };
