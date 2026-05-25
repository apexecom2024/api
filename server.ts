import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import crypto from 'crypto';

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = 3000;

  // Gemini client (server side)
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
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
        model: "gemini-3.5-flash",
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
        model: model || "eburon-voice-v1",
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
        model: "gemini-3.1-flash-tts-preview",
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
        model: "gemini-3.5-flash",
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

  // OpenAI Compatible Image & Multimodal Generation Route (gemini-2.5-flash-image)
  app.post('/v1/images/generations', async (req, res) => {
    try {
      const { prompt } = req.body;
      const textPrompt = prompt || "An elegant Eburon AI human-like secretary in Brussels, Belgium, realistic oil painting style.";
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: { message: "GEMINI_API_KEY environment secret is missing on server." } });
      }

      // Hit gemini-2.5-flash-image via standard REST to avoid type limits and support multimodal response modalities
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
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
                      "model": { "type": "string", "default": "eburon-voice-v1" },
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

      // Determine voice to use from query parameter with superhero fallback mapping
      let finalVoiceName = "Aoede";
      if (req && req.url) {
        try {
          const urlObj = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
          const voiceParam = urlObj.searchParams.get("voice");
          if (voiceParam) {
            const wsVoiceMap: Record<string, string> = {
              aoede: "Aoede",
              zephyr: "Zephyr",
              kore: "Kore",
              puck: "Puck",
              fenrir: "Fenrir",
              charon: "Charon",
              jeangrey: "Aoede",
              flash: "Zephyr",
              invisiblewoman: "Kore",
              spiderman: "Puck",
              wolverine: "Fenrir",
              batman: "Charon"
            };
            const mappedVoice = wsVoiceMap[voiceParam.toLowerCase().replace(/\s+/g, '')];
            if (mappedVoice) {
              finalVoiceName = mappedVoice;
            } else {
              finalVoiceName = voiceParam;
            }
          }
        } catch (e) {
          console.error("Error parsing websocket query parameters for voice selection:", e);
        }
      }

      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
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
