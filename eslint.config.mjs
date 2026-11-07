import jsxA11y from "eslint-plugin-jsx-a11y";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // Accessibility: the full jsx-a11y "recommended" set (eslint-config-next only enables a few of its rules).
    // The plugin itself is registered by eslint-config-next.
    files: ["src/**/*.tsx"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Labels wrap their input with text two spans deep (title + hint); look deep enough to see it.
      "jsx-a11y/label-has-associated-control": ["error", { assert: "either", depth: 3 }],
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
];

export default config;
