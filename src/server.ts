import Elysia from "elysia";
import { imageRouter } from "./images/image-router";
import { videoRouter } from "./videos/video-router";

export const app = new Elysia()
  .use(imageRouter("/images"))
  .use(videoRouter("/videos"));
