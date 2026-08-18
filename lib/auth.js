const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, stmts, nowIso } = require('./db');
const accessMod = require('./access');

const COOKIE_NAME = 'microboss_session';
const INACTIVITY_DAYS = 15;

function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}

function verifyPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const created = nowIso();
  const exp = new Date(Date.now() + INACTIVITY_DAYS * 86400000).toISOString();
  stmts.createSession.run(token, userId, created, exp);
  return token;
}

function getUserFromToken(token) {
  if (!token) return null;
  const session = stmts.findSession.get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    stmts.deleteSession.run(token);
    return null;
  }
  stmts.touchSession.run(new Date(Date.now() + INACTIVITY_DAYS * 86400000).toISOString(), token);
  return stmts.findUserById.get(session.user_id);
}

function isManager(user) {
  return accessMod.canManageSponsors(user);
}

function isOwner(user) {
  return accessMod.isOwner(user);
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  createSession,
  getUserFromToken,
  isManager,
  isOwner,
  access: accessMod.access
};
