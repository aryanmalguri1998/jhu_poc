const MAX_MESSAGES = 60;

const conversations = new Map();

const normalizeMessage = (message) => {
  if (!message) return null;
  const role = typeof message.role === "string" ? message.role : "user";
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content ?? "");
  if (!content) return null;
  return { role, content };
};

const pruneMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length <= MAX_MESSAGES) {
    return messages;
  }

  const systemMessage =
    messages.find((message) => message.role === "system") || null;
  const recentMessages = systemMessage
    ? [
        systemMessage,
        ...messages
          .filter((msg) => msg !== systemMessage)
          .slice(-MAX_MESSAGES + 1),
      ]
    : messages.slice(-MAX_MESSAGES);
  return recentMessages;
};

export const ensureConversation = (conversationId, initializer) => {
  if (!conversationId) {
    throw new Error("conversationId is required to initialize conversation");
  }
  if (!conversations.has(conversationId)) {
    const initialMessages =
      typeof initializer === "function" ? initializer() : initializer;
    const normalized = Array.isArray(initialMessages)
      ? initialMessages.map(normalizeMessage).filter(Boolean)
      : [];

    conversations.set(conversationId, {
      messages: normalized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return conversations.get(conversationId);
};

export const hasConversation = (conversationId) =>
  conversations.has(conversationId);

export const getConversationSnapshot = (conversationId) => {
  const entry = conversations.get(conversationId);
  if (!entry) return [];
  return entry.messages.map((message) => ({ ...message }));
};

export const appendToConversation = (conversationId, messages = []) => {
  if (!conversationId) return;
  const entry = ensureConversation(conversationId, []);
  const normalizedMessages = (Array.isArray(messages) ? messages : [messages])
    .map(normalizeMessage)
    .filter(Boolean);
  entry.messages = pruneMessages([...entry.messages, ...normalizedMessages]);
  entry.updatedAt = new Date().toISOString();
};

export const resetConversation = (conversationId) => {
  conversations.delete(conversationId);
};

export const getConversationMetadata = (conversationId) => {
  const entry = conversations.get(conversationId);
  if (!entry) return null;
  return {
    length: entry.messages.length,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
};
