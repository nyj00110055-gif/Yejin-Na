# 매장 인사이트

첨부된 `매장판매실적.xlsx`의 2026년 7–9월 판매 내역 1,017건을 분석하는 한국어 대시보드입니다. 빌드나 JavaScript 패키지 설치 없이 정적 HTTP 서버에서 실행됩니다.

## 실행

```sh
cd /workspace/Yejin-Na
python3 -m http.server 8000 --bind 0.0.0.0
```

브라우저에서 서버의 `index.html`을 열면 됩니다. JSON을 fetch하므로 파일을 직접 여는 `file://` 방식 대신 HTTP 서버를 사용하세요. GitHub Pages에도 배포할 수 있는 정적 파일 구조입니다. 글꼴은 Google Fonts 연결이 가능할 때 적용하며, 연결이 없어도 시스템 글꼴로 작동합니다.

## 기능

- 분기 / 월 / 직접 설정 기간, 지역, 매장, 상품군 필터
- 총매출, 판매 수량, 단위당 평균 매출, 판매 매장 수
- 일·주·월별 매출 그래프, 상품군 매출 비중, 상위 5개 매장, 지역별 실적
- 상세 내역 검색, 날짜·수량·매출 정렬, 페이지 이동
- 필터와 검색 결과 전체의 Excel 호환 UTF-8 BOM CSV 다운로드
- 모바일 레이아웃, 키보드 접근, 빈 결과와 로딩 실패 안내

## 데이터 기준

`data/sales.json`은 제공된 Excel에서 변환한 실제 데이터입니다. 전체 매출은 **515,999,400원**, 기재된 수량 합계는 **1,722개**입니다. 날짜와 지역 표기, 금액 문자열을 정규화했습니다. 중복 행은 원본 그대로 보존하며, 수량 누락 5건을 임의로 보정하지 않습니다. 총매출에는 모든 행을 포함하고 단위당 평균 매출은 수량이 있는 행의 매출 합계 / 수량 합계로 계산합니다. 검색은 상세 표와 CSV에만 추가로 적용됩니다. 주별 집계는 월요일 시작이며 경계 주는 부분 기간입니다. 비교 기간이나 목표 데이터가 없어 성장률과 목표 달성률은 생성하지 않습니다.

데이터를 다시 변환하려면 Python의 `openpyxl`이 필요합니다. 변환 스크립트는 Excel의 텍스트를 데이터로만 처리합니다.

```sh
python3 -m pip install openpyxl==3.1.5
python3 scripts/prepare_data.py /path/to/매장판매실적.xlsx
```

원본 Excel 파일은 저장소에 포함하지 않습니다. 변환된 판매 데이터는 정적 사이트의 일부로 제공됩니다.

## 브라우저 검증

Node.js와 Playwright를 사용합니다. 개발 도구를 별도로 설치한 경우 다음과 같이 실행하세요. 대시보드 실행 자체에는 Node.js가 필요하지 않습니다.

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
# 별도 터미널에서 위 HTTP 서버를 먼저 실행합니다.
node tests/dashboard.cjs
# 시스템 Chromium 사용 시:
CHROMIUM_PATH=/usr/bin/chromium node tests/dashboard.cjs
```

검증 범위: 원본 집계, 필터 조합과 매장 연동, 일/주/월 차트, 직접 설정 날짜, 빈 결과와 잘못된 기간, 검색, 정렬, 페이지 이동, 다운로드된 CSV, 모바일 가로 넘침, 데이터 로딩 실패.

## Vercel 배포

이 저장소를 Vercel 프로젝트에 연결하고 Production Branch를 `main`, Root Directory를 저장소 루트로 설정하세요. `vercel.json`에 프레임워크 자동 감지 해제, 빌드 명령 `node scripts/build.cjs`, 배포 폴더 `dist`가 지정되어 있습니다. 외부 패키지 설치나 환경변수 없이 빌드됩니다. Git 연동이 활성화되어 있으면 `main` 푸시가 새 배포를 시작합니다.

로컬에서 배포 산출물을 확인하려면:

```sh
node scripts/build.cjs
python3 -m http.server 8000 --bind 0.0.0.0 --directory dist
```

배포 산출물은 `index.html`, `styles.css`, `app.js`, `data-source.js`, `runtime-config.js`, `data/sales.json`입니다. 테스트 코드와 데이터 변환 도구, README는 포함하지 않습니다.

## Supabase 실제 데이터 연결

설정과 데이터 입력 순서는 [Supabase 연결 안내](supabase/README.md)를 확인하세요. `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`를 Vercel 환경변수로 지정하면 빌드된 대시보드가 `public.store_sales`에서 모든 행을 페이지별로 조회합니다. `runtime-config.js`는 공개 publishable key만 포함하며 secret/service_role 키를 허용하지 않습니다. Vercel 빌드의 기본 연결은 제공된 Supabase 프로젝트의 공개 설정입니다. `SALES_DATA_SOURCE=snapshot`으로 저장본 모드를 명시할 수 있고, 빌드하지 않은 루트 실행은 저장본 모드입니다. 화면에서 현재 출처를 구분합니다.

DB의 새 데이터를 확인하려면 **데이터 새로고침**을 누르세요. 실제 DB 연결 오류를 Excel 데이터로 숨기지 않습니다. 판매 기간 필터는 DB의 날짜 범위에서 생성합니다. SQL과 테스트·변환 도구는 Vercel 배포 파일에 포함하지 않습니다.

Supabase 브라우저 연결 테스트(실제 DB 대신 모의 HTTP 응답 사용):

```sh
SALES_DATA_SOURCE=snapshot node scripts/build.cjs
# 별도 터미널에서 dist를 8001 포트로 제공합니다.
python3 -m http.server 8001 --directory dist
DASHBOARD_URL=http://127.0.0.1:8001 CHROMIUM_PATH=/usr/bin/chromium node tests/supabase.cjs
```

로컬 Supabase 모드 빌드는 실제 공개 키를 프로세스 환경변수로 설정한 뒤 `node scripts/build.cjs`를 실행하세요. `.env` 파일은 자동 로드하지 않습니다. 생성된 `dist/runtime-config.js`와 로컬 `.env`는 커밋하지 않습니다. 모의 테스트는 실제 프로젝트의 키, RLS, 데이터 입력 또는 Vercel 배포 성공을 검증하지 않습니다.
