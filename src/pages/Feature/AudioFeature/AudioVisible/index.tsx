import { ProCard } from '@ant-design/pro-components';
import { Button } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Timeline from 'wavesurfer.js/plugins/timeline';

import { AudioVisibleStyles } from './AudioVisible.style';

// WaveSurfer hook
const useWavesurfer = (containerRef, options) => {
  const [wavesurfer, setWavesurfer] = useState(null);

  // Initialize wavesurfer when the container mounts
  // or any of the props change
  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      ...options,
      container: containerRef.current,
    });

    setWavesurfer(ws);

    return () => {
      ws.destroy();
    };
  }, [options, containerRef]);

  return wavesurfer;
};

// Create a React component that will render wavesurfer.
// Props are wavesurfer options.
const WaveSurferPlayer = (props: any) => {
  const containerRef = useRef();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const wavesurfer = useWavesurfer(containerRef, props);

  // On play button click
  const onPlayClick = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    wavesurfer.isPlaying() ? wavesurfer.pause() : wavesurfer.play();
  }, [wavesurfer]);

  // Initialize wavesurfer when the container mounts
  // or any of the props change
  useEffect(() => {
    if (!wavesurfer) return;

    setCurrentTime(0);
    setIsPlaying(false);

    const subscriptions = [
      wavesurfer.on('play', () => setIsPlaying(true)),
      wavesurfer.on('pause', () => setIsPlaying(false)),
      wavesurfer.on('timeupdate', (currentTime) => setCurrentTime(currentTime)),
    ];

    return () => {
      subscriptions.forEach((unsub) => unsub());
    };
  }, [wavesurfer]);

  return (
    <>
      <div ref={containerRef} style={{ minHeight: '120px' }} />

      <Button className="mt-8 mb-8" onClick={onPlayClick} style={{ marginTop: '1em' }}>
        {isPlaying ? '暂停' : '播放'}
      </Button>

      <p className="mb-6">秒: {currentTime}</p>
    </>
  );
};

export default function AudioVisible() {
  const urls = ['/audio/audio.wav', '/audio/stereo.mp3'];
  const [audioUrl, setAudioUrl] = useState(urls[0]);

  // Swap the audio URL
  const onUrlChange = useCallback(() => {
    urls.reverse();
    setAudioUrl(urls[0]);
  }, []);

  return (
    <AudioVisibleStyles>
      <ProCard className="shadow-2xl">
        <h1 className="mb-8">wavesurfer.js 实现</h1>
        <WaveSurferPlayer
          height={100}
          waveColor="rgb(200, 0, 200)"
          progressColor="rgb(100, 0, 100)"
          url={audioUrl}
          plugins={[Timeline.create()]}
        />

        <Button onClick={onUrlChange}>改变音频</Button>
      </ProCard>
    </AudioVisibleStyles>
  );
}
