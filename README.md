# English Punch 🥊

영어 학습을 위한 간격 반복 학습(Spaced Repetition) 앱

## 개요

English Punch는 [FSRS (Free Spaced Repetition Scheduler)](https://github.com/open-spaced-repetition/ts-fsrs) 알고리즘을 기반으로 한 영어 학습 애플리케이션입니다. 매일 복싱 도장에 가듯이 꾸준히 영어를 학습하자는 의미에서 "Punch"라는 이름을 붙였습니다.

## 작업들

- getGlobalLogger 로 로깅 표준화
- components.json 파일이 있긴 하지만 shadcn을 사용하진 않음

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

- **Convex**: 리액티브 백엔드 플랫폼 (실시간 데이터베이스, 서버리스 함수, WebSocket 통신)

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

### 1. Convex 프로젝트 설정

1. Convex 개발 환경을 설치합니다:

```bash
npm install convex
```

2. Convex 프로젝트를 초기화합니다:

```bash
npx convex dev
```

이 명령어를 실행하면 자동으로 Convex 계정을 생성하거나 로그인하고, 새 프로젝트를 설정합니다.

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# Convex 설정 (npx convex dev 실행 시 자동 생성됨)
VITE_CONVEX_URL=https://your-project.convex.cloud
```

## 기여하기

프로젝트에 기여하고 싶으시다면 Pull Request를 보내주세요. 모든 기여를 환영합니다!

## 라이선스

[MIT License](LICENSE)

## 참고 자료

- [FSRS 알고리즘 설명](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS)
- [ts-fsrs 라이브러리](https://github.com/open-spaced-repetition/ts-fsrs)
- [Tauri 공식 문서](https://tauri.app/)
- [Convex 공식 문서](https://docs.convex.dev/)
- [Convex Auth 가이드](https://docs.convex.dev/auth)
