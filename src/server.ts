import type { Server } from "bun";
import { processImage, processMultiImage } from "./images/image-router";
import { processVideo } from "./videos/video-router";

export const server = Bun.serve({
  fetch: async (req, server) => {
    const { pathname } = new URL(req.url);
    try {
      return (
        (await routes[req.method]?.[pathname]?.(req, server)) ??
        new Response("Not found", { status: 404 })
      );
    } catch (e) {
      if (e instanceof RangeError) {
        return new Response(e.message, { status: 400 });
      }
      return new Response("Internal server error", { status: 500 });
    }
  },
});

const routes = {
  POST: {
    "/images/process": processImage,
    "/images/process/multi": processMultiImage,
    "/videos/process": processVideo,
  },
} as Partial<
  Record<
    string,
    Partial<Record<string, (req: Request, server: Server) => Promise<Response>>>
  >
>;
