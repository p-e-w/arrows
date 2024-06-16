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
export const PARAMS = {
    temperature: 1.0,
    top_k: 0,
    top_p: 1.0,
    min_p: 0.02,
    repeat_penalty: 1.0,
};
