import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validateTenant } from "../middleware/validateTenant";
import {
  getItems,
  getItemById,
  getItemByBarcode,
  createItem,
  updateItem,
  updateItemStatus,
  deleteItem,
} from "../controllers/itemsController";

const router = Router();

router.use(authenticate);
router.use(validateTenant);

router.get("/", getItems);
router.get("/barcode/:barcode", getItemByBarcode);
router.get("/:itemId", getItemById);
router.post("/", createItem);
router.put("/:itemId", updateItem);
router.patch("/:itemId/status", updateItemStatus);
router.delete("/:itemId", deleteItem);

export default router;