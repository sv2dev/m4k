import { Type as T, type TSchema } from "@sinclair/typebox";
import type { TypeCheck } from "@sinclair/typebox/compiler";

export const numberQueryParamSchema = T.Transform(
  T.Union([T.String(), T.Number()])
)
  .Decode(Number)
  .Encode(JSON.stringify);

export function parse<T extends TSchema>(schema: TypeCheck<T>, value: unknown) {
  const valid = schema.Check(value);
  if (!valid) {
    const error = schema.Errors(value).First()!;
    throw new RangeError(
      `${error.path ? `[${error.path}] ` : ""}${error.message}`
    );
  }
  return schema.Decode(value);
}
