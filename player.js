let songs = [];
let currentIndex = 0;
let player;
let progressTimer;
let queueRefreshTimer;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function renderUpNext() {
  const list = document.querySelector('#up-next-list');
  const remaining = songs.slice(currentIndex + 1);
  list.innerHTML = remaining.length ? remaining.map((song, index) => `<li class="song-row"><span class="song-number">${String(index + 1).padStart(2, '0')}</span><span class="song-info"><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(song.url)}</small></span></li>`).join('') : '<li class="empty-state">Dit is het laatste nummer in de rij.</li>';
}

function updateProgress() {
  if (!player || typeof player.getCurrentTime !== 'function') return;
  const current = player.getCurrentTime(); const duration = player.getDuration();
  document.querySelector('#current-position').textContent = formatTime(current);
  document.querySelector('#total-position').textContent = formatTime(duration);
  document.querySelector('#progress-bar').style.width = duration ? `${(current / duration) * 100}%` : '0%';
}

function playCurrent() {
  const song = songs[currentIndex];
  if (!song || !player) return;
  player.loadVideoById(song.videoId);
  document.querySelector('#video-placeholder').style.display = 'none';
  document.querySelector('#now-playing').textContent = song.title;
  document.querySelector('#player-status').textContent = `${currentIndex + 1} van ${songs.length} nummers`;
  renderUpNext();
  clearInterval(progressTimer); progressTimer = setInterval(updateProgress, 500);
}

function nextSong() {
  if (currentIndex < songs.length - 1) { currentIndex += 1; playCurrent(); }
  else { document.querySelector('#player-status').textContent = 'De rij is afgelopen.'; clearInterval(progressTimer); }
}

async function refreshQueue() {
  try {
    const updatedSongs = await getSongs();
    const currentSongId = songs[currentIndex]?.id;
    const changed = updatedSongs.length !== songs.length || updatedSongs.some((song, index) => song.id !== songs[index]?.id);
    if (!changed) return;

    songs = updatedSongs;
    if (currentSongId) {
      const newIndex = songs.findIndex(song => song.id === currentSongId);
      currentIndex = newIndex === -1 ? Math.min(currentIndex, songs.length - 1) : newIndex;
    } else {
      currentIndex = 0;
      if (songs.length && player) playCurrent();
    }
    renderUpNext();
    if (songs.length) document.querySelector('#player-status').textContent = `${currentIndex + 1} van ${songs.length} nummers`;
  } catch (error) {
    // Een tijdelijke netwerkfout mag het huidige nummer niet stoppen.
  }
}

window.onYouTubeIframeAPIReady = async function () {
  try { songs = await getSongs(); } catch (error) { document.querySelector('#player-status').textContent = 'De server is niet bereikbaar.'; return; }
  player = new YT.Player('player', { width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0 }, events: { onReady: playCurrent, onStateChange: event => { if (event.data === YT.PlayerState.ENDED) nextSong(); } } });
  if (!songs.length) { document.querySelector('#player-status').textContent = 'Voeg eerst een nummer toe.'; renderUpNext(); }
  queueRefreshTimer = setInterval(refreshQueue, 10000);
};

document.querySelector('#next-button')?.addEventListener('click', nextSong);