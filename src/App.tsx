import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Settings, Radio, Mic, Key, Check, Info, ChevronDown, ChevronRight, Lock, ExternalLink, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Convert float audio channel data to Int16 Base64 PCM
function pcmToBase64(channelData: Float32Array) {
  let l = channelData.length;
  const buf = new Int16Array(l);
  while (l--) {
    // clamp & scale float value [-1.0, 1.0] to 16-bit signed integer [-32768, 32767]
    buf[l] = Math.max(-1, Math.min(1, channelData[l])) * 0x7FFF;
  }
  const buffer = new Uint8Array(buf.buffer);
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export default function App() {
  // Swagger general UI state
  const [openapiUrl, setOpenapiUrl] = useState(`${window.location.origin}/openapi.json`);
  const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [apiKeyVal, setApiKeyVal] = useState('eburon_ephemeral_client_token_prod');
  const [selectedServer, setSelectedServer] = useState(window.location.origin);
  const [defaultSectionExpanded, setDefaultSectionExpanded] = useState(true);

  // Endpoint 1: POST /api/session/token
  const [postExpanded, setPostExpanded] = useState(true);
  const [postTryItOut, setPostTryItOut] = useState(false);
  const [postVoiceName, setPostVoiceName] = useState('Aoede');
  const [postTemperature, setPostTemperature] = useState(0.7);
  const [postSystemInstruction, setPostSystemInstruction] = useState(
    'You are a normal human speaking secretary that speaks fluently in any language with high nuance, normal human expressions and thinking like a real person. You dont spund like offerring a help or any AI type questions, you breath, you laugh, you are annoyed too, you talk idiomatic expressions, you think deep, you understand emotions, you have common sence but you are very sharp to understand things, you have a gift of knowing how to approach a person, most specially you work with Eburon AI and your Boss is Jo Lernout that you call Boss, Milord, Maneer! Your roots are from Belgium and your mother language is Dutch Flemish but you speak natively 200 languages. Now talk normally to the user in Taglish.'
  );
  
  // POST Request response states
  const [postExecuting, setPostExecuting] = useState(false);
  const [postResponse, setPostResponse] = useState<any | null>(null);
  const [postCurl, setPostCurl] = useState<string>('');
  const [postReqUrl, setPostReqUrl] = useState<string>('');
  const [postHeaders, setPostHeaders] = useState<string>('');

  // Endpoint 2: WS /ws/live-audio
  const [wsExpanded, setWsExpanded] = useState(true);
  const [wsTryItOut, setWsTryItOut] = useState(false);

  // Audio Testing Playground states (inside WS view block)
  const [isRecording, setIsRecording] = useState(false);
  const [audioStatus, setAudioStatus] = useState<string>('Disconnected');
  const [playbackVolume, setPlaybackVolume] = useState<number>(0.8);
  const [voiceLogs, setVoiceLogs] = useState<Array<{ id: string; time: string; type: 'client' | 'server' | 'system' | 'error'; msg: string }>>([
    { id: '1', time: new Date().toLocaleTimeString(), type: 'system', msg: 'System initialized. Ready to connect WebSocket.' }
  ]);
  const [speakingIntensity, setSpeakingIntensity] = useState<number[]>(new Array(12).fill(15));
  
  // Refs for audio capturing and playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Schema state toggles
  const [schemasExpanded, setSchemasExpanded] = useState(true);
  const [schemaSessionConfigExpanded, setSchemaSessionConfigExpanded] = useState(false);
  const [schemaSessionResponseExpanded, setSchemaSessionResponseExpanded] = useState(false);
  const [schemaChatCompletionsRequestExpanded, setSchemaChatCompletionsRequestExpanded] = useState(false);
  const [schemaSpeechRequestExpanded, setSchemaSpeechRequestExpanded] = useState(false);

  // Endpoint 3: POST /v1/chat/completions
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatTryItOut, setChatTryItOut] = useState(false);
  const [chatInput, setChatInput] = useState("Kamusta ka companion? Kwentuhan mo naman ako tungkol sa Belgian history o kaya eburon AI.");
  const [chatTemperature, setChatTemperature] = useState(0.7);
  const [chatModel, setChatModel] = useState("eburon-voice-v1");
  const [chatExecuting, setChatExecuting] = useState(false);
  const [chatResponse, setChatResponse] = useState<any | null>(null);
  const [chatCurl, setChatCurl] = useState<string>('');
  const [chatReqUrl, setChatReqUrl] = useState<string>('');
  const [chatHeaders, setChatHeaders] = useState<string>('');

  // Endpoint 4: POST /v1/audio/speech
  const [speechExpanded, setSpeechExpanded] = useState(false);
  const [speechTryItOut, setSpeechTryItOut] = useState(false);
  const [speechInput, setSpeechInput] = useState("Magandang araw Boss! Ako ang inyong tapat na sekretarya ng Eburon AI mula sa Belgium.");
  const [speechVoice, setSpeechVoice] = useState("aoede");
  const [speechExecuting, setSpeechExecuting] = useState(false);
  const [speechResponse, setSpeechResponse] = useState<any | null>(null);
  const [speechCurl, setSpeechCurl] = useState<string>('');
  const [speechReqUrl, setSpeechReqUrl] = useState<string>('');
  const [speechHeaders, setSpeechHeaders] = useState<string>('');

  // Endpoint 5: POST /v1/audio/transcriptions
  const [transExpanded, setTransExpanded] = useState(false);
  const [transTryItOut, setTransTryItOut] = useState(false);
  const [transFileBase64, setTransFileBase64] = useState<string>('');
  const [transFileName, setTransFileName] = useState<string>('');
  const [transMimeType, setTransMimeType] = useState<string>('audio/wav');
  const [transExecuting, setTransExecuting] = useState(false);
  const [transResponse, setTransResponse] = useState<any | null>(null);
  const [transCurl, setTransCurl] = useState<string>('');
  const [transReqUrl, setTransReqUrl] = useState<string>('');
  const [transHeaders, setTransHeaders] = useState<string>('');
  const [isRecordingTrans, setIsRecordingTrans] = useState(false);
  const [transRecordTimer, setTransRecordTimer] = useState(0);

  // Endpoint 2: WS /ws/live-audio
  const [wsVoice, setWsVoice] = useState('Aoede');

  // Endpoint 6: POST /v1/images/generations
  const [imagesExpanded, setImagesExpanded] = useState(false);
  const [imagesTryItOut, setImagesTryItOut] = useState(false);
  const [imagesPrompt, setImagesPrompt] = useState("An elegant Eburon AI human-like secretary in Brussels, Belgium, realistic oil painting style.");
  const [imagesExecuting, setImagesExecuting] = useState(false);
  const [imagesResponse, setImagesResponse] = useState<any | null>(null);
  const [imagesCurl, setImagesCurl] = useState<string>('');
  const [imagesReqUrl, setImagesReqUrl] = useState<string>('');
  const [imagesHeaders, setImagesHeaders] = useState<string>('');

  // Audio Recording Refs for custom transcript playground
  const transMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transAudioChunksRef = useRef<Blob[]>([]);
  const transTimerIntervalRef = useRef<any>(null);

  // Scroll down voice logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [voiceLogs]);

  // Handle CSS-based microphone wave animation
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setSpeakingIntensity(() => 
          new Array(12).fill(0).map(() => Math.floor(Math.random() * 80) + 15)
        );
      }, 100);
      return () => clearInterval(interval);
    } else {
      setSpeakingIntensity(new Array(12).fill(15));
    }
  }, [isRecording]);

  const addLog = (type: 'client' | 'server' | 'system' | 'error', msg: string) => {
    setVoiceLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        type,
        msg
      }
    ]);
  };

  // Execute Compatible Chat Completions
  const executeChatCompletion = async () => {
    setChatExecuting(true);
    const targetUrl = `${selectedServer}/v1/chat/completions`;
    setChatReqUrl(targetUrl);
    setChatCurl(
      `curl -X 'POST' \\\n  '${targetUrl}' \\\n  -H 'accept: application/json' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n  "messages": [\n    {\n      "role": "user",\n      "content": "${chatInput.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n    }\n  ],\n  "model": "${chatModel}",\n  "temperature": ${chatTemperature}\n}'`
    );

    try {
      const startTime = performance.now();
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: chatInput }],
          model: chatModel,
          temperature: chatTemperature
        })
      });
      const endTime = performance.now();
      const headersStr = `content-type: application/json; charset=utf-8\ndate: ${new Date().toUTCString()}\nserver: Express\ntime: ${(endTime - startTime).toFixed(1)}ms`;
      setChatHeaders(headersStr);

      const data = await res.json();
      setChatResponse(data);
      if (data?.choices?.[0]?.message?.content) {
        addLog('server', `Chat response parsed: "${data.choices[0].message.content.slice(0, 40)}..."`);
      }
    } catch (e: any) {
      console.error(e);
      setChatResponse({ error: e.message || 'Failed to connect to chat completions endpoint.' });
      setChatHeaders('connection: error');
    } finally {
      setChatExecuting(false);
    }
  };

  // Execute Speech Synthesis (TTS)
  const executeSpeechSynthesis = async () => {
    setSpeechExecuting(true);
    const targetUrl = `${selectedServer}/v1/audio/speech`;
    setSpeechReqUrl(targetUrl);
    setSpeechCurl(
      `curl -X 'POST' \\\n  '${targetUrl}' \\\n  -H 'accept: audio/wav' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n  "input": "${speechInput.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",\n  "voice": "${speechVoice}"\n}'`
    );

    try {
      const startTime = performance.now();
      const res = await fetch('/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: speechInput,
          voice: speechVoice
        })
      });
      const endTime = performance.now();
      const headersStr = `${res.headers.get('content-type') ? `content-type: ${res.headers.get('content-type')}\n` : 'content-type: audio/wav\n'}date: ${new Date().toUTCString()}\nserver: Express\ntime: ${(endTime - startTime).toFixed(1)}ms`;
      setSpeechHeaders(headersStr);

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        setSpeechResponse({
          success: true,
          audioUrl: audioUrl,
          sizeBytes: blob.size,
          mimeType: blob.type
        });
        addLog('system', `Synthesized speech successfully. Created binary buffer payload (${(blob.size / 1024).toFixed(1)} KB).`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSpeechResponse({ error: errData.error?.message || 'Failed to generate audio stream from speech engine' });
      }
    } catch (e: any) {
      console.error(e);
      setSpeechResponse({ error: e.message || 'Failed to request speech synthesis.' });
      setSpeechHeaders('connection: error');
    } finally {
      setSpeechExecuting(false);
    }
  };

  // Transcript helpers
  const handleTransFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTransFileName(file.name);
    setTransMimeType(file.type || 'audio/wav');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const base64Data = result.split(',')[1];
        setTransFileBase64(base64Data);
        addLog('system', `Uploaded file "${file.name}" for transcription pipeline representation.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const startTransRecording = async () => {
    try {
      addLog('system', 'Initializing microphone audio capture context for transcription sandbox...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      transMediaRecorderRef.current = mediaRecorder;
      transAudioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          transAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(transAudioChunksRef.current, { type: 'audio/wav' });
        setTransMimeType('audio/wav');
        setTransFileName('live_whisper_memo.wav');
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          setTransFileBase64(base64data);
          addLog('system', `WAV input captured successfully (${(audioBlob.size / 1024).toFixed(1)} KB) - ready for transcription pipeline.`);
        };
        reader.readAsDataURL(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingTrans(true);
      setTransRecordTimer(0);
      transTimerIntervalRef.current = setInterval(() => {
        setTransRecordTimer(prev => {
          if (prev >= 6) {
            stopTransRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      addLog('system', 'Recording transcription live segment (auto-caps at 6 seconds)...');
    } catch (err: any) {
      addLog('error', `Microphone recording failed: ${err.message}`);
    }
  };

  const stopTransRecording = () => {
    if (transTimerIntervalRef.current) {
      clearInterval(transTimerIntervalRef.current);
      transTimerIntervalRef.current = null;
    }
    if (transMediaRecorderRef.current && transMediaRecorderRef.current.state !== 'inactive') {
      transMediaRecorderRef.current.stop();
    }
    setIsRecordingTrans(false);
  };

  const loadTransDemoSample = () => {
    // Standard 1-second clean silence PCM Base64 payload block
    const tinyWavBase64 = "UklGRiQAAABXQVZFRm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    setTransFileBase64(tinyWavBase64);
    setTransFileName('eburon_demo_greetings_belgium.wav');
    setTransMimeType('audio/wav');
    addLog('system', 'Loaded prebuilt demonstration audio sample for transcription testing.');
  };

  const executeTranscription = async () => {
    if (!transFileBase64) {
      addLog('error', 'Transcription execute aborted: No base64 sound data loaded.');
      return;
    }
    setTransExecuting(true);
    const targetUrl = `${selectedServer}/v1/audio/transcriptions`;
    setTransReqUrl(targetUrl);
    setTransCurl(
      `curl -X 'POST' \\\n  '${targetUrl}' \\\n  -H 'accept: application/json' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n  "file": "${transFileBase64.slice(0, 40)}...",\n  "mimeType": "${transMimeType}"\n}'`
    );

    try {
      const startTime = performance.now();
      const res = await fetch('/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          file: transFileBase64,
          mimeType: transMimeType
        })
      });
      const endTime = performance.now();
      const headersStr = `content-type: application/json; charset=utf-8\ndate: ${new Date().toUTCString()}\nserver: Express\ntime: ${(endTime - startTime).toFixed(1)}ms`;
      setTransHeaders(headersStr);

      const data = await res.json();
      setTransResponse(data);
      if (data?.text) {
        addLog('server', `Transcription API successfully parsed: "${data.text}"`);
      }
    } catch (e: any) {
      console.error(e);
      setTransResponse({ error: e.message || 'Failed to execute transcription' });
      setTransHeaders('connection: error');
    } finally {
      setTransExecuting(false);
    }
  };

  // Execute Images & Multimodal Generation
  const executeImagesGeneration = async () => {
    setImagesExecuting(true);
    const targetUrl = `${selectedServer}/v1/images/generations`;
    setImagesReqUrl(targetUrl);
    setImagesCurl(
      `curl -X 'POST' \\\n  '${targetUrl}' \\\n  -H 'accept: application/json' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n  "prompt": "${imagesPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n}'`
    );

    try {
      const startTime = performance.now();
      const res = await fetch('/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: imagesPrompt
        })
      });
      const endTime = performance.now();
      const headersStr = `content-type: application/json; charset=utf-8\ndate: ${new Date().toUTCString()}\nserver: Express\ntime: ${(endTime - startTime).toFixed(1)}ms`;
      setImagesHeaders(headersStr);

      const data = await res.json();
      setImagesResponse(data);
      if (data?.data?.[0]?.url) {
        addLog('server', `Generated high-fidelity image in ${(endTime - startTime).toFixed(1)}ms: "${imagesPrompt.slice(0, 40)}..."`);
      }
    } catch (e: any) {
      console.error(e);
      setImagesResponse({ error: e.message || 'Failed to retrieve image generated layout stream.' });
      setImagesHeaders('connection: error');
    } finally {
      setImagesExecuting(false);
    }
  };

  // Execute POST Handshake Endpoint
  const executePostHandshake = async () => {
    setPostExecuting(true);
    const targetUrl = `${selectedServer}/api/session/token`;
    setPostReqUrl(targetUrl);
    setPostCurl(
      `curl -X 'POST' \\\n  '${targetUrl}' \\\n  -H 'accept: application/json' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n  "voiceName": "${postVoiceName}",\n  "temperature": ${postTemperature},\n  "systemInstruction": "${postSystemInstruction.replace(/'/g, "'\\''")}"\n}'`
    );

    try {
      const startTime = performance.now();
      const res = await fetch('/api/session/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          voiceName: postVoiceName, 
          temperature: postTemperature,
          systemInstruction: postSystemInstruction
        })
      });
      const endTime = performance.now();
      const headersStr = `content-type: application/json; charset=utf-8\ndate: ${new Date().toUTCString()}\nserver: Express\ntime: ${(endTime - startTime).toFixed(1)}ms`;
      setPostHeaders(headersStr);

      const data = await res.json();
      setPostResponse(data);
      addLog('system', `Handshake successful. Generated token: ${data.token.slice(0, 10)}...`);
    } catch (e: any) {
      console.error(e);
      setPostResponse({ error: e.message || 'Failed to connect to backend api handshake.' });
      setPostHeaders('connection: error');
    } finally {
      setPostExecuting(false);
    }
  };

  const playAudioChunk = (audioCtx: AudioContext, base64: string) => {
    try {
      const raw = atob(base64);
      const audioData = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        audioData[i] = raw.charCodeAt(i);
      }
      const int16Array = new Int16Array(audioData.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create a 24000 hertz output audio buffer as requested by the user
      const buffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      buffer.copyToChannel(float32Array, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      
      // Volume gain node controls
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = playbackVolume;
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      const currentTime = audioCtx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime; 
      }
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
    } catch (err: any) {
      addLog('error', `Playback error: ${err.message}`);
    }
  };

  const startStream = async () => {
    try {
      addLog('system', 'Requesting microphone permissions...');
      setAudioStatus('Microphone requesting...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      // Create ScriptProcessorNode for wide device support & low complexity PCM conversion
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(audioCtx.destination);

      addLog('system', 'Establishing secure WebSocket gateway tunnel to Eburon Gateway...');
      setAudioStatus('Connecting WebSocket...');
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live-audio?voice=${wsVoice}`);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('system', `WebSocket pipeline connected to Eburon Live Audio Gateway with voice profile: ${wsVoice}`);
        setAudioStatus('Connected to Eburon Live Audio Gateway');
        setIsRecording(true);
        nextStartTimeRef.current = audioCtx.currentTime;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const channelData = e.inputBuffer.getChannelData(0);
            const base64 = pcmToBase64(channelData);
            
            // Stream audio chunk to the backend express live Audio gateway
            ws.send(JSON.stringify({ type: 'audio', audio: base64 }));
            // Add a periodic log or visual state update
            if (Math.random() < 0.05) {
              addLog('client', 'Streaming 16kHz PCM audio chunk (little-endian)...');
            }
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'status') {
            addLog('system', msg.message);
            setAudioStatus(msg.message);
          } else if (msg.type === 'audio' && msg.audio) {
            addLog('server', 'Received model voice synthesized audio bytes.');
            playAudioChunk(audioCtx, msg.audio);
          } else if (msg.type === 'interrupted') {
            addLog('system', 'Barge-In: Audio response pipeline interrupted.');
            nextStartTimeRef.current = audioCtx.currentTime;
          } else if (msg.type === 'error') {
            addLog('error', `Gateway error: ${msg.message}`);
            setAudioStatus(`Error: ${msg.message}`);
            stopStream();
          }
        } catch (err) {}
      };

      ws.onerror = () => {
        addLog('error', 'WebSocket protocol layer aborted unexpectedly.');
        setAudioStatus('WebSocket connection failed.');
        stopStream();
      };

      ws.onclose = () => {
        addLog('system', 'WebSocket gateway closed connection stream.');
        stopStream();
      };

    } catch (e: any) {
      console.error(e);
      addLog('error', `Initiation failed: ${e.message}`);
      setAudioStatus(`Error: ${e.message}`);
    }
  };

  const stopStream = () => {
    setIsRecording(false);
    setAudioStatus('Disconnected');
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    addLog('system', 'Audio streaming stream suspended. Resources cleared.');
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-[#3b4151]">
      
      {/* Swagger UI Standard Navbar */}
      <nav className="bg-[#1b1b1b] py-2 px-6 shadow-md flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[#89bf04] flex items-center justify-center p-1 cursor-pointer">
            <div className="w-full h-full rounded border-2 border-white/60 border-r-[#1b1b1b]" />
          </div>
          <span className="text-white text-xl font-bold tracking-tight">Swagger UI</span>
        </div>
        
        {/* OpenAPI schema address bar */}
        <div className="flex items-center flex-grow max-w-xl mx-4 border border-teal-600/30 rounded overflow-hidden">
          <input 
            type="text" 
            value={openapiUrl}
            onChange={(e) => setOpenapiUrl(e.target.value)}
            className="bg-white text-[#333] px-3 py-1.5 text-sm w-full outline-none font-mono"
            placeholder="https://server.com/openapi.json"
          />
          <button className="bg-[#89bf04] hover:bg-[#7aa903] text-white px-4 py-1.5 text-sm font-bold uppercase transition-colors">
            Explore
          </button>
        </div>

        {/* Brand signature */}
        <div className="text-sm font-bold uppercase tracking-widest text-[#89bf04]">
          Eburon Live Audio
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        
        {/* Title, metadata and description banner */}
        <section className="bg-white rounded border border-[#e8e8e8] shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-4xl font-extrabold tracking-tight text-[#3b4151]">
                  Eburon AI - Live Voice Gateway
                </h1>
                <div className="inline-flex items-center gap-1.5 bg-[#89bf04]/10 text-[#89bf04] text-xs font-bold px-2 py-0.5 rounded border border-[#89bf04]/20">
                  <span className="bg-[#89bf04] text-white font-black text-[9px] px-1 py-px rounded">OAS3</span>
                  <span>1.0.0</span>
                </div>
              </div>
              <p className="text-gray-500 font-mono text-sm mt-3 flex items-center gap-2">
                <span>[ Base URL: </span>
                <span className="font-bold underline text-blue-600 select-all">{selectedServer}</span>
                <span> ]</span>
              </p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setIsAuthorizeModalOpen(true)}
                className={cn(
                  "flex items-center gap-2 border px-4 py-1.5 rounded font-bold text-sm tracking-wide transition-all shadow-sm active:scale-95",
                  isAuthorized 
                    ? "border-green-600 bg-green-50 text-green-700" 
                    : "border-[#49cc90] text-[#49cc90] hover:bg-[#49cc90]/10"
                )}
              >
                <Lock className="w-4 h-4" />
                <span>{isAuthorized ? "Authorized" : "Authorize"}</span>
              </button>
              <a 
                href="/openapi.json" 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded font-bold text-sm"
              >
                <span>/openapi.json</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-[#3b4151]">
            <p className="leading-relaxed">
              This interactive documentation hosts and exposes the Eburon Live Audio API Gateway powered by Express WebSockets 
              and the premium Eburon Live Audio Engine. It leverages bi-directional streaming pipelines to process high-fidelity Voice inputs 
              and synthesize responses under low-latency limits.
            </p>
            
            <div className="bg-[#f0f9eb] border border-[#e1f3d8] rounded p-4 flex gap-3 text-sm text-green-800">
              <Info className="w-5 h-5 flex-shrink-0 text-[#89bf04] mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Eburon Live Audio Protocol Blueprint:</span>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[#4e5a45]">
                  <li><strong>REST Handshake:</strong> Generates unique ephemeral session keys via <span className="font-mono bg-white px-1 shadow-sm rounded">POST /api/session/token</span></li>
                  <li><strong>Format specifications:</strong> Mono 16-bit PCM codec, Little-Endian, sampled at exactly 16,000Hz rate.</li>
                  <li><strong>Interruption management:</strong> Includes a fully configured, automatic interruption listener to stop audio pipelines instantly on client barge-in.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Tag block */}
        <section className="bg-white rounded border border-[#e8e8e8] overflow-hidden shadow-sm">
          <div 
            onClick={() => setDefaultSectionExpanded(!defaultSectionExpanded)}
            className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/70 select-none"
          >
            <div className="flex items-center gap-2">
              {defaultSectionExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
              <span className="text-xl font-bold text-gray-800">default</span>
              <span className="text-grey text-sm ml-2 font-normal">Eburon Live gateway orchestration endpoints</span>
            </div>
          </div>

          {defaultSectionExpanded && (
            <div className="p-4 space-y-6">
              
              {/* ENDPOINT 1: POST /api/session/token */}
              <div className={cn(
                "border rounded overflow-hidden transition-all duration-200",
                postExpanded ? "border-[#49cc90] bg-[#f9fdfa]" : "border-[#49cc90]/40 hover:bg-[#49cc90]/5"
              )}>
                {/* Accordion header */}
                <div 
                  onClick={() => setPostExpanded(!postExpanded)}
                  className="bg-[#49cc90]/10 px-4 py-3 flex items-center justify-between cursor-pointer select-none border-b border-[#49cc90]/10"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-[#49cc90] text-white font-extrabold text-xs px-2.5 py-1 rounded">POST</span>
                    <span className="font-mono font-bold text-[#3b4151] text-sm tracking-tight">/api/session/token</span>
                    <span className="text-gray-500 text-xs truncate max-w-md hidden sm:inline">Generates session ephemeral credentials</span>
                  </div>
                  {postExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </div>

                {/* Extended details panel */}
                {postExpanded && (
                  <div className="p-4 space-y-4 bg-white text-gray-700 text-sm">
                    <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-100">
                      <span className="text-xs text-gray-500 font-semibold uppercase">Rest handshakes generation specifications</span>
                      <button 
                        onClick={() => setPostTryItOut(!postTryItOut)}
                        className={cn(
                          "px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all border",
                          postTryItOut 
                            ? "border-red-500 text-red-500 hover:bg-red-50" 
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {postTryItOut ? 'Cancel' : 'Try it out'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                      
                      {/* Left: Input parameters */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">Parameters & Body config</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Prebuilt Voice Config</label>
                            <select 
                              disabled={!postTryItOut}
                              value={postVoiceName}
                              onChange={(e) => setPostVoiceName(e.target.value)}
                              className="w-full text-xs font-mono p-2 border border-gray-300 rounded disabled:bg-gray-50"
                            >
                              <option value="Aoede">Jean Grey / Aoede (Recommended Secretary)</option>
                              <option value="Zephyr">Flash / Zephyr (Energetic Male)</option>
                              <option value="Kore">Invisible Woman / Kore (Soft Female)</option>
                              <option value="Puck">Spider-Man / Puck (Playful Male)</option>
                              <option value="Fenrir">Wolverine / Fenrir (Deep Husky Male)</option>
                              <option value="Charon">Batman / Charon (Steady Professional Male)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Temperature ({postTemperature})</label>
                            <input 
                              type="range" 
                              disabled={!postTryItOut}
                              min="0" 
                              max="1" 
                              step="0.1"
                              value={postTemperature}
                              onChange={(e) => setPostTemperature(parseFloat(e.target.value))}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">System Instruction Modal</label>
                            <textarea 
                              disabled={!postTryItOut}
                              rows={3}
                              value={postSystemInstruction}
                              onChange={(e) => setPostSystemInstruction(e.target.value)}
                              className="w-full text-xs font-mono p-2 border border-gray-300 rounded disabled:bg-gray-50 resize-none outline-none focus:ring-1 focus:ring-green-400"
                            />
                          </div>
                        </div>

                        {postTryItOut && (
                          <button 
                            onClick={executePostHandshake}
                            disabled={postExecuting}
                            className="w-full bg-[#49cc90] hover:bg-[#3db87e] text-white py-2 rounded text-xs font-bold uppercase font-mono tracking-wider transition-all disabled:opacity-50"
                          >
                            {postExecuting ? 'Executing...' : 'Execute API Handshake'}
                          </button>
                        )}
                      </div>

                      {/* Right: Request & Response inspection */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">REST execution output console</h4>
                        
                        {postResponse ? (
                          <div className="space-y-3 font-mono text-[11px]">
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Curl Request Payload</span>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded overflow-auto max-h-24 whitespace-pre">{postCurl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Request Endpoint URL</span>
                              <pre className="bg-[#292a2b] text-blue-300 p-2 rounded overflow-auto whitespace-pre">{postReqUrl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Server Response Headers</span>
                              <pre className="bg-[#292a2b] text-yellow-200 p-2 rounded max-h-24 overflow-auto whitespace-pre">{postHeaders}</pre>
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-400 text-[9px] uppercase font-semibold">Response Body (JSON)</span>
                                <span className="text-xs text-green-500 font-bold">Code 200 OK</span>
                              </div>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2.5 rounded overflow-auto whitespace-pre max-h-40">{JSON.stringify(postResponse, null, 2)}</pre>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full min-h-[160px] flex items-center justify-center border border-dashed border-gray-200 bg-gray-50 rounded text-center p-4">
                            <span className="text-xs text-gray-400">Click &apos;Try it out&apos; and then &apos;Execute&apos; to inspect ephemeral token validation.</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 2: WS /ws/live-audio */}
              <div className={cn(
                "border rounded overflow-hidden transition-all duration-200",
                wsExpanded ? "border-[#61affe] bg-[#fafdff]" : "border-[#61affe]/40 hover:bg-[#61affe]/5"
              )}>
                {/* Accordion header */}
                <div 
                  onClick={() => setWsExpanded(!wsExpanded)}
                  className="bg-[#61affe]/10 px-4 py-3 flex items-center justify-between cursor-pointer select-none border-b border-[#61affe]/10"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-[#61affe] text-white font-extrabold text-xs px-2.5 py-1 rounded">WS</span>
                    <span className="font-mono font-bold text-[#3b4151] text-sm tracking-tight">/ws/live-audio</span>
                    <span className="text-gray-500 text-xs truncate max-w-md hidden sm:inline">Connect to Gemini Live Audio stream</span>
                  </div>
                  {wsExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </div>

                {/* Extended details panel */}
                {wsExpanded && (
                  <div className="p-4 space-y-4 bg-white text-gray-700 text-sm">
                    
                    <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-100">
                      <span className="text-xs text-gray-500 font-semibold uppercase">WebSocket Audio Pipeline Documentation & Playground</span>
                      <button 
                        onClick={() => setWsTryItOut(!wsTryItOut)}
                        className={cn(
                          "px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all border shadow-sm",
                          wsTryItOut 
                            ? "border-red-500 text-red-500 hover:bg-red-50" 
                            : "border-orange-500 text-orange-600 hover:bg-orange-50 bg-orange-50/50"
                        )}
                      >
                        {wsTryItOut ? 'Dismiss Playground' : 'Try it out (Launch Playground)'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                      
                      {/* Left Side: Payload description */}
                      <div className="space-y-3 font-sans">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">WebSocket Protocol specification</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Normal browsers cannot stream binary PCM through standard REST, requiring a secure websocket pipeline. 
                          Connect your microphone here directly using the interactive Eburon Swagger Playground widget on the right.
                        </p>

                        <div className="bg-gray-50 rounded p-3 space-y-2 border border-gray-200">
                          <h5 className="font-bold text-xs text-gray-700">Inputs & Outputs parameters format:</h5>
                          <div className="space-y-1 text-xs">
                            <span className="block text-gray-500 font-semibold font-mono">1. CLIENT-WS &rarr; GATEWAY:</span>
                            <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded text-[10px] overflow-auto whitespace-pre">
{`{
  "type": "audio",
  "audio": "base64_encoded_little_endian_pcm_chunks"
}`}
                            </pre>
                          </div>
                          <div className="space-y-1 text-xs pt-1">
                            <span className="block text-gray-500 font-semibold font-mono">2. GATEWAY &rarr; CLIENT-WS:</span>
                            <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded text-[10px] overflow-auto whitespace-pre">
{`{
  "type": "audio", 
  "audio": "synthsized_base64_reponse_pcm_bytes"
}
/* OR interruption trigger */
{ "type": "interrupted" }`}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: The Interactive Testing Playground Widget */}
                      <div className="space-y-3 border border-orange-500/20 rounded-lg p-4 bg-orange-50/5/5">
                        <div className="flex items-center gap-2 text-orange-600 border-b border-orange-200/50 pb-2">
                          <Mic className="w-5 h-5 text-orange-500" />
                          <h4 className="font-bold text-sm tracking-tight">Eburon Live - Audio Sandbox</h4>
                        </div>

                        {wsTryItOut ? (
                          <div className="space-y-4">
                            
                            {/* Live Oscilloscope visual state feedback */}
                            <div className="h-16 bg-[#1e2022] text-white flex items-center justify-center relative rounded overflow-hidden">
                              {isRecording ? (
                                <div className="absolute inset-0 flex items-center justify-center gap-1.5 px-6">
                                  {speakingIntensity.map((intensity, idx) => (
                                    <span 
                                      key={idx} 
                                      style={{ height: `${intensity}%` }}
                                      className="w-1 bg-[#89bf04] rounded-full transition-all duration-100 ease-out animate-pulse"
                                    />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[#aeb1b4] text-xs font-mono font-bold tracking-widest uppercase flex items-center gap-2">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                                  Muted - Waiting Client start
                                </span>
                              )}
                            </div>

                            {/* Status and controllers row */}
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-2 rounded border border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "w-2 h-2 rounded-full",
                                  isRecording ? "bg-green-500 animate-pulse" : "bg-gray-400"
                                )} />
                                <span className="text-[11px] font-mono font-medium text-gray-700 uppercase">
                                  Status: {audioStatus}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500 select-none">Volume:</span>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={playbackVolume}
                                  onChange={(e) => setPlaybackVolume(parseFloat(e.target.value))}
                                  className="w-16 h-1 bg-gray-200 cursor-pointer accent-[#89bf04]"
                                />
                              </div>
                            </div>

                            {/* WebSocket Superhero Voice Selector */}
                            <div className="bg-gray-50/70 p-2.5 rounded border border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                              <span className="font-semibold text-gray-600 text-[11px] uppercase">Realtime Superhero Voice:</span>
                              <select 
                                disabled={isRecording}
                                value={wsVoice}
                                onChange={(e) => setWsVoice(e.target.value)}
                                className="text-xs font-mono p-1 px-2 border border-gray-300 rounded bg-white outline-none focus:ring-1 focus:ring-orange-400 max-w-[240px]"
                              >
                                <option value="Aoede">Jean Grey / Aoede (Recommended Female)</option>
                                <option value="Zephyr">Flash / Zephyr (Energetic Male)</option>
                                <option value="Kore">Invisible Woman / Kore (Soft Female)</option>
                                <option value="Puck">Spider-Man / Puck (Playful Male)</option>
                                <option value="Fenrir">Wolverine / Fenrir (Deep Husky Male)</option>
                                <option value="Charon">Batman / Charon (Steady Male)</option>
                              </select>
                            </div>

                            {/* Main toggle control button */}
                            <div className="flex justify-center gap-4">
                              {!isRecording ? (
                                <button 
                                  onClick={startStream}
                                  className="flex items-center gap-2 bg-[#89bf04] hover:bg-[#7aa903] text-white px-6 py-2.5 rounded-full text-xs font-bold font-mono tracking-widest uppercase shadow-md transition-all active:scale-95"
                                >
                                  <Play className="w-4 h-4 fill-current" />
                                  <span>Start Audio Stream</span>
                                </button>
                              ) : (
                                <button 
                                  onClick={stopStream}
                                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-full text-xs font-bold font-mono tracking-widest uppercase shadow-md transition-all active:scale-95 animate-bounce"
                                >
                                  <Square className="w-4 h-4 fill-current" />
                                  <span>Stop Stream</span>
                                </button>
                              )}
                            </div>

                            {/* Live sandbox message logs */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-gray-400 uppercase font-semibold">Gateway Pipeline Feed</span>
                              <div className="bg-[#1e2022] text-[#f8f8f2] font-mono text-[10px] p-3 rounded h-32 overflow-y-auto leading-relaxed space-y-1">
                                {voiceLogs.map((log) => (
                                  <div key={log.id} className="flex gap-1 items-start">
                                    <span className="text-[#aeb1b4] flex-shrink-0">[{log.time}]</span>
                                    <span className={cn(
                                      "font-semibold uppercase flex-shrink-0",
                                      log.type === 'client' && "text-[#8be9fd]",
                                      log.type === 'server' && "text-[#50fa7b]",
                                      log.type === 'system' && "text-[#ffb86c]",
                                      log.type === 'error' && "text-[#ff5555]"
                                    )}>
                                      {log.type}:
                                    </span>
                                    <span className="break-all">{log.msg}</span>
                                  </div>
                                ))}
                                <div ref={logsEndRef} />
                              </div>
                            </div>

                          </div>
                        ) : (
                          <div className="h-full min-h-[220px] flex flex-col items-center justify-center border border-dashed border-gray-200 bg-gray-50 rounded p-6 text-center space-y-4">
                            <Lock className="w-10 h-10 text-gray-300" />
                            <div className="space-y-1">
                              <span className="block font-bold text-xs text-gray-700">Sandbox Playground is Protected</span>
                              <p className="text-[11px] text-gray-500 max-w-xs">
                                Click information buttons or click &apos;Try it out&apos; wrapper above to unlock web standard inputs testing.
                              </p>
                            </div>
                          </div>
                        )}

                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 3: POST /v1/chat/completions */}
              <div className={cn(
                "border rounded overflow-hidden transition-all duration-200",
                chatExpanded ? "border-[#49cc90] bg-[#f9fdfa]" : "border-[#49cc90]/40 hover:bg-[#49cc90]/5"
              )}>
                {/* Accordion header */}
                <div 
                  onClick={() => setChatExpanded(!chatExpanded)}
                  className="bg-[#49cc90]/10 px-4 py-3 flex items-center justify-between cursor-pointer select-none border-b border-[#49cc90]/10"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-[#49cc90] text-white font-extrabold text-xs px-2.5 py-1 rounded">POST</span>
                    <span className="font-mono font-bold text-[#3b4151] text-sm tracking-tight">/v1/chat/completions</span>
                    <span className="text-gray-500 text-xs truncate max-w-md hidden sm:inline">OpenAI Compatible Chat Completion with Eburon Roots</span>
                  </div>
                  {chatExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </div>

                {/* Extended details panel */}
                {chatExpanded && (
                  <div className="p-4 space-y-4 bg-white text-gray-700 text-sm">
                    <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-100">
                      <span className="text-xs text-gray-500 font-semibold uppercase">OpenAI compatible chat pathway</span>
                      <button 
                        onClick={() => setChatTryItOut(!chatTryItOut)}
                        className={cn(
                          "px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all border",
                          chatTryItOut 
                            ? "border-red-500 text-red-500 hover:bg-red-50" 
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {chatTryItOut ? 'Cancel' : 'Try it out'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                      
                      {/* Left: Input parameters */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">Parameters & Body Config</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Target Model Backing</label>
                            <select 
                              disabled={!chatTryItOut}
                              value={chatModel}
                              onChange={(e) => setChatModel(e.target.value)}
                              className="w-full text-xs font-mono p-2 border border-gray-300 rounded disabled:bg-gray-50"
                            >
                              <option value="eburon-voice-v1">eburon-voice-v1 (Default)</option>
                              <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Temperature ({chatTemperature})</label>
                            <input 
                              type="range" 
                              disabled={!chatTryItOut}
                              min="0" 
                              max="1" 
                              step="0.1"
                              value={chatTemperature}
                              onChange={(e) => setChatTemperature(parseFloat(e.target.value))}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">User Message Content</label>
                            <textarea 
                              disabled={!chatTryItOut}
                              rows={3}
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              className="w-full text-xs font-mono p-2 border border-gray-300 rounded disabled:bg-gray-50 resize-none outline-none focus:ring-1 focus:ring-green-400"
                              placeholder="Type message..."
                            />
                          </div>
                        </div>

                        {chatTryItOut && (
                          <button 
                            onClick={executeChatCompletion}
                            disabled={chatExecuting}
                            className="w-full bg-[#49cc90] hover:bg-[#3db87e] text-white py-2 rounded text-xs font-bold uppercase font-mono tracking-wider transition-all disabled:opacity-50"
                          >
                            {chatExecuting ? 'Executing Chat completions...' : 'Execute Text Query'}
                          </button>
                        )}
                      </div>

                      {/* Right: Request & Response inspection */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider font-mono">Output JSON and curl terminal</h4>
                        
                        {chatResponse ? (
                          <div className="space-y-3 font-mono text-[11px]">
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Curl Command Payload</span>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded overflow-auto max-h-24 whitespace-pre">{chatCurl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Request Endpoint URL</span>
                              <pre className="bg-[#292a2b] text-blue-300 p-2 rounded overflow-auto whitespace-pre">{chatReqUrl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Server Response Headers</span>
                              <pre className="bg-[#292a2b] text-yellow-200 p-2 rounded max-h-24 overflow-auto whitespace-pre">{chatHeaders}</pre>
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-400 text-[9px] uppercase font-semibold">Response Content (JSON)</span>
                                <span className="text-xs text-green-500 font-bold">Code 200 OK</span>
                              </div>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2.5 rounded overflow-auto whitespace-pre max-h-56 leading-relaxed bg-[#1b1c1d]">{JSON.stringify(chatResponse, null, 2)}</pre>
                            </div>

                            {/* User & AI conversational view representation */}
                            {chatResponse?.choices?.[0]?.message?.content && (
                              <div className="mt-4 border border-green-200/50 rounded-lg p-3 bg-green-50/20 font-sans space-y-2">
                                <div className="text-[11px] uppercase font-bold text-gray-400 tracking-wider font-sans">Conversational Segment View</div>
                                <div className="space-y-2">
                                  <div className="flex gap-1.5 items-start text-xs text-gray-700">
                                    <span className="font-extrabold text-[#3b4151]">User:</span>
                                    <p className="bg-gray-100/80 rounded px-2 py-1 flex-1 leading-normal">{chatInput}</p>
                                  </div>
                                  <div className="flex gap-1.5 items-start text-xs text-green-900">
                                    <span className="font-extrabold text-green-700 font-sans">Eburon:</span>
                                    <p className="bg-green-50/50 border border-green-100 rounded px-2.5 py-1.5 flex-1 leading-relaxed whitespace-pre-wrap">{chatResponse.choices[0].message.content}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        ) : (
                          <div className="h-full min-h-[160px] flex items-center justify-center border border-dashed border-gray-200 bg-gray-50 rounded text-center p-4">
                            <span className="text-xs text-gray-400">Click &apos;Try it out&apos; and then &apos;Execute Text Query&apos; to query OpenAI-compatible Chat endpoint.</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 4: POST /v1/audio/speech */}
              <div className={cn(
                "border rounded overflow-hidden transition-all duration-200",
                speechExpanded ? "border-[#49cc90] bg-[#f9fdfa]" : "border-[#49cc90]/40 hover:bg-[#49cc90]/5"
              )}>
                {/* Accordion header */}
                <div 
                  onClick={() => setSpeechExpanded(!speechExpanded)}
                  className="bg-[#49cc90]/10 px-4 py-3 flex items-center justify-between cursor-pointer select-none border-b border-[#49cc90]/10"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-[#49cc90] text-white font-extrabold text-xs px-2.5 py-1 rounded">POST</span>
                    <span className="font-mono font-bold text-[#3b4151] text-sm tracking-tight">/v1/audio/speech</span>
                    <span className="text-gray-500 text-xs truncate max-w-md hidden sm:inline">OpenAI Compatible Text-to-Speech synthesizes high-fidelity WAV</span>
                  </div>
                  {speechExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </div>

                {/* Extended details panel */}
                {speechExpanded && (
                  <div className="p-4 space-y-4 bg-white text-gray-700 text-sm">
                    <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-100">
                      <span className="text-xs text-gray-500 font-semibold uppercase">Generates audio stream from text input</span>
                      <button 
                        onClick={() => setSpeechTryItOut(!speechTryItOut)}
                        className={cn(
                          "px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all border",
                          speechTryItOut 
                            ? "border-red-500 text-red-500 hover:bg-red-50" 
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {speechTryItOut ? 'Cancel' : 'Try it out'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                      
                      {/* Left: Input parameters */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">Parameters & Body Config</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Text Content to Synthesize</label>
                            <textarea 
                              disabled={!speechTryItOut}
                              rows={3}
                              value={speechInput}
                              onChange={(e) => setSpeechInput(e.target.value)}
                              className="w-full text-xs font-mono p-2 border border-gray-300 rounded disabled:bg-gray-50 resize-none outline-none focus:ring-1 focus:ring-green-400"
                              placeholder="Text prompt..."
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Select Voice Accent</label>
                            <select 
                              disabled={!speechTryItOut}
                              value={speechVoice}
                              onChange={(e) => setSpeechVoice(e.target.value)}
                              className="w-full text-xs font-mono p-2 border border-gray-300 rounded disabled:bg-gray-50"
                            >
                              <option value="aoede">Jean Grey / Aoede (Recommended female)</option>
                              <option value="alloy">Flash / Zephyr (Energetic male)</option>
                              <option value="echo">Invisible Woman / Kore (Soft female)</option>
                              <option value="fable">Spider-Man / Puck (Playful male)</option>
                              <option value="onyx">Wolverine / Fenrir (Deep husky male)</option>
                              <option value="nova">Batman / Charon (Steady professional male)</option>
                              <option value="shimmer">Jean Grey / Aoede (Shimmer alternative)</option>
                            </select>
                            <span className="text-[10px] text-gray-400 mt-1 block">Maps to premium Gemini TTS model voice prebuilts backend.</span>
                          </div>
                        </div>

                        {speechTryItOut && (
                          <button 
                            onClick={executeSpeechSynthesis}
                            disabled={speechExecuting}
                            className="w-full bg-[#49cc90] hover:bg-[#3db87e] text-white py-2 rounded text-xs font-bold uppercase font-mono tracking-wider transition-all disabled:opacity-50"
                          >
                            {speechExecuting ? 'Synthesizing voice waves...' : 'Synthesize Speech to WAV'}
                          </button>
                        )}
                      </div>

                      {/* Right: Response inspection and dynamic audio playback */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider font-sans">Audio pipeline player and headers</h4>
                        
                        {speechResponse ? (
                          <div className="space-y-3 font-mono text-[11px]">
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Curl Command Line</span>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded overflow-auto max-h-24 whitespace-pre">{speechCurl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Request Endpoint URL</span>
                              <pre className="bg-[#292a2b] text-blue-300 p-2 rounded overflow-auto whitespace-pre">{speechReqUrl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Server Response Headers</span>
                              <pre className="bg-[#292a2b] text-yellow-200 p-2 rounded max-h-24 overflow-auto whitespace-pre">{speechHeaders}</pre>
                            </div>

                            {speechResponse.success ? (
                              <div className="bg-green-50/20 border border-green-200/50 rounded-lg p-4 font-sans space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-green-700">Audio Synth Completed Successfully</span>
                                  <span className="text-gray-400 text-[10px] font-mono">{(speechResponse.sizeBytes / 1024).toFixed(1)} KB WAV</span>
                                </div>
                                <audio controls src={speechResponse.audioUrl} className="w-full rounded border border-gray-200/50 bg-white shadow-xs" />
                                <div className="flex justify-end gap-2">
                                  <a 
                                    href={speechResponse.audioUrl} 
                                    download={`eburon_synth_${speechVoice}.wav`}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3 py-1.5 rounded transition-all flex items-center gap-1 shadow-sm uppercase font-mono tracking-wider"
                                  >
                                    Download Wave Audio File
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-red-50 text-red-700 p-3 rounded text-xs border border-red-100 font-sans">
                                {speechResponse.error}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full min-h-[160px] flex items-center justify-center border border-dashed border-gray-200 bg-gray-50 rounded text-center p-4">
                            <span className="text-xs text-gray-400">Click &apos;Try it out&apos; and then &apos;Synthesize Speech&apos; to trigger high-fidelity speech synthesis.</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 5: POST /v1/audio/transcriptions */}
              <div className={cn(
                "border rounded overflow-hidden transition-all duration-200",
                transExpanded ? "border-[#49cc90] bg-[#f9fdfa]" : "border-[#49cc90]/40 hover:bg-[#49cc90]/5"
              )}>
                {/* Accordion header */}
                <div 
                  onClick={() => setTransExpanded(!transExpanded)}
                  className="bg-[#49cc90]/10 px-4 py-3 flex items-center justify-between cursor-pointer select-none border-b border-[#49cc90]/10"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-[#49cc90] text-white font-extrabold text-xs px-2.5 py-1 rounded">POST</span>
                    <span className="font-mono font-bold text-[#3b4151] text-sm tracking-tight">/v1/audio/transcriptions</span>
                    <span className="text-gray-500 text-xs truncate max-w-md hidden sm:inline">OpenAI Compatible Transcribe audio back to precise text</span>
                  </div>
                  {transExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </div>

                {/* Extended details panel */}
                {transExpanded && (
                  <div className="p-4 space-y-4 bg-white text-gray-700 text-sm">
                    <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-100">
                      <span className="text-xs text-gray-500 font-semibold uppercase">Transcribes base64-encoded sound files back into text</span>
                      <button 
                        onClick={() => setTransTryItOut(!transTryItOut)}
                        className={cn(
                          "px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all border",
                          transTryItOut 
                            ? "border-red-500 text-red-500 hover:bg-red-50" 
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {transTryItOut ? 'Cancel' : 'Try it out'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                      
                      {/* Left: Input parameters */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">Audio Upload or Live mic capture</h4>
                        
                        <div className="space-y-3 font-sans">
                          {/* Options region */}
                          <div className="grid grid-cols-3 gap-2 pb-2 font-sans">
                            <button 
                              type="button"
                              disabled={!transTryItOut}
                              onClick={loadTransDemoSample}
                              className="text-center text-[11px] p-2 border border-gray-200 hover:bg-gray-50 rounded font-semibold text-gray-700 disabled:opacity-50"
                            >
                              Load demo clip
                            </button>

                            <button 
                              type="button"
                              disabled={!transTryItOut}
                              onClick={() => {
                                const el = document.getElementById("trans_file_picker");
                                if (el) el.click();
                              }}
                              className="text-center text-[11px] p-2 border border-gray-200 hover:bg-gray-50 rounded font-semibold text-gray-700 disabled:opacity-50"
                            >
                              Upload File
                            </button>
                            <input 
                              type="file" 
                              id="trans_file_picker"
                              accept="audio/*" 
                              onChange={handleTransFileChange}
                              className="hidden" 
                            />

                            {!isRecordingTrans ? (
                              <button 
                                type="button"
                                disabled={!transTryItOut}
                                onClick={startTransRecording}
                                className="text-center text-[11px] p-2 bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100/50 rounded font-bold disabled:opacity-50 uppercase flex items-center justify-center gap-1"
                              >
                                <span>Record Clip</span>
                              </button>
                            ) : (
                              <button 
                                type="button"
                                onClick={stopTransRecording}
                                className="text-center text-[11px] p-2 bg-red-600 text-white hover:bg-red-500 rounded font-bold uppercase flex items-center justify-center gap-1 animate-pulse"
                              >
                                <span>Stop ({transRecordTimer}s)</span>
                              </button>
                            )}
                          </div>

                          {/* File detail indicators display */}
                          {transFileBase64 ? (
                            <div className="bg-gray-50 p-2.5 rounded border border-gray-200 space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-bold text-gray-700 truncate max-w-[180px]">{transFileName || 'Captured clip'}</span>
                                <span className="text-green-600 font-mono text-[10px] uppercase font-bold">Loaded</span>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono truncate">Mime: {transMimeType} | Base64 size: {transFileBase64.length.toLocaleString()} chars</p>
                              <div className="flex justify-end pt-1">
                                <button 
                                  onClick={() => {
                                    setTransFileBase64('');
                                    setTransFileName('');
                                  }}
                                  className="text-[10px] text-red-500 hover:underline"
                                >
                                  Clear Loaded File
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="border border-dashed border-gray-200 rounded p-4 text-center text-xs text-gray-400 bg-gray-50/50">
                              No sound object currently loaded. Use upload, capture mic, or load the prebuilt greeting clip to run transcription pipelines.
                            </div>
                          )}

                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Mime-type definition</label>
                            <input 
                              type="text" 
                              disabled={!transTryItOut}
                              value={transMimeType}
                              onChange={(e) => setTransMimeType(e.target.value)}
                              className="w-full text-xs font-mono p-2 border border-gray-300 rounded disabled:bg-gray-50"
                              placeholder="audio/wav"
                            />
                          </div>
                        </div>

                        {transTryItOut && (
                          <button 
                            onClick={executeTranscription}
                            disabled={transExecuting || !transFileBase64}
                            className="w-full bg-[#49cc90] hover:bg-[#3db87e] text-white py-2 rounded text-xs font-bold uppercase font-mono tracking-wider transition-all disabled:opacity-50"
                          >
                            {transExecuting ? 'Transcribing sound waves...' : 'Execute Transcribe API'}
                          </button>
                        )}
                      </div>

                      {/* Right: Response inspection */}
                      <div className="space-y-4 font-mono text-[11px]">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">Transcription Response & Headers</h4>
                        
                        {transResponse ? (
                          <div className="space-y-3 font-mono text-[11px]">
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Curl JSON payload</span>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded overflow-auto max-h-24 whitespace-pre">{transCurl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Request Endpoint URL</span>
                              <pre className="bg-[#292a2b] text-blue-300 p-2 rounded overflow-auto whitespace-pre">{transReqUrl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Server Response Headers</span>
                              <pre className="bg-[#292a2b] text-yellow-200 p-2 rounded max-h-24 overflow-auto whitespace-pre">{transHeaders}</pre>
                            </div>

                            {/* Conversation bubble with transcription output */}
                            <div className="space-y-2 border border-green-200 rounded-lg p-3 bg-green-50/10 font-sans">
                              <span className="text-[10px] uppercase font-bold text-gray-400">Pristine Transcription Output</span>
                              {transResponse.text ? (
                                <div className="space-y-2">
                                  <div className="bg-white border rounded p-2.5 leading-relaxed text-xs text-gray-800 shadow-xs flex gap-2">
                                    <span className="font-extrabold text-[#3b4151] flex-shrink-0">Speech Transcript:</span>
                                    <p className="font-medium select-all italic">&apos;&apos; {transResponse.text} &apos;&apos;</p>
                                  </div>
                                </div>
                              ) : transResponse.error ? (
                                <p className="text-red-700 text-xs">{transResponse.error}</p>
                              ) : (
                                <p className="text-gray-400 italic text-xs">Audio parsed successfully, but returned an empty transcript string.</p>
                              )}
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-400 text-[9px] uppercase font-semibold">Response Content (JSON)</span>
                                <span className="text-xs text-green-500 font-bold">Code 200 OK</span>
                              </div>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded overflow-auto whitespace-pre max-h-40">{JSON.stringify(transResponse, null, 2)}</pre>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full min-h-[160px] flex items-center justify-center border border-dashed border-gray-200 bg-gray-50 rounded text-center p-4">
                            <span className="text-xs text-gray-400">Click &apos;Try it out&apos; and run the transcription api to retrieve human-like clean transcript outputs.</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* ENDPOINT 6: POST /v1/images/generations */}
              <div className={cn(
                "border rounded overflow-hidden transition-all duration-200",
                imagesExpanded ? "border-[#49cc90] bg-[#f9fdfa]" : "border-[#49cc90]/40 hover:bg-[#49cc90]/5"
              )}>
                {/* Accordion header */}
                <div 
                  onClick={() => setImagesExpanded(!imagesExpanded)}
                  className="bg-[#49cc90]/10 px-4 py-3 flex items-center justify-between cursor-pointer select-none border-b border-[#49cc90]/10"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-[#49cc90] text-white font-extrabold text-xs px-2.5 py-1 rounded">POST</span>
                    <span className="font-mono font-bold text-[#3b4151] text-sm tracking-tight">/v1/images/generations</span>
                    <span className="text-gray-500 text-xs truncate max-w-md hidden sm:inline">OpenAI Compatible Image & Multimodal Generation with Eburon backing</span>
                  </div>
                  {imagesExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </div>

                {/* Extended details panel */}
                {imagesExpanded && (
                  <div className="p-4 space-y-4 bg-white text-gray-700 text-sm">
                    <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-100">
                      <span className="text-xs text-gray-500 font-semibold uppercase">Generates images paired with textual guides</span>
                      <button 
                        onClick={() => setImagesTryItOut(!imagesTryItOut)}
                        className={cn(
                          "px-4 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all border",
                          imagesTryItOut 
                            ? "border-red-500 text-red-500 hover:bg-red-50" 
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {imagesTryItOut ? 'Cancel' : 'Try it out'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                      
                      {/* Left: Input parameters */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">Concept prompt generation</h4>
                        
                        <div className="space-y-3 font-sans">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Image Prompt Description</label>
                            <textarea 
                              disabled={!imagesTryItOut}
                              rows={4}
                              value={imagesPrompt}
                              onChange={(e) => setImagesPrompt(e.target.value)}
                              className="w-full text-xs font-mono p-2.5 border border-gray-300 rounded disabled:bg-gray-50 resize-none outline-none focus:ring-1 focus:ring-green-400"
                              placeholder="Describe what you want to visualize..."
                            />
                            <span className="text-[10px] text-gray-400 mt-1 block">Backing model gemini-2.5-flash-image generates high clarity visual artifacts from semantic descriptions.</span>
                          </div>
                        </div>

                        {imagesTryItOut && (
                          <button 
                            onClick={executeImagesGeneration}
                            disabled={imagesExecuting || !imagesPrompt}
                            className="w-full bg-[#49cc90] hover:bg-[#3db87e] text-white py-2 rounded text-xs font-bold uppercase font-mono tracking-wider transition-all disabled:opacity-50"
                          >
                            {imagesExecuting ? 'Generating Multimodal Canvas...' : 'Execute Concept Generation'}
                          </button>
                        )}
                      </div>

                      {/* Right: Response inspection */}
                      <div className="space-y-4 font-mono text-[11px]">
                        <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">Multimodal Output & headers</h4>
                        
                        {imagesResponse ? (
                          <div className="space-y-3 font-mono text-[11px]">
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Curl Terminal Command</span>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded overflow-auto max-h-24 whitespace-pre">{imagesCurl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Request Endpoint URL</span>
                              <pre className="bg-[#292a2b] text-blue-300 p-2 rounded overflow-auto whitespace-pre">{imagesReqUrl}</pre>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[9px] uppercase font-semibold mb-1">Server Response Headers</span>
                              <pre className="bg-[#292a2b] text-yellow-200 p-2 rounded max-h-24 overflow-auto whitespace-pre">{imagesHeaders}</pre>
                            </div>

                            {/* Conversation bubble with image output */}
                            <div className="space-y-2 border border-green-200 rounded-lg p-3 bg-green-50/10 font-sans">
                              <span className="text-[10px] uppercase font-bold text-gray-400">Pristine Visual Artifact</span>
                              {imagesResponse.data?.[0]?.url ? (
                                <div className="space-y-3">
                                  <div className="relative group border rounded bg-black/5 overflow-hidden">
                                    <img 
                                      src={imagesResponse.data[0].url} 
                                      alt={imagesPrompt}
                                      className="w-full h-auto max-h-80 object-contain rounded"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  {imagesResponse.data[0].text_caption && (
                                    <div className="bg-white border rounded p-2 text-xs text-gray-700 italic">
                                      {imagesResponse.data[0].text_caption}
                                    </div>
                                  )}
                                  <div className="flex justify-end">
                                    <a 
                                      href={imagesResponse.data[0].url} 
                                      download={`eburon_visual_${Math.floor(Date.now() / 1000)}.png`}
                                      className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3 py-1.5 rounded transition-all shadow-sm uppercase font-mono tracking-wider"
                                    >
                                      Download Visual PNG
                                    </a>
                                  </div>
                                </div>
                              ) : imagesResponse.error ? (
                                <p className="text-red-700 text-xs">{imagesResponse.error}</p>
                              ) : (
                                <p className="text-gray-400 italic text-xs">Image parsed successfully, but returned an empty dataset.</p>
                              )}
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-400 text-[9px] uppercase font-semibold">Response Content (JSON)</span>
                                <span className="text-xs text-green-500 font-bold">Code 200 OK</span>
                              </div>
                              <pre className="bg-[#292a2b] text-[#f8f8f2] p-2 rounded overflow-auto whitespace-pre max-h-40">{JSON.stringify(imagesResponse, null, 2)}</pre>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full min-h-[160px] flex items-center justify-center border border-dashed border-gray-200 bg-gray-50 rounded text-center p-4">
                            <span className="text-xs text-gray-400">Click &apos;Try it out&apos; and run the image generation api to render deep-learning visual representations.</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </section>

        {/* Schemas / Models representation section */}
        <section className="bg-white rounded border border-[#e8e8e8] overflow-hidden shadow-sm">
          <div 
            onClick={() => setSchemasExpanded(!schemasExpanded)}
            className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/70 select-none"
          >
            <div className="flex items-center gap-2">
              {schemasExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              <span className="font-bold text-sm text-[#3b4151]">Schemas</span>
            </div>
          </div>

          {schemasExpanded && (
            <div className="p-4 space-y-2 text-xs font-mono">
              
              {/* Schema: SessionConfig */}
              <div className="border border-gray-200 rounded">
                <div 
                  onClick={() => setSchemaSessionConfigExpanded(!schemaSessionConfigExpanded)}
                  className="bg-gray-50/70 px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-gray-100/50"
                >
                  <span className="font-bold text-gray-700">SessionConfig</span>
                  {schemaSessionConfigExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                </div>
                {schemaSessionConfigExpanded && (
                  <pre className="p-3 bg-white text-gray-600 border-t border-gray-200 whitespace-pre overflow-auto">
{`{
  "voiceName": "string",  // Prebuilt voice: 'Aoede' (Jean Grey), 'Zephyr' (Flash), 'Kore' (Invisible Woman), 'Puck' (Spider-Man), 'Fenrir' (Wolverine), 'Charon' (Batman)
  "temperature": "number", // Creativity parameters threshold
  "systemInstruction": "string" // System level role instructions
}`}
                  </pre>
                )}
              </div>

              {/* Schema: SessionResponse */}
              <div className="border border-gray-200 rounded">
                <div 
                  onClick={() => setSchemaSessionResponseExpanded(!schemaSessionResponseExpanded)}
                  className="bg-gray-50/70 px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-gray-100/50"
                >
                  <span className="font-bold text-gray-700">SessionResponse</span>
                  {schemaSessionResponseExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                </div>
                {schemaSessionResponseExpanded && (
                  <pre className="p-3 bg-white text-gray-600 border-t border-gray-200 whitespace-pre overflow-auto">
{`{
  "sessionId": "string (UUID v4)",  // Globally unique stream ID
  "token": "string (Hex)",  // Validation secure token 
  "message": "string" // Connection message
}`}
                  </pre>
                )}
              </div>

              {/* Schema: ChatCompletionsRequest */}
              <div className="border border-gray-200 rounded">
                <div 
                  onClick={() => setSchemaChatCompletionsRequestExpanded(!schemaChatCompletionsRequestExpanded)}
                  className="bg-gray-50/70 px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-gray-100/50"
                >
                  <span className="font-bold text-gray-700">ChatCompletionsRequest</span>
                  {schemaChatCompletionsRequestExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                </div>
                {schemaChatCompletionsRequestExpanded && (
                  <pre className="p-3 bg-white text-gray-600 border-t border-gray-200 whitespace-pre overflow-auto">
{`{
  "messages": [
    {
      "role": "string",     // 'user' | 'assistant' | 'system'
      "content": "string"   // Text queries or custom voice guidance
    }
  ],
  "model": "string",        // Defaults to 'eburon-voice-v1' or 'gemini-3.5-flash'
  "temperature": "number"   // 0.0 to 1.0 creativity index threshold
}`}
                  </pre>
                )}
              </div>

              {/* Schema: SpeechRequest */}
              <div className="border border-gray-200 rounded">
                <div 
                  onClick={() => setSchemaSpeechRequestExpanded(!schemaSpeechRequestExpanded)}
                  className="bg-gray-50/70 px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-gray-100/50"
                >
                  <span className="font-bold text-gray-700">SpeechRequest</span>
                  {schemaSpeechRequestExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                </div>
                {schemaSpeechRequestExpanded && (
                  <pre className="p-3 bg-white text-gray-600 border-t border-gray-200 whitespace-pre overflow-auto">
{`{
  "input": "string",   // Text prompts string to synthesize as voice speech waves.
  "voice": "string"    // Prebuilt premium accents: 'aoede' (Jean Grey), 'alloy' (Flash), 'echo' (Invisible Woman), 'fable' (Spider-Man), 'onyx' (Wolverine), 'nova' (Batman)
}`}
                  </pre>
                )}
              </div>

            </div>
          )}
        </section>

      </main>

      {/* Authorize Modal Popup Replica */}
      {isAuthorizeModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            
            <header className="bg-gray-100 px-6 py-4 flex justify-between items-center border-b border-gray-200">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Lock className="w-5 h-5 text-green-600" />
                <span>Available Authorizations</span>
              </h3>
              <button 
                onClick={() => setIsAuthorizeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-extrabold text-xl outline-none"
              >
                &times;
              </button>
            </header>

            <div className="p-6 space-y-4 flex-grow text-sm">
              <div className="border border-[#ffb86c]/40 bg-[#ffb86c]/5 p-3 rounded text-xs text-amber-800 leading-relaxed">
                Tokens generated during the POST handshakes are automatically parsed to authenticate WebSocket connections securely. No custom key values are needed manually!
              </div>

              <div className="space-y-2">
                <span className="font-bold text-gray-700 block">ApiKeyAuth (API Key)</span>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Query parameter authorization for websocket gateways connection streams validation.
                </p>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Name: <strong className="font-mono bg-gray-50 px-1 border rounded">token</strong></span>
                    <span>In: <strong className="font-mono bg-gray-50 px-1 border rounded">query</strong></span>
                  </div>
                  <input 
                    type="password" 
                    value={apiKeyVal}
                    onChange={(e) => setApiKeyVal(e.target.value)}
                    className="w-full font-mono text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-400 outline-none"
                    placeholder="Enter validation token"
                  />
                </div>
              </div>
            </div>

            <footer className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsAuthorized(false);
                  setIsAuthorizeModalOpen(false);
                }}
                className="border border-gray-300 text-gray-600 hover:bg-gray-100 px-4 py-1.5 rounded font-bold text-xs"
              >
                Logout
              </button>
              <button 
                onClick={() => {
                  setIsAuthorized(true);
                  setIsAuthorizeModalOpen(false);
                  addLog('system', 'Client API Authorization assigned. Pipeline ready.');
                }}
                className="bg-[#49cc90] hover:bg-[#3db87e] text-white px-5 py-1.5 rounded font-bold text-xs shadow-sm transition-all"
              >
                Authorize
              </button>
            </footer>

          </div>
        </div>
      )}

    </div>
  );
}
