# Bus Incident Management System

## Overview

This is a fleet management application for tracking bus equipment incidents, specifically focused on camera systems, DVR units, GPS devices, hard drives, and cables. The system enables technicians to register equipment issues, monitor camera status across the fleet, track repairs, and generate weekly/monthly operational reports.

The application is built as a full-stack TypeScript project with a React frontend and Express backend, using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Charts**: Recharts for data visualization in reports
- **Forms**: React Hook Form with Zod validation

The frontend follows a page-based structure under `client/src/pages/` with reusable components in `client/src/components/`. Key pages include Dashboard, Register Incident, Camera Status, Equipment Tracking, and Weekly/Monthly Reports.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Design**: RESTful JSON API under `/api/` prefix
- **Schema Validation**: Zod schemas shared between frontend and backend

The backend uses a storage abstraction layer (`server/storage.ts`) that currently implements in-memory storage but is designed to be swapped for database persistence. Routes are registered in `server/routes.ts`.

### Data Model
Core entities defined in `shared/schema.ts`:
- **Users**: Basic authentication (username/password)
- **Buses**: Fleet vehicles identified by bus number and plate
- **Incidents**: Equipment issues with type, status, description, and resolution tracking
- **Equipment Status**: Per-bus equipment health tracking

Equipment types: Camera, DVR, GPS, Hard Drive, Cable
Camera channels: CH1 (Frontal), CH2 (Puerta), CH3 (Camello), CH4 (Pasajeros)
Incident statuses: Pending, In Progress, Resolved

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds static assets, esbuild bundles server code
- **Database Migrations**: Drizzle Kit with `db:push` command

## External Dependencies

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database queries and schema management
- **connect-pg-simple**: Session storage (configured but authentication not fully implemented)

### UI Libraries
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, forms, etc.)
- **Recharts**: Chart visualizations for reports
- **Lucide React**: Icon library
- **date-fns**: Date formatting and manipulation (Spanish locale support)

### Development Tools
- **Vite**: Frontend build tool with React plugin
- **TypeScript**: Type checking across full stack
- **Tailwind CSS**: Utility-first styling
- **ESBuild**: Server bundling for production