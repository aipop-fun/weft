export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", [
      "feat", "fix", "docs", "style", "refactor", "perf",
      "test", "build", "ci", "chore", "revert"
    ]],
    "scope-enum": [1, "always", [
      "server", "web", "db", "github", "llm", "intent", "rules",
      "review", "middleware", "auth", "billing", "audit", "feedback",
      "i18n", "deploy", "docs", "deps", "release"
    ]],
    "subject-case": [2, "always", ["lower-case", "sentence-case"]],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [1, "always", 100],
  },
};
