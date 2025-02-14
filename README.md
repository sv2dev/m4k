# media-optimizer

A Bun media optimizer based on [ffmpeg](https://ffmpeg.org/) and [sharp](https://sharp.pixelplumbing.com/)/[libvips](https://github.com/libvips/libvips).

The docker image is available at [ghcr.io/sv2dev/media-optimizer](https://github.com/sv2dev/media-optimizer/pkgs/container/media-optimizer). It uses Bun as runtime.

## Usage

```bash
docker run -p 3000:3000 -v $(pwd)/output:/output ghcr.io/sv2dev/media-optimizer:0.0.1
```

## API

### POST /images/process

#### Request

```
URL: /images/process?<Options|options=OptionsJSON[]>
Method: POST
Headers:
- [X-Options: <OptionsJSON[]>]
Body: Binary file
```

#### Response

```
Status: 200 OK
Headers:
- Content-Type: multipart/mixed; boundary=<boundary>
Body: multipart/mixed body with status updates and the processed files (if no output option was provided)
```

### POST /videos/process

#### Request

```
URL: /videos/process?<Options|options=OptionsJSON[]>
Method: POST
Headers:
- [X-Options: <OptionsJSON[]>]
Body: Binary file
```

#### Response

```
Status: 200 OK
Headers:
- Content-Type: multipart/mixed; boundary=<boundary>
Body: multipart/mixed body with status updates and the processed files (if no output option was provided)
```

### Options

The options can be provided as query parameters or as `X-Options` header.
Each provided option object will result in a processed output file, which allows you to process the same input file multiple times and create different output files (currently only enabled for images).

#### Examples

Using curl with headers, redirecting output to a file (within the container):

```
curl -X POST http://localhost:3000/videos/process \
  -H 'X-Options: {"format": "mp4", "videoCodec": "libsvtav1", "output": "/output/output.mp4"}' \
  --data-binary @/path/to/input.mov
```
