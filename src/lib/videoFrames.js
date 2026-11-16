function waitForMediaEvent(media, eventName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      media.removeEventListener(eventName, handleReady);
      media.removeEventListener('error', handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('The video could not be decoded by this browser.'));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out while reading the uploaded video.'));
    }, timeoutMs);

    media.addEventListener(eventName, handleReady, { once: true });
    media.addEventListener('error', handleError, { once: true });
  });
}

function formatTimestamp(seconds) {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
}

function safeFilename(value) {
  return value.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'camera-video';
}

export async function extractVideoFrames(file, maxFrames = 6) {
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  const previewUrls = [];

  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    const metadataReady = waitForMediaEvent(video, 'loadedmetadata');
    video.src = videoUrl;
    video.load();
    await metadataReady;

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error('The uploaded video has no readable duration or picture.');
    }

    const frameCount = Math.min(maxFrames, Math.max(2, Math.ceil(duration / 60)));
    const baseName = safeFilename(file.name);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare video stills for review.');

    const frames = [];
    for (let index = 0; index < frameCount; index += 1) {
      const timestampSeconds = duration * (index + 1) / (frameCount + 1);
      const seeked = waitForMediaEvent(video, 'seeked');
      video.currentTime = timestampSeconds;
      await seeked;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('A video still could not be prepared for review.'));
        }, 'image/jpeg', 0.84);
      });
      const timestamp = formatTimestamp(timestampSeconds);
      const frameFile = new File([blob], `${baseName}_frame_${String(index + 1).padStart(2, '0')}_${timestamp.replace(/:/g, '-')}.jpg`, {
        type: 'image/jpeg'
      });
      const previewUrl = URL.createObjectURL(blob);
      previewUrls.push(previewUrl);
      frames.push({ file: frameFile, previewUrl, timestamp, timestampSeconds, sourceFileName: file.name });
    }

    return { frames, durationSeconds: duration };
  } catch (error) {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(videoUrl);
  }
}
