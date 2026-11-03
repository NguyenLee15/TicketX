import type { OfflineTicketItem, OfflineCheckInRecord } from '../types';

const DB_NAME = 'TickeX_Offline_DB';
const DB_VERSION = 1;

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ trong môi trường này.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store: manifest_tickets
      if (!db.objectStoreNames.contains('manifest_tickets')) {
        const ticketStore = db.createObjectStore('manifest_tickets', { keyPath: 'ticketId' });
        ticketStore.createIndex('eventId', 'eventId', { unique: false });
        ticketStore.createIndex('qrSignatureHash', 'qrSignatureHash', { unique: false });
      }

      // Store: offline_scans
      if (!db.objectStoreNames.contains('offline_scans')) {
        const scanStore = db.createObjectStore('offline_scans', { keyPath: 'id', autoIncrement: true });
        scanStore.createIndex('eventId', 'eventId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredOfflineTicket extends OfflineTicketItem {
  eventId: string;
}

export interface StoredOfflineScan extends OfflineCheckInRecord {
  eventId: string;
}

export const offlineDb = {
  async saveEventManifest(eventId: string, tickets: OfflineTicketItem[]): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['manifest_tickets'], 'readwrite');
      const store = tx.objectStore('manifest_tickets');

      for (const t of tickets) {
        const record: StoredOfflineTicket = { ...t, eventId };
        store.put(record);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getOfflineTicketCount(eventId: string): Promise<number> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['manifest_tickets'], 'readonly');
      const store = tx.objectStore('manifest_tickets');
      const index = store.index('eventId');
      const request = index.count(IDBKeyRange.only(eventId));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async verifyTicketLocally(
    eventId: string,
    qrPayload: string
  ): Promise<{ success: boolean; message: string; ticket?: OfflineTicketItem }> {
    const db = await getDb();
    const cleanPayload = qrPayload.trim();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['manifest_tickets'], 'readwrite');
      const store = tx.objectStore('manifest_tickets');
      const index = store.index('eventId');
      const request = index.getAll(IDBKeyRange.only(eventId));

      request.onsuccess = () => {
        const list = request.result as StoredOfflineTicket[];
        if (!list || list.length === 0) {
          resolve({
            success: false,
            message: 'Chưa có dữ liệu vé ngoại tuyến cho sự kiện này. Vui lòng tải manifest trước.',
          });
          return;
        }

        // Match by QrSignatureHash, TicketCode, or TicketId
        const match = list.find((t) =>
          t.qrSignatureHash === cleanPayload ||
          cleanPayload.includes(t.ticketId) ||
          (cleanPayload.startsWith('TICKEX-TOTP:') && cleanPayload.includes(t.ticketId)) ||
          t.ticketCode.toLowerCase() === cleanPayload.toLowerCase()
        );

        if (!match) {
          resolve({
            success: false,
            message: 'Vé không hợp lệ hoặc không thuộc sự kiện này trong kho ngoại tuyến.',
          });
          return;
        }

        if (match.isAlreadyUsed) {
          resolve({
            success: false,
            message: `Vé đã qua cửa trước đó lúc ${match.checkedInAt ? new Date(match.checkedInAt).toLocaleTimeString('vi-VN') : 'trước đó'}. Cảnh báo gian lận!`,
            ticket: match,
          });
          return;
        }

        // Mark as locally used
        match.isAlreadyUsed = true;
        match.checkedInAt = new Date().toISOString();
        store.put(match);

        resolve({
          success: true,
          message: `Xác thực thành công! Ghế: ${match.seatNumber} (${match.attendeeName})`,
          ticket: match,
        });
      };

      request.onerror = () => reject(request.error);
    });
  },

  async enqueueOfflineScan(
    eventId: string,
    ticketId: string,
    gate: string = 'Gate 1',
    staffId: string = 'staff'
  ): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['offline_scans'], 'readwrite');
      const store = tx.objectStore('offline_scans');

      const record: StoredOfflineScan = {
        eventId,
        ticketId,
        scannedAtUtc: new Date().toISOString(),
        gate,
        staffId,
        deviceId: navigator.userAgent.slice(0, 32),
      };

      store.add(record);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getPendingOfflineScans(eventId: string): Promise<StoredOfflineScan[]> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['offline_scans'], 'readonly');
      const store = tx.objectStore('offline_scans');
      const index = store.index('eventId');
      const request = index.getAll(IDBKeyRange.only(eventId));

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async clearOfflineScans(scanIds: number[]): Promise<void> {
    if (!scanIds.length) return;
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['offline_scans'], 'readwrite');
      const store = tx.objectStore('offline_scans');

      for (const id of scanIds) {
        store.delete(id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearEventManifest(eventId: string): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['manifest_tickets'], 'readwrite');
      const store = tx.objectStore('manifest_tickets');
      const index = store.index('eventId');
      const request = index.openCursor(IDBKeyRange.only(eventId));

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  },
};

