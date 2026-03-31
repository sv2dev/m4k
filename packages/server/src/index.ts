import { serveOpts } from "./server.js";

export default {
  ...serveOpts,
  hostname: Bun.env.HOSTNAME,
  port: Bun.env.PORT,
};
