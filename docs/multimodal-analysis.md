# Image and Video Analysis Setup

This project now supports real multimodal review through the backend.

## What works

### Images
Uploaded JPG, PNG, WebP, and GIF files are read by the Node backend, converted into Base64 data URLs, and sent to OpenAI as `input_image` content through the Responses API.

### Videos
The browser extracts up to 6 still frames from an uploaded video and uploads those frames as JPG images. The AI reviews the extracted frames, not the entire raw video second by second.

This is intentional for a sewer camera intake tool. It allows the AI to comment on visible conditions in selected frames while still keeping the disclaimer that final diagnosis requires professional inspection.

### PDFs and documents
PDFs and supported document files can be sent as `input_file` content when they are under the configured file limits. This is useful for estimates, reports, and inspection documents.

## Important limits

The AI should never claim a final sewer diagnosis from photos, frames, or user notes. It can say what appears visible, what may be missing, what questions to ask, and when Pro Trenchless should verify the issue.

## Required `.env` values

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.5
MAX_VISION_IMAGES=8
MAX_VISION_IMAGE_MB=18
VISION_DETAIL=high
MAX_INPUT_FILES=4
MAX_INPUT_FILE_BYTES=47185920
FILE_DETAIL=high
```

## Testing

1. Restart the server after updating `.env`.
2. Open a tool page, for example `/tools/sewer-camera-review.html`.
3. Upload a photo or short video.
4. Click `Generate guided recommendation`.
5. The status should show `Mode: openai-multimodal` when images or frames were attached.

If it still gives the same generic output, check:

- The server was restarted after setting the API key.
- The uploaded file is a supported type.
- The model supports image input.
- Browser console does not show video frame extraction errors.
- Server terminal does not show OpenAI provider errors.
