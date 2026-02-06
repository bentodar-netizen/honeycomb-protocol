const soundUrls = {
  bet: "https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3",
  win: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
  lose: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
};

const audioCache: Record<string, HTMLAudioElement> = {};

function preloadSound(key: keyof typeof soundUrls) {
  if (!audioCache[key]) {
    const audio = new Audio(soundUrls[key]);
    audio.preload = "auto";
    audio.volume = 0.5;
    audioCache[key] = audio;
  }
}

export function playBetSound() {
  try {
    preloadSound("bet");
    const audio = audioCache["bet"].cloneNode() as HTMLAudioElement;
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (e) {}
}

export function playWinSound() {
  try {
    preloadSound("win");
    const audio = audioCache["win"].cloneNode() as HTMLAudioElement;
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch (e) {}
}

export function playLoseSound() {
  try {
    preloadSound("lose");
    const audio = audioCache["lose"].cloneNode() as HTMLAudioElement;
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
}

export function preloadAllSounds() {
  preloadSound("bet");
  preloadSound("win");
  preloadSound("lose");
}
