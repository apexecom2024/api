# Eburon AI - Copyable cURL API Examples

Use these examples to test the Pluto 1.0 platform and various backend API endpoints.

---

## 1. Configuration & Registry Endpoints

### List Whitelisted Models
```bash
curl -X GET "http://localhost:3000/api/config/models" \
  -H "accept: application/json"
```

### List Whitelisted Superhero Voices
```bash
curl -X GET "http://localhost:3000/api/config/voices" \
  -H "accept: application/json"
```

### Retrieve System Output Registries
```bash
curl -X GET "http://localhost:3000/api/config/output-registry" \
  -H "accept: application/json"
```

### Override Live System Prompt
```bash
curl -X POST "http://localhost:3000/api/config/system-prompt" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "You are Skyblade, a superhero flying secretary who serves Jo Lernout."
  }'
```

---

## 2. Interactive Handshake & Session Streaming

### Connect to Pluto 1.0 Live (Handshake)
```bash
curl -X POST "http://localhost:3000/api/live/connect" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "pluto-1.0-live",
    "voiceToken": "WmVwaHly",
    "responseModalities": ["audio"],
    "inputAudioTranscription": true,
    "outputAudioTranscription": true
  }'
```

### Disconnect and Destroy Context
```bash
curl -X POST "http://localhost:3000/api/live/disconnect" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123"
  }'
```

### Send Text Turn
```bash
curl -X POST "http://localhost:3000/api/live/send-text" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "text": "Hello Pluto, introduce yourself as an Eburon AI voice agent.",
    "turnComplete": true
  }'
```

### Feed Live Audio Chunks (Base64 PCM)
```bash
curl -X POST "http://localhost:3000/api/live/send-audio-chunk" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "mimeType": "audio/pcm;rate=16000",
    "audioBase64": "UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
  }'
```

### Emit Developer Functional Tool Response
```bash
curl -X POST "http://localhost:3000/api/live/tool-response" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "callId": "call_9821a",
    "response": {
      "status": "active",
      "eta": "10 minutes"
    }
  }'
```

### Connect to Live Server Sent Events Channel
```bash
curl -N "http://localhost:3000/api/live/events?sessionId=session_123"
```

### Downstream Live PCM Audio Feed
```bash
curl -N "http://localhost:3000/api/live/audio-stream?sessionId=session_123"
```

### Pull turn transcripts histories
```bash
curl -X GET "http://localhost:3000/api/live/transcripts?sessionId=session_123"
```

### Initialize Video WebSDK Stream Channel
```bash
curl -X POST "http://localhost:3000/api/live/video-stream" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "streamId": "vs_8932a",
    "resolution": "720p",
    "fps": 30,
    "codec": "VP8"
  }'
```

### Setup Direct Screen Share Ingestion channel
```bash
curl -X POST "http://localhost:3000/api/live/screen-share" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "source": "entire_screen",
    "fps": 5,
    "compressRatio": 0.8
  }'
```

---

## 3. Whitelisted Functional Business Integration Endpoints

### Initiate Package Returns Workflow
```bash
curl -X POST "http://localhost:3000/api/tools/start_return" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "100231",
    "reason": "Wrong item delivered"
  }'
```

### Lookup Order Status
```bash
curl -X POST "http://localhost:3000/api/tools/get_order_status" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "100231"
  }'
```

### Request Agent Handoff to Live Human Representative
```bash
curl -X POST "http://localhost:3000/api/tools/speak_to_representative" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123"
  }'
```

### Create Calendar Event
```bash
curl -X POST "http://localhost:3000/api/tools/create_calendar_event" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Eburon AI Briefing with Jo",
    "startTime": "2026-05-26T10:00:00Z",
    "endTime": "2026-05-26T11:00:00Z"
  }'
```

### Dispatch Automated Email
```bash
curl -X POST "http://localhost:3000/api/tools/send_email" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "boss@eburon.ai",
    "subject": "Eburon Status Summary",
    "body": "System fully active and calibrated."
  }'
```

### Set System Reminder
```bash
curl -X POST "http://localhost:3000/api/tools/set_reminder" \
  -H "Content-Type: application/json" \
  -d '{
    "time": "2026-05-25T18:00:00Z",
    "task": "Review Eburon handoff registers"
  }'
```

### Compute Turn-by-Turn Route Coordinates
```bash
curl -X POST "http://localhost:3000/api/tools/find_route" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "Brussels",
    "destination": "Ypres"
  }'
```

### Find Nearby Places Landmark Query
```bash
curl -X POST "http://localhost:3000/api/tools/find_nearby_places" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "50.8503,4.3517",
    "type": "office"
  }'
```

### Retrieve Traffic Delay Statistics
```bash
curl -X POST "http://localhost:3000/api/tools/get_traffic_info" \
  -H "Content-Type: application/json" \
  -d '{
    "sector": "R0 Ring Brussels"
  }'
```
