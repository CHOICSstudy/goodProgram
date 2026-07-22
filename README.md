# goodProgram — 인강 계정 공유 시간 관리

팀 5명이 인강 계정 점유 현황과 예약을 공유해 동시 접속 충돌을 막는 웹앱.

## 기능

- **인강 목록**: 카테고리 필터 + 제목 검색, 계정별 사용 가능(🟢)/사용 중(🔴) 표시, 당일 예약 표시
- **체크인/체크아웃**: 체크아웃 예정 시간 지정, "미정"이면 2시간 후 자동 해제
- **계정 확인하기**: 로그인 정보 표시 + 아이디/비밀번호 복사 (비밀번호 기본 마스킹)
- **시간표**: 계정별 주간 예약표 (월~일 × 09:00~24:00, 30분 슬롯), 겹침 방지
- **관리**: 계정/인강 추가·수정·삭제
- **보안**: 팀 공용 비밀번호 게이트, 5회 실패 시 1분 잠금

## 로컬 실행

1. Supabase 무료 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 실행 (샘플 데이터가 필요하면 `supabase/seed.sql`도 실행)
2. `.env.local.example`을 `.env.local`로 복사 후 값 입력:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase Settings > API
   - `TEAM_PASSWORD`: 팀이 정한 공용 비밀번호
   - `SESSION_SECRET`: `openssl rand -hex 32`
3. `lib/members.ts`의 팀원 이름 5명 수정
4. `npm install && npm run dev` → http://localhost:3000

## 테스트

    npm test

## Vercel 배포

1. GitHub에 push
2. [vercel.com](https://vercel.com)에서 저장소 Import
3. Environment Variables에 `.env.local`의 4개 변수 등록
4. Deploy → 발급된 URL을 팀에 공유
