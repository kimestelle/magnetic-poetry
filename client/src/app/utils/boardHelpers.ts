export type WordItem = {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  rotate: number;
};

export function isOverlapping(rect1: DOMRect, rect2: DOMRect): boolean {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  );
}

export function clamp01_100(n: number): number {
  return Math.min(Math.max(n, 0), 100);
}

export function clientPointRect(clientX: number, clientY: number): DOMRect {
  return new DOMRect(clientX, clientY, 1, 1);
}

export function getExistingWordRects(boardEl: HTMLElement): DOMRect[] {
  const wordEls = boardEl.querySelectorAll(".magnet");
  return Array.from(wordEls).map((el) => el.getBoundingClientRect());
}

//find unoccupied position for a new word
export function findValidPosition(opts: {
  measureEl: HTMLElement | null; // ghost magnet container
  boardEl: HTMLElement | null;
  existingRects: DOMRect[];
  wordText: string;
  tries?: number;
}): { xPercent: number; yPercent: number } | null {
  const { measureEl, boardEl, existingRects, wordText, tries = 100 } = opts;
  if (!measureEl || !boardEl) return null;

  const ghost = measureEl.firstElementChild as HTMLElement | null;
  if (!ghost) return null;

  ghost.textContent = wordText;

  const ghostRect = ghost.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();

  for (let i = 0; i < tries; i++) {
    const x = 25 + Math.random() * 50;
    const y = 25 + Math.random() * 50;

    const left = (x / 100) * boardRect.width - ghostRect.width / 2;
    const top = (y / 100) * boardRect.height - ghostRect.height / 2;

    const newRect = new DOMRect(left, top, ghostRect.width, ghostRect.height);
    const overlaps = existingRects.some((rect) => isOverlapping(rect, newRect));
    if (!overlaps) return { xPercent: x, yPercent: y };
  }

  return null;
}

export function makeWordId(text: string): string {
  return `${text}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWord(opts: {
  text: string;
  existingRects: DOMRect[];
  boardEl: HTMLElement | null;
  measureEl: HTMLElement | null;
  xPercent?: number;
  yPercent?: number;
  rotate?: number;
  id?: string;
}): WordItem | null {
  const {
    text,
    existingRects,
    boardEl,
    measureEl,
    xPercent,
    yPercent,
    rotate,
    id,
  } = opts;

  const pos =
    xPercent !== undefined && yPercent !== undefined
      ? { xPercent, yPercent }
      : findValidPosition({ measureEl, boardEl, existingRects, wordText: text });

  if (!pos) return null;

  return {
    id: id ?? makeWordId(text),
    text,
    xPercent: pos.xPercent,
    yPercent: pos.yPercent,
    rotate: rotate ?? Math.random() * 6 - 3,
  };
}

export function sampleWords(pool: string[], count: number): string[] {
  if (!pool.length || count <= 0) return [];
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
  }
  return result;
}
