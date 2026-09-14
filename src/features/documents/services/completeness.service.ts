import { type Document } from '../schemas/document.schema';

/**
 * Độ hoàn thiện của tài liệu URD, đo bằng số edge case đã có hướng giải quyết.
 *
 * **Toàn bộ phần phân tích ở đây là dữ liệu giả.** Backend chưa có endpoint nào
 * cho việc này (rà Swagger 14/09/2026: không có path nào chứa `edge-case`,
 * `completeness` hay `analysis`). Module này dựng sẵn hình dạng dữ liệu và luồng
 * trạng thái để UI làm được ngay, và để khi API thật xuất hiện thì chỉ phải thay
 * `analyzeDocument` bằng một lời gọi mạng — mọi thứ khác giữ nguyên.
 *
 * Mọi thứ giả lập đều gom vào một chỗ, không rải rác trong component, nên lúc
 * gỡ ra không phải đi tìm.
 */

/** Một edge case AI tìm ra, kèm phần người dùng nhập vào. */
export interface EdgeCase {
  id: string;
  /** Nhóm vấn đề — hiển thị như nhãn phụ phía trên tiêu đề. */
  category: string;
  title: string;
  /** Hướng xử lý do người dùng nhập. Rỗng nghĩa là case chưa được giải quyết. */
  resolution: string;
  /** Tên ảnh minh hoạ đính kèm, null khi chưa có. */
  imageName: string | null;
}

/** Kết quả phân tích của một tài liệu. */
export interface CompletenessResult {
  cases: EdgeCase[];
  analyzedAt: string;
}

/**
 * Trạng thái cột "Hoàn thiện" của một tài liệu:
 *  - `not-applicable` — không phải URD, không theo dõi.
 *  - `pending` — là URD nhưng chưa phân tích lần nào.
 *  - `analyzing` — đang chạy phân tích.
 *  - `analyzed` — đã có kết quả.
 */
export type CompletenessState =
  | { kind: 'not-applicable' }
  | { kind: 'pending' }
  | { kind: 'analyzing' }
  | { kind: 'analyzed'; result: CompletenessResult };

/**
 * Đoán tài liệu có phải URD không, dựa trên tên file.
 *
 * Đây là heuristic chứ không phải nhận diện nội dung: backend chưa phân loại tài
 * liệu, nên thứ duy nhất client có là cái tên. Bắt cả `URD` lẫn `User Requirement`
 * vì cả hai cách đặt tên đều đang tồn tại trong dữ liệu thật.
 *
 * Không dùng `\b` quanh `urd`: `_` là word character, nên `\burd\b` trượt
 * `URD_QuyTrinhKYC.docx` — đúng kiểu đặt tên phổ biến nhất. Thay bằng lớp ký tự
 * ngăn cách tự liệt kê, để `Absurdity` vẫn không bị nhận nhầm.
 */
const URD_PATTERN = /(^|[\s_\-.[(])urd([\s_\-.)\]]|$)|user[\s_-]*requirement/i;

export function isUrdDocument(document: Pick<Document, 'name' | 'fileName'>): boolean {
  return URD_PATTERN.test(`${document.name} ${document.fileName ?? ''}`);
}

/**
 * Phần trăm hoàn thiện = tỉ lệ edge case đã có hướng giải quyết.
 *
 * Không có case nào thì coi là 100%: tài liệu đã phân tích mà AI không tìm ra
 * thiếu sót nào thì là hoàn thiện, không phải 0%.
 */
export function completenessPercent(cases: readonly EdgeCase[]): number {
  if (cases.length === 0) return 100;
  const resolved = cases.filter((item) => item.resolution.trim().length > 0).length;
  return Math.round((resolved / cases.length) * 100);
}

/** Số case đã giải quyết — hiển thị dạng "2/4 case". */
export function resolvedCount(cases: readonly EdgeCase[]): number {
  return cases.filter((item) => item.resolution.trim().length > 0).length;
}

/** Ngưỡng màu cho thanh tiến độ, dùng chung để bảng và modal không lệch nhau. */
export function completenessTone(percent: number): 'indexed' | 'queued' | 'failed' {
  if (percent >= 80) return 'indexed';
  if (percent >= 50) return 'queued';
  return 'failed';
}

/**
 * Ngân hàng edge case giả lập.
 *
 * Viết theo đúng giọng một bản URD nghiệp vụ thật để demo có sức thuyết phục,
 * nhưng đây vẫn là dữ liệu cứng — không đọc nội dung tài liệu.
 */
const EDGE_CASE_BANK: ReadonlyArray<Pick<EdgeCase, 'category' | 'title'>> = [
  {
    category: 'Xác thực',
    title:
      'Khách hàng nhập sai OTP quá 5 lần rồi đổi sang số điện thoại hoặc thiết bị khác để thử lại',
  },
  {
    category: 'Xử lý lỗi',
    title: 'Mất kết nối mạng giữa lúc đang đối chiếu khuôn mặt (liveness check)',
  },
  {
    category: 'Điều kiện hợp lệ',
    title: 'Khách hàng dưới 18 tuổi thực hiện đăng ký định danh',
  },
  {
    category: 'Dữ liệu đầu vào',
    title: 'Giấy tờ tuỳ thân hết hạn trong lúc hồ sơ đang chờ duyệt',
  },
  {
    category: 'Đồng thời',
    title: 'Hai nhân viên cùng mở một hồ sơ và bấm duyệt trong cùng một thời điểm',
  },
];

/**
 * Chạy "phân tích" một tài liệu.
 *
 * Trả về sau một khoảng trễ giả để UI có gì đó mà hiển thị trạng thái đang chạy —
 * nếu trả về ngay thì animation nháy một cái rồi biến mất, không kiểm chứng được.
 * Số case lấy theo độ dài tên tài liệu, nên cùng một tài liệu luôn ra cùng kết
 * quả: một danh sách đổi số lượng mỗi lần bấm sẽ lộ ngay là giả.
 */
export async function analyzeDocument(
  document: Pick<Document, 'id' | 'name' | 'fileName'>,
  options: { delayMs?: number } = {}
): Promise<CompletenessResult> {
  const { delayMs = 2200 } = options;
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const count = 3 + (document.name.length % 3);
  return {
    cases: EDGE_CASE_BANK.slice(0, count).map((item, index) => ({
      id: `${document.id}:case-${index}`,
      category: item.category,
      title: item.title,
      resolution: '',
      imageName: null,
    })),
    analyzedAt: new Date().toISOString(),
  };
}
