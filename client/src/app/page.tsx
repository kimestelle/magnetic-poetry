'use client'
import { useState } from 'react';

import Link from 'next/link';

export default function HomePage() {
  const [openCollabModal, setOpenCollabModal] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  function handleCollabClick() {
    setOpenCollabModal(true);
  }

  return (
    <main
      className='relative flex flex-col items-center justify-center gap-8'
    >
      <section className='-mt-14'>
        <h1>
          magnet poetry
        </h1>
      </section>
      <div className='relative flex flex-row items-center justify-center gap-4'>
        <Link href='/poem' className='magnet-inner -rotate-4 -translate-y-1'>
          start
        </Link>
        <button onClick={handleCollabClick} className='magnet-inner rotate-2'>
          collaborate
        </button>
        {openCollabModal && (
          <div className='absolute top-16 w-max max-w-[90svw] flex flex-col justify-center items-center gap-4'>
            <div className='flex flex-row gap-4'>
            <input
              type='text'
              value={roomId || ''}
              placeholder='room ID'
              onChange={(e) => setRoomId(e.target.value)}
              className='magnet-inner rotate-1'
            />
            <Link
              href={roomId ? `/poem/${roomId}` : '#'}
              className='magnet-inner'
              onClick={() => setOpenCollabModal(false)}
            >
              join
            </Link>
          </div>
          <ul className="w-full">
            <li>share a room ID to join the same board.</li>
            <li>ephemeral data: nothing is persisted.</li>
            <li>background + webcam never leave your device.</li>
          </ul>
          </div>
        )}

      </div>

      <span className='absolute bottom-6'>
        made with love by <a href="https://www.estellekimdev.com" target="_blank">estelle kim</a>
      </span>

      <div className="noise-bg" />
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
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
    </main> 
  );
}
