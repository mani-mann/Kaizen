## Age Older

Simple local demo to upload a face photo and request +10y or +15y aging.

### Setup

1. Create a `.env` from `.env.example` and fill values as needed.
2. Install deps and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Provider adapter

Edit `server.js` function `callImageApi` to call your image API. It receives two inputs: a local file path to the uploaded image and a finalized prompt string. Return a public URL to the generated image.

### Optional Claude prompt

If you set `ANTHROPIC_API_KEY` in `.env`, the server will ask Claude to craft a safe, specific prompt based on the selected years. Otherwise, it uses a good default prompt.

System prompt:

```
You are an expert prompt engineer for photo-realistic image-to-image face aging. Write a SINGLE concise prompt (≤120 words) that preserves identity, ethnicity, pose, background; adds natural, realistic aging of approximately {years} years; avoids artifacts and unwanted changes; emphasizes photorealism.
```

User prompt:

```
Generate the prompt text to age a clear, front-facing portrait by {years} years. Return ONLY the prompt.
```


