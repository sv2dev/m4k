import type { ServeOptions, Server } from "bun";
import { processImageHandler } from "./images/process-image-handler";
import { processVideoHandler } from "./videos/process-video-handler";

export const serveOpts: ServeOptions = {
  maxRequestBodySize: 2 ** 40, // 1TB
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
  idleTimeout: 180,
};

const routes = {
  POST: {
    "/images/process": processImageHandler,
    "/videos/process": processVideoHandler,
  },
} as Partial<
  Record<
    string,
    Partial<
      Record<
        string,
        (req: Request, server: Server) => Promise<Response> | Response
      >
    >
  >
>;
