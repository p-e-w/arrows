// This value is the default for a local llama.cpp server.
// Change as needed if you use another provider.
export const BASE_URL = "http://localhost:11434/v1/";

// Can be left blank for most local API providers.
export const API_KEY = "";

// The model name sent to the OpenAI-compatible completion endpoint.
// Some local providers ignore this value when a model is already loaded.
export const MODEL = "llama-3.2-3b-thinking-partner:latest";

// Generation will be stopped automatically at the end of a paragraph,
// so it is usually not necessary to change this value.
export const MAX_TOKENS = 500;

// Add generation/sampling parameters here. Their effect depends on the API provider.
// No attempt is made to normalize these parameters across different providers.
// They are passed to the API endpoint unmodified.
export const PARAMS = {
    temperature: 1.0,
    top_k: 0,
    top_p: 1.0,
    min_p: 0.02,
    repeat_penalty: 1.0,
};

// Use the chat completions endpoint (/v1/chat/completions) instead of the text
// completions endpoint (/v1/completions). Enable this for chat-tuned models,
// which often produce no output at all on raw text completion prompts.
export const CHAT_COMPLETIONS = false;

// The system prompt sent with the document in chat completions mode.
export const SYSTEM_PROMPT = "You are a ghostwriter. The user sends you the beginning of a text. " +
    "Continue it in the same style, writing at most one paragraph. " +
    "Do not comment, do not ask questions, and do not repeat the text; just continue it.";
