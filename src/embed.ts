// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { BlockEmbed } from "quill/blots/block";

export default class SplitEmbed extends BlockEmbed {
    static blotName = "split";
    static className = "split";
    static tagName = "div";

    static create(rawValue?: unknown): Node {
        const container = super.create(rawValue) as HTMLElement;

        container.contentEditable = "false";

        for (const name of ["left", "right"]) {
            const pane = document.createElement("p");
            pane.className = name;

            const loader = document.createElement("span");
            loader.className = "loader";
            pane.append(loader);

            container.append(pane);
        }

        return container;
    }

    value(): any {
        // This embed is presentational only and not editable;
        // return zero-length value to avoid cursor navigation issues.
        return "";
    }
}
