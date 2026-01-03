# Passport Control Admin - PRD

## Original Problem Statement
Admin LTE themed application for managing passport groups with:
- Group management (create/edit/delete)
- Passport details per group
- Bulk upload passport scans
- Bulk upload profile photos
- Auto-mapping of images using passport number as filename
- File validation (JPG/JPEG only)
- Chrome Extension for auto-filling Iraq e-visa forms

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Theme**: AdminLTE-inspired (Dark Indigo sidebar, Light content)
- **Extension**: Chrome Extension (Manifest V3)

## User Personas
1. **Admin User**: Manages groups, adds passport entries, uploads documents
2. **Data Entry Operator**: Bulk uploads passport scans and photos
3. **Visa Applicant**: Uses Chrome extension to auto-fill e-visa forms

## Core Requirements (Implemented)
- [x] Create/Edit/Delete Groups
- [x] Add Passport entries with comprehensive fields:
  - Passport Number, Type, Place of Issue
  - Issue Date, Expiry Date
  - Names in English (First, Surname, Father, Grandfather)
  - Names in Arabic (First, Surname, Father, Grandfather)
  - **Mother's Information** (Name English/Arabic, Mother's Father Name English/Arabic)
  - Nationality, Gender, Birth Date, Profession
  - **Country of Residence**, **Applicant Type**
- [x] View passport details in modal
- [x] Bulk upload passport scans (JPG/JPEG)
- [x] Bulk upload profile photos (JPG/JPEG)
- [x] Auto-mapping using passport number as filename
- [x] Search and filter passports
- [x] Stats dashboard (Total Groups, Total Passports, With/Without Images)
- [x] Edit passport functionality
- [x] CSV export for group passports
- [x] Excel/CSV bulk import with auto-column mapping
- [x] Downloadable import template
- [x] **Chrome Extension for Iraq E-Visa Form Auto-fill**

## What's Been Implemented (Jan 2026)
1. AdminLTE-style theme with dark sidebar
2. Dashboard with stats cards
3. Groups CRUD operations
4. Enhanced passport form with English/Arabic fields
5. Bulk upload with drag-drop zones
6. Image mapping by passport number
7. Passport detail view modal
8. File type validation (JPG/JPEG only)
9. Edit passport functionality ✅
10. CSV export for group passports ✅
11. Excel/CSV bulk import with auto-column mapping ✅
12. Downloadable import template ✅
13. **Mother's Information fields** (mother_name_en/ar, mother_father_name_en/ar) ✅
14. **Country of Residence field** ✅
15. **Applicant Type field** ✅
16. **Chrome Extension for e-visa auto-fill** ✅

## Chrome Extension Features
- Popup UI for selecting group and passenger
- Settings page for configurable API URL
- Content script for form auto-fill on eservice.evisa.iq
- Field mapping for all passport data
- Date format conversion (to m/d/yyyy)
- Smart dropdown matching
- Success/error notifications

## Prioritized Backlog

### P0 (Critical)
- All core features implemented ✅
- Chrome Extension implemented ✅

### P1 (High Priority)
- [x] Edit passport functionality ✅
- [x] Export passports to CSV/Excel ✅
- [x] Batch passport entry via Excel/CSV import ✅
- [x] Chrome Extension for e-visa form filling ✅
- [ ] Passport image preview in bulk upload results

### P2 (Medium Priority)
- [ ] User authentication (JWT or Google OAuth)
- [ ] Passport expiry alerts/notifications
- [ ] Image cropping for profile photos
- [ ] Data validation on import

### P3 (Low Priority)
- [ ] Multi-language support (Arabic UI)
- [ ] Print passport cards
- [ ] Audit log for changes
- [ ] Group permissions/roles

## Extension Installation
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. Configure API URL in extension settings
