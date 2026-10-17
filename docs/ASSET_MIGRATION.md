# Moving large audio and review files out of git

## What is large

Narration MP3s and generated review JSON are the bulk of the repository. The
web app serves the MP3s from `apps/web/public/audio`, and the audio quality
check listens to the files that are in git. `node ops/list-large-assets.mjs`
prints every tracked file over 1 MB.

## Why they are still in git

Removing them from the latest commit does not shrink history, and it would
break playback and the audio check. Git LFS can store the files outside the
normal pack, but converting files that are already committed means rewriting
history. This project must not rewrite history.

So this change leaves the files where they are. The site keeps working.

## Safe way to copy them for object storage

This copies MP3s and deletes nothing:

```text
node ops/list-large-assets.mjs --copy-audio /tmp/nexuslearn-audio-upload
```

Upload that folder to a private bucket the family controls. Do not make the
bucket public until a reviewer has decided which clips are allowed to be
public. Unapproved narration must stay blocked even if the file exists.

## Later change, as its own piece of work

1. Keep the git files until the bucket copy has been checked file by file.
2. Add a base URL only after the app and the audio check can read from that
   bucket, with tests that an unapproved clip is still refused.
3. Stop tracking new MP3s in a follow-up commit. Old history will still contain
   the files. Shrinking history is a separate decision and needs a history
   rewrite, which is out of scope here.
4. Generated review JSON under `packages/content/generated` can move the same
   way once no quality check reads it from git.

Do not run `git lfs migrate` on this repository unless everyone who has a
clone is ready for rewritten history.
