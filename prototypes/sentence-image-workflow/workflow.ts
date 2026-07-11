export type Candidate = {
  style: string;
  level: string;
  sentence: string;
};

export type FeedbackPoint = {
  excerpt: string;
  explanation: string;
};

export type Evaluation = {
  summary: string;
  points: FeedbackPoint[];
  candidates: Candidate[];
};

export type WorkflowState =
  | { step: "writing" }
  | { step: "evaluating"; original: string }
  | { step: "choosing"; original: string; evaluation: Evaluation }
  | {
      step: "generating-image";
      original: string;
      evaluation: Evaluation;
      chosen: Candidate;
    }
  | {
      step: "image-ready";
      original: string;
      evaluation: Evaluation;
      chosen: Candidate;
      imagePath: string;
      itemPath: string;
    }
  | {
      step: "recalling";
      original: string;
      evaluation: Evaluation;
      chosen: Candidate;
      imagePath: string;
      itemPath: string;
    }
  | {
      step: "revealed";
      original: string;
      evaluation: Evaluation;
      chosen: Candidate;
      imagePath: string;
      itemPath: string;
      recall: string;
    };

export type WorkflowAction =
  | { type: "submit-sentence"; sentence: string }
  | { type: "receive-evaluation"; evaluation: Evaluation }
  | { type: "choose"; index: number }
  | { type: "receive-image"; imagePath: string; itemPath: string }
  | { type: "start-quiz" }
  | { type: "submit-recall"; recall: string }
  | { type: "restart" };

export const initialState: WorkflowState = { step: "writing" };

export function transition(
  state: WorkflowState,
  action: WorkflowAction
): WorkflowState {
  if (action.type === "restart") {
    return initialState;
  }

  switch (state.step) {
    case "writing":
      if (action.type === "submit-sentence" && action.sentence.trim()) {
        return { step: "evaluating", original: action.sentence.trim() };
      }
      break;

    case "evaluating":
      if (action.type === "receive-evaluation") {
        return {
          step: "choosing",
          original: state.original,
          evaluation: action.evaluation,
        };
      }
      break;

    case "choosing":
      if (action.type === "choose") {
        const chosen = state.evaluation.candidates[action.index];
        if (!chosen) {
          throw new Error("That sentence option does not exist.");
        }
        return { ...state, step: "generating-image", chosen };
      }
      break;

    case "generating-image":
      if (action.type === "receive-image") {
        return {
          ...state,
          step: "image-ready",
          imagePath: action.imagePath,
          itemPath: action.itemPath,
        };
      }
      break;

    case "image-ready":
      if (action.type === "start-quiz") {
        return { ...state, step: "recalling" };
      }
      break;

    case "recalling":
      if (action.type === "submit-recall" && action.recall.trim()) {
        return { ...state, step: "revealed", recall: action.recall.trim() };
      }
      break;

    case "revealed":
      break;
  }

  throw new Error(`Action ${action.type} is invalid during ${state.step}.`);
}
