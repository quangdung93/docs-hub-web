import type { Document } from '../../features/documents/schemas/document.schema';
import type { ProjectDto, ProjectMemberDto } from '../../features/projects/api/project.dto';
import type { ChatMessage } from '../../features/chat/schemas/chat.schema';

/**
 * In-memory mock database, seeded from the mockup's sample content. Handlers
 * mutate it so create/update/delete actually persist for the lifetime of the
 * process — the UI can be exercised end to end without a backend.
 *
 * Timestamps are computed relative to boot so the "2 hours ago" column stays
 * plausible however long the mock server has been running.
 */
const now = Date.now();
const ago = (ms: number) => new Date(now - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const projects: ProjectDto[] = [
  {
    id: 'p1',
    owner_id: 'u-viettq45',
    name: 'Core Banking',
    description: 'BRD, tài liệu nghiệp vụ và biên bản họp phân hệ lõi.',
    status: 'active',
    settings: {
      model: 'qwen2.5',
      top_k: 5,
      chunk_size: 800,
      allowed_formats: ['PDF', 'DOCX', 'TXT', 'MD'],
    },
    created_at: ago(120 * DAY),
  },
  {
    id: 'p2',
    owner_id: 'u-viettq45',
    name: 'Quy trình KYC',
    description: 'Quy trình định danh khách hàng và yêu cầu tuân thủ.',
    status: 'active',
    settings: {
      model: 'qwen2.5',
      top_k: 5,
      chunk_size: 800,
      allowed_formats: ['PDF', 'DOCX', 'TXT', 'MD'],
    },
    created_at: ago(90 * DAY),
  },
  {
    id: 'p3',
    owner_id: 'u-viettq45',
    name: 'Cổng thanh toán',
    description: 'Đặc tả tích hợp và tài liệu API đối tác.',
    status: 'active',
    settings: {
      model: 'qwen2.5',
      top_k: 5,
      chunk_size: 800,
      allowed_formats: ['PDF', 'DOCX', 'TXT', 'MD'],
    },
    created_at: ago(60 * DAY),
  },
];

const members: ProjectMemberDto[] = [
  {
    id: 'm1',
    project_id: 'p2',
    user_id: 'u-viettq45',
    role: 'owner',
    status: 'active',
    invited_at: ago(90 * DAY),
    joined_at: ago(90 * DAY),
  },
  {
    id: 'm2',
    project_id: 'p2',
    user_id: 'u-phongdt29',
    role: 'editor',
    status: 'active',
    invited_at: ago(89 * DAY),
    joined_at: ago(89 * DAY),
  },
  {
    id: 'm3',
    project_id: 'p2',
    user_id: 'u-dungvq11',
    role: 'editor',
    status: 'active',
    invited_at: ago(89 * DAY),
    joined_at: ago(89 * DAY),
  },
  {
    id: 'm4',
    project_id: 'p2',
    user_id: 'u-philk',
    role: 'viewer',
    status: 'active',
    invited_at: ago(87 * DAY),
    joined_at: ago(87 * DAY),
  },
  {
    id: 'm5',
    project_id: 'p2',
    user_id: 'u-trungnt110',
    role: 'editor',
    status: 'pending',
    invited_at: ago(80 * DAY),
    joined_at: null,
  },
];

const settings = {
  completionModel: 'qwen2.5',
  embeddingModel: 'nomic-embed-text',
  topK: 5,
  chunkSize: 800,
  chunkOverlap: 120,
  allowedFormats: ['PDF', 'DOCX', 'TXT', 'MD'],
  auditLog: true,
  membersOnly: true,
  allowExport: false,
};

const kycDocuments: Document[] = [
  {
    id: 'd1',
    name: 'Quy_trinh_KYC_v3.pdf',
    format: 'PDF · 24 trang',
    sizeBytes: 2_517_000,
    chunkCount: 148,
    status: 'indexed',
    updatedAt: ago(2 * HOUR),
    fileName: 'Quy_trinh_KYC_v3.pdf',
    revisionId: 'r1',
    revisionNo: 1,
    errorMessage: null,
    version: 1,
  },
  {
    id: 'd2',
    name: 'BRD_Core_Banking.docx',
    format: 'Word · 41 trang',
    sizeBytes: 1_887_000,
    chunkCount: 203,
    status: 'indexed',
    updatedAt: ago(DAY),
    fileName: 'BRD_Core_Banking.docx',
    revisionId: 'r2',
    revisionNo: 1,
    errorMessage: null,
    version: 1,
  },
  {
    id: 'd3',
    name: 'Bien_ban_hop_0708.docx',
    format: 'Word · 6 trang',
    sizeBytes: 389_000,
    chunkCount: null,
    status: 'processing',
    updatedAt: ago(5 * MINUTE),
    fileName: 'Bien_ban_hop_0708.docx',
    revisionId: 'r3',
    revisionNo: 1,
    errorMessage: null,
    version: 1,
  },
  {
    id: 'd4',
    name: 'Checklist_tuan_thu.pdf',
    format: 'PDF · 9 trang',
    sizeBytes: 757_000,
    chunkCount: 62,
    status: 'indexed',
    updatedAt: ago(3 * DAY),
    fileName: 'Checklist_tuan_thu.pdf',
    revisionId: 'r4',
    revisionNo: 1,
    errorMessage: null,
    version: 1,
  },
  {
    id: 'd5',
    name: 'Phu_luc_hop_dong.pdf',
    format: 'PDF · 15 trang',
    sizeBytes: 1_153_000,
    chunkCount: null,
    status: 'queued',
    updatedAt: ago(MINUTE),
    fileName: 'Phu_luc_hop_dong.pdf',
    revisionId: 'r5',
    revisionNo: 1,
    errorMessage: null,
    version: 1,
  },
  {
    id: 'd6',
    name: 'Dac_ta_API_v2.md',
    format: 'Markdown',
    sizeBytes: 98_300,
    chunkCount: 48,
    status: 'indexed',
    updatedAt: ago(7 * DAY),
    fileName: 'Dac_ta_API_v2.md',
    revisionId: 'r6',
    revisionNo: 1,
    errorMessage: null,
    version: 1,
  },
  {
    id: 'd7',
    name: 'Bang_thuat_ngu.xlsx',
    format: 'Excel',
    sizeBytes: 122_880,
    chunkCount: 21,
    status: 'indexed',
    updatedAt: ago(14 * DAY),
    fileName: 'Bang_thuat_ngu.xlsx',
    revisionId: 'r7',
    revisionNo: 1,
    errorMessage: null,
    version: 1,
  },
];

const kycChat: ChatMessage[] = [
  {
    id: 'c1',
    role: 'user',
    content: 'Yêu cầu xác thực OTP trong quy trình KYC là gì? Hiệu lực bao lâu?',
    citations: [],
    createdAt: ago(10 * MINUTE),
  },
  {
    id: 'c2',
    role: 'assistant',
    content:
      'Trong quy trình KYC, khách hàng phải xác thực bằng mã OTP gửi qua SMS ở bước định danh trước khi hồ sơ được duyệt[1]. Mã OTP có hiệu lực trong 5 phút; quá thời gian này khách hàng phải yêu cầu gửi lại[2].\n\nNgoài ra, hệ thống giới hạn tối đa 5 lần nhập sai trước khi tạm khóa thao tác trong 30 phút[1].',
    citations: [
      {
        index: 1,
        documentId: 'd1',
        documentName: 'Quy_trinh_KYC_v3.pdf',
        page: 4,
        excerpt:
          '“Ở bước định danh, hệ thống gửi mã OTP qua SMS tới số điện thoại đã đăng ký. Khách hàng bắt buộc nhập đúng OTP trước khi hồ sơ chuyển sang trạng thái chờ duyệt. Cho phép tối đa 5 lần nhập sai; vượt quá sẽ tạm khóa thao tác trong 30 phút.”',
      },
      {
        index: 2,
        documentId: 'd1',
        documentName: 'Quy_trinh_KYC_v3.pdf',
        page: 5,
        excerpt:
          '“Mã OTP có hiệu lực trong vòng 5 phút kể từ thời điểm gửi. Sau thời gian này, mã tự động hết hạn và khách hàng cần yêu cầu gửi lại mã mới.”',
      },
    ],
    createdAt: ago(9 * MINUTE),
  },
];

export const db = {
  projects,
  members,
  settings,
  /** Documents per project id. Projects without a seed start empty. */
  documents: {
    p1: [...kycDocuments].slice(0, 4),
    p2: kycDocuments,
    p3: [],
  } as Record<string, Document[]>,
  /** Chat transcript per project id. */
  chat: {
    p2: kycChat,
  } as Record<string, ChatMessage[]>,
};
