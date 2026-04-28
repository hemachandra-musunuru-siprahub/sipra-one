import { query } from "../../db";

// ─── Feed (pinned first, then by newest) ─────────────────────────────────────
export const getFeed = async (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT a.*, 
       COALESCE(
         json_object_agg(r.reaction_type, r.cnt) FILTER (WHERE r.reaction_type IS NOT NULL),
         '{}'
       ) AS reactions
     FROM announcements a
     LEFT JOIN (
       SELECT announcement_id, reaction_type, COUNT(*) AS cnt
       FROM announcement_reactions GROUP BY announcement_id, reaction_type
     ) r ON r.announcement_id = a.id
     GROUP BY a.id
     ORDER BY a.is_pinned DESC, a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
};

// ─── Create ───────────────────────────────────────────────────────────────────
export const createAnnouncement = async (
  title: string, body: string, category: string | undefined,
  isPinned: boolean, createdByOid: string
) => {
  const { rows } = await query(
    `INSERT INTO announcements (title, body, category, is_pinned, created_by_oid)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, body, category || null, isPinned, createdByOid]
  );
  return rows[0];
};

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateAnnouncement = async (
  id: string, fields: { title?: string; body?: string; category?: string; is_pinned?: boolean }
) => {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (fields.title     !== undefined) { sets.push(`title = $${i++}`);     vals.push(fields.title); }
  if (fields.body      !== undefined) { sets.push(`body = $${i++}`);      vals.push(fields.body); }
  if (fields.category  !== undefined) { sets.push(`category = $${i++}`);  vals.push(fields.category); }
  if (fields.is_pinned !== undefined) { sets.push(`is_pinned = $${i++}`); vals.push(fields.is_pinned); }
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const { rows } = await query(
    `UPDATE announcements SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals
  );
  return rows[0] || null;
};

// ─── Delete ───────────────────────────────────────────────────────────────────
export const deleteAnnouncement = async (id: string) => {
  const { rowCount } = await query(`DELETE FROM announcements WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
};

// ─── Upsert reaction ─────────────────────────────────────────────────────────
export const upsertReaction = async (announcementId: string, userOid: string, reactionType: string) => {
  // Delete any existing reaction from this user on this post
  await query(
    `DELETE FROM announcement_reactions WHERE announcement_id = $1 AND user_oid = $2`,
    [announcementId, userOid]
  );
  await query(
    `INSERT INTO announcement_reactions (announcement_id, user_oid, reaction_type) VALUES ($1, $2, $3)`,
    [announcementId, userOid, reactionType]
  );
};

// ─── Remove reaction ─────────────────────────────────────────────────────────
export const removeReaction = async (announcementId: string, userOid: string) => {
  await query(
    `DELETE FROM announcement_reactions WHERE announcement_id = $1 AND user_oid = $2`,
    [announcementId, userOid]
  );
};

// ─── Get reaction summary ─────────────────────────────────────────────────────
export const getReactionSummary = async (announcementId: string) => {
  const { rows } = await query(
    `SELECT reaction_type, COUNT(*) AS count
     FROM announcement_reactions WHERE announcement_id = $1
     GROUP BY reaction_type`,
    [announcementId]
  );
  return rows;
};

// ─── Find by ID ───────────────────────────────────────────────────────────────
export const findById = async (id: string) => {
  const { rows } = await query(`SELECT * FROM announcements WHERE id = $1`, [id]);
  return rows[0] || null;
};
