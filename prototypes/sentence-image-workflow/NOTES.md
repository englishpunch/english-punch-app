# Prototype verdict

Observed result from the PoC runs:

- Choosing among complete sentences feels better than choosing a target
  expression. The useful unit is the whole sentence, especially when each
  option has a clear style label and CEFR level.
- Sentence feedback needs a strict prompt. Good output included phrase-level
  diagnosis, no weak collocations like "by chip," and no invented facts such as
  repeated failures.
- The image cue works when the chosen sentence is concrete. For "I got a
  replacement card because the chip wasn't working," the cue clearly showed a
  failed card chip and a replacement card.
- Image prompting must explicitly ban readable symbols, not only text. The
  first useful image still used X marks; the stricter prompt produced a better
  text-free illustration with visual storytelling instead.
- Exact recall works technically, but it is strict. A real English Punch
  feature would probably need fuzzy comparison, typo tolerance, and a reveal
  flow that highlights the missing or changed words.
- Saving each chosen item as `.poc-data/items/<id>.json` plus `<id>.png` is the
  right next PoC shape. The durable item only needs `chosen` and `imagePath`;
  the original sentence and evaluation are useful during selection, but not
  necessary for later recall.
