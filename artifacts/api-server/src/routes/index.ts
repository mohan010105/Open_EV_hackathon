import { Router, type IRouter } from "express";
import healthRouter from "./health";
import envRouter from "./env";

const router: IRouter = Router();

router.use(healthRouter);
router.use(envRouter);

export default router;
