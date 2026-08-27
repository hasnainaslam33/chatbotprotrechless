# AI All Modules + Cost Estimator Update

This update changes the tool flow so every module button requests an AI response, even when no image, video, estimate, or report is uploaded.

## Behavior

- If the user uploads an image, document, or video, the system uploads the file and sends supported images/video frames/documents to the AI.
- If the user does not upload a file, the system sends the selected module options and typed intake details to the AI.
- All modules now use `/api/chat` for the visible result instead of only showing local static results.
- Cost Estimator now calculates a rough planning range in the frontend, sends that range to the AI, and displays it in a dedicated estimated-cost card.

## Cost Estimator Display

The Cost Estimator result now shows:

- Urgency level card at the top
- Estimated cost card under urgency
- AI explanation cards below
- Helpful links
- Disclaimer

The cost range is still a planning range only. It is not a quote and requires camera inspection, locate, access review, permits, restoration review, and professional verification.
