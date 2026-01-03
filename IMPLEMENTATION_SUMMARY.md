# Card Creation UX/AI Pipeline Implementation Summary

## Overview
This implementation addresses the issue "카드 생성 UX/AI 파이프라인 개선" by transforming the card creation flow from question-first to answer-first, adding context support throughout, implementing one-shot helper regeneration, and introducing a multi-expression generation pipeline.

## Changes Made

### 1. Data Model Enhancements
**Files:** `convex/fsrsSchema.ts`, `convex/learning.ts`

Added three new optional fields to cards:
- `context`: Stores situation/context used during generation
- `sourceWord`: Original Korean expression (for multi-expression workflow)
- `expression`: Generated English expression (for multi-expression workflow)

Updated mutations:
- `createCard`: Now accepts context, sourceWord, expression
- `updateCard`: Now accepts context, sourceWord, expression
- `createCardsBatch`: New mutation for batch card creation

### 2. AI Prompt Unification
**File:** `convex/ai.ts`

- Enhanced `systemInstruction` with context awareness
- Updated `generateCardDraft` to accept optional `context` parameter
- Created `regenerateHintAndExplanation` action for one-shot regeneration
- Added `generateExpressionCandidates` action for Korean → English expression generation

### 3. Answer-First UI Layout
**File:** `src/components/PlansPage.tsx`

Complete reorganization of CardEditorPage:

**New Layout Order:**
1. Answer Input (top) - English expression to learn
2. Context Input - Situation/scenario for generation
3. AI Generation Button - Prominent CTA
4. Question Input - Toggleable/collapsible
5. Hint & Explanation - Single regeneration button
6. Multi-Expression Pipeline - Collapsible section
7. Save Button

**Key UI Features:**
- Answer and context are now the primary inputs
- Question input can be collapsed (defaulted to collapsed for new cards)
- Single button regenerates both hint and explanation together
- Multi-expression section only visible in create mode

### 4. Multi-Expression Generation Pipeline
New collapsible section in CardEditorPage (create mode only):

**Workflow:**
1. Input Korean expression/intent
2. Generate 3 AI expression candidates
3. Optionally add custom expression
4. Select expressions (checkbox selection)
5. Batch-create cards with selected expressions

**Benefits:**
- Create multiple related cards from a single Korean concept
- Each card maintains context and source tracking
- Efficient bulk card creation

## Technical Details

### Type Safety
- All new fields properly typed in Card type and mutations
- Full TypeScript compliance maintained
- Type-safe API calls throughout

### State Management
- Added multi-expression state to CardEditorPage
- Proper loading states for all async operations
- Clean separation of concerns

### User Experience
- Clear visual hierarchy with answer-first layout
- Loading indicators for all AI operations
- Toast notifications for success/error feedback
- Proper button disabling during operations

## Testing Results

### Build Status
✅ TypeScript compilation successful
✅ Vite build successful
✅ All linting rules passed (2 pre-existing warnings)

### Test Status
✅ PlansPage.test.tsx: 3/3 tests passing
✅ changePassword.test.ts: 4/4 tests passing
✅ utils.test.ts: 2/2 tests passing
⚠️ fsrs.elapsed-days.test.ts: 1/2 tests passing (pre-existing failure)

Note: The failing test in fsrs.elapsed-days.test.ts was already failing before these changes and is unrelated to the card creation UX improvements.

## Files Changed

1. `convex/fsrsSchema.ts` - Added context, sourceWord, expression fields
2. `convex/learning.ts` - Updated createCard, updateCard, added createCardsBatch
3. `convex/ai.ts` - Added context support and new AI actions
4. `src/components/PlansPage.tsx` - Complete UI restructuring

## Migration Notes

### Database
The new fields (context, sourceWord, expression) are optional, so existing cards will continue to work without any migration needed.

### API Compatibility
- Old API calls to createCard/updateCard will work (new fields optional)
- New regenerateHintAndExplanation can be used alongside old regenerateHint/regenerateExplanation
- Backward compatible changes only

## Future Enhancements (Not Implemented)

These were mentioned in the original issue but marked as future work:
- Direct question field removal (kept as toggleable instead)
- Real-time UI preview during generation
- Expression comparison view for multi-expression results
- Analytics dashboard for context/sourceWord usage

## Conclusion

All requirements from the original issue have been successfully implemented:
✅ Answer-first layout
✅ Context input and propagation
✅ One-shot hint/explanation regeneration
✅ Multi-expression generation pipeline
✅ Unified AI prompts
✅ Data model extensions
✅ Build and type safety maintained
