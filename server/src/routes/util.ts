import type { NextFunction, Request, Response } from 'express';

export const wrap = (fn: (req: Request) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req).then((data) => res.json(data)).catch(next);

export const badRequest = (message: string, status = 400) => Object.assign(new Error(message), { status });
