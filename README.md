# English Punch 🥊

영어 학습을 위한 간격 반복 학습(Spaced Repetition) 앱

## 개요

English Punch는 [FSRS (Free Spaced Repetition Scheduler)](https://github.com/open-spaced-repetition/ts-fsrs) 알고리즘을 기반으로 한 영어 학습 애플리케이션입니다. 매일 복싱 도장에 가듯이 꾸준히 영어를 학습하자는 의미에서 "Punch"라는 이름을 붙였습니다.

## 주요 특징

### FSRS 알고리즘
- **지능형 복습 스케줄링**: 개인의 학습 패턴을 분석하여 최적의 복습 시점을 자동으로 계산
- **효율적인 학습**: 기존 SM-2 알고리즘 대비 20-30% 복습 횟수 감소
- **적응형 학습**: 각 학습자의 기억 패턴에 맞춰 난이도와 간격을 자동 조정
- **과학적 접근**: Three Component Model of Memory (검색가능성, 안정성, 난이도) 기반

### 카드 형식
빈칸 채우기 형식의 실용적인 영어 문장 학습:
```
문제: I'd like to ___ a table for two at 7 pm. (book in advance)
정답: reserve
```

## 기술 스택

### Frontend
- **React**: 사용자 인터페이스 구성
- **Tauri**: 데스크톱 애플리케이션 프레임워크 (가볍고 빠른 네이티브 앱)

### Backend
- **Supabase**: 백엔드 서비스 (데이터베이스, 인증, 실시간 동기화)

### 핵심 라이브러리
- **[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)**: TypeScript로 구현된 FSRS 알고리즘

## 프로젝트 목표

- 매일 꾸준한 영어 학습 습관 형성
- 실용적인 영어 표현 학습
- 과학적인 간격 반복 학습을 통한 장기 기억 강화
- 개인화된 학습 경험 제공

## 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/yourusername/english-punch-app.git
cd english-punch-app

# 의존성 설치
npm install

# 개발 서버 실행
npm run tauri dev

# Tauri 앱 빌드
npm run tauri build
```

## 환경 설정

### 1. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에 로그인하고 새 프로젝트를 생성합니다.
2. 프로젝트 대시보드에서 `Settings > API`로 이동합니다.
3. `Project URL`과 `Project API keys`의 `anon public` 키를 복사합니다.

### 2. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com)에서 새 프로젝트를 생성하거나 기존 프로젝트를 선택합니다.
2. `APIs & Services > Credentials`로 이동합니다.
3. `Create Credentials > OAuth 2.0 Client IDs`를 선택합니다.
4. Application type을 `Web application`으로 설정합니다.
5. Authorized redirect URIs에 다음을 추가합니다:
   - `https://[your-project-ref].supabase.co/auth/v1/callback`
   - `http://localhost:1420/auth/callback` (Tauri 개발용)

### 3. Supabase Authentication 설정

1. Supabase 대시보드에서 `Authentication > Providers`로 이동합니다.
2. Google provider를 활성화합니다.
3. Google Cloud Console에서 생성한 `Client ID`와 `Client Secret`을 입력합니다.

### 4. 환경 변수 설정

`.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

## 기여하기

프로젝트에 기여하고 싶으시다면 Pull Request를 보내주세요. 모든 기여를 환영합니다!

## 라이선스

[MIT License](LICENSE)

## 참고 자료

- [FSRS 알고리즘 설명](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS)
- [ts-fsrs 라이브러리](https://github.com/open-spaced-repetition/ts-fsrs)
- [Tauri 공식 문서](https://tauri.app/)
- [Supabase 공식 문서](https://supabase.com/docs)
