const CF = 'https://d2uimaqek2eby3.cloudfront.net/Hilite-Mall';

export const DB_URL = `${CF}/persons.db`;

export const VIDEO_CONFIG = {
  ch20: {
    url: `${CF}/ch20.mp4`,
    startTime: '2026-04-24T15:37:22',
    label: 'GROUND LOBBY — CAM ch20',
    suppressReId: true, // RE-ID only confirmed after cross-camera match; hide badge here
  },
  ch25: {
    url: `${CF}/ch25.mp4`,
    // Camera embedded timestamp at frame 0 (use this, not NVR filename time)
    startTime: '2026-04-24T15:41:09',
    label: '-5 — CAM ch25',
    // Show ticking clock from ch20 start until this camera's feed begins
    clockStartTime: '2026-04-24T15:37:22',
  },
};

export const CHANNEL_LABELS = {
  ch20: 'Ground Lobby',
  ch25: '-5',
};

const V = '2'; // bump this whenever screenshots are re-uploaded to S3
export const TRANSITION_SCREENSHOTS = {
  '4_ch20': {
    departed: `${CF}/screenshots/p4_departed_ground_lobby.webp?v=${V}`,
    arrived:  `${CF}/screenshots/p4_arrived_ipc.webp?v=${V}`,
  },
};
