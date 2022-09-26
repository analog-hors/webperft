import { PerftArgs } from "./perft";
import { WpBoard, perft } from "./webperft/pkg";

addEventListener("message", (e: MessageEvent<PerftArgs>) => {
    const { fen, depth, chess960 } = e.data;
    const board = new WpBoard(fen, chess960);
    const leaves = perft(board, depth);
    board.free();
    postMessage(leaves);
});
postMessage(null);
