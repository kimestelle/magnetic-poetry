'use client';

import { useEffect, useRef } from 'react';

type WordItem = {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  rotate: number;
};

type VisualMode = 'image' | 'front-camera' | 'back-camera' | 'white';

type Props = {
  words: WordItem[];
  backgroundImage?: string;
  webcamVideo?: HTMLVideoElement | null;
  visualMode?: VisualMode;
  width?: number;
  height?: number;
  onCapture?: (dataUrl: string) => void;
};

export default function PoemSnapshot({
  words,
  backgroundImage,
  webcamVideo,
  visualMode = 'image',
  width = 1080,
  height = 1440,
  onCapture,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasCapturedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const fontSize = Math.min(width * 0.03, height * 0.0225) * 1.1;

    const paddingX = fontSize * 0.2;
    const paddingY = fontSize * 0.3;

    ctx.font = `${fontSize}px "EB Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const drawNoise = () => {
    const noise = new Image();
    noise.onload = () => {
        const scale = 2 * dpr;; // tile size scale

        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = noise.width * scale;
        patternCanvas.height = noise.height * scale;

        const pctx = patternCanvas.getContext('2d');
        if (!pctx) return;


        pctx.drawImage(noise, 0, 0, patternCanvas.width, patternCanvas.height);

        const pattern = ctx.createPattern(patternCanvas, 'repeat');
        if (!pattern) return;

        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        drawWords();
    };
    noise.src = '/noise.png';
    };

    const drawWords = () => {
      for (const word of words) {
        const x = (word.xPercent / 100) * width;
        const y = (word.yPercent / 100) * height;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((word.rotate * Math.PI) / 180);

        const textMetrics = ctx.measureText(word.text);
        const textWidth = textMetrics.width;
        const boxWidth = textWidth + 2 * paddingX;
        const boxHeight = fontSize + 2 * paddingY;

        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowOffsetX = 0.1 * fontSize;
        ctx.shadowOffsetY = 0.15 * fontSize;
        ctx.shadowBlur = 0;
        ctx.fillRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#ededed';
        ctx.lineWidth = 0.1 * fontSize * dpr;
        ctx.strokeRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);

        ctx.fillStyle = 'black';
        ctx.fillText(word.text, 0, 0);

        ctx.restore();
      }

      if (onCapture && !hasCapturedRef.current) {
        hasCapturedRef.current = true;
        onCapture(canvas.toDataURL('image/png'));
      }
    };

    function drawInnerGlow() {
        const glowInset = fontSize * 0.25; // adjust based on your desired thickness
        const glowWidth = width - glowInset * 2;
        const glowHeight = height - glowInset * 2;

        if (!ctx) return;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.shadowColor = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = fontSize * 3 * dpr;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillRect(glowInset, glowInset, glowWidth, glowHeight);

        ctx.restore();
    }
    drawInnerGlow();

    const drawCoverImage = (
      source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
      mirror = false
    ) => {
      const rawWidth =
        source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const rawHeight =
        source instanceof HTMLVideoElement ? source.videoHeight : source.height;

      const imgRatio = rawWidth / rawHeight;
      const canvasRatio = width / height;

      let sx = 0,
        sy = 0,
        sw = rawWidth,
        sh = rawHeight;

      if (imgRatio > canvasRatio) {
        sw = sh * canvasRatio;
        sx = (rawWidth - sw) / 2;
      } else {
        sh = sw / canvasRatio;
        sy = (rawHeight - sh) / 2;
      }

      ctx.save();
      ctx.filter = `blur(${18 * dpr}px)`;
      if (mirror) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
      ctx.restore();
    };

    const drawBackground = () => {
      if (
        webcamVideo &&
        webcamVideo.readyState >= 2 &&
        webcamVideo.videoWidth > 0 &&
        webcamVideo.videoHeight > 0
      ) {
        drawCoverImage(webcamVideo, visualMode === 'front-camera');
        drawNoise();
      } else if (visualMode.includes('camera') && webcamVideo) {
        setTimeout(drawBackground, 100);
      } else if (backgroundImage) {
        const bg = new Image();
        bg.crossOrigin = 'anonymous';
        bg.onload = () => {
          drawCoverImage(bg);
          drawNoise();
        };
        bg.src = backgroundImage;
      } else {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);
        drawNoise();
      }
    };

    drawBackground();
  }, [words, backgroundImage, webcamVideo, width, height, onCapture, visualMode]);

  return <canvas ref={canvasRef} style={{ display: 'none' }} />;
}
