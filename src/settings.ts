// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import "./settings.css";

import OpenAI from "openai";

import { BASE_URL, API_KEY, MODEL, MAX_TOKENS, PARAMS, CHAT_COMPLETIONS, SYSTEM_PROMPT } from "./config.ts";

export interface Settings {
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens: number;
    params: Record<string, unknown>;
    chatCompletions: boolean;
    systemPrompt: string;
}

const STORAGE_KEY = "arrows-settings";

const defaultSettings: Settings = {
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    model: MODEL,
    maxTokens: MAX_TOKENS,
    params: { ...PARAMS },
    chatCompletions: CHAT_COMPLETIONS,
    systemPrompt: SYSTEM_PROMPT,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadSettings(): Settings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
            return { ...defaultSettings };
        }
        const saved: unknown = JSON.parse(raw);
        if (!isRecord(saved)) {
            return { ...defaultSettings };
        }
        return {
            baseUrl: typeof saved.baseUrl === "string" ? saved.baseUrl : defaultSettings.baseUrl,
            apiKey: typeof saved.apiKey === "string" ? saved.apiKey : defaultSettings.apiKey,
            model: typeof saved.model === "string" ? saved.model : defaultSettings.model,
            maxTokens: typeof saved.maxTokens === "number" && Number.isFinite(saved.maxTokens) ? saved.maxTokens : defaultSettings.maxTokens,
            params: isRecord(saved.params) ? saved.params : { ...defaultSettings.params },
            chatCompletions: typeof saved.chatCompletions === "boolean" ? saved.chatCompletions : defaultSettings.chatCompletions,
            systemPrompt: typeof saved.systemPrompt === "string" ? saved.systemPrompt : defaultSettings.systemPrompt,
        };
    } catch {
        return { ...defaultSettings };
    }
}

// Current settings. Changes only take effect at the next generation,
// because the API client is created anew for every generation.
export const settings: Settings = loadSettings();

export function createClient(): OpenAI {
    return new OpenAI({
        baseURL: settings.baseUrl,
        apiKey: settings.apiKey,
        dangerouslyAllowBrowser: true,
    });
}

const panel = document.createElement("div");
panel.className = "settings-panel";
panel.setAttribute("role", "dialog");
panel.setAttribute("aria-label", "Settings");

panel.innerHTML = `
    <div class="settings-header">
        <span>Settings</span>
        <button class="settings-close" title="Close (Escape)">&times;</button>
    </div>
    <label>
        <span class="settings-label-text">Base URL</span>
        <input type="text" name="base-url" spellcheck="false" autocomplete="off">
    </label>
    <label>
        <span class="settings-label-text">API key</span>
        <input type="password" name="api-key" autocomplete="off">
    </label>
    <label>
        <span class="settings-label-text">Model</span>
        <div class="model-row">
            <input type="text" name="model" spellcheck="false" autocomplete="off">
            <button class="settings-refresh" title="Fetch the list of models from the server">&#8635;</button>
            <div class="model-options" hidden></div>
        </div>
        <div class="model-status"></div>
    </label>
    <label class="settings-check">
        <input type="checkbox" name="chat-completions">
        <span>Chat completions (for chat-tuned models)</span>
    </label>
    <label>
        <span class="settings-label-text">System prompt (chat completions)</span>
        <textarea name="system-prompt" rows="4" spellcheck="false"></textarea>
    </label>
    <label>
        <span class="settings-label-text">Max tokens</span>
        <input type="number" name="max-tokens" min="1">
    </label>
    <label>
        <span class="settings-label-text">Parameters (JSON)</span>
        <textarea name="params" rows="5" spellcheck="false"></textarea>
    </label>
    <div class="settings-status"></div>
`;

const settingsButton = document.createElement("button");
settingsButton.className = "settings-button";
settingsButton.title = "Settings (Ctrl+Comma)";
settingsButton.textContent = "⚙";

document.body.append(settingsButton, panel);

const baseUrlInput = panel.querySelector<HTMLInputElement>("[name='base-url']")!;
const apiKeyInput = panel.querySelector<HTMLInputElement>("[name='api-key']")!;
const modelInput = panel.querySelector<HTMLInputElement>("[name='model']")!;
const modelOptionsElement = panel.querySelector<HTMLElement>(".model-options")!;
const refreshButton = panel.querySelector<HTMLButtonElement>(".settings-refresh")!;
const modelStatusElement = panel.querySelector<HTMLElement>(".model-status")!;
const maxTokensInput = panel.querySelector<HTMLInputElement>("[name='max-tokens']")!;
const chatCompletionsInput = panel.querySelector<HTMLInputElement>("[name='chat-completions']")!;
const systemPromptTextarea = panel.querySelector<HTMLTextAreaElement>("[name='system-prompt']")!;
const systemPromptLabel = systemPromptTextarea.closest("label")!;
const paramsTextarea = panel.querySelector<HTMLTextAreaElement>("[name='params']")!;
const closeButton = panel.querySelector<HTMLButtonElement>(".settings-close")!;
const statusElement = panel.querySelector<HTMLElement>(".settings-status")!;

let open = false;
let hideStatusTimeout: number | undefined;
let refreshModelsToken = 0;

// Models fetched from the server; empty if unavailable.
let models: string[] = [];
let filteredModels: string[] = [];
let modelOptionsOpen = false;
let highlightedIndex = -1;

function showStatus(message: string, isError = false): void {
    window.clearTimeout(hideStatusTimeout);
    statusElement.textContent = message;
    statusElement.classList.toggle("error", isError);
    statusElement.classList.toggle("visible", message !== "");
    if (message !== "" && !isError) {
        hideStatusTimeout = window.setTimeout(() => {
            statusElement.classList.remove("visible");
        }, 2000);
    }
}

function populateInputs(): void {
    baseUrlInput.value = settings.baseUrl;
    apiKeyInput.value = settings.apiKey;
    modelInput.value = settings.model;
    maxTokensInput.value = String(settings.maxTokens);
    paramsTextarea.value = JSON.stringify(settings.params, null, 4);
    paramsTextarea.classList.remove("invalid");
    chatCompletionsInput.checked = settings.chatCompletions;
    systemPromptTextarea.value = settings.systemPrompt;
    systemPromptLabel.hidden = !settings.chatCompletions;
    modelStatusElement.textContent = "";
    showStatus("");
}

function readInputs(): Settings | null {
    let params: unknown;
    try {
        params = JSON.parse(paramsTextarea.value);
    } catch {
        return null;
    }
    if (!isRecord(params)) {
        return null;
    }
    const maxTokens = Number(maxTokensInput.value);
    return {
        baseUrl: baseUrlInput.value.trim(),
        apiKey: apiKeyInput.value,
        model: modelInput.value.trim(),
        maxTokens: Number.isFinite(maxTokens) && maxTokens >= 1 ? maxTokens : defaultSettings.maxTokens,
        params,
        chatCompletions: chatCompletionsInput.checked,
        systemPrompt: systemPromptTextarea.value,
    };
}

function commit(): boolean {
    const newSettings = readInputs();
    if (newSettings === null) {
        paramsTextarea.classList.add("invalid");
        showStatus("Parameters must be a JSON object.", true);
        return false;
    }
    paramsTextarea.classList.remove("invalid");
    Object.assign(settings, newSettings);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        showStatus("Saved");
    } catch {
        showStatus("Saved for this session (could not persist).", true);
    }
    return true;
}

function updateHighlight(): void {
    for (let index = 0; index < filteredModels.length; index++) {
        const option = modelOptionsElement.children[index] as HTMLElement;
        option.classList.toggle("highlighted", index === highlightedIndex);
        if (index === highlightedIndex) {
            // Scroll manually, so that the enclosing panel is not scrolled.
            const optionTop = option.offsetTop;
            const optionBottom = optionTop + option.offsetHeight;
            if (optionTop < modelOptionsElement.scrollTop) {
                modelOptionsElement.scrollTop = optionTop;
            } else if (optionBottom > modelOptionsElement.scrollTop + modelOptionsElement.clientHeight) {
                modelOptionsElement.scrollTop = optionBottom - modelOptionsElement.clientHeight;
            }
        }
    }
}

function updateModelOptions(): void {
    const query = modelInput.value.trim().toLowerCase();
    filteredModels = models.filter(model => model.toLowerCase().includes(query));
    if (highlightedIndex >= filteredModels.length) {
        highlightedIndex = filteredModels.length - 1;
    }
    modelOptionsElement.replaceChildren(...filteredModels.map(model => {
        const option = document.createElement("div");
        option.className = "model-option";
        option.textContent = model;
        // Preventing the default action keeps the focus in the model field,
        // so the blur that would precede the click does not close the list.
        option.addEventListener("mousedown", event => {
            event.preventDefault();
        });
        option.addEventListener("click", () => {
            selectModel(model);
        });
        return option;
    }));
    if (filteredModels.length === 0) {
        const noMatch = document.createElement("div");
        noMatch.className = "model-option none";
        noMatch.textContent = "No matching models";
        modelOptionsElement.append(noMatch);
    }
    updateHighlight();
}

function showModelOptions(highlightFirst: boolean): void {
    if (models.length === 0) {
        return;
    }
    modelOptionsOpen = true;
    modelOptionsElement.hidden = false;
    highlightedIndex = highlightFirst ? 0 : -1;
    updateModelOptions();
}

function closeModelOptions(): void {
    modelOptionsOpen = false;
    modelOptionsElement.hidden = true;
    modelOptionsElement.replaceChildren();
    filteredModels = [];
}

function selectModel(model: string): void {
    modelInput.value = model;
    closeModelOptions();
    closeSettings();
}

async function refreshModels(): Promise<void> {
    const token = ++refreshModelsToken;
    modelStatusElement.textContent = "Fetching models…";
    try {
        const client = new OpenAI({
            baseURL: baseUrlInput.value.trim(),
            apiKey: apiKeyInput.value,
            dangerouslyAllowBrowser: true,
            timeout: 5000,
            maxRetries: 0,
        });
        const page = await client.models.list();
        const ids: string[] = [];
        for await (const model of page) {
            ids.push(model.id);
        }
        if (token !== refreshModelsToken) {
            // A newer request has been started in the meantime.
            return;
        }
        models = ids;
        modelStatusElement.textContent = ids.length === 1 ? "1 model available" : `${ids.length} models available`;
        // Show the list immediately if the model field has focus.
        if (ids.length > 0 && document.activeElement === modelInput) {
            showModelOptions(false);
        }
    } catch {
        if (token !== refreshModelsToken) {
            // A newer request has been started in the meantime.
            return;
        }
        models = [];
        closeModelOptions();
        modelStatusElement.textContent = "Could not fetch model list (you can still type a model name).";
    }
}

export function isSettingsOpen(): boolean {
    return open;
}

export function openSettings(): void {
    populateInputs();
    panel.classList.add("open");
    open = true;
    // Focus the model field, since changing it is the most common use case.
    modelInput.focus();
    modelInput.select();
    void refreshModels();
}

const closeCallbacks: (() => void)[] = [];

export function onSettingsClose(callback: () => void): void {
    closeCallbacks.push(callback);
}

export function closeSettings(): boolean {
    if (!commit()) {
        // Invalid settings (e.g. parameters are not a JSON object);
        // keep the panel open so the error can be fixed or undone.
        return false;
    }
    panel.classList.remove("open");
    open = false;
    // Move the focus out of the panel, which is about to become invisible.
    if (panel.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
    closeModelOptions();
    for (const callback of closeCallbacks) {
        callback();
    }
    return true;
}

export function toggleSettings(): void {
    if (open) {
        closeSettings();
    } else {
        openSettings();
    }
}

settingsButton.addEventListener("click", () => {
    toggleSettings();
});

closeButton.addEventListener("click", () => {
    closeSettings();
});

refreshButton.addEventListener("click", () => {
    void refreshModels();
});

baseUrlInput.addEventListener("change", () => {
    commit();
    void refreshModels();
});

chatCompletionsInput.addEventListener("change", () => {
    commit();
    systemPromptLabel.hidden = !chatCompletionsInput.checked;
});

for (const input of [apiKeyInput, modelInput, maxTokensInput, paramsTextarea, systemPromptTextarea]) {
    input.addEventListener("change", () => {
        commit();
    });
}

modelInput.addEventListener("focus", () => {
    showModelOptions(false);
});

modelInput.addEventListener("click", () => {
    showModelOptions(false);
});

modelInput.addEventListener("input", () => {
    showModelOptions(true);
});

modelInput.addEventListener("blur", () => {
    closeModelOptions();
});

modelInput.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" && filteredModels.length > 0) {
        event.preventDefault();
        if (!modelOptionsOpen) {
            showModelOptions(true);
        } else if (highlightedIndex < filteredModels.length - 1) {
            highlightedIndex++;
            updateHighlight();
        }
    } else if (event.key === "ArrowUp" && modelOptionsOpen && highlightedIndex >= 0) {
        event.preventDefault();
        highlightedIndex = highlightedIndex === 0 ? -1 : highlightedIndex - 1;
        updateHighlight();
    } else if (event.key === "Escape" && modelOptionsOpen) {
        // The first Escape only closes the model list; the panel stays open.
        event.preventDefault();
        event.stopPropagation();
        closeModelOptions();
    } else if (event.key === "Enter" && modelOptionsOpen) {
        event.preventDefault();
        event.stopPropagation();
        if (highlightedIndex >= 0 && highlightedIndex < filteredModels.length) {
            selectModel(filteredModels[highlightedIndex]!);
        } else {
            closeModelOptions();
        }
    }
});

// Enter in a single-line field commits the settings and closes the panel.
panel.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        closeSettings();
    }
});