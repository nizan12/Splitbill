import express from "express";
import dotenv from "dotenv";
import { apiRouter } from "../api-routes";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

// Mount on both /api and / so both direct and rewritten requests match
app.use("/api", apiRouter);
app.use("/", apiRouter);

export default app;
