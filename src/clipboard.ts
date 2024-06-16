// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import Clipboard from "quill/modules/clipboard";
import type { Range } from "quill/core";
import { Delta } from "quill/core";

export default class ParagraphClipboard extends Clipboard {
    onCopy(range: Range, isCut: boolean): {
        html: string;
        text: string;
    } {
        let { html, text } = super.onCopy(range, isCut);
        text = text.replaceAll("\n", "\n\n");
        return { html, text };
    }

    convert({ html, text }: {
        html?: string;
        text?: string;
    }, formats?: Record<string, unknown>): Delta {
        if (!html) {
            text = text || "";
            text = text.replaceAll("\n\n", "\n");
            return new Delta().insert(text, formats);
        }

        return super.convert({ html, text }, formats);
    }
}
