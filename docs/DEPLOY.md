# 배포 체크리스트 (나만 쓰기)

Research Brain을 Vercel에 올려 휴대폰·다른 PC에서도 쓰는 순서입니다. 모든 외부 계정 작업과 값 입력은 직접 합니다. 비밀값(토큰·시크릿)은 이 문서·저장소·채팅 어디에도 적지 말고 각 서비스 화면과 Vercel 환경변수에만 넣으세요.

구성: 웹 = Vercel Hobby(`https://<프로젝트>.vercel.app`), DB = Turso, 사진·PDF = Cloudflare R2, 로그인 = Google.

## 0. 앱이 여는 방식

환경변수에 따라 세 가지로 동작합니다.

| 상태 | 동작 |
|---|---|
| `AUTH_SECRET`·`AUTH_GOOGLE_ID`·`AUTH_GOOGLE_SECRET`·`ALLOWED_EMAILS` 네 개 모두 있음 | Google 로그인 필수. `ALLOWED_EMAILS`에 있는 계정만 들어옵니다. |
| 네 개 모두 비어 있고 이 컴퓨터(`127.0.0.1`/`localhost`)에서 실행 | 지금처럼 로그인 없이 열립니다. |
| 일부만 채움, 또는 Vercel·운영 서버(`npm run build`/`start`)인데 비어 있음 | 앱을 열지 않고 **설정 안내 화면**에 채워야 할 환경변수 이름을 보여 줍니다. 운영 서버는 원격 주소로 접속하거나 `ALLOWED_HOSTS`를 채운 경우가 여기에 해당합니다(`localhost`로 접속해도). |

Vercel에서는 사진·PDF를 R2에 저장해야 합니다(`S3_*` 네 개). 비어 있으면 역시 설정 안내 화면이 나옵니다.

로그인하지 않은 요청은 페이지면 `/login`으로 이동하고, `/api/**`는 `401` JSON(`{"error":"로그인이 필요합니다."}`)을 받습니다. 로그인 전에는 페이지에 GET만 허용되고 POST 등은 `403`입니다(로그인 버튼은 Auth.js의 `/api/auth/signin/google`을 씁니다). 허용 목록에 없는 Google 계정은 "이 계정은 사용할 수 없습니다" 화면으로 가고 세션이 만들어지지 않습니다.

## 1. Google 로그인 (OAuth 클라이언트)

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 만들기(또는 선택).
2. **API 및 서비스 → OAuth 동의 화면**: 사용자 유형 "외부", 앱 이름 `Research Brain`. 게시 상태는 "테스트"로 두고 **테스트 사용자**에 본인 Google 계정만 추가합니다.
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**, 유형 "웹 애플리케이션".
4. **승인된 리디렉션 URI**에 추가:
   - `https://<프로젝트>.vercel.app/api/auth/callback/google`
   - (PC에서 로그인까지 시험하려면) `http://localhost:3000/api/auth/callback/google`
5. 만든 클라이언트 ID → `AUTH_GOOGLE_ID`, 클라이언트 보안 비밀 → `AUTH_GOOGLE_SECRET`.
6. `AUTH_SECRET`은 임의의 긴 문자열입니다. 터미널에서 `openssl rand -base64 32` 결과를 그대로 씁니다(어디에도 저장하지 말고 바로 Vercel에 붙여 넣기).
7. `ALLOWED_EMAILS`: 들어올 Google 계정, 쉼표로 구분(대소문자 무시). 예: `you@example.com`

> PC에서 로그인 시험은 `http://localhost:3000`으로 여세요. Next가 미들웨어 리디렉션에서 `127.0.0.1`을 `localhost`로 바꾸므로, `127.0.0.1`로 시작하면 로그인 쿠키와 주소가 어긋납니다.

## 2. R2 (사진·PDF)

Vercel 함수는 요청 본문을 4.5MB까지만 받으므로, 배포에서는 사진·PDF를 브라우저가 R2 버킷에 **직접** 올리고 직접 받습니다. 서버는 5분짜리 서명 URL(presigned URL)만 발급하고, 올라온 파일의 앞부분을 다시 읽어 종류(PDF `%PDF-`, JPG·PNG·GIF·WebP; SVG·HEIC 거부)와 크기를 확인한 뒤 확정합니다. 버킷은 공개하지 않으며 키는 서버 환경변수에만 있습니다.

### 2.1 버킷

1. Cloudflare 대시보드 → **R2** → **Create bucket** (예: `research-brain`). 위치는 자동, **Public access는 켜지 않습니다**(Custom domain·r2.dev 공개 URL 모두 꺼 둠).
2. 이미 PC에서 R2를 쓰고 있었다면(`.env`의 `S3_*`) 같은 버킷을 그대로 쓰면 됩니다.

### 2.2 API 토큰 (이 버킷만, 읽기·쓰기)

1. **R2** → **Manage R2 API Tokens** → **Create API token**.
2. 권한: **Object Read & Write**. **Specify bucket(s)** 에서 위 버킷 **하나만** 고릅니다(계정 전체 권한·Admin 권한은 쓰지 않음). TTL은 원하는 대로.
3. 만든 뒤 보이는 **Access Key ID**와 **Secret Access Key**를 바로 Vercel 환경변수에 넣습니다(Secret은 한 번만 보입니다). 메모장·채팅·커밋에 붙여 넣지 마세요.
4. 엔드포인트는 같은 화면의 **S3 API** 주소 `https://<계정 ID>.r2.cloudflarestorage.com` 입니다(버킷 이름은 붙이지 않음).

Vercel → 프로젝트 → **Settings → Environment Variables** (Production):

| 이름 | 값 |
|---|---|
| `S3_ENDPOINT` | `https://<계정 ID>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | 버킷 이름 |
| `S3_ACCESS_KEY_ID` | 토큰의 Access Key ID |
| `S3_SECRET_ACCESS_KEY` | 토큰의 Secret Access Key |
| `S3_REGION` | 비워 둠 (`auto`) |

`BLOB_STORE`는 Vercel에 넣지 않습니다(`local`이면 버킷을 쓰지 않음).

### 2.3 CORS (필수)

브라우저가 버킷에 직접 PUT(업로드)하고, PDF 뷰어(pdf.js)가 버킷에서 직접 Range 요청으로 읽으므로 버킷에 CORS 규칙이 있어야 합니다. 없으면 업로드가 "연결을 확인해 주세요"로 실패하고 PDF가 열리지 않습니다. (사진 `<img>` 표시는 CORS와 무관합니다.)

버킷 → **Settings** → **CORS Policy** → **Add CORS policy** → JSON:

```json
[
  {
    "AllowedOrigins": ["https://<프로젝트>.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- `AllowedOrigins`: 내 Vercel 주소만(끝에 `/` 없이). `*`는 쓰지 않습니다. 커스텀 도메인을 붙이면 그 주소도 추가합니다.
- PC에서 `.env`에 R2를 설정하고 `npm run dev`로도 쓰려면 로컬 주소도 넣습니다: `"http://localhost:3000"`(로그인 시험은 localhost로 하므로 이것이 필요합니다. `127.0.0.1:3000`으로도 열 거라면 그것도 넣습니다).
- `Accept-Ranges`를 노출해야 pdf.js가 큰 PDF를 필요한 쪽만 나눠 받습니다(없으면 파일 전체를 먼저 받음).
- 미리보기 배포(`<프로젝트>-<해시>.vercel.app`)는 주소가 매번 달라 CORS에 없으므로 업로드·PDF 보기가 안 됩니다. 운영 주소에서 쓰세요.

### 2.4 기존 로컬 파일 올리기 (한 번)

PC에 있던 사진·PDF는 PC에서 `.env`에 위 `S3_*`를 넣은 뒤:

```bash
npm run storage:push -- --dry-run   # 올릴 개수만 확인
npm run storage:push                # 이미 버킷에 있는 것은 건너뜀
```

### 2.5 정리

확정되지 않은 임시 업로드(`pending/`, 1시간 지난 것)와 안 쓰는 사진은 PC에서 정리합니다(모든 서버를 끈 상태에서, Turso 설정 후):

```bash
npm run storage:gc-images            # 개수만
npm run storage:gc-images -- --apply # 삭제
```

R2 버킷의 **Object lifecycle rules**에 `pending/` 접두사를 1일 뒤 삭제하는 규칙을 추가해 두면 PC에서 돌리지 않아도 임시 파일이 쌓이지 않습니다(선택).

### 2.6 확인

1. 운영 주소에서 로그인 → 노트에 사진 하나 붙여 넣기 → 새로고침 후에도 보이는지.
2. 논문에 PDF 올리기 → 뷰어에서 열리고 쪽 이동이 되는지.
3. 실패하면 브라우저 개발자 도구 콘솔에 CORS 오류가 있는지 보고, 3의 `AllowedOrigins`를 주소와 정확히 같게 고칩니다.

## 3. Turso (DB)

1. [Turso](https://turso.tech/)에 가입하고 DB를 만듭니다(지역은 가까운 곳, 예: 도쿄).
2. DB 주소(`libsql://<db>-<계정>.turso.io`) → `DATABASE_URL`.
3. DB 토큰 만들기(읽기·쓰기) → `DATABASE_AUTH_TOKEN`.

### 첫 마이그레이션 (PC에서)

Vercel 빌드는 마이그레이션을 하지 않습니다. 스키마는 PC에서 Turso를 대상으로 올립니다. 이후 스키마가 바뀐 버전을 배포할 때마다 같은 명령을 **배포 전에** 한 번 실행합니다.

```bash
# 이 셸에서만 잠시 지정합니다. 토큰은 화면에 보이지 않게 입력합니다.
read -r -p "DATABASE_URL: " DATABASE_URL
read -r -s -p "DATABASE_AUTH_TOKEN: " DATABASE_AUTH_TOKEN; echo
export DATABASE_URL DATABASE_AUTH_TOKEN
npm run db:migrate
unset DATABASE_URL DATABASE_AUTH_TOKEN
```

PC에 있던 노트를 옮기려면 로컬 DB 대신 Turso를 쓰도록 `.env`에 같은 두 값을 넣고 쓰던 방식대로 이어 쓰면 됩니다(로컬 SQLite 파일의 내용은 자동으로 옮겨지지 않습니다). 사진·PDF는 R2 절의 `npm run storage:push`로 버킷에 올립니다.

## 4. Vercel

1. [Vercel](https://vercel.com/)에서 **Add New → Project** → 이 저장소(GitHub) 가져오기. Framework는 Next.js 자동 인식, 빌드 명령·출력은 기본값.
2. **Settings → Environment Variables** (Production)에 값을 직접 입력합니다.

   | 이름 | 값 |
   |---|---|
   | `AUTH_SECRET` | 1절 6번 |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | 1절 5번 |
   | `ALLOWED_EMAILS` | 1절 7번 |
   | `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | 3절 |
   | `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 2절 |
   | `ALLOWED_HOSTS` | `<프로젝트>.vercel.app` |
   | `GOOGLE_CALENDAR_ICS_URLS` | (선택) 6절 |

   - `ALLOWED_HOSTS`가 없으면 Host 검사에서 403 "허용되지 않은 주소입니다"가 나옵니다. 미리보기(Preview) 배포 주소는 일부러 넣지 않습니다(그 주소로는 열리지 않음).
   - `DATA_DIR`·`BLOB_STORE`는 넣지 않습니다.
3. **Deploy**. 환경변수를 바꾼 뒤에는 **Deployments → Redeploy**해야 반영됩니다.
4. 설정 안내 화면이 나오면 화면에 적힌 환경변수 이름을 확인해 채우고 다시 배포합니다.

## 5. 첫 로그인 확인

1. `https://<프로젝트>.vercel.app`을 엽니다 → `/login` 화면.
2. **Google로 로그인** → 허용한 계정 선택 → 홈 화면이 열리면 성공.
3. 다른 Google 계정(또는 시크릿 창)으로 시도하면 "이 계정은 사용할 수 없습니다"가 나와야 합니다.
4. 사진 한 장 붙여 넣기, PDF 하나 올리기·열기를 확인합니다.

문제가 생기면:

- **redirect_uri_mismatch**: 1절 4번의 리디렉션 URI가 실제 주소와 정확히 같은지(https, 끝 경로) 확인.
- **로그인 후 다시 로그인 화면**: `ALLOWED_EMAILS`에 그 계정이 있는지, 바꾼 뒤 Redeploy했는지 확인.
- **403 허용되지 않은 주소**: `ALLOWED_HOSTS`에 `<프로젝트>.vercel.app`이 있는지 확인.

## 6. Google 캘린더 (선택, 읽기 전용)

할 일 달력에 Google 캘린더 일정을 함께 보여 줍니다. 앱은 일정을 읽기만 하고 Google 쪽을 바꾸지 않습니다. 비워 두면 Google 일정 없이 앱 날짜만 보입니다.

1. PC 브라우저에서 [Google 캘린더](https://calendar.google.com/) → 오른쪽 위 톱니바퀴 → **설정**.
2. 왼쪽 **내 캘린더의 설정**에서 보여 줄 캘린더를 누르고 **캘린더 통합**으로 내려갑니다.
3. **iCal 형식의 비공개 주소**를 복사합니다("공개 주소"가 아님).
4. 그 주소를 `GOOGLE_CALENDAR_ICS_URLS`에 넣습니다. 캘린더가 여럿이면 쉼표로 이어 붙입니다. 형식만 예로 들면 `https://calendar.google.com/calendar/ical/<캘린더 ID>/private-<비밀 값>/basic.ics,https://…/basic.ics`
   - Vercel: **Settings → Environment Variables**에 붙여 넣고 **Redeploy**.
   - PC: 프로젝트 폴더의 `.env.local`에 `GOOGLE_CALENDAR_ICS_URLS=` 다음에 붙여 넣고 개발 서버를 다시 시작.
5. 달력을 열어 Google 일정(회색)이 보이는지 확인합니다.

주의:

- **비공개 주소는 비밀번호와 같습니다.** 이 주소만 있으면 누구나 그 캘린더의 모든 일정을 볼 수 있습니다. 이 문서·저장소·채팅·스크린샷 어디에도 남기지 말고 Vercel 환경변수와 `.env.local`에만 넣으세요. 새어 나갔다면 2번 화면의 **재설정**으로 주소를 바꾸고 환경변수도 새 주소로 바꿉니다.
- 앱은 서버에서만 주소를 씁니다. 화면·응답·로그에는 주소가 나오지 않고, 일정의 제목·시간·종일 여부·Google 캘린더 날짜 링크만 보냅니다(설명·장소·참석자는 보내지 않음).
- 서버가 주소별로 10분 동안 기억합니다. Google에서 바꾼 일정은 최대 10분(Google 쪽 갱신이 늦으면 그보다 더) 뒤에 보입니다.
- 불러오지 못하면 달력에 "캘린더를 불러오지 못했습니다" 한 줄이 나옵니다. 서버 로그에는 몇 번째 주소인지와 오류 종류만 남습니다(예: `Google calendar #2 failed: IcsFetchError(http_404)`). `http_404`면 주소가 재설정됐거나 잘못 복사된 것이니 다시 복사합니다. `https://`(또는 `webcal://`)로 시작하지 않는 주소는 쓰지 않습니다.
- 반복 일정은 보고 있는 달·주 안에서만 펼치고, 시간대는 일정의 시간대를 따르되 한국 시간으로 보여 줍니다.
