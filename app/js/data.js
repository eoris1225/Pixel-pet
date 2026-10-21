/* Text and tuning that the plan defines. Edit freely: the app reads everything from here. */
"use strict";

// 치카 = mochi, 하와 = sora, 욱 = nori (the sprite ids stay as they are)
const CHARS = {
  mochi: {
    name: "치카", color: "#ffb3c7", soft: "#ffe3ea", deep: "#e88fa8", trait: "공부 계획이 흐트러지면 슬퍼해요…",
    intro: "저, 저기…! 나랑 같이 공부하지 않을래…? 나도 열심히 응원할게…! 혹시 공부가 잘 안되는 날에도… 내가 옆에 있어 줄게…! 우리 같이 조금씩 해보자…!",
    cheers: ["힘…내!", "공부는..?", "와아…! 대단해…!", "으아아…! (집중 집중…!)", "할수..있어..!"],
    start: "가, 같이 시작하자…!", rest: "조, 조금만 쉬자…", end: "수고했어…! 정말로…!", levelup: "레, 레벨 업…! 고마워…!",
    todo: "오늘 할 일… 같이 적어볼래…?", todoDone: "다, 다 했어…! 대단해…!",
    note: "오늘 뭐 했는지… 알려줄래…?",
  },
  sora: {
    name: "하와", color: "#9fd3f5", soft: "#e0f2fd", deep: "#6cb8e6", trait: "밝고 다정하게 응원해 줘요",
    intro: "안녕! 나랑 같이 공부하자! 오늘 계획을 다 못 끝내도 괜찮아. 하나씩 해내면 되는 거니까! 헤헤, 레벨 업 하는 순간도 내가 제일 먼저 축하해 줄게!",
    cheers: ["오늘도 파이팅!", "천천히 해보자!", "대단하다~!", "굉장해!!", "괜찮아!"],
    start: "좋아, 시작하자!", rest: "잠깐 쉬어 가자~", end: "오늘도 수고했어!", levelup: "레벨 업! 내가 제일 먼저 축하해!",
    todo: "오늘 할 일 적어볼까? 천천히 해도 괜찮아!", todoDone: "다 해냈네! 굉장해!!",
    note: "오늘 뭐 했는지 적어줘!",
  },
  nori: {
    name: "욱", color: "#ffd96b", soft: "#fff3c4", deep: "#f2b93b", trait: "발랄! 열혈! 돌격!",
    intro: "우라아아!! 나랑 공부하자!! 오늘 목표? 싹 다 정복하는 거다!! 야하하! 레벨 업까지 돌격이다아!!",
    cheers: ["우라아아! 공부하러 가자아!!", "야하! 오늘도 레벨 업이다!", "우리리링! 오늘도 제대로 달려보자!!", "우랏! 미루기는 없다아!!!", "우라아! 오늘 목표 전부 클리어다!!"],
    start: "돌격이다아!!", rest: "숨 고르기다아!", end: "클리어다!! 야하하!", levelup: "레벨 업이다아아!!",
    todo: "오늘 할 일 적어라아!! 싹 다 해치우자!!", todoDone: "전부 클리어다!! 우라아!!",
    note: "뭘 정복했는지 적어라아!!",
  },
};
const CHAR_ORDER = ["mochi", "sora", "nori"];

// levelling: 1 level per hour of study, per 50 minutes during the burning time (18:00 - 24:00, the user's local time)
const LEVEL = { normalMin: 60, burnMin: 50, burnFrom: 18, burnTo: 24, max: 10 };

// the pet says one of her cheers this often while the timer runs (and a bit less often otherwise)
const CHEER_EVERY_MS = 10 * 60 * 1000, IDLE_CHEER_EVERY_MS = 4 * 60 * 1000;

// level-up items per character: [level, id, name, where it is worn] (the pixel art is in items.js)
const ITEM_LIST = {
  mochi: [[2, "tears", "눈물 방울", "표정"], [4, "teddy", "곰인형", "품"], [6, "nightcap", "파자마 모자", "머리"], [8, "bag", "크로스백", "몸"], [10, "fork", "포크 창", "무기"]],
  sora:  [[2, "beanie", "고양이 비니", "머리"], [4, "guitar", "통기타", "등"], [6, "nightcap", "파자마 모자", "머리"], [8, "camera", "목걸이 카메라", "목"], [10, "trident", "삼지창", "무기"]],
  nori:  [[2, "shades", "선글라스 세트", "얼굴"], [4, "pass", "합격증", "이마"], [6, "nightcap", "파자마 모자", "머리"], [8, "pudding", "푸딩", "손"], [10, "pencil", "왕연필", "무기"]],
};

const DEFAULT_SUBJECTS = [["국어", "#ffb3a7"], ["수학", "#a7c7ff"], ["영어", "#b5e6a3"]];
const SUBJECT_COLORS = ["#ffb3a7", "#a7c7ff", "#b5e6a3", "#ffd98a", "#d4b5ff", "#ffb3d9", "#9fe0d8", "#f5c4a1", "#c9d1a7", "#b8c4e8"];

// tutorial lines. {start} {rest} {end} show the real keys inline, {stats} {todo} {settings} the side-tab icons;
// num puts a numbered badge in front
const TUTORIAL = [
  { target: null,        text: "톡톡? 처음이지? 사용법을 알려줄게! 화면을 눌러 줘." },
  { target: "#hud",      num: 1, text: "1시간 공부하면 레벨이 하나 올라! 캐릭터마다 최대 10레벨이야." },
  { target: "#hud",      num: 2, text: "버닝 시간은 18시~0시! 이때는 50분마다 레벨 업이라 더 빨라." },
  { target: "#controls", num: 3, text: "{start}을 누르면 타이머가 돌아가고, {end}을 누르면 멈춰. 그때 뭘 했는지 적어 줘!" },
  { target: "#controls", text: "{rest}을 누르면 타이머가 잠깐 멈춰. 다시 누르면 이어서 공부해." },
  { target: "#sidetab",  text: "여기를 누르면 {stats} 공부 시간, {todo} 공부 계획표, {settings} 설정이 있어!" },
  { target: "#sidetab",  num: 4, text: "레벨 업 하면 아이템이 생겨. {settings} 설정의 인벤토리에서 뗐다 붙였다 할 수 있어!" },
  { target: "#sidetab",  text: "튜토리얼은 {settings} 설정에서 언제든 다시 볼 수 있어. 그럼 시작해 볼까?", fly: true },
];
// the tutorial page in settings
const TUTORIAL_STEPS = [
  "1시간마다 캐릭터가 레벨 업을 해요!",
  "버닝 시간은 18시~0시로, 이때는 레벨 업이 더 빨라요! (50분에 1레벨)",
  "캐릭터당 최대 레벨은 10레벨이에요!",
  "아이템은 탈부착이 가능해요! {settings} 설정의 인벤토리에서 바꿀 수 있어요.",
  "{start}을 누르면 타이머가 작동되고, {end}을 누르면 타이머가 멈추는 동시에 자신이 무엇을 했는지 작성해요!",
];
