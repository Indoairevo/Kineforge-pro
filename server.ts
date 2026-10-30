import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { createStarterProject } from './src/data/defaultCatalog';
import { VideoProject } from './src/types/editor';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'kineforge-db.json');

interface DatabaseSchema {
  projects: VideoProject[];
  lastActiveProjectId: string;
}

function ensureDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const starter1 = createStarterProject('proj-default-showcase', 'Autonomous Horizon — Launch Cut');
    const starter2 = createStarterProject('proj-vertical-social', 'Artisan Roastery — 9:16 Social Reel');
    starter2.aspectRatio = '9:16';
    starter2.customWidth = 1080;
    starter2.customHeight = 1920;

    const initialDb: DatabaseSchema = {
      projects: [starter1, starter2],
      lastActiveProjectId: starter1.id,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    if (!Array.isArray(parsed.projects) || parsed.projects.length === 0) {
      const starter = createStarterProject();
      return { projects: [starter], lastActiveProjectId: starter.id };
    }
    // Upgrade legacy seed clip-v1-drive fadeIn at 00:00:00 so frame 0 is never black
    for (const proj of parsed.projects) {
      for (const clip of proj.clips) {
        if (clip.id === 'clip-v1-drive' && clip.startTime === 0) {
          clip.effects.fadeIn = 0;
          clip.transition.inType = 'none';
        }
        if (clip.id === 'clip-t1-hero' && clip.startTime <= 0.5) {
          clip.startTime = 0;
          clip.transition.inType = 'none';
          if (clip.textStyle) clip.textStyle.entranceAnim = 'none';
        }
      }
    }
    return parsed;
  } catch {
    const starter = createStarterProject();
    return { projects: [starter], lastActiveProjectId: starter.id };
  }
}

function saveDatabase(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// --- Database Project Management Routes ---

app.get('/api/projects', (_req, res) => {
  const db = ensureDatabase();
  const summaries = db.projects.map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    aspectRatio: p.aspectRatio,
    clipCount: p.clips.length,
    trackCount: p.tracks.length,
  }));
  res.json({
    projects: summaries,
    lastActiveProjectId: db.lastActiveProjectId,
  });
});

app.get('/api/projects/:id', (req, res) => {
  const db = ensureDatabase();
  const project = db.projects.find((p) => p.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  db.lastActiveProjectId = project.id;
  saveDatabase(db);
  res.json({ project });
});

app.post('/api/projects', (req, res) => {
  const incoming = req.body?.project as VideoProject | undefined;
  if (!incoming || !incoming.id || !incoming.name) {
    res.status(400).json({ error: 'Invalid project payload' });
    return;
  }
  const db = ensureDatabase();
  const now = new Date().toISOString();
  const updatedProject: VideoProject = {
    ...incoming,
    updatedAt: now,
    createdAt: incoming.createdAt || now,
  };

  const idx = db.projects.findIndex((p) => p.id === updatedProject.id);
  if (idx >= 0) {
    db.projects[idx] = updatedProject;
  } else {
    db.projects.unshift(updatedProject);
  }
  db.lastActiveProjectId = updatedProject.id;
  saveDatabase(db);
  res.json({ project: updatedProject, savedAt: now });
});

app.put('/api/projects/:id', (req, res) => {
  const db = ensureDatabase();
  const idx = db.projects.findIndex((p) => p.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const { name, project } = req.body;
  const now = new Date().toISOString();
  if (project) {
    db.projects[idx] = { ...project, id: req.params.id, updatedAt: now };
  } else if (typeof name === 'string' && name.trim()) {
    db.projects[idx].name = name.trim();
    db.projects[idx].updatedAt = now;
  }
  saveDatabase(db);
  res.json({ project: db.projects[idx] });
});

app.post('/api/projects/:id/duplicate', (req, res) => {
  const db = ensureDatabase();
  const source = db.projects.find((p) => p.id === req.params.id);
  if (!source) {
    res.status(404).json({ error: 'Source project not found' });
    return;
  }
  const now = new Date().toISOString();
  const duplicate: VideoProject = {
    ...JSON.parse(JSON.stringify(source)),
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${source.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  db.projects.unshift(duplicate);
  db.lastActiveProjectId = duplicate.id;
  saveDatabase(db);
  res.json({ project: duplicate });
});

app.delete('/api/projects/:id', (req, res) => {
  const db = ensureDatabase();
  if (db.projects.length <= 1) {
    res.status(400).json({ error: 'Cannot delete the last remaining project in the workspace.' });
    return;
  }
  db.projects = db.projects.filter((p) => p.id !== req.params.id);
  if (db.lastActiveProjectId === req.params.id) {
    db.lastActiveProjectId = db.projects[0].id;
  }
  saveDatabase(db);
  res.json({ deletedId: req.params.id, nextProject: db.projects[0] });
});

// --- Server-Side Gemini AI Endpoints ---

// 1. Automatic Subtitles Generation (gemini-3.8-flash)
app.post('/api/ai/subtitles', async (req, res) => {
  const { projectContext, duration = 16, stylePreset = 'subtitle-pill' } = req.body;
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Generate 4 to 6 timed video subtitle captions for a video project totaling ${duration} seconds. Project context: ${JSON.stringify(projectContext || 'Autonomous electric vehicle showcase and studio director interview')}. Ensure startTime and endTime do not overlap and stay within 0 to ${duration}.`,
      config: {
        systemInstruction: 'You are a professional broadcast subtitle timing editor. Output clean, concise caption lines under 48 characters each.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startTime: { type: Type.NUMBER, description: 'Start time in seconds' },
              endTime: { type: Type.NUMBER, description: 'End time in seconds' },
              text: { type: Type.STRING, description: 'Caption text line' },
            },
            required: ['startTime', 'endTime', 'text'],
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim());
    res.json({ subtitles: parsed, stylePreset, source: 'gemini-3.8-flash' });
  } catch (err: any) {
    const msg = err?.message || 'AI subtitle service unavailable';
    res.status(503).json({
      error: msg === 'GEMINI_API_KEY_MISSING'
        ? 'Gemini API key is not configured in Settings > Secrets. Please configure GEMINI_API_KEY to run cloud AI subtitle generation.'
        : `Gemini API Error: ${msg}`,
    });
  }
});

// 2. Speech-to-Text Audio Transcription (gemini-3.5-transcribe)
app.post('/api/ai/transcribe', async (req, res) => {
  const { base64Audio, mimeType = 'audio/webm' } = req.body;
  if (!base64Audio) {
    res.status(400).json({ error: 'Missing audio data for transcription.' });
    return;
  }
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          { text: 'Transcribe this audio accurately into clear English sentences.' },
        ],
      },
    });
    res.json({ transcript: (response.text ?? '').trim(), model: 'gemini-3.5-transcribe' });
  } catch (err: any) {
    const msg = err?.message || 'Transcription service error';
    res.status(503).json({
      error: msg === 'GEMINI_API_KEY_MISSING'
        ? 'Gemini API key is not configured in Settings > Secrets.'
        : `Transcription failed: ${msg}`,
    });
  }
});

// 3. Text-to-Speech Voiceover Generation (gemini-3.8-flash-lite-tts)
app.post('/api/ai/tts', async (req, res) => {
  const { text, voiceName = 'Kore', stylePrompt = 'Clear, engaging documentary narrator' } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Please provide voiceover script text.' });
    return;
  }
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: stylePrompt,
              },
            } as any,
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(500).json({ error: 'Model returned empty audio output.' });
      return;
    }
    res.json({
      base64Audio,
      mimeType: 'audio/wav',
      voiceName,
      model: 'gemini-3.8-flash-lite-tts',
    });
  } catch (err: any) {
    const msg = err?.message || 'TTS service error';
    res.status(503).json({
      error: msg === 'GEMINI_API_KEY_MISSING'
        ? 'Gemini API key is not configured in Settings > Secrets.'
        : `TTS Voiceover generation failed: ${msg}`,
    });
  }
});

// 4. AI-Assisted Color Correction (gemini-3.8-flash)
app.post('/api/ai/color-grade', async (req, res) => {
  const { prompt, clipName } = req.body;
  if (!prompt) {
    res.status(400).json({ error: 'Provide a color look description.' });
    return;
  }
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Compute color grading parameters for clip "${clipName || 'Video Clip'}" matching look: "${prompt}". All values must be integers within the specified ranges.`,
      config: {
        systemInstruction: 'You are a senior digital colorist. Output balanced color grading parameters (-45 to +45 for most sliders) so the footage looks cinematic and natural.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brightness: { type: Type.NUMBER, description: '-50 to 50' },
            contrast: { type: Type.NUMBER, description: '-50 to 50' },
            saturation: { type: Type.NUMBER, description: '-60 to 60' },
            temperature: { type: Type.NUMBER, description: '-60 (cool) to 60 (warm)' },
            tint: { type: Type.NUMBER, description: '-40 to 40' },
            highlights: { type: Type.NUMBER, description: '-50 to 50' },
            shadows: { type: Type.NUMBER, description: '-50 to 50' },
            exposure: { type: Type.NUMBER, description: '-35 to 35' },
            hue: { type: Type.NUMBER, description: '-45 to 45' },
            sharpen: { type: Type.NUMBER, description: '0 to 60' },
            vignette: { type: Type.NUMBER, description: '0 to 50' },
            filmGrain: { type: Type.NUMBER, description: '0 to 40' },
            summary: { type: Type.STRING, description: '1-sentence explanation of the grade' },
          },
          required: [
            'brightness', 'contrast', 'saturation', 'temperature', 'tint',
            'highlights', 'shadows', 'exposure', 'hue', 'sharpen', 'vignette', 'filmGrain', 'summary',
          ],
        },
      },
    });

    const grade = JSON.parse((response.text ?? '{}').trim());
    res.json({ grade, model: 'gemini-3.8-flash' });
  } catch (err: any) {
    const msg = err?.message || 'AI Color Grade error';
    res.status(503).json({
      error: msg === 'GEMINI_API_KEY_MISSING'
        ? 'Gemini API key is not configured in Settings > Secrets.'
        : `AI Color Correction failed: ${msg}`,
    });
  }
});

// 5. Smart Clip Suggestions, Auto-Reframe & Silence Analysis (gemini-3.8-flash)
app.post('/api/ai/smart-edit', async (req, res) => {
  const { taskType, clipsSummary, aspectRatio } = req.body;
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Analyze this timeline for task "${taskType}" in aspect ratio "${aspectRatio}": ${JSON.stringify(clipsSummary)}. Provide actionable editing parameters and recommendations.`,
      config: {
        systemInstruction: 'You are an expert film editor assistant. Return concrete numeric adjustments and edit recommendations.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedBpm: { type: Type.NUMBER },
            reframeX: { type: Type.NUMBER },
            reframeY: { type: Type.NUMBER },
            reframeScale: { type: Type.NUMBER },
          },
          required: ['headline', 'recommendations', 'suggestedBpm', 'reframeX', 'reframeY', 'reframeScale'],
        },
      },
    });
    const analysis = JSON.parse((response.text ?? '{}').trim());
    res.json({ analysis, model: 'gemini-3.8-flash' });
  } catch (err: any) {
    const msg = err?.message || 'AI Smart Edit error';
    res.status(503).json({
      error: msg === 'GEMINI_API_KEY_MISSING'
        ? 'Gemini API key is not configured in Settings > Secrets.'
        : `AI Smart Analysis failed: ${msg}`,
    });
  }
});

async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KineForge Studio Server listening on http://localhost:${PORT}`);
  });
}

startServer();
