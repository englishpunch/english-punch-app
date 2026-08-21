export const resultContent = <T extends Record<string, unknown>>(
  structuredContent: T
) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(structuredContent, null, 2),
    },
  ],
  structuredContent,
});
