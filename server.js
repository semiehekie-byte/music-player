const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATABASE = path.join(ROOT, 'songs.json');

function readSongs() {
	try {
		const data = JSON.parse(fs.readFileSync(DATABASE, 'utf8'));
		return Array.isArray(data) ? data : [];
	} catch (error) { return []; }
}

function writeSongs(songs) { fs.writeFileSync(DATABASE, JSON.stringify(songs, null, 2)); }

function getVideoId(value) {
	try {
		const url = new URL(value);
		if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0];
		if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
			if (url.pathname === '/watch') return url.searchParams.get('v');
			if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2];
			if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2];
		}
	} catch (error) { return null; }
	return null;
}

function sendJson(response, status, payload) {
	response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
	response.end(JSON.stringify(payload));
}

function parseBody(request) {
	return new Promise((resolve, reject) => {
		let body = '';
		request.on('data', chunk => { body += chunk; if (body.length > 10000) request.destroy(); });
		request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); } });
		request.on('error', reject);
	});
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function serveStatic(request, response, pathname) {
	const requested = pathname === '/' ? '/index.html' : pathname;
	const filePath = path.resolve(ROOT, `.${requested}`);
	if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { response.writeHead(404); response.end('Niet gevonden'); return; }
	response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
	fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
	const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
	if (url.pathname === '/api/songs' && request.method === 'GET') return sendJson(response, 200, readSongs());
	if (url.pathname === '/api/songs' && request.method === 'POST') {
		try {
			const body = await parseBody(request);
			const videoId = getVideoId(String(body.url || '').trim());
			if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return sendJson(response, 400, { error: 'Gebruik een geldige YouTube-link.' });
			const songs = readSongs();
			const song = { id: randomUUID(), videoId, url: `https://www.youtube.com/watch?v=${videoId}`, title: String(body.title || '').trim().slice(0, 120) || `YouTube-nummer ${videoId}`, addedAt: new Date().toISOString() };
			songs.push(song); writeSongs(songs); return sendJson(response, 201, song);
		} catch (error) { return sendJson(response, 400, { error: 'De aanvraag kon niet worden gelezen.' }); }
	}
	if (url.pathname.startsWith('/api/songs/') && request.method === 'DELETE') {
		const id = url.pathname.split('/').pop(); const songs = readSongs(); const remaining = songs.filter(song => song.id !== id);
		if (remaining.length === songs.length) return sendJson(response, 404, { error: 'Nummer niet gevonden.' });
		writeSongs(remaining); return sendJson(response, 200, { ok: true });
	}
	serveStatic(request, response, url.pathname);
});

server.listen(PORT, () => console.log(`Muziekspeler draait op http://localhost:${PORT}`));
