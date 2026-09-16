import { Router } from "express";
import { handlePusherAuth } from "../controllers/chat.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";

const pusherRouter: Router = Router();

// Pusher private-channel authorization — called by pusher-js on subscription
pusherRouter.post("/auth", ProtectMiddleWare, handlePusherAuth);

export default pusherRouter;
