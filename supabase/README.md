# Supabase 연결 순서

프로젝트: `dmctdaeownfrodkahhxy`  
API URL: `https://dmctdaeownfrodkahhxy.supabase.co`  
관리 화면 URL(`/dashboard/project/...`)은 API URL 또는 키가 아닙니다.

1. Supabase **SQL Editor**에서 [001_store_sales.sql](001_store_sales.sql)을 실행합니다. 새 `public.store_sales` 테이블, RLS, 공개 읽기 전용 정책을 만듭니다. 현재 공개 대시보드의 접근 방식에 맞춰 익명 SELECT를 허용합니다. 데이터는 로그인 없이 조회되므로 내부 전용 데이터라면 이 정책을 적용하기 전에 로그인 기반 접근으로 변경해야 합니다. 브라우저에서는 쓰기를 할 수 없습니다. 기존 프로젝트에 같은 이름의 테이블이 있다면 스키마를 먼저 확인하세요.
2. [002_seed.sql](002_seed.sql) 전체를 SQL Editor에서 실행합니다. 원본 1,017건을 입력합니다. 마지막 결과는 `records=1017`, `revenue=515999400`, `quantity=1722`, `missing_quantity=5`입니다. 같은 ID가 있으면 건너뛰므로 반복 실행해도 기존 수정 내용을 덮어쓰지 않습니다.
3. Supabase **Settings → API Keys**에서 Publishable key(`sb_publishable_...`)를 확인합니다. secret key와 service_role은 사용하지 않습니다.
4. 제공받은 공개 Project URL과 publishable key는 `public-config.json`에 반영되어 있어 Vercel 환경변수를 따로 설정하지 않아도 빌드에 포함됩니다. 설정을 덮어쓰려면 Vercel 프로젝트 **Settings → Environment Variables**에 다음 두 값을 Production 환경에 추가합니다. Preview에서도 DB를 사용하려면 Preview에도 추가하세요.

   | 이름 | 값 |
   |---|---|
   | `SUPABASE_URL` | `https://dmctdaeownfrodkahhxy.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | 실제 `sb_publishable_...` 값 |

5. Vercel **Deployments → Redeploy**를 실행합니다. 저장만으로 기존 배포의 빌드 설정이 바뀌지는 않습니다. `main` 최신 커밋을 배포해야 합니다.
6. 화면 상단이 **Supabase DB 연결됨**인지 확인하고 데이터 건수와 매출 합계를 대조합니다. DB를 수정한 후 **데이터 새로고침**을 누르면 새로 조회됩니다. 실시간 구독 방식은 아닙니다.

## 동작과 진단

- Vercel 빌드는 기본적으로 제공된 프로젝트의 공개 연결 설정(`public-config.json`)을 사용합니다. 환경변수 두 개로 다른 공개 연결 정보로 덮어쓸 수 있습니다. `SALES_DATA_SOURCE=snapshot`을 지정하면 Excel 저장본 모드를 선택할 수 있습니다. 빌드 없이 루트에서 실행할 때는 `runtime-config.js`의 로컬 기본값인 저장본 모드입니다. 한쪽만 지정하거나 관리 화면 URL, secret/service_role 키를 지정하면 빌드가 실패합니다.
- publishable key는 브라우저용 공개 식별자로, 빌드 결과 `runtime-config.js`에 포함됩니다. 데이터 접근은 키의 비밀성 대신 RLS로 제어합니다.
- Supabase 모드에서는 DB 요청 실패 시 오류를 표시합니다. Excel 저장본으로 자동 전환하지 않습니다.
- 빈 결과는 테이블이 비었거나 RLS 때문에 읽을 수 없는 경우일 수 있습니다. SQL 실행 여부와 정책을 확인하세요.
- 기본 1,000행 제한에 맞춰 페이지별로 읽어 1,017건 전체를 집계합니다. 페이지 사이에 총건수가 달라지거나 ID가 겹치면 다시 불러오도록 안내합니다. 여러 요청은 DB 트랜잭션 스냅샷이 아니므로 대량 동시 수정 중의 일관성을 보장하지는 않습니다.
- 기간 필터와 차트 범위는 읽어온 데이터의 실제 날짜에 맞춰 생성합니다.
- 새 기록은 Supabase Table Editor 또는 별도 인증된 관리 절차에서 입력합니다. 대시보드는 읽기 전용입니다.
- SQL 생성 도구: `node scripts/generate-seed.cjs`. 원본 JSON에서 재생성하며 키나 인증 정보를 포함하지 않습니다.

## 현재 확인할 수 없는 사항

실제 publishable key는 제공되어 공개 클라이언트 설정에 반영했습니다. 프로젝트 관리 인증은 없어 DB 마이그레이션 및 데이터 입력은 원격에서 실행하지 않았습니다. 저장소에는 실행할 SQL과 연결 구현을 준비했습니다. 실서비스 연동 완료 여부는 SQL 실행, Vercel 환경변수 적용·재배포 후 실제 응답으로 확인해야 합니다.
