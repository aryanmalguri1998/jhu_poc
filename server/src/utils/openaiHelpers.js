export const extractJsonFromResponse = (response) => {
  if (!response) return null;

  const content = response.output?.[0]?.content;
  if (!content || !Array.isArray(content)) return null;

  for (const chunk of content) {
    if (chunk.type === "output_text" && typeof chunk.text === "string") {
      return chunk.text;
    }
    if (chunk.type === "text" && typeof chunk.text === "string") {
      return chunk.text;
    }
    if (chunk.type === "json_schema" && chunk.json_schema?.output) {
      return JSON.stringify(chunk.json_schema.output);
    }
  }

  return null;
};

export const extractFirstTextContent = (response) => {
  if (!response?.output) return null;

  for (const block of response.output) {
    const content = Array.isArray(block?.content) ? block.content : [];
    for (const chunk of content) {
      if (chunk.type === "output_text" && typeof chunk.text === "string") {
        return chunk.text;
      }
      if (chunk.type === "text" && typeof chunk.text === "string") {
        return chunk.text;
      }
    }
  }

  return null;
};

export const safeJsonParse = (value, fallback = null) => {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};
