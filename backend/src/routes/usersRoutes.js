import { Router } from "express";
import { loginUser, registerUser } from "../controllers/userController.js";
const router = Router();

router.route("/login").post(loginUser);
router.route("/register").post(registerUser);
router.route("/add_to_activity");
router.route("/get_all_activities");

export default router;
