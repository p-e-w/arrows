// This value is the default for a local llama.cpp server.
// Change as needed if you use another provider.
export const BASE_URL = "http://localhost:8080/v1/";

// Can be left blank for most local API providers.
export const API_KEY = "";

// Generation will be stopped automatically at the end of a paragraph,
// so it is usually not necessary to change this value.
export const MAX_TOKENS = 500;

// Add generation/sampling parameters here. Their effect depends on the API provider.
// No attempt is made to normalize these parameters across different providers.
// They are passed to the API endpoint unmodified.
// Model name parameter is ignored by most OpenAI-compatible local API providers but sometimes required for remote API providers, 
// For model name paramater, use full name e.g. "mistralai/Mixtral-8x22B-Instruct-v0.1" (Note, top_k value of 1 also sometimes required.)
export const PARAMS = {
    model: "gpt-3.5-turbo-instruct",
    temperature: 1.0,
    top_k: 0,
    top_p: 1.0,
    min_p: 0.02,
    repeat_penalty: 1.0,
};
