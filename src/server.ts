import { Hono } from "hono";
import { imageRouter } from "./images/image-router";

export const app = new Hono().route("/images", imageRouter);
