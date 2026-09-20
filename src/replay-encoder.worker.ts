import { REPLAY_WIDTH, REPLAY_HEIGHT } from './death-replay.ts';

const canvas = new OffscreenCanvas(REPLAY_WIDTH, REPLAY_HEIGHT);
const ctx = canvas.getContext('2d', { alpha: false })!;
const scope = self as unknown as {
  onmessage: (event: MessageEvent<{ id: number; bitmap: ImageBitmap }>) => void;
  postMessage: (data: { id: number; blob: Blob | null }) => void;
};
// Serial processing keeps the final death frame from replacing pixels while
// the previous JPEG is being encoded. The caller bounds the queue to two jobs.
let queue = Promise.resolve();
scope.onmessage = ({ data: { id, bitmap } }) => {
  queue = queue
    .then(async () => {
      let blob: Blob | null = null;
      try {
        const fit = Math.min(REPLAY_WIDTH / bitmap.width, REPLAY_HEIGHT / bitmap.height);
        ctx.fillStyle = '#14181a';
        ctx.fillRect(0, 0, REPLAY_WIDTH, REPLAY_HEIGHT);
        ctx.drawImage(
          bitmap,
          (REPLAY_WIDTH - bitmap.width * fit) / 2,
          (REPLAY_HEIGHT - bitmap.height * fit) / 2,
          bitmap.width * fit,
          bitmap.height * fit,
        );
        blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      } finally {
        bitmap.close();
        scope.postMessage({ id, blob });
      }
    })
    .catch(() => {});
};
