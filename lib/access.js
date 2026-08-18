const DESIGNATIONS = [
  'Manager',
  'Assistant Manager',
  'Research and Development (R&D)',
  'Sr. Executive',
  'Executive',
  'Jr Executive',
  'Sr Newsroom Editor',
  'Newsroom Editor',
  'Jr Newsroom Editor'
];

const DESIGNATION_SET = new Set(DESIGNATIONS);

function isValidDesignation(d) {
  return DESIGNATION_SET.has(d);
}

function access(user) {
  if (!user) return null;
  if (user.role === 'owner') return 'owner';
  if (user.role === 'senior' || user.role === 'admin') return 'manager';
  const d = String(user.designation || '').trim().toLowerCase();
  if (d === 'manager') return 'manager';
  if (d === 'assistant manager' || d === 'research and development (r&d)') return 'assistant';
  return 'editor';
}

function canInput(user) {
  const a = access(user);
  return ['owner', 'manager', 'assistant', 'editor'].includes(a);
}

function canManageSponsors(user) {
  const a = access(user);
  return a === 'owner' || a === 'manager';
}

function canEditAnyContent(user) {
  const a = access(user);
  return a === 'owner' || a === 'manager';
}

function canDeleteAnyContent(user) {
  const a = access(user);
  return a === 'owner' || a === 'manager' || a === 'assistant';
}

function isOwner(user) {
  return access(user) === 'owner';
}

const ACCESS_LABELS = {
  owner: 'OWNER',
  manager: 'MANAGER',
  assistant: 'ASSISTANT MANAGER',
  editor: 'EXECUTIVE / EDITOR'
};

module.exports = {
  DESIGNATIONS,
  isValidDesignation,
  access,
  canInput,
  canManageSponsors,
  canEditAnyContent,
  canDeleteAnyContent,
  isOwner,
  ACCESS_LABELS
};
