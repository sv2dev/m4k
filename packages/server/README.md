# m4k - media toolkit server

A Bun media conversion server based on [ffmpeg](https://ffmpeg.org/) and [sharp](https://sharp.pixelplumbing.com/)/[libvips](https://github.com/libvips/libvips).

The docker image is available at [ghcr.io/sv2dev/media-optimizer](https://github.com/sv2dev/media-optimizer/pkgs/container/media-optimizer). It uses Bun as runtime.

## Usage

```bash
docker run -p 3000:3000 -v $(pwd)/output:/output ghcr.io/sv2dev/m4k:0.2.1
```

## API

### POST /audio/process

#### Request

```http
POST /audio/process?<Options|options=OptionsJSON[]>
X-Options: <OptionsJSON[]>

Binary file content
```

#### Response

```http
Status: 200 OK
Content-Type: multipart/mixed; boundary=<boundary>

multipart/mixed body with status updates and the processed files (if no output option was provided)
```

### POST /images/process

#### Request

```http
POST /images/process?<Options|options=OptionsJSON[]>
X-Options: <OptionsJSON[]>

Binary file content
```

#### Response

```http
Status: 200 OK
Content-Type: multipart/mixed; boundary=<boundary>

multipart/mixed body with status updates and the processed files (if no output option was provided)
```

### POST /videos/process

#### Request

```http
POST /videos/process?<Options|options=OptionsJSON[]>
X-Options: <OptionsJSON[]>

Binary file content
```

#### Response

```http
Status: 200 OK
Content-Type: multipart/mixed; boundary=<boundary>

multipart/mixed body with status updates and the processed files (if no output option was provided)
```

### Options

The options can be provided as query parameters or as `X-Options` header.
Each provided option object will result in a processed output file, which allows you to process the same input file multiple times and create different output files (currently only enabled for images).

#### Examples

Using curl with headers, redirecting output to a file (within the container):

```bash
curl -X POST http://localhost:3000/videos/process \
  -H 'X-Options: {"format": "mp4", "videoCodec": "libsvtav1", "output": "/output/output.mp4"}' \
  --data-binary @/path/to/input.mov
```
