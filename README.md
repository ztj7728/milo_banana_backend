# 🍌 Milo Banana Backend

An elegant TypeScript backend with web admin panel and JSON-RPC 2.0 API interface.

## Features

- **TypeScript** - Type-safe backend development
- **SQLite Database** - Lightweight, file-based database with auto-initialization
- **JSON-RPC 2.0** - Standardized API protocol for all endpoints
- **Dual Authentication** - Regular login + WeChat Mini-Program authentication
- **User Management** - Complete user system with nicknames and profiles
- **Prompt Store Management** - Full CRUD operations for AI prompts
- **Web Admin Panel** - Beautiful tabbed interface for configuration and prompt management
- **Rate Limiting** - Protection against abuse with IP-based throttling
- **Security Headers** - Helmet.js security middleware with CSP
- **Auto-initialization** - Database tables and default data setup

## API Endpoints

All API endpoints use **JSON-RPC 2.0** protocol. Each request must include:
- `jsonrpc: "2.0"`
- `method: "method.name"`
- `params: {}` (optional)
- `id: unique_id`

### Authentication
- `POST /api/login` - User login (`auth.login`)
- `POST /api/signup` - User registration (`auth.signup`)
- `POST /api/wechat-login` - WeChat authentication (`auth.wechat_login`)
- `POST /api/me` - Get current user profile (`user.profile`, requires auth)

### Configuration (Admin Only)
- `POST /api/config` - Configuration operations
  - `config.get` - Get current configuration
  - `config.update` - Update configuration

### Prompt Store
- `POST /api/prompt_store` - Prompt management operations
  - `prompts.list` - Get all prompts (public access)
  - `prompts.get` - Get specific prompt by ID (public access)
  - `prompts.create` - Create new prompt (admin only)
  - `prompts.update` - Update existing prompt (admin only)
  - `prompts.delete` - Delete prompt (admin only)

### User Management (Admin Only)
- `POST /api/users` - User management operations
  - `users.list` - Get all users
  - `users.get` - Get specific user by ID
  - `users.updatePoints` - Set user points to specific value
  - `users.addPoints` - Add points to user's current total
  - `users.subtractPoints` - Subtract points from user (minimum 0)

### Image Generation
- `POST /api/images/generations` - AI content generation
  - `images.generate` - Generate content using AI platforms (requires auth)
  - **Points System**: Requires 1 point to generate. 1 point is deducted after successful generation.

### Health Check
- `POST /health` - Server health status (`health.check`)

**Example:**
```bash
curl -X POST http://localhost:3088/health \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "health.check",
    "id": 1
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "OK",
    "timestamp": "2025-09-23T18:42:15.074Z",
    "uptime": 132.89
  },
  "id": 1
}
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file:**
   ```env
   ADMIN_PASSWORD=12345678
   JWT_SECRET=your_jwt_secret_key
   PORT=3088
   NODE_ENV=development

   # WeChat Configuration (optional)
   # For WeChat Official Account (web/app login)
   WECHAT_APP_ID=your_wechat_official_account_app_id
   WECHAT_APP_SECRET=your_wechat_official_account_app_secret

   # For WeChat Mini Program
   WECHAT_MINIPROGRAM_APP_ID=your_wechat_mini_program_app_id
   WECHAT_MINIPROGRAM_APP_SECRET=your_wechat_mini_program_app_secret
   ```

4. **Build and start:**
   ```bash
   npm run build
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Usage

### Web Admin Panel
Visit `http://localhost:3088/admin` to access the management interface.

#### Features:
- **Configuration Tab**: Manage API settings (Base URL, API Key, Model)
- **Prompt Store Tab**: Visual management of AI prompts with full CRUD operations
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live refresh after operations

### JSON-RPC 2.0 API Usage

**Register a new user:**
```bash
curl -X POST http://localhost:3088/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "auth.signup",
    "params": {
      "username": "testuser",
      "password": "password123",
      "nickname": "Test User"
    },
    "id": 1
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3088/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "auth.login",
    "params": {
      "username": "testuser",
      "password": "password123"
    },
    "id": 2
  }'
```

**WeChat Mini-Program Login:**
```bash
curl -X POST http://localhost:3088/api/wechat-login \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "auth.wechat_login",
    "params": {
      "code": "MINI_PROGRAM_JS_CODE",
      "platform": "miniprogram",
      "userInfo": {
        "nickName": "微信用户",
        "avatarUrl": "https://example.com/avatar.jpg"
      },
      "signature": "signature_from_wx_getUserProfile",
      "rawData": "raw_data_from_wx_getUserProfile"
    },
    "id": 3
  }'
```

{"jsonrpc":"2.0","result":{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTg1Njk1MzMsImV4cCI6MTc1ODY1NTkzMywiYXVkIjoibWlsby1iYW5hbmEtY2xpZW50IiwiaXNzIjoibWlsby1iYW5hbmEtYmFja2VuZCJ9.H02T02sOlpAkr3MJGCxu2Wkc6VpiRtkv56cTwo6LCZ8","token_type":"Bearer","expires_in":86400,"scope":"read write"},"id":2}

**Get user profile:**
```bash
curl -X POST http://localhost:3088/api/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "user.profile",
    "id": 3
  }'
```

{"jsonrpc":"2.0","result":{"id":1,"username":"testuser","nickname":"Test User","points":100,"wechat_openid":null,"wechat_unionid":null,"avatar_url":null,"created_at":"2025-09-26 03:51:00"},"id":3}

**Get configuration:**
```bash
curl -X POST http://localhost:3088/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 12345678" \
  -d '{
    "jsonrpc": "2.0",
    "method": "config.get",
    "id": 4
  }'
```

**Update configuration (admin):**
```bash
curl -X POST http://localhost:3088/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 12345678" \
  -d '{
    "jsonrpc": "2.0",
    "method": "config.update",
    "params": {
      "baseUrl": "https://api.example.com",
      "model": "gpt-4"
    },
    "id": 5
  }'
```

### Prompt Store API Usage

**List all prompts:**
```bash
curl -X POST http://localhost:3088/api/prompt_store \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts.list",
    "id": 6
  }'
```

{
    "jsonrpc": "2.0",
    "result": [
        {
            "id": 1,
            "prompt": "turn this photo into a character figure. Behind it, place a box with the character’s image printed on it, and a computer showing the Blender modeling process on its screen. In front of the box, add a round plastic base with the character figure standing on it. Make the PVC material look clear, and set the scene indoors if possible.",
            "category": "ImageText2Image",
            "title": "3D手办",
            "description": "",
            "cover_image": "https://youke1.picui.cn/s1/2025/09/23/68d29fb6e987c.jpg",
            "image_required": 1,
            "variable_required": false,
            "created_at": "2025-09-22 16:49:51",
            "updated_at": "2025-09-23 13:26:07"
        },
        {
            "id": 2,
            "prompt": "三只${{ 动物类型 }}在标志性${{ 地标 }}前的特写自拍照，它们表情各异，拍摄于黄金时刻，采用电影般的灯光。动物们靠近镜头，头挨着头，模仿自拍姿势，展现出喜悦、惊讶和平静的表情。背景展示了${{ 地标 }}完整的建筑细节，光线柔和，氛围温暖。采用摄影感、写实卡通风格拍摄，高细节，1:1 宽高比。",
            "category": "Text2Image",
            "title": "三只动物与地标自拍",
            "description": "替换 [动物类型] 和 [地标] ",
            "cover_image": "https://youke1.picui.cn/s1/2025/09/23/68d2a06c225e3.jpg",
            "image_required": 0,
            "variable_required": true,
            "created_at": "2025-09-22 16:49:51",
            "updated_at": "2025-09-23 13:37:15"
        }
    ],
    "id": 1758648942531
}

**Get specific prompt:**
```bash
curl -X POST http://localhost:3088/api/prompt_store \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts.get",
    "params": {"id": 1},
    "id": 7
  }'
```

**Create new prompt:**
```bash
curl -X POST http://localhost:3088/api/prompt_store \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts.create",
    "params": {
      "title": "My Custom Prompt",
      "category": "Text2Image",
      "prompt": "Generate a beautiful landscape...",
      "description": "Creates scenic landscapes",
      "cover_image": "https://example.com/image.jpg",
      "image_required": 2,
      "variable_required": true
    },
    "id": 8
  }'
```

**Update prompt:**
```bash
curl -X POST http://localhost:3088/api/prompt_store \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts.update",
    "params": {
      "id": 1,
      "title": "Updated Title",
      "image_required": 3
    },
    "id": 9
  }'
```

**Delete prompt:**
```bash
curl -X POST http://localhost:3088/api/prompt_store \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "prompts.delete",
    "params": {"id": 1},
    "id": 10
  }'
```

### User Management API Usage

**List all users:**
```bash
curl -X POST http://localhost:3088/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "users.list",
    "id": 11
  }'
```

**Get specific user:**
```bash
curl -X POST http://localhost:3088/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "users.get",
    "params": {"id": 1},
    "id": 12
  }'
```

**Set user points (absolute value):**
```bash
curl -X POST http://localhost:3088/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "users.updatePoints",
    "params": {
      "userId": 1,
      "points": 500
    },
    "id": 13
  }'
```

**Add points to user:**
```bash
curl -X POST http://localhost:3088/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "users.addPoints",
    "params": {
      "userId": 1,
      "points": 100
    },
    "id": 14
  }'
```

**Subtract points from user:**
```bash
curl -X POST http://localhost:3088/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "users.subtractPoints",
    "params": {
      "userId": 1,
      "points": 30
    },
    "id": 15
  }'
```

### Image Generation API Usage

**Generate content with text prompt (Gemini):**
```bash
curl -X POST http://localhost:3088/api/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "images.generate",
    "params": {
      "platform": "gemini",
      "prompt": [
        {
          "text": "Generate a beautiful sunset landscape with mountains"
        }
      ]
    },
    "id": 16
  }'
```

**Generate content with text and image input (Gemini):**
```bash
curl -X POST http://localhost:3088/api/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "images.generate",
    "params": {
      "platform": "gemini",
      "prompt": [
        {
          "text": "Describe what you see in this image and create a story about it"
        },
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "base64_encoded_image_data_here"
          }
        }
      ]
    },
    "id": 17
  }'
```

**Response format:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "platform": "gemini",
    "data": [
      {
        "text": "Generated text content here...",
        "imageData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
      }
    ],
    "generated_at": "2024-01-01T12:00:00.000Z"
  },
  "id": 16
}
```

## Data Types

### Prompt Store Fields
- **`id`**: Integer (auto-generated)
- **`prompt`**: String (the AI prompt text)
- **`category`**: String (e.g., "Text2Image", "ImageText2Image")
- **`title`**: String (display name)
- **`description`**: String (optional description)
- **`cover_image`**: String (optional URL)
- **`image_required`**: Integer (number of images needed: 0, 1, 2, 3...)
- **`variable_required`**: Boolean (true/false if prompt uses variables)
- **`created_at`**: DateTime (auto-generated)
- **`updated_at`**: DateTime (auto-updated)

### User Fields
- **`id`**: Integer (auto-generated)
- **`username`**: String (unique)
- **`password`**: String (hashed, never returned in API responses)
- **`nickname`**: String (optional, display name for users)
- **`points`**: Integer (user's point balance, minimum 0)
- **`wechat_openid`**: String (optional, WeChat user unique ID)
- **`wechat_unionid`**: String (optional, WeChat union ID across apps)
- **`avatar_url`**: String (optional, user avatar image URL)
- **`created_at`**: DateTime (auto-generated)

### Image Generation Fields

**PromptPart Structure:**
- **`text`**: String (optional, text content for the prompt)
- **`inlineData`**: Object (optional, for image input)
  - **`mimeType`**: String (image MIME type, e.g., "image/jpeg", "image/png")
  - **`data`**: String (base64-encoded image data)

**Generation Parameters:**
- **`platform`**: String ("gemini" or "openai", currently only Gemini is implemented)
- **`prompt`**: Array of PromptPart objects (must contain at least one text part)

**Response Structure:**
- **`platform`**: String (the platform used for generation)
- **`data`**: Array of GeneratedContent objects
  - **`text`**: String (optional, generated text content)
  - **`imageData`**: String (optional, data URI format: "data:image/png;base64,...")
- **`generated_at`**: DateTime (timestamp of generation)

## Project Structure

```
src/
├── index.ts              # Main application entry point
├── database.ts           # Database models and operations
├── auth.ts              # Authentication utilities
├── jsonrpc.ts           # JSON-RPC 2.0 utilities
├── wechat.ts            # WeChat API integration
├── services/
│   └── ai-service.ts    # AI platform integrations (Gemini, OpenAI)
└── routes/
    ├── config.ts        # Configuration endpoints
    ├── login.ts         # Login endpoint
    ├── signup.ts        # Signup endpoint
    ├── wechat-login.ts  # WeChat authentication endpoint
    ├── me.ts           # User profile endpoint
    ├── prompt_store.ts  # Prompt management endpoints
    ├── users.ts         # User management endpoints
    └── images.ts        # Image generation endpoints
public/
└── index.html           # Web admin panel with tabbed interface
prompt_store.json        # Initial prompt data (auto-imported)
```

## Security Features

- **Password Hashing** - bcryptjs with salt rounds
- **JWT Tokens** - Secure token-based authentication
- **Rate Limiting** - IP-based request limiting with JSON-RPC 2.0 compliant responses (100 req/15min, 15 auth/10min)
- **CORS Protection** - Configurable origin restrictions
- **Security Headers** - Helmet.js middleware with CSP
- **Input Validation** - Comprehensive request payload validation
- **Admin Authentication** - All management operations require admin password
- **User Points Protection** - Points cannot go below 0, secure point balance management

## Default Configuration

The system initializes with these default values:
- **Base URL:** `https://api.joyzhi.com`
- **API Key:** `sk-xxxx`
- **Model:** `gemini-2.5-flash-image-preview`

Initial prompts are automatically imported from `prompt_store.json` on first startup.

## Admin Panel Usage

1. **Access the panel:** Navigate to `http://localhost:3088/admin`
2. **Authenticate:** Enter the admin password (default: `12345678`)
3. **Configuration Tab:**
   - View current API configuration
   - Update Base URL, API Key, or Model
4. **Prompt Store Tab:**
   - Browse all AI prompts in card format
   - Add new prompts with full metadata
   - Edit existing prompts inline
   - Delete prompts with confirmation
   - View prompt statistics (images required, variables used)

## JSON-RPC 2.0 Response Format

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "result": { "data": "here" },
  "id": 1
}
```

**Error Response:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": "Additional error info"
  },
  "id": 1
}
```

## Error Codes

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32005`: Rate limit exceeded
- `-32001`: Authentication error
- `-32002`: Authorization error
- `-32003`: Validation error
- `-32004`: Not found