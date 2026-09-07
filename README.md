# Arrows

> **This is a modified fork.** [Arrows](https://github.com/p-e-w/arrows) was
> created by Philipp Emanuel Weidmann around a strict *zero UI* philosophy:
> no buttons, labels, or menus — only the text and six keyboard shortcuts.
> This fork, maintained at
> [ChrisCantwell/arrows](https://github.com/ChrisCantwell/arrows),
> intentionally relaxes that principle for personal use, because its goals
> differ from upstream's: it adds a settings panel for changing the model,
> endpoint, generation mode, and parameters at runtime (see
> [Settings panel](#settings-panel) below).
>
> Changes in this fork:
>
> - Settings panel with a model dropdown fed by the server's `/v1/models` list
> - Chat completions mode with an editable system prompt (for chat-tuned models)
> - Sampling parameters as individual fields, with an escape hatch for
>   provider-specific extras
> - Named presets (model, mode, system prompt, token limit, parameters) for
>   one-click switching between models and use cases
> - Console logging for troubleshooting (see [Troubleshooting](#troubleshooting))
>
> These changes deliberately deviate from the upstream design philosophy and
> are therefore not proposed for inclusion upstream.
>
> **AI-assisted development:** the modifications in this fork were designed
> and implemented with the assistance of AI coding tools, under human
> direction and review. They are released under the same
> [AGPL-3.0-or-later](LICENSE) as the original project.

Arrows is an experimental frontend for creative writing with large language models (LLMs).

https://github.com/p-e-w/arrows/assets/2702526/a3f21e54-9dbd-43a1-9b2a-ea8873e9d5ec

It is designed around three principles:

1. **Generate whole paragraphs:** Paragraphs are the natural semantic units of prose.
   Instead of generating a fixed number of tokens like some other AI writing tools,
   Arrows stops requesting more tokens at the end of the paragraph,
   presenting a piece of text to the user that makes sense on its own.
2. **Give the user two options to choose from:** Arrows generates two versions
   of the next paragraph, and presents them to the user as two possible
   continuations. With a correctly configured backend (see llama.cpp arguments
   below), this can be done as a batched operation, which is essentially free,
   *doubling the effective generation speed!*
3. **Zero UI:** Arrows has no buttons, labels, or menus. Its user interface
   consists of the text you are working on, and nothing else. All LLM operations
   are performed using only six intuitive keyboard shortcuts (see below).

Arrows supports any backend that exposes an OpenAI-compatible text completion API.
This includes [text-generation-webui](https://github.com/oobabooga/text-generation-webui),
the [llama.cpp](https://github.com/ggerganov/llama.cpp) server, and of course
the OpenAI API itself.

Note that Arrows is intended for a completion-based writing workflow like the one
I described in [this Reddit post](https://www.reddit.com/r/LocalLLaMA/comments/18zqy4s/).
If you want an *instruction*-based workflow where you explicitly tell the AI
what to write next, then this is not the frontend you are looking for.


## Keyboard shortcuts

Arrows is a browser-based text editor and supports all standard text editing
shortcuts. In addition, the following shortcuts are provided to use the LLM
writing features:

**<kbd>Ctrl</kbd>+<kbd>Enter</kbd> (on Windows/Linux)** or **<kbd>⌘</kbd>+<kbd>Enter</kbd> (on macOS):**
Generate two options for the paragraph following the current cursor position.

**<kbd>← Left Arrow</kbd>:**
Choose left option and continue generating from there.

**<kbd>→ Right Arrow</kbd>:**
Choose right option and continue generating from there.

**<kbd>↓ Down Arrow</kbd>:**
Generate new options.

**<kbd>↑ Up Arrow</kbd>:**
Undo last insertion and generate from there.

**<kbd>Escape</kbd>:**
Return to normal editing.


## Installation

If you have Git and Node.js installed, installing this fork is straightforward:

```
git clone https://github.com/ChrisCantwell/arrows.git
cd arrows
npm install
```


## Running

The easiest way to use Arrows locally is to just run

```
npm run dev
```

from the installation directory and then open the displayed URL in the browser.
You can also use

```
npm run build
```

to build a minified production version, and then serve the `dist` directory
using the web server of your choice.


## Configuration

To set the base URL, API key, model, and generation parameters, simply edit the
file [`src/config.ts`](src/config.ts). The model name is sent to the
OpenAI-compatible completion endpoint. Some local providers ignore it when a
model is already loaded, but it is required by providers that expose multiple
models.

The values in `config.ts` serve as *defaults*: they can be overridden at
runtime in the settings panel (see below).


## Settings panel

The base URL, API key, model, token limit, sampling parameters, the chat
completions mode (see below) with its editable system prompt can be changed
at runtime in the settings panel, without editing any files. Open the
panel with the ⚙ button in the top right corner, or with
<kbd>Ctrl</kbd>+<kbd>,</kbd> (<kbd>⌘</kbd>+<kbd>,</kbd> on macOS); close it
with <kbd>Escape</kbd>, the &times; button, or <kbd>Enter</kbd> in a text field.

Sampling parameters are exposed as individual fields; a field left empty
means that the parameter is not sent, so the backend applies its own default.
Provider-specific parameters beyond the fields can be supplied as JSON under
*Extra parameters*. Whole generation configurations — model, mode, system
prompt, token limit, and parameters — can be saved as named *presets* and
re-applied from the dropdown, which makes switching between models and use
cases a single action.

Settings are stored in the browser's `localStorage`, so they persist across
sessions. Resetting them to the `config.ts` defaults is a matter of deleting
the stored values. Changes take effect from the next generation onward.

The model field shows a dropdown with the models offered by the server, so
that model names can be selected rather than typed. The list is fetched when
the panel is opened, and can be refreshed with the ↻ button; it filters as you
type, and can be navigated with the arrow keys. This requires the server to
implement the OpenAI-compatible `/v1/models` endpoint.


## Troubleshooting

Arrows logs its LLM traffic to the browser console (developer tools → console):
one line per request, and one line per finished stream, including the number
of characters generated and the reason generation stopped. To also log the
full prompt and every streaming chunk, enable debug logging with

    localStorage.setItem("arrows-debug", "1")

in the browser console and reload the page (undo with
`localStorage.removeItem("arrows-debug")`).

Check the backend server's own logs as well. For example, for Ollama run
`journalctl -u ollama -f` (Linux), `~/.ollama/logs/server.log` (macOS), or
`docker logs <container>` (Docker).

Note that by default Arrows sends the document as a raw *text completion*
prompt (`/v1/completions`). Strongly instruction- or chat-tuned models often
behave poorly on such prompts — returning nothing at all (an immediate
end-of-generation token) or degenerating into repetition — because the backend
does not apply their chat template to raw completion requests. For such
models, enable **Chat completions** in the settings panel: the document is
then sent to the chat completions endpoint together with the configurable
system prompt. Models trained for plain text continuation work best with the
raw endpoint.

Reasoning models ("thinking" models) spend tokens on their reasoning before
writing any text, and those tokens usually count against the token limit even
though they are not part of the text. If a model produces no text while its
console log shows a finish reason of `length`, raise the *Max tokens* value,
or set the *Reasoning* field to `low` (or `minimal`) to make the backend skip
the thinking (supported by Ollama and OpenAI; ignored where unsupported).


## Enabling parallel generation

Arrows has a fully asynchronous architecture and is capable of streaming
two completion options in parallel, as demonstrated in the video above.
This can save valuable user and GPU time.

However, in order for parallel generation to work, the backend server
has to support concurrent requests, ideally with automatic batching.
As of June 2024, text-generation-webui
[does not support](https://github.com/oobabooga/text-generation-webui/issues/3767)
concurrent request handling. When used as a backend for Arrows, the left/right
choices will be generated sequentially rather than in parallel.

A backend that *does* support concurrent requests is the
[llama.cpp server](https://github.com/ggerganov/llama.cpp/tree/master/examples/server).
To enable this feature, simply run the server with the arguments

```
--parallel 2 --cont-batching
```


## License

Copyright &copy; 2024  Philipp Emanuel Weidmann (<pew@worldwidemann.com>)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

**By contributing to this project, you agree to release your
contributions under the same license.**
