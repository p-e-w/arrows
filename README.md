# Arrows

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

If you have Git and Node.js installed, installing Arrows is straightforward:

```
git clone https://github.com/p-e-w/arrows.git
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

To set the base URL, API key, and generation parameters, simply edit the file
[`src/config.ts`](src/config.ts).


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
