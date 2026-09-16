const api = '/api/songs';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

function showOpenNotification() {
	if (!('Notification' in window) || Notification.permission !== 'granted' || sessionStorage.getItem('pulseboard-open-notified')) return;
	new Notification('Pulseboard', { body: 'De gezamenlijke muziekwachtrij staat klaar.' });
	sessionStorage.setItem('pulseboard-open-notified', '1');
}

async function enableNotifications() {
	const button = document.querySelector('#notification-button');
	if (!('Notification' in window)) { button.textContent = 'Niet ondersteund'; button.disabled = true; return; }
	const permission = await Notification.requestPermission();
	if (permission === 'granted') { button.textContent = 'Meldingen aan'; showOpenNotification(); }
	else if (permission === 'denied') button.textContent = 'Meldingen geblokkeerd';
}

async function getSongs() {
	const response = await fetch(api);
	if (!response.ok) throw new Error('Kon de nummers niet laden.');
	return response.json();
}

function escapeHtml(value) {
	return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function renderSongs(songs) {
	const list = document.querySelector('#song-list');
	const count = document.querySelector('#song-count');
	if (!list) return;
	count.textContent = `${songs.length} ${songs.length === 1 ? 'nummer' : 'nummers'}`;
	list.innerHTML = songs.length ? songs.map((song, index) => `<li class="song-row"><span class="song-number">${String(index + 1).padStart(2, '0')}</span><span class="song-info"><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(song.url)}</small></span><button class="delete-button" data-delete="${song.id}" aria-label="Verwijder ${escapeHtml(song.title)}">Verwijder</button></li>`).join('') : '<li class="empty-state">Nog geen nummers. Voeg de eerste toe.</li>';
}

async function loadSongs() {
	try { renderSongs(await getSongs()); } catch (error) { document.querySelector('#song-list').innerHTML = '<li class="empty-state error">De server is niet bereikbaar.</li>'; }
}

async function addSong(event) {
	event.preventDefault(); const form = event.currentTarget; const message = document.querySelector('#form-message'); const submit = form.querySelector('button[type="submit"]');
	submit.disabled = true; message.textContent = ''; message.className = 'form-message';
	try {
		const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
		const result = await response.json(); if (!response.ok) throw new Error(result.error);
		form.reset(); message.textContent = 'Toegevoegd aan de gezamenlijke wachtrij.'; await loadSongs();
	} catch (error) { message.textContent = error.message; message.className = 'form-message error'; } finally { submit.disabled = false; }
}

async function deleteSong(id) { await fetch(`${api}/${encodeURIComponent(id)}`, { method: 'DELETE' }); loadSongs(); }
document.querySelector('#add-form')?.addEventListener('submit', addSong);
document.querySelector('#song-list')?.addEventListener('click', event => { const button = event.target.closest('[data-delete]'); if (button) deleteSong(button.dataset.delete); });
loadSongs();
document.querySelector('#notification-button')?.addEventListener('click', enableNotifications);
showOpenNotification();

const sharedStatus = new URLSearchParams(window.location.search).get('shared');
if (sharedStatus) {
	const message = document.querySelector('#form-message');
	message.textContent = sharedStatus === '1' ? 'Via het delen-menu toegevoegd aan de wachtrij.' : 'De gedeelde link was geen geldige YouTube-link.';
	message.className = sharedStatus === '1' ? 'form-message' : 'form-message error';
	history.replaceState({}, '', '/');
}
