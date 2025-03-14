import type { StaticDecode, TSchema } from "@sinclair/typebox";
import type { TypeCheck } from "@sinclair/typebox/compiler";
import { parse } from "./typebox";

export function parseOpts<TOptions extends TSchema>(
  request: Request,
  optionsSchema: TypeCheck<TOptions>,
  unflatten = (opts: any) => opts
): StaticDecode<TOptions>[] {
  if (!request.body) throw new RangeError("No body");
  return [
    ...getOptsFromQueryParams(request, optionsSchema, unflatten),
    ...getOptsFromHeader(request, optionsSchema),
  ];
}

function getOptsFromHeader<TOptions extends TSchema>(
  request: Request,
  optionsSchema: TypeCheck<TOptions>
): StaticDecode<TOptions>[] {
  const json = request.headers.get("x-options");
  if (!json) return [];
  return parseOptsJson(json, optionsSchema);
}

function getOptsFromQueryParams<TOptions extends TSchema>(
  request: Request,
  optionsSchema: TypeCheck<TOptions>,
  unflatten = (opts: any) => opts
): StaticDecode<TOptions>[] {
  const { searchParams } = new URL(request.url);
  let allOptions: StaticDecode<TOptions>[] = [];
  const { options, ...params } = Object.fromEntries(searchParams.entries());
  if (Object.keys(params).length > 0) {
    allOptions.push(parse(optionsSchema, unflatten(params)));
  }
  if (options) {
    allOptions.push(...parseOptsJson(options, optionsSchema));
  }
  return allOptions;
}

function parseOptsJson<TOptions extends TSchema>(
  json: string,
  schema: TypeCheck<TOptions>
) {
  const opts = parseJson(json);
  const optsArr = !Array.isArray(opts) ? [opts] : opts;
  return optsArr.map((o) => parse(schema, o));
}

function parseJson(json: string) {
  try {
    return JSON.parse(json);
  } catch (err) {
    throw new RangeError("Error while parsing options");
  }
}
