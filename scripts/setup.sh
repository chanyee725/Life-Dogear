#!/usr/bin/env bash
# One-shot setup for a new machine: checks Node, installs packages, prepares .env and the data folder,
# applies DB migrations, builds the production server and (optionally) starts it.
#
#   bash scripts/setup.sh                 # inside a clone
#   bash setup.sh --dir ~/research-brain  # anywhere: clones the repo first
#
# Options:
#   --dir PATH     where to clone when run outside the repo (default: ./Life-Dogear)
#   --branch NAME  branch to check out (default: develop)
#   --seed         add sample data after migrating
#   --start        start the production server on --port when done
#   --port N       port for --start (default: 3100)
#
# It never prints .env values. Fill DATABASE_URL / DATABASE_AUTH_TOKEN yourself (empty = local SQLite file).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/chanyee725/Life-Dogear.git}"
DIR="./Life-Dogear"
BRANCH="develop"
SEED=0
START=0
PORT=3100
MIN_NODE=20

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --seed) SEED=1; shift ;;
    --start) START=1; shift ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "알 수 없는 옵션: $1 (--help 참고)"; exit 1 ;;
  esac
done

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1"; exit 1; }

# 1. Tools ---------------------------------------------------------------------------------------
step "도구 확인"
command -v git >/dev/null || fail "git이 없습니다. 먼저 설치하세요."
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$MIN_NODE" ]; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    echo "nvm으로 Node 24를 설치합니다."
    nvm install 24 >/dev/null && nvm use 24 >/dev/null
  else
    fail "Node ${MIN_NODE} 이상이 필요합니다. https://nodejs.org 또는 nvm(https://github.com/nvm-sh/nvm)으로 설치한 뒤 다시 실행하세요."
  fi
fi
echo "node $(node -v), npm $(npm -v), git $(git --version | cut -d' ' -f3)"

# 2. Source --------------------------------------------------------------------------------------
step "소스 준비"
if git rev-parse --show-toplevel >/dev/null 2>&1 && [ -f "$(git rev-parse --show-toplevel)/drizzle.config.ts" ]; then
  cd "$(git rev-parse --show-toplevel)"
  echo "기존 저장소 사용: $PWD"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "커밋하지 않은 변경이 있어 pull은 건너뜁니다."
  else
    git fetch -q origin && git checkout -q "$BRANCH" && git pull -q --ff-only origin "$BRANCH" || echo "pull 실패 — 지금 코드로 계속합니다."
  fi
else
  [ -e "$DIR" ] && fail "$DIR 가 이미 있습니다. 그 폴더 안에서 실행하거나 --dir로 다른 경로를 주세요."
  git clone -q -b "$BRANCH" "$REPO_URL" "$DIR"
  cd "$DIR"
  echo "클론 완료: $PWD ($BRANCH)"
fi

# 3. Packages ------------------------------------------------------------------------------------
step "패키지 설치 (npm ci)"
npm ci --no-audit --no-fund

# 4. .env ----------------------------------------------------------------------------------------
step "환경 파일"
if [ -f .env ] || [ -f .env.local ]; then
  echo ".env가 이미 있어 그대로 둡니다."
else
  cp .env.example .env
  echo ".env.example을 복사해 .env를 만들었습니다 (값은 비어 있음)."
fi
if grep -qsE '^DATABASE_URL=.+' .env .env.local; then
  MODE="turso"
  echo "DB: Turso (DATABASE_URL 설정됨)"
else
  MODE="local"
  echo "DB: 로컬 SQLite 파일. Turso를 쓰려면 .env에 DATABASE_URL·DATABASE_AUTH_TOKEN을 직접 넣고 다시 실행하세요."
fi
mkdir -p data/pdfs

# 5. Database ------------------------------------------------------------------------------------
step "DB 마이그레이션"
npm run -s db:migrate

if [ "$SEED" = 1 ]; then
  step "샘플 데이터"
  if [ "$MODE" = turso ]; then
    read -r -p "Turso 원격 DB에 샘플 데이터를 넣습니다 (seed- 항목만 교체). 계속할까요? [y/N] " ok
    [ "$ok" = y ] || [ "$ok" = Y ] || { echo "건너뜀"; SEED=0; }
  fi
  if [ "$SEED" = 1 ]; then npm run -s db:seed; fi
fi

# 6. Build ---------------------------------------------------------------------------------------
step "프로덕션 빌드 (.next-prod)"
NEXT_DIST_DIR=.next-prod npx next build

step "완료"
cat <<EOF
실행:   cd "$PWD" && NEXT_DIST_DIR=.next-prod npx next start -H 127.0.0.1 -p $PORT
        (코드를 받은 뒤 다시 빌드까지 하려면: npm run serve)
접속:   http://127.0.0.1:$PORT
EOF
if [ "$MODE" = turso ]; then
  echo "참고: PDF 파일은 DB가 아니라 이 PC의 data/pdfs/에 저장됩니다. 다른 PC에서 올린 PDF는 따로 복사해야 열립니다."
fi

if [ "$START" = 1 ]; then
  exec env NEXT_DIST_DIR=.next-prod npx next start -H 127.0.0.1 -p "$PORT"
fi
