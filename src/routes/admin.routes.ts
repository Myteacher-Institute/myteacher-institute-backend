import { Router } from "express";
import { handleAddAdmin } from "../controllers/admin.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { isAdmin } from "../middleware/is-admin";

const router: Router = Router();

router.post("/add-admin", ProtectMiddleWare, isAdmin, handleAddAdmin);

export default router;
