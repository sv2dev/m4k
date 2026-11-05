# Changelog

All notable changes to `@m4k/client` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `processImage` accepts `classify`/`discard`, requires the `inline-classification/1` profile, validates every classification part and fails when one is missing.

### Fixed

- Reject redirected classification uploads and bound streamed JSON control parts to 64 KiB before parsing.

## [0.2.12]

### Added

- Added capability-checked image classification with Unicode-safe candidate options.

### Fixed

- Bounded JSON responses and validated classifier identity, input digest, candidates and normalized scores.

## [0.2.11]

### Changed

- Updated `@sv2dev/multipart-stream` to `0.2.3`.
- Switched to `bun-types` and explicitly loaded Bun types for builds.

## [0.2.10]

### Changed

- Updated Bun tooling and TypeScript dependencies.
- Updated `@sv2dev/multipart-stream` to `0.2.3`.
