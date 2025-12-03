#!/bin/bash

# Claude Code Command Center - Setup Script
# For Matt's ThinkPad X1 running WSL2/Ubuntu

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Claude Code Command Center - Setup Script              ║"
echo "║     Multi-Agent Observability for HackLearn Pro            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check Bun
if ! command -v bun &> /dev/null; then
    print_warning "Bun not found. Installing..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
else
    print_success "Bun found: $(bun --version)"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_warning "Node.js not found. Installing via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
else
    print_success "Node.js found: $(node --version)"
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python3 not found. Please install Python 3.8+"
    exit 1
else
    print_success "Python3 found: $(python3 --version)"
fi

# Check Claude Code
if ! command -v claude &> /dev/null; then
    print_warning "Claude Code CLI not found in PATH"
    print_warning "Make sure you have Claude Code installed: npm install -g @anthropic-ai/claude-code"
fi

echo ""
print_step "Setting up Command Center..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Install server dependencies
print_step "Installing server dependencies..."
cd server
bun install
cd ..

# Install dashboard dependencies
print_step "Installing dashboard dependencies..."
cd dashboard
npm install
cd ..

# Copy .claude template to user's global config
print_step "Setting up global Claude Code configuration..."

CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR"
mkdir -p "$CLAUDE_DIR/agents"
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/hooks"
mkdir -p "$CLAUDE_DIR/memory"

# Copy template files
if [ -d ".claude-template" ]; then
    cp -r .claude-template/* "$CLAUDE_DIR/"
    print_success "Copied configuration to ~/.claude/"
fi

# Make hook scripts executable
chmod +x "$CLAUDE_DIR/hooks/"*.py 2>/dev/null || true

# Create convenience scripts
print_step "Creating convenience scripts..."

# Start script
cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting Claude Code Command Center..."

# Start server in background
cd "$(dirname "$0")/server"
bun run start &
SERVER_PID=$!

# Wait for server to be ready
sleep 2

# Start dashboard
cd "$(dirname "$0")/dashboard"
npm run dev &
DASHBOARD_PID=$!

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Command Center is running!                                ║"
echo "║                                                            ║"
echo "║  Dashboard:  http://localhost:5173                         ║"
echo "║  Server:     http://localhost:4000                         ║"
echo "║                                                            ║"
echo "║  Press Ctrl+C to stop                                      ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Wait for interrupt
trap "kill $SERVER_PID $DASHBOARD_PID 2>/dev/null; exit" INT
wait
EOF
chmod +x start.sh

# Stop script
cat > stop.sh << 'EOF'
#!/bin/bash
echo "Stopping Claude Code Command Center..."
pkill -f "bun run" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
echo "Stopped."
EOF
chmod +x stop.sh

echo ""
print_success "Setup complete!"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                     SETUP COMPLETE                         ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  To start the Command Center:                              ║"
echo "║    ./start.sh                                              ║"
echo "║                                                            ║"
echo "║  To stop:                                                  ║"
echo "║    ./stop.sh  (or Ctrl+C)                                  ║"
echo "║                                                            ║"
echo "║  Your .claude folder is configured at:                     ║"
echo "║    ~/.claude/                                              ║"
echo "║                                                            ║"
echo "║  Available agents:                                         ║"
echo "║    @researcher   - Deep exploration                        ║"
echo "║    @implementer  - Systematic building                     ║"
echo "║    @reviewer     - Code quality checks                     ║"
echo "║    @consensus    - Multi-perspective decisions             ║"
echo "║    @memory-keeper - Long-term project memory               ║"
echo "║                                                            ║"
echo "║  Available commands:                                       ║"
echo "║    /research, /implement, /review, /decide,                ║"
echo "║    /memory, /test, /hacklearn                              ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Run ./start.sh to launch the Command Center"
echo "2. Open http://localhost:5173 in your browser"
echo "3. Start a Claude Code session in any project"
echo "4. Watch events stream into your dashboard!"
echo ""
