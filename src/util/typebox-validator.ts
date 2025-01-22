/*
 * Implementation similar to @hono/typebox-validator, but using the TypeCompiler to compile the schema once.
 * https://github.com/honojs/middleware/blob/main/packages/typebox-validator/src/index.ts
 */

import type { Static, StaticDecode, TSchema } from "@sinclair/typebox";
import { ValueGuard } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import type { ValueError } from "@sinclair/typebox/value";
import type { Context, Env, MiddlewareHandler, ValidationTargets } from "hono";
import { validator } from "hono/validator";
import IsObject = ValueGuard.IsObject;
import IsArray = ValueGuard.IsArray;

export type Hook<T, E extends Env, P extends string> = (
  result: { success: true; data: T } | { success: false; errors: ValueError[] },
  c: Context<E, P>
) => Response | Promise<Response> | void;

export function tbValidator<
  T extends TSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: Static<T> };
    out: { [K in Target]: StaticDecode<T> };
  }
>(
  target: Target,
  schema: T,
  hook?: Hook<Static<T>, E, P>,
  stripNonSchemaItems?: boolean
): MiddlewareHandler<E, P, V> {
  const C = TypeCompiler.Compile(schema);
  return validator(target, (unprocessedData, c) => {
    const data = stripNonSchemaItems
      ? removeNonSchemaItems(schema, unprocessedData)
      : unprocessedData;

    if (C.Check(data)) {
      if (hook) {
        const hookResult = hook({ success: true, data: C.Decode(data) }, c);
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult;
        }
      }
      return C.Decode(data);
    }

    const errors = Array.from(C.Errors(data));
    if (hook) {
      const hookResult = hook({ success: false, errors }, c);
      if (hookResult instanceof Response || hookResult instanceof Promise) {
        return hookResult;
      }
    }

    return c.json({ success: false, errors }, 400);
  }) as any;
}

function removeNonSchemaItems<T extends TSchema>(
  schema: T,
  obj: any
): Static<T> {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeNonSchemaItems(schema.items, item));
  }

  const result: any = {};
  for (const key in schema.properties) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const propertySchema = schema.properties[key];
      if (IsObject(propertySchema) && !IsArray(propertySchema)) {
        result[key] = removeNonSchemaItems(
          propertySchema as unknown as TSchema,
          obj[key]
        );
      } else {
        result[key] = obj[key];
      }
    }
  }

  return result;
}
