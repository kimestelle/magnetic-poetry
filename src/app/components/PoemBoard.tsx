'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export type WordItem = {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  rotate: number;
  font: string;
};


function BrushedMetalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const webcamTexture = gl.createTexture();

    const baseColorTex = loadTexture(gl, "/textures/metal_0026_color_1k.jpg");
    const normalTex     = loadTexture(gl, "/textures/metal_0026_normal_opengl_1k.png");
    const roughnessTex  = loadTexture(gl, "/textures/metal_0026_roughness_1k.jpg");
    const metallicTex   = loadTexture(gl, "/textures/metal_0026_metallic_1k.jpg");
    const aoTex         = loadTexture(gl, "/textures/metal_0026_ao_1k.jpg");

    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const video = videoRef.current;
    if (!video) return;

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      video.srcObject = stream;
      video.play();
    });

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const vertexShaderSource = `
      attribute vec2 position;
      varying vec2 uv;
      void main() {
        uv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;

      uniform sampler2D uWebcam;
      uniform sampler2D uBaseColor;
      uniform sampler2D uNormalMap;
      uniform sampler2D uRoughnessMap;
      uniform sampler2D uMetallicMap;
      uniform sampler2D uAOMap;

      uniform vec3 uLightDir;
      varying vec2 uv;


void main() {
    vec2 st = uv;
    float centerFade = 1.0 - smoothstep(0.0, 0.6, distance(st, vec2(0.5)));

    vec3 camColor = texture2D(uWebcam, st).rgb;
    vec3 baseColor = texture2D(uBaseColor, st).rgb;
    // float webcamBlend = 0.15 * centerFade;
    // baseColor = mix(baseColor, camColor, webcamBlend);

    float roughness = texture2D(uRoughnessMap, st).r;
    float metallic = texture2D(uMetallicMap, st).r;
    vec3 ao = texture2D(uAOMap, st).rgb;

    // Decode normal from OpenGL-style normal map
    // Sample normal map and unpack from [0,1] to [-1,1]
    vec3 tangentNormal = texture2D(uNormalMap, st).rgb * 2.0 - 1.0;
    vec3 normal = normalize(vec3(tangentNormal.xy * 0.6, tangentNormal.z));
    vec3 lightDir = normalize(uLightDir);
    vec3 eyeDir = vec3(0.0, 0.0, 1.0);
    vec3 halfVec = normalize(lightDir + eyeDir);

    float diffuse = max(dot(normal, lightDir), 0.0);
    float spec = pow(max(dot(normal, halfVec), 0.0), mix(10.0, 100.0, 1.0 - roughness));
    spec *= (1.0 - roughness); // rougher = less shine

    // Combine lighting
    vec3 color = baseColor * diffuse + spec * vec3(1.0) * metallic;
    // color *= ao;

    gl_FragColor = vec4(color, 1.0);

}


    `;

    function compileShader(source: string, type: number) {
      if (!gl) return null;
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram()!;
    // Upload webcam every frame
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // Static textures — loaded at init
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, baseColorTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalTex);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, roughnessTex);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, metallicTex);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, aoTex);


    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "uWebcam"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "uBaseColor"), 1);
    gl.uniform1i(gl.getUniformLocation(program, "uNormalMap"), 2);
    gl.uniform1i(gl.getUniformLocation(program, "uRoughnessMap"), 3);
    gl.uniform1i(gl.getUniformLocation(program, "uMetallicMap"), 4);
    gl.uniform1i(gl.getUniformLocation(program, "uAOMap"), 5);


    const uLightDirLocation = gl.getUniformLocation(program, "uLightDir");
    gl.uniform3fv(uLightDirLocation, new Float32Array([0.3, 0.3, 1.0]));

    const webcamLocation = gl.getUniformLocation(program, "uWebcam");
    gl.uniform1i(webcamLocation, 0);

    const positionLocation = gl.getAttribLocation(program, "position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1
      ]),
      gl.STATIC_DRAW
    );

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    function render() {
      if (!gl || !video) return;
      if (video.readyState >= 2) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          video
        );
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }
    render();
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />
      <video ref={videoRef} style={{ display: "none"}} playsInline autoPlay muted />
    </>
  );
}


export default function PoemBoard() {
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [wordPool, setWordPool] = useState<string[]>([]);

  const fonts = useMemo(
    () => ({
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    }),
    []
  );

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
        <BrushedMetalCanvas />
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
function loadTexture(gl: WebGLRenderingContext, url: string): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;

  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Placeholder pixel while image loads
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([128, 128, 128, 255])
  );

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  image.src = url;

  return texture;
}

