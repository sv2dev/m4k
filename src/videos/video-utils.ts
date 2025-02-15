import { $ } from "bun";

export const ffmpegPath =
  Bun.env.FFMPEG_PATH ?? (await import("@ffmpeg-installer/ffmpeg")).path;

export async function getAudioEncoders() {
  return (await (encoders ??= loadEncoders())).audio;
}

export async function getVideoEncoders() {
  return (await (encoders ??= loadEncoders())).video;
}

export async function getSubtitleEncoders() {
  return (await (encoders ??= loadEncoders())).subtitle;
}

export async function getVideoFilters() {
  return (await (filters ??= loadFilters())).video;
}

export async function getAudioFilters() {
  return (await (filters ??= loadFilters())).audio;
}

export async function getInputFormats() {
  return (await (formats ??= loadFormats())).input;
}

export async function getOutputFormats() {
  return (await (formats ??= loadFormats())).output;
}

type Features = Record<string, string>;

let encoders: Promise<{ audio: Features; video: Features; subtitle: Features }>;
let filters: Promise<{ audio: Features; video: Features }>;
let formats: Promise<{ input: Features; output: Features }>;

async function loadEncoders() {
  const text = await $`${ffmpegPath} -encoders`.text();
  const lines = text.split("\n");
  const idx = lines.indexOf(" ------");
  const encoderLines = lines.slice(idx + 1);
  const audio: Features = {};
  const video: Features = {};
  const subtitle: Features = {};
  for (const line of encoderLines) {
    const match = line.match(/^\s*(A|V|S)\S*\s(\S+)\s+(.*)$/);
    if (!match) continue;
    const [, type, name, description] = match;
    if (type === "A") audio[name] = description;
    else if (type === "V") video[name] = description;
    else if (type === "S") subtitle[name] = description;
  }
  return { audio, video, subtitle };
}

async function loadFilters() {
  const text = await $`${ffmpegPath} -filters`.text();
  const lines = text.split("\n");
  const idx = lines.indexOf("  | = Source or sink filter");
  const encoderLines = lines.slice(idx + 1);
  const audio: Features = {};
  const video: Features = {};
  for (const line of encoderLines) {
    const match = line.match(/^\s*\S+\s(\S+)\s+\S+->(A|V)\s+(.+)$/);
    if (!match) continue;
    const [, name, type, description] = match;
    if (type === "A") audio[name] = description;
    else if (type === "V") video[name] = description;
  }
  return { audio, video };
}

async function loadFormats() {
  const text = await $`${ffmpegPath} -formats`.text();
  const lines = text.split("\n");
  const idx = lines.indexOf("  | = Source or sink filter");
  const encoderLines = lines.slice(idx + 1);
  const input: Features = {};
  const output: Features = {};
  for (const line of encoderLines) {
    const match = line.match(/^\s(D| )(E| )\s+(\S+)\s+(.*)$/);
    if (!match) continue;
    const [, dec, enc, name, description] = match;
    if (dec === "D") input[name] = description;
    if (enc === "E") output[name] = description;
  }
  return { input, output };
}
