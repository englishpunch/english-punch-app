import { defineTable } from "convex/server";
import { v } from "convex/values";
import { Rating, State } from "ts-fsrs";

/**
 * FSRS (Free Spaced Repetition Scheduler) 알고리즘을 지원하는
 * 영어 학습 앱을 위한 스키마 정의
 * ts-fsrs API 호환
 */
export const learningTables = {
  /**
   * 사용자 프로필 확장 - FSRS 파라미터 및 학습 설정
   * (기존 users 테이블과 통합됨)
   */
  userSettings: defineTable({
    userId: v.id("users"),

    // FSRS 알고리즘 파라미터 (ts-fsrs FSRSParameters 인터페이스 맞춤)
    fsrsParameters: v.object({
      // 기본 FSRS 파라미터
      w: v.array(v.number()), // 가중치 배열
      request_retention: v.number(), // 목표 기억률 (기본: 0.9)
      maximum_interval: v.number(), // 최대 복습 간격 (일)
      enable_fuzz: v.boolean(), // 복습 간격 퍼징 활성화

      // Short-term 학습 설정
      enable_short_term: v.boolean(), // 단기 학습 단계 활성화
      learning_steps: v.array(v.string()), // 학습 단계 (e.g., ["1m", "10m"])
      relearning_steps: v.array(v.string()), // 재학습 단계
    }),

    // 학습 설정
    dailyNewCards: v.number(), // 일일 새 카드 수
    dailyReviewCards: v.number(), // 일일 복습 카드 수
    timezone: v.string(), // 사용자 시간대

    // 통계
    totalReviews: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastReviewDate: v.optional(v.string()), // ISO 날짜 문자열
  }).index("by_user", ["userId"]),

  /**
   * 학습 샌드백 (카드 그룹)
   */
  bags: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),

    // 샌드백 설정
    isActive: v.boolean(),
    sortOrder: v.number(),

    // 통계
    totalCards: v.number(),
    newCards: v.number(),
    learningCards: v.number(),
    reviewCards: v.number(),

    // 메타데이터
    tags: v.array(v.string()),
    lastModified: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_active", ["userId", "isActive"]),

  /**
   * 학습 카드 (ts-fsrs Card 인터페이스 완전 호환)
   */
  cards: defineTable({
    userId: v.id("users"),
    bagId: v.id("bags"),

    // 카드 콘텐츠 (빈칸 채우기 형식)
    question: v.string(), // "I'd like to ___ a table for two at 7 pm."
    answer: v.string(), // "reserve"
    hint: v.optional(v.string()), // "book in advance"
    explanation: v.optional(v.string()), // 추가 설명

    // FSRS 스케줄링 데이터 (ts-fsrs Card 인터페이스 완전 매칭)
    due: v.number(), // 다음 복습 예정일 (timestamp, Date로 변환 가능)
    stability: v.number(), // 기억 안정성
    difficulty: v.number(), // 카드 난이도
    elapsed_days: v.optional(v.number()), // 마지막 복습 간 경과 일수
    scheduled_days: v.number(), // 예정된 간격
    learning_steps: v.number(), // 현재 학습 단계
    reps: v.number(), // 총 복습 횟수
    lapses: v.number(), // 실패 횟수

    // FSRS 상태 (ts-fsrs State enum: 0=New, 1=Learning, 2=Review, 3=Relearning)
    state: v.union(
      v.literal(0), // New
      v.literal(1), // Learning
      v.literal(2), // Review
      v.literal(3) // Relearning
    ),

    // 마지막 복습 정보
    last_review: v.optional(v.number()), // 마지막 복습일 (timestamp)

    // 메타데이터
    tags: v.array(v.string()),
    source: v.optional(v.string()), // 카드 출처
    suspended: v.boolean(), // 일시 중지 여부
  })
    .index("by_user", ["userId"])
    .index("by_bag", ["bagId"])
    .index("by_due", ["due"]) // 전체 due 날짜 순 정렬
    .index("by_user_and_due", ["userId", "due"]) // 사용자별 due 날짜 순
    .index("by_bag_and_due", ["bagId", "due"]) // 샌드백별 due 날짜 순
    .index("by_user_and_state", ["userId", "state"])
    .index("by_bag_and_state", ["bagId", "state"])
    .index("by_user_and_learning_steps", ["userId", "learning_steps"])
    .index("by_due_and_suspended", ["due", "suspended"]), // due 날짜 + 정지 상태

  /**
   * 복습 로그 (ts-fsrs ReviewLog 인터페이스 완전 호환)
   */
  reviewLogs: defineTable({
    userId: v.id("users"),
    cardId: v.id("cards"),

    // 복습 정보 (ts-fsrs Rating enum: 0=Manual, 1=Again, 2=Hard, 3=Good, 4=Easy)
    rating: v.union(
      v.literal(Rating.Manual), // Manual (사용되지 않음, Grade에서 제외)
      v.literal(Rating.Again), // Again
      v.literal(Rating.Hard), // Hard
      v.literal(Rating.Good), // Good
      v.literal(Rating.Easy) // Easy
    ),

    // ts-fsrs ReviewLog 인터페이스 매칭
    state: v.union(
      v.literal(State.New), // New
      v.literal(State.Learning), // Learning
      v.literal(State.Review), // Review
      v.literal(State.Relearning) // Relearning
    ),
    due: v.number(), // 예정되었던 복습일 (timestamp)
    stability: v.number(), // 복습 전 안정성
    difficulty: v.number(), // 복습 전 난이도
    scheduled_days: v.number(), // 예정되었던 간격
    learning_steps: v.number(), // 학습 단계
    review: v.number(), // 복습 시간 (timestamp)
    elapsed_days: v.optional(v.number()), // 이번 복습에서 경과 일수
    last_elapsed_days: v.optional(v.number()), // 이전 복습 간격

    // 학습 시간 및 세션 정보 (추가 필드)
    duration: v.number(), // 응답 시간 (밀리초)
    sessionId: v.optional(v.string()), // 학습 세션 ID
    reviewType: v.union(
      v.literal("manual"), // 수동 복습
      v.literal("scheduled"), // 예정된 복습
      v.literal("cramming") // 벼락치기
    ),
  })
    .index("by_card", ["cardId"])
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "review"])
    .index("by_session", ["sessionId"])
    .index("by_rating", ["rating"]),

  /**
   * 학습 세션
   */
  sessions: defineTable({
    userId: v.id("users"),

    // 세션 정보
    startTime: v.string(), // 시작 시간
    endTime: v.optional(v.string()), // 종료 시간

    // 세션 통계
    cardsReviewed: v.number(),
    cardsNew: v.number(),
    cardsLearning: v.number(),
    cardsRelearning: v.number(),

    // 정답률 (Rating 기준)
    manualCount: v.number(), // Manual (0)
    againCount: v.number(), // Again (1)
    hardCount: v.number(), // Hard (2)
    goodCount: v.number(), // Good (3)
    easyCount: v.number(), // Easy (4)

    // 평균 데이터
    averageDuration: v.number(), // 평균 응답 시간
    averageDifficulty: v.number(), // 평균 난이도

    // 세션 타입
    sessionType: v.union(
      v.literal("daily"), // 일일 학습
      v.literal("custom"), // 커스텀 학습
      v.literal("cramming") // 벼락치기
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "startTime"]),

  /**
   * 사용자 통계 (집계 데이터)
   */
  dailyStats: defineTable({
    userId: v.id("users"),
    date: v.string(), // 날짜 (YYYY-MM-DD)

    // 일일 통계
    cardsReviewed: v.number(),
    cardsNew: v.number(),
    cardsLearning: v.number(),
    cardsRelearning: v.number(),

    // 시간 통계
    totalStudyTime: v.number(), // 총 학습 시간 (밀리초)
    averageAnswerTime: v.number(), // 평균 응답 시간

    // 성과 지표
    retention: v.number(), // 기억률
    correctAnswers: v.number(),
    totalAnswers: v.number(),

    // Rating 분포 (ts-fsrs Rating enum 맞춤)
    manualCount: v.number(), // Manual (0)
    againCount: v.number(), // Again (1)
    hardCount: v.number(), // Hard (2)
    goodCount: v.number(), // Good (3)
    easyCount: v.number(), // Easy (4)
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"]),

  /**
   * 카드 템플릿 (미리 만들어진 카드들)
   */
  cardTemplates: defineTable({
    // 템플릿 정보
    category: v.string(), // "일상회화", "비즈니스", "여행" 등
    level: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),

    // 카드 콘텐츠
    question: v.string(),
    answer: v.string(),
    hint: v.optional(v.string()),
    explanation: v.optional(v.string()),

    // 메타데이터
    tags: v.array(v.string()),
    source: v.optional(v.string()),
    popularity: v.number(), // 인기도
    difficulty: v.number(), // 평균 난이도
  })
    .index("by_category", ["category"])
    .index("by_level", ["level"])
    .index("by_category_and_level", ["category", "level"]),
};
