import pg from 'pg'

// 로컬 Postgres는 SSL이 없고, Neon(운영)은 SSL이 필수라 URL로 구분한다.
// 마이그레이션 러너(index.ts)도 같은 커넥션 규칙을 써야 하므로 여기서 export.
export const sslConfig = process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
})

// pool과 트랜잭션 중인 client가 같은 모양(.query)으로 쓰이도록 하는 최소 인터페이스.
// 라우트 헬퍼(setTripCities 등)가 트랜잭션 안팎 어디서 호출되든 동일하게 동작하게 해준다.
export interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>
}

// 여러 테이블에 걸친 다단계 쓰기(여행 생성, 보관함→일정 변환 등)를 원자적으로 실행한다.
// 중간에 하나라도 실패하면 전부 롤백 — 반쪽 데이터가 남는 걸 막는다.
export async function withTransaction<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

