#!/usr/bin/env bash
# setup.sh – Install all dependencies for ReelCut
# Run from the video-converter/ root directory.

set -e

RESET='\033[0m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${CYAN}  ReelCut – Dependency Installer${RESET}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

# Check Node
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}⚠  Node.js not found. Please install Node ≥ 18 from https://nodejs.org${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ Node $(node -v) found${RESET}"

# Check FFmpeg
if ! command -v ffmpeg &>/dev/null; then
  echo -e "${YELLOW}⚠  FFmpeg not found in PATH."
  echo -e "   macOS:   brew install ffmpeg"
  echo -e "   Ubuntu:  sudo apt install ffmpeg"
  echo -e "   Windows: https://www.gyan.dev/ffmpeg/builds/${RESET}"
  echo ""
  echo -e "${YELLOW}   The app will not work without FFmpeg. Install it, then re-run setup.sh${RESET}"
else
  echo -e "${GREEN}✓ FFmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}') found${RESET}"
fi

echo ""
echo -e "${CYAN}Installing backend dependencies…${RESET}"
cd backend && npm install && cd ..
echo -e "${GREEN}✓ Backend deps installed${RESET}"

echo ""
echo -e "${CYAN}Installing frontend dependencies…${RESET}"
cd frontend && npm install && cd ..
echo -e "${GREEN}✓ Frontend deps installed${RESET}"

# Copy .env if not present
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo -e "${GREEN}✓ Created backend/.env from .env.example${RESET}"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}  All done! Start the app:${RESET}"
echo ""
echo -e "  Terminal 1 → ${CYAN}cd backend  && npm start${RESET}"
echo -e "  Terminal 2 → ${CYAN}cd frontend && npm start${RESET}"
echo ""
echo -e "  Then open → ${CYAN}http://localhost:3000${RESET}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
