(function () {
    const article = document.querySelector("body article");
    if (!article) {
        return;
    }
    let main = article.querySelector(":scope > .paper-main");
    if (!main) {
        main = document.createElement("div");
        main.className = "paper-main";

        const children = Array.from(article.children).filter((child) => {
            return !child.classList.contains("paper-sidebar");
        });
        for (const child of children) {
            main.appendChild(child);
        }
        article.appendChild(main);
    }

    document.body.classList.add("paper-page");
    article.classList.add("paper-layout");

    function normalizeText(text) {
        return text.replace(/\s+/g, " ").trim();
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function getContentHeadings() {
        return Array.from(
            article.querySelectorAll("h1[id], h2[id], h3[id]")
        ).filter((heading) => {
            return !heading.closest(".paper-header") &&
                !heading.closest(".paper-sidebar") &&
                !heading.closest("footer");
        });
    }

    function bindSmoothScroll(link, targetId) {
        link.addEventListener("click", function (event) {
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const target = document.getElementById(targetId);
            if (!target) {
                return;
            }

            event.preventDefault();
            target.scrollIntoView({
                behavior: reduceMotion ? "auto" : "smooth",
                block: "start",
            });
            history.replaceState(null, "", "#" + targetId);
        });
    }

    function looksLikeStatementTitle(text) {
        const normalized = normalizeText(text);
        if (!normalized) {
            return false;
        }

        const wordCount = normalized.split(/\s+/).length;
        if (normalized.length > 110 || wordCount > 12) {
            return false;
        }

        return !/[.!?;:]$/.test(normalized);
    }

    function buildSectionReferenceAliases(headings) {
        const aliasMap = new Map();

        function addAlias(alias, id) {
            if (!alias || aliasMap.has(alias)) {
                return;
            }
            aliasMap.set(alias, id);
        }

        for (const heading of headings) {
            const text = normalizeText(heading.textContent);
            const numberedMatch = text.match(/^(\d+(?:\.\d+)*)\.\s+/);
            if (numberedMatch) {
                addAlias("Section " + numberedMatch[1], heading.id);
                if (heading.dataset.appendix === "true") {
                    addAlias("Appendix " + numberedMatch[1], heading.id);
                }
            }

            const appendixMatch = text.match(/^A(\d+(?:\.\d+)*)\.\s+/i);
            if (appendixMatch) {
                addAlias("Appendix " + appendixMatch[1], heading.id);
            }
        }

        return aliasMap;
    }

    function linkSectionReferences(headings) {
        const aliasMap = buildSectionReferenceAliases(headings);
        const aliases = Array.from(aliasMap.keys()).sort((a, b) => b.length - a.length);
        if (aliases.length === 0) {
            return;
        }

        const pattern = new RegExp(
            "\\b(" + aliases.map(escapeRegExp).join("|") + ")\\b",
            "g"
        );
        const blockedSelector = [
            "a",
            "nav",
            ".paper-sidebar",
            "footer",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "#references",
            "script",
            "style",
            "code",
            "pre",
        ].join(", ");
        const walker = document.createTreeWalker(
            article,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (!node.nodeValue || !/(Appendix|Section)\s+\d/.test(node.nodeValue)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const parent = node.parentElement;
                    if (!parent || parent.closest(blockedSelector)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                },
            }
        );
        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        for (const textNode of textNodes) {
            const text = textNode.nodeValue;
            pattern.lastIndex = 0;
            if (!pattern.test(text)) {
                continue;
            }

            pattern.lastIndex = 0;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            while ((match = pattern.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                }

                const alias = match[1];
                const id = aliasMap.get(alias);
                if (!id) {
                    fragment.appendChild(document.createTextNode(alias));
                } else {
                    const link = document.createElement("a");
                    link.className = "section-ref-link";
                    link.href = "#" + id;
                    link.textContent = alias;
                    bindSmoothScroll(link, id);
                    fragment.appendChild(link);
                }

                lastIndex = match.index + alias.length;
            }

            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            textNode.parentNode.replaceChild(fragment, textNode);
        }
    }

    function enhanceBlockquotes() {
        for (const list of article.querySelectorAll("ol, ul")) {
            const items = Array.from(list.children).filter((child) => child.tagName === "LI");
            if (items.length === 0) {
                continue;
            }

            const blockItems = items.filter((item) => {
                const meaningfulChildren = Array.from(item.children).filter((child) => {
                    return child.tagName !== "LABEL" && child.tagName !== "INPUT";
                });
                return meaningfulChildren.length > 0 && meaningfulChildren[0].tagName === "BLOCKQUOTE";
            });

            if (blockItems.length === items.length) {
                list.classList.add("paper-block-list");
                for (const item of blockItems) {
                    item.classList.add("paper-block-item");
                    for (const child of Array.from(item.children)) {
                        if (child.tagName === "OL" || child.tagName === "UL") {
                            child.classList.add("paper-nested-list");
                        }
                    }
                }
            }
        }

        for (const blockquote of article.querySelectorAll("blockquote")) {
            const paragraphs = Array.from(blockquote.children).filter((child) => child.tagName === "P");
            if (paragraphs.length === 0) {
                continue;
            }

            const firstParagraph = paragraphs[0];
            const parentTag = blockquote.parentElement?.tagName || "";
            const nextSibling =
                blockquote.nextElementSibling ||
                (parentTag === "BLOCKQUOTE" ? blockquote.parentElement.nextElementSibling : null);
            const hasStructuredContinuation =
                paragraphs.length > 1 ||
                (nextSibling &&
                    (nextSibling.tagName === "OL" || nextSibling.tagName === "UL"));

            if (
                parentTag !== "LI" &&
                hasStructuredContinuation &&
                looksLikeStatementTitle(firstParagraph.textContent)
            ) {
                blockquote.classList.add("paper-statement");
            }
        }

        for (const br of article.querySelectorAll("figcaption br")) {
            br.replaceWith(document.createTextNode(" "));
        }
    }

    function buildToc() {
        const headings = getContentHeadings();

        if (headings.length < 2 || article.querySelector(":scope > .paper-sidebar")) {
            return;
        }

        const sidebar = document.createElement("aside");
        sidebar.className = "paper-sidebar";
        sidebar.innerHTML = [
            '<div class="paper-sidebar-inner">',
            '  <div class="paper-sidebar-heading">',
            '    <div class="paper-sidebar-title">Contents</div>',
            '    <a class="paper-sidebar-home" href="/">Home</a>',
            '  </div>',
            '  <nav class="paper-generated-toc" aria-label="Contents"></nav>',
            "</div>",
        ].join("");

        const tocNav = sidebar.querySelector(".paper-generated-toc");
        const rootList = document.createElement("ol");
        rootList.className = "paper-toc-list";
        tocNav.appendChild(rootList);

        const listStack = [rootList];
        let currentLevel = 1;
        let lastItem = null;

        function ensureLevel(targetLevel) {
            while (targetLevel > currentLevel) {
                const nested = document.createElement("ol");
                nested.className = "paper-toc-sublist";
                if (lastItem) {
                    lastItem.appendChild(nested);
                    listStack.push(nested);
                    currentLevel += 1;
                } else {
                    break;
                }
            }

            while (targetLevel < currentLevel && listStack.length > 1) {
                listStack.pop();
                currentLevel -= 1;
            }
        }

        const linkById = new Map();

        function headingLabel(heading) {
            return heading.textContent
                .replace(/\\\(\s*\\mathbf\s*\{?([A-Za-z])\}?\s*\\\)/g, "$1")
                .replace(/\s+/g, " ")
                .trim();
        }

        for (const heading of headings) {
            const level = Number(heading.tagName.slice(1));
            const normalizedLevel = Math.max(1, Math.min(3, level));
            ensureLevel(normalizedLevel);

            const item = document.createElement("li");
            item.className = "paper-toc-item level-" + normalizedLevel;

            const link = document.createElement("a");
            link.className = "paper-toc-link";
            link.href = "#" + heading.id;
            link.textContent = headingLabel(heading);
            bindSmoothScroll(link, heading.id);

            item.appendChild(link);
            listStack[listStack.length - 1].appendChild(item);
            lastItem = item;
            linkById.set(heading.id, link);
        }

        function positionSidebar() {
            const mobileLayout = window.matchMedia("(max-width: 1100px)").matches;
            if (mobileLayout && main !== article) {
                const header = main.querySelector(":scope > .paper-header");
                if (header) {
                    header.insertAdjacentElement("afterend", sidebar);
                    return;
                }
            }

            if (main !== article) {
                article.insertBefore(sidebar, main);
                return;
            }

            const nav = article.querySelector(":scope > nav");
            if (nav) {
                nav.insertAdjacentElement("afterend", sidebar);
            } else {
                article.prepend(sidebar);
            }
        }

        positionSidebar();
        window.addEventListener("resize", positionSidebar);

        let activeId = headings[0].id;

        function setActive(id) {
            if (id === activeId) {
                return;
            }

            const previous = linkById.get(activeId);
            if (previous) {
                previous.classList.remove("is-active");
            }

            activeId = id;
            const current = linkById.get(activeId);
            if (current) {
                current.classList.add("is-active");
            }
        }

        const firstLink = linkById.get(activeId);
        if (firstLink) {
            firstLink.classList.add("is-active");
        }

        const observer = new IntersectionObserver(
            function (entries) {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

                if (visible.length > 0) {
                    setActive(visible[0].target.id);
                }
            },
            {
                rootMargin: "-20% 0px -65% 0px",
                threshold: [0, 1],
            }
        );

        for (const heading of headings) {
            observer.observe(heading);
        }
    }

    function layoutSidenotes() {
        const notes = Array.from(article.querySelectorAll(".sidenote, .marginnote"));
        const desktopLayout = window.matchMedia("(min-width: 1101px)").matches;
        document.body.classList.toggle("paper-sidenotes-positioned", desktopLayout);

        if (!article.dataset.basePaddingBottom) {
            article.dataset.basePaddingBottom = String(
                parseFloat(window.getComputedStyle(article).paddingBottom) || 0
            );
        }

        for (const note of notes) {
            note.style.top = "";
            note.style.left = "";
            note.style.width = "";
        }

        if (!desktopLayout || notes.length === 0) {
            article.style.paddingBottom = article.dataset.basePaddingBottom + "px";
            return;
        }

        const contentElement = main.querySelector(
            ":scope > header, :scope > .abstract, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > p, :scope > ol, :scope > ul, :scope > blockquote, :scope > figure, :scope > table"
        );
        if (!contentElement) {
            return;
        }

        const articleRect = article.getBoundingClientRect();
        const contentRect = contentElement.getBoundingClientRect();
        const rootStyles = window.getComputedStyle(document.documentElement);
        const gap = parseFloat(rootStyles.getPropertyValue("--paper-note-gap")) || 48;
        const noteWidth = parseFloat(rootStyles.getPropertyValue("--paper-note-width")) || 280;
        const noteLeft = contentRect.left - articleRect.left + contentRect.width + gap;
        const basePaddingBottom = parseFloat(article.dataset.basePaddingBottom) || 0;
        let nextTop = 0;
        let deepestBottom = 0;

        for (const note of notes) {
            const input = note.previousElementSibling;
            const label = input && input.matches("input.margin-toggle")
                ? input.previousElementSibling
                : null;
            const anchor = label && label.matches("label.margin-toggle")
                ? label
                : note.parentElement;
            const anchorRect = anchor.getBoundingClientRect();
            const proposedTop = anchorRect.top - articleRect.top - 6;
            const top = Math.max(proposedTop, nextTop);

            note.style.left = noteLeft + "px";
            note.style.top = top + "px";
            note.style.width = noteWidth + "px";

            const bottom = top + note.offsetHeight;
            deepestBottom = Math.max(deepestBottom, bottom);
            nextTop = bottom + 18;
        }

        const inFlowHeight = article.scrollHeight - basePaddingBottom;
        const extraBottom = Math.max(0, deepestBottom - inFlowHeight + 40);
        article.style.paddingBottom = basePaddingBottom + extraBottom + "px";
    }

    function scheduleSidenoteLayout() {
        window.requestAnimationFrame(function () {
            layoutSidenotes();
            window.setTimeout(layoutSidenotes, 120);
            window.setTimeout(layoutSidenotes, 700);
        });
    }

    enhanceBlockquotes();
    linkSectionReferences(getContentHeadings());
    buildToc();
    scheduleSidenoteLayout();

    window.addEventListener("resize", scheduleSidenoteLayout);
    window.addEventListener("load", scheduleSidenoteLayout);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(scheduleSidenoteLayout).catch(function () {});
    }
})();
