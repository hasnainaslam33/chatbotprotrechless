# Conditional Tool Flow Fix

The frontend now decides between two paths when a module button is clicked.

## Path 1: Upload exists

If the active module panel contains any selected file upload, the app calls `submitToolAi(button)`.

That path:

1. Uploads the selected files to `/api/uploads`.
2. Extracts still frames from video files in the browser when supported.
3. Sends uploaded file IDs, form details, user type, and module key to `/api/chat`.
4. The backend sends image files and video frames to OpenAI for visual review.
5. The response is rendered as an AI guided recommendation.

## Path 2: No upload exists

If the active module panel has no selected file upload, the app does not force an AI call. It runs the original page action saved from the button’s original `onclick` attribute.

This keeps normal selected-option behavior intact for:

- Symptom Checker
- Emergency Risk Check
- Estimate Review
- Cost Estimator
- Module-specific guided recommendation pages

## Main files changed

- `public/js/app.js`

Key functions added:

- `panelHasSelectedFiles(panel)`
- `runStoredButtonAction(button)`
- updated `initAiToolButtons()`

## Expected behavior

- Upload image or video: AI reviews the image/video frames.
- No upload: the page uses the choices/options the user selected.
- Lead form uploads still work through the normal lead submission path.
