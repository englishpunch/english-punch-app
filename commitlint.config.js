const issueReferencePattern = /(^|[\s([{:;,-])#\d+\b/;
const issueClosingKeywordPattern =
  /\b(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#\d+\b/i;

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "issue-reference-required": (parsed) => {
          const raw = parsed.raw ?? "";
          return [
            issueReferencePattern.test(raw),
            "commit message must include a GitHub issue reference like #67",
          ];
        },
        "issue-closing-keyword-forbidden": (parsed) => {
          const raw = parsed.raw ?? "";
          return [
            !issueClosingKeywordPattern.test(raw),
            "do not close issues from commit messages; use a neutral reference like #67",
          ];
        },
      },
    },
  ],
  rules: {
    "issue-reference-required": [2, "always"],
    "issue-closing-keyword-forbidden": [2, "always"],
  },
};
