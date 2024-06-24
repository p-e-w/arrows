// Specify system prompt
// Only required for 'chat' type model
export const SYSTEM_PROMPT = "You are a professional writer. Completion the given story/writting based on user prompt. Answer only with the story/writting and nothing else. DO NOT REPEAT THE USER PROMPT IN THE STORY/WRITTING. DO NOT INLCUDE CONTENT SUCH as \"sure, here is the story\" or any similar response. At every beginning of paragraph, include a newline character";

// This value is the default for a local llama.cpp server.
// Change as needed if you use another provider.
export const BASE_URL = "http://localhost:8080/v1/";

// Can be left blank for most local API providers.
export const API_KEY = "";

// Generation will be stopped automatically at the end of a paragraph,
// so it is usually not necessary to change this value.
export const MAX_TOKENS = 500;

// Specify the model name used by the API. 
// Update this value if a different model is required.
export const MODEL = "llama3-70b-8192";

// Specify the model type: 'chat' or 'completion'
// - 'chat': Most models, including GPT-4 Turbo, use this type
// - 'completion': Non-chat models, like GPT-3.5-Turbo-Instruct
export const MODEL_TYPE = "completion";

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


//Example - local model (model type: 'completion')

// export const BASE_URL = "http://localhost:8080/v1/";
// export const MODEL_TYPE = "chat";
// export const MODEL = "llama3-70b-8192";
// export const API_KEY = "";
// export const MAX_TOKENS = 500;
// export const PARAMS = {
//     temperature: 1.0,
//     top_k: 0,
//     top_p: 1.0,
//     min_p: 0.02,
//     repeat_penalty: 1.0,
// };


//Example - OpenAI, gpt-3.5-turbo-instruct (model type: 'completion')

// export const BASE_URL = "https://api.openai.com/v1";
// export const MODEL_TYPE = "completion";
// export const MODEL = "gpt-3.5-turbo-instruct";
// export const API_KEY = "<your OpenAI API Key>";
// export const MAX_TOKENS = 500;
// export const PARAMS = {
    // temperature: 1.0,
    // top_k: 0,
    // top_p: 1.0,
    // min_p: 0.02,
    // repeat_penalty: 1.0,
// };

//Example - Groq API, llama-70b (model type: 'chat')

// export const BASE_URL = "https://api.groq.com/openai/v1/";
// export const API_KEY = "<your groq api key here>";
// export const MAX_TOKENS = 500;
// export const MODEL = "llama3-70b-8192";
// export const MODEL_TYPE = "chat";
// export const PARAMS = {
    // temperature: 1.0,
    // top_k: 0,
    // top_p: 1.0,
    // min_p: 0.02,
    // repeat_penalty: 1.0,
// };



