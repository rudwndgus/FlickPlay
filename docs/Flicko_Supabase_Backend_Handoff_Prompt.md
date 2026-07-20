# 집에서 실행할 Flicko 서버·DB 구현 프롬프트

아래의 `복사 시작`부터 `복사 끝`까지를 집 컴퓨터의 Codex에 그대로 전달한다. 이 문서에는 실제 API 키나 비밀번호를 적지 않는다.

---

## 복사 시작

현재 저장소의 Flicko를 단순 게임 모음이 아니라 실제 게임 SNS 프로토타입으로 발전시켜라. 먼저 최신 `main`을 pull하고 `README.md`, `src/app/App.tsx`, `src/social/`, `src/services/storage/`, `.env.example`을 전부 읽어 현재 구조와 브랜드 방향을 이해하라.

현재 프론트에는 다음 네 탭이 있다.

1. 홈: 스토리와 플레이 기록 게시물
2. 탐색: 로그인 없이 바로 플레이할 수 있는 기존 세로형 게임 피드
3. DM: 대화 목록과 대화 화면
4. 프로필: 로컬 플레이 기록과 저장 게임

목표는 현재 목업 데이터를 Supabase 기반의 실제 인증·Postgres DB·Realtime·Storage로 교체하는 것이다. 첫 진입 로그인은 강제하지 않는다. 누구나 게임 탐색, 게임 플레이, 공개 게시물 열람은 할 수 있어야 한다. 좋아요, 댓글, 팔로우, 저장, 기록 공유, 스토리 작성, DM 전송, 프로필 수정처럼 계정이 필요한 행동을 할 때만 로그인 시트를 띄운다. 로그인 후에는 원래 시도하던 행동으로 자연스럽게 돌아가게 한다.

### 1. 보안과 환경 변수

- Supabase 최신 공식 문서를 기준으로 구현한다.
- 클라이언트에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`만 사용한다.
- 실제 값은 `.env.local`에만 넣고 절대 커밋하지 않는다. `.env.example`에는 예시 이름만 유지한다.
- `secret`, `service_role`, DB password, personal access token, OAuth client secret은 브라우저 코드, 문서, 로그, GitHub 커밋 어디에도 넣지 않는다.
- 관리자 권한이 필요한 동작은 브라우저에서 수행하지 말고 Supabase Edge Function 또는 신뢰할 수 있는 서버에서만 수행한다.
- 작업 시작 전 `git status`로 사용자 변경을 확인하고, 기존 게임 및 로컬 기록을 훼손하지 않는다.

### 2. Supabase 프로젝트 설정

- 개발용 Supabase 프로젝트를 별도로 만든다.
- Auth는 우선 이메일 OTP와 Google 로그인을 지원하도록 구성한다. 프론트 구조는 다른 공급자를 추가할 수 있게 한다.
- Site URL과 Redirect URL에 로컬 개발 주소와 실제 GitHub Pages 주소를 모두 등록한다.
  - `http://localhost:5173/**`
  - 현재 저장소의 실제 GitHub Pages 배포 URL과 그 하위 해시 라우트
- GitHub Pages는 정적 프론트 배포만 담당하고, 인증·DB·Realtime·파일은 Supabase가 담당한다.

### 3. 재현 가능한 DB 마이그레이션

Supabase CLI의 `supabase/migrations/`에 SQL 마이그레이션을 작성한다. 대시보드에서 수동으로만 만든 설정에 의존하지 않는다. 최소한 다음 테이블을 설계한다. 모든 기본 키는 UUID를 권장하고, 시간은 `timestamptz`, 사용자 참조는 `auth.users(id)`를 사용한다.

- `profiles`: `id`, 고유 `username`, `display_name`, `bio`, `avatar_path`, `is_private`, `created_at`, `updated_at`
- `follows`: `follower_id`, `following_id`, `status`, `created_at`; 자기 자신 팔로우 금지, 조합 unique
- `games`: 기존 코드의 game id/slug와 연결되는 고유 `slug`, 제목, 설명, 테마/아이콘 메타데이터, 공개 상태
- `play_runs`: 사용자, 게임, 점수, 플레이 시간, 결과 메타데이터, 생성 시각; 클라이언트 제출 점수임을 구분할 필드 포함
- `posts`: 작성자, 게임, 선택적 `play_run_id`, 본문, 공개 범위, 생성/수정 시각, 삭제 시각
- `post_likes`: post/user 조합 unique
- `comments`: post, 작성자, 선택적 parent comment, 본문, 생성/수정/삭제 시각
- `bookmarks`: user/game 또는 user/post 저장 관계; 중복 금지
- `stories`: 작성자, media path 또는 기록 카드 payload, 24시간 만료 시각, 생성 시각
- `conversations`: direct/group 종류, 생성 시각, 최근 메시지 시각
- `conversation_members`: conversation/user 조합 unique, 참여 시각, 마지막 읽은 메시지 또는 시각, 나간 시각
- `messages`: conversation, sender, 본문, 선택적 공유 game/play_run/post, 생성 시각, 수정/삭제 시각
- `notifications`: 대상 사용자, actor, 종류, entity 정보, 읽은 시각, 생성 시각
- `blocks`: blocker/blocked 조합 unique
- `reports`: 신고자, 대상 종류/id, 사유, 상태, 생성 시각

요구사항:

- 필요한 foreign key, check constraint, unique constraint를 모두 둔다.
- 피드, 프로필, 댓글, 대화 목록, 읽지 않은 메시지 조회에 필요한 index를 명시한다.
- `updated_at` 자동 갱신 trigger를 공통 함수로 만든다.
- `auth.users` 가입 후 `profiles` 기본 행을 안전하게 생성하는 trigger를 만든다. username 충돌을 처리한다.
- 좋아요·댓글 수처럼 자주 필요한 수치는 원본 관계를 진실의 원천으로 유지하고, 필요하면 안전한 view/RPC로 집계한다.
- 게임 목록은 현재 `src/games/gameDefinitions.ts`의 id/slug와 일치하는 seed SQL로 넣는다.
- 목업 사용자와 공개 게시물은 개발 환경에서만 넣는 별도 seed로 작성한다.

### 4. Row Level Security

모든 public 테이블에 RLS를 켜고 정책을 마이그레이션에 포함한다. 프론트 검증만 믿지 않는다.

- 공개 프로필·게임·공개 게시물은 익명 읽기를 허용하되 비공개 계정/차단 관계를 고려한다.
- 사용자는 자기 profile만 수정한다.
- play run은 본인만 생성하고, 수정/삭제 정책은 최소 권한으로 제한한다.
- 좋아요, 댓글, 저장, 팔로우는 로그인 사용자 본인의 행만 생성·삭제한다.
- DM 대화와 메시지는 현재 conversation member만 읽을 수 있다.
- 메시지는 conversation member인 sender 본인만 생성할 수 있다.
- conversation member 목록 변경은 허용된 참여자 또는 보안 함수만 가능하게 한다.
- 알림은 대상 사용자만 읽고, 일반 클라이언트가 임의 알림을 만들지 못하게 한다.
- block/report는 작성자 본인과 필요한 관리자 경로 외에는 노출하지 않는다.
- Storage는 `avatars`, `post-media`, `story-media` bucket을 분리하고 파일 크기·MIME 제한과 소유자 기반 정책을 둔다.

정책을 단순히 작성하고 끝내지 말고, 익명 사용자·사용자 A·사용자 B의 시나리오로 허용/차단 테스트를 자동화한다. 특히 A가 B의 DM을 읽거나 쓰는 시도가 실패하는지 반드시 검증한다.

### 5. 프론트 데이터 계층 연결

- `@supabase/supabase-js`를 설치하고 단일 client 모듈을 만든다.
- Supabase 자동 생성 TypeScript DB 타입을 사용한다. 수동 `any` 타입을 남발하지 않는다.
- `src/social/socialData.ts`의 목업은 오프라인/데모 fallback으로 보존하되, 화면이 Supabase 구현에 직접 종속되지 않도록 repository/service 인터페이스를 만든다.
- Auth provider/context 또는 동등한 구조로 `session`, `user`, `profile`, `loading`, `signInWithGoogle`, `signInWithOtp`, `signOut`을 제공한다.
- 기존 `AuthGate`를 실제 로그인 UI로 바꾸고, 익명 탐색은 유지한다.
- 홈은 stories와 posts를 페이지네이션으로 읽고 낙관적 좋아요/저장과 실패 rollback을 구현한다.
- 프로필은 플레이 기록, 게시물, 저장 게임을 불러온다. 로그인 전 로컬 IndexedDB 기록이 있다면 로그인 직후 사용자 확인을 거쳐 서버에 한 번만 병합한다. 중복 업로드 방지 키를 둔다.
- DM은 대화 목록, 최근 메시지, unread count를 읽고 선택된 대화의 메시지를 페이지네이션한다.
- Supabase Realtime으로 현재 열린 대화의 새 메시지를 구독하며, unmount 및 대화 전환 때 반드시 unsubscribe한다.
- 메시지 전송은 임시 local id를 사용한 optimistic UI와 실패 상태/재시도를 지원한다.
- 네트워크 loading, empty, error, retry, offline 상태를 각 화면에 명확히 표시한다.
- 게임 플레이와 기존 물리엔진은 변경하지 않는다. 게임 종료 기록 저장 실패 때문에 플레이 결과 화면이 막히지 않게 백그라운드 동기화한다.

### 6. 서버 측 신뢰 경계

- 현재 웹 게임 점수는 클라이언트에서 생성되므로 절대 완전한 공식 랭킹으로 신뢰하지 않는다.
- 초기 프로토타입에서는 `verification_status = 'unverified'` 같은 상태를 두고 친구 피드/개인 기록 용도로 사용한다.
- 공식 랭킹을 추가할 때는 서버 검증 가능한 replay/event log, rate limit, 이상치 탐지 방식을 별도 설계한다.
- push 알림, 신고 처리, 콘텐츠 moderation, 관리자 작업처럼 비밀 키가 필요한 기능은 Edge Function 후보로 분리한다. MVP에 필요하지 않은 기능은 빈 껍데기 서버를 만들지 말고 문서화한다.

### 7. 테스트와 완료 조건

- 기존 게임 테스트를 모두 유지한다.
- repository와 auth gate에 단위 테스트를 추가한다.
- 로그인하지 않은 사용자의 탐색/플레이, 로그인 유도, 로그인 후 좋아요/저장/댓글을 통합 테스트한다.
- 두 사용자의 DM 격리, 메시지 수신, unread 갱신을 테스트한다.
- RLS 보안 테스트를 별도로 실행할 수 있게 npm script 또는 문서화된 명령을 제공한다.
- `npm run lint`, `npm test`, `npm run build`를 통과시킨다.
- `docs/`에 로컬 Supabase 시작, migration 적용, type 생성, seed, Auth redirect 설정, GitHub Pages 환경 변수 설정 방법을 한국어로 정리한다.
- 실제 secret이 git diff에 없는지 마지막에 검색하고 확인한다.
- 구현 후 변경 파일, DB 구조, RLS 보장 범위, 남은 운영 과제를 요약한다.
- 검증이 끝나면 현재 저장소의 기존 방식에 맞춰 커밋하고 `main`에 push하여 회사 컴퓨터에서도 pull만 하면 이어갈 수 있게 한다.

구현 과정에서 현재 UI를 불필요하게 다시 디자인하지 말고, 기존 네 탭의 프론트 경험과 게임 피드를 보존하라. 모호한 부분은 보안과 최소 권한, 익명 탐색 유지, 모바일 성능을 우선하는 합리적 가정을 하고 진행하라.

## 복사 끝

---

## 집 컴퓨터에서 미리 준비할 값

실제 값은 이 문서가 아니라 비밀번호 관리자에 보관한다.

- Supabase Project URL
- Supabase Publishable key
- Google OAuth를 켤 경우 Google Client ID/Client secret
- 실제 GitHub Pages URL
- 로컬 redirect URL

브라우저용 `.env.local`에는 Project URL과 Publishable key만 넣는다. Google Client secret, Supabase secret/service role key, DB password는 넣지 않는다.
