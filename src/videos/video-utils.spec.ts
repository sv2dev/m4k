import { describe, expect, it } from "bun:test";
import {
  getAudioEncoders,
  getAudioFilters,
  getInputFormats,
  getOutputFormats,
  getVideoEncoders,
  getVideoFilters,
} from "./video-utils";

describe("getAudioEncoders()", () => {
  it("should return the audio encoders", async () => {
    const encoders = await getAudioEncoders();

    expect(encoders["libopus"]).toBeDefined();
  });
});

describe("getVideoEncoders()", () => {
  it("should return the video encoders", async () => {
    const encoders = await getVideoEncoders();

    expect(encoders["libx264"]).toBeDefined();
  });
});

describe("getVideoFilters()", () => {
  it("should return the video filters", async () => {
    const filters = await getVideoFilters();

    expect(filters["crop"]).toBeDefined();
  });
});

describe("getAudioFilters()", () => {
  it("should return the audio filters", async () => {
    const filters = await getAudioFilters();

    expect(filters["volume"]).toBeDefined();
  });
});

describe("getInputFormats()", () => {
  it("should return the input formats", async () => {
    const formats = await getInputFormats();

    expect(formats["avi"]).toBeDefined();
  });
});

describe("getOutputFormats()", () => {
  it("should return the output formats", async () => {
    const formats = await getOutputFormats();

    expect(formats["avi"]).toBeDefined();
  });
});
