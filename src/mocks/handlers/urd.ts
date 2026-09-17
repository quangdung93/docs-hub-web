import { delay, http, HttpResponse } from 'msw';

import { envelope } from '../lib/envelope';

/**
 * Phân tích edge case tài liệu URD.
 *
 * Mock này tồn tại vì API thật có điều kiện tiên quyết mà môi trường dev không
 * đáp ứng được: revision phải có nguồn canonical do pipeline ingest sinh ra.
 * Không có mock thì cả tính năng không chạy thử được ngoài production.
 *
 * Giữ đúng hai điểm bất đối xứng của backend thật, vì đây là chỗ dễ sai:
 *  - `analyze` đòi tài liệu đã xác nhận `doc_type=urd`, chưa xác nhận thì trả
 *    `URD_NOT_CONFIRMED` kèm HTTP 200 (lỗi nghiệp vụ, không phải lỗi tầng giao vận).
 *  - `resolutions` chỉ sinh revision mới khi mọi case đã có hướng giải quyết.
 */

/** Tài liệu đã được xác nhận là URD, theo documentId. */
const confirmed = new Set<string>();

interface MockCase {
  id: string;
  sequence_no: number;
  description: string;
  resolution: string;
  resolved: boolean;
  image_object_key: string | null;
}

const analyses = new Map<string, { documentId: string; cases: MockCase[] }>();

/** Viết theo giọng một bản URD nghiệp vụ thật để demo có sức thuyết phục. */
const CASE_BANK = [
  'Khách hàng nhập sai OTP quá 5 lần rồi đổi sang số điện thoại khác để thử lại — tài liệu chưa nêu cách xử lý.',
  'Mất kết nối mạng giữa lúc đang đối chiếu khuôn mặt: chưa rõ hồ sơ được lưu tạm hay huỷ hẳn.',
  'Khách hàng dưới 18 tuổi thực hiện định danh — chưa có quy định chặn hay chuyển luồng giám hộ.',
  'Giấy tờ tuỳ thân hết hạn trong lúc hồ sơ đang chờ duyệt, chưa nêu hướng xử lý.',
  'Hai nhân viên cùng mở một hồ sơ và bấm duyệt cùng lúc — tài liệu chưa nói ai thắng.',
];

export const urdHandlers = [
  http.patch('*/projects/:projectId/documents/:documentId/doc-type', async ({ params }) => {
    confirmed.add(String(params.documentId));
    return HttpResponse.json(envelope({ id: params.documentId, doc_type: 'urd', version: 2 }));
  }),

  http.get('*/projects/:projectId/documents/urd-summary', () => {
    const items = [...analyses.entries()].map(([id, value]) => ({
      document_id: value.documentId,
      analysis_id: id,
      status: 'ready',
      total_cases: value.cases.length,
      resolved_cases: value.cases.filter((c) => c.resolved).length,
    }));
    return HttpResponse.json(envelope(items));
  }),

  http.post('*/projects/:projectId/documents/:documentId/urd/analyze', async ({ params }) => {
    const documentId = String(params.documentId);

    if (!confirmed.has(documentId)) {
      // HTTP 200 kèm success:false — đúng như backend thật trả về.
      return HttpResponse.json({
        success: false,
        data: null,
        error: {
          code: 'URD_NOT_CONFIRMED',
          message: 'Tài liệu chưa được xác nhận là URD',
          retryable: false,
        },
        meta: { request_id: 'mock', trace_id: '', timestamp: new Date().toISOString() },
      });
    }

    const analysisId = `analysis-${documentId}`;

    // Đã có phân tích chưa hoàn tất: backend thật từ chối tạo lần chạy mới và
    // đưa `analysis_id` trong `details` để client mở lại. Giữ đúng hành vi đó,
    // vì đây chính là chỗ từng làm vỡ giao diện.
    const active = analyses.get(analysisId);
    if (active && active.cases.some((c) => !c.resolved)) {
      return HttpResponse.json({
        success: false,
        data: null,
        error: {
          code: 'URD_ANALYSIS_ACTIVE',
          message: 'Tài liệu đang có phân tích edge case chưa hoàn tất',
          details: { analysis_id: analysisId },
          retryable: false,
        },
        meta: { request_id: 'mock', trace_id: '', timestamp: new Date().toISOString() },
      });
    }

    // Trễ để trạng thái "đang phân tích" quan sát được bằng mắt.
    await delay(1800);

    const existing = analyses.get(analysisId);
    if (!existing) {
      analyses.set(analysisId, {
        documentId,
        cases: CASE_BANK.slice(0, 3 + (documentId.length % 3)).map((description, index) => ({
          id: `${analysisId}-case-${index}`,
          sequence_no: index + 1,
          description,
          resolution: '',
          resolved: false,
          image_object_key: null,
        })),
      });
    }

    const record = analyses.get(analysisId)!;
    return HttpResponse.json(
      envelope({
        analysis: {
          id: analysisId,
          document_id: documentId,
          status: 'ready',
          total_cases: record.cases.length,
          resolved_cases: record.cases.filter((c) => c.resolved).length,
        },
        cases: record.cases,
      }),
      { status: 201 }
    );
  }),

  http.get('*/projects/:projectId/documents/:documentId/urd/analyses/:analysisId', ({ params }) => {
    const record = analyses.get(String(params.analysisId));
    if (!record) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(
      envelope({
        analysis: {
          id: String(params.analysisId),
          document_id: record.documentId,
          status: 'ready',
          total_cases: record.cases.length,
          resolved_cases: record.cases.filter((c) => c.resolved).length,
        },
        cases: record.cases,
      })
    );
  }),

  http.post(
    '*/projects/:projectId/documents/:documentId/urd/analyses/:analysisId/cases/:caseId/image',
    ({ params }) => HttpResponse.json(envelope({ image_object_key: `mock/${params.caseId}.png` }))
  ),

  http.post(
    '*/projects/:projectId/documents/:documentId/urd/analyses/:analysisId/resolutions',
    async ({ params, request }) => {
      const record = analyses.get(String(params.analysisId));
      if (!record) return new HttpResponse(null, { status: 404 });

      const body = (await request.json().catch(() => ({}))) as {
        items?: { case_id?: string; resolution?: string; image_object_key?: string }[];
      };

      for (const item of body.items ?? []) {
        const found = record.cases.find((c) => c.id === item.case_id);
        if (!found) continue;
        found.resolution = item.resolution ?? '';
        found.resolved = (item.resolution ?? '').trim().length > 0;
        found.image_object_key = item.image_object_key ?? found.image_object_key;
      }

      const resolved = record.cases.filter((c) => c.resolved).length;
      return HttpResponse.json(
        envelope({
          analysis: {
            id: String(params.analysisId),
            document_id: record.documentId,
            status: 'ready',
            total_cases: record.cases.length,
            resolved_cases: resolved,
          },
          new_revision_created: resolved === record.cases.length,
        })
      );
    }
  ),
];
