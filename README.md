# Backplate Generator

Backplate Generator is a Next.js 14 MOD BOX tool for Audi. It runs a 3-agent creative pipeline in parallel, then calls Gemini image editing to replace only the background behind an AVP car render while preserving the car's exact angle, perspective, and frame position.

The UI now supports market-aware art direction controls:
- `Market profile`: `UK`, `EU`, or `AG (Audi Global)`
- `Drive side`: `RHD` or `LHD`
- `Art direction preset`: `Veith Signature`, `Cinematic Moody`, `Golden Hour Natural`, `Storm Contrast`, `Minimal Product`
- Optional reference image uploads (up to 4) for style/mood/composition guidance
- Reusable Art Direction Bank loaded from `public/art-direction-bank` (select images per run)

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Gemini (`gemini-2.5-flash`) for the 3 parallel JSON planning agents
- Gemini image API (`gemini-3.1-flash-image-preview`) for semantic inpainting

## Environment Variables

Create `.env.local`:

```bash
cp .env.example .env.local
```

Set:

```bash
GEMINI_API_KEY=your_key_here
```

All AI calls are server-side via API routes (`app/api/*`), so keys are never exposed client-side.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Routes

- `POST /api/agents`
  - Input: `{ brief: string, imageBase64: string, marketProfile?: "UK" | "EU" | "AG", driveSide?: "RHD" | "LHD", artDirectionPreset?: "VEITH_SIGNATURE" | "CINEMATIC_MOODY" | "GOLDEN_HOUR_NATURAL" | "STORM_CONTRAST" | "MINIMAL_PRODUCT", referenceImages?: [{ data: string, mimeType: "image/jpeg" | "image/png" | "image/webp" }] }`
  - Runs Art Director, Location Scout, and Photographer in parallel with `Promise.allSettled`
  - Returns structured outputs + assembled edit instruction
  - Falls back gracefully if any single agent fails

- `POST /api/generate`
  - Input: `{ imageBase64: string, instruction: string, referenceImages?: [{ data: string, mimeType: "image/jpeg" | "image/png" | "image/webp" }] }`
  - Calls Gemini image edit endpoint
  - Returns `{ imageBase64, mimeType }` or `{ error }`

- `GET /api/art-direction-bank`
  - Lists available bank images from `public/art-direction-bank`
  - Use this for a persistent Audi style library your team can curate

## Art Direction Bank Setup

Put curated Audi reference images in:

`public/art-direction-bank/`

Supported formats:
- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

These images appear in the UI as selectable style references and are sent to both planning agents and Gemini generation.

## Deploy (Vercel)

1. Push to your repo.
2. Import project into Vercel.
3. Add `GEMINI_API_KEY` in project environment variables.
4. Deploy.

No additional server infrastructure is required.
