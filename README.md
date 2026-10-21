# Pixel Pet

다마고치 + 학습 도움 웹앱 프로젝트.

## prototype/

| 경로 | 설명 |
| --- | --- |
| `prototype/pixel-pet.html` | 단일 파일 다마고치 게임 프로토타입 (180×320 픽셀 캔버스, 펫 3종: NORI / SORA / MOCHI, 스탯 4종: food / fun / energy / clean, localStorage 저장) |
| `prototype/studio/` | Pixel Pet Studio — 펫 애니메이션 프레임 픽셀 에디터 (`anims.json` 18개 모션 세트, `refs.json` + `ref_*.webp` 원본 참고 이미지) |

스튜디오는 `fetch()`로 JSON을 읽으므로 로컬 서버로 열어야 합니다:

```sh
cd prototype/studio && python3 -m http.server 8000
```
