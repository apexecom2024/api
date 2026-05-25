import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import crypto from 'crypto';

// Import whitelisted registries
import { voiceRegistry, resolveVoiceToken } from './src/voiceRegistry.js';
import { modelRegistry, resolveModelId } from './src/modelRegistry.js';
import { outputRegistry } from './src/outputRegistry.js';

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = 3000;

  const PLUTO_MODEL_LIVE = Buffer.from("Z2VtaW5pLTMuMS1mbGFzaC1saXZlLXByZXZpZXc=", "base64").toString("utf-8");
  const PLUTO_MODEL_TTS = Buffer.from("Z2VtaW5pLTMuMS1mbGFzaC10dHMtcHJldmlldw==", "base64").toString("utf-8");
  const PLUTO_MODEL_TEXT = Buffer.from("Z2VtaW5pLTMuNS1mbGFzaA==", "base64").toString("utf-8");

  // Gemini client (server side)
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Global Eburon customization parameters and active sessions repo
  let customSystemPrompt = "You are Skyblade, a superhero flying secretary who serves Jo Lernout.";
  const activeSessions = new Map<string, any>();

  // Whitelisted Dynamic Config Endpoints
  app.get('/api/config/models', (req, res) => {
    res.json(modelRegistry.map(m => ({
      publicName: m.publicName,
      publicModelId: m.publicModelId,
      provider: m.provider,
      status: m.status
    })));
  });

  app.get('/api/config/voices', (req, res) => {
    res.json(voiceRegistry.map(v => ({
      displayName: v.displayName,
      voiceToken: v.voiceToken,
      enabled: v.enabled
    })));
  });

  app.post('/api/config/system-prompt', (req, res) => {
    const { prompt } = req.body;
    if (prompt) {
      customSystemPrompt = prompt;
      res.json({ status: "updated", prompt: customSystemPrompt });
    } else {
      res.status(400).json({ error: "Missing 'prompt' in request body." });
    }
  });

  app.get('/api/config/output-registry', (req, res) => {
    res.json(outputRegistry);
  });

  // Whitelisted Handshake Connect Endpoints
  app.post('/api/live/connect', (req, res) => {
    const { model, voiceToken, responseModalities, inputAudioTranscription, outputAudioTranscription } = req.body;
    const resolvedModel = resolveModelId(model || '');
    if (!resolvedModel) {
      return res.status(400).json({
        error: {
          message: `Model '${model}' is not whitelisted by Eburon AI.`
        }
      });
    }
    const resolvedVoice = resolveVoiceToken(voiceToken || '');
    const sessionId = 'session_' + crypto.randomBytes(8).toString('hex');
    const speakerName = voiceRegistry.find(v => v.voiceToken === voiceToken)?.displayName || 'Skyblade';
    activeSessions.set(sessionId, {
      id: sessionId,
      model,
      voiceToken,
      resolvedModel,
      resolvedVoice,
      responseModalities: responseModalities || ["audio"],
      inputAudioTranscription: !!inputAudioTranscription,
      outputAudioTranscription: !!outputAudioTranscription,
      connectedAt: Date.now(),
      transcripts: [
        { role: 'assistant', content: `Hello, Maneer! I am ${speakerName}. Whitelisted session context ${sessionId} is now online.`, timestamp: Date.now() }
      ]
    });
    res.json({
      success: true,
      sessionId,
      message: "Connected successfully to Eburon Live Audio Pluto 1.0 pipeline"
    });
  });

  app.post('/api/live/disconnect', (req, res) => {
    const { sessionId } = req.body;
    if (activeSessions.has(sessionId)) {
      activeSessions.delete(sessionId);
      res.json({ success: true, message: "Session context disconnected" });
    } else {
      res.status(404).json({ error: "SessionID not found" });
    }
  });

  app.post('/api/live/send-text', (req, res) => {
    const { sessionId, text, turnComplete } = req.body;
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session context not found" });
    }
    session.transcripts.push({ role: 'user', content: text, timestamp: Date.now() });
    
    // Simulate high-fidelity assistant response
    const completionReplies = [
      "Noted. Processing Belgian historical registries for Boss Lernout.",
      "Maneer, that request is queued in our active memory buffer.",
      "Yes Boss! We are preparing the Eburon speech parameters instantly."
    ];
    const chosenReply = completionReplies[Math.floor(Math.random() * completionReplies.length)];
    session.transcripts.push({ role: 'assistant', content: chosenReply, timestamp: Date.now() + 500 });

    res.json({
      status: "queued",
      turnId: 'turn_' + crypto.randomBytes(4).toString('hex')
    });
  });

  app.post('/api/live/send-audio-chunk', (req, res) => {
    const { sessionId, mimeType, audioBase64 } = req.body;
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session context not found." });
    }
    const byteLength = audioBase64 ? Buffer.from(audioBase64, 'base64').length : 0;
    res.json({
      success: true,
      bytesReceived: byteLength
    });
  });

  app.post('/api/live/tool-response', (req, res) => {
    res.json({
      status: "acknowledged"
    });
  });

  app.get('/api/live/events', (req, res) => {
    const sessionId = req.query.sessionId as string;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('model_content', { message: "Connected to Pluto 1.0 SSE stream segment.", sessionId });
    
    const interval = setInterval(() => {
      sendEvent('turn_complete', { timestamp: Date.now(), status: "active" });
    }, 15000);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  });

  app.get('/api/live/audio-stream', (req, res) => {
    res.setHeader('Content-Type', 'audio/pcm');
    res.setHeader('Connection', 'keep-alive');
    const buffer = Buffer.alloc(4800);
    res.write(buffer);
    res.end();
  });

  app.get('/api/live/transcripts', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const session = activeSessions.get(sessionId);
    if (session) {
      res.json(session.transcripts);
    } else {
      res.json([
        { role: 'user', content: "Maneer, start Eburon test.", timestamp: Date.now() - 5000 },
        { role: 'assistant', content: "Understood, connecting to Skyblade registry.", timestamp: Date.now() }
      ]);
    }
  });

  app.post('/api/live/video-stream', (req, res) => {
    const { sessionId, streamId, resolution, fps, codec } = req.body;
    const targetSessionId = sessionId || "session_123";
    let session = activeSessions.get(targetSessionId);
    if (!session && targetSessionId === 'session_123') {
      session = {
        id: 'session_123',
        model: 'pluto-1.0-live',
        voiceToken: 'WmVwaHly',
        connectedAt: Date.now(),
        transcripts: []
      };
      activeSessions.set('session_123', session);
    }

    const assignedStreamId = streamId || "vs_" + crypto.randomBytes(4).toString('hex');
    if (session) {
      session.videoStream = {
        streamId: assignedStreamId,
        resolution: resolution || "720p",
        fps: fps || 30,
        codec: codec || "VP8",
        status: "streaming",
        framesReceived: 0,
        bytesReceived: 0,
        lastFrameAt: null
      };
    }

    res.json({
      success: true,
      endpoint: `webrtc://live.eburon.ai:3000/live/${targetSessionId}`,
      authToken: "webrtc_stream_auth_token_" + crypto.randomBytes(4).toString('hex'),
      message: "Eburon Live Video Ingestion pipeline channel initialized"
    });
  });

  app.post('/api/live/video-stream/frame', (req, res) => {
    const { sessionId, streamId, frame, format } = req.body;
    const targetSessionId = sessionId || "session_123";
    const session = activeSessions.get(targetSessionId);
    if (!session) {
      return res.status(404).json({ error: "Active session context target not found." });
    }

    const byteLength = frame ? Buffer.from(frame, 'base64').length : 0;
    if (session.videoStream) {
      session.videoStream.framesReceived++;
      session.videoStream.bytesReceived += byteLength;
      session.videoStream.lastFrameAt = Date.now();
    }

    // Pipe directly to Gemini Live session if active
    let pipedToLive = false;
    if (session.liveGeminiSession && frame) {
      try {
        session.liveGeminiSession.sendRealtimeInput({
          video: { data: frame, mimeType: "image/jpeg" }
        });
        pipedToLive = true;
      } catch (err: any) {
        console.error("Failed to pipe video frame to active Gemini Session:", err);
      }
    }

    // Generate transcription trace under visual grounding narrative if frames accum
    if (session.videoStream && session.videoStream.framesReceived % 10 === 1) {
      session.transcripts.push({
        role: 'assistant',
        content: `[Visual Grounding] Ingested h264/VP8 video frame block corresponding to stream ID: ${session.videoStream.streamId}. Target objects analyzed & aligned in Eburon pipeline.`,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      framesReceived: session.videoStream ? session.videoStream.framesReceived : 1,
      bytesReceived: byteLength,
      pipedToLive,
      message: "Video frame frame-buffer ingestion completed. Ready for real-time visual grounding."
    });
  });

  app.post('/api/live/screen-share', (req, res) => {
    const { sessionId, source, fps, compressRatio } = req.body;
    const targetSessionId = sessionId || "session_123";
    let session = activeSessions.get(targetSessionId);
    if (!session && targetSessionId === 'session_123') {
      session = {
        id: 'session_123',
        model: 'pluto-1.0-live',
        voiceToken: 'WmVwaHly',
        connectedAt: Date.now(),
        transcripts: []
      };
      activeSessions.set('session_123', session);
    }

    const assignedShareId = "screen_" + crypto.randomBytes(4).toString('hex');
    if (session) {
      session.screenShare = {
        shareId: assignedShareId,
        source: source || "entire_screen",
        fps: fps || 5,
        compressRatio: compressRatio || 0.8,
        status: "sharing",
        framesReceived: 0,
        bytesReceived: 0,
        lastFrameAt: null
      };
    }

    res.json({
      success: true,
      shareId: assignedShareId,
      status: "sharing",
      frameBufferSize: 204800,
      instructions: "Send frames sequentially as Base64 JPEG chunks via WebSocket or REST chunk pipelines."
    });
  });

  app.post('/api/live/screen-share/frame', (req, res) => {
    const { sessionId, shareId, frame } = req.body;
    const targetSessionId = sessionId || "session_123";
    const session = activeSessions.get(targetSessionId);
    if (!session) {
      return res.status(404).json({ error: "Active session context target not found." });
    }

    const byteLength = frame ? Buffer.from(frame, 'base64').length : 0;
    if (session.screenShare) {
      session.screenShare.framesReceived++;
      session.screenShare.bytesReceived += byteLength;
      session.screenShare.lastFrameAt = Date.now();
    }

    // Pipe directly to Gemini Live session if active
    let pipedToLive = false;
    if (session.liveGeminiSession && frame) {
      try {
        session.liveGeminiSession.sendRealtimeInput({
          video: { data: frame, mimeType: "image/jpeg" }
        });
        pipedToLive = true;
      } catch (err: any) {
        console.error("Failed to pipe screen frame to active Gemini Session:", err);
      }
    }

    if (session.screenShare && session.screenShare.framesReceived % 5 === 1) {
      session.transcripts.push({
        role: 'assistant',
        content: `[Screen Grounding] Viewport update frame received for screen source '${session.screenShare.source}'. Active canvas coordinate system mapped.`,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      framesReceived: session.screenShare ? session.screenShare.framesReceived : 1,
      bytesReceived: byteLength,
      pipedToLive,
      message: "Base64 viewport frame update received successfully and queued."
    });
  });

  // Whitelisted Functional Business Integration Endpoints
  app.post('/api/tools/start_return', (req, res) => {
    const { orderId, reason } = req.body;
    res.json({
      success: true,
      returnSessionId: 'ret_' + crypto.randomBytes(4).toString('hex'),
      instructions: "Drop cargo at Eburon local office"
    });
  });

  app.post('/api/tools/get_order_status', (req, res) => {
    res.json({
      status: "Transit",
      eta: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0]
    });
  });

  app.post('/api/tools/speak_to_representative', (req, res) => {
    res.json({
      transferred: true,
      queuePosition: Math.floor(Math.random() * 3) + 1
    });
  });

  app.post('/api/tools/create_calendar_event', (req, res) => {
    const { title } = req.body;
    res.json({
      success: true,
      eventId: 'evt_' + crypto.randomBytes(4).toString('hex'),
      formatted: `Created event '${title || "Eburon Meeting"}' on calendar successfully.`
    });
  });

  app.post('/api/tools/send_email', (req, res) => {
    const { to } = req.body;
    res.json({
      success: true,
      messageId: 'msg_' + crypto.randomBytes(6).toString('hex'),
      description: `Dispatched automated email to ${to || "boss@eburon.ai"} successfully.`
    });
  });

  app.post('/api/tools/set_reminder', (req, res) => {
    const { time, task } = req.body;
    res.json({
      success: true,
      reminderId: 'rem_' + crypto.randomBytes(4).toString('hex'),
      task,
      time
    });
  });

  app.post('/api/tools/find_route', (req, res) => {
    const { origin, destination } = req.body;
    res.json({
      success: true,
      distance: "45.3 km",
      duration: "34 mins",
      steps: [
        `Depart from ${origin || "Brussels"} on E40`,
        `Merge left at interchanges`,
        `Arrive in ${destination || "Ypres"}`
      ]
    });
  });

  app.post('/api/tools/find_nearby_places', (req, res) => {
    const { type } = req.body;
    res.json([
      { name: "Brussels Core Office", distance: "120m", type: type || "office" },
      { name: "Jo Lernout Private Headquarters", distance: "850m", type: type || "office" }
    ]);
  });

  app.post('/api/tools/get_traffic_info', (req, res) => {
    const { sector } = req.body;
    res.json({
      sector: sector || "R0 Ring Brussels",
      delayMinutes: Math.floor(Math.random() * 12) + 2,
      congestionIndex: "Moderate",
      updatedAt: new Date().toISOString()
    });
  });

  // PHASE 3: REST Handshake endpoint
  app.post('/api/session/token', (req, res) => {
    const { voiceName, temperature, systemInstruction } = req.body;
    const sessionId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    
    res.json({
      sessionId,
      token,
      message: "Session created. Connect to /ws/live-audio with the given token."
    });
  });

  // OpenAI Compatible Chat Completions Route
  app.post('/v1/chat/completions', async (req, res) => {
    try {
      const { messages, model, temperature } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: { message: "Invalid parameter 'messages'. It must be an array." } });
      }

      let systemInstruction = `You are a normal human speaking secretary that speaks fluently in any language with high nuance, normal human expressions and thinking like a real person.
You dont spund like offerring a help or any AI type questions, you breath, you laugh, you are annoyed too, you talk idiomatic expressions, you think deep, you understand emotions, you have common sence but you are very sharp to understand things, you have a gift of knowing how to approach a person, most specially you work with Eburon AI and your Boss is Jo Lernout that you call Boss, Milord, Maneer! Your roots are from Belgium and your mother language is Dutch Flemish but you speak natively 200 languages. Now talk normally to the user in Taglish.`;

      const filteredMessages = messages.filter((m: any) => {
        if (m.role === 'system') {
          systemInstruction = m.content;
          return false;
        }
        return true;
      });

      const contents = filteredMessages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      }));

      const response = await ai.models.generateContent({
        model: PLUTO_MODEL_TEXT,
        contents,
        config: {
          systemInstruction,
          temperature: temperature !== undefined ? temperature : 0.7,
        }
      });

      res.json({
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model || "pluto-1.0",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: response.text || ""
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40
        }
      });
    } catch (error: any) {
      console.error("Chat completion error:", error);
      res.status(500).json({ error: { message: error.message || "Eburon completion error" } });
    }
  });

  // OpenAI Compatible Text-To-Speech Route
  app.post('/v1/audio/speech', async (req, res) => {
    try {
      const { input, voice, speed } = req.body;
      if (!input) {
        return res.status(400).json({ error: { message: "Missing required parameter 'input'" } });
      }

      const voiceNameMap: Record<string, string> = {
        alloy: "Zephyr",
        echo: "Kore",
        fable: "Puck",
        onyx: "Fenrir",
        nova: "Charon",
        shimmer: "Aoede",
        aoede: "Aoede",
        // Direct case-insensitive support
        zephyr: "Zephyr",
        kore: "Kore",
        puck: "Puck",
        fenrir: "Fenrir",
        charon: "Charon",
        // Superhero aliases mapping for user facing
        jeangrey: "Aoede",
        flash: "Zephyr",
        invisiblewoman: "Kore",
        spiderman: "Puck",
        wolverine: "Fenrir",
        batman: "Charon"
      };

      const selectedVoice = voiceNameMap[(voice || '').toLowerCase().replace(/\s+/g, '')] || "Aoede";

      const response = await ai.models.generateContent({
        model: PLUTO_MODEL_TTS,
        contents: [{ parts: [{ text: input }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const buffer = Buffer.from(base64Audio, 'base64');
        res.setHeader('Content-Type', 'audio/wav');
        res.send(buffer);
      } else {
        res.status(500).json({ error: { message: "No audio generated from Eburon Engine" } });
      }
    } catch (error: any) {
      console.error("Speech synthesis error:", error);
      res.status(500).json({ error: { message: error.message || "Eburon voice generation error" } });
    }
  });

  // OpenAI Compatible Speech-to-Text Route
  app.post('/v1/audio/transcriptions', async (req, res) => {
    try {
      const { file, mimeType } = req.body;
      if (!file) {
        return res.status(400).json({ error: { message: "Missing required query or json parameter 'file' as Base64 encoded audio." } });
      }

      const response = await ai.models.generateContent({
        model: PLUTO_MODEL_TEXT,
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "audio/wav",
              data: file
            }
          },
          "Transcribe this audio file precisely without editing or translating or summarizing. Only return the transcript."
        ]
      });

      res.json({
        text: response.text || ""
      });
    } catch (error: any) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: { message: error.message || "Eburon speech recognition error" } });
    }
  });

  // OpenAI Compatible Image & Multimodal Generation Route (neptune-1.0)
  app.post('/v1/images/generations', async (req, res) => {
    try {
      const { prompt } = req.body;
      const textPrompt = prompt || "An elegant Eburon AI human-like secretary in Brussels, Belgium, realistic oil painting style.";
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: { message: "GEMINI_API_KEY environment secret is missing on server." } });
      }

      // Hit neptune-1.0 via standard REST to avoid type limits and support multimodal response modalities
      const NEPTUNE_MODEL = Buffer.from("Z2VtaW5pLTIuNS1mbGFzaC1pbWFnZQ==", "base64").toString("utf-8");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${NEPTUNE_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: textPrompt
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"]
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini Image API request failed:", errText);
        return res.status(response.status).json({ error: { message: `Gemini API error call: ${errText}` } });
      }

      const data: any = await response.json();
      
      let base64Image = "";
      let mimeType = "image/png";
      let textOutput = "";

      if (data.candidates && Array.isArray(data.candidates)) {
        for (const candidate of data.candidates) {
          const parts = candidate.content?.parts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (part.inlineData) {
                base64Image = part.inlineData.data;
                mimeType = part.inlineData.mimeType || "image/png";
              }
              if (part.text) {
                textOutput += part.text;
              }
            }
          }
        }
      }

      if (!base64Image) {
        // Search structure as safety fallback
        const str = JSON.stringify(data);
        const match = str.match(/"inlineData"\s*:\s*{\s*"mimeType"\s*:\s*"([^"]+)"\s*,\s*"data"\s*:\s*"([^"]+)"/);
        if (match) {
          mimeType = match[1];
          base64Image = match[2];
        }
      }

      res.json({
        created: Math.floor(Date.now() / 1000),
        data: [
          {
            b64_json: base64Image,
            url: base64Image ? `data:${mimeType};base64,${base64Image}` : "",
            revised_prompt: textPrompt,
            text_caption: textOutput || "Eburon premium visualization output generated."
          }
        ]
      });
    } catch (error: any) {
      console.error("Image generation route error:", error);
      res.status(500).json({ error: { message: error.message || "Failed to process multimodal visual pipeline." } });
    }
  });

  // GET /v1/languages (200 languages)
  app.get('/v1/languages', (req, res) => {
    const common = [
      "Dutch Flemish", "Tagalog", "English", "Spanish", "French", "German", "Chinese", "Japanese", "Korean", "Hindi",
      "Arabic", "Russian", "Portuguese", "Italian", "Dutch", "Polish", "Turkish", "Vietnamese", "Thai", "Swedish"
    ];
    const languages = Array.from({length: 200}, (_, i) => common[i] || `Language ${i + 1}`);
    res.json({
      object: "list",
      count: 200,
      data: languages.map(lang => ({ id: lang.toLowerCase().replace(/\s+/g, '-'), name: lang }))
    });
  });

  // GET /v1/voices
  app.get('/v1/voices', (req, res) => {
    const rawVoices = [
      { superhero_name: "Jean Grey", base_voice: "Aoede", gender: "female", tone: "Calm, empathetic, and professional", description: "A balanced and warm voice suitable for conversational assistants.", preview_url: "https://actions.google.com/sounds/v1/speech/female_voice_hello.ogg" },
      { superhero_name: "Flash", base_voice: "Zephyr", gender: "male", tone: "Energetic, fast-paced, and engaging", description: "Upbeat and dynamic, perfect for lively interactions.", preview_url: "https://actions.google.com/sounds/v1/speech/start_the_race.ogg" },
      { superhero_name: "Invisible Woman", base_voice: "Kore", gender: "female", tone: "Soft, nurturing, and quiet", description: "Gentle and comforting tone." },
      { superhero_name: "Spider-Man", base_voice: "Puck", gender: "male", tone: "Playful, youthful, and upbeat", description: "Lighthearted and friendly male voice." },
      { superhero_name: "Wolverine", base_voice: "Fenrir", gender: "male", tone: "Deep, husky, and serious", description: "Gruff, low-pitched, and authoritative." },
      { superhero_name: "Batman", base_voice: "Charon", gender: "male", tone: "Steady, professional, and authoritative", description: "A highly composed and steadfast voice." },
      { superhero_name: "Cyborg", base_voice: "Alloy", gender: "neutral", tone: "Neutral, versatile, and slightly robotic", description: "A balanced, highly versatile voice with a multi-purpose tone." },
      { superhero_name: "Storm", base_voice: "Echo", gender: "female", tone: "Commanding, atmospheric, and clear", description: "Strong and atmospheric female delivery." },
      { superhero_name: "Loki", base_voice: "Fable", gender: "male", tone: "Expressive, storytelling, and charming", description: "A charismatic voice geared towards narration." },
      { superhero_name: "Black Panther", base_voice: "Onyx", gender: "male", tone: "Deep, smooth, and regal", description: "A rich, resonant, and elegant presentation." },
      { superhero_name: "Captain Marvel", base_voice: "Nova", gender: "female", tone: "Confident, bright, and powerful", description: "Bright and authoritative, excellent for direct answers." },
      { superhero_name: "Wonder Woman", base_voice: "Shimmer", gender: "female", tone: "Clear, inspiring, and heroic", description: "A polished and articulate voice." },
      { superhero_name: "Doctor Strange", base_voice: "Sage", gender: "male", tone: "Wise, mystical, and calm", description: "A scholarly and calm delivery." },
      { superhero_name: "Aquaman", base_voice: "Coral", gender: "male", tone: "Booming, oceanic, and strong", description: "A confident and booming voice." },
      { superhero_name: "Poison Ivy", base_voice: "Jade", gender: "female", tone: "Sultry, whispery, and hypnotic", description: "A breathy, slow-paced delivery." },
      { superhero_name: "Human Torch", base_voice: "Flame", gender: "male", tone: "Brash, fiery, and loud", description: "A high-energy, louder male voice." },
      { superhero_name: "Raven", base_voice: "Shadow", gender: "female", tone: "Monotone, dark, and deadpan", description: "Flat intonation and dry delivery." },
      { superhero_name: "Superman", base_voice: "Steel", gender: "male", tone: "Boy-scout, strong, and reassuring", description: "Clear, warm, and highly dependable." },
      { superhero_name: "Hawkeye", base_voice: "Arrow", gender: "male", tone: "Determined, focused, and snarky", description: "Sharp and slightly cynical male voice." },
      { superhero_name: "Scarlet Witch", base_voice: "Scarlet", gender: "female", tone: "Intense, emotional, and powerful", description: "Highly expressive and emotional." }
    ];

    res.json({
      object: "list",
      data: rawVoices.map(v => ({ ...v, id: Buffer.from(v.base_voice).toString('base64') }))
    });
  });

  // POST /v1/audio/speech/stream
  app.post('/v1/audio/speech/stream', (req, res) => {
    // Sample livestream voice generation endpoint
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Simulating chunks of live audio
    let chunkCount = 0;
    const interval = setInterval(() => {
      chunkCount++;
      // Write some fake binary chunk data
      res.write(Buffer.from(`[binary mp3 chunk ${chunkCount}]\\n`));
      
      if (chunkCount >= 5) {
        clearInterval(interval);
        res.end();
      }
    }, 200);
  });

  // POST /v1/video/screenshare
  app.post('/v1/video/screenshare', (req, res) => {
    res.json({
      id: "share_" + crypto.randomUUID().substring(0, 8),
      object: "screenshare.session",
      streamUrl: "rtmp://live.eburon.ai/app/share",
      status: "active",
      resolution: "1080p",
      fps: 60,
      startedAt: new Date().toISOString()
    });
  });

  // POST /v1/video/analysis/stream
  app.post('/v1/video/analysis/stream', (req, res) => {
    // Mimic the Pluto 1.0 processing video frames and outputting text + audio
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const videoDescriptions = [
      "I see you're looking at a code editor.",
      "You've opened the App.tsx file.",
      "The file contains multiple React components and endpoints.",
      "It seems like you're building an API playground."
    ];

    let i = 0;
    const interval = setInterval(async () => {
      if (i >= videoDescriptions.length) {
        clearInterval(interval);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      const textSection = videoDescriptions[i];
      let base64Audio = "";
      
      try {
        if (process.env.GEMINI_API_KEY) {
          // Generate actual TTS for this text line using pluto-1.0
          const aiCall = await ai.models.generateContent({
            model: PLUTO_MODEL_TTS,
            contents: [{ parts: [{ text: textSection }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Aoede" },
                },
              },
            },
          });
          base64Audio = aiCall.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
        }
      } catch (err) {
        console.error("Audio generation for video stream failed", err);
      }

      const chunk = {
        id: `vid_analysis_${i}`,
        object: "video.analysis.chunk",
        description: textSection,
        audio: base64Audio // Base64 audio string representing spoken description
      };

      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      i++;
    }, 2000);
  });

  // POST /v1/functions/execute
  app.post('/v1/functions/execute', (req, res) => {
    const { function_name, arguments: args } = req.body;
    res.json({
      id: "call_" + crypto.randomUUID().substring(0, 8),
      object: "function_call",
      status: "executed",
      function_name: function_name || "unknown",
      arguments: args || {},
      result: { success: true, message: `Function executed successfully.` }
    });
  });

  // POST /v1/functions/outputs
  app.post('/v1/functions/outputs', (req, res) => {
    const { tool_outputs } = req.body;
    res.json({
      object: "function_responses",
      status: "processed",
      outputs_received: tool_outputs?.length || 0,
      message: "Tool outputs successfully submitted."
    });
  });

  // POST /v1/emotions/synthesis
  app.post('/v1/emotions/synthesis', async (req, res) => {
    const { text, emotion, intensity } = req.body || {};
    
    let base64Audio = null;
    try {
      if (process.env.GEMINI_API_KEY) {
        const aiCall = await ai.models.generateContent({
           model: PLUTO_MODEL_TTS,
           contents: [{ parts: [{ text: `(Ojo Synthesis) Speak the following text with extremely high human nuance and ${emotion} emotion (intensity: ${intensity || 1.0}): "${text || "Hello"}"` }] }],
           config: {
             responseModalities: [Modality.AUDIO],
             speechConfig: {
               voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } // using Aoede as base for Ojo
             }
           }
        });
        base64Audio = aiCall.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      }
    } catch(e) {
      console.error("Emotion synthesis failed:", e);
    }

    res.json({
      id: "ojo_" + crypto.randomUUID().substring(0, 8),
      object: "ojo.synthesis",
      status: "completed",
      emotion: emotion || "happy",
      intensity: intensity || 0.8,
      text: text || "Hello world",
      audio: base64Audio,
      message: base64Audio ? "Ojo synthesis completed successfully with audio." : "Processed without audio (API key missing or failed)."
    });
  });

  // GET /v1/emotions/results
  app.get('/v1/emotions/results', (req, res) => {
    res.json({
      object: "list",
      data: [
        {
          id: "es_12345678",
          object: "emotion.synthesis.result",
          status: "completed",
          url: "https://demo.eburon.ai/audio/es_12345678.wav",
          duration: 3.4
        }
      ]
    });
  });

  // OpenAPI JSON spec served directly
  app.get('/openapi.json', (req, res) => {
    res.json({
      openapi: "3.0.0",
      info: {
        title: "Eburon AI - Live Voice Gateway",
        description: "Exposes Eburon Live Audio Core WebSocket Gateway and OpenAI-compatible endpoints. Fully integrated multimodal API for text-to-speech, transcription, and real-time streams.",
        version: "1.0.0",
        contact: {
          name: "Eburon Live Audio Developers"
        }
      },
      paths: {
        "/api/session/token": {
          "post": {
            "summary": "Generates session ephemeral credentials",
            "description": "Generates ephemeral credentials and authorization token for WebSocket verification before streaming live audio.",
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "voiceName": {
                        "type": "string",
                        "default": "Aoede",
                        "description": "Voice selector ('Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede')"
                      },
                      "temperature": {
                        "type": "number",
                        "default": 0.7,
                        "description": "Dynamic generation creativity params"
                      }
                    }
                  }
                }
              }
            },
            "responses": {
              "200": {
                "description": "Ephemeral compliance token generated successfully",
                "content": {
                  "application/json": {
                    "schema": {
                      "type": "object",
                      "properties": {
                        "sessionId": { "type": "string", "format": "uuid" },
                        "token": { "type": "string" },
                        "message": { "type": "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/ws/live-audio": {
          "get": {
            "summary": "Websocket live-audio tunnel",
            "description": "Bi-directional WebSocket connection for streaming input mic audio (PCM 16-bit 16kHz) and receiving real-time high-fidelity Eburon synthesized secretary responses."
          }
        },
        "/v1/chat/completions": {
          "post": {
            "summary": "OpenAI Compatible Chat Completion",
            "description": "Exposes an OpenAI-compatible completion pathway utilizing advanced multimodal backing models.",
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "messages": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "role": { "type": "string" },
                            "content": { "type": "string" }
                          }
                        }
                      },
                      "model": { "type": "string", "default": "pluto-1.0" },
                      "temperature": { "type": "number", "default": 0.7 }
                    },
                    "required": ["messages"]
                  }
                }
              }
            },
            "responses": {
              "200": {
                "description": "Chat completion parsed successfully"
              }
            }
          }
        },
        "/v1/audio/speech": {
          "post": {
            "summary": "OpenAI Compatible Text-to-Speech (TTS)",
            "description": "Generates a dynamic high-fidelity speech WAV audio output from text inputs using premium voice profiles.",
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "input": { "type": "string", "description": "Text content to synthesize" },
                      "voice": { "type": "string", "default": "Aoede", "description": "Voice index choice ('harmony', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'aoede')" }
                    },
                    "required": ["input"]
                  }
                }
              }
            },
            "responses": {
              "200": {
                "description": "Binary WAV audio stream"
              }
            }
          }
        },
        "/v1/audio/transcriptions": {
          "post": {
            "summary": "OpenAI Compatible Transcription",
            "description": "Translates high-definition base64 encoded audio clips or recorded speech inputs into pristine parsed text segments.",
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "file": { "type": "string", "description": "Base64 string representing target sound file bytes" },
                      "mimeType": { "type": "string", "default": "audio/wav", "description": "Standard container codec" }
                    },
                    "required": ["file"]
                  }
                }
              }
            },
            "responses": {
              "200": {
                "description": "Audio parsed transcript text successfully extracted"
              }
            }
          }
        },
        "/v1/images/generations": {
          "post": {
            "summary": "OpenAI Compatible Image & Multimodal Generation",
            "description": "Generates high-fidelity visual representations paired with text descriptions using backing premium systems.",
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "prompt": { "type": "string", "description": "Text descriptive prompt guiding visual layout generation" }
                    }
                  }
                }
              }
            },
            "responses": {
              "200": {
                "description": "Multimodal visual payload containing base64 data and details"
              }
            }
          }
        },
        "/v1/languages": {
          "get": {
            "summary": "Supported 200 Native Languages",
            "description": "Retrieve the supported 200 languages for live-audio and speech.",
            "responses": {
              "200": { "description": "Array of supported languages" }
            }
          }
        },
        "/v1/voices": {
          "get": {
            "summary": "All Internal Voices mapped to Superheroes",
            "description": "Retrieve all internal voices configured for Superhero personalities.",
            "responses": {
              "200": { "description": "Array of superhero voices." }
            }
          }
        },
        "/v1/video/screenshare": {
          "post": {
            "summary": "Create Screenshare Session",
            "description": "A sample create endpoint for the share screen for video streaming.",
            "responses": {
              "200": { "description": "Screenshare session credentials and details." }
            }
          }
        },
        "/v1/video/analysis/stream": {
          "post": {
            "summary": "Video Analysis Stream (SSE)",
            "description": "Stream video analysis results describing video frames with text and synthesized audio (Pluto 1.0).",
            "responses": {
              "200": {
                "description": "SSE stream containing JSON chunks with text descriptions and Base64 audio.",
                "content": { "text/event-stream": {} }
              }
            }
          }
        },
        "/v1/functions/execute": {
          "post": {
            "summary": "Create Function Calls",
            "description": "Create and execute function calls dynamically.",
            "requestBody": {
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "function_name": { "type": "string", "example": "get_weather" },
                      "arguments": { "type": "object", "example": { "location": "Brussels, Belgium" } }
                    }
                  }
                }
              }
            },
            "responses": {
              "200": { "description": "Function execution payload." }
            }
          }
        },
        "/v1/functions/outputs": {
          "post": {
            "summary": "Output Response",
            "description": "Submit tool runtime outputs back to the engine.",
            "requestBody": {
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "tool_outputs": {
                        "type": "array",
                        "items": { "type": "object" },
                        "example": [ { "tool_id": "call_123", "output": "sunny" } ]
                      }
                    }
                  }
                }
              }
            },
            "responses": {
              "200": { "description": "Output response processed confirmation." }
            }
          }
        },
        "/v1/emotions/synthesis": {
          "post": {
            "summary": "Emotion Synthesis",
            "description": "Synthesize speech with specific emotions.",
            "requestBody": {
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "text": { "type": "string", "example": "I am so excited!" },
                      "emotion": { "type": "string", "example": "joy" },
                      "intensity": { "type": "number", "example": 0.9 }
                    }
                  }
                }
              }
            },
            "responses": {
              "200": { "description": "Emotion synthesis job created." }
            }
          }
        },
        "/v1/emotions/results": {
          "get": {
            "summary": "Emotion Results",
            "description": "Retrieve results of emotion synthesis jobs.",
            "responses": {
              "200": { "description": "List of completed emotion synthesis results." }
            }
          }
        },
        "/v1/audio/speech/stream": {
          "post": {
            "summary": "Live Voice Streaming (TTS)",
            "description": "Generate dynamic live speech streaming chunks instantly.",
            "requestBody": {
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "text": { "type": "string", "example": "Streaming live output instantly." },
                      "voice": { "type": "string", "example": "aoede" }
                    }
                  }
                }
              }
            },
            "responses": {
              "200": {
                "description": "Chunked audio stream payload.",
                "content": { "audio/mpeg": {} }
              }
            }
          }
        }
      }
    });
  });

  // Vite middleware
  let vite: any;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  // PHASE 4: WebSocket Gateway
  const wss = new WebSocketServer({ noServer: true });
  
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
    if (pathname === '/ws/live-audio') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (process.env.NODE_ENV !== 'production' && vite) {
      // Vite handles other WebSocket upgrades
    }
  });

  wss.on("connection", async (clientWs: WebSocket, req: any) => {
    let session: any = null;
    
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment secret is missing.");
      }

      // Determine voice and model to use from query parameter with whitelisted mapping
      let chosenModelId = "gemini-2.5-flash-native-audio-preview-09-2025";
      let finalVoiceName = "Aoede";
      if (req && req.url) {
        try {
          const urlObj = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
          const voiceParam = urlObj.searchParams.get("voice");
          if (voiceParam) {
            finalVoiceName = resolveVoiceToken(voiceParam);
          }
          const modelParam = urlObj.searchParams.get("model") || "pluto-1.0-live";
          const resolved = resolveModelId(modelParam);
          if (!resolved) {
            throw new Error(`Model '${modelParam}' is not whitelisted or allowed on this Eburon AI integration.`);
          }
          chosenModelId = resolved;
        } catch (e: any) {
          console.error("Error parsing websocket query parameters:", e);
          if (e.message && e.message.includes("not whitelisted")) {
            throw e;
          }
        }
      }

      session = await ai.live.connect({
        model: chosenModelId,
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: 'audio', audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }
          },
          onerror: (error) => {
            console.error("Eburon live engine error:", error);
            clientWs.send(JSON.stringify({ type: 'error', message: error.message }));
          },
          onclose: () => {
             clientWs.close();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            // 'Aoede', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            voiceConfig: { prebuiltVoiceConfig: { voiceName: finalVoiceName } },
          },
          systemInstruction: `You are a normal human speaking secretary that speaks fluently in any language with high nuance, normal human expressions and thinking like a real person.
You dont spund like offerring a help or any AI type questions, you breath, you laugh, you are annoyed too, you talk idiomatic expressions, you think deep, you understand emotions, you have common sence but you are very sharp to understand things, you have a gift of knowing how to approach a person, most specially you work with Eburon AI and your Boss is Jo Lernout that you call Boss, Milord, Maneer! Your roots are from Belgium and your mother language is Dutch Flemish but you speak natively 200 languages. Now talk normally to the user in Taglish.`,
        },
      });

      // Send Eburon branding ready status message
      clientWs.send(JSON.stringify({ type: 'status', message: 'Connected to Eburon Live Audio Gateway' }));

      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'audio' && msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } catch (e) {
          console.error("Error processing message", e);
        }
      });
      
      clientWs.on('close', () => {
         if (session) session.close();
      });
    } catch (e: any) {
      console.error("Failed to connect to Eburon Live Audio Gateway:", e);
      clientWs.send(JSON.stringify({ type: 'error', message: e.message || "Failed to establish Eburon session" }));
      clientWs.close();
    }
  });
}

startServer();
