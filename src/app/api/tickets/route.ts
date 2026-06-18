import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const latitude = parseFloat(formData.get('latitude') as string);
    const longitude = parseFloat(formData.get('longitude') as string);
    const description = formData.get('description') as string;
    const roadId = formData.get('road_id') as string;
    const photo = formData.get('photo') as File | null;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
    }

    let photoUrl = null;

    if (photo && photo.size > 0) {
      const arrayBuffer = await photo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = `${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

      const { data, error } = await supabase.storage
        .from('complaints')
        .upload(fileName, buffer, {
          contentType: photo.type,
          upsert: false,
        });

      if (error) {
        console.error("Storage upload error:", error);
        throw new Error("Failed to upload photo");
      }

      const { data: urlData } = supabase.storage
        .from('complaints')
        .getPublicUrl(fileName);
        
      photoUrl = urlData.publicUrl;
    }

    // Insert into PostgreSQL
    const insertQuery = `
      INSERT INTO complaints (road_id, latitude, longitude, description, photo_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at, status, photo_url;
    `;

    const res = await pool.query(insertQuery, [roadId, latitude, longitude, description, photoUrl]);

    return NextResponse.json({ success: true, ticket: res.rows[0] });

  } catch (err: any) {
    console.error("Ticket submission error:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
