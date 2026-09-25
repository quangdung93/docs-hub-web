import { type AnalysisDto, type AnalysisResponseDto, type UrdSummaryItemDto } from '../api/urd.dto';

/**
 * Độ hoàn thiện của tài liệu URD, đo bằng số edge case đã có hướng giải quyết.
 *
 * Trước 16/09/2026 toàn bộ phần phân tích ở đây là dữ liệu giả vì backend chưa
 * có endpoint. Nay đã có thật (`urd/analyze`, `urd/analyses/...`,
 * `documents/urd-summary`), nên module này chỉ còn giữ hai việc: ánh xạ DTO sang
 * model miền, và các hàm tính thuần túy dùng chung cho bảng lẫn modal.
 */

/** Một edge case AI tìm ra, kèm phần người dùng nhập vào. */
export interface EdgeCase {
  id: string;
  /** Nội dung edge case do AI sinh. Backend chỉ trả một đoạn mô tả, không có tiêu đề riêng. */
  description: string;
  /** Thứ tự hiển thị do backend quy định. */
  sequenceNo: number;
  /** Hướng xử lý do người dùng nhập. Rỗng nghĩa là case chưa được giải quyết. */
  resolution: string;
  /** Khóa ảnh minh hoạ trong storage, null khi chưa có. */
  imageObjectKey: string | null;
}

/** Một lần chạy phân tích. */
export interface Analysis {
  id: string;
  documentId: string;
  status: string;
  totalCases: number;
  resolvedCases: number;
  /** Lý do hỏng, chỉ có khi `status` là `failed`. */
  errorDetail: string | null;
  createdAt: string | null;
}

/** Kết quả phân tích đầy đủ: thông tin lần chạy + danh sách case. */
export interface UrdAnalysis {
  analysis: Analysis;
  cases: EdgeCase[];
}

/** Một dòng tóm tắt dùng cho cột "Hoàn thiện" trong bảng. */
export interface UrdSummary {
  documentId: string;
  analysisId: string | null;
  status: string | null;
  totalCases: number;
  resolvedCases: number;
}

export function toAnalysisInfo(dto: AnalysisDto): Analysis {
  return {
    id: dto.id,
    documentId: dto.document_id,
    status: dto.status,
    totalCases: dto.total_cases ?? 0,
    resolvedCases: dto.resolved_cases ?? 0,
    errorDetail: dto.error_detail ?? null,
    createdAt: dto.created_at ?? null,
  };
}

export function toAnalysis(dto: AnalysisResponseDto): UrdAnalysis {
  return {
    analysis: toAnalysisInfo(dto.analysis),
    cases: (dto.cases ?? []).map((item, index) => ({
      id: item.id,
      description: item.description ?? '',
      sequenceNo: item.sequence_no ?? index + 1,
      resolution: item.resolution ?? '',
      imageObjectKey: item.image_object_key ?? null,
    })),
  };
}

export function toUrdSummary(dto: UrdSummaryItemDto): UrdSummary {
  return {
    documentId: dto.document_id,
    analysisId: dto.analysis_id ?? null,
    status: dto.status ?? null,
    totalCases: dto.total_cases ?? 0,
    resolvedCases: dto.resolved_cases ?? 0,
  };
}

/**
 * Phần trăm hoàn thiện = tỉ lệ edge case đã có hướng giải quyết.
 *
 * Không có case nào thì coi là 100%: tài liệu đã phân tích mà AI không tìm ra
 * thiếu sót nào thì là hoàn thiện, không phải 0%.
 */
export function completenessPercent(total: number, resolved: number): number {
  if (total <= 0) return 100;
  return Math.round((resolved / total) * 100);
}

/** Số case đã có hướng giải quyết trong danh sách đang sửa dở trên modal. */
export function resolvedCount(cases: readonly EdgeCase[]): number {
  return cases.filter((item) => item.resolution.trim().length > 0).length;
}

/**
 * Ô "Hoàn thiện" nên hiện gì cho một dòng tài liệu.
 *
 *  - `empty`    — để trống: chưa xác nhận là URD, hoặc chưa lập chỉ mục xong
 *                 (chưa có nguồn canonical, `urd/analyze` chắc chắn hỏng).
 *  - `analyze`  — mời phân tích lần đầu.
 *  - `progress` — đã có kết quả, hiện thanh tiến độ.
 *
 * Đã có kết quả thì luôn hiện, kể cả khi revision mới đang xử lý: số liệu biến
 * mất giữa chừng khó hiểu hơn là giữ lại bản cũ.
 */
export function completenessDisplay(
  status: string,
  summary: UrdSummary | null,
  docType: string | null
): 'empty' | 'analyze' | 'progress' {
  if (summary) return 'progress';
  // Chỉ tài liệu đã được xác nhận là URD mới mời phân tích. README hay file cấu
  // hình không có edge case nghiệp vụ nào để tìm.
  return status === 'indexed' && docType === 'urd' ? 'analyze' : 'empty';
}

/** Ngưỡng màu cho thanh tiến độ, dùng chung để bảng và modal không lệch nhau. */
export function completenessTone(percent: number): 'indexed' | 'queued' | 'failed' {
  if (percent >= 80) return 'indexed';
  if (percent >= 50) return 'queued';
  return 'failed';
}
