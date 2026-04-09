# Full App Upload (One-Step)

From project root, run:

```bash
bash github-essentials/build-full-app-folder.sh
```

That creates:

`github-full-app/`

This folder is upload-ready and includes your full app while excluding:
- `.env` and `.env.*`
- `.git/`
- `.next/`, `.next-dev/`
- `node_modules/`
- local system folders (`terminals`, `agent-transcripts`)

Then upload the contents of `github-full-app/` to your GitHub repo.
