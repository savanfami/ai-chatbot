import { Router } from "express";
import users from "../data/users.json";

const router = Router();

router.get("/", (req, res) => {
  const normalUsers = users.filter((u) => u.username);
  res.json(normalUsers);
});

export default router;
