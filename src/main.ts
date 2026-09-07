// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import "quill/dist/quill.core.css";
import "./style.css";
import "./loader.css";

import OpenAI from "openai";
import Quill from "quill";
import scrollIntoView from "scroll-into-view-if-needed";

import ParagraphClipboard from "./clipboard.ts";
import SplitEmbed from "./embed.ts";
import { createClient, settings, isSettingsOpen, closeSettings, toggleSettings, onSettingsClose } from "./settings.ts";

enum State {
    Editing,
    Generating,
    WaitingForChoice,
    Transitioning,
    Canceling,
}

let state = State.Editing;
let cursorIndex: number;
let embedIndex: number;
let embedLength: number;
let embedElement: Element;
let choices: string[];
let controllers: AbortController[];
let completionCallback: (() => Promise<void>) | null;

// Created anew for every generation, so that settings changes take effect immediately.
let client: OpenAI;

// Set the "arrows-debug" key in localStorage and reload the page to enable
// detailed logging of prompts and streaming chunks in the browser console.
const debug = (() => {
    try {
        return localStorage.getItem("arrows-debug") !== null;
    } catch {
        return false;
    }
})();

function scrollEmbedIntoView() {
    scrollIntoView(embedElement, { scrollMode: "if-needed", block: "end" });
}

async function streamText(prompt: string, pane: Element): Promise<string> {
    const paneName = pane.classList.contains("left") ? "left" : "right";

    console.info(`[arrows] ${paneName}: requesting ${settings.maxTokens} tokens from ${settings.model}` +
        (settings.chatCompletions ? " (chat)" : ""));
    if (debug) {
        console.debug(`[arrows] ${paneName}: prompt:`, JSON.stringify(prompt),
            "system prompt:", settings.systemPrompt, "params:", settings.params);
    }

    const controller = new AbortController();
    controllers.push(controller);

    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: settings.systemPrompt },
        { role: "user", content: prompt },
    ];

    const completionParams: OpenAI.CompletionCreateParamsStreaming = {
        stream: true,
        // This parameter is ignored by most OpenAI-compatible local API providers.
        model: settings.model,
        prompt: prompt,
        max_tokens: settings.maxTokens,
        // @ts-ignore: llama.cpp
        n_predict: settings.maxTokens,
        // @ts-ignore: llama.cpp
        cache_prompt: true,
        ...settings.params,
    };

    const chatParams: OpenAI.ChatCompletionCreateParamsStreaming = {
        stream: true,
        model: settings.model,
        max_tokens: settings.maxTokens,
        messages: messages,
        ...settings.params,
    };

    const stream = settings.chatCompletions
        ? await client.chat.completions.create(chatParams, { signal: controller.signal })
        : await client.completions.create(completionParams, { signal: controller.signal });

    let text = "";
    let startFound = false;
    let isNewParagraph = false;
    let finishReason: string | null = null;
    let stoppedAtParagraphEnd = false;
    let reasoningLength = 0;

    for await (const chunk of stream) {
        let newText: string;
        if (chunk.hasOwnProperty("choices")) {
            const choice = chunk.choices[0];
            if (choice.finish_reason) {
                finishReason = choice.finish_reason;
            }
            if ("text" in choice) {
                // Text completion chunk.
                newText = choice.text;
            } else {
                // Chat completion chunk.
                newText = choice.delta.content ?? "";
                // Some providers (e.g. Ollama for thinking models) stream the
                // model's reasoning in a separate field. It is not part of the
                // text, but it usually counts against the token budget.
                const reasoning = (choice.delta as { reasoning?: string | null }).reasoning ??
                    (choice.delta as { reasoning_content?: string | null }).reasoning_content;
                if (reasoning) {
                    reasoningLength += reasoning.length;
                    if (debug) {
                        console.debug(`[arrows] ${paneName} reasoning:`, reasoning);
                    }
                }
            }
        } else {
            // @ts-ignore: llama.cpp
            newText = chunk.content;
            // @ts-ignore: llama.cpp
            if (chunk.stop_type) {
                // @ts-ignore: llama.cpp
                finishReason = chunk.stop_type;
            }
        }

        if (debug) {
            console.debug(`[arrows] ${paneName} chunk:`, chunk);
        }

        if (!startFound) {
            // Remove leading line breaks.
            while (newText.startsWith("\n")) {
                newText = newText.substring(1);
                isNewParagraph = true;
            }
        }

        if (newText.length === 0) {
            continue;
        }

        const lines = newText.split("\n");
        newText = lines[0];

        text += newText;

        if (!startFound) {
            // Start of actual text.

            // Remove leading whitespace for cleaner display while presenting choices.
            // Note that the unmodified text has already been appended to the internal
            // representation above, so this does not affect the text that is inserted.
            newText = newText.trimStart();

            // Clear loader.
            pane.textContent = "";
        }

        pane.textContent += newText;
        scrollEmbedIntoView();

        startFound = true;

        // Stop at end of paragraph.
        if (lines.length > 1) {
            stoppedAtParagraphEnd = true;
            break;
        }
    }

    if (text.length === 0) {
        console.warn(`[arrows] ${paneName}: no text produced` +
            (finishReason ? ` (finish reason: ${finishReason})` : "") +
            (reasoningLength > 0
                ? ` — the model spent its entire token budget on reasoning (${reasoningLength} chars).` +
                  " Increase Max tokens, or add \"reasoning_effort\": \"low\" to the parameters" +
                  " to make the backend skip the thinking."
                : " — the model probably returned an immediate end-of-generation token" +
                  (settings.chatCompletions
                      ? "."
                      : " (chat-tuned models often do this; try enabling chat completions in the settings).")));
        pane.textContent = "[empty]";
        pane.classList.add("empty");
        scrollEmbedIntoView();
    } else {
        console.info(`[arrows] ${paneName}: generated ${text.length} chars` +
            (reasoningLength > 0 ? ` (plus ${reasoningLength} chars of reasoning)` : "") +
            (finishReason ? ` (finish reason: ${finishReason})` : "") +
            (stoppedAtParagraphEnd ? " (stopped at end of paragraph)" : ""));
    }

    return (isNewParagraph ? "\n" : "") + text;
}

async function generate() {
    const range = quill.getSelection();

    if (!range) {
        return;
    }

    cursorIndex = range.index;

    const [line, offset] = quill.getLine(cursorIndex);

    if (!line) {
        return;
    }

    state = State.Generating;
    quill.disable();

    // New client on every generation, so that settings changes take effect.
    client = createClient();

    const prompt = quill.getText(0, cursorIndex);

    // `line.length()` includes the line break.
    const cursorAtEndOfLine = (offset === line.length() - 1);

    // If the cursor is at the end of the line, insert the embed at the start
    // of the next line to avoid splitting off an empty line.
    embedIndex = cursorAtEndOfLine ? cursorIndex + 1 : cursorIndex;

    // If the cursor is in the middle of the line, inserting the embed
    // will cause Quill to insert a line break before it.
    embedLength = (offset === 0 || cursorAtEndOfLine) ? 1 : 2;

    quill.insertEmbed(embedIndex, SplitEmbed.blotName, true, Quill.sources.SILENT);

    embedElement = document.querySelector(".split")!;
    scrollEmbedIntoView();

    const panes = Array.from(document.querySelectorAll(".split > *"));

    controllers = [];
    completionCallback = null;

    // Stream text into all panes concurrently.
    const results = await Promise.allSettled(panes.map(pane => streamText(prompt, pane)));

    choices = results.map((result, i) => {
        if (result.status === "fulfilled") {
            return result.value;
        } else {
            const reason = result.reason;
            if (reason instanceof Error && reason.name === "AbortError") {
                console.info(`[arrows] stream aborted`);
            } else {
                console.error(`[arrows] stream failed:`, reason);
            }
            panes[i].textContent = reason;
            panes[i].classList.add("error");
            scrollEmbedIntoView();
            return "";
        }
    });

    state = State.WaitingForChoice;
    controllers = [];

    if (completionCallback) {
        // @ts-ignore: TypeScript doesn't understand that the value may have been changed
        //             by other code while awaiting the promise above.
        await completionCallback();
        completionCallback = null;
    }
}

Quill.register("modules/clipboard", ParagraphClipboard, true);
Quill.register(SplitEmbed);

const quill = new Quill("#editor", {
    placeholder: "Once upon a time...",
    modules: {
        keyboard: {
            bindings: {
                // Defined here to override default binding.
                handleEnter: {
                    // Ctrl/Cmd+Enter
                    key: "Enter",
                    shortKey: true,
                    collapsed: true,
                    handler: async () => {
                        if (isSettingsOpen()) {
                            return false;
                        }

                        if (state !== State.Editing) {
                            return true;
                        }

                        await generate();
                    },
                },
            },
        },
    },
});

// Return focus to the editor when the settings panel is closed, so that
// writing (and Ctrl+Enter) can resume immediately.
onSettingsClose(() => {
    if (state === State.Editing) {
        quill.focus();
    }
});

function deleteEmbed() {
    quill.deleteText(embedIndex, embedLength, Quill.sources.SILENT);
}

async function cancelGeneration(callback: () => Promise<void>) {
    if (state === State.Generating) {
        state = State.Canceling;
        completionCallback = callback;

        for (const controller of controllers) {
            controller.abort();
        }
    } else {
        await callback();
    }
}

// We cannot use Quill's built-in keyboard module to bind these keys,
// because the module's bindings are disabled when the editor is disabled,
// which is the case while generating text.
document.addEventListener("keydown", async event => {
    // Ctrl/Cmd + Comma toggles the settings panel, in any state.
    if (event.key === "," && (event.ctrlKey || event.metaKey) && !event.altKey) {
        event.preventDefault();
        toggleSettings();
        return;
    }

    // While the settings panel is open, all other shortcuts are disabled.
    if (isSettingsOpen()) {
        if (event.key === "Escape") {
            event.preventDefault();
            closeSettings();
        }
        return;
    }

    if (state === State.Editing || state === State.Transitioning || state === State.Canceling) {
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();

        await cancelGeneration(async () => {
            deleteEmbed();
            state = State.Editing;
            quill.enable();
            quill.focus();
        });
    } else if (event.key === "ArrowUp") {
        event.preventDefault();

        await cancelGeneration(async () => {
            deleteEmbed();
            quill.enable();
            quill.history.undo();
            await generate();
        });
    } else if (event.key === "ArrowDown") {
        event.preventDefault();

        await cancelGeneration(async () => {
            deleteEmbed();
            await generate();
        });
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();

        await cancelGeneration(async () => {
            scrollEmbedIntoView();

            const [chosen, other, chosenText] = (event.key === "ArrowLeft") ?
                ["left", "right", choices[0]] :
                ["right", "left", choices[1]];

            const otherPane = document.querySelector(".split ." + other)!;

            state = State.Transitioning;

            // @ts-ignore: TypeScript doesn't seem to know about this event.
            otherPane.addEventListener("transitionend", async (event: TransitionEvent) => {
                if (event.propertyName === "opacity") {
                    // First transition finished: Fading in the chosen pane, and fading out the other.
                    // Empty the other pane so it can be shrunk without expanding vertically.
                    otherPane.textContent = "";
                } else if (event.propertyName === "flex-grow") {
                    // Second transition finished: Expanding the chosen pane, and shrinking the other.
                    deleteEmbed();
                    quill.insertText(cursorIndex, chosenText, Quill.sources.API);
                    await generate();
                }
            });

            // Start the transitions.
            embedElement.classList.add(chosen + "-chosen");
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    quill.focus();
});
