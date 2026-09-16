import { apiSuccessSchema, endpoints } from '@/core/api';
import { http } from '@/shared/api/http';

import {
  AnalysisResponseDtoSchema,
  CaseImageResponseDtoSchema,
  SubmitResolutionsResponseDtoSchema,
  UrdSummaryListDtoSchema,
} from './urd.dto';
import {
  toAnalysis,
  toUrdSummary,
  type UrdAnalysis,
  type UrdSummary,
} from '../services/completeness.service';

/**
 * Transport cho phân tích edge case tài liệu URD.
 *
 * Hai điều kiện tiên quyết do backend đặt ra, ghi lại ở đây vì lỗi trả về không
 * tự giải thích (kiểm chứng 16/09/2026):
 *
 *  1. Tài liệu phải được xác nhận `doc_type=urd` qua `confirmDocType`, nếu không
 *     `analyze` trả `URD_NOT_CONFIRMED`.
 *  2. Revision phải có nguồn canonical sẵn sàng, nếu không trả `REQ_400
 *     "Nguồn canonical của revision chưa sẵn sàng"`. Đây là artifact do pipeline
 *     ingest sinh ra; tài liệu upload trước khi tính năng này lên đều thiếu.
 */
export const urdApi = {
  /** Độ hoàn thiện của mọi tài liệu URD trong project. */
  summary: async (projectId: string, signal?: AbortSignal): Promise<UrdSummary[]> => {
    const { data } = await http.get(endpoints.documents.urdSummary(projectId), { signal });
    return apiSuccessSchema(UrdSummaryListDtoSchema).parse(data).data.map(toUrdSummary);
  },

  /**
   * Xác nhận tài liệu là URD.
   *
   * `version` là bộ đếm optimistic-locking của tài liệu; gửi sai thì backend từ
   * chối. Mỗi lần gọi thành công làm nó tăng một bậc, nên nơi gọi phải dùng
   * `version` vừa đọc được chứ không giữ lại giá trị cũ.
   */
  confirmUrd: async (projectId: string, documentId: string, version: number): Promise<void> => {
    await http.patch(endpoints.documents.confirmDocType(projectId, documentId), {
      doc_type: 'urd',
      version,
    });
  },

  /** Nhờ AI liệt kê edge case chưa được đề cập. Trả về 201 kèm kết quả. */
  analyze: async (projectId: string, documentId: string): Promise<UrdAnalysis> => {
    const { data } = await http.post(endpoints.urd.analyze(projectId, documentId), {});
    return toAnalysis(apiSuccessSchema(AnalysisResponseDtoSchema).parse(data).data);
  },

  /** Mở lại một lần phân tích đã chạy. */
  detail: async (
    projectId: string,
    documentId: string,
    analysisId: string,
    signal?: AbortSignal
  ): Promise<UrdAnalysis> => {
    const { data } = await http.get(endpoints.urd.analysis(projectId, documentId, analysisId), {
      signal,
    });
    return toAnalysis(apiSuccessSchema(AnalysisResponseDtoSchema).parse(data).data);
  },

  /**
   * Lưu hướng giải quyết cho các edge case.
   *
   * Đủ số case đã giải quyết thì backend sinh một revision URD mới —
   * `newRevisionCreated` báo điều đó để nơi gọi làm mới danh sách tài liệu.
   */
  submitResolutions: async (
    projectId: string,
    documentId: string,
    analysisId: string,
    items: { caseId: string; resolution: string; imageObjectKey?: string | null }[]
  ): Promise<{ analysis: UrdAnalysis['analysis']; newRevisionCreated: boolean }> => {
    const { data } = await http.post(endpoints.urd.resolutions(projectId, documentId, analysisId), {
      items: items.map((item) => ({
        case_id: item.caseId,
        resolution: item.resolution,
        ...(item.imageObjectKey ? { image_object_key: item.imageObjectKey } : {}),
      })),
    });
    const parsed = apiSuccessSchema(SubmitResolutionsResponseDtoSchema).parse(data).data;
    return {
      analysis: toAnalysis({ analysis: parsed.analysis, cases: [] }).analysis,
      newRevisionCreated: parsed.new_revision_created ?? false,
    };
  },

  /** Tải ảnh minh hoạ cho một case; trả về khóa object để gửi kèm lúc lưu. */
  uploadCaseImage: async (
    projectId: string,
    documentId: string,
    analysisId: string,
    caseId: string,
    file: File
  ): Promise<string | null> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await http.post(
      endpoints.urd.caseImage(projectId, documentId, analysisId, caseId),
      form
    );
    return apiSuccessSchema(CaseImageResponseDtoSchema).parse(data).data.image_object_key ?? null;
  },
};
