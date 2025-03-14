import type { Server } from "bun";
import { processImages } from "./images/image-router";
import { processVideo } from "./videos/video-router";

export const server = Bun.serve({
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
  hostname: Bun.env.HOSTNAME,
  port: Bun.env.PORT,
  idleTimeout: 180, // 3 minutes
});

const routes = {
  POST: {
    "/images/process": processImages,
    "/videos/process": processVideo,
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

console.log(`Server is running on ${server.hostname}:${server.port}`);
