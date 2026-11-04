# Changelog

All notable changes to `m4k` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.7]

### Fixed

- Declared `tasque` and `@ffmpeg-installer/ffmpeg` as runtime dependencies so production-only consumers can import and use the published package without workspace development dependencies.

## [0.3.6]

### Added

- Added pinned CPU/q8 CLIP classification with user-defined candidates and input SHA-256 results.
- Added bounded TIFF IFD1 JPEG extraction without RAW development or original fallback.

### Fixed

- Released cancelled model-load waiters while reusing the shared load and retaining the slot during native inference.

## [0.3.5]

### Changed

- Updated the Sharp peer dependency to `^0.35.5`.

## [0.3.4]

### Changed

- Updated the Sharp peer dependency to `0.35.3`.
- Updated the TypeScript development dependency.
