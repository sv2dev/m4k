import { Type as T } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { describe, expect, it } from "bun:test";
import { parseOpts } from "./request-parsing";

const schema = T.Object({ name: T.String() });

const compiledSchema = TypeCompiler.Compile(schema);

describe("parseOpts", () => {
  it("should parse the options 'options' query param", () => {
    const request = new Request(
      'http://localhost:3000/process?options=[{"name":"test"}]',
      { method: "POST", body: "test" }
    );

    const options = parseOpts(request, compiledSchema);

    expect(options).toEqual([{ name: "test" }]);
  });

  it("should throw an error, if the 'options' query param is invalid", () => {
    const request = new Request(
      'http://localhost:3000/process?options=[{"nam":"test"}]',
      { method: "POST", body: "test" }
    );

    try {
      parseOpts(request, compiledSchema);
      throw new Error("Expected an error");
    } catch (err) {
      expect(err).toBeInstanceOf(RangeError);
      expect((err as RangeError).message).toEqual(
        "[/name] Expected required property"
      );
    }
  });

  it("should parse the remaining query params as options", () => {
    const request = new Request("http://localhost:3000/process?name=test", {
      method: "POST",
      body: "test",
    });

    const options = parseOpts(request, compiledSchema);

    expect(options).toEqual([{ name: "test" }]);
  });

  it("should throw an error, if the query params are invalid", () => {
    const request = new Request("http://localhost:3000/process?nam=test", {
      method: "POST",
      body: "test",
    });

    try {
      parseOpts(request, compiledSchema);
      throw new Error("Expected an error");
    } catch (err) {
      expect(err).toBeInstanceOf(RangeError);
      expect((err as RangeError).message).toEqual(
        "[/name] Expected required property"
      );
    }
  });

  it("should parse the options from X-Options header", () => {
    const request = new Request("http://localhost:3000/process", {
      method: "POST",
      body: "test",
      headers: {
        "x-options": '[{"name":"test"}]',
      },
    });

    const options = parseOpts(request, compiledSchema);

    expect(options).toEqual([{ name: "test" }]);
  });

  it("should throw an error, if the X-Options header is invalid", () => {
    const request = new Request("http://localhost:3000/process", {
      method: "POST",
      body: "test",
      headers: {
        "x-options": "[{}]",
      },
    });

    try {
      parseOpts(request, compiledSchema);
      throw new Error("Expected an error");
    } catch (err) {
      expect(err).toBeInstanceOf(RangeError);
      expect((err as RangeError).message).toEqual(
        "[/name] Expected required property"
      );
    }
  });

  it("should combine all options that were provided via query params and the X-Options header", () => {
    const request = new Request(
      'http://localhost:3000/process?name=test&options=[{"name": "test2"}]',
      {
        method: "POST",
        body: "test",
        headers: {
          "x-options": '[{"name":"test3"}]',
        },
      }
    );

    const options = parseOpts(request, compiledSchema);

    expect(options).toEqual([
      { name: "test" },
      { name: "test2" },
      { name: "test3" },
    ]);
  });
});
