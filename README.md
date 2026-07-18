# Flicko (플릭코)

Flicko(플릭코)는 Instagram Reels처럼 위아래로 넘기며 게임을 발견하고, 미리보기 화면을 탭해 즉시 플레이하는 모바일 우선 PWA입니다. 별도의 스플래시 화면 없이 첫 게임 피드를 바로 보여주며, 피드 위치와 최고 기록·좋아요·즐겨찾기를 기기에 보존합니다.

## 포함된 게임

| 게임 | 조작 | 목표 |
| --- | --- | --- |
| Hoop Flight | 탭 | 중력을 이기며 골대를 연속 통과 |
| Dunk Climb | 당긴 후 놓기 | 궤적과 벽 반사를 이용해 상승 |
| Loop Hoops | 탭 | 좌우 경계를 루프하며 번갈아 득점 |
| Crossing Rush | 상하좌우 스와이프 | 차량과 물을 피해 전진 |
| Neon Escape | 상하좌우 스와이프 | 첫 벽까지 질주해 코인 수집 |
| Perfect Stack | 탭 | 겹친 부분만 남기며 탑 쌓기 |
| Pin Core | 탭 | 회전하는 핀 사이 빈틈 공략 |
| Pocket Golf | 당긴 후 놓기 | 직접 정한 방향과 파워로 홀 공략 |

## 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

모바일 입력과 PWA 설치를 확인하려면 같은 네트워크의 휴대폰에서 Vite 개발 서버 주소로 접속하거나, 프로덕션 빌드를 HTTPS 환경에 배포하세요.

## 품질 검사

```bash
npm run lint
npm run test
npm run build
```

## 구조

- `src/feed`: scroll snap 기반 세로형 게임 피드와 수명주기 제어
- `src/games`: 게임 메타데이터, 레지스트리, Canvas 게임 컨트롤러
- `src/components`: 게임 캔버스, 플레이어, 규칙 시트, 업데이트 UI
- `src/services`: IndexedDB 저장과 Web Audio 효과음
- `src/app`: 브랜드 설정과 버전·릴리스 정보

새 게임은 `MiniGameModule` 메타데이터와 `GameController` 구현을 추가한 뒤 `gameDefinitions.ts`에 등록합니다. 피드, 설명 시트, 전체 화면 플레이어는 레지스트리를 읽어 자동으로 노출합니다.

## PWA와 업데이트

`vite-plugin-pwa`의 `prompt` 업데이트 방식을 그대로 사용합니다. 새 서비스 워커가 준비되면 사용자가 플레이를 마친 뒤 업데이트할 수 있으며 IndexedDB의 최고 점수와 개인 설정은 유지됩니다. 기존 FlickPlay 설치에서 업데이트하는 경우에도 저장 데이터를 새 `flicko-state-v1` 키로 자동 이전합니다. iPhone에서는 Safari 공유 메뉴의 **홈 화면에 추가**를 사용합니다.

## GitHub Pages

저장소 Settings → Pages에서 Source를 **GitHub Actions**로 설정하세요. `main` 브랜치에 push하면 workflow가 lint, test, build를 모두 통과한 경우에만 `dist`를 배포합니다. Vite는 상대 경로 기반으로 빌드되어 저장소 하위 경로에서도 동작합니다.

## 현재 범위

초기 버전은 외부 이미지·사운드 자산 없이 Canvas와 Web Audio로 구성되어 빠르게 로드됩니다. 진동은 기본적으로 사용하지 않으며, 사운드는 사용자 제스처 이후에만 활성화됩니다.
