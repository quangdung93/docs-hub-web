import { z } from 'zod';

/**
 * Wire contract cho phần phân tích edge case tài liệu URD.
 *
 * Lên Swagger 16/09/2026, thay cho phần mô phỏng trước đây trong
 * `completeness.service`. Kiểm chứng trực tiếp trên api.docshub.io.vn cùng ngày.
 *
 * Backend tách làm hai tầng: `analysis` là một lần chạy phân tích (có trạng
 * thái, có đếm tổng/đã giải quyết), còn `cases` là từng edge case AI tìm ra.
 */

/** Trạng thái một lần phân tích. Backend trả chuỗi tự do nên giữ nguyên `string`. */
export const AnalysisDtoSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  revision_id: z.string().nullish(),
  created_by: z.string().nullish(),
  /** `pending` | `running` | `ready` | `failed` — quan sát được, không có enum trong Swagger. */
  status: z.string(),
  total_cases: z.number().int().nullish(),
  resolved_cases: z.number().int().nullish(),
  error_code: z.string().nullish(),
  error_detail: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});

/**
 * Một edge case.
 *
 * Không có trường `category` hay `title` như bản mô phỏng từng dựng: backend chỉ
 * trả `description`. UI đánh số theo `sequence_no` thay cho nhãn nhóm.
 */
export const EdgeCaseDtoSchema = z.object({
  id: z.string(),
  analysis_id: z.string().nullish(),
  sequence_no: z.number().int().nullish(),
  description: z.string().nullish(),
  resolution: z.string().nullish(),
  resolved: z.boolean().nullish(),
  /** Khóa object trong storage, có sau khi upload ảnh minh hoạ. */
  image_object_key: z.string().nullish(),
});

export const AnalysisResponseDtoSchema = z.object({
  analysis: AnalysisDtoSchema,
  cases: z.array(EdgeCaseDtoSchema).nullish(),
});

export const SubmitResolutionsResponseDtoSchema = z.object({
  analysis: AnalysisDtoSchema,
  /** Đủ số case đã giải quyết thì backend sinh luôn một revision URD mới. */
  new_revision_created: z.boolean().nullish(),
});

/** Một dòng trong `GET /documents/urd-summary` — đủ để vẽ cột "Hoàn thiện". */
export const UrdSummaryItemDtoSchema = z.object({
  document_id: z.string(),
  analysis_id: z.string().nullish(),
  status: z.string().nullish(),
  total_cases: z.number().int().nullish(),
  resolved_cases: z.number().int().nullish(),
});

export const UrdSummaryListDtoSchema = z.array(UrdSummaryItemDtoSchema);

/** Ảnh minh hoạ vừa upload; backend chỉ trả về khóa object. */
export const CaseImageResponseDtoSchema = z.object({
  image_object_key: z.string().nullish(),
});

export type AnalysisDto = z.infer<typeof AnalysisDtoSchema>;
export type EdgeCaseDto = z.infer<typeof EdgeCaseDtoSchema>;
export type AnalysisResponseDto = z.infer<typeof AnalysisResponseDtoSchema>;
export type UrdSummaryItemDto = z.infer<typeof UrdSummaryItemDtoSchema>;
