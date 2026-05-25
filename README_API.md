# Eburon AI Live Audio API Integration & Pluto 1.0 specifications

This document details the whitelisted developer API surface for Eburon AI integrated systems running Pluto 1.0 (`pluto-1.0-live`). 

The system maps the user-facing `pluto-1.0-live` model directly to the high-quality `eburon-core-ultra-audio-v1` provider model ID, keeping provider details securely inside the backend gateway layer.

---

## Model Specifications

All audio-compatible integrations adhere to the following strict formats:
* **Public Model Name**: `Pluto 1.0`
* **API Brand Name**: `pluto-1.0-live`
* **Target Audio Input**: `audio/pcm;rate=16000` (16kHz, Mono, 16-bit PCM WAV chunks)
* **Target Audio Output**: `audio/pcm` (24kHz, Mono, 16-bit PCM WAV response streams)

---

## API Registries Summary

### 1. Model Registry
The gateway enforces an explicit whitelist filter. Any unlisted model query returns an error:
* Active whitelist: `pluto-1.0-live`

### 2. Voice Token Registry
Original high-fidelity voices are mapped under superhero aliases and requested via base64 encoded strings to shield original voice signatures:
* **Skyblade** (`WmVwaHly` -> Zephyr)
* **Night Spark** (`UHVjaw==` -> Puck)
* **Shadow Ferryman** (`Q2hhcm9u` -> Charon)
* **Moon Sentinel** (`THVuYQ==` -> Luna)
* **Starflare** (`Tm92YQ==` -> Nova)
* **Core Guardian** (`S29yZQ==` -> Kore)
* **Wolf Titan** (`RmVucmly` -> Fenrir)
* **Echo Valkyrie** (`QW9lZGU=` -> Aoede)
* etc.

---

## Endpoint Index & Specifications

### 1. Connection & Live Handshake Endpoints

#### `POST /api/live/connect`
* **Purpose**: Establish an active streaming audio session context on the backend using selected models and masked voice tokens.
* **Request Body**:
  ```json
  {
    "model": "pluto-1.0-live",
    "voiceToken": "WmVwaHly",
    "responseModalities": ["audio"],
    "inputAudioTranscription": true,
    "outputAudioTranscription": true
  }
  ```
* **Response Body**:
  ```json
  {
    "success": true,
    "sessionId": "sess_8923a103d",
    "message": "Connected successfully to Eburon Live Audio Pluto 1.0 pipeline"
  }
  ```

#### `POST /api/live/disconnect`
* **Purpose**: Cleanly tear down an existing active Eburon pipeline context and release resources.
* **Request Body**:
  ```json
  {
    "sessionId": "sess_8923a103d"
  }
  ```
* **Response Body**:
  ```json
  {
    "success": true,
    "message": "Session context disconnected"
  }
  ```

#### `POST /api/live/send-text`
* **Purpose**: Inject plain text contents directly into the running turn pool.
* **Request Body**:
  ```json
  {
    "sessionId": "sess_8923a103d",
    "text": "Hello, explain the history of Eburon.",
    "turnComplete": true
  }
  ```
* **Response Body**:
  ```json
  {
    "status": "queued",
    "turnId": "turn_9201"
  }
  ```

#### `POST /api/live/send-audio-chunk`
* **Purpose**: Feed raw audio slices from microphones natively as base64-encoded PCM packets.
* **Request Body**:
  ```json
  {
    "sessionId": "sess_8923a103d",
    "mimeType": "audio/pcm;rate=16000",
    "audioBase64": "UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
  }
  ```
* **Response Body**:
  ```json
  {
    "success": true,
    "bytesReceived": 44
  }
  ```

#### `POST /api/live/tool-response`
* **Purpose**: Submit output values back from executing a tool to coordinate multi-turn operations.
* **Request Body**:
  ```json
  {
    "sessionId": "sess_8923a103d",
    "callId": "call_abc123",
    "response": {
      "status": "completed",
      "data": "Package is currently out for delivery"
    }
  }
  ```
* **Response Body**:
  ```json
  {
    "status": "acknowledged"
  }
  ```

#### `GET /api/live/events`
* **Purpose**: Event-driven SSE (Server Sent Events) downstream to receive events stream natively.
* **Query Parameters**: `?sessionId=sess_8923a103d`
* **Output Stream Events**: `input_transcript`, `output_transcript`, `tool_call`, `turn_complete`, `error`.

#### `GET /api/live/audio-stream`
* **Purpose**: Read-only real-time continuous raw PCM audio stream endpoint.
* **Query Parameters**: `?sessionId=sess_8923a103d`
* **Mime Type Response**: `audio/pcm`

#### `GET /api/live/transcripts`
* **Purpose**: Retrieve historical transcripts compiled under the target active session.
* **Query Parameters**: `?sessionId=sess_8923a103d`
* **Response Body**:
  ```json
  [
    { "role": "user", "content": "Hello", "timestamp": 1716616010000 },
    { "role": "assistant", "content": "Hello, Maneer! I am Skyblade.", "timestamp": 1716616012000 }
  ]
  ```

#### `POST /api/live/video-stream`
* **Purpose**: Initialize high-throughput h264/VP8 video streaming segments or connect WebSDK elements for real-time visual grounding with Pluto 1.0.
* **Request Body**:
  ```json
  {
    "sessionId": "session_123",
    "streamId": "vs_8932a",
    "resolution": "720p",
    "fps": 30,
    "codec": "VP8"
  }
  ```
* **Response Body**:
  ```json
  {
    "success": true,
    "endpoint": "webrtc://live.eburon.ai:3000/live/session_123",
    "authToken": "webrtc_stream_auth_token_9021a",
    "message": "Eburon Live Video Ingestion pipeline channel initialized"
  }
  ```

#### `POST /api/live/screen-share`
* **Purpose**: Transmit viewport frame updates or bounding canvas details for screen-grounded visual analysis and interactive feedback loops.
* **Request Body**:
  ```json
  {
    "sessionId": "session_123",
    "source": "entire_screen",
    "fps": 5,
    "compressRatio": 0.8
  }
  ```
* **Response Body**:
  ```json
  {
    "success": true,
    "shareId": "screen_4812a",
    "status": "sharing",
    "frameBufferSize": 204800,
    "instructions": "Send frames sequentially as Base64 JPEG chunks via WebSocket or REST chunk pipelines."
  }
  ```

---

### 2. Business Tools Integration Endpoints

#### `POST /api/tools/start_return`
* **Request Body**: `{ "orderId": "100231", "reason": "Size too small" }`
* **Response Body**: `{ "success": true, "returnSessionId": "ret_929", "instructions": "Drop cargo at Eburon local office" }`

#### `POST /api/tools/get_order_status`
* **Request Body**: `{ "orderId": "100231" }`
* **Response Body**: `{ "status": "Transit", "eta": "2026-05-28" }`

#### `POST /api/tools/speak_to_representative`
* **Request Body**: `{ "sessionId": "sess_8923a103d" }`
* **Response Body**: `{ "transferred": true, "queuePosition": 2 }`

#### `POST /api/tools/create_calendar_event`
* **Request/Response**: Standard JSON payload specifying timestamps and meeting titles.

#### `POST /api/tools/send_email`
* **Request/Response**: Send/Draft automated email updates.

#### `POST /api/tools/set_reminder`
* **Request/Response**: Record scheduled tasks.

#### `POST /api/tools/find_route`
* **Request/Response**: Lat/Lng routing path coordinates.

#### `POST /api/tools/find_nearby_places`
* **Request/Response**: Fetch local shops and landmarks.

#### `POST /api/tools/get_traffic_info`
* **Request/Response**: Fetch traffic delay statistics.

---

### 3. Dynamic Configuration Endpoints

#### `GET /api/config/models`
* **Purpose**: List all whitelisted Pluto models.
* **Response Body**:
  ```json
  [
    {
      "publicName": "Pluto 1.0",
      "publicModelId": "pluto-1.0-live",
      "provider": "eburon-core-live",
      "status": "whitelisted"
    }
  ]
  ```

#### `GET /api/config/voices`
* **Purpose**: List whitelisted voices containing only user-safe names and base64 mapped keys.
* **Response Body**:
  ```json
  [
    { "displayName": "Skyblade", "voiceToken": "WmVwaHly" },
    { "displayName": "Night Spark", "voiceToken": "UHVjaw==" }
  ]
  ```

#### `POST /api/config/system-prompt`
* **Request Body**: `{ "prompt": "New Eburon supervisor instruction set." }`
* **Response**: `{ "status": "updated" }`

#### `GET /api/config/output-registry`
* **Purpose**: Retrieve description, payload details, and mime types of the 21 unique output event frames.
