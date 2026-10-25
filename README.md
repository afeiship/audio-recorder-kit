# audio-recorder-kit
> Browser audio recorder with realtime waveform callback.

[![version][version-image]][version-url]
[![license][license-image]][license-url]
[![download][download-image]][download-url]

## installation
```shell
yarn add @jswork/audio-recorder-kit
```

## usage
```typescript
import AudioRecorder from '@jswork/audio-recorder-kit';

if (!AudioRecorder.isSupported()) return;

const recorder = new AudioRecorder({
  sampleRate: 16000,
  sampleBits: 16,
  numChannels: 1,
  maxDuration: 60_000, // auto stop at 60s
  onTimeUpdate: (duration) => console.log(duration), // ms
  onWaveDataUpdate: ({ vol, waveData, duration }) => {
    // waveData: Uint8Array(1024), 0 ~ 255, 128 is the midline
  },
  onMaxReach: () => console.log('max duration reached'),
  onError: (err) => console.error(err.code),
});

await recorder.start();
recorder.pause();
recorder.resume();

const { blob, file, url, duration } = await recorder.stop({ filename: 'demo.wav' });
await recorder.destroy();

// permission check
const state = await AudioRecorder.checkPermission(); // 'granted' | 'denied' | 'prompt'
```

## api
| member | description |
|---|---|
| `AudioRecorder.isSupported()` | whether the browser supports recording |
| `AudioRecorder.checkPermission()` | query microphone permission |
| `recorder.start()` | start recording |
| `recorder.pause()` / `recorder.resume()` | pause / resume |
| `recorder.stop(options?)` | stop, returns `{ blob, file, url, duration }` |
| `recorder.destroy()` | release resources |
| `recorder.state` | `idle \| recording \| paused \| stopped \| destroyed` |
| `recorder.duration` | current duration in ms |

## license
Code released under [the MIT license](https://github.com/afeiship/audio-recorder-kit/blob/main/LICENSE.txt).

[version-image]: https://img.shields.io/npm/v/@jswork/audio-recorder-kit
[version-url]: https://npmjs.org/package/@jswork/audio-recorder-kit

[license-image]: https://img.shields.io/npm/l/@jswork/audio-recorder-kit
[license-url]: https://github.com/afeiship/audio-recorder-kit/blob/main/LICENSE.txt

[download-image]: https://img.shields.io/npm/dm/@jswork/audio-recorder-kit
[download-url]: https://www.npmjs.com/package/@jswork/audio-recorder-kit
