import { Type as T } from "@sinclair/typebox";

export const numberQueryParamSchema = T.Transform(T.String())
  .Decode(Number)
  .Encode(JSON.stringify);
