'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type WordItem = {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  rotate: number;
  font: string;
};


export default function PoemBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [wordPool, setWordPool] = useState<string[]>([]);


  const isOverlapping = (rect1: DOMRect, rect2: DOMRect): boolean => {
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    );
  };

  const findValidPosition = useCallback((existingRects: DOMRect[], wordText: string): { xPercent: number; yPercent: number } | null => {
    if (!measureRef.current || !boardRef.current) return null;

    const ghost = measureRef.current.firstElementChild as HTMLElement;
    ghost.textContent = wordText;
    const ghostRect = ghost.getBoundingClientRect();
    const boardRect = boardRef.current.getBoundingClientRect();

    for (let i = 0; i < 100; i++) {
      const x = 25 + Math.random() * 50;
      const y = 25 + Math.random() * 50;

      const left = (x / 100) * boardRect.width - ghostRect.width / 2;
      const top = (y / 100) * boardRect.height - ghostRect.height / 2;

      const newRect = new DOMRect(left, top, ghostRect.width, ghostRect.height);
      const overlaps = existingRects.some((rect) => isOverlapping(rect, newRect));
      if (!overlaps) return { xPercent: x, yPercent: y };
    }

    return null;
  }, []);

  const sampleWords = (pool: string[], count: number): string[] => {
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      result.push(pool[randomIndex]);
    }
    return result;
  };

  const createWord = useCallback((text: string, rects: DOMRect[], x?: number, y?: number): WordItem | null => {
    const pos = findValidPosition(rects, text);
    if (!pos) return null;
    return {
      id: `${text}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      xPercent: x !== undefined ? x : pos.xPercent,
      yPercent: y !== undefined ? y : pos.yPercent,
      rotate: Math.random() * 6 - 3,
      font: 'serif',
    };
  }, [findValidPosition]);

  const generateWords = useCallback(() => {
    if (!boardRef.current) return;
    const wordEls = boardRef.current.querySelectorAll('.magnet');
    const rects = Array.from(wordEls).map((el) => el.getBoundingClientRect());
    const sampled = sampleWords(wordPool, 8);
    const newWords = sampled.map((word) => createWord(word, rects)).filter(Boolean) as WordItem[];
    setWords((prev) => [...prev, ...newWords]);
  }, [wordPool, createWord]);

  const generateWord = useCallback(() => {
    if (!boardRef.current) return;
    const wordEls = boardRef.current.querySelectorAll('.magnet');
    const rects = Array.from(wordEls).map((el) => el.getBoundingClientRect());
    const sampled = sampleWords(wordPool, 1)[0];
    const newWord = createWord(sampled, rects);
    if (newWord) setWords((prev) => [...prev, newWord]);
  }, [wordPool, createWord]);

  useEffect(() => {
    fetch('/words.txt')
      .then((res) => res.text())
      .then((text) => {
        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        setWordPool(lines);
      });
  }, []);

  useEffect(() => {
    if (words.length === 0 && wordPool.length > 0) generateWords();
  }, [wordPool, words, generateWords]);

  const handleMouseDown = (e: React.MouseEvent, word: WordItem) => {
    e.preventDefault();
    setDraggingId(word.id);

    const boardRect = boardRef.current?.getBoundingClientRect();
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect();

    if (boardRect) {
      const centerX = el.left + el.width / 2;
      const centerY = el.top + el.height / 2;
      setOffset({ x: e.clientX - centerX, y: e.clientY - centerY });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingId || !boardRef.current) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const rawX = e.clientX - boardRect.left - offset.x;
    const rawY = e.clientY - boardRect.top - offset.y;

    const x = (rawX / boardRect.width) * 100;
    const y = (rawY / boardRect.height) * 100;

    setWords((prev) =>
      prev.map((word) =>
        word.id === draggingId ? {
          ...word,
          xPercent: Math.min(Math.max(x, 0), 100),
          yPercent: Math.min(Math.max(y, 0), 100),
        } : word
      )
    );
  }, [draggingId, offset]);

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={scrollContainerRef} className="w-full h-[100svh] flex justify-center items-center overflow-hidden">
      <div className="absolute top-0 left-1/2 z-10 translate-x-1/2 flex gap-4">
        <button onClick={generateWords} className="circle-button">15</button>
        <button onClick={generateWord} className="circle-button">1</button>
      </div>

      <div
        ref={boardRef}
        className="relative aspect-[3/4] w-[min(100vw,75vh)] bg-neutral-100"
      >
        <div ref={measureRef} className="absolute opacity-0 pointer-events-none">
          <div className="magnet absolute" />
        </div>

        {words.map((word) => (
          <div
            key={word.id}
            onMouseDown={(e) => handleMouseDown(e, word)}
            className="magnet absolute"
            style={{
              left: `${word.xPercent}%`,
              top: `${word.yPercent}%`,
              transform: `translate(-50%, -50%)`,
              fontFamily: word.font,
              rotate: `${word.rotate}deg`, // use 'rotate' shorthand for cleaner separation
            }}
          >
            <span className="magnet-inner">{word.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

