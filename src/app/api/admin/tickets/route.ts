import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost/dummy',
  max: 10,
});

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== 'Bearer haryana_admin_2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = `
      SELECT id, road_id, latitude, longitude, description, photo_url, status, escalation_level, created_at, updated_at
      FROM complaints
      ORDER BY created_at DESC;
    `;
    const res = await pool.query(query);

    return NextResponse.json({ tickets: res.rows });
  } catch (err: any) {
    console.error("Admin Fetch Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== 'Bearer haryana_admin_2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status } = await req.json();

    const updateQuery = `
      UPDATE complaints 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *;
    `;
    const res = await pool.query(updateQuery, [status, id]);

    return NextResponse.json({ success: true, ticket: res.rows[0] });
  } catch (err: any) {
    console.error("Admin Update Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
