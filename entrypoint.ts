import { app } from "./src/server";

app.listen(
  {
    port: 3000,
    development: Bun.env.NODE_ENV !== "production",
  },
  () => console.log("Server is running on port 3000")
);
