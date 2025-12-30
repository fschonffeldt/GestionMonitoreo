# Design Guidelines: Bus Incident Management System

## Design Approach
**Selected System**: Material Design (Data-intensive applications)
**Rationale**: This is an operational, utility-focused application requiring efficient data entry, clear status visualization, and robust reporting. Material Design provides excellent patterns for forms, tables, and data hierarchy.

## Typography
- **Primary Font**: Roboto (via Google Fonts CDN)
- **Headings**: Roboto Medium (500) - Page titles: text-2xl, Section headers: text-xl, Card headers: text-lg
- **Body Text**: Roboto Regular (400) - Base: text-base, Small labels: text-sm
- **Data/Numbers**: Roboto Mono (400) for incident IDs, dates, and technical specifications

## Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 to p-6
- Section spacing: mb-6 to mb-8
- Form field gaps: gap-4
- Card margins: m-4

**Grid Structure**:
- Dashboard: 3-column grid (lg:grid-cols-3) for status cards
- Incident list: Single column with responsive table
- Reports: 2-column layout (lg:grid-cols-2) for charts and summaries

## Core Components

### Navigation
- **Sidebar Navigation**: Fixed left sidebar (w-64) with main sections:
  - Dashboard overview
  - Register incident
  - Camera status
  - Equipment tracking
  - Weekly reports
  - Monthly reports
- **Top Bar**: Company/fleet name, quick actions, user profile

### Dashboard Cards
- **Status Cards**: Display active incidents by type (cameras, DVR, GPS, cables)
- **Quick Stats**: Total buses, incidents this week, pending repairs
- **Recent Activity**: Last 5 incidents with timestamp and bus number
- Card elevation: Subtle shadow (shadow-md), rounded corners (rounded-lg)

### Incident Entry Form
- **Form Layout**: Single column, grouped by sections
  - Bus identification (number/plate)
  - Incident type (dropdown: Camera, DVR, GPS, Cable, Hard Drive)
  - Camera channel selection (CH1-CH4 with icons/labels: Frontal, Puerta, Camello, Pasajeros)
  - Problem description (textarea)
  - Resolution/change notes
  - Date/time (auto-populated, editable)
- **Form controls**: Filled Material inputs with clear labels above
- **Submit button**: Primary action, full-width on mobile, fixed width on desktop

### Camera Status Interface
- **Visual Grid**: 2x2 grid showing all 4 cameras per bus
- **Status Indicators**: 
  - Green dot: Operational
  - Yellow dot: Misaligned ("chueca")
  - Red dot: Faulty/needs replacement
- **Camera Labels**: CH1 (Frontal), CH2 (Puerta), CH3 (Camello), CH4 (Pasajeros) with small icons

### Equipment Tracking Table
- **Table Structure**: Responsive data table with columns:
  - Bus number
  - Equipment type
  - Status
  - Last incident date
  - Action (view/edit button)
- **Filters**: Dropdown filters for equipment type and status
- **Search**: Text input for bus number search
- **Pagination**: Bottom pagination controls

### Report Views
- **Weekly Report**: 
  - Summary cards (incidents by type, most affected buses)
  - Timeline chart showing incident distribution
  - Export button (PDF/Excel)
- **Monthly Report**:
  - Comparison metrics (month-over-month)
  - Bar charts for incident categories
  - Top issues list
  - Maintenance recommendations section

## Component Library
- **Buttons**: Material filled buttons (primary), outlined buttons (secondary)
- **Icons**: Material Icons via CDN - use camera, cable, storage, navigation icons
- **Input Fields**: Filled Material text fields with floating labels
- **Dropdowns**: Material select with clear options
- **Date Pickers**: Calendar icon with Material date input
- **Tables**: Striped rows (even rows with subtle background), hover states
- **Modal Dialogs**: For incident details and confirmations
- **Snackbar Notifications**: Success/error messages bottom-left

## Animations
**Minimal, Functional Only**:
- Fade-in for notification messages (300ms)
- Smooth scroll to form errors
- No decorative animations

## Images
**No Hero Image**: This is an operational dashboard, not a marketing site.
**Icon-Based Visual System**: Use Material Icons throughout for visual hierarchy without photos.

## Data Visualization
- **Charts**: Use Chart.js for weekly/monthly trend visualization
- **Color Coding**: Green (resolved), Yellow (pending), Red (critical)
- **Progress Indicators**: Linear progress bars for repair completion tracking