export type SeatTier = 0 | 1 | 2; // 0: Standard, 1: VIP, 2: Economy
export type SeatStatus = 0 | 1 | 2; // 0: Available, 1: Locked, 2: Sold
export type TicketStatus = 0 | 1 | 2 | 3 | 4; // 0: Pending, 1: Paid, 2: Cancelled, 3: Used, 4: RefundPending
export type EventStatus = 0 | 1 | 2 | 3 | 'Draft' | 'Published' | 'Completed' | 'Cancelled';

export interface TicketType {
  name: string;
  price: number;
  totalQuantity: number;
  availableQuantity?: number;
}

export interface Seat {
  id: string;
  eventId: string;
  row: string;
  number: number;
  tier: SeatTier;
  status: SeatStatus;
  price: number;
  version: string;
  isLockedByMe?: boolean;
  isLockedByCurrentUser?: boolean;
  lockExpiresAt?: string | null;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  location: string;
  venueName?: string;
  category: string;
  imageUrl: string;
  bannerUrl?: string;
  organizerName?: string;
  totalSeats: number;
  availableSeatsCount?: number;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  status: EventStatus;
  refundCutoffHours?: number;
  maxTicketsPerUser?: number;
  isDeleted?: boolean;
  hasTicketHistory?: boolean;
  ticketTypes?: TicketType[];
  version?: string;
}

export interface EventDetail extends Event {
  seats: Seat[];
  serverTime?: string | null;
}

export interface TicketData {
  id: string;
  eventId: string;
  seatId: string;
  userId?: string;
  eventTitle: string;
  eventDate: string;
  location: string;
  venueName?: string;
  row: string;
  number: number;
  tier?: SeatTier | string;
  price: number;
  status: string; // 'Pending' | 'Paid' | 'Cancelled' | 'Used'
  orderCode: string | number;
  qrCodeSignature?: string;
  paidAt?: string;
  checkedInAt?: string;
  refundAmount?: number;
  refundedAt?: string;
}

export interface SeatStatusChangedPayload {
  seatId?: string;
  SeatId?: string;
  id?: string;
  status?: string | number;
  Status?: string | number;
  isLockedByMe?: boolean;
  isLockedByCurrentUser?: boolean;
  reservationOwnerId?: string;
  ReservationOwnerId?: string;
  version?: string;
  Version?: string;
  expiresAt?: string;
  ExpiresAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  errors?: string[];
}

export interface ApiErrorResponse {
  success: false;
  code?: string;
  message: string;
  errors?: string[];
}

export interface JwtTokenPayload {
  sub?: string;
  name?: string;
  email?: string;
  role?: string;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
}

export type AsyncState<T> =
  | { status: 'idle'; data?: undefined; error?: undefined }
  | { status: 'loading'; data?: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; error: string; data?: T };

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
  finalAmount: number;
}

export interface AvailableCoupon {
  id: string;
  code: string;
  description: string;
  discountType: number | 'Percentage' | 'FixedAmount';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  usageLimit: number;
  usedCount: number;
  validFrom: string;
  validTo: string;
  eventId?: string | null;
  isActive: boolean;
}

export interface OrganizerMetrics {
  totalEvents: number;
  totalSeats: number;
  totalTicketsSold: number;
  totalCheckedInTickets?: number;
  totalGrossRevenue: number;
  totalCommissionEstimated: number;
  totalNetRevenueEstimated: number;
  averageOccupancyRate: number;
  liveCheckInRate?: number;
}

export interface OrganizerEvent {
  id: string;
  title: string;
  date: string;
  endDate: string;
  location: string;
  venueName: string;
  category: string;
  totalSeats: number;
  soldTickets: number;
  checkedInTickets?: number;
  grossRevenue: number;
  status: number | string;
}

export interface OrganizerTicketReportItem {
  id: string;
  orderCode: number;
  customerName: string;
  customerEmail: string;
  seatRow: string;
  seatNumber: number;
  seatTier: number;
  price: number;
  status: number;
  paidAt: string | null;
  checkedInAt: string | null;
}

export interface SettlementItem {
  id: string;
  eventId: string;
  eventTitle: string;
  organizerId: string;
  organizerName: string;
  grossRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  refundDeduction: number;
  netPayout: number;
  bankName: string;
  bankAccountNumber: string;
  accountHolder: string;
  status: number; // 1: Pending, 2: Approved, 3: Completed, 4: Rejected
  adminNote?: string;
  requestedAt: string;
  processedAt?: string;
}

export interface OfflineTicketItem {
  ticketId: string;
  ticketCode: string;
  seatNumber: string;
  attendeeName: string;
  qrSignatureHash: string;
  isAlreadyUsed: boolean;
  checkedInAt?: string;
}

export interface EventOfflineManifest {
  eventId: string;
  eventTitle: string;
  generatedAtUtc: string;
  totalTickets: number;
  tickets: OfflineTicketItem[];
}

export interface OfflineCheckInRecord {
  id?: number;
  ticketId: string;
  scannedAtUtc: string;
  gate: string;
  staffId: string;
  deviceId: string;
}

export interface OfflineCheckInConflictDetail {
  ticketId: string;
  seatNumber: string;
  conflictCode: string;
  message: string;
  originalScanUtc: string;
  rejectedScanUtc: string;
  gate: string;
}

export interface SyncOfflineCheckInsResult {
  totalProcessed: number;
  successful: number;
  duplicatesRejected: number;
  conflicts: OfflineCheckInConflictDetail[];
}

export interface HeatmapBucket {
  timeLabel: string;
  startTimeUtc: string;
  endTimeUtc: string;
  scanCount: number;
  percentageOfCheckedIn: number;
}

export interface EventAttendanceAnalytics {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  totalCapacity: number;
  totalTicketsSold: number;
  totalCheckedIn: number;
  showUpRate: number;
  peakInterval: string;
  peakScanCount: number;
  heatmapBuckets: HeatmapBucket[];
}

export interface VatInvoiceData {
  id: string;
  orderCode: number;
  taxCode: string;
  companyName: string;
  companyAddress: string;
  recipientEmail: string;
  subTotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  invoiceNumber: string;
  invoiceLookupCode: string;
  status: string;
  issuedAt?: string;
}



