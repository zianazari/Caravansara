import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint 9, not 10: the plugins that eslint-config-next 16.4 brings (import, jsx-a11y, react) do not
// accept eslint 10 yet (specs/005-frontend-guest, research R2).
const tokenStorageMessage =
  "Tokens and session data never go to web storage: a script injected by XSS could read them (FR-012). " +
  "The booking draft is the one exception and lives in src/lib/bookingDraft.ts.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Every user-visible string comes from messages/*.json; only a fixed error line may reach the console.
      "no-console": ["error", { allow: ["error"] }],
      "no-restricted-globals": ["error", { name: "localStorage", message: tokenStorageMessage }],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: tokenStorageMessage },
        { object: "window", property: "sessionStorage", message: tokenStorageMessage },
      ],
    },
  },
  {
    // The draft holds no secret: listing, dates, guests and the idempotency key (research R13). The session
    // test reads web storage only to prove that nothing was written there (SC-006).
    files: ["src/lib/bookingDraft.ts", "src/lib/bookingDraft.test.ts", "src/lib/session.test.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    // Tests replace next/image with a plain <img>.
    files: ["**/*.test.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", "src/api/schema.d.ts"]),
]);

export default eslintConfig;
