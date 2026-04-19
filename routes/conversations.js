/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import express from "express";
import pool from "../Db/db.js";
const conversations = express.Router();

conversations.post("/start", auth, async (req, res) => {
  const userA = req.userId;
  const userB = req.body.targetUserId;
  // 1️⃣ Check if conversation already exists
  const existing = await pool.query(`
    SELECT cp1.conversation_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2
      ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = $1 AND cp2.user_id = $2
    LIMIT 1
  `, [userA, userB]);

  if (existing.rows.length > 0) {
    return res.json({ conversation_id: existing.rows[0].conversation_id });
  }
    // 2️⃣ Create new conversation
  const conv = await pool.query(`
    INSERT INTO conversations DEFAULT VALUES
    RETURNING id
  `);

  const conversationId = conv.rows[0].id;

  // 3️⃣ Add participants
  await pool.query(`
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES ($1,$2),($1,$3)
  `, [conversationId, userA, userB]);

  res.json({ conversation_id: conversationId });




})