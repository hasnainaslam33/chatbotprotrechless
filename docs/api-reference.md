# Backend API Reference

Base URL locally:

```text
http://localhost:3000
```

## Health

`GET /health`

Returns server status.

## Chat

`POST /api/chat`

```json
{
  "module": "symptom-checker",
  "userType": "Homeowner",
  "messages": [{ "role": "user", "content": "Basement drain backs up when washer runs." }],
  "formContext": { "page": "/tools/symptom-checker.html" },
  "uploadedFileIds": [],
  "sessionId": "optional-session-id"
}
```

Returns:

```json
{
  "sessionId": "abc123",
  "answer": "...",
  "mode": "openai",
  "model": "gpt-5.2",
  "links": [],
  "disclaimer": "..."
}
```

If `OPENAI_API_KEY` is missing, `mode` becomes `fallback` and the server returns a safe local answer.

## Uploads

`POST /api/uploads`

Multipart form-data:

- `files`: one or more files
- `module`: tool module key
- `userType`: selected user type
- `sourcePage`: page path

Returns file IDs used by leads and chat.

## Leads

`POST /api/leads`

```json
{
  "name": "Jane Smith",
  "phone": "484-000-0000",
  "email": "jane@example.com",
  "propertyAddress": "West Chester, PA",
  "preferredAppointmentTime": "Tomorrow morning",
  "userType": "Homeowner",
  "module": "symptom-checker",
  "problemType": "Basement backup",
  "urgency": "High",
  "message": "Basement drain backs up when washer runs.",
  "resultSummary": "Possible main restriction...",
  "consent": true,
  "uploadedFileIds": ["file-id"],
  "sourcePage": "/tools/symptom-checker.html"
}
```

Returns a lead ID.

## Events

`POST /api/events`

Used for internal event logging such as page views, tool completions, chat opens, and lead submissions.

## Admin

All admin routes require:

```text
x-admin-key: ADMIN_API_KEY
```

Routes:

- `GET /api/admin/stats`
- `GET /api/admin/leads?limit=200`
- `GET /api/admin/chats?limit=200`
- `GET /api/admin/uploads?limit=200`
- `GET /api/admin/uploads/:id/download`

The admin dashboard uses these routes at `/admin/`.
