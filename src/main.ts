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
import { BASE_URL, API_KEY, MAX_TOKENS, PARAMS } from "./config.ts";

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

const client = new OpenAI({
    baseURL: BASE_URL,
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true,
});

function scrollEmbedIntoView() {
    scrollIntoView(embedElement, { scrollMode: "if-needed", block: "end" });
}

async function streamText(prompt: string, pane: Element): Promise<string> {
    const params: OpenAI.CompletionCreateParamsStreaming = {
        stream: true,
        prompt: prompt,
        max_tokens: MAX_TOKENS,
        // @ts-ignore: llama.cpp
        n_predict: MAX_TOKENS,
        // @ts-ignore: llama.cpp
        cache_prompt: true,
        ...PARAMS,
    };

    const controller = new AbortController();
    controllers.push(controller);

    const stream = await client.completions.create(params, { signal: controller.signal });

    let text = "";
    let startFound = false;
    let isNewParagraph = false;

    for await (const chunk of stream) {
        let newText: string;
        if (chunk.hasOwnProperty("choices")) {
            newText = chunk.choices[0].text;
        } else {
            // @ts-ignore: llama.cpp
            newText = chunk.content;
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
            break;
        }
    }

    if (text.length === 0) {
        pane.textContent = "[empty]";
        pane.classList.add("empty");
        scrollEmbedIntoView();
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
            panes[i].textContent = result.reason;
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
