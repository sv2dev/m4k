import { serveOpts } from "./server";

export default {
  ...serveOpts,
  hostname: Bun.env.HOSTNAME,
  port: Bun.env.PORT,
};
