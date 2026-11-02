# 장치 — 숫자 칸·능력 문단 후보 생성기

리추얼 기록(그리고 있으면 내 출석 기록·내 제출 현황) 파일을 읽어서, 숫자 칸과 능력별 문단 후보를 날짜·출처와 함께 다시 만듭니다. AI를 호출하지 않고, `candidates.json`에 미리 적어 둔(= 사람이 사실 확인하고 승인한) 문장 틀에 계산된 숫자만 채워 넣기 때문에, 같은 입력이면 항상 같은 결과가 나옵니다.

## 돌리는 방법 (세 단계)

```bash
# 1) 이 폴더(device)가 있는 채로, 리추얼 기록 등 입력 파일이 있는 폴더를 입력으로 지정합니다.
#    두 번째 인자는 결과를 저장할 폴더입니다(없으면 자동 생성).
node device/generate.mjs <입력 폴더> <결과 폴더>

# 예시: assignment12 루트를 입력으로 써서 device/last-result에 저장
node device/generate.mjs . device/last-result

# 2) 결과 확인
cat device/last-result/result.md

# 3) 재현 확인 — 같은 입력으로 다시 돌려 바이트까지 같은지 비교
node device/generate.mjs . device/check && diff device/last-result/result.json device/check/result.json && echo "OK: 동일함"
```

## 입력 파일

| 파일 | 필수 여부 | 찾는 방식 |
| --- | --- | --- |
| `ritual-history-*.json` (리추얼 기록) | 필수 | 입력 폴더에서 이름이 `ritual-history-`로 시작하는 `.json` 중 가장 마지막 것 |
| 내 출석 기록 | 선택 | 파일명에 "출석" 또는 "attendance"가 들어간 파일 |
| 내 제출 현황 | 선택 | 파일명에 "제출현황" 또는 "submissions"가 들어간 파일 |

두 파일을 입력 폴더에 넣으면 출석(출석/공가/결석 집계)과 제출 현황(마스터 승인 건수)도 숫자로 계산됩니다. 두 파일이 없으면 해당 숫자는 "자료 없음"으로만 표시됩니다.

## 출력

- `result.json` — 전체 결과(기계가 읽기 좋은 형태)
- `result.md` — 사람이 읽는 요약

## 문장 후보를 늘리거나 바꾸려면

1. `candidates.json`에 새 항목을 추가합니다. `template`에는 `{{weeksWithEntry}}` 같은 자리표시자를 쓸 수 있습니다(지원 목록은 `generate.mjs`의 `fillTemplate` 함수 참고).
2. 그 문장이 사실인지 먼저 확인합니다.
3. 사실이 맞으면 `approved.json`에 그 `id`를 추가합니다. **`approved.json`에 없는 문장은 결과에 "미승인(후보)"로만 표시되고, 사이트에는 올리지 않습니다.**

## 비밀값

이 장치는 API 키나 비밀값을 쓰지 않습니다(로컬 파일만 읽습니다). 혹시 나중에 AI 호출을 추가하더라도 키는 환경 변수로 읽게 하고, 이 README에는 변수 이름만 적어야 합니다(값 자체는 적지 않음).

## 확인한 것

- (2026-10-31) 같은 입력 폴더로 두 번 실행해 `result.json`이 바이트까지 동일함을 `diff`로 확인함.
- (2026-10-31) 완전히 새로운 임시 폴더에 `device/`와 `ritual-history-2026-10-29.json`만 복사해 위 "돌리는 방법" 그대로 실행 → 같은 결과가 나옴을 확인함.
- (2026-11-02) 출석 기록·제출 현황 파싱이 추가된 뒤, 완전히 새로운 임시 폴더에 `device/`와 세 입력 파일(`ritual-history-2026-10-29.json`, 출석 기록, 제출 현황)만 복사해 위 "돌리는 방법" 세 단계를 그대로 실행 → 같은 결과가 나옴을 다시 확인함.
