# Task 6.2 — S-01 Upload (two files + extract)

**Phase**: 6 · **Depends on**: 4.1 · **Type**: Implementation

## Goal
Build `/upload` per UI Spec S-01: `UploadForm` (single state container — metadata + both file selections, never cleared on error), `MetadataFields` (D10 controls), `FileUploadFields` (question file + answer file pickers, type/size/page hints, selected-file chips, remove; both required to enable Extract), `UploadGuide` (what a good question/answer file looks like + one example each + limits, AC-028), `ExtractBar` (primary "Extract", disabled until metadata valid + both files present; triggers `extractAndAssemble`; error states), `ExtractionProgress` (`role="status"` polite, non-blocking, AC-029). Page guard → `/?auth=signin` (AC-002). On success → `/me/exams/[id]` (S-03).

## Files
New: `SOURCE/app/(authoring)/upload/page.tsx` + `_components/{UploadForm,MetadataFields,FileUploadFields,UploadGuide,ExtractBar,ExtractionProgress}.tsx`.

## ACs / metrics
AC-002/003/004/005/006/007/028/029.

## Verification / Acceptance
Golden states 1 (ready), 2 (extracting) reproduce; a failed extract leaves all metadata + file selections intact; Extract disabled until metadata valid + both files present; file over a limit rejected before any AI call (AC-006).

## References
UI Spec §UploadForm/MetadataFields/FileUploadFields/UploadGuide/ExtractBar/ExtractionProgress; Design Doc §Data Flow.
