# ENV Troubleshooting

This build forces the backend to read `.env` from the project root and allows `.env` to override any old Windows system-level `OPENAI_API_KEY`.

Check what the backend is reading:

```cmd
npm run env:check
```

Or after the server starts, open:

```text
http://localhost:3000/api/debug/env
```

The key is masked for safety. Compare the first and last characters with your real key.

If it still shows the wrong key:

```cmd
dir /s /a .env
```

Open the `.env` inside the same folder as `package.json`, not `.env.example`.

Correct format:

```env
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

No quotes, no spaces around `=`.
