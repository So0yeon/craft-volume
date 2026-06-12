import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore, useCallback } from "react";
import * as THREE from "three";
import { problemPack } from './current-pack/problemPack.js';

/* ════════════════════════════════════════════════════════════════
   MATH CRAFT — 직육면체의 겉넓이와 부피
   ────────────────────────────────────────────────────────────────
   1. constants        : 블록 카탈로그 / 난이도 / 칭호
   2. problem utils    : 공통 헬퍼 (ri, pick)
   3. problem draw     : problemPack에서 문제 뽑기
   4. store & actions  : 경량 Zustand 스타일 스토어 + 건축/보상 로직
   5. achievements     : 업적 정의·검사
   6. persistence      : LocalStorage 자동 저장
   7. audio            : Web Audio 합성 효과음 + 생성형 BGM
   8. three/world      : 로우폴리 3D 월드 (낮밤/구름/새/잔디/그림자)
   9. three/blocks     : InstancedMesh 블록 + 장식 모델 팩토리
   10. ui              : Glassmorphism HUD / 퀴즈 / 상점 / 업적
   ════════════════════════════════════════════════════════════════ */

/* ═══════════ 1. constants ═══════════ */

const SAVE_KEY = `mathcraft-${problemPack.id}-v1`;
const WORLD_R = 20;        // 건축 가능 반경 (블록)
const WORLD_H = 14;        // 최대 높이
const FILL_LIMIT = 150;    // 한 번에 채우기 최대 블록 수

const TITLES = [
  { level: 1,  name: "부피 새싹",      emoji: "🌱" },
  { level: 3,  name: "부피 견습생",    emoji: "🍃" },
  { level: 5,  name: "부피 장인",      emoji: "📐" },
  { level: 8,  name: "공간 설계자",    emoji: "🏠" },
  { level: 12, name: "입체도형 마스터", emoji: "👑" },
];
const xpForLevel = (lv) => 40 + (lv - 1) * 30;
const titleForLevel = (lv) => {
  let t = TITLES[0];
  for (const item of TITLES) if (lv >= item.level) t = item;
  return t;
};

const DIFFICULTIES = [
  { id: 1, name: "새싹", emoji: "🌱", reward: 5,  color: "#8FCB6B" },
  { id: 2, name: "잎사귀", emoji: "🍃", reward: 8,  color: "#5FB98A" },
  { id: 3, name: "나무", emoji: "🌳", reward: 12, color: "#4A9CC9" },
  { id: 4, name: "숲", emoji: "🌲", reward: 18, color: "#8A6FD1" },
  { id: 5, name: "마스터", emoji: "👑", reward: 25, color: "#E0883A" },
];

// kind: cube(정육면체) | slab(낮은 블록) | roof(지붕 프리즘) | deco(장식 모델)
const BLOCKS = {
  grass:      { name: "잔디",          color: "#7FBF5C", cat: "지형", price: 1, kind: "cube" },
  dirt:       { name: "흙",            color: "#A9764C", cat: "지형", price: 1, kind: "cube" },
  sand:       { name: "모래",          color: "#EFDCA0", cat: "지형", price: 2, kind: "cube" },
  gravel:     { name: "자갈",          color: "#B5B0A8", cat: "지형", price: 2, kind: "cube" },
  stone:      { name: "돌",            color: "#9A9AA2", cat: "지형", price: 2, kind: "cube" },
  snow:       { name: "눈",            color: "#F4F8FB", cat: "지형", price: 3, kind: "cube" },
  mud:        { name: "진흙",          color: "#8B6B45", cat: "지형", price: 2, kind: "cube" },
  leafblock:  { name: "풀숲 블록",     color: "#6FAE52", cat: "지형", price: 3, kind: "cube" },
  oak:        { name: "참나무 판자",   color: "#C99A5B", cat: "자재", price: 4, kind: "cube" },
  birch:      { name: "자작나무 판자", color: "#E8D9B5", cat: "자재", price: 4, kind: "cube" },
  darkwood:   { name: "짙은 원목",     color: "#7A5230", cat: "자재", price: 5, kind: "cube" },
  stonebrick: { name: "석재 벽돌",     color: "#8C8C94", cat: "자재", price: 5, kind: "cube" },
  redbrick:   { name: "빨간 벽돌",     color: "#C96F5A", cat: "자재", price: 5, kind: "cube" },
  plaster:    { name: "회벽",          color: "#F4EFE6", cat: "자재", price: 5, kind: "cube" },
  wall_mint:  { name: "민트 벽",       color: "#A8E0CE", cat: "자재", price: 6, kind: "cube" },
  wall_peach: { name: "복숭아 벽",     color: "#F7C8B0", cat: "자재", price: 6, kind: "cube" },
  wall_sky:   { name: "하늘 벽",       color: "#AFD8F0", cat: "자재", price: 6, kind: "cube" },
  log:        { name: "통나무",        color: "#9B6B3F", cat: "자재", price: 4, kind: "cube" },
  roof_red:   { name: "빨간 지붕",     color: "#D95B4A", cat: "지붕·창", price: 8,  kind: "roof" },
  roof_blue:  { name: "파란 지붕",     color: "#5B84C4", cat: "지붕·창", price: 8,  kind: "roof" },
  roof_straw: { name: "초가 지붕",     color: "#D9B45B", cat: "지붕·창", price: 8,  kind: "roof" },
  glass:      { name: "유리",          color: "#CDEBF5", cat: "지붕·창", price: 10, kind: "cube", glassy: true },
  stained:    { name: "스테인드글라스", color: "#C9A6E0", cat: "지붕·창", price: 15, kind: "cube", glassy: true },
  fence:      { name: "울타리",        color: "#B98B55", cat: "지붕·창", price: 6,  kind: "deco" },
  path_stone: { name: "돌길",          color: "#C2BBAE", cat: "길·조명", price: 3, kind: "slab" },
  path_brick: { name: "벽돌길",        color: "#D49679", cat: "길·조명", price: 3, kind: "slab" },
  deck:       { name: "나무 데크",     color: "#D2A86E", cat: "길·조명", price: 4, kind: "slab" },
  lamp:       { name: "가로등",        color: "#FFE9A8", cat: "길·조명", price: 25, kind: "deco", deco: true, bonus: 8,  light: true },
  lantern:    { name: "랜턴",          color: "#FFD66B", cat: "길·조명", price: 15, kind: "deco", deco: true, bonus: 5,  light: true },
  flower:     { name: "꽃",            color: "#F38BA0", cat: "자연", price: 5,  kind: "deco", deco: true, bonus: 2 },
  tulip:      { name: "튤립",          color: "#F2B33D", cat: "자연", price: 5,  kind: "deco", deco: true, bonus: 2 },
  tree_s:     { name: "작은 나무",     color: "#5FA653", cat: "자연", price: 12, kind: "deco", deco: true, bonus: 4 },
  tree_l:     { name: "큰 나무",       color: "#3F8C46", cat: "자연", price: 20, kind: "deco", deco: true, bonus: 6 },
  bush:       { name: "덤불",          color: "#79B85F", cat: "자연", price: 6,  kind: "deco", deco: true, bonus: 2 },
  bench:      { name: "벤치",          color: "#C08A52", cat: "특수", price: 20, kind: "deco", deco: true, bonus: 8 },
  mailbox:    { name: "우체통",        color: "#E2574C", cat: "특수", price: 25, kind: "deco", deco: true, bonus: 8 },
  pond:       { name: "연못",          color: "#7FC4E8", cat: "특수", price: 35, kind: "deco", deco: true, bonus: 12 },
  balloon:    { name: "풍선",          color: "#F2789F", cat: "특수", price: 30, kind: "deco", deco: true, bonus: 10 },
  fountain:   { name: "분수대",        color: "#A8CDE0", cat: "특수", price: 60, kind: "deco", deco: true, bonus: 20 },
  playground: { name: "놀이터",        color: "#F2A33D", cat: "특수", price: 80, kind: "deco", deco: true, bonus: 25 },
  garden:     { name: "텃밭",          color: "#8A6B3F", cat: "특수", price: 28, kind: "deco", deco: true, bonus: 9 },
  flag:       { name: "깃발",          color: "#5BC4A0", cat: "특수", price: 22, kind: "deco", deco: true, bonus: 7 },
};
const SHOP_CATS = ["지형", "자재", "지붕·창", "길·조명", "자연", "특수"];

/* ═══════════ 2. problem utils ═══════════ */

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ═══════════ 3. problem draw (problemPack에서 문제를 뽑음) ═══════════ */

const recentSigs = [];
function drawProblem(diff) {
  let p;
  for (let i = 0; i < 12; i++) {
    p = problemPack.generateProblem(diff);
    if (!recentSigs.includes(p.sig)) break;
  }
  recentSigs.push(p.sig);
  if (recentSigs.length > 20) recentSigs.shift();
  return p;
}

/* ═══════════ 4. store & actions ═══════════ */

function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set: (partial) => {
      const next = typeof partial === "function" ? partial(state) : partial;
      state = { ...state, ...next };
      listeners.forEach((l) => l(state));
    },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

const initialState = () => ({
  screen: "menu",
  booted: false,
  player: { coins: 40, xp: 0, level: 1, combo: 0, bestCombo: 0, solved: 0, totalCorrect: 0, totalEarned: 0 },
  world: { blocks: {}, placedTotal: 0 },
  inventory: {
    selected: "grass",
    owned: { grass: 30, dirt: 15, oak: 20, plaster: 10, roof_red: 8, glass: 4, flower: 5, path_stone: 10 },
  },
  quiz: { difficulty: 1, correctStreak: 0, wrongStreak: 0 },
  settings: { sound: true, music: true, largeText: false, colorBlind: false, seenHelp: false },
  achievements: {},
  ui: { mode: "build" },
});

const store = createStore(initialState());
function useStore(selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

// undo/redo 스택 (저장 대상 아님 → 모듈 스코프)
let undoStack = [];
let redoStack = [];
const keyOf = (x, y, z) => `${x},${y},${z}`;
const parseKey = (k) => k.split(",").map(Number);
const inBounds = (x, y, z) => x >= -WORLD_R && x < WORLD_R && z >= -WORLD_R && z < WORLD_R && y >= 0 && y < WORLD_H;

// entries: [{key, before, after}] / dir: +1 적용, -1 되돌리기
function applyEntries(s, entries, dir) {
  const blocks = { ...s.world.blocks };
  const owned = { ...s.inventory.owned };
  let placedDelta = 0;
  for (const e of entries) {
    const from = dir > 0 ? e.before : e.after;
    const to = dir > 0 ? e.after : e.before;
    if (from) { delete blocks[e.key]; owned[from] = (owned[from] || 0) + 1; }
    if (to) {
      blocks[e.key] = to;
      owned[to] = Math.max(0, (owned[to] || 0) - 1);
      placedDelta += 1;
    }
  }
  return {
    world: { ...s.world, blocks, placedTotal: s.world.placedTotal + (dir > 0 ? placedDelta : 0) },
    inventory: { ...s.inventory, owned },
  };
}

function commit(entries) {
  store.set((s) => applyEntries(s, entries, 1));
  undoStack.push(entries);
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
}

const actions = {
  setScreen: (screen) => store.set({ screen }),
  setMode: (mode) => store.set((s) => ({ ui: { ...s.ui, mode } })),
  selectBlock: (id) => store.set((s) => ({ inventory: { ...s.inventory, selected: id } })),
  toggleSetting: (key) => store.set((s) => ({ settings: { ...s.settings, [key]: !s.settings[key] } })),

  placeAt(key, idOverride) {
    const s = store.get();
    const id = idOverride || s.inventory.selected;
    const [x, y, z] = parseKey(key);
    if (!inBounds(x, y, z)) return { ok: false, reason: "bounds" };
    if (s.world.blocks[key]) return { ok: false, reason: "occupied" };
    if ((s.inventory.owned[id] || 0) <= 0) return { ok: false, reason: "stock", id };
    commit([{ key, before: null, after: id }]);
    return { ok: true, id };
  },

  removeAt(key) {
    const s = store.get();
    const cur = s.world.blocks[key];
    if (!cur) return { ok: false };
    commit([{ key, before: cur, after: null }]);
    return { ok: true, id: cur };
  },

  replaceAt(key) {
    const s = store.get();
    const cur = s.world.blocks[key];
    const id = s.inventory.selected;
    if (!cur) return { ok: false, reason: "empty" };
    if (cur === id) return { ok: false, reason: "same" };
    if ((s.inventory.owned[id] || 0) <= 0) return { ok: false, reason: "stock", id };
    commit([{ key, before: cur, after: id }]);
    return { ok: true, id };
  },

  fillRegion(keyA, keyB) {
    const s = store.get();
    const id = s.inventory.selected;
    if (BLOCKS[id].kind === "deco") return { ok: false, reason: "deco" };
    const [ax, ay, az] = parseKey(keyA);
    const [bx, by, bz] = parseKey(keyB);
    const entries = [];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++)
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++)
        for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) {
          const k = keyOf(x, y, z);
          if (inBounds(x, y, z) && !s.world.blocks[k]) entries.push({ key: k, before: null, after: id });
        }
    if (!entries.length) return { ok: false, reason: "none" };
    if (entries.length > FILL_LIMIT) return { ok: false, reason: "limit", count: entries.length };
    const have = s.inventory.owned[id] || 0;
    if (have < entries.length) return { ok: false, reason: "stock", need: entries.length, have, id };
    commit(entries);
    return { ok: true, count: entries.length, id };
  },

  undo() {
    const entries = undoStack.pop();
    if (!entries) return false;
    store.set((s) => applyEntries(s, entries, -1));
    redoStack.push(entries);
    return true;
  },
  redo() {
    const entries = redoStack.pop();
    if (!entries) return false;
    store.set((s) => applyEntries(s, entries, 1));
    undoStack.push(entries);
    return true;
  },

  buyBlock(id, qty) {
    const s = store.get();
    const cost = BLOCKS[id].price * qty;
    if (s.player.coins < cost) return { ok: false };
    store.set({
      player: { ...s.player, coins: s.player.coins - cost },
      inventory: { ...s.inventory, owned: { ...s.inventory.owned, [id]: (s.inventory.owned[id] || 0) + qty } },
    });
    return { ok: true, cost };
  },

  // ── 퀴즈 보상 ──
  answerCorrect() {
    const s = store.get();
    const diff = s.quiz.difficulty;
    const combo = s.player.combo + 1;
    const mult = combo >= 10 ? 2 : combo >= 5 ? 1.5 : combo >= 3 ? 1.2 : 1;
    const coins = Math.round(DIFFICULTIES[diff - 1].reward * mult);
    const xpGain = 10 + diff * 4;
    let { xp, level } = s.player;
    xp += xpGain;
    let leveled = false;
    while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level++; leveled = true; }
    store.set({
      player: {
        ...s.player, combo, bestCombo: Math.max(s.player.bestCombo, combo),
        coins: s.player.coins + coins, totalEarned: s.player.totalEarned + coins,
        xp, level, solved: s.player.solved + 1, totalCorrect: s.player.totalCorrect + 1,
      },
      quiz: { ...s.quiz, correctStreak: s.quiz.correctStreak + 1, wrongStreak: 0 },
    });
    return { coins, combo, mult, leveled, level, streak: s.quiz.correctStreak + 1 };
  },

  answerWrong() {
    const s = store.get();
    const wrongStreak = s.quiz.wrongStreak + 1;
    let diff = s.quiz.difficulty;
    let downed = false;
    if (wrongStreak >= 2 && diff > 1) { diff -= 1; downed = true; }
    store.set({
      player: { ...s.player, combo: 0, solved: s.player.solved + 1 },
      quiz: { difficulty: diff, correctStreak: 0, wrongStreak: downed ? 0 : wrongStreak },
    });
    return { downed, diff };
  },

  setDifficulty(diff) {
    store.set((s) => ({ quiz: { difficulty: diff, correctStreak: 0, wrongStreak: 0 } }));
  },

  addCoins(n) {
    store.set((s) => ({ player: { ...s.player, coins: s.player.coins + n, totalEarned: s.player.totalEarned + Math.max(0, n) } }));
  },

  newGame() {
    const fresh = initialState();
    fresh.booted = true;
    fresh.screen = "village";
    undoStack = []; redoStack = [];
    store.set(fresh);
  },
};

// ── 건물(마을) 가치 계산 ──
function villageValue(blocks) {
  let count = 0, decoBonus = 0;
  const types = new Set();
  for (const k in blocks) {
    count++;
    const id = blocks[k];
    types.add(id);
    decoBonus += BLOCKS[id].bonus || 0;
  }
  return count + types.size * 5 + decoBonus;
}

/* ═══════════ 5. achievements ═══════════ */

const ACHIEVEMENTS = [
  { id: "first_block", name: "첫 블록!", desc: "블록을 처음 설치했어요", emoji: "🧱", check: (s) => s.world.placedTotal >= 1 },
  { id: "first_house", name: "첫 집 완성", desc: "지붕을 처음 올렸어요", emoji: "🏠", check: (s) => Object.values(s.world.blocks).some((b) => BLOCKS[b].kind === "roof") },
  { id: "combo_5", name: "불타오르네!", desc: "5콤보를 달성했어요", emoji: "🔥", check: (s) => s.player.bestCombo >= 5 },
  { id: "solve_100", name: "백문백답", desc: "문제 100개를 풀었어요", emoji: "💯", check: (s) => s.player.solved >= 100 },
  { id: "place_500", name: "건설왕", desc: "블록 500개를 설치했어요", emoji: "🏗️", check: (s) => s.world.placedTotal >= 500 },
  { id: "coins_1000", name: "황금 건축가", desc: "코인 1000개를 모았어요", emoji: "💰", check: (s) => s.player.totalEarned >= 1000 },
  { id: "architect", name: "공간 설계자", desc: "레벨 8에 도달했어요", emoji: "📐", check: (s) => s.player.level >= 8 },
  { id: "master", name: "입체도형 마스터", desc: "레벨 12에 도달했어요", emoji: "👑", check: (s) => s.player.level >= 12 },
];
const ACH_REWARD = 20;

function runAchievementChecks() {
  const s = store.get();
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && a.check(s)) unlocked.push(a);
  }
  if (unlocked.length) {
    store.set((cur) => ({
      achievements: { ...cur.achievements, ...Object.fromEntries(unlocked.map((a) => [a.id, true])) },
      player: { ...cur.player, coins: cur.player.coins + ACH_REWARD * unlocked.length, totalEarned: cur.player.totalEarned + ACH_REWARD * unlocked.length },
    }));
  }
  return unlocked;
}

/* ═══════════ 6. persistence ═══════════ */

async function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function writeSave(state) {
  const data = {
    version: 2, savedAt: Date.now(),
    player: state.player, world: state.world, inventory: state.inventory,
    quiz: state.quiz, settings: state.settings, achievements: state.achievements,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}
async function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }

function applySaveData(data) {
  undoStack = []; redoStack = [];
  const base = initialState();
  store.set({
    booted: true, screen: "village",
    player: { ...base.player, ...data.player },
    world: { ...base.world, ...data.world },
    inventory: { ...base.inventory, ...data.inventory, owned: { ...data.inventory?.owned } },
    quiz: { ...base.quiz, ...data.quiz },
    settings: { ...base.settings, ...data.settings },
    achievements: { ...data.achievements },
  });
}

function useAutoSave(onSaved) {
  useEffect(() => {
    let timer = null;
    const unsub = store.subscribe((s) => {
      if (!s.booted || s.screen === "menu") return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const ok = await writeSave(store.get());
        if (ok) onSaved?.();
      }, 1500);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, [onSaved]);
}

/* ═══════════ 7. audio (Web Audio 합성) ═══════════ */

const audio = {
  ctx: null, master: null, musicGain: null, musicTimer: null, musicBeat: 0,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return true;
  },
  tone(freq, dur, { type = "sine", vol = 0.25, glide = null, delay = 0, dest = null } = {}) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(dest || this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  },
  play(name) {
    if (!store.get().settings.sound) return;
    switch (name) {
      case "click":   this.tone(620, 0.06, { vol: 0.12 }); break;
      case "place":   this.tone(420, 0.1, { type: "triangle", glide: 250, vol: 0.3 }); break;
      case "remove":  this.tone(220, 0.12, { type: "triangle", glide: 120, vol: 0.25 }); break;
      case "deny":    this.tone(160, 0.15, { type: "square", vol: 0.06 }); break;
      case "coin":    this.tone(900, 0.07, { vol: 0.18 }); this.tone(1350, 0.09, { vol: 0.18, delay: 0.06 }); break;
      case "correct": this.tone(659, 0.12, { vol: 0.22 }); this.tone(988, 0.18, { vol: 0.22, delay: 0.1 }); break;
      case "wrong":   this.tone(196, 0.25, { type: "triangle", vol: 0.15 }); this.tone(147, 0.3, { type: "triangle", vol: 0.12, delay: 0.12 }); break;
      case "level":   [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { vol: 0.2, delay: i * 0.09 })); break;
      case "achieve": [784, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, { vol: 0.18, delay: i * 0.08 })); break;
      case "open":    this.tone(500, 0.08, { glide: 760, vol: 0.12 }); break;
      default: break;
    }
  },
  startMusic() {
    if (this.musicTimer || !this.ensure()) return;
    const scale = [262, 294, 330, 392, 440, 523, 587, 659]; // C 펜타토닉 느낌
    this.musicTimer = setInterval(() => {
      if (!store.get().settings.music) return;
      const beat = this.musicBeat++;
      if (beat % 4 === 0) this.tone(131, 1.4, { type: "triangle", vol: 0.5, dest: this.musicGain });
      if (Math.random() < 0.65) {
        const f = scale[Math.floor(Math.random() * scale.length)];
        this.tone(f, 1.1, { type: "triangle", vol: 0.55, dest: this.musicGain });
        if (Math.random() < 0.25) this.tone(f * 1.5, 0.9, { type: "sine", vol: 0.3, delay: 0.18, dest: this.musicGain });
      }
    }, 620);
  },
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  },
};

/* ═══════════ 8·9. three — 지오메트리 & 월드 ═══════════ */

// 모서리가 둥근 박스 (정점 라운딩 기법)
function roundedBoxGeo(w, h, d, r) {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(
      THREE.MathUtils.clamp(v.x, -hw, hw),
      THREE.MathUtils.clamp(v.y, -hh, hh),
      THREE.MathUtils.clamp(v.z, -hd, hd)
    );
    const diff = v.clone().sub(c);
    if (diff.lengthSq() > 1e-9) v.copy(c.clone().add(diff.setLength(r)));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const GEO = {};
function getGeos() {
  if (!GEO.cube) {
    GEO.cube = roundedBoxGeo(0.98, 0.98, 0.98, 0.09);
    GEO.slab = roundedBoxGeo(0.98, 0.42, 0.98, 0.07);
    const shape = new THREE.Shape();
    shape.moveTo(-0.56, 0); shape.lineTo(0.56, 0); shape.lineTo(0, 0.66); shape.closePath();
    GEO.roof = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false });
    GEO.roof.translate(0, 0.0, -0.5);
    GEO.roof.computeVertexNormals();
  }
  return GEO;
}

function matFor(id) {
  const b = BLOCKS[id];
  const m = new THREE.MeshLambertMaterial({ color: b.color });
  if (b.glassy) { m.transparent = true; m.opacity = 0.55; }
  if (b.light) { m.emissive = new THREE.Color(b.color); m.emissiveIntensity = 0.5; }
  return m;
}

// ── 장식 모델 팩토리 ──
function dM(color, emissive) {
  const m = new THREE.MeshLambertMaterial({ color });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.6; }
  return m;
}
function dMesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const me = new THREE.Mesh(geo, mat);
  me.position.set(x, y, z);
  me.rotation.set(rx, ry, rz);
  me.castShadow = true;
  me.receiveShadow = true;
  return me;
}

function buildDeco(id, glowMats, animated) {
  const g = new THREE.Group();
  const add = (m) => g.add(m);
  const cyl = (r1, r2, h, seg = 7) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const sph = (r, s = 8) => new THREE.SphereGeometry(r, s, Math.max(5, s - 2));
  const box = (w, h, d) => roundedBoxGeo(w, h, d, Math.min(w, h, d) * 0.18);
  const cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);

  switch (id) {
    case "fence": {
      const wood = dM("#B98B55");
      add(dMesh(box(0.12, 0.95, 0.12), wood, -0.38, 0.47, 0));
      add(dMesh(box(0.12, 0.95, 0.12), wood, 0.38, 0.47, 0));
      add(dMesh(box(0.95, 0.1, 0.09), wood, 0, 0.72, 0));
      add(dMesh(box(0.95, 0.1, 0.09), wood, 0, 0.38, 0));
      break;
    }
    case "lamp": {
      add(dMesh(cyl(0.06, 0.09, 1.5), dM("#5A5F6B"), 0, 0.75, 0));
      const head = dM("#FFE9A8", "#FFD66B");
      add(dMesh(box(0.3, 0.3, 0.3), head, 0, 1.6, 0));
      add(dMesh(cone(0.24, 0.18, 4), dM("#5A5F6B"), 0, 1.84, 0, 0, Math.PI / 4, 0));
      glowMats.push(head);
      break;
    }
    case "lantern": {
      add(dMesh(cyl(0.045, 0.045, 0.55), dM("#7A5230"), 0, 0.27, 0));
      const head = dM("#FFD66B", "#FFC83D");
      add(dMesh(box(0.24, 0.28, 0.24), head, 0, 0.62, 0));
      glowMats.push(head);
      break;
    }
    case "flower": {
      add(dMesh(cyl(0.03, 0.03, 0.4), dM("#5FA653"), 0, 0.2, 0));
      add(dMesh(sph(0.13), dM(Math.random() < 0.5 ? "#F38BA0" : "#E2574C"), 0, 0.45, 0));
      add(dMesh(sph(0.07), dM("#FFD66B"), 0, 0.52, 0));
      add(dMesh(box(0.16, 0.03, 0.08), dM("#5FA653"), 0.08, 0.22, 0, 0, 0, 0.5));
      break;
    }
    case "tulip": {
      add(dMesh(cyl(0.03, 0.03, 0.42), dM("#5FA653"), 0, 0.21, 0));
      add(dMesh(cone(0.12, 0.22, 6), dM("#F2B33D"), 0, 0.5, 0, Math.PI, 0, 0));
      break;
    }
    case "bush": {
      add(dMesh(sph(0.32), dM("#79B85F"), -0.12, 0.26, 0.05));
      add(dMesh(sph(0.26), dM("#6FAE52"), 0.18, 0.22, -0.08));
      add(dMesh(sph(0.2), dM("#86C46B"), 0.02, 0.4, 0.12));
      break;
    }
    case "tree_s": {
      add(dMesh(cyl(0.09, 0.12, 0.5), dM("#8A5A33"), 0, 0.25, 0));
      add(dMesh(cone(0.42, 0.8, 7), dM("#5FA653"), 0, 0.85, 0));
      break;
    }
    case "tree_l": {
      add(dMesh(cyl(0.13, 0.17, 0.8), dM("#7A4E2A"), 0, 0.4, 0));
      add(dMesh(cone(0.55, 0.9, 7), dM("#3F8C46"), 0, 1.1, 0));
      add(dMesh(cone(0.4, 0.7, 7), dM("#4E9C52"), 0, 1.6, 0));
      break;
    }
    case "bench": {
      const wood = dM("#C08A52");
      add(dMesh(box(0.9, 0.08, 0.34), wood, 0, 0.34, 0));
      add(dMesh(box(0.9, 0.3, 0.07), wood, 0, 0.56, -0.15));
      add(dMesh(box(0.08, 0.34, 0.3), dM("#8A6238"), -0.36, 0.17, 0));
      add(dMesh(box(0.08, 0.34, 0.3), dM("#8A6238"), 0.36, 0.17, 0));
      break;
    }
    case "mailbox": {
      add(dMesh(cyl(0.05, 0.05, 0.6), dM("#8A6238"), 0, 0.3, 0));
      add(dMesh(box(0.34, 0.24, 0.24), dM("#E2574C"), 0, 0.7, 0));
      add(dMesh(box(0.04, 0.16, 0.1), dM("#FFD66B"), 0.19, 0.82, 0));
      break;
    }
    case "pond": {
      add(dMesh(cyl(0.46, 0.5, 0.1, 12), dM("#9aa3a8"), 0, 0.05, 0));
      const water = new THREE.MeshLambertMaterial({ color: "#7FC4E8", transparent: true, opacity: 0.8 });
      add(dMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), water, 0, 0.09, 0));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(dMesh(sph(0.09, 6), dM("#B5B0A8"), Math.cos(a) * 0.46, 0.1, Math.sin(a) * 0.46));
      }
      break;
    }
    case "balloon": {
      add(dMesh(cyl(0.015, 0.015, 0.9), dM("#9aa3a8"), 0, 0.45, 0));
      const b = dMesh(sph(0.26, 10), dM(pick(["#F2789F", "#7FC4E8", "#FFD66B", "#A8E0CE"])), 0, 1.05, 0);
      add(b);
      animated.push({ mesh: b, baseY: 1.05, kind: "bob", phase: Math.random() * 6 });
      break;
    }
    case "fountain": {
      add(dMesh(cyl(0.48, 0.52, 0.18, 12), dM("#C9CDD4"), 0, 0.09, 0));
      const water = new THREE.MeshLambertMaterial({ color: "#7FC4E8", transparent: true, opacity: 0.75 });
      add(dMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 12), water, 0, 0.16, 0));
      add(dMesh(cyl(0.07, 0.1, 0.5), dM("#C9CDD4"), 0, 0.4, 0));
      add(dMesh(cyl(0.22, 0.26, 0.07, 10), dM("#C9CDD4"), 0, 0.66, 0));
      const jet = dMesh(cone(0.1, 0.36, 6), water, 0, 0.86, 0);
      add(jet);
      animated.push({ mesh: jet, baseY: 0.86, kind: "fountain", phase: Math.random() * 6 });
      break;
    }
    case "playground": {
      add(dMesh(box(0.12, 0.9, 0.12), dM("#E2574C"), -0.35, 0.45, -0.3));
      add(dMesh(box(0.12, 0.9, 0.12), dM("#E2574C"), -0.1, 0.45, -0.3));
      add(dMesh(box(0.42, 0.1, 0.4), dM("#F2A33D"), -0.22, 0.88, -0.28));
      add(dMesh(box(0.8, 0.06, 0.34), dM("#7FC4E8"), 0.16, 0.55, -0.05, 0, 0.5, -0.55));
      for (let i = 0; i < 3; i++) add(dMesh(box(0.3, 0.05, 0.1), dM("#C99A5B"), -0.42, 0.2 + i * 0.25, -0.05 - i * 0.08));
      break;
    }
    case "garden": {
      add(dMesh(box(0.95, 0.16, 0.95), dM("#8A6B3F"), 0, 0.08, 0));
      for (let r = -1; r <= 1; r++)
        for (let cc = -1; cc <= 1; cc++)
          add(dMesh(sph(0.08, 6), dM(pick(["#5FA653", "#86C46B", "#F2B33D"])), r * 0.27, 0.2, cc * 0.27));
      break;
    }
    case "flag": {
      add(dMesh(cyl(0.035, 0.035, 1.5), dM("#9aa3a8"), 0, 0.75, 0));
      const f = dMesh(box(0.5, 0.3, 0.04), dM("#5BC4A0"), 0.28, 1.32, 0);
      add(f);
      animated.push({ mesh: f, kind: "flag", phase: Math.random() * 6 });
      break;
    }
    default: {
      add(dMesh(box(0.6, 0.6, 0.6), dM(BLOCKS[id]?.color || "#ccc"), 0, 0.3, 0));
    }
  }
  return g;
}

/* ── GameWorld: 씬 전체 관리 ── */
class GameWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#9ED6FF");
    this.scene.fog = new THREE.Fog("#9ED6FF", 70, 170);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    this.target = new THREE.Vector3(0, 1, 0);
    this.theta = 0.7; this.phi = 0.95; this.radius = 24;
    this.updateCamera();

    // 조명
    this.hemi = new THREE.HemisphereLight("#cfe8ff", "#9fce6e", 0.6);
    this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight("#ffffff", 0.25);
    this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight("#fff4d6", 1.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // 지면
    const groundMat = new THREE.MeshLambertMaterial({ color: "#8FCB6B" });
    this.ground = new THREE.Mesh(new THREE.CylinderGeometry(64, 64, 0.8, 36), groundMat);
    this.ground.position.y = -0.4;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    const plate = new THREE.Mesh(
      roundedBoxGeo(WORLD_R * 2 + 0.6, 0.24, WORLD_R * 2 + 0.6, 0.1),
      new THREE.MeshLambertMaterial({ color: "#9BD479" })
    );
    plate.position.y = 0.0; plate.receiveShadow = true;
    this.scene.add(plate);
    const grid = new THREE.GridHelper(WORLD_R * 2, WORLD_R * 2, 0xffffff, 0xffffff);
    grid.material.transparent = true; grid.material.opacity = 0.14;
    grid.position.y = 0.13;
    this.scene.add(grid);

    // 해 & 달
    this.sunBall = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10), new THREE.MeshBasicMaterial({ color: "#FFE08A" }));
    this.moonBall = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), new THREE.MeshBasicMaterial({ color: "#E8EEF7" }));
    this.scene.add(this.sunBall, this.moonBall);

    // 구름
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Group();
      const s = 0.8 + Math.random() * 1.4;
      c.add(dMesh(new THREE.SphereGeometry(1.6 * s, 8, 6), cloudMat, 0, 0, 0));
      c.add(dMesh(new THREE.SphereGeometry(1.1 * s, 8, 6), cloudMat, 1.6 * s, -0.1, 0.3));
      c.add(dMesh(new THREE.SphereGeometry(1.0 * s, 8, 6), cloudMat, -1.5 * s, -0.2, -0.2));
      c.children.forEach((m) => { m.castShadow = false; m.receiveShadow = false; });
      c.position.set(-70 + Math.random() * 140, 16 + Math.random() * 8, -30 + Math.random() * 60);
      c.userData.speed = 0.6 + Math.random() * 0.9;
      this.scene.add(c);
      this.clouds.push(c);
    }

    // 새
    this.birds = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      const wmat = new THREE.MeshBasicMaterial({ color: "#4a4f5c", side: THREE.DoubleSide });
      const wgeo = new THREE.PlaneGeometry(0.55, 0.22);
      const w1 = new THREE.Mesh(wgeo, wmat); w1.position.x = -0.26;
      const w2 = new THREE.Mesh(wgeo, wmat); w2.position.x = 0.26;
      b.add(w1, w2);
      b.userData = { r: 20 + i * 5, h: 10 + i * 1.6, speed: 0.25 + i * 0.06, off: i * 2.1, w1, w2 };
      this.scene.add(b);
      this.birds.push(b);
    }

    // 잔디 (흔들림)
    this.grassDummy = new THREE.Object3D();
    const gGeo = new THREE.PlaneGeometry(0.3, 0.4);
    gGeo.translate(0, 0.2, 0);
    const gMat = new THREE.MeshLambertMaterial({ color: "#6FB44E", side: THREE.DoubleSide });
    this.grassMesh = new THREE.InstancedMesh(gGeo, gMat, 150);
    this.grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grassMesh.frustumCulled = false;
    this.grassData = [];
    for (let i = 0; i < 150; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 30;
      this.grassData.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: Math.random() * Math.PI, phase: Math.random() * 6 });
    }
    this.scene.add(this.grassMesh);

    // 블록 렌더링 상태
    this.inst = {};            // type -> {mesh, keys[]}
    this.blockMap = {};        // key -> {type, index} (instanced)
    this.decoMap = {};         // key -> Group
    this.decoRoot = new THREE.Group();
    this.scene.add(this.decoRoot);
    this.glowMats = [];
    this.animatedDecos = [];

    // 고스트 & 채우기 마커
    this.ghost = new THREE.Mesh(
      getGeos().cube,
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.4, depthWrite: false })
    );
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.2, 1.6, 8),
      new THREE.MeshBasicMaterial({ color: "#FF9B7B", transparent: true, opacity: 0.85 })
    );
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.raycaster = new THREE.Raycaster();
    this.clockT = 0;
    this.dayT = 0.18; // 아침부터 시작
    this._raf = null;
    this._last = performance.now();
    this.running = false;
  }

  updateCamera() {
    this.phi = THREE.MathUtils.clamp(this.phi, 0.18, 1.42);
    this.radius = THREE.MathUtils.clamp(this.radius, 7, 60);
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    this.camera.position.set(
      this.target.x + this.radius * sp * Math.sin(this.theta),
      this.target.y + this.radius * cp,
      this.target.z + this.radius * sp * Math.cos(this.theta)
    );
    this.camera.lookAt(this.target);
  }

  panTarget(dx, dz) {
    const forward = new THREE.Vector3(Math.sin(this.theta), 0, Math.cos(this.theta));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    this.target.addScaledVector(right, dx).addScaledVector(forward, dz);
    const lim = WORLD_R + 8;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -lim, lim);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -lim, lim);
    this.updateCamera();
  }

  getInst(type) {
    if (!this.inst[type]) {
      const b = BLOCKS[type];
      const geo = b.kind === "slab" ? getGeos().slab : b.kind === "roof" ? getGeos().roof : getGeos().cube;
      const cap = b.kind === "cube" ? 900 : 400;
      const mesh = new THREE.InstancedMesh(geo, matFor(type), cap);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.btype = type;
      if (b.light) this.glowMats.push(mesh.material);
      this.scene.add(mesh);
      this.inst[type] = { mesh, keys: [], cap };
    }
    return this.inst[type];
  }

  blockMatrix(type, x, y, z) {
    const b = BLOCKS[type];
    const m = new THREE.Matrix4();
    if (b.kind === "slab") m.setPosition(x + 0.5, y + 0.21, z + 0.5);
    else if (b.kind === "roof") m.setPosition(x + 0.5, y + 0.0, z + 0.5);
    else m.setPosition(x + 0.5, y + 0.5, z + 0.5);
    return m;
  }

  addBlockMesh(key, type) {
    const [x, y, z] = parseKey(key);
    if (BLOCKS[type].kind === "deco") {
      const g = buildDeco(type, this.glowMats, this.animatedDecos);
      g.position.set(x + 0.5, y, z + 0.5);
      g.rotation.y = ((x * 7 + z * 13) % 4) * (Math.PI / 2) * 0; // 고정 방향
      g.userData.key = key;
      g.traverse((m) => { m.userData.key = key; });
      this.decoRoot.add(g);
      this.decoMap[key] = g;
      return;
    }
    const rec = this.getInst(type);
    if (rec.keys.length >= rec.cap) return;
    const i = rec.keys.length;
    rec.mesh.setMatrixAt(i, this.blockMatrix(type, x, y, z));
    rec.keys.push(key);
    rec.mesh.count = i + 1;
    rec.mesh.instanceMatrix.needsUpdate = true;
    this.blockMap[key] = { type, index: i };
  }

  removeBlockMesh(key) {
    if (this.decoMap[key]) {
      const g = this.decoMap[key];
      this.animatedDecos = this.animatedDecos.filter((a) => !g.children.includes(a.mesh));
      this.decoRoot.remove(g);
      delete this.decoMap[key];
      return;
    }
    const info = this.blockMap[key];
    if (!info) return;
    const rec = this.inst[info.type];
    const last = rec.keys.length - 1;
    if (info.index !== last) {
      const tmp = new THREE.Matrix4();
      rec.mesh.getMatrixAt(last, tmp);
      rec.mesh.setMatrixAt(info.index, tmp);
      const movedKey = rec.keys[last];
      rec.keys[info.index] = movedKey;
      this.blockMap[movedKey] = { type: info.type, index: info.index };
    }
    rec.keys.pop();
    rec.mesh.count = rec.keys.length;
    rec.mesh.instanceMatrix.needsUpdate = true;
    delete this.blockMap[key];
  }

  clearAllBlocks() {
    for (const t in this.inst) { this.inst[t].keys = []; this.inst[t].mesh.count = 0; }
    for (const k in this.decoMap) this.decoRoot.remove(this.decoMap[k]);
    this.decoMap = {}; this.blockMap = {}; this.animatedDecos = [];
  }

  syncBlocks(blocks) {
    this.clearAllBlocks();
    for (const k in blocks) this.addBlockMesh(k, blocks[k]);
  }

  setGhost(key, valid) {
    if (!key) { this.ghost.visible = false; return; }
    const [x, y, z] = parseKey(key);
    this.ghost.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.ghost.material.color.set(valid ? "#ffffff" : "#ff6b5c");
    this.ghost.material.opacity = valid ? 0.42 : 0.5;
    this.ghost.visible = true;
  }

  setMarker(key) {
    if (!key) { this.marker.visible = false; return; }
    const [x, y, z] = parseKey(key);
    this.marker.position.set(x + 0.5, y + 0.8, z + 0.5);
    this.marker.visible = true;
  }

  raycastAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const objs = [this.ground];
    for (const t in this.inst) objs.push(this.inst[t].mesh);
    objs.push(this.decoRoot);
    const hits = this.raycaster.intersectObjects(objs, true);
    if (!hits.length) return { placeKey: null, removeKey: null };
    const h = hits[0];

    if (h.object === this.ground) {
      const x = Math.floor(h.point.x), z = Math.floor(h.point.z);
      return { placeKey: keyOf(x, 0, z), removeKey: null };
    }
    // 인스턴스 블록
    if (h.object.userData.btype !== undefined && h.instanceId !== undefined) {
      const rec = this.inst[h.object.userData.btype];
      const key = rec.keys[h.instanceId];
      if (!key) return { placeKey: null, removeKey: null };
      const [x, y, z] = parseKey(key);
      let n = h.face ? h.face.normal : new THREE.Vector3(0, 1, 0);
      const nx = Math.abs(n.x) > 0.5 ? Math.sign(n.x) : 0;
      const ny = Math.abs(n.y) > 0.5 ? Math.sign(n.y) : 0;
      const nz = Math.abs(n.z) > 0.5 ? Math.sign(n.z) : 0;
      const sum = Math.abs(nx) + Math.abs(ny) + Math.abs(nz);
      const px = x + (sum === 1 ? nx : 0), py = y + (sum === 1 ? ny : ny || 1), pz = z + (sum === 1 ? nz : 0);
      return { placeKey: keyOf(px, sum === 1 ? py : y + 1, pz), removeKey: key };
    }
    // 장식
    let o = h.object;
    while (o && !o.userData.key) o = o.parent;
    if (o && o.userData.key) {
      const key = o.userData.key;
      const [x, y, z] = parseKey(key);
      return { placeKey: keyOf(x, y + 1, z), removeKey: key };
    }
    return { placeKey: null, removeKey: null };
  }

  resize(w, hgt) {
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
  }

  tick(dt) {
    this.clockT += dt;
    this.dayT = (this.dayT + dt / 180) % 1; // 한 사이클 180초
    const ang = this.dayT * Math.PI * 2;
    const s = Math.sin(ang);
    const dayAmt = THREE.MathUtils.smoothstep(s, -0.18, 0.3);

    // 하늘색
    const cNight = new THREE.Color("#2A3560");
    const cDay = new THREE.Color("#9ED6FF");
    const cDawn = new THREE.Color("#FFC59A");
    const sky = cNight.clone().lerp(cDay, dayAmt);
    sky.lerp(cDawn, Math.max(0, 1 - Math.abs(s) / 0.32) * 0.55);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);

    // 태양/달
    const R = 90;
    this.sun.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 28);
    this.sun.intensity = 0.18 + dayAmt * 0.95;
    this.sunBall.position.set(Math.cos(ang) * 120, Math.sin(ang) * 120, -60);
    this.moonBall.position.set(-Math.cos(ang) * 120, -Math.sin(ang) * 120, -60);
    this.hemi.intensity = 0.22 + dayAmt * 0.45;
    this.amb.intensity = 0.16 + dayAmt * 0.14;
    const glow = 0.45 + (1 - dayAmt) * 1.3;
    for (const m of this.glowMats) if (m) m.emissiveIntensity = glow;

    // 구름
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 80) c.position.x = -80;
    }
    // 새
    for (const b of this.birds) {
      const u = b.userData;
      const a = this.clockT * u.speed + u.off;
      b.position.set(Math.cos(a) * u.r, u.h + Math.sin(a * 2.3) * 0.8, Math.sin(a) * u.r);
      b.rotation.y = -a - Math.PI / 2;
      const flap = Math.sin(this.clockT * 11 + u.off) * 0.65;
      u.w1.rotation.y = flap; u.w2.rotation.y = -flap;
    }
    // 잔디 흔들림
    for (let i = 0; i < this.grassData.length; i++) {
      const g = this.grassData[i];
      this.grassDummy.position.set(g.x, 0.13, g.z);
      this.grassDummy.rotation.set(0, g.yaw, Math.sin(this.clockT * 1.8 + g.phase) * 0.14);
      this.grassDummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, this.grassDummy.matrix);
    }
    this.grassMesh.instanceMatrix.needsUpdate = true;
    // 장식 애니메이션
    for (const a of this.animatedDecos) {
      if (a.kind === "bob") a.mesh.position.y = a.baseY + Math.sin(this.clockT * 1.6 + a.phase) * 0.08;
      else if (a.kind === "flag") a.mesh.rotation.y = Math.sin(this.clockT * 2.2 + a.phase) * 0.3;
      else if (a.kind === "fountain") {
        const sc = 0.85 + Math.sin(this.clockT * 3 + a.phase) * 0.18;
        a.mesh.scale.set(1, sc, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this.tick(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; if (this._raf) cancelAnimationFrame(this._raf); }
  dispose() { this.stop(); this.renderer.dispose(); }
}

/* ═══════════ 10. ui — 공통 ═══════════ */

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap');
    .mc-root { font-family: 'Gowun Dodum', sans-serif; color: #5B4636; }
    .mc-display { font-family: 'Jua', sans-serif; }
    .glass {
      background: rgba(255,255,255,0.55);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1.5px solid rgba(255,255,255,0.7);
      box-shadow: 0 8px 32px rgba(91,70,54,0.13);
    }
    .glass-dark { background: rgba(91,70,54,0.45); backdrop-filter: blur(10px); border: 1.5px solid rgba(255,255,255,0.25); color: #fff; }
    .btn-chunky {
      font-family: 'Jua', sans-serif;
      transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
      box-shadow: 0 5px 0 rgba(0,0,0,0.14), 0 10px 20px rgba(91,70,54,0.15);
    }
    .btn-chunky:hover { transform: translateY(-2px); filter: brightness(1.05); }
    .btn-chunky:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,0.14); }
    .btn-flat { transition: transform .1s ease, background .15s ease; }
    .btn-flat:active { transform: scale(0.94); }
    @keyframes drift  { from { transform: translateX(-15vw); } to { transform: translateX(115vw); } }
    @keyframes bob    { 0%,100% { transform: translateY(0) rotate(-2deg);} 50% { transform: translateY(-14px) rotate(2deg);} }
    @keyframes pop-in { 0% { transform: translateY(30px) scale(.6); opacity: 0; }
                        70% { transform: translateY(-6px) scale(1.06); opacity: 1; }
                        100% { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes fade-up { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes sway   { 0%,100% { transform: rotate(-3deg);} 50% { transform: rotate(3deg);} }
    @keyframes toast  { 0% { transform: translateY(16px); opacity: 0;} 12% { transform: translateY(0); opacity: 1;}
                        85% { transform: translateY(0); opacity: 1;} 100% { transform: translateY(8px); opacity: 0;} }
    @keyframes shake  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-9px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(4px)} }
    @keyframes coinfly{ 0%{transform:translateY(0) scale(.7); opacity:0} 15%{opacity:1; transform:translateY(-8px) scale(1.15)} 100%{transform:translateY(-70px) scale(1); opacity:0} }
    @keyframes banner { 0%{transform:translateY(-60px); opacity:0} 12%{transform:translateY(0); opacity:1} 88%{transform:translateY(0); opacity:1} 100%{transform:translateY(-60px); opacity:0} }
    @keyframes pulse-glow { 0%,100%{box-shadow:0 5px 0 rgba(0,0,0,.14), 0 0 0 0 rgba(255,155,123,.5)} 50%{box-shadow:0 5px 0 rgba(0,0,0,.14), 0 0 0 12px rgba(255,155,123,0)} }
    @keyframes confetti { 0%{transform:translateY(-10px) rotate(0); opacity:1} 100%{transform:translateY(120px) rotate(540deg); opacity:0} }
    .anim-pop { animation: pop-in .6s cubic-bezier(.2,1.4,.4,1) both; }
    .anim-fadeup { animation: fade-up .5s ease both; }
    .anim-shake { animation: shake .45s ease both; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { scrollbar-width: none; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
    }
  `}</style>
);

// 색약 모드 대응 팔레트
function feedbackColors(colorBlind) {
  return colorBlind
    ? { good: "#2E7DD1", goodBg: "#D9EAFB", bad: "#D17A1F", badBg: "#FBE8D2", pieA: "#2E7DD1", pieB: "#D17A1F" }
    : { good: "#4CAF50", goodBg: "#DFF3DB", bad: "#E2574C", badBg: "#FBE0DC", pieA: "#FF9B7B", pieB: "#7FC4E8" };
}

function FractionPie({ num, den, size = 56, color = "#FF9B7B" }) {
  const r = size / 2 - 3;
  const cx = size / 2, cy = size / 2;
  if (den === 1) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill={num >= 1 ? color : "rgba(255,255,255,0.85)"} stroke="#5B4636" strokeWidth="1.6" />
      </svg>
    );
  }
  const slices = [];
  for (let i = 0; i < den; i++) {
    const a0 = (i / den) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / den) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    slices.push(
      <path key={i}
        d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${1 / den > 0.5 ? 1 : 0} 1 ${x1},${y1} Z`}
        fill={i < num ? color : "rgba(255,255,255,0.85)"}
        stroke="#5B4636" strokeWidth="1.6" strokeLinejoin="round" />
    );
  }
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{slices}</svg>;
}

// 대분수 시각화: 자연수만큼 꽉 찬 파이 + 부분 파이
function FracVisual({ fr, color, size = 52 }) {
  if (!fr) return null;
  const wholes = Math.min(fr.w, 3);
  const pies = [];
  for (let i = 0; i < wholes; i++) pies.push(<FractionPie key={`w${i}`} num={fr.d} den={fr.d} size={size} color={color} />);
  if (fr.n > 0) pies.push(<FractionPie key="p" num={fr.n} den={fr.d} size={size} color={color} />);
  if (fr.w > 3) pies.splice(0, 0, <span key="more" className="mc-display text-lg self-center">…</span>);
  return <div className="flex gap-1 items-center justify-center flex-wrap">{pies}</div>;
}

// "W N/D" 문자열을 세로 분수로 렌더링
function Frac({ str, big }) {
  if (str === "<" || str === ">" || str === "=") return <span className="mc-display" style={{ fontSize: big ? 30 : 18 }}>{str}</span>;
  const parts = String(str).trim().split(" ");
  let whole = null, frac = null;
  if (parts.length === 2) { whole = parts[0]; frac = parts[1]; }
  else if (parts[0].includes("/")) frac = parts[0];
  else whole = parts[0];
  const fs = big ? { num: 22, den: 22, whole: 34, w: 30 } : { num: 15, den: 15, whole: 22, w: 22 };
  return (
    <span className="inline-flex items-center gap-1 align-middle mc-display">
      {whole && <span style={{ fontSize: fs.whole }}>{whole}</span>}
      {frac && (
        <span className="inline-flex flex-col items-center leading-none" style={{ minWidth: fs.w }}>
          <span style={{ fontSize: fs.num, paddingBottom: 2 }}>{frac.split("/")[0]}</span>
          <span style={{ width: "100%", height: 2, background: "#5B4636", borderRadius: 2 }} />
          <span style={{ fontSize: fs.den, paddingTop: 2 }}>{frac.split("/")[1]}</span>
        </span>
      )}
    </span>
  );
}

function PromptText({ parts, big }) {
  return (
    <span>
      {parts.map((p, i) => {
        if (typeof p !== "string") return <Frac key={i} str={p.fr} big={big} />;
        return p.split('\n').map((line, j, arr) => (
          <React.Fragment key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </React.Fragment>
        ));
      })}
    </span>
  );
}

function Modal({ children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: "rgba(91,70,54,0.35)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div className={`glass rounded-3xl p-5 w-full anim-pop max-h-full overflow-y-auto no-scrollbar ${wide ? "max-w-xl" : "max-w-sm"}`}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Toggle({ label, emoji, value, onChange }) {
  return (
    <button onClick={onChange}
      className="btn-flat flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-white bg-opacity-60 hover:bg-opacity-90">
      <span className="text-lg">{emoji} {label}</span>
      <span className="relative inline-block" style={{ width: 52, height: 28 }}>
        <span className="absolute inset-0 rounded-full transition-colors" style={{ background: value ? "#8FCB6B" : "#D8D2C6" }} />
        <span className="absolute bg-white rounded-full shadow transition-all" style={{ width: 22, height: 22, top: 3, left: value ? 27 : 3 }} />
      </span>
    </button>
  );
}

function SettingsPanel({ onClose, onResetData }) {
  const settings = useStore((s) => s.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Modal onClose={onClose}>
      <h3 className="mc-display text-2xl mb-4 text-center">⚙ 설정</h3>
      <div className="flex flex-col gap-2">
        <Toggle label="효과음" emoji="🔔" value={settings.sound} onChange={() => { actions.toggleSetting("sound"); audio.play("click"); }} />
        <Toggle label="배경음악" emoji="🎵" value={settings.music} onChange={() => actions.toggleSetting("music")} />
        <Toggle label="글자 크게" emoji="🔍" value={settings.largeText} onChange={() => actions.toggleSetting("largeText")} />
        <Toggle label="색약 모드" emoji="🎨" value={settings.colorBlind} onChange={() => actions.toggleSetting("colorBlind")} />
      </div>
      <p className="text-sm text-center mt-4 opacity-70">💾 마을과 코인은 자동으로 저장돼요</p>
      {!confirmReset ? (
        <button className="w-full mt-3 py-2 rounded-full text-sm opacity-60 hover:opacity-100 underline"
          onClick={() => setConfirmReset(true)}>
          모든 데이터 지우기
        </button>
      ) : (
        <div className="mt-3 p-3 rounded-2xl text-center" style={{ background: "rgba(255,142,118,0.2)" }}>
          <p className="text-sm mb-2">정말 모두 지울까요? 되돌릴 수 없어요!</p>
          <div className="flex gap-2 justify-center">
            <button className="btn-chunky px-4 py-1.5 rounded-full text-sm text-white" style={{ background: "#FF8E76" }} onClick={onResetData}>지우기</button>
            <button className="btn-chunky px-4 py-1.5 rounded-full text-sm bg-white" onClick={() => setConfirmReset(false)}>취소</button>
          </div>
        </div>
      )}
      <button className="btn-chunky w-full mt-4 py-2.5 rounded-full text-lg" style={{ background: "linear-gradient(#FFD66B,#FFB85C)" }} onClick={onClose}>닫기</button>
    </Modal>
  );
}

/* ── 메인 메뉴 ── */
const LOGO_COLORS = ["#FF9B7B", "#FFD66B", "#8FCB6B", "#7FC4E8", "#C9A6E0", "#F38BA0", "#FFB85C", "#6FD0B5", "#9AB8F0"];

function BlockLetter({ ch, i }) {
  return (
    <span className="mc-display inline-flex items-center justify-center anim-pop"
      style={{
        width: "clamp(38px, 7vw, 66px)", height: "clamp(38px, 7vw, 66px)",
        margin: "0 3px", borderRadius: 14,
        background: LOGO_COLORS[i % LOGO_COLORS.length],
        color: "white", fontSize: "clamp(22px, 4.2vw, 40px)",
        boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.12), 0 6px 14px rgba(91,70,54,0.25)",
        transform: `rotate(${(i % 2 ? 1 : -1) * 3}deg)`,
        animationDelay: `${i * 0.07}s`,
        textShadow: "0 2px 0 rgba(0,0,0,0.15)",
      }}>
      {ch}
    </span>
  );
}

function Cloud2D({ top, scale, dur, delay }) {
  return (
    <div className="absolute" style={{ top, left: 0, animation: `drift ${dur}s linear ${delay}s infinite` }}>
      <div style={{ transform: `scale(${scale})`, opacity: 0.9 }}>
        <div className="relative" style={{ width: 120, height: 40 }}>
          <div className="absolute bg-white rounded-full" style={{ width: 70, height: 40, left: 25, top: -14 }} />
          <div className="absolute bg-white rounded-full" style={{ width: 120, height: 38, top: 2 }} />
        </div>
      </div>
    </div>
  );
}

function Balloon2D({ left, top, num, den, color, delay }) {
  return (
    <div className="absolute" style={{ left, top, animation: `bob 5s ease-in-out ${delay}s infinite` }}>
      <FractionPie num={num} den={den} color={color} size={58} />
      <div style={{ width: 2, height: 46, background: "#5B4636", opacity: 0.4, margin: "0 auto" }} />
    </div>
  );
}

function MenuScene() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "linear-gradient(#9ED6FF 0%, #C9E9FF 45%, #EAF7FF 70%)" }} />
      <div className="absolute rounded-full" style={{ width: 110, height: 110, right: "9%", top: "8%", background: "#FFE08A", boxShadow: "0 0 60px 28px rgba(255,224,138,0.55)", animation: "sway 7s ease-in-out infinite" }} />
      <Cloud2D top="10%" scale={1.1} dur={75} delay={-20} />
      <Cloud2D top="22%" scale={0.7} dur={95} delay={-60} />
      <Cloud2D top="5%" scale={0.5} dur={110} delay={-35} />
      <Balloon2D left="8%" top="30%" num={1} den={4} color="#FF9B7B" delay={0} />
      <Balloon2D left="84%" top="38%" num={2} den={3} color="#7FC4E8" delay={1.4} />
      <Balloon2D left="16%" top="58%" num={3} den={5} color="#C9A6E0" delay={0.7} />
      <div className="absolute rounded-t-full" style={{ width: "90%", height: "46%", left: "-25%", bottom: "-22%", background: "#A8D672" }} />
      <div className="absolute rounded-t-full" style={{ width: "95%", height: "40%", right: "-30%", bottom: "-20%", background: "#8FCB6B" }} />
      <div className="absolute" style={{ width: "100%", height: "9%", bottom: 0, background: "#7CBA58" }} />
      <div className="absolute" style={{ left: "12%", bottom: "16%", animation: "bob 6s ease-in-out 2s infinite" }}>
        <div style={{ width: 0, height: 0, borderLeft: "34px solid transparent", borderRight: "34px solid transparent", borderBottom: "26px solid #D95B4A", borderRadius: 6 }} />
        <div style={{ width: 56, height: 38, background: "#F4EFE6", margin: "0 auto", borderRadius: "0 0 8px 8px", boxShadow: "inset 0 -5px 0 rgba(0,0,0,0.07)" }}>
          <div style={{ width: 14, height: 18, background: "#C99A5B", margin: "12px auto 0", borderRadius: "4px 4px 0 0" }} />
        </div>
      </div>
      <div className="absolute" style={{ right: "13%", bottom: "11%", animation: "bob 6.5s ease-in-out .8s infinite" }}>
        <div style={{ width: 0, height: 0, borderLeft: "28px solid transparent", borderRight: "28px solid transparent", borderBottom: "22px solid #5B84C4", borderRadius: 6 }} />
        <div style={{ width: 46, height: 32, background: "#F7C8B0", margin: "0 auto", borderRadius: "0 0 8px 8px" }} />
      </div>
    </div>
  );
}

function MenuButton({ children, onClick, primary }) {
  const bg = primary ? "linear-gradient(#FFD66B, #FFB85C)" : "linear-gradient(#ffffff, #F3EDE2)";
  return (
    <button onClick={() => { audio.play("click"); onClick(); }} className="btn-chunky w-64 py-3 rounded-full text-xl"
      style={{ background: bg, color: "#5B4636", border: "2px solid rgba(255,255,255,0.8)" }}>
      {children}
    </button>
  );
}

function MainMenu({ savedMeta, onContinue, onNew, onSettings }) {
  const [confirmNew, setConfirmNew] = useState(false);
  const title = "MATH CRAFT";
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <MenuScene />
      <div className="relative z-10 flex flex-col items-center gap-3 px-4">
        <div className="flex flex-wrap justify-center mb-1">
          {title.split("").map((ch, i) => (ch === " " ? <span key={i} style={{ width: 16 }} /> : <BlockLetter key={i} ch={ch} i={i} />))}
        </div>
        <div className="mc-display anim-fadeup text-2xl mb-5 px-5 py-1 rounded-full glass" style={{ animationDelay: ".7s", color: "#7A5230" }}>
          🧮 {problemPack.title} 🏡
        </div>
        <div className="flex flex-col gap-3 items-center anim-fadeup" style={{ animationDelay: ".9s" }}>
          {savedMeta && (
            <MenuButton primary onClick={onContinue}>
              ▶ 이어하기 <span className="text-sm opacity-70">(Lv.{savedMeta.level} · {savedMeta.coins}코인)</span>
            </MenuButton>
          )}
          <MenuButton primary={!savedMeta} onClick={() => (savedMeta ? setConfirmNew(true) : onNew())}>✨ 새로 시작하기</MenuButton>
          <MenuButton onClick={onSettings}>⚙ 설정</MenuButton>
        </div>
        <div className="anim-fadeup mt-6 text-sm px-4 py-1.5 rounded-full glass" style={{ animationDelay: "1.1s" }}>
          💾 게임은 자동으로 저장돼요
        </div>
      </div>
      {confirmNew && (
        <Modal onClose={() => setConfirmNew(false)}>
          <div className="text-center">
            <div className="text-4xl mb-2">🏠💨</div>
            <h3 className="mc-display text-2xl mb-2">새로 시작할까요?</h3>
            <p className="mb-5 opacity-80">지금까지 만든 마을이 사라져요!</p>
            <div className="flex gap-3 justify-center">
              <button className="btn-chunky px-6 py-2.5 rounded-full text-white" style={{ background: "linear-gradient(#FFB3A3,#FF8E76)" }}
                onClick={async () => { await clearSave(); setConfirmNew(false); onNew(); }}>
                네, 새로 시작!
              </button>
              <button className="btn-chunky px-6 py-2.5 rounded-full bg-white" onClick={() => setConfirmNew(false)}>아니요</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── HUD / 핫바 / 인벤토리 / 상점 / 업적 ── */

function Hud({ onMenu, onSettings, onAchievements }) {
  const player = useStore((s) => s.player);
  const blocks = useStore((s) => s.world.blocks);
  const value = useMemo(() => villageValue(blocks), [blocks]);
  const title = titleForLevel(player.level);
  const need = xpForLevel(player.level);
  const pct = Math.min(100, Math.round((player.xp / need) * 100));
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between p-2 sm:p-3 gap-2 pointer-events-none">
      <div className="flex gap-1.5 sm:gap-2 flex-wrap pointer-events-auto">
        <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center rounded-full mc-display text-sm"
            style={{ width: 24, height: 24, background: "linear-gradient(#FFE08A,#F2B33D)", color: "#8a6516", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.15)" }}>₩</span>
          <span className="mc-display text-lg">{player.coins}</span>
        </div>
        <div className="glass rounded-full px-3 py-1.5 flex items-center gap-2">
          <span className="mc-display text-sm">Lv.{player.level}</span>
          <span className="relative rounded-full overflow-hidden" style={{ width: 70, height: 9, background: "rgba(91,70,54,0.15)" }}>
            <span className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#8FCB6B,#B6E08A)" }} />
          </span>
        </div>
        <div className="glass rounded-full px-3 py-1.5 mc-display text-sm hidden sm:block">{title.emoji} {title.name}</div>
        <div className="glass rounded-full px-3 py-1.5 mc-display text-sm">🏘️ {value}</div>
      </div>
      <div className="flex gap-1.5 sm:gap-2 pointer-events-auto">
        <button className="btn-chunky glass rounded-full w-10 h-10 text-lg" onClick={onAchievements} aria-label="업적">🏆</button>
        <button className="btn-chunky glass rounded-full w-10 h-10 text-lg" onClick={onSettings} aria-label="설정">⚙</button>
        <button className="btn-chunky glass rounded-full w-10 h-10 text-lg" onClick={onMenu} aria-label="메뉴로">🏠</button>
      </div>
    </div>
  );
}

const MODES = [
  { id: "build", emoji: "🧱", name: "설치" },
  { id: "fill", emoji: "▦", name: "채우기" },
  { id: "replace", emoji: "🔁", name: "교체" },
  { id: "remove", emoji: "⛏️", name: "제거" },
];

function Hotbar({ onOpenQuiz, onOpenInventory, onOpenShop, onToast }) {
  const mode = useStore((s) => s.ui.mode);
  const selected = useStore((s) => s.inventory.selected);
  const owned = useStore((s) => s.inventory.owned);
  const b = BLOCKS[selected];
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-2 p-2 sm:p-3 pointer-events-none">
      <div className="flex items-end gap-2 flex-wrap justify-center pointer-events-auto">
        {/* 퀴즈 CTA */}
        <button onClick={() => { audio.play("open"); onOpenQuiz(); }}
          className="btn-chunky rounded-2xl px-4 py-2.5 text-white mc-display text-lg"
          style={{ background: "linear-gradient(#FF9B7B,#F2705B)", animation: "pulse-glow 2.4s ease-in-out infinite" }}>
          🧮 문제 풀기<span className="text-xs block opacity-90 -mt-0.5">코인 얻기!</span>
        </button>
        {/* 선택 블록 */}
        <button onClick={() => { audio.play("click"); onOpenInventory(); }}
          className="btn-chunky glass rounded-2xl px-3 py-2 flex items-center gap-2">
          <span className="rounded-lg" style={{ width: 30, height: 30, background: b.color, boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.15)", border: "2px solid rgba(255,255,255,0.8)" }} />
          <span className="text-left leading-tight">
            <span className="mc-display block text-sm">{b.name}</span>
            <span className="text-xs opacity-70">{owned[selected] || 0}개 보유</span>
          </span>
        </button>
        {/* 모드 */}
        <div className="glass rounded-2xl p-1 flex gap-1">
          {MODES.map((m) => (
            <button key={m.id}
              onClick={() => { audio.play("click"); actions.setMode(m.id); if (m.id === "fill") onToast("📍 채우기: 두 모서리를 차례로 콕!"); }}
              className="btn-flat rounded-xl px-2 py-1 flex flex-col items-center"
              style={{ background: mode === m.id ? "linear-gradient(#FFD66B,#FFB85C)" : "transparent", minWidth: 44 }}>
              <span className="text-base leading-none">{m.emoji}</span>
              <span className="mc-display" style={{ fontSize: 11 }}>{m.name}</span>
            </button>
          ))}
        </div>
        {/* 되돌리기 / 상점 */}
        <div className="glass rounded-2xl p-1 flex gap-1">
          <button className="btn-flat rounded-xl px-2.5 py-1.5 text-lg" aria-label="되돌리기"
            onClick={() => { if (actions.undo()) audio.play("remove"); else audio.play("deny"); }}>↩️</button>
          <button className="btn-flat rounded-xl px-2.5 py-1.5 text-lg" aria-label="다시하기"
            onClick={() => { if (actions.redo()) audio.play("place"); else audio.play("deny"); }}>↪️</button>
        </div>
        <button onClick={() => { audio.play("open"); onOpenShop(); }}
          className="btn-chunky glass rounded-2xl px-3 py-2.5 mc-display">🛒 상점</button>
      </div>
    </div>
  );
}

function InventoryDrawer({ onClose, onOpenShop }) {
  const owned = useStore((s) => s.inventory.owned);
  const selected = useStore((s) => s.inventory.selected);
  const ids = Object.keys(BLOCKS).filter((id) => (owned[id] || 0) > 0);
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 p-2 sm:p-3 pointer-events-none">
      <div className="glass rounded-3xl p-3 max-w-2xl mx-auto pointer-events-auto anim-fadeup">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="mc-display text-lg">🎒 내 블록</h3>
          <div className="flex gap-2">
            <button className="btn-chunky rounded-full px-3 py-1 text-sm mc-display" style={{ background: "linear-gradient(#FFD66B,#FFB85C)" }}
              onClick={() => { audio.play("open"); onOpenShop(); }}>🛒 상점</button>
            <button className="btn-flat rounded-full px-3 py-1 text-sm bg-white bg-opacity-70" onClick={onClose}>닫기 ✕</button>
          </div>
        </div>
        {ids.length === 0 ? (
          <p className="text-center py-4 opacity-70">블록이 없어요! 문제를 풀고 상점에서 사 보세요 🛒</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-44 overflow-y-auto no-scrollbar p-1">
            {ids.map((id) => (
              <button key={id} onClick={() => { audio.play("click"); actions.selectBlock(id); onClose(); }}
                className="btn-flat rounded-2xl p-1.5 flex flex-col items-center bg-white"
                style={{ outline: selected === id ? "3px solid #FF9B7B" : "none", backgroundColor: "rgba(255,255,255,0.75)" }}>
                <span className="rounded-lg" style={{ width: 34, height: 34, background: BLOCKS[id].color, boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.15)", border: "2px solid rgba(255,255,255,0.9)" }} />
                <span className="mc-display mt-1 leading-tight text-center" style={{ fontSize: 10 }}>{BLOCKS[id].name}</span>
                <span className="text-xs opacity-70">{owned[id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShopModal({ onClose, onToast }) {
  const coins = useStore((s) => s.player.coins);
  const owned = useStore((s) => s.inventory.owned);
  const [cat, setCat] = useState(SHOP_CATS[0]);
  const [qty, setQty] = useState(1);
  const items = Object.entries(BLOCKS).filter(([, b]) => b.cat === cat);
  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-center justify-between mb-3">
        <h3 className="mc-display text-2xl">🛒 블록 상점</h3>
        <div className="glass rounded-full px-3 py-1 mc-display">🪙 {coins}</div>
      </div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1">
        {SHOP_CATS.map((c) => (
          <button key={c} onClick={() => { setCat(c); audio.play("click"); }}
            className="btn-flat rounded-full px-3 py-1.5 mc-display text-sm whitespace-nowrap"
            style={{ background: cat === c ? "linear-gradient(#FFD66B,#FFB85C)" : "rgba(255,255,255,0.7)" }}>
            {c}
          </button>
        ))}
        <div className="ml-auto flex gap-1 items-center">
          {[1, 5, 10].map((q) => (
            <button key={q} onClick={() => setQty(q)} className="btn-flat rounded-full px-2.5 py-1 text-sm mc-display"
              style={{ background: qty === q ? "#8FCB6B" : "rgba(255,255,255,0.7)", color: qty === q ? "white" : undefined }}>
              {q}개
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto no-scrollbar p-0.5">
        {items.map(([id, b]) => {
          const cost = b.price * qty;
          const can = coins >= cost;
          return (
            <div key={id} className="rounded-2xl p-2.5 flex flex-col gap-1.5" style={{ background: "rgba(255,255,255,0.72)" }}>
              <div className="flex items-center gap-2">
                <span className="rounded-lg" style={{ width: 34, height: 34, background: b.color, boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.15)", border: "2px solid rgba(255,255,255,0.9)" }} />
                <div className="leading-tight">
                  <div className="mc-display text-sm">{b.name}</div>
                  <div className="text-xs opacity-70">보유 {owned[id] || 0} {b.bonus ? `· 가치+${b.bonus}` : ""}</div>
                </div>
              </div>
              <button disabled={!can}
                onClick={() => {
                  const r = actions.buyBlock(id, qty);
                  if (r.ok) { audio.play("coin"); onToast(`${b.name} ${qty}개 구매! (-${r.cost}🪙)`); }
                }}
                className="btn-chunky rounded-full py-1.5 mc-display text-sm"
                style={{ background: can ? "linear-gradient(#FFD66B,#FFB85C)" : "#E5DFD2", opacity: can ? 1 : 0.6, color: "#5B4636" }}>
                🪙 {cost} 구매
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-center mt-3 opacity-60">문제를 풀어 코인을 모으고, 장식 블록으로 마을 가치를 올려 보세요!</p>
    </Modal>
  );
}

function AchievementsModal({ onClose }) {
  const ach = useStore((s) => s.achievements);
  return (
    <Modal onClose={onClose} wide>
      <h3 className="mc-display text-2xl mb-3 text-center">🏆 업적</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const done = !!ach[a.id];
          return (
            <div key={a.id} className="rounded-2xl px-3 py-2.5 flex items-center gap-3"
              style={{ background: done ? "rgba(255,224,138,0.55)" : "rgba(255,255,255,0.55)", opacity: done ? 1 : 0.75 }}>
              <span className="text-2xl" style={{ filter: done ? "none" : "grayscale(1)" }}>{a.emoji}</span>
              <div className="leading-tight flex-1">
                <div className="mc-display">{a.name}</div>
                <div className="text-xs opacity-70">{a.desc}</div>
              </div>
              <span className="mc-display text-sm">{done ? "✅" : "+20🪙"}</span>
            </div>
          );
        })}
      </div>
      <button className="btn-chunky w-full mt-4 py-2.5 rounded-full text-lg" style={{ background: "linear-gradient(#FFD66B,#FFB85C)" }} onClick={onClose}>닫기</button>
    </Modal>
  );
}

function HelpOverlay({ onClose }) {
  const rows = [
    ["🔄", "빙글빙글 돌리기", "드래그 / 한 손가락"],
    ["🔍", "확대·축소", "마우스 휠 / 두 손가락"],
    ["🧱", "블록 설치", "원하는 곳을 클릭(탭)"],
    ["⛏️", "블록 제거", "제거 모드에서 클릭 (또는 길게 누르기)"],
    ["▦", "한꺼번에 채우기", "채우기 모드에서 두 모서리 클릭"],
  ];
  return (
    <Modal onClose={onClose}>
      <h3 className="mc-display text-2xl mb-1 text-center">🏡 마을에 온 걸 환영해요!</h3>
      <p className="text-center text-sm opacity-75 mb-4">수학 문제를 풀어 코인을 모으고, 나만의 마을을 지어 보세요.</p>
      <div className="flex flex-col gap-1.5 mb-4">
        {rows.map(([e, t, d]) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.6)" }}>
            <span className="text-xl">{e}</span>
            <div className="leading-tight">
              <div className="mc-display text-sm">{t}</div>
              <div className="text-xs opacity-70">{d}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-chunky w-full py-2.5 rounded-full text-lg mc-display" style={{ background: "linear-gradient(#FFD66B,#FFB85C)" }}
        onClick={() => { actions.toggleSetting("seenHelp"); onClose(); audio.play("open"); }}>
        시작하기! 🚀
      </button>
    </Modal>
  );
}

/* ── 퀴즈 모달 ── */

function ComboFlame({ combo }) {
  if (combo < 2) return null;
  const big = combo >= 5;
  return (
    <span className="mc-display rounded-full px-2.5 py-0.5 text-sm"
      style={{ background: big ? "linear-gradient(#FF9B7B,#F2705B)" : "rgba(255,214,107,0.8)", color: big ? "white" : "#5B4636" }}>
      🔥 {combo}콤보 {combo >= 10 ? "×2" : combo >= 5 ? "×1.5" : combo >= 3 ? "×1.2" : ""}
    </span>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    left: 8 + Math.random() * 84, delay: Math.random() * 0.25,
    color: pick(["#FF9B7B", "#FFD66B", "#8FCB6B", "#7FC4E8", "#C9A6E0", "#F38BA0"]),
    rot: Math.random() * 90,
  })), []);
  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden" style={{ height: 140 }}>
      {pieces.map((p, i) => (
        <span key={i} className="absolute rounded-sm" style={{
          left: `${p.left}%`, top: 0, width: 9, height: 13, background: p.color,
          transform: `rotate(${p.rot}deg)`, animation: `confetti 1s ease-in ${p.delay}s both`,
        }} />
      ))}
    </div>
  );
}

function QuizModal({ onClose, notifyAch }) {
  const diff = useStore((s) => s.quiz.difficulty);
  const combo = useStore((s) => s.player.combo);
  const coins = useStore((s) => s.player.coins);
  const colorBlind = useStore((s) => s.settings.colorBlind);
  const FB = feedbackColors(colorBlind);

  const [problem, setProblem] = useState(() => drawProblem(store.get().quiz.difficulty));
  const [phase, setPhase] = useState("ask"); // ask | right | wrong
  const [picked, setPicked] = useState(-1);
  const [gain, setGain] = useState(null);
  const [revealVis, setRevealVis] = useState(false);
  const [eliminated, setEliminated] = useState([]);
  const [offerUp, setOfferUp] = useState(false);
  const [downMsg, setDownMsg] = useState(false);
  const [session, setSession] = useState({ ok: 0, total: 0 });
  const timer = useRef(null);

  const dInfo = DIFFICULTIES[diff - 1];
  const showVis = (problem.visA || problem.visB) && (problem.diff <= 2 || revealVis);
  const isCompare = problem.kind === "compare";

  const next = useCallback((newDiff) => {
    clearTimeout(timer.current);
    setProblem(drawProblem(newDiff ?? store.get().quiz.difficulty));
    setPhase("ask"); setPicked(-1); setGain(null);
    setRevealVis(false); setEliminated([]); setDownMsg(false);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (i) => {
    if (phase !== "ask") return;
    setPicked(i);
    setSession((s2) => ({ ok: s2.ok + (i === problem.answer ? 1 : 0), total: s2.total + 1 }));
    if (i === problem.answer) {
      const res = actions.answerCorrect();
      setGain(res);
      setPhase("right");
      audio.play("correct");
      setTimeout(() => audio.play("coin"), 180);
      if (res.leveled) setTimeout(() => audio.play("level"), 420);
      notifyAch();
      if (res.streak >= 3 && diff < 5) {
        setOfferUp(true);
      } else {
        timer.current = setTimeout(() => next(), 1500);
      }
    } else {
      const res = actions.answerWrong();
      setPhase("wrong");
      audio.play("wrong");
      if (res.downed) setDownMsg(true);
      notifyAch();
    }
  };

  const useHint = () => {
    if (phase !== "ask" || coins < 2) { audio.play("deny"); return; }
    actions.addCoins(-2);
    audio.play("click");
    if ((problem.visA || problem.visB) && !revealVis && problem.diff >= 3) { setRevealVis(true); return; }
    // 오답 2개 제거
    const wrongs = problem.choices.map((_, i) => i).filter((i) => i !== problem.answer && !eliminated.includes(i));
    const out = [];
    while (out.length < 2 && wrongs.length) out.push(wrongs.splice(Math.floor(Math.random() * wrongs.length), 1)[0]);
    setEliminated((e) => [...e, ...out]);
  };

  const acc = session.total ? Math.round((session.ok / session.total) * 100) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4"
      style={{ background: "rgba(91,70,54,0.45)", backdropFilter: "blur(5px)" }}>
      <div className={`glass rounded-3xl w-full max-w-lg p-4 sm:p-6 relative overflow-hidden ${phase === "wrong" ? "anim-shake" : "anim-pop"}`}>
        {phase === "right" && <Confetti />}
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="mc-display rounded-full px-3 py-1 text-white text-sm" style={{ background: dInfo.color }}>
            {dInfo.emoji} {dInfo.name} 단계
          </span>
          <div className="flex items-center gap-2">
            <ComboFlame combo={combo} />
            {acc !== null && <span className="text-xs opacity-70">{session.ok}/{session.total} ({acc}%)</span>}
            <button className="btn-flat rounded-full w-8 h-8 bg-white bg-opacity-70" onClick={onClose} aria-label="닫기">✕</button>
          </div>
        </div>

        {/* 문제 */}
        <div className="rounded-2xl p-4 mb-3 text-center" style={{ background: "rgba(255,255,255,0.7)" }}>
          <div className="text-xl sm:text-2xl leading-relaxed">
            <PromptText parts={problem.promptParts} big={problem.kind !== "word"} />
          </div>
          {showVis && (
            <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
              {problem.visA && <FracVisual fr={problem.visA} color={FB.pieA} />}
              {problem.visA && problem.visB && <span className="mc-display text-xl">{problem.op || "vs"}</span>}
              {problem.visB && <FracVisual fr={problem.visB} color={FB.pieB} />}
            </div>
          )}
        </div>

        {/* 보기 */}
        <div className={`grid gap-2 mb-3 ${isCompare ? "grid-cols-3" : "grid-cols-2"}`}>
          {problem.choices.map((c, i) => {
            const isAns = i === problem.answer;
            const isPicked = i === picked;
            const gone = eliminated.includes(i);
            let bg = "rgba(255,255,255,0.85)";
            let border = "2px solid rgba(255,255,255,0.9)";
            if (phase !== "ask") {
              if (isAns) { bg = FB.goodBg; border = `3px solid ${FB.good}`; }
              else if (isPicked) { bg = FB.badBg; border = `3px solid ${FB.bad}`; }
            }
            return (
              <button key={i} disabled={phase !== "ask" || gone}
                onClick={() => choose(i)}
                className="btn-chunky rounded-2xl py-3 px-2 text-center"
                style={{ background: bg, border, opacity: gone ? 0.25 : 1, minHeight: 56 }}>
                <Frac str={c} big />
                {phase !== "ask" && isAns && <span className="ml-1.5">{colorBlind ? "✔" : "⭕"}</span>}
                {phase !== "ask" && isPicked && !isAns && <span className="ml-1.5">✕</span>}
              </button>
            );
          })}
        </div>

        {/* 피드백 */}
        {phase === "right" && gain && (
          <div className="text-center mc-display mb-2 relative">
            <span className="text-lg" style={{ color: FB.good }}>딩동댕~ 정답! 🎉</span>
            <span className="absolute left-1/2 -translate-x-1/2 text-xl" style={{ animation: "coinfly 1.1s ease-out both", color: "#C28A1E" }}>
              +{gain.coins}🪙{gain.mult > 1 ? ` (콤보 ×${gain.mult})` : ""}
            </span>
            {gain.leveled && <div className="text-sm mt-1" style={{ color: "#8A6FD1" }}>⬆ 레벨 업! Lv.{gain.level} 달성!</div>}
          </div>
        )}
        {phase === "wrong" && (
          <div className="text-center mb-2">
            <span className="mc-display text-lg" style={{ color: FB.bad }}>아쉬워요! 정답을 확인해 보세요</span>
            {downMsg && <div className="text-sm mt-1 opacity-80">🍀 조금 쉬운 문제로 바꿔 줄게요. 천천히 해도 괜찮아요!</div>}
          </div>
        )}

        {/* 난이도 상승 제안 */}
        {offerUp && phase === "right" && (
          <div className="rounded-2xl p-3 text-center mb-2" style={{ background: "rgba(255,224,138,0.5)" }}>
            <div className="mc-display mb-2">와! 3연속 정답! {DIFFICULTIES[diff].emoji} {DIFFICULTIES[diff].name} 단계에 도전할까요?</div>
            <div className="flex gap-2 justify-center">
              <button className="btn-chunky rounded-full px-4 py-1.5 mc-display text-white" style={{ background: dInfo.color }}
                onClick={() => { actions.setDifficulty(diff + 1); setOfferUp(false); audio.play("level"); next(diff + 1); }}>
                좋아요! 도전 🚀
              </button>
              <button className="btn-chunky rounded-full px-4 py-1.5 bg-white"
                onClick={() => { actions.setDifficulty(diff); setOfferUp(false); next(diff); }}>
                아직요
              </button>
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={useHint} disabled={phase !== "ask" || coins < 2}
            className="btn-flat rounded-full px-3 py-1.5 text-sm bg-white bg-opacity-75"
            style={{ opacity: phase === "ask" && coins >= 2 ? 1 : 0.45 }}>
            💡 힌트 (-2🪙)
          </button>
          <div className="flex gap-2">
            {phase === "wrong" && (
              <button className="btn-chunky rounded-full px-5 py-2 mc-display text-white" style={{ background: "linear-gradient(#FF9B7B,#F2705B)" }}
                onClick={() => next()}>
                다음 문제 →
              </button>
            )}
            {phase === "right" && !offerUp && (
              <button className="btn-flat rounded-full px-4 py-1.5 text-sm bg-white bg-opacity-75" onClick={() => next()}>바로 다음 →</button>
            )}
            <button className="btn-flat rounded-full px-4 py-1.5 text-sm bg-white bg-opacity-75" onClick={onClose}>그만하기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Village: 3D 캔버스 + 조작 ── */

function Village({ onMenu, onSettings, showToast, notifyAch }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const worldRef = useRef(null);
  const prevBlocksRef = useRef({});
  const fillCornerRef = useRef(null);
  const ptrsRef = useRef(new Map());
  const dragRef = useRef({ dragging: false, x: 0, y: 0, t: 0, pinch: 0 });
  const longRef = useRef(null);
  const longFiredRef = useRef(false);

  const [quizOpen, setQuizOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const seenHelp = useStore((s) => s.settings.seenHelp);
  const [helpOpen, setHelpOpen] = useState(!seenHelp);
  const anyModal = quizOpen || invOpen || shopOpen || achOpen || helpOpen;
  const anyModalRef = useRef(anyModal);
  anyModalRef.current = anyModal;

  // ── 월드 초기화 & 블록 동기화 ──
  useEffect(() => {
    const world = new GameWorld(canvasRef.current);
    worldRef.current = world;
    const blocks = store.get().world.blocks;
    world.syncBlocks(blocks);
    prevBlocksRef.current = blocks;
    world.start();

    const unsub = store.subscribe((s) => {
      const next = s.world.blocks;
      const prev = prevBlocksRef.current;
      if (next === prev) return;
      for (const k in prev) if (!(k in next)) world.removeBlockMesh(k);
      for (const k in next) {
        if (!(k in prev)) world.addBlockMesh(k, next[k]);
        else if (prev[k] !== next[k]) { world.removeBlockMesh(k); world.addBlockMesh(k, next[k]); }
      }
      prevBlocksRef.current = next;
    });

    const onResize = () => {
      const r = wrapRef.current.getBoundingClientRect();
      world.resize(r.width, r.height);
    };
    onResize();
    window.addEventListener("resize", onResize);

    const onVis = () => { if (document.hidden) world.stop(); else world.start(); };
    document.addEventListener("visibilitychange", onVis);

    const canvas = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      world.radius *= 1 + e.deltaY * 0.0012;
      world.updateCamera();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) actions.redo(); else actions.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); actions.redo(); }
      const pan = 1.2;
      if (e.key === "ArrowUp" || e.key === "w") world.panTarget(0, -pan);
      if (e.key === "ArrowDown" || e.key === "s") world.panTarget(0, pan);
      if (e.key === "ArrowLeft" || e.key === "a") world.panTarget(-pan, 0);
      if (e.key === "ArrowRight" || e.key === "d") world.panTarget(pan, 0);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      unsub();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("wheel", onWheel);
      world.dispose();
      worldRef.current = null;
    };
  }, []);

  // ── 클릭 액션 ──
  const doAction = useCallback((clientX, clientY, forceRemove = false) => {
    const world = worldRef.current;
    if (!world) return;
    const { placeKey, removeKey } = world.raycastAt(clientX, clientY);
    const mode = forceRemove ? "remove" : store.get().ui.mode;

    if (mode === "build") {
      if (!placeKey) return;
      const r = actions.placeAt(placeKey);
      if (r.ok) { audio.play("place"); notifyAch(); }
      else if (r.reason === "stock") { audio.play("deny"); showToast(`${BLOCKS[r.id].name} 블록이 없어요! 🛒 상점에서 사 보세요`); }
      else if (r.reason === "bounds") { audio.play("deny"); showToast("마을 밖에는 지을 수 없어요!"); }
    } else if (mode === "remove") {
      if (!removeKey) return;
      const r = actions.removeAt(removeKey);
      if (r.ok) audio.play("remove");
    } else if (mode === "replace") {
      if (!removeKey) { showToast("바꿀 블록을 콕 눌러 주세요!"); return; }
      const r = actions.replaceAt(removeKey);
      if (r.ok) audio.play("place");
      else if (r.reason === "stock") { audio.play("deny"); showToast(`${BLOCKS[r.id].name} 블록이 없어요!`); }
      else if (r.reason === "same") showToast("이미 같은 블록이에요!");
    } else if (mode === "fill") {
      if (!placeKey) return;
      if (!fillCornerRef.current) {
        fillCornerRef.current = placeKey;
        world.setMarker(placeKey);
        audio.play("click");
        showToast("📍 첫 번째 모서리! 반대쪽 모서리를 콕!");
      } else {
        const r = actions.fillRegion(fillCornerRef.current, placeKey);
        fillCornerRef.current = null;
        world.setMarker(null);
        if (r.ok) { audio.play("place"); showToast(`✨ ${r.count}개 블록을 한 번에 설치!`); notifyAch(); }
        else if (r.reason === "limit") { audio.play("deny"); showToast(`한 번에 ${FILL_LIMIT}개까지만 가능해요 (${r.count}개)`); }
        else if (r.reason === "stock") { audio.play("deny"); showToast(`블록이 부족해요! ${r.need}개 필요, ${r.have}개 보유`); }
        else if (r.reason === "deco") { audio.play("deny"); showToast("채우기는 일반 블록만 가능해요!"); }
        else showToast("채울 빈칸이 없어요!");
      }
    }
  }, [showToast, notifyAch]);

  // ── 고스트 미리보기 ──
  const updateGhost = useCallback((clientX, clientY) => {
    const world = worldRef.current;
    if (!world) return;
    if (anyModalRef.current) { world.setGhost(null); return; }
    const s = store.get();
    const { placeKey, removeKey } = world.raycastAt(clientX, clientY);
    const mode = s.ui.mode;
    if (mode === "build" || mode === "fill") {
      if (!placeKey) return world.setGhost(null);
      const [x, y, z] = parseKey(placeKey);
      const valid = inBounds(x, y, z) && !s.world.blocks[placeKey] && (s.inventory.owned[s.inventory.selected] || 0) > 0;
      world.setGhost(placeKey, valid);
    } else {
      if (!removeKey) return world.setGhost(null);
      world.setGhost(removeKey, false);
    }
  }, []);

  // ── 포인터 이벤트 ──
  const onPointerDown = (e) => {
    if (anyModalRef.current) return;
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrsRef.current.size === 1) {
      dragRef.current = { dragging: false, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
      longFiredRef.current = false;
      if (e.pointerType === "touch") {
        longRef.current = setTimeout(() => {
          if (!dragRef.current.dragging && ptrsRef.current.size === 1) {
            longFiredRef.current = true;
            doAction(e.clientX, e.clientY, true); // 길게 누르기 = 제거
            if (navigator.vibrate) navigator.vibrate(30);
          }
        }, 480);
      }
    } else if (ptrsRef.current.size === 2) {
      clearTimeout(longRef.current);
      const pts = [...ptrsRef.current.values()];
      dragRef.current.pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dragRef.current.midX = (pts[0].x + pts[1].x) / 2;
      dragRef.current.midY = (pts[0].y + pts[1].y) / 2;
    }
  };

  const onPointerMove = (e) => {
    const world = worldRef.current;
    if (!world) return;
    if (!ptrsRef.current.has(e.pointerId)) {
      if (e.pointerType === "mouse" && e.buttons === 0) updateGhost(e.clientX, e.clientY);
      return;
    }
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrsRef.current.size === 2) {
      const pts = [...ptrsRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
      if (dragRef.current.pinch) {
        world.radius *= dragRef.current.pinch / dist;
        world.panTarget((dragRef.current.midX - midX) * 0.03, (dragRef.current.midY - midY) * 0.03);
        world.updateCamera();
      }
      dragRef.current.pinch = dist;
      dragRef.current.midX = midX; dragRef.current.midY = midY;
      dragRef.current.dragging = true;
      return;
    }
    const d = dragRef.current;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.dragging && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 7) {
      d.dragging = true;
      clearTimeout(longRef.current);
      world.setGhost(null);
    }
    if (d.dragging) {
      world.theta -= dx * 0.0055;
      world.phi -= dy * 0.0045;
      world.updateCamera();
    }
    d.x = e.clientX; d.y = e.clientY;
  };

  const onPointerUp = (e) => {
    clearTimeout(longRef.current);
    const had = ptrsRef.current.has(e.pointerId);
    ptrsRef.current.delete(e.pointerId);
    if (!had || anyModalRef.current) return;
    const d = dragRef.current;
    if (ptrsRef.current.size === 0 && !d.dragging && !longFiredRef.current && performance.now() - d.t < 600) {
      doAction(e.clientX, e.clientY);
      if (e.pointerType === "mouse") updateGhost(e.clientX, e.clientY);
    }
    if (ptrsRef.current.size === 0) d.dragging = false;
  };

  // 모드 바뀌면 채우기 마커 정리
  const mode = useStore((s) => s.ui.mode);
  useEffect(() => {
    if (mode !== "fill" && worldRef.current) { fillCornerRef.current = null; worldRef.current.setMarker(null); }
  }, [mode]);

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
      <Hud onMenu={onMenu} onSettings={onSettings} onAchievements={() => { audio.play("open"); setAchOpen(true); }} />
      {!anyModal && (
        <Hotbar
          onOpenQuiz={() => setQuizOpen(true)}
          onOpenInventory={() => setInvOpen(true)}
          onOpenShop={() => setShopOpen(true)}
          onToast={showToast}
        />
      )}
      {invOpen && <InventoryDrawer onClose={() => setInvOpen(false)} onOpenShop={() => { setInvOpen(false); setShopOpen(true); }} />}
      {shopOpen && <ShopModal onClose={() => setShopOpen(false)} onToast={showToast} />}
      {achOpen && <AchievementsModal onClose={() => setAchOpen(false)} />}
      {quizOpen && <QuizModal onClose={() => setQuizOpen(false)} notifyAch={notifyAch} />}
      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

/* ═══════════ App ═══════════ */

export default function App() {
  const screen = useStore((s) => s.screen);
  const largeText = useStore((s) => s.settings.largeText);
  const music = useStore((s) => s.settings.music);
  const [savedMeta, setSavedMeta] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const [achBanners, setAchBanners] = useState([]);
  const toastTimer = useRef(null);

  useEffect(() => {
    (async () => {
      const data = await loadSave();
      if (data) setSavedMeta({ level: data.player.level, coins: data.player.coins });
    })();
  }, []);

  // 배경음악 관리
  useEffect(() => {
    if (screen === "village" && music) audio.startMusic();
    else audio.stopMusic();
    return () => audio.stopMusic();
  }, [screen, music]);

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2300);
  }, []);

  const notifyAch = useCallback(() => {
    const unlocked = runAchievementChecks();
    if (!unlocked.length) return;
    audio.play("achieve");
    setAchBanners((b) => [...b, ...unlocked.map((a) => ({ ...a, ts: Date.now() + Math.random() }))]);
    setTimeout(() => setAchBanners((b) => b.slice(unlocked.length)), 3200);
  }, []);

  useAutoSave(useCallback(() => showToast("💾 자동 저장됨"), [showToast]));

  const continueGame = async () => {
    const data = await loadSave();
    if (data) applySaveData(data);
    else actions.newGame();
  };

  const backToMenu = () => {
    writeSave(store.get());
    const p = store.get().player;
    setSavedMeta({ level: p.level, coins: p.coins });
    actions.setScreen("menu");
  };

  const resetData = async () => {
    await clearSave();
    setSavedMeta(null);
    setShowSettings(false);
    undoStack = []; redoStack = [];
    store.set({ ...initialState() });
    showToast("🧹 데이터를 모두 지웠어요");
  };

  return (
    <div className="mc-root w-full h-screen overflow-hidden select-none" style={{ fontSize: largeText ? "112%" : "100%" }}>
      <GlobalStyle />
      {screen === "menu" && (
        <MainMenu savedMeta={savedMeta} onContinue={continueGame} onNew={() => actions.newGame()} onSettings={() => setShowSettings(true)} />
      )}
      {screen === "village" && (
        <Village onMenu={backToMenu} onSettings={() => setShowSettings(true)} showToast={showToast} notifyAch={notifyAch} />
      )}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onResetData={resetData} />}
      {/* 업적 배너 */}
      <div className="fixed top-3 left-1/2 z-50 flex flex-col gap-2 pointer-events-none" style={{ transform: "translateX(-50%)" }}>
        {achBanners.map((a) => (
          <div key={a.ts} className="glass rounded-2xl px-4 py-2 flex items-center gap-2" style={{ animation: "banner 3.2s ease both" }}>
            <span className="text-2xl">{a.emoji}</span>
            <div className="leading-tight">
              <div className="mc-display text-sm">🏆 업적 달성! {a.name}</div>
              <div className="text-xs opacity-70">{a.desc} · +{ACH_REWARD}🪙</div>
            </div>
          </div>
        ))}
      </div>
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 glass rounded-full px-5 py-2 mc-display pointer-events-none"
          style={{ transform: "translateX(-50%)", animation: "toast 2.3s ease both" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
