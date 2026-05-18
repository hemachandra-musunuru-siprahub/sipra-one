import { query } from "../../db";

// ─── Auto Archive Helper ───────────────────────────────────────────────────────
async function autoArchiveOldAnnouncements() {
  await query(`
    UPDATE announcements
    SET is_archived = true, archived_at = NOW()
    WHERE is_archived = false
      AND created_at <= NOW() - INTERVAL '30 days'
  `);
}

// ─── Feed (pinned first, then by newest) ─────────────────────────────────────
export const getFeed = async (page = 1, limit = 20, userOid?: string, latest = false, status = "published", userRole?: string) => {
  await autoArchiveOldAnnouncements();
  const offset = (page - 1) * limit;
  const orderBy = latest ? "a.created_at DESC" : "a.is_pinned DESC, a.pinned_at DESC NULLS LAST, a.created_at DESC";

  // Map role to allowed target_audience values
  const allowedAudiences: string[] = ["ALL"];
  if (userRole) {
    const r = userRole.toUpperCase();
    if (r.includes("HR") || r.includes("ADMIN")) allowedAudiences.push("HR", "MANAGER", "EMPLOYEE");
    else if (r.includes("MANAGER")) allowedAudiences.push("MANAGER");
    else allowedAudiences.push("EMPLOYEE"); // default employee
  } else {
    allowedAudiences.push("EMPLOYEE");
  }
  const audiencePlaceholders = allowedAudiences.map((_, i) => `$${i + 5}`).join(", ");

  const { rows } = await query(
    `SELECT a.*,
       COALESCE(
         json_object_agg(r.reaction_type, r.cnt) FILTER (WHERE r.reaction_type IS NOT NULL),
         '{}'
       ) AS reactions,
       (SELECT reaction_type FROM announcement_reactions
        WHERE announcement_id = a.id AND user_oid = $4 LIMIT 1) AS user_reaction
     FROM announcements a
     LEFT JOIN (
       SELECT announcement_id, reaction_type, COUNT(*) AS cnt
       FROM announcement_reactions GROUP BY announcement_id, reaction_type
     ) r ON r.announcement_id = a.id
     WHERE (a.status = $3 OR (a.status IS NULL AND $3 = 'published'))
       AND a.is_archived = false
       AND (a.target_audience IS NULL OR a.target_audience IN (${audiencePlaceholders}))
     GROUP BY a.id
     ORDER BY ${orderBy}
     LIMIT $1 OFFSET $2`,
    [limit, offset, status, userOid || null, ...allowedAudiences]
  );
  return rows;
};

// ─── Archived Feed ───────────────────────────────────────────────────────────
export const getArchivedFeed = async (page = 1, limit = 20, userOid?: string, userRole?: string) => {
  await autoArchiveOldAnnouncements();
  const offset = (page - 1) * limit;

  const allowedAudiences: string[] = ["ALL"];
  if (userRole) {
    const r = userRole.toUpperCase();
    if (r.includes("HR") || r.includes("ADMIN")) allowedAudiences.push("HR", "MANAGER", "EMPLOYEE");
    else if (r.includes("MANAGER")) allowedAudiences.push("MANAGER");
    else allowedAudiences.push("EMPLOYEE");
  } else {
    allowedAudiences.push("EMPLOYEE");
  }
  const audiencePlaceholders = allowedAudiences.map((_, i) => `$${i + 5}`).join(", ");

  const { rows } = await query(
    `SELECT a.*,
       COALESCE(
         json_object_agg(r.reaction_type, r.cnt) FILTER (WHERE r.reaction_type IS NOT NULL),
         '{}'
       ) AS reactions,
       (SELECT reaction_type FROM announcement_reactions
        WHERE announcement_id = a.id AND user_oid = $4 LIMIT 1) AS user_reaction
     FROM announcements a
     LEFT JOIN (
       SELECT announcement_id, reaction_type, COUNT(*) AS cnt
       FROM announcement_reactions GROUP BY announcement_id, reaction_type
     ) r ON r.announcement_id = a.id
     WHERE (a.status = $3 OR (a.status IS NULL AND $3 = 'published'))
       AND a.is_archived = true
       AND (a.target_audience IS NULL OR a.target_audience IN (${audiencePlaceholders}))
     GROUP BY a.id
     ORDER BY a.archived_at DESC NULLS LAST, a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset, "published", userOid || null, ...allowedAudiences]
  );
  return rows;
};

// ─── FIFO Pinning Helper ─────────────────────────────────────────────────────
async function ensureMaxPins() {
  const { rows } = await query(`SELECT COUNT(*)::int FROM announcements WHERE is_pinned = true AND status = 'published'`);
  const count = rows[0].count;
  if (count >= 5) {
    // Unpin the oldest one by pinned_at (FIFO)
    await query(`
      UPDATE announcements 
      SET is_pinned = false, pinned_at = NULL
      WHERE id IN (
        SELECT id FROM announcements 
        WHERE is_pinned = true AND status = 'published'
        ORDER BY pinned_at ASC NULLS FIRST, created_at ASC 
        LIMIT 1
      )
    `);
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────
export const createAnnouncement = async (
  title: string, body: string, category: string | undefined,
  isPinned: boolean, priority: string, imageUrl: string | null,
  createdByOid: string, status = "published", targetAudience = "ALL"
) => {
  if (isPinned && status === "published") {
    await ensureMaxPins();
  }
  
  const pinnedAt = isPinned && status === "published" ? new Date() : null;

  const { rows } = await query(
    `INSERT INTO announcements (title, body, category, is_pinned, priority, image_url, created_by_oid, status, pinned_at, target_audience)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [title, body, category || null, isPinned, priority, imageUrl, createdByOid, status, pinnedAt, targetAudience]
  );
  return rows[0];
};

export const updateAnnouncement = async (
  id: string, fields: { title?: string; body?: string; category?: string | null; is_pinned?: boolean; priority?: string; image_url?: string | null; status?: string; target_audience?: string }
) => {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (fields.is_pinned === true) {
    await ensureMaxPins();
    sets.push(`pinned_at = NOW()`);
  } else if (fields.is_pinned === false) {
    sets.push(`pinned_at = NULL`);
  }

  if (fields.title         !== undefined) { sets.push(`title = $${i++}`);           vals.push(fields.title); }
  if (fields.body          !== undefined) { sets.push(`body = $${i++}`);            vals.push(fields.body); }
  if (fields.category      !== undefined) { sets.push(`category = $${i++}`);        vals.push(fields.category); }
  if (fields.is_pinned     !== undefined) { sets.push(`is_pinned = $${i++}`);       vals.push(fields.is_pinned); }
  if (fields.priority      !== undefined) { sets.push(`priority = $${i++}`);        vals.push(fields.priority); }
  if (fields.image_url     !== undefined) { sets.push(`image_url = $${i++}`);       vals.push(fields.image_url); }
  if (fields.status        !== undefined) { sets.push(`status = $${i++}`);          vals.push(fields.status); }
  if (fields.target_audience !== undefined) { sets.push(`target_audience = $${i++}`); vals.push(fields.target_audience); }
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

// ─── Upsert reaction (safe ON CONFLICT) ──────────────────────────────────────
export const upsertReaction = async (announcementId: string, userOid: string, reactionType: string) => {
  const { rows } = await query(
    `INSERT INTO announcement_reactions (announcement_id, user_oid, reaction_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (announcement_id, user_oid)
     DO UPDATE SET reaction_type = EXCLUDED.reaction_type
     RETURNING *`,
    [announcementId, userOid, reactionType]
  );
  return rows[0];
};

// ─── Remove reaction ─────────────────────────────────────────────────────────
export const removeReaction = async (announcementId: string, userOid: string) => {
  await query(
    `DELETE FROM announcement_reactions WHERE announcement_id = $1 AND user_oid = $2`,
    [announcementId, userOid]
  );
};

// ─── Get single user's reaction on a post ────────────────────────────────────
export const getUserReaction = async (announcementId: string, userOid: string) => {
  const { rows } = await query(
    `SELECT reaction_type FROM announcement_reactions WHERE announcement_id = $1 AND user_oid = $2`,
    [announcementId, userOid]
  );
  return rows[0]?.reaction_type || null;
};

// ─── Get reaction summary (all reactions grouped by type) ─────────────────────
export const getReactionSummary = async (announcementId: string) => {
  const { rows } = await query(
    `SELECT reaction_type, COUNT(*)::int AS count
     FROM announcement_reactions WHERE announcement_id = $1
     GROUP BY reaction_type`,
    [announcementId]
  );
  return rows;
};

// ─── Find by ID ───────────────────────────────────────────────────────────────
export const findById = async (id: string, userOid?: string, userRole?: string) => {
  const allowedAudiences: string[] = ["ALL"];
  if (userRole) {
    const r = userRole.toUpperCase();
    if (r.includes("HR") || r.includes("ADMIN")) allowedAudiences.push("HR", "MANAGER", "EMPLOYEE");
    else if (r.includes("MANAGER")) allowedAudiences.push("MANAGER");
    else allowedAudiences.push("EMPLOYEE");
  } else {
    allowedAudiences.push("HR", "MANAGER", "EMPLOYEE"); // Fallback if called internally without role
  }
  const audiencePlaceholders = allowedAudiences.map((_, i) => `$${i + 3}`).join(", ");

  const { rows } = await query(
    `SELECT a.*,
       COALESCE(
         json_object_agg(r.reaction_type, r.cnt) FILTER (WHERE r.reaction_type IS NOT NULL),
         '{}'
       ) AS reactions,
       (SELECT reaction_type FROM announcement_reactions
        WHERE announcement_id = a.id AND user_oid = $2 LIMIT 1) AS user_reaction
     FROM announcements a
     LEFT JOIN (
       SELECT announcement_id, reaction_type, COUNT(*) AS cnt
       FROM announcement_reactions GROUP BY announcement_id, reaction_type
     ) r ON r.announcement_id = a.id
     WHERE a.id = $1
       AND (a.target_audience IS NULL OR a.target_audience IN (${audiencePlaceholders}))
     GROUP BY a.id`,
    [id, userOid || null, ...allowedAudiences]
  );
  return rows[0] || null;
};

export const countAnnouncements = async () => {
  const { rows } = await query(`SELECT COUNT(*)::int FROM announcements WHERE is_archived = false`);
  return rows[0].count;
};

// ─── Archive / Unarchive ─────────────────────────────────────────────────────
export const archiveAnnouncement = async (id: string) => {
  const { rows } = await query(
    `UPDATE announcements SET is_archived = true, archived_at = NOW(), is_pinned = false, pinned_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
};

export const unarchiveAnnouncement = async (id: string) => {
  const { rows } = await query(
    `UPDATE announcements SET is_archived = false, archived_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
};
