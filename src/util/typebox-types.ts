import { Type as T } from "@sinclair/typebox";

export const numberQueryParamSchema = T.Transform(
  T.Union([T.String(), T.Number()])
)
  .Decode(Number)
  .Encode(JSON.stringify);
