# NASMIX

NASMIX is a project-first music production knowledge system for Iraqi and Arabic arrangement workflows.

Development happens on the `develop` branch. The interface is intentionally lightweight; reusable musical knowledge lives in versioned JSON files under `data/`.

## Song project workflow

Every song is created as an independent local project. The project starts with a required Song Brief, then opens a nine-stage workspace:

1. Song Brief
2. Structure
3. Track Plan
4. Suno Reference
5. Prompt Generation
6. Take Review
7. Cubase Handoff
8. Mix QA
9. Export QA

The project stores the arrangement structure, role-first track plan, generated prompts, successful and rejected decisions, reviewed takes, Cubase notes, QA checks, and export state. Changes are saved automatically to IndexedDB with a localStorage fallback. Complete projects can be exported and imported as JSON.

## Web App

GitHub Pages deployment is configured from the `main` branch through GitHub Actions.