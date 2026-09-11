/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { dev, isServer }) {
    // Keep Next's framework/lib groups, thresholds and server layers intact.
    // The small API client was repeated in five route chunks. Sharing only
    // this browser module avoids raising the existing aggregate asset budget.
    if (!dev && !isServer && config.optimization.splitChunks) {
      config.optimization.splitChunks.cacheGroups.pupilSharedAPI = {
        test: module => module.layer === "app-pages-browser" && /[\\/]src[\\/]lib[\\/]api\.ts$/.test(module.nameForCondition?.() || ""),
        name: "nexuslearn-api-client",
        minChunks: 2,
        enforce: true,
        priority: 20,
        reuseExistingChunk: true,
      };
      // These widgets were each emitted twice across pupil/adult routes. Keep
      // separate shared chunks: opening a mock must not also load reporting UI.
      for (const [key, component, name, extension = "tsx"] of [
        ["sharedMockBuilder", "MockAssessmentBuilder", "nexuslearn-mock-builder"],
        ["sharedProgressSnapshot", "ProgressSnapshot", "nexuslearn-progress-snapshot"],
        ["sharedDino", "Dino", "nexuslearn-dino"],
        ["sharedAccountAuthentication", "role-workspaces/useAccountAuthentication", "nexuslearn-account-authentication", "ts"],
        ["sharedWorkspaceNavigation", "role-workspaces/WorkspaceNavigation", "nexuslearn-workspace-navigation"],
        // Measured in four and three emitted chunks respectively. Preserve
        // separate payloads so evidence UI does not pull in mock guidance.
        ["sharedMockObjectiveGuidance", "MockObjectiveGuidance", "nexuslearn-mock-objective-guidance"],
        ["sharedAttemptEvidence", "AttemptEvidencePanel", "nexuslearn-attempt-evidence"],
        // These exact modules each appeared twice (6,628 + 2,726 bytes).
        // Keep adult history separate from the pupil journey shell.
        ["sharedMockHistory", "MockAssessmentHistory", "nexuslearn-mock-history"],
        ["sharedChildJourney", "ChildJourneyChrome", "nexuslearn-child-journey"],
      ]) {
        config.optimization.splitChunks.cacheGroups[key] = {
          test: module => module.layer === "app-pages-browser" && (module.nameForCondition?.() || "").replaceAll("\\", "/").endsWith(`/src/components/${component}.${extension}`),
          name,
          minChunks: 2,
          enforce: true,
          priority: 20,
          reuseExistingChunk: true,
        };
      }
    }
    return config;
  },
};

export default nextConfig;
