// This response is rendered into the deployment at build time. It must not
// identify an old bundle using environment variables from a later server start.
export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
  const candidate = process.env.VERCEL_GIT_COMMIT_SHA;
  const revision = candidate?.length === 40 && /^[a-f0-9]{40}$/.test(candidate) ? candidate : "unknown";
  return Response.json({
    service: "nexuslearn-web",
    git_revision: revision,
    git_revision_source: revision === "unknown" ? "unknown" : "vercel-build",
  });
}
