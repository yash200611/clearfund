#!/bin/bash
# ClearFund Localnet Startup Script
# Starts: Solana test validator, Backend, Frontend

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== ClearFund Localnet Startup ===${NC}"

# 1. Check prerequisites
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v solana-test-validator &>/dev/null; then
    echo -e "${RED}ERROR: solana-test-validator not found. Install Solana CLI.${NC}"
    exit 1
fi

if ! command -v python3 &>/dev/null; then
    echo -e "${RED}ERROR: python3 not found.${NC}"
    exit 1
fi

# Check backend .env
if [ ! -f backend/.env ]; then
    echo -e "${RED}ERROR: backend/.env not found. Copy from .env.example and fill in secrets.${NC}"
    exit 1
fi

if grep -q "PASTE_YOUR_MONGO_URL_HERE" backend/.env; then
    echo -e "${RED}ERROR: MONGO_URL not set in backend/.env. Please fill in your MongoDB connection string.${NC}"
    exit 1
fi

echo -e "${GREEN}  Prerequisites OK${NC}"

# 2. Start Solana test validator
echo -e "${YELLOW}[2/5] Starting Solana test validator...${NC}"
pkill -f solana-test-validator 2>/dev/null || true
sleep 1
solana-test-validator --reset --quiet &>/tmp/solana-validator.log &
VALIDATOR_PID=$!
echo "  Validator PID: $VALIDATOR_PID"

# Wait for validator to be ready
for i in $(seq 1 15); do
    if solana cluster-version &>/dev/null 2>&1; then
        echo -e "${GREEN}  Validator ready!${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 15 ]; then
        echo -e "${RED}  Validator failed to start. Check /tmp/solana-validator.log${NC}"
        exit 1
    fi
done

# 3. Fund system keypair
echo -e "${YELLOW}[3/5] Funding system keypair...${NC}"
SYSTEM_ADDR=$(solana address)
echo "  System address: $SYSTEM_ADDR"
BALANCE=$(solana balance --lamports 2>/dev/null | awk '{print $1}')
echo -e "${GREEN}  System balance: $(solana balance)${NC}"

# 4. Start backend
echo -e "${YELLOW}[4/5] Starting backend on port 8000...${NC}"
cd backend
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload &>/tmp/clearfund-backend.log &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"
cd ..

# Wait for backend
for i in $(seq 1 15); do
    if curl -s http://localhost:8000/api/health &>/dev/null 2>&1; then
        echo -e "${GREEN}  Backend ready!${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 15 ]; then
        echo -e "${YELLOW}  Backend may still be starting... check /tmp/clearfund-backend.log${NC}"
    fi
done

# 5. Start frontend
echo -e "${YELLOW}[5/5] Starting frontend on port 5173...${NC}"
cd frontend
npm run dev &>/tmp/clearfund-frontend.log &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"
cd ..

echo ""
echo -e "${GREEN}=== All services started ===${NC}"
echo ""
echo "  Solana Validator:  http://127.0.0.1:8899  (PID: $VALIDATOR_PID)"
echo "  Backend API:       http://localhost:8000   (PID: $BACKEND_PID)"
echo "  Frontend:          http://localhost:5173   (PID: $FRONTEND_PID)"
echo ""
echo "  Logs:"
echo "    Validator: /tmp/solana-validator.log"
echo "    Backend:   /tmp/clearfund-backend.log"
echo "    Frontend:  /tmp/clearfund-frontend.log"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo "  kill $VALIDATOR_PID $BACKEND_PID $FRONTEND_PID"
echo ""
echo -e "${YELLOW}To expose backend via ngrok:${NC}"
echo "  ngrok http 8000"
