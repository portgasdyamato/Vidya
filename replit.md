# Project Vidya: AI-Powered Accessible Learning Companion

## Overview

Project Vidya is an AI-powered web application designed to make educational content accessible to students with visual or hearing impairments. The platform transforms documents, images, and videos into accessible formats using OpenAI's APIs, providing features like text extraction, audio conversion, content summarization, and quiz generation. Built as a full-stack solution, it aims to break down educational barriers and create inclusive learning experiences for students in India and beyond.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/UI components built on Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design system and CSS variables for theming
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **Form Handling**: React Hook Form with Zod validation for type-safe forms

### Backend Architecture
- **Runtime**: Node.js with Express.js framework using ESM modules
- **Language**: TypeScript for full-stack type safety
- **API Design**: RESTful API architecture with organized route handlers
- **File Processing**: Multer for multipart file uploads with temporary storage
- **Background Processing**: Asynchronous content processing to avoid blocking requests

### Database Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with Neon serverless hosting
- **Schema Design**: 
  - Users table for basic user management
  - Content items table with JSONB fields for flexible metadata storage
  - Enum types for content types (document, image, video) and processing status
  - Relational structure linking users to their content items

### File Processing Pipeline
- **Document Processing**: PDF extraction using pdf.js-extract, DOCX processing with mammoth
- **Image Processing**: Base64 encoding for OpenAI Vision API integration
- **Content Storage**: Local file system for temporary uploads, processed content stored in database
- **Processing States**: Pending → Processing → Completed/Failed workflow

### AI Integration Architecture
- **OpenAI APIs**: GPT-5 for text processing, Vision API for image analysis, Whisper for audio transcription
- **Processing Features**:
  - Text extraction from images and documents
  - Content summarization and simplification
  - Quiz generation from educational content
  - Text-to-speech conversion for accessibility
- **Error Handling**: Comprehensive error management for API failures and processing issues

### Authentication & Security
- **Session Management**: Express sessions with PostgreSQL session store
- **User Management**: Basic username/password authentication (expandable)
- **File Security**: Temporary file handling with cleanup procedures

### Development Environment
- **Build System**: Vite for fast development and optimized production builds
- **Development Server**: Express with Vite middleware for seamless full-stack development
- **Hot Module Replacement**: Vite HMR for rapid development iteration
- **TypeScript Configuration**: Shared types between frontend and backend via shared directory

## External Dependencies

### Core Technologies
- **Node.js & Express**: Server runtime and web framework
- **React & TypeScript**: Frontend framework with static typing
- **Vite**: Modern build tool and development server
- **PostgreSQL**: Primary database with Neon serverless hosting

### Database & ORM
- **Drizzle ORM**: Type-safe database operations and migrations
- **@neondatabase/serverless**: Serverless PostgreSQL connection with WebSocket support

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Shadcn/UI**: Pre-built component library
- **Lucide React**: Icon library for consistent iconography

### File Processing
- **Multer**: Multipart form data handling for file uploads
- **pdf.js-extract**: PDF text extraction
- **mammoth**: Microsoft Word document processing

### AI & OpenAI Integration
- **OpenAI SDK**: GPT-5, Vision API, and Whisper API integration
- **Base64 Encoding**: Image processing for Vision API

### State Management & HTTP
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition

### Session & Authentication
- **express-session**: Session management middleware
- **connect-pg-simple**: PostgreSQL session store

### Development Tools
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production builds
- **@replit/vite-plugin**: Replit-specific development enhancements