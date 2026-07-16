import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", "public/**", "coverage/**"],
    rules: {
      // These React 19 compiler advisories are useful during the migration,
      // but the existing child interaction loop intentionally synchronises
      // timers, browser state and learning events from effects/handlers.
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
