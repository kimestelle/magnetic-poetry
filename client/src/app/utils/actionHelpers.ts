import type { WordItem } from "./boardHelpers";

export type BoardAction =
  | { type: "SET_STATE"; words: WordItem[] }
  | { type: "ADD_WORD"; word: WordItem }
  | { type: "ADD_WORDS"; words: WordItem[] }
  | { type: "MOVE_WORD"; id: string; xPercent: number; yPercent: number }
  | { type: "DELETE_WORD"; id: string }
  | { type: "RESET" };

// centralize word state management
export function boardReducer(state: WordItem[], action: BoardAction): WordItem[] {
  switch (action.type) {
    case "SET_STATE":
      return action.words;

    case "ADD_WORD":
      return [...state, action.word];

    case "ADD_WORDS":
      return [...state, ...action.words];

    case "MOVE_WORD":
      return state.map((w) =>
        w.id === action.id
          ? { ...w, xPercent: action.xPercent, yPercent: action.yPercent }
          : w
      );

    case "DELETE_WORD":
      return state.filter((w) => w.id !== action.id);

    case "RESET":
      return [];

    default:
      return state;
  }
}

export const Actions = {
    setState: (words: WordItem[]) => ({ type: "SET_STATE", words }),
    addWord: (word: WordItem): BoardAction => ({ type: "ADD_WORD", word }),
    addWords: (words: WordItem[]): BoardAction => ({ type: "ADD_WORDS", words }),
    moveWord: (id: string, xPercent: number, yPercent: number): BoardAction => ({
        type: "MOVE_WORD",
        id,
        xPercent,
        yPercent,
    }),
    deleteWord: (id: string): BoardAction => ({ type: "DELETE_WORD", id }),
    reset: (): BoardAction => ({ type: "RESET" }),
} as const;
