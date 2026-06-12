// src/current-pack/problemPack.js
// 단원: 직육면체의 겉넓이와 부피 (초등 6학년)
//
// 향후 다른 단원으로 교체하려면 이 파일만 교체하세요.
// App.jsx는 problemPack.title 과 problemPack.generateProblem(diff) 만 사용합니다.

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 정답 + 오답 3개를 셔플하여 {choices, answer} 반환
function makeChoices(correct, ...distractors) {
  const corrStr = String(correct);
  const pool = [corrStr];

  for (const d of distractors) {
    const s = String(Math.max(1, Math.round(d)));
    if (s !== corrStr && !pool.includes(s) && pool.length < 4) pool.push(s);
  }

  // 비율 기반 대안으로 나머지 채우기
  const pcts = [0.1, 0.2, 0.3, 0.4, 0.5, -0.1, -0.2, -0.3, -0.4];
  let g = 0;
  while (pool.length < 4 && g++ < 60) {
    const c = String(Math.max(1, Math.round(correct * (1 + pick(pcts)))));
    if (!pool.includes(c)) pool.push(c);
  }
  // 절대값 fallback
  for (const o of [5, 10, 15, 20, 25, 30]) {
    if (pool.length >= 4) break;
    const c = String(Math.max(1, correct + o));
    if (!pool.includes(c)) pool.push(c);
  }

  // 셔플
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return { choices: pool.slice(0, 4), answer: pool.indexOf(corrStr) };
}

// ── 문제 유형 1: 정육면체 부피 ──
function makeCubeVolume(diff) {
  const maxEdge = diff <= 2 ? 5 : 7;
  const a = ri(2, maxEdge);
  const correct = a * a * a;
  const { choices, answer } = makeChoices(correct, a * a, 6 * a * a, a * a * a + a, a * 3);
  const text = pick([
    `🎲 한 모서리의 길이가 ${a}cm인 주사위의 부피는 몇 cm³일까요?`,
    `🧊 한 모서리가 ${a}cm인 정육면체 얼음의 부피를 구하세요. (단위: cm³)`,
    `🍬 한 모서리가 ${a}cm인 각설탕의 부피는 몇 cm³일까요?`,
    `🎁 한 모서리의 길이가 ${a}cm인 정육면체 선물 상자의 부피는 몇 cm³일까요?`,
    `🧊 냉동실에 넣을 정육면체 모양 얼음 틀의 한 모서리가 ${a}cm입니다. 부피는 몇 cm³일까요?`,
    `🪨 한 모서리가 ${a}cm인 정육면체 모양 돌의 부피는 몇 cm³일까요?`,
    `🧸 정육면체 모양 쿠션의 한 모서리 길이가 ${a}cm입니다. 부피는 몇 cm³일까요?`,
    `🎮 한 모서리가 ${a}cm인 정육면체 조각의 부피를 구하세요. (단위: cm³)`,
    `🍰 한 모서리가 ${a}cm인 정육면체 케이크 조각의 부피는 몇 cm³일까요?`,
    `🧩 한 모서리의 길이가 ${a}cm인 루빅스큐브 모양 장난감의 부피는 몇 cm³일까요?`,
  ]);
  return {
    kind: 'cube_vol', diff, visA: null, visB: null,
    promptParts: [text], choices, answer,
    sig: `cv|${a}`,
  };
}

// ── 문제 유형 2: 정육면체 겉넓이 ──
function makeCubeSurface(diff) {
  const maxEdge = diff <= 2 ? 5 : 7;
  const a = ri(2, maxEdge);
  const correct = 6 * a * a;
  const { choices, answer } = makeChoices(correct, a * a * a, a * a, 4 * a * a, 6 * a);
  const text = pick([
    `🎲 한 모서리의 길이가 ${a}cm인 주사위의 겉넓이는 몇 cm²일까요?`,
    `🎁 한 모서리의 길이가 ${a}cm인 정육면체 선물 상자의 겉넓이는 몇 cm²일까요?`,
    `🍬 한 모서리가 ${a}cm인 각설탕을 포장지로 감싸려면 몇 cm² 필요할까요?`,
    `🧩 한 모서리가 ${a}cm인 루빅스큐브 모양 장난감의 겉넓이는 몇 cm²일까요?`,
    `📦 정육면체 상자의 한 모서리 길이가 ${a}cm입니다. 여섯 면의 넓이의 합은 몇 cm²일까요?`,
    `🪨 한 모서리가 ${a}cm인 정육면체 치즈 조각의 겉넓이는 몇 cm²일까요?`,
    `🎮 한 모서리가 ${a}cm인 정육면체 버튼의 겉넓이는 몇 cm²일까요?`,
    `🧊 한 모서리가 ${a}cm인 정육면체 얼음의 겉넓이는 몇 cm²일까요?`,
  ]);
  return {
    kind: 'cube_surf', diff, visA: null, visB: null,
    promptParts: [text], choices, answer,
    sig: `cs|${a}`,
  };
}

// ── 문제 유형 3: 직육면체 부피 ──
function makeRectVolume(diff) {
  const maxDim = diff <= 2 ? 6 : diff === 3 ? 8 : 10;
  const l = ri(2, maxDim), w = ri(2, maxDim), h = ri(2, maxDim);
  const correct = l * w * h;
  const surf = 2 * (l * w + w * h + l * h);
  const { choices, answer } = makeChoices(correct, l * w, surf, l + w + h, l * w * h + l);
  const text = pick([
    `✏️ 필통의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 필통의 부피는 몇 cm³일까요?`,
    `🧻 티슈 상자의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🥛 우유팩의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `📚 책의 가로 ${l}cm, 세로 ${w}cm, 두께 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🍫 초콜릿 바의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `📱 직육면체 모양 스마트폰의 가로 ${l}cm, 세로 ${w}cm, 두께 ${h}cm일 때 부피는 몇 cm³일까요?`,
    `🧼 비누의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🍱 도시락 통의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `📦 택배 상자의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🧱 벽돌의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🖊️ 지우개의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🏠 수영장의 가로 ${l}m, 세로 ${w}m, 깊이 ${h}m입니다. 부피는 몇 m³일까요?`,
  ]);
  return {
    kind: 'rect_vol', diff, visA: null, visB: null,
    promptParts: [text], choices, answer,
    sig: `rv|${l}|${w}|${h}`,
  };
}

// ── 문제 유형 4: 직육면체 겉넓이 ──
function makeRectSurface(diff) {
  const maxDim = diff <= 3 ? 7 : 9;
  const l = ri(2, maxDim), w = ri(2, maxDim), h = ri(2, maxDim);
  const correct = 2 * (l * w + w * h + l * h);
  const wrong1 = l * w + w * h + l * h;
  const wrong2 = l * w * h;
  const wrong3 = 2 * l * w + 2 * w * h;
  const { choices, answer } = makeChoices(correct, wrong1, wrong2, wrong3);
  const text = pick([
    `✏️ 필통의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🧻 티슈 상자의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🎁 선물 상자의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 포장지가 최소 몇 cm² 필요할까요?`,
    `📦 택배 상자의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🥛 우유팩의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm일 때 겉넓이는 몇 cm²일까요?`,
    `📚 책의 가로 ${l}cm, 세로 ${w}cm, 두께 ${h}cm일 때 겉넓이는 몇 cm²일까요?`,
    `🧼 비누의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🍫 초콜릿 바의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🏠 가로 ${l}m, 세로 ${w}m, 높이 ${h}m인 창고 외벽의 넓이는 몇 m²일까요?`,
    `🍱 도시락 통의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🖊️ 지우개의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
  ]);
  return {
    kind: 'rect_surf', diff, visA: null, visB: null,
    promptParts: [text], choices, answer,
    sig: `rs|${l}|${w}|${h}`,
  };
}

// ── 문제 유형 5: 역산 (부피 ÷ 밑면넓이 = 높이) ──
function makeInverse(diff) {
  const maxDim = diff <= 4 ? 8 : 10;
  const l = ri(2, maxDim), w = ri(2, maxDim), h = ri(2, maxDim);
  const base = l * w;
  const volume = base * h;
  const correct = h;
  const wrong1 = w * h;
  const wrong2 = h + 1;
  const wrong3 = Math.max(1, h - 1);
  const { choices, answer } = makeChoices(correct, wrong1, wrong2, wrong3);
  const text = pick([
    `✏️ 필통의 밑면 가로가 ${l}cm, 세로가 ${w}cm이고, 부피가 ${volume}cm³입니다. 높이는 몇 cm일까요?`,
    `🧻 티슈 상자의 밑면 가로가 ${l}cm, 세로가 ${w}cm이고, 부피가 ${volume}cm³입니다. 높이는 몇 cm일까요?`,
    `🌊 어항의 밑면 넓이가 ${base}cm²이고, 부피가 ${volume}cm³입니다. 높이는 몇 cm일까요?`,
    `📦 상자의 밑면 가로가 ${l}cm, 세로가 ${w}cm이고, 부피가 ${volume}cm³입니다. 높이는 몇 cm일까요?`,
    `🥛 우유팩의 밑면 가로가 ${l}cm, 세로가 ${w}cm이고, 부피가 ${volume}cm³입니다. 높이는 몇 cm일까요?`,
    `🏠 직육면체 모양 방의 밑면 넓이가 ${base}m²이고, 부피가 ${volume}m³입니다. 높이는 몇 m일까요?`,
    `🍱 도시락 통의 밑면 가로가 ${l}cm, 세로가 ${w}cm이고, 부피가 ${volume}cm³입니다. 높이는 몇 cm일까요?`,
    `🎁 선물 상자의 밑면 넓이가 ${base}cm²이고, 부피가 ${volume}cm³입니다. 높이는 몇 cm일까요?`,
  ]);
  return {
    kind: 'inverse', diff, visA: null, visB: null,
    promptParts: [text], choices, answer,
    sig: `inv|${l}|${w}|${h}`,
  };
}

// ── 문제 유형 6: 비교 문제 ──

// 비교 소재 쌍 목록
const COMPARE_PAIRS = [
  { emoji: '📦', nameA: '택배 상자 A', nameB: '택배 상자 B' },
  { emoji: '✏️', nameA: '민지의 필통', nameB: '지수의 필통' },
  { emoji: '🧻', nameA: '티슈 상자 A', nameB: '티슈 상자 B' },
  { emoji: '🎁', nameA: '빨간 선물 상자', nameB: '파란 선물 상자' },
  { emoji: '🥛', nameA: '우유팩 A', nameB: '우유팩 B' },
  { emoji: '🏠', nameA: '창고 A', nameB: '창고 B' },
  { emoji: '🍱', nameA: '도시락 통 A', nameB: '도시락 통 B' },
  { emoji: '🧼', nameA: '비누 A', nameB: '비누 B' },
  { emoji: '📚', nameA: '두꺼운 책', nameB: '얇은 책' },
  { emoji: '🍫', nameA: '초콜릿 상자 A', nameB: '초콜릿 상자 B' },
];

function makeCompare(diff) {
  const maxDim = diff <= 4 ? 8 : 9;
  const l1 = ri(2, maxDim), w1 = ri(2, maxDim), h1 = ri(2, maxDim);
  let l2, w2, h2;
  let tries = 0;
  do {
    l2 = ri(2, maxDim); w2 = ri(2, maxDim); h2 = ri(2, maxDim);
    tries++;
  } while (l1 * w1 * h1 === l2 * w2 * h2 && tries < 30);

  const useVolume = diff <= 4;
  const v1 = useVolume ? l1 * w1 * h1 : 2 * (l1 * w1 + w1 * h1 + l1 * h1);
  const v2 = useVolume ? l2 * w2 * h2 : 2 * (l2 * w2 + w2 * h2 + l2 * h2);
  const diff_val = Math.abs(v1 - v2);
  if (diff_val === 0) return makeCompare(diff);

  const correct = diff_val;
  const unit = useVolume ? 'cm³' : 'cm²';
  const label = useVolume ? '부피' : '겉넓이';
  const pair = pick(COMPARE_PAIRS);
  const { choices, answer } = makeChoices(correct, Math.max(v1, v2), diff_val + l1, diff_val + w1);
  return {
    kind: 'compare_box', diff, visA: null, visB: null,
    promptParts: [
      `${pair.emoji} ${pair.nameA}: 가로 ${l1}cm, 세로 ${w1}cm, 높이 ${h1}cm\n` +
      `${pair.emoji} ${pair.nameB}: 가로 ${l2}cm, 세로 ${w2}cm, 높이 ${h2}cm\n` +
      `두 물건의 ${label} 차이는 몇 ${unit}일까요?`
    ],
    choices, answer,
    sig: `cmp|${l1}|${w1}|${h1}|${l2}|${w2}|${h2}|${useVolume ? 'v' : 's'}`,
  };
}

// ── 문제 유형 7: 생활·건축 테마 ──
function makeWord(diff) {
  const maxDim = diff <= 3 ? 7 : 9;
  const l = ri(2, maxDim), w = ri(2, maxDim), h = ri(2, maxDim);
  const useVolume = Math.random() < 0.5;
  const correct = useVolume ? l * w * h : 2 * (l * w + w * h + l * h);

  const templates_vol = [
    `🏠 창고의 가로가 ${l}m, 세로가 ${w}m, 높이가 ${h}m입니다. 창고의 부피는 몇 m³일까요?`,
    `🌊 수족관의 가로가 ${l}cm, 세로가 ${w}cm, 높이가 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🧳 여행 가방의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🍦 냉동고의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `📬 우편함의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🌱 직육면체 모양 화단의 가로 ${l}m, 세로 ${w}m, 깊이 ${h}m입니다. 부피는 몇 m³일까요?`,
    `🎒 책가방의 가로 ${l}cm, 세로 ${w}cm, 두께 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🏊 수영장의 가로 ${l}m, 세로 ${w}m, 깊이 ${h}m입니다. 부피는 몇 m³일까요?`,
    `🍰 직육면체 케이크의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
    `🧺 빨래 바구니의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 부피는 몇 cm³일까요?`,
  ];
  const templates_surf = [
    `🎁 선물 상자의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 포장지는 최소 몇 cm² 필요할까요?`,
    `🏠 가로 ${l}m, 세로 ${w}m, 높이 ${h}m인 헛간 바깥에 페인트를 칠하려면 넓이가 몇 m²일까요?`,
    `📦 이삿짐 상자의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🧳 여행 가방의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🍱 반찬 통의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `📬 우편함의 가로 ${l}cm, 세로 ${w}cm, 높이 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
    `🎒 책가방의 가로 ${l}cm, 세로 ${w}cm, 두께 ${h}cm입니다. 겉넓이는 몇 cm²일까요?`,
  ];

  const wrong1 = useVolume ? l * w : l * w * h;
  const wrong2 = useVolume ? 2 * (l * w + w * h + l * h) : l * w * h;
  const { choices, answer } = makeChoices(correct, wrong1, wrong2);
  return {
    kind: 'word', diff, visA: null, visB: null,
    promptParts: [useVolume ? pick(templates_vol) : pick(templates_surf)],
    choices, answer,
    sig: `wd|${l}|${w}|${h}|${useVolume ? 'v' : 's'}`,
  };
}

// ── 난이도별 문제 생성 ──
function generateProblem(diff) {
  const r = Math.random();
  switch (diff) {
    case 1:
      return r < 0.5 ? makeCubeVolume(1) : makeCubeSurface(1);
    case 2:
      return r < 0.45 ? makeRectVolume(2) : r < 0.75 ? makeCubeVolume(2) : makeCubeSurface(2);
    case 3:
      return r < 0.38 ? makeRectVolume(3) : r < 0.72 ? makeRectSurface(3) : makeWord(3);
    case 4:
      return r < 0.35 ? makeRectSurface(4) : r < 0.62 ? makeInverse(4) : r < 0.83 ? makeCompare(4) : makeWord(4);
    case 5:
      return r < 0.32 ? makeInverse(5) : r < 0.58 ? makeCompare(5) : r < 0.78 ? makeRectSurface(5) : makeWord(5);
    default:
      return makeCubeVolume(1);
  }
}

export const problemPack = {
  id: 'volume',
  title: '직육면체의 겉넓이와 부피',
  generateProblem,
};
