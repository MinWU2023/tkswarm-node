const express = require('express');
const { ok } = require('../http');

const router = express.Router();

/** Generate a short PCM WAV chime in-memory (no external asset). */
function buildChimeWav(durationMs = 280, freq = 880) {
  const sampleRate = 22050;
  const samples = Math.floor(sampleRate * (durationMs / 1000));
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 6);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.35;
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.floor(sample * 32767))), 44 + i * 2);
  }
  return buffer;
}

const SOUNDS = {
  chime: () => buildChimeWav(280, 880),
  soft: () => buildChimeWav(220, 660),
  alert: () => buildChimeWav(360, 1040),
};

router.get('/playMessage', (req, res) => {
  const sound = String(req.query.sound || 'chime').toLowerCase();
  if (sound === 'none') return ok(res, { played: false, sound: 'none' });
  const builder = SOUNDS[sound] || SOUNDS.chime;
  const wav = builder();
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Disposition', `inline; filename="${sound}.wav"`);
  return res.send(wav);
});

router.get('/sounds', (req, res) => ok(res, Object.keys(SOUNDS).concat(['none'])));

module.exports = router;
