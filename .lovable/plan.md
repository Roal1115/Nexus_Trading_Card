# Lovable Pre-Deploy Verification (read-only report — nothing was changed)

| Check | Status | Details |
| --- | --- | --- |
| Deployment branch | UNKNOWN | The sandbox is on an internal edit branch; the GitHub branch Lovable syncs with is not visible to me. Check it in the GitHub connection settings in the editor. |
| Supabase migration behavior | UNKNOWN (likely safe) | I only run database migrations through an explicit migration step that asks for your approval. I cannot confirm from here that syncing 32 files in `supabase/migrations/` never triggers anything, so treat this as unverified. |
| `NEXUS_URL` | ABSENT | Not in runtime secrets or `.env`. |
| `VITE_NEXUS_URL` | ABSENT | Not in runtime secrets or `.env`. |
| `VITE_NEXUS_PUBLISHABLE_KEY` | ABSENT | Not in runtime secrets or `.env`. |
| `NEXUS_SERVICE_ROLE_KEY` | PRESENT | Runtime secret (value not shown). |
| `PUBLISH_CRON_ENABLED` | ABSENT | Cron route returns 404 without it. |
| `PUBLISH_CRON_SECRET` | ABSENT | |
| `ALLOW_TIME_OVERRIDE` | ABSENT | |
| `VITE_SCHEDULED_PUBLISHING` | ABSENT | Read in `admin.tournaments.$id.tsx`; stays off. |
| Test/staging override | PASS | No Nexus overrides exist, so the client falls back to the hardcoded production `tbtyxtigbsljyrwyelqr`. The string `nexus-admin-test` appears only in `scripts/replay-migrations-test.sh`, not in app code. |
| Publishing behavior | PASS (partial) | Frontend changes go live only when you click Publish/Update. Publishing does not change secrets, and I do not edit code during publish or sync. Backend changes made through my tools apply right away. |

## Critical findings
1. `.env` `SUPABASE_*` / `VITE_SUPABASE_*` point to the Lovable Cloud project (`tbanx...`), not Nexus. The app reads data and auth through the separate Nexus client, so this should be harmless. But any code that uses the generated Cloud client would talk to Cloud, not Nexus.
2. An extra secret, `GEEKARENA_SERVICE_ROLE_KEY`, is PRESENT. The code only falls back to it if `NEXUS_SERVICE_ROLE_KEY` is missing. Make sure it also holds the production key, or remove it later.
3. The deployment branch and migration-on-sync behavior could not be verified from inside the project.

## Production safety statement
UNKNOWN. The "not pointing at test Nexus" part is CONFIRMED because no override variables exist. The "no automatic migrations" part and the `experiemental` branch could not be verified from here.

## Recommended next step
NEEDS HUMAN REVIEW: check the connected GitHub branch in the editor's GitHub settings, and ask Lovable support whether synced `supabase/migrations/` files run on this Cloud project.
