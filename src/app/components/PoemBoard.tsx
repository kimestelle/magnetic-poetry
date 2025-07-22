'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PoemSnapshot from './PoemSnapshot';

export type WordItem = {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  rotate: number;
};

type VisualMode = 'image' | 'front-camera' | 'back-camera' | 'white';

export default function PoemBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [wordPool, setWordPool] = useState<string[]>([]);
  const deleteZoneRef = useRef<HTMLDivElement>(null);
  const [isInDeleteZone, setIsInDeleteZone] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualMode>('image');
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamCaptureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [takeSnapshot, setTakeSnapshot] = useState(false);

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
    };
  }, [findValidPosition]);

  const generateWords = useCallback(() => {
    if (!boardRef.current) return;
    const wordEls = boardRef.current.querySelectorAll('.magnet');
    const rects = Array.from(wordEls).map((el) => el.getBoundingClientRect());
    const sampled = sampleWords(wordPool, 3);
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

  const toggleVisualMode = () => {
    setVisualMode((prev) => {
      switch (prev) {
        case 'image': return 'front-camera';
        case 'front-camera': return 'back-camera';
        case 'back-camera': return 'white';
        case 'white': return 'image';
      }
    });
  };


  useEffect(() => {
    fetch('/words.txt')
      .then((res) => res.text())
      .then((text) => {
        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        setWordPool(lines);
      });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (visualMode === 'front-camera' || visualMode === 'back-camera') {
      const facingMode = visualMode === 'front-camera' ? 'user' : 'environment';

      navigator.mediaDevices.getUserMedia({ video: { facingMode } })
        .then((stream) => {
          if (video) {
            video.srcObject = stream;

            // wait for video to load before playing
            const playPromise = new Promise<void>((resolve) => {
              const onLoaded = () => {
                video.play().catch((err) => {
                  console.warn('Video play() failed:', err);
                });
                resolve();
              };
              video.addEventListener('loadedmetadata', onLoaded, { once: true });
            });

            return playPromise;
          }
        })
        .catch((err) => console.error('getUserMedia error:', err));
    }

    return () => {
      if (video?.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
        video.srcObject = null;
      }
    };
  }, [visualMode]);


  useEffect(() => {
    if (
      visualMode !== 'front-camera' &&
      visualMode !== 'back-camera'
    ) return;

    const video = videoRef.current;
    const canvas = webcamCaptureCanvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = () => {
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      requestAnimationFrame(drawFrame);
    };

    const tryStart = () => {
      if (video.videoWidth === 0) {
        requestAnimationFrame(tryStart);
      } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        requestAnimationFrame(drawFrame);
      }
    };

    tryStart();
  }, [visualMode]);

  useEffect(() => {
    if (words.length === 0 && wordPool.length > 0) {
      generateWords();
      generateWords();
      generateWords();
    }
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

      const deleteZone = deleteZoneRef.current?.getBoundingClientRect();
      const cursorPoint = new DOMRect(e.clientX, e.clientY, 1, 1);
      if (deleteZone && isOverlapping(cursorPoint, deleteZone)) {
        setIsInDeleteZone(true);
      } else {
        setIsInDeleteZone(false);
      }

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
    if (isInDeleteZone && draggingId) {
      setWords((prev) => prev.filter((w) => w.id !== draggingId));
    }
    setDraggingId(null);
    setIsInDeleteZone(false);
  }, [draggingId, isInDeleteZone]);

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
      {/* outer wrapper */}
      <div className="w-[min(85vw,65vh)] h-auto flex flex-col items-center justify-center gap-2">
        {/* top bar */}
        <div className="w-full flex flex-row justify-between items-center font-bold">
          <h2 className='flex-shrink-0'>
            magnet poetry
          </h2>
          <div className='flex w-full border-b bg-neutral-100 border-dotted mx-2'/>
          <div className ="flex flex-shrink-0 gap-2">
            <button 
              onClick={() => toggleVisualMode()} 
              className="flex-shrink-0 text-neutral-400">
              {visualMode}
            </button>
            <button
              onClick={() => setTakeSnapshot(true)}
              className="flex-shrink-0"
            >
             save image
            </button>
        </div>
        </div>
        {/* aspect-ratio-constrained board */}
        <div
          ref={boardRef}
          id="exportable-board"
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '3 / 4',
            backgroundColor: '#f5f5f5', 
            overflow: 'hidden',
          }}
        >
          <div ref={measureRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
            <div className="magnet" style={{ position: 'absolute' }} />
          </div>

          {words.map((word) => (
            <div
              key={word.id}
              onMouseDown={(e) => handleMouseDown(e, word)}
              className="magnet"
              style={{
                position: 'absolute',
                left: `${word.xPercent}%`,
                top: `${word.yPercent}%`,
                transform: `translate(-50%, -50%) scale(${
                  word.id === draggingId && isInDeleteZone ? 1 - word.yPercent / 250 : 1
                })`,
                transition: 'transform 0.1s ease',
                rotate: `${word.rotate}deg`,
                zIndex: word.id === draggingId ? 10 : 1,
              }}
            >
              <span className='magnet-inner'>{word.text}</span>
            </div>
          ))}

          <div
            ref={deleteZoneRef}
            style={{
              position: 'absolute',
              bottom: '-20%',
              left: 0,
              width: '100%',
              height: '25%',
              zIndex: 10,
              pointerEvents: 'none',
              display: 'none', // hide from snapshot
            }}
          />

          {/* Static background */}
          {visualMode === 'image' && (
            <img
              src="/red-grad-animated.svg"
              alt="background"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(18px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
          )}

          {visualMode === 'white' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#ffffff',
                zIndex: 0,
              }}
            />
          )}

          {visualMode === 'front-camera' || visualMode === 'back-camera' ? (
            <>
            <video
              ref={videoRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(8px)',
                transform: visualMode === 'front-camera' ? 'scaleX(-1)' : 'none',
                zIndex: 0,
                pointerEvents: 'none',
              }}
              autoPlay
              muted
              playsInline
            />
            <canvas
              ref={webcamCaptureCanvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(8px)',
                opacity: 0.4,
                transform: visualMode === 'front-camera' ? 'scaleX(-1)' : 'none',
                zIndex: 0,
              }}
            />
            </>
          ) : null}
          <div className='noise-bg'/>
        </div>


        {/* bottom bar */}
        <div className="w-full flex flex-row gap-2 font-bold justify-between">
          <div className="flex flex-row gap-1.5">
            <input 
              type="text"
              placeholder="+ word"
              className="bg-neutral-200 shadow px-1 rounded"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  const newWord = createWord(e.currentTarget.value.trim(), []);
                  if (newWord) setWords((prev) => [...prev, newWord]);
                  e.currentTarget.value = '';
                }
              }}
            />
          <button
            onClick={() => generateWord}
            className="bg-neutral-100 shadow hover:bg-neutral-200 px-1 rounded"
          >
            +1
          </button>
          <button
            onClick={() => generateWords}
            className="bg-neutral-100 shadow hover:bg-neutral-200 px-1 rounded"
          >
            +3
          </button>
          </div>
          <button
            onClick={() => setWords([])}
            className="bg-black text-white px-2 rounded hover:bg-neutral-500 transition-colors"
          >
            restart
          </button>
        </div>

        <div className="h-5 w-full "></div>
      </div>

      {takeSnapshot && (
  <PoemSnapshot
    words={words}
    webcamVideo={
      visualMode === 'front-camera' || visualMode === 'back-camera'
        ? videoRef.current
        : null
    }
    backgroundImage={
      visualMode === 'image' ? '/red-grad-animated.svg' : undefined
    }
    visualMode={visualMode}
    onCapture={(dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'magnet-poem.png';
      a.click();
      setTakeSnapshot(false);
    }}
  />
)}

    </div>
  );
}

