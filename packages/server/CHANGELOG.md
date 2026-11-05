# Changelog

All notable changes to `@m4k/server` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.14]

### Added

- `POST /images/process` validates and streams inline classifications and advertises `inline-classification/1`.

## [0.2.13]

### Added

- Advertised classifier and embedded-preview capabilities and added the bounded `/images/classify` endpoint.
- Added explicit embedded-preview conversion with strict boolean query parsing.

### Fixed

- Kept native ONNX runtime assets resolvable in production Docker builds.

## [0.2.12]

### Changed

- Updated `@sv2dev/multipart-stream` to `0.2.3`.
- Switched to `bun-types` and explicitly loaded Bun types for builds.

### Fixed

- Kept Sharp external in Docker builds and installed production dependencies in the runtime image.
- Made the AVIF image test independent of the encoder's default quality.

## [0.2.11]

### Changed

- Updated `@sinclair/typebox` to `0.34.52`.
- Updated Bun tooling and TypeScript dependencies.
- Updated `@sv2dev/multipart-stream` to `0.2.3`.
