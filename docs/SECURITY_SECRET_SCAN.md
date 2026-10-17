# Secret scan, 17 October 2026

History was not rewritten. The scan looked at the current files and at every
commit reachable from this repository.

## What was searched

- Cloud access-key prefixes, private-key blocks, GitHub personal tokens,
  live Stripe secret keys, Slack tokens, and Google API keys.
- Tracked filenames that usually hold secrets: `.env`, `.pem`, `id_rsa`, and
  service-account JSON.

Commands used from the repository root:

```text
git grep -I -E 'AKIA[0-9A-Z]{16}|-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----|github_pat_|ghp_[A-Za-z0-9]{20,}|sk_live_|xox[baprs]-|AIza[0-9A-Za-z_-]{20,}'
git ls-files | grep -Ei '(^|/)\.env($|\.)|id_rsa|\.pem$|credentials\.json|service-account'
git log --all -G 'AKIA[0-9A-Z]{16}'
git log --all -G 'BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY'
git log --all -G 'github_pat_|ghp_[A-Za-z0-9]{20,}|sk_live_'
git log --all -G 'xox[baprs]-'
```

## Result

No matches in the current tree and no matches in history for those patterns.
No secret-shaped filenames are tracked.

The local CI database password `nexuslearn` and the offline narration test
value `ELEVENLABS_API_KEY=offline-contract-only` are fixtures in workflow and
test files. They are not production credentials. They were left in place.

## Still worth a human look

- Render and Vercel environment screens are the real home of production
  secrets. This scan cannot see those dashboards.
- If a secret was ever pasted into a host dashboard, rotate it there. Nothing
  in git history showed one.
