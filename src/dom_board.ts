import { WpBoard } from "./webperft/pkg";

type PieceInfo = {
    color: string,
    piece: string,
    square: string
};

export class DomBoard {
    public squares: Map<string, HTMLDivElement>;

    constructor(elem: HTMLDivElement) {
        this.squares = new Map();
        for (let file_index = 0; file_index < 8; file_index++) {
            const file = "abcdefgh"[file_index]!;
            for (let rank_index = 0; rank_index < 8; rank_index++) {
                const rank = (rank_index + 1).toString();
                const squareElem = document.createElement("div");
                squareElem.classList.add("square");
                squareElem.style.setProperty("--file", file_index.toString());
                squareElem.style.setProperty("--rank", rank_index.toString());
                if (file_index % 2 === rank_index % 2) {
                    squareElem.classList.add("dark-square");
                }
                if (rank === "1") {
                    const fileChar = document.createElement("span");
                    fileChar.classList.add("file-char");
                    fileChar.innerText = file;
                    squareElem.appendChild(fileChar);
                }
                if (file === "h") {
                    const rankChar = document.createElement("span");
                    rankChar.classList.add("rank-char");
                    rankChar.innerText = rank;
                    squareElem.appendChild(rankChar);
                }
                this.squares.set(file + rank, squareElem);
                elem.appendChild(squareElem);
            }
        }
    }

    set(board: WpBoard) {
        for (const squareElem of this.squares.values()) {
            squareElem.style.removeProperty("--piece");
        }

        const pieces: PieceInfo[] = board.pieces();
        for (const { color, piece, square } of pieces) {
            const squareElem = this.squares.get(square)!;
            squareElem.style.setProperty("--piece", `url(./static/pieces/${color}${piece.toUpperCase()}.svg)`);
        }
    }
};
