'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import PoemSnapshot from './PoemSnapshot';

import { boardReducer, Actions, type BoardAction } from '../utils/actionHelpers';
import {
  clamp01_100,
  clientPointRect,
  createWord,
  getExistingWordRects,
  isOverlapping,
  sampleWords,
  type WordItem,
} from '../utils/boardHelpers';
import { createBoardSocketClient, throttleMs } from '../utils/realtimeHelpers';

type VisualMode = 'gradient' | 'front-camera' | 'back-camera' | 'white';
type PoemBoardProps = {
  isShared: boolean;
  boardId?: string;
};

export default function PoemBoard({ boardId, isShared }: PoemBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const deleteZoneRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamCaptureCanvasRef = useRef<HTMLCanvasElement>(null);

  const [words, dispatch] = useReducer(boardReducer, []);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [wordPool, setWordPool] = useState<string[]>([]);
  const [isInDeleteZone, setIsInDeleteZone] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualMode>('gradient');
  const [takeSnapshot, setTakeSnapshot] = useState(false);

  const [isWsSynced, setIsWsSynced] = useState(false);

  // realtime connection
  const rtRef = useRef<ReturnType<typeof createBoardSocketClient> | null>(null);
  const apply = useCallback((action: BoardAction) => {
    dispatch(action);
    rtRef.current?.sendAction(action);
  }, []);

  useEffect(() => {
    const url = "ws://localhost:8080";
    if (!boardId || !isShared) return;

    setIsWsSynced(false);
    rtRef.current?.close();

    rtRef.current = createBoardSocketClient({
      url,
      boardId,
      onAction: (a) => {
        dispatch(a);
        if (a.type === "SET_STATE") setIsWsSynced(true);
      },
    });

    return () => rtRef.current?.close();
  }, [boardId]);

  const sendMoveThrottled = useRef(
    throttleMs((id: string, x: number, y: number) => {
      rtRef.current?.sendAction(Actions.moveWord(id, x, y));
    }, 30)
  ).current;

  // word generation
  const generateWords = useCallback((count: number) => {
    if (!boardRef.current) return;
    if (!wordPool.length) return;

    const sampled = sampleWords(wordPool, count);

    // gather existing rects
    const rects = getExistingWordRects(boardRef.current);

    const newWords = sampled
      .map((text) =>
        createWord({
          text,
          existingRects: rects,
          boardEl: boardRef.current,
          measureEl: measureRef.current,
        })
      )
      .filter(Boolean) as WordItem[];

    if (newWords.length) apply(Actions.addWords(newWords));
  }, [wordPool, apply]);

  const generateWord = useCallback(() => generateWords(1), [generateWords]);

  const toggleVisualMode = () => {
    setVisualMode((prev) => {
      switch (prev) {
        case 'gradient': return 'front-camera';
        case 'front-camera': return 'back-camera';
        case 'back-camera': return 'white';
        case 'white': return 'gradient';
      }
    });
  };

  // load word pool
  useEffect(() => {
    fetch('/words.txt')
      .then((res) => res.text())
      .then((text) => {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        setWordPool(lines);
      });
  }, []);

  // camera background setup
  useEffect(() => {
    const video = videoRef.current;
    if (visualMode === 'front-camera' || visualMode === 'back-camera') {
      const facingMode = visualMode === 'front-camera' ? 'user' : 'environment';

      navigator.mediaDevices.getUserMedia({ video: { facingMode } })
        .then((stream) => {
          if (!video) return;
          video.srcObject = stream;

          video.addEventListener('loadedmetadata', () => {
            video.play().catch((err) => console.warn('Video play() failed:', err));
          }, { once: true });
        })
        .catch((err) => console.error('getUserMedia error:', err));
    }

    return () => {
      if (video?.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
        video.srcObject = null;
      }
    };
  }, [visualMode]);

  useEffect(() => {
    if (visualMode !== 'front-camera' && visualMode !== 'back-camera') return;

    const video = videoRef.current;
    const canvas = webcamCaptureCanvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = () => {
      if (video.readyState >= 2) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawFrame);
    };

    const tryStart = () => {
      if (video.videoWidth === 0) requestAnimationFrame(tryStart);
      else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        requestAnimationFrame(drawFrame);
      }
    };

    tryStart();
  }, [visualMode]);

  // generate initial words
  useEffect(() => {
    if (isShared && !isWsSynced) return; 
    if (words.length === 0 && wordPool.length > 0) {
      generateWords(9);
    }
  }, [isWsSynced, wordPool, words.length, generateWords]);

  // dragging handlers
  const handleMouseDown = (e: React.MouseEvent, word: WordItem) => {
    e.preventDefault();
    setDraggingId(word.id);

    const boardRect = boardRef.current?.getBoundingClientRect();
    const elRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!boardRect) return;

    const centerX = elRect.left + elRect.width / 2;
    const centerY = elRect.top + elRect.height / 2;
    setOffset({ x: e.clientX - centerX, y: e.clientY - centerY });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingId || !boardRef.current) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const rawX = e.clientX - boardRect.left - offset.x;
    const rawY = e.clientY - boardRect.top - offset.y;

    const x = clamp01_100((rawX / boardRect.width) * 100);
    const y = clamp01_100((rawY / boardRect.height) * 100);

    const deleteZone = deleteZoneRef.current?.getBoundingClientRect();
    const cursor = clientPointRect(e.clientX, e.clientY);
    setIsInDeleteZone(!!(deleteZone && isOverlapping(cursor, deleteZone)));

    // local smooth update
    dispatch(Actions.moveWord(draggingId, x, y));
    // network throttled update
    sendMoveThrottled(draggingId, x, y);
  }, [draggingId, offset, sendMoveThrottled]);

  const handleMouseUp = useCallback(() => {
    if (draggingId && isInDeleteZone) {
      apply(Actions.deleteWord(draggingId));
    }
    setDraggingId(null);
    setIsInDeleteZone(false);
  }, [draggingId, isInDeleteZone, apply]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // touch handlers
  const handleTouchStart = (e: React.TouchEvent, word: WordItem) => {
    e.preventDefault();
    setDraggingId(word.id);

    const boardRect = boardRef.current?.getBoundingClientRect();
    const elRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!boardRect) return;

    const touch = e.touches[0];
    const centerX = elRect.left + elRect.width / 2;
    const centerY = elRect.top + elRect.height / 2;
    setOffset({ x: touch.clientX - centerX, y: touch.clientY - centerY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!draggingId || !boardRef.current) return;

    const touch = e.touches[0];
    const boardRect = boardRef.current.getBoundingClientRect();

    const rawX = touch.clientX - boardRect.left - offset.x;
    const rawY = touch.clientY - boardRect.top - offset.y;

    const x = clamp01_100((rawX / boardRect.width) * 100);
    const y = clamp01_100((rawY / boardRect.height) * 100);

    const deleteZone = deleteZoneRef.current?.getBoundingClientRect();
    const cursor = clientPointRect(touch.clientX, touch.clientY);
    setIsInDeleteZone(!!(deleteZone && isOverlapping(cursor, deleteZone)));

    dispatch(Actions.moveWord(draggingId, x, y));
    sendMoveThrottled(draggingId, x, y);
  };

  const handleTouchEnd = () => {
    if (draggingId && isInDeleteZone) {
      apply(Actions.deleteWord(draggingId));
    }
    setDraggingId(null);
    setIsInDeleteZone(false);
  };

  return (
    <div ref={scrollContainerRef} className="w-full h-[100svh] flex justify-center items-center overflow-hidden">
      <div className="w-[min(85vw,65vh)] h-auto flex flex-col items-center justify-center gap-2 user-select-none">
        {/* top bar */}
        <div className="w-full flex flex-row justify-between items-center font-bold">
          <Link href="/" className="flex-shrink-0 select-none cursor-pointer"><h2>magnet poetry</h2></Link>
          <div className="flex w-full border-b bg-neutral-100 border-dotted mx-2" />
          <div className="flex flex-shrink-0 gap-2">
            <button onClick={toggleVisualMode} className="flex-shrink-0 text-white bg-black hover:bg-neutral-500">
              	&#8644; {visualMode}
            </button>
            <button onClick={() => setTakeSnapshot(true)} className="flex-shrink-0">
              save as image
            </button>
          </div>
        </div>

        {/* board */}
        <div
          ref={boardRef}
          id="exportable-board"
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '3 / 4',
            backgroundColor: '#f5f5f5',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          <div ref={measureRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
            <div className="magnet" style={{ position: 'absolute', userSelect: 'none' }} />
          </div>

          {words.map((word) => (
            <div
              key={word.id}
              onMouseDown={(e) => handleMouseDown(e, word)}
              onTouchStart={(e) => handleTouchStart(e, word)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="magnet"
              style={{
                position: 'absolute',
                left: `${word.xPercent}%`,
                top: `${word.yPercent}%`,
                transform: `translate(-50%, -50%) scale(${word.id === draggingId && isInDeleteZone ? 1 - word.yPercent / 250 : 1})`,
                transition: 'transform 0.1s ease',
                rotate: `${word.rotate}deg`,
                zIndex: word.id === draggingId ? 10 : 1,
              }}
            >
              <span className="magnet-inner">{word.text}</span>
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
            }}
          />

          {/* background */}
          {visualMode === 'gradient' && (
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
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#ffffff', zIndex: 0 }} />
          )}

          {(visualMode === 'front-camera' || visualMode === 'back-camera') && (
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
          )}

          <div className="noise-bg" />
        </div>

        {/* bottom bar */}
        <div className="w-full flex flex-row gap-2 font-bold justify-between">
          <div className="flex flex-row gap-[1svh]">
            <input
              type="text"
              placeholder="+ word"
              className="bg-neutral-200"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const text = e.currentTarget.value.trim();
                if (!text || !boardRef.current) return;

                const rects = getExistingWordRects(boardRef.current);
                const w = createWord({
                  text,
                  existingRects: rects,
                  boardEl: boardRef.current,
                  measureEl: measureRef.current,
                });

                if (w) apply(Actions.addWord(w));
                e.currentTarget.value = '';
              }}
            />
            <button onClick={generateWord} className="bg-neutral-200 hover:bg-neutral-300">+1</button>
            <button onClick={() => generateWords(3)} className="bg-neutral-200 hover:bg-neutral-300">+3</button>
          </div>
          <button
            onClick={() => apply(Actions.reset())}
            className="bg-black text-white hover:bg-neutral-500 transition-colors"
          >
            restart
          </button>
        </div>

        <div className="h-5 w-full" />
      </div>

      {takeSnapshot && (
        <PoemSnapshot
          words={words}
          webcamVideo={(visualMode === 'front-camera' || visualMode === 'back-camera') ? videoRef.current : null}
          backgroundImage={visualMode === 'gradient' ? '/red-grad-animated.svg' : undefined}
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
