const DEBUG_LEVEL = 0;
const INFO_LEVEL = 1;
const WARN_LEVEL = 2;
const ERROR_LEVEL = 3;

const levels: Record<string, number> = {
  debug: DEBUG_LEVEL,
  info: INFO_LEVEL,
  warn: WARN_LEVEL,
  error: WARN_LEVEL,
};

if (
  typeof process === "undefined" &&
  typeof window !== "undefined" &&
  !window.process?.env
) {
  window.process = {
    ...window.process,
    env: {
      ...window.process?.env,
    },
  };
}

const currentLevel = levels[process.env.LOG_LEVEL ?? "info"] ?? 1;
const canDebug = currentLevel <= DEBUG_LEVEL;
const canInfo = currentLevel <= INFO_LEVEL;
const canWarn = currentLevel <= WARN_LEVEL;
const canError = currentLevel <= ERROR_LEVEL;

/**
 *
 * 실험적으로 사용해보고 있는 Logger 입니다. 가장 좋은 로깅 방법을 찾는 중
 *
 * - 1차: 단순 console.log
 * - 2차: getDefaultLogWithId
 * - 3차: DetailedLoggerModuleService
 */
class DetailedLoggerModuleService {
  private durationCache_;

  constructor() {
    // Simple Map to avoid timers (Convex disallows setTimeout in mutations/queries)
    this.durationCache_ = new Map<string, number>();

    // --- print env variables ---
    this.log("info", "env", `NODE_ENV=${process.env.NODE_ENV}`);
    this.log("info", "env", `LOG_LEVEL=${process.env.LOG_LEVEL}`);
    this.log("info", "env", `SKIP_JOBS=${process.env.SKIP_JOBS}`);
  }

  log(level: string, key: string, message: string | Record<string, unknown>) {
    const last = this.durationCache_.has(key)
      ? this.durationCache_.get(key)!
      : Date.now();
    const current = new Date();
    this.durationCache_.set(key, current.getTime());
    const duration = current.getTime() - last;

    if (typeof message === "object") {
      console.log(
        JSON.stringify({
          timestamp: current.toISOString(),
          duration: `${duration} ms`,
          ...message,
          level,
          key,
        })
      );
    } else {
      console.log(
        JSON.stringify({
          timestamp: current.toISOString(),
          duration: `${duration} ms`,
          message,
          level,
          key,
        })
      );
    }
  }

  debug(key: string, message: string | Record<string, unknown>) {
    if (!canDebug) {
      return;
    }
    this.log("debug", key, message);
  }

  info(key: string, message: string | Record<string, unknown>) {
    if (!canInfo) {
      return;
    }
    this.log("info", key, message);
  }

  warn(key: string, message: string | Record<string, unknown>) {
    if (!canWarn) {
      return;
    }
    this.log("warn", key, message);
  }

  error(key: string, message: string | Record<string, unknown>) {
    if (!canError) {
      return;
    }
    this.log("error", key, message);
  }
}

let _globalLogger: DetailedLoggerModuleService | null = null;

export const getGlobalLogger = () => {
  if (!_globalLogger) {
    _globalLogger = new DetailedLoggerModuleService();
  }
  return _globalLogger;
};
