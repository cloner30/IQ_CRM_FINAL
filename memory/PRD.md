# Passport Control Admin - PRD

## Original Problem Statement
Admin LTE themed application for managing passport groups with:
- Group management (create/edit/delete)
- Passport details per group
- Bulk upload passport scans
- Bulk upload profile photos
- Auto-mapping of images using passport number as filename
- File validation (JPG/JPEG only)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Theme**: AdminLTE-inspired (Dark Indigo sidebar, Light content)

## User Personas
1. **Admin User**: Manages groups, adds passport entries, uploads documents
2. **Data Entry Operator**: Bulk uploads passport scans and photos

## Core Requirements (Implemented)
- [x] Create/Edit/Delete Groups
- [x] Add Passport entries with comprehensive fields:
  - Passport Number, Type, Place of Issue
  - Issue Date, Expiry Date
  - Names in English (First, Surname, Father, Grandfather)
  - Names in Arabic (First, Surname, Father, Grandfather)
  - Nationality, Gender, Birth Date, Profession
- [x] View passport details in modal
- [x] Bulk upload passport scans (JPG/JPEG)
- [x] Bulk upload profile photos (JPG/JPEG)
- [x] Auto-mapping using passport number as filename
- [x] Search and filter passports
- [x] Stats dashboard (Total Groups, Total Passports, With/Without Images)

## What's Been Implemented (Jan 2026)
1. AdminLTE-style theme with dark sidebar
2. Dashboard with stats cards
3. Groups CRUD operations
4. Enhanced passport form with English/Arabic fields
5. Bulk upload with drag-drop zones
6. Image mapping by passport number
7. Passport detail view modal
8. File type validation (JPG/JPEG only)

## Prioritized Backlog

### P0 (Critical)
- All core features implemented ✅

### P1 (High Priority)
- [ ] Edit passport functionality
- [ ] Export passports to CSV/Excel
- [ ] Passport image preview in bulk upload results

### P2 (Medium Priority)
- [ ] User authentication (JWT or Google OAuth)
- [ ] Passport expiry alerts/notifications
- [ ] Image cropping for profile photos
- [ ] Batch passport entry via CSV import

### P3 (Low Priority)
- [ ] Multi-language support (Arabic UI)
- [ ] Print passport cards
- [ ] Audit log for changes
- [ ] Group permissions/roles

## Next Tasks
1. Add edit passport functionality
2. Implement CSV export for passport data
3. Add user authentication if needed
