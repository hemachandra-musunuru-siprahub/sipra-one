import { query } from "../../db";

// ─── Auto-migrate notifications table ────────────────────────────────────────
(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        recipient_oid VARCHAR(255) NOT NULL,
        type          VARCHAR(100) NOT NULL,
        title         VARCHAR(255) NOT NULL,
        message       TEXT         NOT NULL,
        entity_type   VARCHAR(100),
        entity_id     UUID,
        is_read       BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient
        ON notifications (recipient_oid, is_read, created_at DESC)
    `);
    console.log("[NOTIFICATIONS] Table ready");
  } catch (err) {
    console.error("[NOTIFICATIONS SETUP ERROR]:", err);
  }
})();

export interface Notification {
  id: string;
  recipient_oid: string;
  type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

/** Create a notification for one recipient */
export async function createNotification(
  recipientOid: string,
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string
): Promise<Notification> {
  const { rows } = await query(
    `INSERT INTO notifications (recipient_oid, type, title, message, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [recipientOid, type, title, message, entityType ?? null, entityId ?? null]
  );
  return rows[0];
}

/** Bulk-create notifications (fan-out to multiple recipients) */
export async function createNotifications(
  recipientOids: string[],
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string
): Promise<Notification[]> {
  if (recipientOids.length === 0) return [];
  const results: Notification[] = [];
  for (const oid of recipientOids) {
    const n = await createNotification(oid, type, title, message, entityType, entityId);
    results.push(n);
  }
  return results;
}

/** List notifications for a user (unread first, then by date) */
export async function listForUser(recipientOid: string, limit = 50): Promise<Notification[]> {
  const { rows } = await query(
    `SELECT * FROM notifications
     WHERE recipient_oid = $1
     ORDER BY is_read ASC, created_at DESC
     LIMIT $2`,
    [recipientOid, limit]
  );
  return rows;
}

/** Count unread for a user */
export async function unreadCount(recipientOid: string): Promise<number> {
  const { rows } = await query(
    `SELECT COUNT(*) FROM notifications WHERE recipient_oid = $1 AND is_read = FALSE`,
    [recipientOid]
  );
  return parseInt(rows[0].count, 10);
}

/** Mark a single notification as read */
export async function markRead(id: string, recipientOid: string): Promise<Notification | null> {
  const { rows } = await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND recipient_oid = $2
     RETURNING *`,
    [id, recipientOid]
  );
  return rows[0] ?? null;
}

/** Mark all notifications as read for a user */
export async function markAllRead(recipientOid: string): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE recipient_oid = $1`,
    [recipientOid]
  );
}
