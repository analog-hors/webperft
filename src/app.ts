import "./styles.css";

import { DomBoard } from "./dom_board";
import { WpBoard } from "./webperft/pkg";
import { CancelPerft, runPerft } from "./perft";

type PerftResult = {
    move: string;
    normalizedMove: string,
    leaves: bigint;
};

const boardElem = document.getElementById("board") as HTMLDivElement;
const fenElem = document.getElementById("fen") as HTMLInputElement;
const fenSelectorElem = document.getElementById("fen-selector") as HTMLSelectElement;
const depthElem = document.getElementById("depth") as HTMLInputElement;
const chess960CheckboxElem = document.getElementById("chess960-checkbox") as HTMLInputElement;
const infoElem = document.getElementById("info") as HTMLDivElement;
const diffButtonElem = document.getElementById("diff-button") as HTMLButtonElement;
const diffWindowContainer = document.getElementById("diff-window-container") as HTMLDivElement;
const diffInput = document.getElementById("diff-input") as HTMLTextAreaElement;
const diffResult = document.getElementById("diff-result") as HTMLDivElement;
const diffCloseElem = document.getElementById("diff-close") as HTMLButtonElement;

const chess960Enabled = () => chess960CheckboxElem.checked;

for (const elem of fenSelectorElem.getElementsByClassName("chess960-position")) {
    if (chess960Enabled()) {
        elem.removeAttribute("disabled");
    } else {
        elem.setAttribute("disabled", "");
    }
}

let depth = parseInt(depthElem.value, 10);
let fen = fenSelectorElem.value !== "custom" ? fenSelectorElem.value : fenElem.value;
let board = new WpBoard(fen, chess960Enabled());
const domBoard = new DomBoard(boardElem);
domBoard.set(board);
fenElem.value = fen;

let perftResults: PerftResult[] = [];
let cancelPerft: CancelPerft | null = null;
const newPerft = async () => {
    if (cancelPerft !== null) {
        cancelPerft();
    }
    
    const calculatingElem = document.createElement("span");
    calculatingElem.innerText = "Calculating";
    calculatingElem.classList.add("calculating");
    infoElem.replaceChildren(calculatingElem);
    diffButtonElem.disabled = true;

    const workerArgs = { fen, depth, chess960: chess960Enabled() };
    const [perftPromise, cancel] = runPerft(workerArgs.fen, workerArgs.depth, workerArgs.chess960, navigator.hardwareConcurrency ?? 1);
    cancelPerft = cancel;
    const maybePerftResults = await perftPromise;
    if (maybePerftResults === null || workerArgs.fen !== fen || workerArgs.depth !== depth || workerArgs.chess960 !== chess960Enabled()) {
        return;
    }
    perftResults = maybePerftResults;

    infoElem.replaceChildren();
    let total = BigInt(0);
    const totalElem = document.createElement("span");
    infoElem.appendChild(totalElem);
    for (const { move, normalizedMove, leaves } of perftResults) {
        const moveElem = document.createElement("span");
        const leavesElem = document.createElement("span");
        infoElem.appendChild(document.createElement("br"));
        infoElem.appendChild(moveElem);
        infoElem.appendChild(leavesElem);

        const fromSquare = normalizedMove.slice(0, 2);
        const toSquare = normalizedMove.slice(2, 4);
        const addHighlights = () => {
            domBoard.squares.get(fromSquare)!.classList.add("from-square");
            domBoard.squares.get(toSquare)!.classList.add("to-square");
        };
        const removeHighlights = () => {
            domBoard.squares.get(fromSquare)!.classList.remove("from-square");
            domBoard.squares.get(toSquare)!.classList.remove("to-square");
        };

        moveElem.classList.add("move");
        moveElem.innerText = normalizedMove;
        moveElem.addEventListener("mouseenter", addHighlights);
        moveElem.addEventListener("mouseleave", removeHighlights);
        moveElem.addEventListener("click", () => {
            removeHighlights();
            const minDepth = parseInt(depthElem.min, 10);
            if (depth > minDepth) {
                depth -= 1;
                depthElem.value = depth.toString();
            }
            const child = board.play(move);
            updateFen(child.fen(chess960Enabled()));
            fenSelectorElem.value = "custom";
            child.free();
        });
        leavesElem.innerText = ` - ${leaves}`;

        total += leaves;
    }
    totalElem.innerText = `Total: ${total}`;
    diffButtonElem.disabled = false;
};
newPerft();

const updateFen = (newFen: string) => {
    const newBoard = new WpBoard(newFen, chess960Enabled());
    board.free();
    board = newBoard;
    fen = newFen;
    fenElem.value = fen;
    domBoard.set(board);
    newPerft();
};

const resetDefault = () => {
    fenSelectorElem.value = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    updateFen(fenSelectorElem.value);
};

fenElem.addEventListener("change", () => {
    try {
        updateFen(fenElem.value);
        fenSelectorElem.value = "custom";
    } catch (e) {
        fenElem.value = fen;
        fenElem.setCustomValidity((e as Error).toString());
        fenElem.reportValidity();
        fenElem.setCustomValidity("");
    }
});

fenSelectorElem.addEventListener("change", () => {
    updateFen(fenSelectorElem.value);
});

depthElem.addEventListener("change", () => {
    let value = parseInt(depthElem.value, 10);
    if (isNaN(value)) {
        value = depth;
    }
    const min = parseInt(depthElem.min, 10);
    const max = parseInt(depthElem.max, 10);
    value = Math.max(value, min);
    value = Math.min(value, max);

    if (depth !== value) {
        depth = value;
        newPerft();
    }
    depthElem.value = depth.toString();
});

chess960CheckboxElem.addEventListener("change", () => {
    for (const elem of fenSelectorElem.getElementsByClassName("chess960-position")) {
        if (chess960Enabled()) {
            elem.removeAttribute("disabled");
        } else {
            elem.setAttribute("disabled", "");
        }
    }
    resetDefault();
});

diffButtonElem.addEventListener("click", () => {
    diffInput.value = "";
    diffResult.replaceChildren();
    diffWindowContainer.style.display = "unset";
});

diffCloseElem.addEventListener("click", () => {
    diffWindowContainer.style.display = "";
});

diffInput.addEventListener("change", () => {
    type StyledText = [string, "move" | "incorrect" | "correct"];

    diffResult.replaceChildren();
    const outputLine = (...args: (StyledText | string)[]) => {
        for (const arg of args) {
            if (typeof arg === "string") {
                diffResult.append(arg);
            } else {
                const [text, type] = arg;
                const elem = document.createElement("span");
                elem.innerText = text;
                elem.classList.add(`diff-text-${type}`);
                diffResult.appendChild(elem);
            }
        }
        diffResult.appendChild(document.createElement("br"));
    };

    const seen = new Set();
    for (let line of diffInput.value.split("\n")) {
        line = line.trim();
        if (line.length === 0) {
            continue;
        }

        const moveMatch = /[a-zA-Z0-9]+/.exec(line);
        if (moveMatch === null || moveMatch.length === 0) {
            outputLine(
                `Failed to find move in "${line}"`
            );
            continue;
        }
        const move = moveMatch[0]!.toLowerCase();
        const perftEntry = perftResults.find(m => move === m.normalizedMove);
        if (perftEntry === undefined) {
            outputLine(
                "Move ",
                [move, "incorrect"],
                " is illegal or invalid"
            );
            continue;
        }
        if (seen.has(move)) {
            outputLine(
                "Duplicate move ",
                [move, "move"]
            );
            continue;
        }
        seen.add(move);
        const leavesMatch = /[0-9]+/.exec(line.slice(moveMatch.index + move.length));
        if (leavesMatch === null || leavesMatch.length === 0) {
            outputLine(
                `Failed to find node count in "${line}"`
            );
            continue;
        }
        const leaves = BigInt(leavesMatch[0]!);
        if (leaves !== perftEntry.leaves) {
            outputLine(
                [move, "move"],
                " - ",
                [leaves.toString(), "incorrect"],
                " should have ",
                [perftEntry.leaves.toString(), "correct"],
                " leaves"
            );
            continue;
        }
    }
    for (const { normalizedMove } of perftResults) {
        if (!seen.has(normalizedMove)) {
            outputLine(
                "Missing move ",
                [normalizedMove, "move"]
            );
        }
    }
});
