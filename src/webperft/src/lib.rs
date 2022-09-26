use wasm_bindgen::prelude::*;
use serde::Serialize;
use cozy_chess::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

fn set_error_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[derive(Serialize)]
struct PieceInfo {
    color: String,
    piece: String,
    square: String,
}

#[wasm_bindgen]
pub struct WpBoard(Board);

#[wasm_bindgen]
impl WpBoard {
    #[wasm_bindgen(constructor)]
    pub fn new(fen: &str, chess960: Option<bool>) -> Result<WpBoard, JsError> {
        set_error_hook();
        let board = if chess960 == Some(true) {
            fen.parse()?
        } else {
            Board::from_fen(fen, false)?
        };
        Ok(Self(board))
    }

    #[wasm_bindgen]
    pub fn play(&self, mv: &str) -> Result<WpBoard, JsError> {
        let mv = mv.parse()?;
        let mut board = self.0.clone();
        board.try_play(mv)?;
        Ok(Self(board))
    }

    #[wasm_bindgen]
    pub fn moves(&self) -> Result<Vec<JsValue>, JsError> {
        let mut move_list = Vec::new();
        self.0.generate_moves(|moves| {
            for mv in moves {
                let mv = format!("{}", mv);
                move_list.push(mv.into());
            }
            false
        });
        Ok(move_list)
    }

    #[wasm_bindgen]
    pub fn pieces(&self) -> Vec<JsValue> {
        let mut pieces = Vec::new();
        for color in Color::ALL {
            for piece in Piece::ALL {
                for square in self.0.colored_pieces(color, piece) {
                    let info = PieceInfo {
                        color: format!("{}", color),
                        piece: format!("{}", piece),
                        square: format!("{}", square),
                    };
                    pieces.push(JsValue::from_serde(&info).unwrap());
                }
            }
        }
        pieces
    }

    #[wasm_bindgen]
    pub fn fen(&self, chess960: Option<bool>) -> String {
        if chess960 == Some(true) {
            format!("{:#}", self.0)
        } else {
            format!("{}", self.0)
        }
    }
}

#[wasm_bindgen]
pub fn perft(board: &WpBoard, depth: u8) -> u64 {
    perft_inner(&board.0, depth)
}

fn perft_inner(board: &Board, depth: u8) -> u64 {
    let mut nodes = 0;
    match depth {
        0 => nodes += 1,
        1 => {
            board.generate_moves(|moves| {
                nodes += moves.len() as u64;
                false
            });
        }
        _ => {
            board.generate_moves(|moves| {
                for mv in moves {
                    let mut child = board.clone();
                    child.play_unchecked(mv);
                    nodes += perft_inner(&child, depth - 1);
                }
                false
            });
        }
    }
    nodes
}

#[wasm_bindgen]
pub fn chess960_move_to_standard(board: &WpBoard, mv: &str) -> Result<String, JsError> {
    let board = &board.0;
    let mut mv = mv.parse::<Move>()?;
    if board.color_on(mv.from) == board.color_on(mv.to) {
        let rights = board.castle_rights(board.side_to_move());
        let file = if Some(mv.to.file()) == rights.short {
            File::G
        } else {
            File::C
        };
        mv.to = Square::new(file, mv.to.rank());
    }
    Ok(format!("{}", mv))
}
