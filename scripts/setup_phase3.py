import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not found.")
    exit(1)

def setup_escalation_engine():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()

        print("Enabling pg_cron extension...")
        cur.execute("CREATE EXTENSION IF NOT EXISTS pg_cron;")

        print("Scheduling Escalation L1 -> L2...")
        cur.execute("""
            SELECT cron.schedule(
                'escalate_to_L2',
                '0 0 * * *',
                $$
                UPDATE complaints
                SET escalation_level = 'L2'
                WHERE status = 'open' 
                AND escalation_level = 'L1' 
                AND created_at < NOW() - INTERVAL '30 days'
                $$
            );
        """)

        print("Scheduling Escalation L2 -> L3...")
        cur.execute("""
            SELECT cron.schedule(
                'escalate_to_L3',
                '0 0 * * *',
                $$
                UPDATE complaints
                SET escalation_level = 'L3'
                WHERE status = 'open' 
                AND escalation_level = 'L2' 
                AND created_at < NOW() - INTERVAL '60 days'
                $$
            );
        """)

        print("Escalation Engine successfully configured!")
        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error setting up escalation engine: {e}")

if __name__ == "__main__":
    setup_escalation_engine()
