## R2 (사진·PDF)

Vercel 함수는 요청 본문을 4.5MB까지만 받으므로, 배포에서는 사진·PDF를 브라우저가 R2 버킷에 **직접** 올리고 직접 받습니다. 서버는 5분짜리 서명 URL(presigned URL)만 발급하고, 올라온 파일의 앞부분을 다시 읽어 종류(PDF `%PDF-`, JPG·PNG·GIF·WebP; SVG·HEIC 거부)와 크기를 확인한 뒤 확정합니다. 버킷은 공개하지 않으며 키는 서버 환경변수에만 있습니다.

### 1. 버킷

1. Cloudflare 대시보드 → **R2** → **Create bucket** (예: `research-brain`). 위치는 자동, **Public access는 켜지 않습니다**(Custom domain·r2.dev 공개 URL 모두 꺼 둠).
2. 이미 PC에서 R2를 쓰고 있었다면(`.env`의 `S3_*`) 같은 버킷을 그대로 쓰면 됩니다.

### 2. API 토큰 (이 버킷만, 읽기·쓰기)

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

### 3. CORS (필수)

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
- PC에서 `.env`에 R2를 설정하고 `npm run dev`로도 쓰려면 로컬 주소도 넣습니다: `"http://localhost:3000"`, `"http://127.0.0.1:3000"`.
- `Accept-Ranges`를 노출해야 pdf.js가 큰 PDF를 필요한 쪽만 나눠 받습니다(없으면 파일 전체를 먼저 받음).
- 미리보기 배포(`<프로젝트>-<해시>.vercel.app`)는 주소가 매번 달라 CORS에 없으므로 업로드·PDF 보기가 안 됩니다. 운영 주소에서 쓰세요.

### 4. 기존 로컬 파일 올리기 (한 번)

PC에 있던 사진·PDF는 PC에서 `.env`에 위 `S3_*`를 넣은 뒤:

```bash
npm run storage:push -- --dry-run   # 올릴 개수만 확인
npm run storage:push                # 이미 버킷에 있는 것은 건너뜀
```

### 5. 정리

확정되지 않은 임시 업로드(`pending/`, 1시간 지난 것)와 안 쓰는 사진은 PC에서 정리합니다(모든 서버를 끈 상태에서, Turso 설정 후):

```bash
npm run storage:gc-images            # 개수만
npm run storage:gc-images -- --apply # 삭제
```

R2 버킷의 **Object lifecycle rules**에 `pending/` 접두사를 1일 뒤 삭제하는 규칙을 추가해 두면 PC에서 돌리지 않아도 임시 파일이 쌓이지 않습니다(선택).

### 확인

1. 운영 주소에서 로그인 → 노트에 사진 하나 붙여 넣기 → 새로고침 후에도 보이는지.
2. 논문에 PDF 올리기 → 뷰어에서 열리고 쪽 이동이 되는지.
3. 실패하면 브라우저 개발자 도구 콘솔에 CORS 오류가 있는지 보고, 3의 `AllowedOrigins`를 주소와 정확히 같게 고칩니다.
