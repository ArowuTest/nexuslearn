# Moving large audio and review files out of git

The repository is about 321MB. Most of that is the 874 narration MP3s under `apps/web/private/audio/narration/alice/` and the year-by-year AI review ledgers under `packages/content` (some source files are 8–27MB). Those MP3s are not in `public/`, so the web server cannot hand them out as static files. Generated coverage files such as `ai-review-batch.json` are tool outputs, but the content checks still read them.

## Why this change does not delete them

Git LFS migration and `git filter-repo` rewrite history. That was ruled out. Deleting the files from the latest commit without putting them somewhere the app and the audio audit can read would make review playback and `npm run quality:audio-audit` fail.

So the files stay in git for now. The app keeps working. Anonymous visitors still cannot download an unapproved recording: the web gate returns 404 until a person approves that clip.

## Safe move, when you are ready

1. Create a private bucket (Render, S3, or similar). Do not make it public.
2. Copy `apps/web/private/audio/narration/` into that bucket, keeping the same paths, and set `NARRATION_AUDIO_ROOT` to the private mount. Do not put the files back in `public/`.
3. Point the review player and the audio audit at the bucket with a private credential. Keep a local copy in CI until the audit is switched over.
4. Only after a fresh clone can still build, play a review clip, and pass the audio audit, remove the MP3s from the next commit. Leave history as it is. Old clones will still contain the blobs, which is expected.
5. The AI review JSON files are source inputs for the content checks. Move those only after the checks can fetch them from the same private store. Do not delete them first.

The website asks the API which narration ids a person has approved, then allows only those files. `NARRATION_ACCESS_SECRET` can also sign a link for at most 12 hours. A future bucket should check that approval list or that signature. A public bucket would skip the child-safety gate, so do not use one.
