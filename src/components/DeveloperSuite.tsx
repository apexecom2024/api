import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, Play, HelpCircle, Code, ListFilter, Cpu, Radio, Activity } from 'lucide-react';
import { voiceRegistry } from '../voiceRegistry';
import { modelRegistry, decodeBase64 } from '../modelRegistry';
import { outputRegistry } from '../outputRegistry';

interface EndpointSpec {
  path: string;
  method: 'GET' | 'POST';
  purpose: string;
  requestBody?: string;
  responseBody: string;
  streaming?: string;
  outputs?: string;
  curl: string;
}

const endpointCollection: EndpointSpec[] = [
  // connection / handshakes
  {
    path: '/api/live/connect',
    method: 'POST',
    purpose: 'Handshake to establish a secure Eburon Pluto 1.0 session environment on the backend with whitelisted model and voice credentials.',
    requestBody: `{\n  "model": "pluto-1.0-live",\n  "voiceToken": "WmVwaHly",\n  "responseModalities": ["audio"],\n  "inputAudioTranscription": true,\n  "outputAudioTranscription": true\n}`,
    responseBody: `{\n  "success": true,\n  "sessionId": "session_8921df3a",\n  "message": "Connected successfully to Eburon Live Audio Pluto 1.0 pipeline"\n}`,
    streaming: 'None',
    outputs: 'Error Notification, Model Content',
    curl: `curl -X POST "http://localhost:3000/api/live/connect" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "model": "pluto-1.0-live",\n    "voiceToken": "WmVwaHly",\n    "responseModalities": ["audio"],\n    "inputAudioTranscription": true,\n    "outputAudioTranscription": true\n  }'`
  },
  {
    path: '/api/live/disconnect',
    method: 'POST',
    purpose: 'Teardown the active Eburon pipeline context and free allocated socket resources.',
    requestBody: `{\n  "sessionId": "session_123"\n}`,
    responseBody: `{\n  "success": true,\n  "message": "Session context disconnected"\n}`,
    streaming: 'None',
    outputs: 'None',
    curl: `curl -X POST "http://localhost:3000/api/live/disconnect" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "sessionId": "session_123"\n  }'`
  },
  {
    path: '/api/live/send-text',
    method: 'POST',
    purpose: 'Insert text queries into the live session turn conversation pool.',
    requestBody: `{\n  "sessionId": "session_123",\n  "text": "Hello Pluto, introduce yourself as an Eburon AI voice agent.",\n  "turnComplete": true\n}`,
    responseBody: `{\n  "status": "queued",\n  "turnId": "turn_ebd93"\n}`,
    streaming: 'Asynchronous text/audio stream response',
    outputs: 'Text Output, Output Transcript, Audio Output',
    curl: `curl -X POST "http://localhost:3000/api/live/send-text" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "sessionId": "session_123",\n    "text": "Hello Pluto, introduce yourself as an Eburon AI voice agent.",\n    "turnComplete": true\n  }'`
  },
  {
    path: '/api/live/send-audio-chunk',
    method: 'POST',
    purpose: 'Feed microphone voice chunks into the pipeline as base64-encoded PCM packets.',
    requestBody: `{\n  "sessionId": "session_123",\n  "mimeType": "audio/pcm;rate=16000",\n  "audioBase64": "UklGRiYAAAB..."\n}`,
    responseBody: `{\n  "success": true,\n  "bytesReceived": 10240\n}`,
    streaming: 'Direct acoustic ingestion stream parameters',
    outputs: 'Input Transcript',
    curl: `curl -X POST "http://localhost:3000/api/live/send-audio-chunk" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "sessionId": "session_123",\n    "mimeType": "audio/pcm;rate=16000",\n    "audioBase64": "BASE64_PCM_AUDIO_CHUNK"\n  }'`
  },
  {
    path: '/api/live/tool-response',
    method: 'POST',
    purpose: 'Return status output fields back into the session context from requested function targets.',
    requestBody: `{\n  "sessionId": "session_123",\n  "callId": "call_abc123",\n  "response": {\n    "status": "transit",\n    "eta": "2 days"\n  }\n}`,
    responseBody: `{\n  "status": "acknowledged"\n}`,
    streaming: 'Triggers matching turns synthesis',
    outputs: 'Tool Response',
    curl: `curl -X POST "http://localhost:3000/api/live/tool-response" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "sessionId": "session_123",\n    "callId": "call_abc123",\n    "response": {\n      "status": "transit",\n      "eta": "2 days"\n    }\n  }'`
  },
  {
    path: '/api/live/events',
    method: 'GET',
    purpose: ' डाउन-स्ट्रीम (Downstream) server-sent event path providing real-time transcripts and model event logs.',
    responseBody: `text/event-stream\n\nevent: model_content\\ndata: {"message": "Active SSE stream connect"}\\n\\nevent: turn_complete\\ndata: {"timestamp": 1716616010029}`,
    streaming: 'Continuous Server Sent Events stream channel',
    outputs: 'input_transcript, output_transcript, tool_call, error, turn_complete',
    curl: `curl -N "http://localhost:3000/api/live/events?sessionId=session_123" -H "EBURON_AI_API: YOUR_API_KEY"`
  },
  {
    path: '/api/live/audio-stream',
    method: 'GET',
    purpose: 'Downstream binary output audio feed stream returning 24kHz raw audio/pcm segments.',
    responseBody: `binary/octet-stream (raw audio byte sequences)`,
    streaming: 'Real-time binary chunk audio playback flow',
    outputs: 'audio_stream',
    curl: `curl -N "http://localhost:3000/api/live/audio-stream?sessionId=session_123" -H "EBURON_AI_API: YOUR_API_KEY"`
  },
  {
    path: '/api/live/transcripts',
    method: 'GET',
    purpose: 'Retrieve conversational transcripts historical logs for the active session context.',
    responseBody: `[\n  { "role": "user", "content": "Maneer, start Eburon test.", "timestamp": 1716616010000 },\n  { "role": "assistant", "content": "Understood, connecting to Skyblade registry.", "timestamp": 1716616012000 }\n]`,
    streaming: 'Static historic retrieval JSON structure',
    outputs: 'input_transcript, output_transcript',
    curl: `curl -X GET "http://localhost:3000/api/live/transcripts?sessionId=session_123" -H "EBURON_AI_API: YOUR_API_KEY"`
  },
  {
    path: '/api/live/video-stream',
    method: 'POST',
    purpose: 'Initialize high-throughput h264/VP8 video streaming segments or connect WebSDK elements for real-time visual grounding with Pluto 1.0.',
    requestBody: `{\n  "sessionId": "session_123",\n  "streamId": "vs_8932a",\n  "resolution": "720p",\n  "fps": 30,\n  "codec": "VP8"\n}`,
    responseBody: `{\n  "success": true,\n  "endpoint": "webrtc://live.eburon.ai:3000/live/session_123",\n  "authToken": "webrtc_stream_auth_token_9021a",\n  "message": "Eburon Live Video Ingestion pipeline channel initialized"\n}`,
    streaming: 'Real-time video/h264 media stream channel',
    outputs: 'video_websdk_stream',
    curl: `curl -X POST "http://localhost:3000/api/live/video-stream" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "sessionId": "session_123",\n    "streamId": "vs_8932a",\n    "resolution": "720p",\n    "fps": 30,\n    "codec": "VP8"\n  }'`
  },
  {
    path: '/api/live/screen-share',
    method: 'POST',
    purpose: 'Transmit viewport frame updates or bounding canvas details for screen-grounded visual analysis and interactive feedback loops.',
    requestBody: `{\n  "sessionId": "session_123",\n  "source": "entire_screen",\n  "fps": 5,\n  "compressRatio": 0.8\n}`,
    responseBody: `{\n  "success": true,\n  "shareId": "screen_4812a",\n  "status": "sharing",\n  "frameBufferSize": 204800,\n  "instructions": "Send frames sequentially as Base64 JPEG chunks via WebSocket or REST chunk pipelines."\n}`,
    streaming: 'Asynchronous periodic viewport frames channel',
    outputs: 'screenshare_active',
    curl: `curl -X POST "http://localhost:3000/api/live/screen-share" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "sessionId": "session_123",\n    "source": "entire_screen",\n    "fps": 5,\n    "compressRatio": 0.8\n  }'`
  },

  // Eburon Workspace Tools
  {
    path: '/api/tools/eburon/drive/list_files',
    method: 'POST',
    purpose: 'List files and directories from the Eburon connected Drive storage volumes.',
    requestBody: `{\n  "folderId": "root"\n}`,
    responseBody: `{\n  "success": true,\n  "files": [\n    { "id": "file_901a", "name": "Q2 Performance Summary.pdf", "type": "application/pdf" }\n  ]\n}`,
    outputs: 'drive_file_list',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/drive/list_files" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"folderId": "root"}'`
  },
  {
    path: '/api/tools/eburon/sheets/append_values',
    method: 'POST',
    purpose: 'Append new rows of raw operational data into whitelisted Eburon ledger spreadsheets.',
    requestBody: `{\n  "spreadsheetId": "sheet_123",\n  "values": [["2026-05-25", " Brussels", "Active"]]\n}`,
    responseBody: `{\n  "success": true,\n  "updatedRange": "Sheet1!A10:C10"\n}`,
    outputs: 'spreadsheet_appended',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/sheets/append_values" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"spreadsheetId": "sheet_123", "values": [["2026-05-25", "Brussels", "Active"]]}'`
  },
  {
    path: '/api/tools/eburon/gmail/search_messages',
    method: 'POST',
    purpose: 'Query active mailbox threads for specific Eburon context or Boss directives.',
    requestBody: `{\n  "query": "from:jo.lernout status:urgent"\n}`,
    responseBody: `{\n  "success": true,\n  "messages": [\n    { "id": "m_01", "snippet": "Meeting regarding Pluto 1.0..." }\n  ]\n}`,
    outputs: 'email_search_results',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/gmail/search_messages" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"query": "from:jo.lernout status:urgent"}'`
  },
  {
    path: '/api/tools/eburon/maps/validate_address',
    method: 'POST',
    purpose: 'Validate and normalize Belgian or international addresses via Eburon geo-pipelines.',
    requestBody: `{\n  "address": "Place Royale 1, Brussels"\n}`,
    responseBody: `{\n  "success": true,\n  "verdict": "VALID",\n  "formattedAddress": "Place Royale 1, 1000 Brussels, Belgium"\n}`,
    outputs: 'address_validation_result',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/maps/validate_address" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"address": "Place Royale 1, Brussels"}'`
  },
  {
    path: '/api/tools/eburon/tasks/create_task',
    method: 'POST',
    purpose: 'Register new task entries in the Eburon priority queue.',
    requestBody: `{\n  "title": "Calibrate Pluto sensors",\n  "notes": "Urgent request from Boss."\n}`,
    responseBody: `{\n  "success": true,\n  "taskId": "task_8912"\n}`,
    outputs: 'task_created',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/tasks/create_task" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"title": "Calibrate Pluto sensors"}'`
  },
  {
    path: '/api/tools/eburon/docs/create_document',
    method: 'POST',
    purpose: 'Initialize a new whitelisted Eburon document context on Drive.',
    requestBody: `{\n  "title": "New Operational Strategy"\n}`,
    responseBody: `{\n  "success": true,\n  "documentId": "doc_9021",\n  "title": "New Operational Strategy"\n}`,
    outputs: 'document_created',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/docs/create_document" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"title": "New Operational Strategy"}'`
  },
  {
    path: '/api/tools/eburon/slides/create_presentation',
    method: 'POST',
    purpose: 'Provision a new Eburon presentation slide deck.',
    requestBody: `{\n  "title": "Eburon Q3 Vision"\n}`,
    responseBody: `{\n  "success": true,\n  "presentationId": "slide_8821"\n}`,
    outputs: 'presentation_created',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/slides/create_presentation" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"title": "Eburon Q3 Vision"}'`
  },
  {
    path: '/api/tools/eburon/calendar/create_event',
    method: 'POST',
    purpose: 'Register new whitelisted events in the Eburon core calendar.',
    requestBody: `{\n  "summary": "Board Meeting",\n  "start": "2026-05-26T09:00:00Z",\n  "end": "2026-05-26T10:00:00Z"\n}`,
    responseBody: `{\n  "success": true,\n  "eventId": "ev_0912"\n}`,
    outputs: 'calendar_event_created',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/calendar/create_event" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"summary": "Board Meeting"}'`
  },
  {
    path: '/api/tools/eburon/gmail/send_message',
    method: 'POST',
    purpose: 'Dispatch authorized email communications via Eburon mail gateways.',
    requestBody: `{\n  "to": "boss@eburon.ai",\n  "subject": "Status Report",\n  "body": "All systems operational."\n}`,
    responseBody: `{\n  "success": true,\n  "messageId": "msg_8821"\n}`,
    outputs: 'email_dispatched',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/gmail/send_message" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"to": "boss@eburon.ai", "subject": "Status Report"}'`
  },
  {
    path: '/api/tools/eburon/maps/get_directions',
    method: 'POST',
    purpose: 'Calculate navigation routing via Eburon optimized transport pipes.',
    requestBody: `{\n  "origin": "Brussels Central",\n  "destination": "Eburon HQ"\n}`,
    responseBody: `{\n  "success": true,\n  "routes": [{ "summary": "Via R0", "legs": [{ "distance": { "text": "15km" } }] }]\n}`,
    outputs: 'navigation_result',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/maps/get_directions" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"origin": "Brussels Central", "destination": "Eburon HQ"}'`
  },
  {
    path: '/api/tools/eburon/maps/search_places',
    method: 'POST',
    purpose: 'Query nearby whitelisted business sectors or points of interest.',
    requestBody: `{\n  "query": "Coffee shops in Brussels"\n}`,
    responseBody: `{\n  "success": true,\n  "results": [{ "name": "Eburon Cafe", "rating": 4.9 }]\n}`,
    outputs: 'places_found',
    curl: `curl -X POST "http://localhost:3000/api/tools/eburon/maps/search_places" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{"query": "Coffee shops in Brussels"}'`
  },

  // business tools
  {
    path: '/api/tools/start_return',
    method: 'POST',
    purpose: 'Trigger return session workflows on business orders.',
    requestBody: `{\n  "orderId": "100231",\n  "reason": "Wrong item delivered"\n}`,
    responseBody: `{\n  "success": true,\n  "returnSessionId": "ret_9831a20",\n  "instructions": "Drop cargo at Eburon local office"\n}`,
    outputs: 'return_request_started',
    curl: `curl -X POST "http://localhost:3000/api/tools/start_return" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "orderId": "100231",\n    "reason": "Wrong item delivered"\n  }'`
  },
  {
    path: '/api/tools/get_order_status',
    method: 'POST',
    purpose: 'Request active statuses and parcel delivery updates.',
    requestBody: `{\n  "orderId": "100231"\n}`,
    responseBody: `{\n  "status": "Transit",\n  "eta": "2026-05-28"\n}`,
    outputs: 'order_status_result',
    curl: `curl -X POST "http://localhost:3000/api/tools/get_order_status" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "orderId": "100231"\n  }'`
  },
  {
    path: '/api/tools/speak_to_representative',
    method: 'POST',
    purpose: 'Initiate context transfers and route lines to live representative queues.',
    requestBody: `{\n  "sessionId": "session_123"\n}`,
    responseBody: `{\n  "transferred": true,\n  "queuePosition": 2\n}`,
    outputs: 'representative_handoff',
    curl: `curl -X POST "http://localhost:3000/api/tools/speak_to_representative" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "sessionId": "session_123"\n  }'`
  },
  {
    path: '/api/tools/create_calendar_event',
    method: 'POST',
    purpose: 'Request immediate calendar entry placement for team syncing.',
    requestBody: `{\n  "title": "Eburon AI Briefing with Jo",\n  "startTime": "2026-05-26T10:00:00Z",\n  "endTime": "2026-05-26T11:00:00Z"\n}`,
    responseBody: `{\n  "success": true,\n  "eventId": "evt_0918b",\n  "formatted": "Created event Successfully."\n}`,
    outputs: 'calendar_event_created',
    curl: `curl -X POST "http://localhost:3000/api/tools/create_calendar_event" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "title": "Eburon AI Briefing with Jo",\n    "startTime": "2526-05-26T10:00:00Z",\n    "endTime": "2526-05-26T11:00:00Z"\n  }'`
  },
  {
    path: '/api/tools/send_email',
    method: 'POST',
    purpose: 'Dispatch preconfigured email layouts or draft entries immediately.',
    requestBody: `{\n  "to": "boss@eburon.ai",\n  "subject": "Eburon active summary",\n  "body": "System calibrated."\n}`,
    responseBody: `{\n  "success": true,\n  "messageId": "msg_bc2931"\n}`,
    outputs: 'email_draft_or_sent',
    curl: `curl -X POST "http://localhost:3000/api/tools/send_email" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "to": "boss@eburon.ai",\n    "subject": "Eburon active summary",\n    "body": "System calibrated."\n  }'`
  },
  {
    path: '/api/tools/set_reminder',
    method: 'POST',
    purpose: 'Establish system alarms and scheduled action triggers.',
    requestBody: `{\n  "time": "2026-05-25T18:00:00Z",\n  "task": "Review handoffs"\n}`,
    responseBody: `{\n  "success": true,\n  "reminderId": "rem_8921b"\n}`,
    outputs: 'reminder_created',
    curl: `curl -X POST "http://localhost:3000/api/tools/set_reminder" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "time": "2026-05-25T18:00:00Z",\n    "task": "Review handoffs"\n  }'`
  },
  {
    path: '/api/tools/find_route',
    method: 'POST',
    purpose: 'Compute optimal paths and directions coordinates indices.',
    requestBody: `{\n  "origin": "Brussels",\n  "destination": "Ypres"\n}`,
    responseBody: `{\n  "success": true,\n  "distance": "45.3 km",\n  "duration": "34 mins",\n  "steps": ["Depart origin", "Arrive destination"]\n}`,
    outputs: 'route_result',
    curl: `curl -X POST "http://localhost:3000/api/tools/find_route" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "origin": "Brussels",\n    "destination": "Ypres"\n  }'`
  },
  {
    path: '/api/tools/find_nearby_places',
    method: 'POST',
    purpose: 'Query places coordinates around client sectors.',
    requestBody: `{\n  "location": "50.85,4.35",\n  "type": "office"\n}`,
    responseBody: `[\n  { "name": "Brussels Core Office", "distance": "120m" }\n]`,
    outputs: 'nearby_places_result',
    curl: `curl -X POST "http://localhost:3000/api/tools/find_nearby_places" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "location": "50.85,4.35",\n    "type": "office"\n  }'`
  },
  {
    path: '/api/tools/get_traffic_info',
    method: 'POST',
    purpose: 'Fetch delay margins statistics on transport corridors.',
    requestBody: `{\n  "sector": "R0 Ring Brussels"\n}`,
    responseBody: `{\n  "sector": "R0 Ring",\n  "congestionIndex": "Moderate",\n  "delayMinutes": 8\n}`,
    outputs: 'traffic_info_result',
    curl: `curl -X POST "http://localhost:3000/api/tools/get_traffic_info" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "sector": "R0 Ring Brussels"\n  }'`
  },

  {
    path: '/api/admin/generate-key',
    method: 'GET',
    purpose: 'Provision a new Eburon API Key for header-based authentication (EBURON_AI_API).',
    responseBody: `{\n  "success": true,\n  "apiKey": "EBURON_ABC123...",\n  "header": "EBURON_AI_API"\n}`,
    outputs: 'None',
    curl: `curl -X GET "http://localhost:3000/api/admin/generate-key"`
  },

  // configuration
  {
    path: '/api/config/models',
    method: 'GET',
    purpose: 'Retrieve public model entities whitelisted under active integration scopes.',
    responseBody: `[\n  {\n    "publicName": "Pluto 1.0",\n    "publicModelId": "pluto-1.0-live",\n    "provider": "eburon-core-live",\n    "status": "whitelisted"\n  }\n]`,
    outputs: 'None',
    curl: `curl -X GET "http://localhost:3000/api/config/models" -H "EBURON_AI_API: YOUR_API_KEY"`
  },
  {
    path: '/api/config/voices',
    method: 'GET',
    purpose: 'Expose only frontend-safe superhero voice aliases with corresponding base64 tokens.',
    responseBody: `[\n  {\n    "displayName": "Skyblade",\n    "voiceToken": "WmVwaHly",\n    "enabled": true\n  }\n]`,
    outputs: 'None',
    curl: `curl -X GET "http://localhost:3000/api/config/voices" -H "EBURON_AI_API: YOUR_API_KEY"`
  },
  {
    path: '/api/config/system-prompt',
    method: 'POST',
    purpose: 'Overwrite the default internal system instruction prompts for subsequent session parameters.',
    requestBody: `{\n  "prompt": "You are a highly capable agent."\n}`,
    responseBody: `{\n  "status": "updated",\n  "prompt": "You are a highly capable agent."\n}`,
    outputs: 'None',
    curl: `curl -X POST "http://localhost:3000/api/config/system-prompt" \\\n  -H "Content-Type: application/json" \\\n  -H "EBURON_AI_API: YOUR_API_KEY" \\\n  -d '{\n    "prompt": "You are a highly capable agent."\n  }'`
  },
  {
    path: '/api/config/output-registry',
    method: 'GET',
    purpose: 'Return deep details, label schemas, and sample properties for all 21 system signals.',
    responseBody: `[\n  {\n    "id": "audio_output",\n    "label": "Audio Output",\n    "description": "PCM audio generated by Pluto 1.0 Live.",\n    "transport": "stream",\n    "mimeType": "audio/pcm",\n    "sampleRate": 24000\n  }\n]`,
    outputs: 'None',
    curl: `curl -X GET "http://localhost:3000/api/config/output-registry" -H "EBURON_AI_API: YOUR_API_KEY"`
  }
];

export default function DeveloperSuite() {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'GET' | 'POST'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(id);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const playTTSPreview = (voiceName: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`Hello Maneer, I am code name ${voiceName}. Actively connected to Eburon AI model line, ready to receive commands.`);
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } else {
        alert("Speech synthesis is not supported on this device/iFrame configuration.");
      }
    } catch {
      // ignore
    }
  };

  const filteredEndpoints = endpointCollection.filter(spec => {
    const matchesMethod = filterMethod === 'ALL' || spec.method === filterMethod;
    const matchesQuery = spec.path.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         spec.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMethod && matchesQuery;
  });

  return (
    <div className="space-y-10 animate-fade-in text-[#3b4151]">
      
      {/* 0. Governance & Access Provisioning */}
      <section className="bg-gradient-to-br from-[#89bf04]/10 to-white rounded-xl border border-[#89bf04]/20 shadow-sm p-6 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#89bf04]/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#89bf04]" />
              <h2 className="text-xl font-extrabold tracking-tight text-gray-800 uppercase italic">Eburon Core Gateway - Auth Provisioning</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Access to whitelisted Eburon Pluto 1.0 pipelines requires an authorized <span className="text-[#89bf04] font-bold">EBURON_AI_API</span> credential in the request headers. 
              The sandbox automatically whitelists local terminal origins.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 min-w-[280px]">
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-2.5 shadow-xs">
              <span className="text-[10px] font-mono text-gray-400 font-bold uppercase">Header:</span>
              <div className="flex items-center gap-2">
                <code className="text-[#89bf04] font-black text-xs">EBURON_AI_API</code>
                <button 
                  onClick={() => copyToClipboard('EBURON_AI_API', 'header_key')}
                  className="p-1 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                >
                  {copiedPath === 'header_key' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-300" />}
                </button>
              </div>
            </div>
            <button 
              onClick={() => {
                const mockKey = `EBURON_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
                copyToClipboard(mockKey, 'generated_key');
              }}
              className="bg-[#89bf04] hover:bg-[#78a804] text-white font-black text-xs py-3 rounded-lg shadow-md items-center justify-center gap-2 flex transition-all active:scale-[0.98] cursor-pointer"
            >
              {copiedPath === 'generated_key' ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{copiedPath === 'generated_key' ? 'KEY COPIED TO TERMINAL BUFFER' : 'PROVISION & COPY API KEY'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 1. Whitelisted Models Registry */}
      <section className="bg-white rounded border border-[#e8e8e8] shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
          <Cpu className="w-5 h-5 text-[#89bf04]" />
          <h2 className="text-xl font-extrabold tracking-tight text-gray-800">1. Whitelisted Models Registry (Pluto 1.0 Alias)</h2>
        </div>
        <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
          The Eburon AI gateway strictly enforces whitelist filters. Any client requesting non-whitelisted platforms gets immediately rejected. Pluto-specified models mapped securely:
        </p>

        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 font-bold border-b border-gray-100 text-gray-600">
                <th className="p-3">Public Name</th>
                <th className="p-3">Public Model ID</th>
                <th className="p-3">Provider Provider ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Owner</th>
              </tr>
            </thead>
            <tbody>
              {modelRegistry.map((m) => (
                <tr key={m.publicModelId} className="hover:bg-gray-50/50 border-b border-gray-100 font-mono text-gray-700">
                  <td className="p-3 font-sans font-bold text-gray-800">{m.publicName}</td>
                  <td className="p-3 text-blue-600 font-semibold">{m.publicModelId}</td>
                  <td className="p-3 text-gray-400">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 group">
                        <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 border px-1 py-0.5 rounded truncate max-w-[180px] select-all" title="Eburon Shielded Identifier">
                          {m.providerModelId}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(m.providerModelId, `model_id_${m.publicModelId}`)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all cursor-pointer"
                        >
                          {copiedPath === `model_id_${m.publicModelId}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                      {m.status}
                    </span>
                  </td>
                  <td className="p-3 font-sans text-gray-500">{m.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Supported Superheroes Voice Mappings (Base64 Shielded) */}
      <section className="bg-white rounded border border-[#e8e8e8] shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
          <Radio className="w-5 h-5 text-[#89bf04]" />
          <h2 className="text-xl font-extrabold tracking-tight text-gray-800">2. Voice Registries (Superhero Identity Tokens)</h2>
        </div>
        <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
          Original voice signatures are locked. All client interactions pass secure, base64-encoded <span className="font-mono bg-gray-50 border px-1 py-0.5 rounded">voiceTokens</span>. The gateway resolves tokens back to the premium model configurations securely:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {voiceRegistry.slice(0, 15).map((v) => (
            <div key={v.voiceToken} className="bg-gray-50/70 border border-gray-200/60 rounded-lg p-3.5 hover:shadow-xs transition-all flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-gray-800">{v.displayName}</span>
                  <span className="bg-[#89bf04]/1s border border-[#89bf04]/20 text-[#89bf04] text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Active</span>
                </div>
                <div className="mt-2 text-[11px] space-y-1 font-mono text-gray-500 bg-white border border-gray-100 rounded p-1.5 break-all">
                  <div className="flex justify-between">
                    <span>Token:</span>
                    <span className="text-blue-600 font-bold select-all">{v.voiceToken}</span>
                  </div>
                  {copiedPath === v.voiceToken && (
                    <div className="text-[9px] bg-green-50 text-green-700 border border-green-200 p-1 rounded font-mono text-center animate-fade-in mt-1 font-bold">
                      ✓ Captioned: Voice signature token copied to clipboard!
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-50 pt-1 text-[10px] text-gray-400">
                    <span>Eburon Code:</span>
                    <div className="text-right flex items-center gap-1.5 group">
                      <span className="text-[9px] font-mono text-gray-400 block bg-gray-100 border px-1 rounded max-w-[100px] truncate select-all font-bold" title="Shielded Identity Token">
                        {v.providerVoiceId}
                      </span>
                      <button 
                        onClick={() => copyToClipboard(v.providerVoiceId, `voice_id_${v.displayName}`)}
                        className="opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        {copiedPath === `voice_id_${v.displayName}` ? <Check className="w-2.5 h-2.5 text-green-600" /> : <Copy className="w-2.5 h-2.5 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => copyToClipboard(v.voiceToken, v.voiceToken)}
                  className="flex-1 border border-gray-200 hover:bg-gray-100 bg-white text-gray-600 rounded py-1 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedPath === v.voiceToken ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPath === v.voiceToken ? 'Copied' : 'Copy Token'}</span>
                </button>
                <button 
                  onClick={() => playTTSPreview(v.displayName)}
                  className="px-2.5 border border-[#89bf04] hover:bg-[#89bf04]/10 bg-white text-[#89bf04] rounded py-1 flex items-center justify-center cursor-pointer"
                  title="Play Voice Sample"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="bg-gray-100/30 border border-dashed border-gray-300 rounded-lg p-3.5 flex items-center justify-center text-center">
            <p className="text-[11px] text-gray-400 italic font-mono max-w-[200px]">
              + 17 additional Eburon high fidelity voice profiles whitelisted
            </p>
          </div>
        </div>
      </section>

      {/* 3. Central System Output Registry */}
      <section className="bg-white rounded border border-[#e8e8e8] shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
          <Activity className="w-5 h-5 text-[#89bf04]" />
          <h2 className="text-xl font-extrabold tracking-tight text-gray-800">3. Central System Output Registers (21 Unique Signal Vectors)</h2>
        </div>
        <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
          The Eburon AI system standardizes all outgoings into 21 unique event schemas to assure total platform portability and ease client-side logic binds:
        </p>

        <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-lg text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50 font-bold border-b border-gray-100 text-gray-600 z-10">
              <tr>
                <th className="p-3 w-1/4">Output Metric ID</th>
                <th className="p-3 w-1/4">Label Description</th>
                <th className="p-3 w-1/6">Transport Mechanism</th>
                <th className="p-3 w-1/6">Mime Standard Type</th>
                <th className="p-3 text-center">API Targetable</th>
              </tr>
            </thead>
            <tbody>
              {outputRegistry.map((out) => (
                <tr key={out.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                  <td className="p-3 font-mono font-bold text-gray-800">{out.id}</td>
                  <td className="p-3">
                    <span className="font-bold block text-gray-700">{out.label}</span>
                    <span className="text-[10px] text-gray-500 block leading-relaxed">{out.description}</span>
                  </td>
                  <td className="p-3 font-mono text-gray-500">
                    <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-blue-100">
                      {out.transport}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-gray-400 text-[11px]">{out.mimeType} {out.sampleRate && `• ${out.sampleRate}Hz`}</td>
                  <td className="p-3 text-center">
                    {out.canBecomeApiCall ? (
                      <span className="text-[10px] uppercase font-black text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded inline-block">Yes</span>
                    ) : (
                      <span className="text-[10px] uppercase font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded inline-block">Local</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Complete cURL Examples Panel */}
      <section className="bg-white rounded border border-[#e8e8e8] shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Code className="w-5 h-5 text-[#89bf04]" />
            <h2 className="text-xl font-extrabold tracking-tight text-gray-800">4. Developer Endpoint specifications & cURL Index</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded overflow-hidden text-xs">
              {(['ALL', 'GET', 'POST'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setFilterMethod(m)}
                  className={`px-3 py-1 font-bold ${filterMethod === m ? 'bg-gray-100 text-gray-800' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input 
              type="text" 
              placeholder="Search pathways..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs border border-gray-300 rounded p-1 px-2.5 outline-none font-mono focus:border-blue-400"
            />
          </div>
        </div>

        <div className="space-y-6">
          {filteredEndpoints.map((spec, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden hover:border-[#89bf04]/50 transition-all shadow-xs">
              {/* Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-mono group">
                  <button 
                    onClick={() => copyToClipboard(spec.method, `method_${spec.path}`)}
                    className={`font-black text-[10px] uppercase px-2 py-0.5 rounded text-white cursor-pointer transition-transform active:scale-95 ${spec.method === 'POST' ? 'bg-[#49cc90]' : 'bg-[#50a3f2]'}`}
                    title="Click to copy method"
                  >
                    {copiedPath === `method_${spec.path}` ? <Check className="w-3 h-3" /> : spec.method}
                  </button>
                  <div className="flex items-center gap-1.5 hover:bg-gray-100 pr-2 rounded transition-colors group">
                    <span className="font-extrabold text-gray-800 text-sm">{spec.path}</span>
                    <button 
                      onClick={() => copyToClipboard(spec.path, `path_${spec.path}`)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 transition-all text-gray-400 hover:text-blue-600 cursor-pointer"
                      title="Copy path"
                    >
                      {copiedPath === `path_${spec.path}` ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 font-sans tracking-wide">
                  Endpoint index {idx + 1} of 21 (Eburon Whitelisted)
                </div>
              </div>

              {/* Params and Code block body */}
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Left side details */}
                <div className="space-y-4 text-xs font-sans">
                  <div>
                    <h5 className="font-extrabold text-gray-500 uppercase text-[10px] tracking-wider mb-1">Method Description</h5>
                    <p className="text-gray-700 leading-relaxed text-[11px] font-medium">{spec.purpose}</p>
                  </div>

                  {spec.requestBody && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-extrabold text-gray-500 uppercase text-[10px] tracking-wider">Sample Request PAYLOAD (JSON)</h5>
                        <button 
                          onClick={() => copyToClipboard(spec.requestBody!, `request_${spec.path}`)}
                          className="hover:text-blue-600 transition-colors p-0.5"
                          title="Copy JSON"
                        >
                          {copiedPath === `request_${spec.path}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                        </button>
                      </div>
                      <pre className="bg-gray-50 border border-gray-150 p-2.5 rounded font-mono text-[10px] text-gray-600 whitespace-pre overflow-auto max-h-36">
                        {spec.requestBody}
                      </pre>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-extrabold text-gray-500 uppercase text-[10px] tracking-wider">Standard Response Form</h5>
                      <button 
                        onClick={() => copyToClipboard(spec.responseBody, `response_${spec.path}`)}
                        className="hover:text-green-600 transition-colors p-0.5"
                        title="Copy Response JSON"
                      >
                        {copiedPath === `response_${spec.path}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                      </button>
                    </div>
                    <pre className="bg-gray-50 border border-gray-150 p-2.5 rounded font-mono text-[10px] text-gray-600 whitespace-pre overflow-auto max-h-36">
                      {spec.responseBody}
                    </pre>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] pt-1">
                    {spec.streaming && spec.streaming !== 'None' && (
                      <div className="flex items-center gap-1 group">
                        <span className="bg-yellow-50 text-yellow-800 border border-yellow-100 px-2 py-0.5 rounded font-mono font-bold">
                          Stream: {spec.streaming}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(spec.streaming!, `stream_${spec.path}`)}
                          className="opacity-0 group-hover:opacity-100 cursor-pointer p-0.5 hover:text-yellow-600 transition-all"
                        >
                          {copiedPath === `stream_${spec.path}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 text-gray-300" />}
                        </button>
                      </div>
                    )}
                    {spec.outputs && spec.outputs !== 'None' && (
                      <div className="flex items-center gap-1 group">
                        <span className="bg-purple-50 text-purple-800 border border-purple-100 px-2 py-0.5 rounded font-mono font-bold">
                          Emits Output Vector: {spec.outputs}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(spec.outputs!, `output_${spec.path}`)}
                          className="opacity-0 group-hover:opacity-100 cursor-pointer p-0.5 hover:text-purple-600 transition-all"
                        >
                          {copiedPath === `output_${spec.path}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 text-gray-300" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side copyable cURL */}
                <div className="flex flex-col justify-between bg-[#292a2b] rounded-lg p-3 text-white overflow-hidden">
                  <div className="flex items-center justify-between border-b border-gray-700/60 pb-1.5 mb-2.5 text-[10px] font-mono tracking-wider uppercase text-gray-400">
                    <span>Target Sandbox cURL Example</span>
                    <button
                      onClick={() => copyToClipboard(spec.curl, spec.path)}
                      className="text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedPath === spec.path ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPath === spec.path ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                  <pre className="font-mono text-[10.5px] text-[#f8f8f2] leading-relaxed whitespace-pre overflow-auto flex-1 p-1 max-h-80 select-all scrollbar-thin">
                    {spec.curl}
                  </pre>
                  
                  {/* Dynamic Clipboard Captioned Block */}
                  <div className="mt-3.5 pt-2.5 border-t border-gray-700/50 flex flex-col gap-1 text-[11px] text-gray-400">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#89bf04] inline-block animate-pulse"></span>
                      <span className="font-semibold tracking-tight">Active Terminal Clipboard Sync:</span>
                    </div>
                    {copiedPath === spec.path ? (
                      <div className="bg-[#89bf04]/20 border border-[#89bf04]/40 text-[#a3e200] p-1.5 rounded font-mono text-[10px] animate-fade-in font-medium">
                        ✓ CAPTIONED: cURL command copied successfully! Ready to paste and run in your local terminal.
                      </div>
                    ) : (
                      <span className="italic text-[10px] font-mono text-gray-500">Ready. Click "COPY" to buffer exact shell segment for terminal.</span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ))}

          {filteredEndpoints.length === 0 && (
            <div className="text-center py-10 border border-dashed border-gray-200 rounded bg-gray-50/50">
              <p className="text-xs text-gray-400 font-mono">No matching whitelisted pathways found in registry.</p>
            </div>
          )}
        </div>
      </section>
      
    </div>
  );
}
