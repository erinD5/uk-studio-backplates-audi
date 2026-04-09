## Studio-Only Upload Notes

This folder marks the Studio-only packaging target for GitHub uploads.

The app is now configured to load Studio directly at `/`:

- `app/page.tsx` now renders the Studio page directly.
- `app/studio/page.tsx` has the top Environmental button removed.

Core Studio implementation lives in:

- `app/studio/page.tsx`
- `app/api/studio/prompt/route.ts`
- `app/api/studio/generate/route.ts`
- `lib/studioPrompt.ts`
