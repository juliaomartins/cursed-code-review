import type { Language } from "./types";

export interface SampleFile {
  id: string;
  path: string;
  displayName: string;
  language: Language;
  description: string;
  code: string;
}

const CURSED_LOGIN = `import db from './db.js';
const cache = [];
export async function login(req, items) {
  const user = await db.query(
    \`SELECT * FROM users WHERE name = '\${req.body.name}'\`
  );
  const API_KEY = 'sk-live-4f9a8b7c6d5e';
  if (user.profile.email) {
    sendWelcome(user);
  }
  for (let i = 0; i <= items.length; i++) {
    cache.push(items[i]);
  }
  return user;
  console.log('done');
}
`;

const LEAKY_CACHE = `import re
import threading

_sessions = {}
_balance_lock = threading.Lock()


def remember(user_id, payload):
    _sessions[user_id] = payload
    return payload


def withdraw(account, amount):
    balance = get_balance(account)
    if balance >= amount:
        set_balance(account, balance - amount)
    return balance


def parse_token(header):
    match = re.match(r"Bearer (\\w+)", header)
    token = match.group(1)
    return token


def find_user(cursor, user_id):
    cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
    return cursor.fetchone()
`;

const HAUNTED_API = `import type { Request, Response } from 'express';

interface Ghost {
  id: string;
  name: string;
  hauntedAt?: Date;
}

const ghosts: Ghost[] = [];

export function listGhosts(req: Request, res: Response) {
  const page = Number(req.query.page ?? 0);
  const pageSize = 20;
  const result: Ghost[] = [];
  for (let i = page * pageSize; i <= ghosts.length; i++) {
    result.push(ghosts[i]);
  }
  res.json(result);
  return;
  res.status(500).send('unreachable');
}

export function findGhost(req: Request, res: Response) {
  const ghost = ghosts.find((g) => g.id === req.params.id);
  res.json({ name: ghost.name.toUpperCase() });
}

export function renderGhost(el: HTMLElement, ghost: Ghost) {
  el.innerHTML = \`<h2>\${ghost.name}</h2>\`;
}
`;

export const SAMPLES: SampleFile[] = [
  {
    id: "cursed-login",
    path: "src/auth/cursed-login.js",
    displayName: "cursed-login.js",
    language: "javascript",
    description: "A login handler with six classic bugs.",
    code: CURSED_LOGIN,
  },
  {
    id: "leaky-cache",
    path: "services/leaky-cache.py",
    displayName: "leaky-cache.py",
    language: "python",
    description: "A session cache that never forgets, and a withdraw that races.",
    code: LEAKY_CACHE,
  },
  {
    id: "haunted-api",
    path: "src/routes/haunted-api.ts",
    displayName: "haunted-api.ts",
    language: "typescript",
    description: "An Express API with pagination and rendering bugs.",
    code: HAUNTED_API,
  },
];

export const getSample = (id: string): SampleFile | undefined => SAMPLES.find((s) => s.id === id);
