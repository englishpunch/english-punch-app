---
date: 2026-06-09
author: codex
status: draft
topic: Card prompt v2 and reset-based replacement workflow
---

# Card Prompt v2 and Replacement Plan

## Goal

기존 English Punch 카드 중 문제와 힌트가 너무 길거나 산만한 카드를 더 짧고 집중도 높은 형식으로 교체한다.

핵심 방향은 다음과 같다.

- `question`은 목표 단어/표현이 가장 자연스럽게 들어가는 간단한 한 문장으로 만든다.
- 학습자가 문장을 통째로 읽고 외우기 쉬운 문장을 우선한다.
- `hint`는 긴 정의문 대신 우선순위가 높은 synonym/paraphrase 2-3개 정도만 제공한다.
- 기존 카드의 `context`는 가능하면 유지한다.
- 문제를 수정하면 기존 FSRS 값을 보존하지 않고 새 카드처럼 다시 학습하도록 초기화한다.

## Current Findings

- 웹 카드 생성 폼은 `src/components/CardForm.tsx`에서 `api.ai.generateCardDraft`를 호출해 `question`, `hint`, `explanation`, 선택적 `finalAnswer`를 생성한다.
- AI 생성 action은 `convex/ai.ts`에 있고, 현재 prompt는 긴 설명과 persona 다양성에 초점이 있다.
- 카드 수정은 현재 `api.learning.updateCard`를 사용한다.
- `updateCard`는 서버에서 `initialSchedule(now)`를 덮어써 FSRS 상태를 초기화한다.
- 다만 `initialSchedule`에 `elapsed_days`가 없어서 기존 값이 남을 수 있다.
- CLI의 `ep cards create`는 AI를 호출하지 않고, caller가 만든 `question`, `hint`, `explanation`을 그대로 저장한다.
- 현재 CLI에는 기존 카드를 조회하고 교체하는 충분한 카드 수정 표면이 없다.

## Product Decisions

- 문제 수정은 학습 상태를 보존하지 않는다.
- 카드 내용을 바꾸는 것은 새 카드에 가까운 작업으로 본다.
- 기존 `updateCard`는 deprecated 처리하고, 이름에서 reset 의미가 드러나는 새 API로 이동한다.
- 비용 절감을 위해 Codex skill이 v2 규칙으로 직접 `question`과 `hint`를 만들 수 있게 한다.
- AI API 기반 생성과 skill 기반 생성은 같은 v2 규칙을 공유한다.
- AI action은 별도 `generateCardDraftV2`를 만들지 않고 `generateCardDraft({ promptVersion: "v2" })` 방식으로 확장한다.
- `skills/english-punch/SKILL.md`는 v1/v2를 나누지 않고 기존 생성 규칙을 새 규칙으로 직접 교체한다.

## Prompt v2 Rules

### Question

- 한 문장만 생성한다.
- `___` blank는 정확히 하나만 둔다.
- 목표 단어/표현이 blank에 들어갔을 때 가장 자연스러워야 한다.
- 문장은 간단해야 한다. 길이를 엄격히 제한하지는 않지만 불필요한 종속절과 배경 설명은 피한다.
- CEFR B1-B2 수준을 기본으로 한다.
- 학습자가 문장을 통째로 읽으며 외우기 좋아야 한다.
- `context`가 있으면 상황, 톤, 사용 장면에 반영한다.
- `context`를 문장 안에서 장황하게 설명하지 않는다.
- 정답이 동사/명사/형용사 형태 변화가 필요하면 실제 학습할 형태를 answer로 쓴다.

### Hint

- 긴 정의문을 피한다.
- 가장 우선순위가 높은 synonym/paraphrase 2-3개를 제공한다.
- comma-separated 형태를 기본으로 한다.
- answer 자체를 그대로 포함하지 않는다.
- 12단어 이내를 유지한다.

### Explanation

- 초기 전환 범위에서는 기존 explanation 유지가 기본이다.
- 새 카드 생성에서는 기존 규칙을 유지하거나 v2에 맞춰 더 짧게 다듬을 수 있다.
- explanation v2는 별도 커밋에서 다룬다.

## Proposed API

새 mutation 이름 후보:

```ts
api.learning.replaceCardContentAndResetSchedule
```

이름이 길지만 다음 의미가 명확하다.

- 기존 카드의 content를 교체한다.
- FSRS schedule/state를 새 카드처럼 초기화한다.

초기화 대상:

- `due = now`
- `stability = 0`
- `difficulty = 0`
- `elapsed_days = undefined`
- `scheduled_days = 0`
- `learning_steps = 0`
- `reps = 0`
- `lapses = 0`
- `state = 0`
- `last_review = undefined`
- `suspended = false`

기존 `updateCard` 처리:

- `/** @deprecated use replaceCardContentAndResetSchedule */` 주석을 붙인다.
- 당장은 wrapper로 유지해 호환성을 보존한다.
- 웹/MCP/CLI 호출부가 새 API로 이동한 뒤 삭제 여부를 별도 판단한다.

## Commit Plan

### 1. Add v2 prompt plan document

- 이 문서를 추가한다.
- 구현 전 큰 방향과 커밋 순서를 고정한다.

### 2. Add reset-explicit Convex mutation

- `replaceCardContentAndResetSchedule` mutation을 추가한다.
- `elapsed_days`까지 확실히 초기화한다.
- `updateCard`를 deprecated wrapper로 바꾼다.
- 관련 단위 테스트가 가능하면 추가한다.

### 3. Move web and MCP callers

- `CardEditPage`가 새 mutation을 호출하게 바꾼다.
- MCP `update-card` tool도 새 mutation을 호출하게 바꾼다.
- UI/tool 설명에 FSRS reset 의미를 노출한다.

### 4. Add CLI card read/replace commands

필요한 최소 명령:

```bash
ep cards get <card-id> --bag <bag-id> --json
ep cards replace <card-id> --bag <bag-id> \
  --question "..." \
  --answer "..." \
  --hint "..." \
  --explanation "..." \
  --context "..." \
  --json
```

CLI help에는 `replace`가 FSRS schedule을 reset한다고 명시한다.

### 5. Add AI prompt v2

구현 방식:

```ts
generateCardDraft({ answer, context, promptVersion: "v2" })
```

- v1과 v2를 같이 유지한다.
- 웹 기본값 전환은 별도 커밋으로 둔다.
- v2 output 검증을 강화한다.

### 6. Replace skill generation rules

- `skills/english-punch/SKILL.md`의 기존 question/hint 생성 규칙을 새 규칙으로 교체한다.
- skill 안에서는 v1/v2를 별도로 노출하지 않는다.
- Codex가 Gemini API 없이 직접 `question`/`hint`를 만들고 `ep cards replace`로 저장하는 흐름을 문서화한다.
- 카드 저장 전후 확인 형식을 정한다.

### 7. Migrate selected existing cards

1. 후보를 조회한다.
2. 긴 question, 두 문장 이상 question, 긴 hint를 우선 선별한다.
3. 기존 `context`를 보존한다.
4. 먼저 샘플 10-20개만 v2 후보를 생성한다.
5. 사람이 검수하기 쉬운 diff를 만든다.
6. 각 후보마다 웹 편집 링크를 함께 제공한다.
7. 사용자가 확인하고 승인한 카드만 `ep cards replace`로 적용한다.

## Migration Candidate Rules

우선순위가 높은 후보:

- `question`이 두 문장 이상인 카드
- `question`이 지나치게 길어 단어에 집중하기 어려운 카드
- `hint`가 정의문처럼 길거나 여러 의미가 섞인 카드
- `hint`에 answer가 포함된 카드
- `question`의 blank가 답을 충분히 유도하지 못하는 카드
- `context`가 있는데 question이 context를 잘 반영하지 못하는 카드

## Validation

각 구현 커밋마다 가능한 범위에서 다음을 확인한다.

- `pnpm run test`
- `pnpm run lint`
- `pnpm run check`
- `cd cli && go test ./...`
- `cd cli && ~/go/bin/golangci-lint run`

카드 교체 작업 전에는 dry-run 형태로 다음을 확인한다.

- 기존 카드 id
- bag id
- 기존 question/hint/context
- 새 question/hint
- answer 변경 여부
- reset 예정 여부
- 웹 편집 링크

웹 편집 링크 형식:

```text
https://englishpunch.vercel.app/plans/{bagId}/cards/{cardId}/edit
```

로컬 개발 서버에서 확인할 때는 origin만 로컬 주소로 바꾼다.

```text
http://localhost:5173/plans/{bagId}/cards/{cardId}/edit
```

샘플 dry-run 출력은 다음 컬럼을 기본으로 한다.

```text
cardId | answer | oldQuestion | newQuestion | oldHint | newHint | context | editUrl
```

## Open Questions

- v2를 새 카드 생성의 기본 prompt로 바로 전환할지, 사용자가 선택하게 둘지 결정해야 한다.
- explanation도 v2로 짧게 바꿀지, 기존 규칙을 유지할지 결정해야 한다.
- 대량 교체 시 한 번에 몇 장까지 검수/적용할지 정해야 한다.
- `reviewLogs`와 `activities`에 content replacement 이벤트를 남길지 결정해야 한다.
