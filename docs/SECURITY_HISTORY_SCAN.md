# Secret scan of the full git history

Scanned on 17 October 2026 with `git log --all -G` and a working-tree `git grep`. History was not rewritten.

Searches:

- AWS-style access key ids (`AKIA…`)
- Stripe live secrets (`sk_live_`)
- GitHub tokens (`ghp_…`)
- Slack tokens (`xox…`)
- Private keys (`BEGIN PRIVATE KEY` and the RSA / OpenSSH / EC forms)
- ElevenLabs key material
- Postgres URLs that include a password

## Result

No live cloud, payment, GitHub, Slack or private-key material was found in history or in the current tree.

Postgres URLs appear only as:

- the disposable local CI database in `.github/workflows/platform-quality.yml`
- a placeholder in `docs/DATABASE_AND_MIGRATIONS.md`

Narration production reads `ELEVENLABS_API_KEY` from the environment. The committed tests use the obvious stand-in values `offline-test-only` and `offline-contract-only`. No provider key was found.

If a real key was ever pasted into a branch that is not in this clone, it will not show up here. Rotate any key that might have been shared outside git.
