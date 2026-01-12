# Anthroposcenic Application Plan

## Overview
A Next.js application that processes images through an AI pipeline:
1. Upload an image
2. Generate a text description using Ollama (thinking model like Qwen)
3. Stream the description to the browser
4. Send image + description to ComfyUI
5. Stream ComfyUI output back to the application

## Technology Stack
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: ShadCN UI
- **AI Model**: Ollama (Qwen or similar thinking model)
- **Image Processing**: ComfyUI
- **Streaming**: Server-Sent Events (SSE) or Streaming Responses

## Application Architecture

### Routes Structure

#### 1. Image Upload Route
**Path**: `/api/upload`
**Method**: POST
**Purpose**: Handle image file upload
**Flow**:
- Accept multipart/form-data with image file
- Validate file type (images only)
- Store image temporarily or in memory
- Return image reference/ID or base64 encoded image
- Store image metadata (filename, size, type)

**Response**:
```json
{
  "imageId": "uuid",
  "imageUrl": "/uploads/uuid.jpg",
  "filename": "original.jpg",
  "size": 1234567
}
```

#### 2. Image Description Generation Route (Streaming)
**Path**: `/api/describe`
**Method**: POST
**Purpose**: Send image to Ollama and stream description back
**Flow**:
- Receive image reference/ID or image data
- Connect to Ollama API (local or remote)
- Use Qwen or similar thinking model
- Send image with prompt for description
- Stream response tokens to client
- Handle streaming errors gracefully

**Request Body**:
```json
{
  "imageId": "uuid",
  "model": "qwen2.5-vl:latest" // or appropriate thinking model
}
```

**Response**: Streaming text/event-stream
- Stream tokens as they're generated
- Include thinking process if model supports it
- Final description at end of stream

#### 3. ComfyUI Processing Route (Streaming)
**Path**: `/api/comfyui/process`
**Method**: POST
**Purpose**: Send image + description to ComfyUI and stream results
**Flow**:
- Receive image reference and generated description
- Construct ComfyUI workflow/prompt
- Send to ComfyUI API
- Stream progress updates
- Stream final processed image(s) or results
- Handle ComfyUI queue and job status

**Request Body**:
```json
{
  "imageId": "uuid",
  "description": "generated description text",
  "workflow": "optional workflow override"
}
```

**Response**: Streaming text/event-stream
- Stream job status updates
- Stream progress percentage
- Stream final image URLs or base64 data
- Stream any error messages

## Frontend Components (ShadCN UI)

### Main Page Components
1. **ImageUploadZone**
   - Drag & drop or file picker
   - Image preview
   - Upload progress indicator
   - Uses ShadCN Upload component

2. **DescriptionStream**
   - Display streaming text from Ollama
   - Show "thinking" indicator
   - Copy description button
   - Uses ShadCN Card, Textarea, Button

3. **ComfyUIProgress**
   - Progress bar for ComfyUI processing
   - Status messages
   - Preview of processed images
   - Uses ShadCN Progress, Alert, Image

4. **PipelineStatus**
   - Overall workflow status indicator
   - Step-by-step progress
   - Error handling display
   - Uses ShadCN Steps or Timeline component

### Layout Structure
```
┌─────────────────────────────────────┐
│         Header/Title                 │
├─────────────────────────────────────┤
│                                     │
│      Image Upload Zone              │
│      (with preview)                 │
│                                     │
├─────────────────────────────────────┤
│                                     │
│      Description Stream             │
│      (streaming text area)          │
│                                     │
├─────────────────────────────────────┤
│                                     │
│      ComfyUI Progress               │
│      (progress + preview)           │
│                                     │
└─────────────────────────────────────┘
```

## Data Flow

```
1. User uploads image
   ↓
2. Image stored (temp storage or memory)
   ↓
3. Image sent to Ollama API
   ↓
4. Description streams to browser
   ↓
5. User reviews description (optional edit?)
   ↓
6. Image + Description sent to ComfyUI
   ↓
7. ComfyUI processes and streams results
   ↓
8. Final output displayed
```

## API Integration Details

### Ollama Integration
- **Endpoint**: `http://localhost:11434/api/generate` (default)
- **Model**: Qwen2.5-VL or similar vision + thinking model
- **Request Format**: 
  - Image as base64 or file path
  - Prompt: "Describe this image in detail for use in ComfyUI workflow generation"
- **Streaming**: Use `stream: true` parameter
- **Response Format**: JSON with `response` field containing tokens

### ComfyUI Integration
- **Endpoint**: `http://localhost:8188` (default)
- **API**: ComfyUI WebSocket or REST API
- **Workflow**: Construct workflow JSON with image and text prompt
- **Queue**: Submit job to ComfyUI queue
- **Polling/Streaming**: Monitor job status and stream updates
- **Output**: Retrieve processed images from ComfyUI output

## State Management

### Client-Side State
- Uploaded image state
- Description text (streaming + final)
- ComfyUI job status
- Error states
- Loading states for each step

### Server-Side State
- Temporary image storage
- Active streaming connections
- ComfyUI job tracking

## Error Handling

### Image Upload Errors
- Invalid file type
- File too large
- Upload failure

### Ollama Errors
- Model not available
- Connection timeout
- Streaming interruption
- Model error responses

### ComfyUI Errors
- Service unavailable
- Workflow errors
- Job failures
- Timeout errors

## Environment Variables

```env
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5-vl:latest

# ComfyUI Configuration
COMFYUI_HOST=http://localhost:8188
COMFYUI_WS_URL=ws://localhost:8188/ws

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads
TEMP_DIR=./temp

# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## File Structure

```
app/
├── page.tsx                    # Main application page
├── layout.tsx                  # Root layout
├── api/
│   ├── upload/
│   │   └── route.ts           # Image upload endpoint
│   ├── describe/
│   │   └── route.ts           # Ollama description streaming
│   └── comfyui/
│       └── process/
│           └── route.ts       # ComfyUI processing streaming
├── components/
│   ├── ui/                     # ShadCN UI components
│   ├── ImageUploadZone.tsx
│   ├── DescriptionStream.tsx
│   ├── ComfyUIProgress.tsx
│   └── PipelineStatus.tsx
├── lib/
│   ├── ollama.ts              # Ollama client utilities
│   ├── comfyui.ts             # ComfyUI client utilities
│   └── streaming.ts           # Streaming utilities
└── types/
    └── index.ts               # TypeScript types

public/
└── uploads/                    # Uploaded images (if storing)

temp/                           # Temporary files
```

## Streaming Implementation Strategy

### Server-Sent Events (SSE)
- Use Next.js streaming responses
- Implement SSE for real-time updates
- Handle connection drops and reconnection
- Stream JSON chunks for structured data

### Alternative: WebSocket
- If SSE limitations, consider WebSocket
- More complex but more flexible
- Better for bidirectional communication

## Security Considerations

- Validate file types and sizes
- Sanitize image data before sending to APIs
- Rate limiting on API routes
- CORS configuration if needed
- Secure temporary file handling
- Clean up temporary files after processing

## Performance Optimizations

- Image compression before upload
- Streaming to reduce perceived latency
- Caching of descriptions (optional)
- Optimistic UI updates
- Debouncing where appropriate

## Testing Strategy

- Unit tests for utility functions
- Integration tests for API routes
- E2E tests for full workflow
- Mock Ollama and ComfyUI for testing
- Test streaming behavior
- Test error scenarios

## Future Enhancements

- Image editing before processing
- Description editing before ComfyUI
- Multiple ComfyUI workflow options
- Batch processing
- History of processed images
- Export/import workflows
- Custom Ollama model selection
- Custom ComfyUI workflow templates
