import { WpBoard, chess960_move_to_standard } from "./webperft/pkg";

export type CancelPerft = () => void;

export type PerftArgs = {
    fen: string;
    depth: number;
    chess960: boolean;
};

export type PerftResult = {
    move: string;
    normalizedMove: string,
    leaves: bigint;
};

function newWorker() {
    return new Promise<Worker>((res, _) => {
        const worker = new Worker(new URL("./perft_worker.ts", import.meta.url));
        worker.onmessage = () => {
            worker.onmessage = null;
            res(worker);
        };
    });
}

function workerMessage<T>(worker: Worker) {
    return new Promise<T>((res, _) => {
        worker.onmessage = e => {
            worker.onmessage = null;
            res(e.data);
        };
    });
}

export function runPerft(fen: string, depth: number, chess960: boolean, workerCount: number): [Promise<PerftResult[] | null>, CancelPerft] {
    let cancel: CancelPerft | null = null;
    const cancelPromise = new Promise<void>((c, _) => cancel = c);
    const perftPromise = runPerftInner(fen, depth, chess960, workerCount, cancelPromise);
    return [perftPromise, cancel!];
};

async function runPerftInner(fen: string, depth: number, chess960: boolean, workerCount: number, cancelPromise: Promise<void>) {
    const board = new WpBoard(fen, chess960);
    const moves: string[] = board.moves();
    const results: PerftResult[] = [];
    const workers: Worker[] = await Promise.all(
        Array(workerCount)
            .fill(null)
            .map(() => newWorker())
    );
    const perftPromise = Promise.all(
        workers.map(async worker => {
            while (moves.length > 0) {
                const move = moves.pop()!;
                const child = board.play(move);
                const args: PerftArgs = {
                    fen: child.fen(chess960),
                    depth: depth - 1,
                    chess960
                };
                child.free();
                worker.postMessage(args);
                const leaves: bigint = await workerMessage(worker);
                const normalizedMove = chess960
                    ? move
                    : chess960_move_to_standard(board, move);
                results.push({
                    move,
                    normalizedMove,
                    leaves
                });
            }
        })
    ).then(_ => "success");
    const status = await Promise.race([perftPromise, cancelPromise]);
    for (const worker of workers) {
        worker.terminate();
    }
    results.sort((a, b) => compareStr(a.normalizedMove, b.normalizedMove));
    return status === "success" ? results : null;
}

const compareStr = (a: string, b: string) => {
    if (a > b) {
        return 1;
    }
    if (a < b) {
        return -1;
    }
    return 0;
};
