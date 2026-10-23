## 1.0.3 - October 2026
### Security
- Server-side admin gate (proxy.ts): verified session + restaurant_staff role check on /admin/**
- Chat API requires sign-in (configurable) with per-user rate limiting
- Support tickets require sign-in
- Added foreign-key indexes
### Changed
- Sessions are stored in cookies (@supabase/ssr)
- Removed bundled .zip files from the archive; added docker-compose.yml and SECURITY.md

# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-10-22
### Added
- Initial release of FoodieAI.
- AI Chatbot integrated with Gemini API.
- Live order management system with Supabase.
- Admin dashboard for restaurant staff.
- Role-based authorization and session management.