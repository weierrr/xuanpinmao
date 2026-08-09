import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".next/**",
      ".playwright-cli/**",
      "agent-package/**",
      "node_modules/**",
      "coverage/**",
      "exports/**",
      "output/**",
      "**/* 2.*",
      "**/*.dataless-backup",
      "prisma/migrations/**",
      "eslint.config.mjs",
      "next-env.d.ts",
      "T22_Claude固定证据包_T21R最终版/**"
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-misused-spread": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          "checksVoidReturn": {
            "attributes": false
          }
        }
      ]
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "vitest.setup.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-base-to-string": "off",
    },
  },
];
