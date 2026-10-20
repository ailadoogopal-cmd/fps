import sqlite3
import hashlib
import os
import sys
import json
from datetime import datetime, timedelta

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "krishi.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'seller',
        auth_type TEXT NOT NULL DEFAULT 'mobile',
        phone TEXT,
        email TEXT,
        password_hash TEXT NOT NULL,
        district TEXT,
        state TEXT,
        fpo_name TEXT,
        business_type TEXT,
        gst_number TEXT,
        avatar TEXT,
        latitude REAL DEFAULT 23.2033,
        longitude REAL DEFAULT 77.0844,
        credit_score INTEGER DEFAULT 760,
        is_approved INTEGER DEFAULT 1,
        kyc_status TEXT DEFAULT 'verified',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Listings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        crop_name TEXT NOT NULL,
        variety TEXT,
        category TEXT NOT NULL,
        quantity_quintals REAL NOT NULL,
        base_price REAL NOT NULL,
        sale_type TEXT NOT NULL CHECK(sale_type IN ('direct', 'auction')),
        grade TEXT NOT NULL DEFAULT 'Grade A',
        moisture_pct REAL DEFAULT 11.5,
        foreign_matter_pct REAL DEFAULT 0.8,
        location TEXT NOT NULL,
        state TEXT NOT NULL,
        harvest_date TEXT,
        description TEXT,
        image_url TEXT,
        latitude REAL DEFAULT 23.2033,
        longitude REAL DEFAULT 77.0844,
        is_organic INTEGER DEFAULT 0,
        is_fresh_verified INTEGER DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'in_negotiation', 'sold', 'closed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id)
    )
    """)

    # Bids Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL,
        buyer_id INTEGER NOT NULL,
        bid_price REAL NOT NULL,
        quantity REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'countered')),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listing_id) REFERENCES listings(id),
        FOREIGN KEY (buyer_id) REFERENCES users(id)
    )
    """)

    # Orders Table (Escrow and fulfillment with Logistics)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL,
        buyer_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        crop_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        final_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        escrow_status TEXT NOT NULL DEFAULT 'funded',
        delivery_status TEXT NOT NULL DEFAULT 'pending',
        transport_status TEXT NOT NULL DEFAULT 'pending_pickup',
        transporter_name TEXT DEFAULT 'Kisan Logistics Express',
        vehicle_no TEXT DEFAULT 'MP-04-GA-7821',
        driver_phone TEXT DEFAULT '9826011223',
        location_checkpoint TEXT DEFAULT 'Dispatched from Sehore Farmgate',
        est_delivery_date TEXT,
        tracking_id TEXT,
        payment_method TEXT DEFAULT 'upi_escrow',
        upi_ref_id TEXT,
        delivery_otp TEXT DEFAULT '4819',
        delivery_otp_verified INTEGER DEFAULT 0,
        cancellation_reason TEXT,
        refund_txn_id TEXT,
        refund_amount REAL DEFAULT 0,
        refund_status TEXT DEFAULT 'none',
        refund_time TEXT,
        confirmed_by_seller INTEGER DEFAULT 0,
        confirmed_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listing_id) REFERENCES listings(id),
        FOREIGN KEY (buyer_id) REFERENCES users(id),
        FOREIGN KEY (seller_id) REFERENCES users(id)
    )
    """)

    # Electronic Warehouse Receipts (e-NWR) & Pledge Loans
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS warehouse_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        receipt_no TEXT UNIQUE NOT NULL,
        warehouse_name TEXT NOT NULL,
        location TEXT NOT NULL,
        crop_name TEXT NOT NULL,
        quantity_quintals REAL NOT NULL,
        quality_grade TEXT NOT NULL,
        deposit_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        estimated_value REAL NOT NULL,
        max_loan_amount REAL NOT NULL,
        loan_status TEXT NOT NULL DEFAULT 'available' CHECK(loan_status IN ('available', 'applied', 'disbursed')),
        loan_amount REAL DEFAULT 0,
        bank_partner TEXT DEFAULT 'NABARD / SBI Agri Finance',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Contract Farming / Forward Buyback Requests
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        buyer_id INTEGER NOT NULL,
        crop_name TEXT NOT NULL,
        required_qty REAL NOT NULL,
        target_price_per_q REAL NOT NULL,
        advance_pct REAL DEFAULT 20.0,
        delivery_deadline TEXT NOT NULL,
        location TEXT NOT NULL,
        quality_specs TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'filled', 'expired')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES users(id)
    )
    """)

    # Live Mandi Prices Feed
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mandi_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commodity TEXT NOT NULL,
        variety TEXT,
        state TEXT NOT NULL,
        district TEXT NOT NULL,
        market TEXT NOT NULL,
        min_price REAL NOT NULL,
        max_price REAL NOT NULL,
        modal_price REAL NOT NULL,
        retail_price REAL NOT NULL,
        arrival_date TEXT NOT NULL,
        trend TEXT DEFAULT 'up' CHECK(trend IN ('up', 'down', 'stable')),
        arrivals_tonnes REAL DEFAULT 120.0,
        data_source TEXT DEFAULT 'live'
    )
    """)

    # 30-Day Historical Mandi Price Points for Forecasting
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mandi_price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commodity TEXT NOT NULL,
        market TEXT NOT NULL,
        price_date TEXT NOT NULL,
        modal_price REAL NOT NULL,
        arrivals_tonnes REAL DEFAULT 100.0
    )
    """)

    # WhatsApp & SMS Price Alert Subscriptions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS price_alert_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        commodity TEXT NOT NULL,
        target_condition TEXT NOT NULL DEFAULT 'any_change' CHECK(target_condition IN ('any_change', 'price_up', 'price_down')),
        channel TEXT NOT NULL DEFAULT 'both' CHECK(channel IN ('whatsapp', 'sms', 'both')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Notifications Log
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('price_alert', 'payment', 'order', 'system', 'advisory', 'community')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        channel TEXT NOT NULL CHECK(channel IN ('whatsapp', 'sms', 'both')),
        metadata_json TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Ratings & Reviews (Trust system)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        rated_user_id INTEGER NOT NULL,
        reviewer_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rated_user_id) REFERENCES users(id),
        FOREIGN KEY (reviewer_id) REFERENCES users(id)
    )
    """)

    # Community Discussion Forum (Farmer Q&A)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS community_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        crop_tag TEXT,
        upvotes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS community_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        answer_text TEXT NOT NULL,
        is_expert INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES community_posts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Government Schemes & Subsidies
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS schemes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        benefit_desc TEXT NOT NULL,
        subsidy_pct REAL DEFAULT 0,
        eligibility TEXT NOT NULL,
        apply_url TEXT,
        helpline TEXT
    )
    """)

    # Product Quality Assay Certificates (Laboratory Quality Testing)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quality_certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        listing_id INTEGER,
        certificate_no TEXT UNIQUE NOT NULL,
        inspector_name TEXT DEFAULT 'Krishi Quality Lab (NABL Accredited)',
        crop_name TEXT NOT NULL,
        variety TEXT DEFAULT 'Standard Grade',
        moisture_pct REAL NOT NULL,
        foreign_matter_pct REAL NOT NULL,
        damaged_grains_pct REAL DEFAULT 0.5,
        protein_pct REAL DEFAULT 12.0,
        admixture_pct REAL DEFAULT 0.2,
        assigned_grade TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved', 'rejected')),
        rejection_reason TEXT,
        lab_seal_hash TEXT,
        assayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
    )
    """)

    # Strong Payment & Escrow Transaction Ledger (UPI, NetBanking, RTGS, Refunds)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        txn_type TEXT NOT NULL CHECK(txn_type IN ('escrow_deposit', 'escrow_release', 'refund_instant', 'pledge_loan_disburse', 'advance_payout')),
        payment_method TEXT NOT NULL,
        amount REAL NOT NULL,
        fee REAL DEFAULT 0,
        utr_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('success', 'pending', 'refunded', 'failed')),
        sender_bank_acc TEXT,
        beneficiary_bank_acc TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Live Delivery GPS Checkpoints & Route Tracking
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS delivery_checkpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        checkpoint_title TEXT NOT NULL,
        location_name TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'in_transit', 'upcoming')),
        remarks TEXT,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
    )
    """)

    # Bulk Order Inquiries (For Wholesale Shops, Mills & Restaurants)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bulk_inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        buyer_id INTEGER,
        buyer_name TEXT NOT NULL,
        business_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        crop_name TEXT NOT NULL,
        quantity_quintals REAL NOT NULL,
        target_price REAL,
        delivery_city TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Order Disputes & Mediation (Admin Governance)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        raised_by INTEGER NOT NULL,
        reason TEXT NOT NULL,
        evidence_note TEXT,
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'resolved_refund', 'resolved_payout', 'dismissed')),
        resolution_note TEXT,
        resolved_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
    )
    """)

    # Run auto-migration for existing DBs that might lack newer columns
    migrate_columns_if_missing(cursor)

    conn.commit()
    seed_initial_data(conn)
    conn.close()

def migrate_columns_if_missing(cursor):
    # Check users table columns
    cursor.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in cursor.fetchall()]
    if "latitude" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN latitude REAL DEFAULT 23.2033")
    if "longitude" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN longitude REAL DEFAULT 77.0844")
    if "credit_score" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN credit_score INTEGER DEFAULT 760")
    if "is_approved" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 1")
    if "kyc_status" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN kyc_status TEXT DEFAULT 'verified'")

    # Check listings table columns
    cursor.execute("PRAGMA table_info(listings)")
    l_cols = [row[1] for row in cursor.fetchall()]
    if "latitude" not in l_cols:
        cursor.execute("ALTER TABLE listings ADD COLUMN latitude REAL DEFAULT 23.2033")
    if "longitude" not in l_cols:
        cursor.execute("ALTER TABLE listings ADD COLUMN longitude REAL DEFAULT 77.0844")
    if "is_organic" not in l_cols:
        cursor.execute("ALTER TABLE listings ADD COLUMN is_organic INTEGER DEFAULT 0")
    if "is_fresh_verified" not in l_cols:
        cursor.execute("ALTER TABLE listings ADD COLUMN is_fresh_verified INTEGER DEFAULT 1")

    # Check orders table columns
    cursor.execute("PRAGMA table_info(orders)")
    o_cols = [row[1] for row in cursor.fetchall()]
    if "transport_status" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN transport_status TEXT DEFAULT 'pending_pickup'")
    if "transporter_name" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN transporter_name TEXT DEFAULT 'Kisan Logistics Express'")
    if "vehicle_no" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN vehicle_no TEXT DEFAULT 'MP-04-GA-7821'")
    if "driver_phone" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN driver_phone TEXT DEFAULT '9826011223'")
    if "location_checkpoint" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN location_checkpoint TEXT DEFAULT 'Dispatched from Sehore Farmgate'")
    if "est_delivery_date" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN est_delivery_date TEXT")
    if "payment_method" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'upi_escrow'")
    if "upi_ref_id" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN upi_ref_id TEXT")
    if "delivery_otp" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN delivery_otp TEXT DEFAULT '4819'")
    if "delivery_otp_verified" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN delivery_otp_verified INTEGER DEFAULT 0")
    if "cancellation_reason" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN cancellation_reason TEXT")
    if "refund_txn_id" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN refund_txn_id TEXT")
    if "refund_amount" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN refund_amount REAL DEFAULT 0")
    if "refund_status" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN refund_status TEXT DEFAULT 'none'")
    if "refund_time" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN refund_time TEXT")
    if "confirmed_by_seller" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN confirmed_by_seller INTEGER DEFAULT 1")
    if "confirmed_at" not in o_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN confirmed_at TEXT")

    # Check mandi_prices table columns
    cursor.execute("PRAGMA table_info(mandi_prices)")
    m_cols = [row[1] for row in cursor.fetchall()]
    if "data_source" not in m_cols:
        cursor.execute("ALTER TABLE mandi_prices ADD COLUMN data_source TEXT DEFAULT 'live'")

    # Add wallet_balance to users if missing
    cursor.execute("PRAGMA table_info(users)")
    u_cols = [row[1] for row in cursor.fetchall()]
    if "wallet_balance" not in u_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0.0")

    # Create wallet_transactions table if not exists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        txn_type TEXT NOT NULL CHECK(txn_type IN ('deposit', 'withdrawal', 'escrow_lock', 'escrow_release', 'refund')),
        amount REAL NOT NULL,
        method TEXT DEFAULT 'upi',
        reference TEXT,
        note TEXT,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)


def seed_initial_data(conn):
    cursor = conn.cursor()

    # Check if users already exist
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        # Seed Demo Users with Coordinates
        demo_users = [
            (1, "Ramesh Kumar (Farmer)", "seller", "mobile", "9876543210", "ramesh.farmer@gmail.com", hash_password("pass123"), "Sehore", "Madhya Pradesh", "Sehore Kisan Producer Co.", None, None, "https://images.unsplash.com/photo-1595956553066-fe24a8c33395?w=150&auto=format&fit=crop&q=80", 23.2033, 77.0844, 785, 1, 'verified'),
            (2, "Sahyadri Farmers FPO", "seller", "gmail", "9822012345", "contact@sahyadrifarmers.org", hash_password("pass123"), "Nashik", "Maharashtra", "Sahyadri Agro Federation", None, None, "https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&auto=format&fit=crop&q=80", 19.9975, 73.7898, 810, 1, 'verified'),
            (3, "AgriCorp Trading Ltd", "buyer", "gmail", "9123456780", "procure@agricorptrading.com", hash_password("pass123"), "Indore", "Madhya Pradesh", None, "Wholesale Trader", "23AAACA1234A1Z5", "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=150&auto=format&fit=crop&q=80", 22.7196, 75.8577, 790, 1, 'verified'),
            (4, "GreenFoods Processing", "buyer", "mobile", "9988776655", "procurement@greenfoods.in", hash_password("pass123"), "Pune", "Maharashtra", None, "Food Processing & Retail", "27AAACB5678B1Z2", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80", 18.5204, 73.8567, 825, 1, 'verified'),
            (5, "KisanLakshmi Admin Officer", "admin", "gmail", "9800000000", "admin@kisanlakshmi.in", hash_password("pass123"), "New Delhi", "Delhi", "Central Mandi Directorate", "Government & Platform Admin", "07AAACB0000A1Z0", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", 28.6139, 77.2090, 850, 1, 'verified')
        ]

        for u in demo_users:
            cursor.execute("""
            INSERT OR REPLACE INTO users (id, name, role, auth_type, phone, email, password_hash, district, state, fpo_name, business_type, gst_number, avatar, latitude, longitude, credit_score, is_approved, kyc_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, u)

    # Seed Initial Listings if table is empty
    cursor.execute("SELECT COUNT(*) FROM listings WHERE status = 'active'")
    if cursor.fetchone()[0] == 0:
        initial_listings = [
            (1, "Wheat", "Sharbati Deluxe", "Grains & Cereals", 120.0, 2850.0, "direct", "Grade A+", 10.8, 0.5, "Sehore Farmgate Hub", "Madhya Pradesh", "2026-08-28", "Prime golden Sharbati wheat, sorted and cleaned. Lab verified moisture <11%.", "img_wheat.jpg", 23.2033, 77.0844, 1, 1, "active"),
            (2, "Soybean", "Yellow JS-9560", "Oilseeds", 200.0, 4750.0, "auction", "Grade A", 11.2, 0.8, "Indore APMC Yard", "Madhya Pradesh", "2026-08-25", "High-protein yellow soybean lot from Sahyadri FPO cluster. Suitable for oil expelling.", "img_soybean.jpg", 22.7196, 75.8577, 0, 1, "active"),
            (1, "Mustard", "Black Bold 42%", "Oilseeds", 75.0, 5450.0, "direct", "Grade A", 8.5, 0.6, "Alwar Mandi Hub", "Rajasthan", "2026-08-27", "High oil content bold black mustard seeds with zero admixture.", "img_mustard.jpg", 27.5530, 76.6346, 1, 1, "active"),
            (2, "Onion", "Nashik Red Garwa", "Vegetables", 300.0, 1920.0, "direct", "Grade B+", 13.0, 1.2, "Lasalgaon Mandi", "Maharashtra", "2026-08-29", "Export grade medium-large pink-red onions in 50kg mesh bags.", "img_onion.jpg", 20.1472, 74.2251, 0, 1, "active")
        ]
        for l in initial_listings:
            cursor.execute("""
            INSERT INTO listings (seller_id, crop_name, variety, category, quantity_quintals, base_price, sale_type, grade, moisture_pct, foreign_matter_pct, location, state, harvest_date, description, image_url, latitude, longitude, is_organic, is_fresh_verified, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, l)

    # Check Mandi Prices
    cursor.execute("SELECT COUNT(*) FROM mandi_prices")
    if cursor.fetchone()[0] == 0:
        today = datetime.now().strftime("%Y-%m-%d")
        mandi_data = [
            ("Wheat", "Sharbati Gold", "Madhya Pradesh", "Sehore", "Sehore APMC Mandi", 2600, 2950, 2820, 3800, today, "up", 420.5, "live"),
            ("Wheat", "Kalyan Sona", "Punjab", "Ludhiana", "Khanna Grain Market", 2250, 2480, 2390, 3200, today, "stable", 850.0, "live"),
            ("Paddy (Basmati)", "1121 Raw", "Haryana", "Karnal", "Karnal Mandi", 3900, 4450, 4280, 6500, today, "up", 310.0, "live"),
            ("Mustard", "Black Bold 42% Oil", "Rajasthan", "Alwar", "Alwar Mandi", 5200, 5680, 5540, 7200, today, "up", 180.2, "live"),
            ("Soybean", "Yellow JS-335", "Madhya Pradesh", "Indore", "Indore APMC Mandi", 4400, 4850, 4690, 6100, today, "down", 520.0, "live"),
            ("Cotton", "Shankar-6 Long Staple", "Gujarat", "Rajkot", "Rajkot Mandi", 6800, 7550, 7320, 9600, today, "up", 290.0, "live"),
            ("Onion", "Nashik Red Garwa", "Maharashtra", "Nashik", "Lasalgaon Mandi", 1400, 2100, 1850, 3200, today, "down", 950.0, "live"),
            ("Tomato", "Hybrid Special", "Karnataka", "Kolar", "Kolar APMC Market", 1600, 2400, 2050, 3500, today, "up", 410.0, "live"),
            ("Turmeric", "Salem Finger Unpolished", "Tamil Nadu", "Erode", "Erode Mandi", 12500, 15200, 14300, 19000, today, "up", 95.0, "live"),
            ("Maize", "Yellow Feed Grade", "Bihar", "Gulabbagh", "Purnea Mandi", 2100, 2380, 2260, 3100, today, "stable", 600.0, "live")
        ]

        for m in mandi_data:
            cursor.execute("""
            INSERT INTO mandi_prices (commodity, variety, state, district, market, min_price, max_price, modal_price, retail_price, arrival_date, trend, arrivals_tonnes, data_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, m)

    # Seed 30-Day Historical Price Points for Realistic Forecasting
    cursor.execute("SELECT COUNT(*) FROM mandi_price_history")
    if cursor.fetchone()[0] == 0:
        commodities_base = [
            ("Wheat", "Sehore APMC Mandi", 2700.0, 4.0),
            ("Soybean", "Indore APMC Mandi", 4800.0, -3.5),
            ("Paddy (Basmati)", "Karnal Mandi", 4100.0, 6.0),
            ("Mustard", "Alwar Mandi", 5400.0, 5.0),
            ("Onion", "Lasalgaon Mandi", 2050.0, -8.0),
            ("Cotton", "Rajkot Mandi", 7100.0, 7.5),
            ("Turmeric", "Erode Mandi", 13800.0, 15.0),
            ("Tomato", "Kolar APMC Market", 1850.0, 6.5),
            ("Maize", "Purnea Mandi", 2200.0, 2.0)
        ]
        
        now = datetime.now()
        for comm, mkt, base_p, trend_slope in commodities_base:
            for day_offset in range(30, -1, -1):
                p_date = (now - timedelta(days=day_offset)).strftime("%Y-%m-%d")
                # Linear trend with natural fluctuation
                noise = ((day_offset * 17 + 3) % 23) - 11
                day_price = round(base_p + ((30 - day_offset) * trend_slope) + noise, 1)
                arrivals = round(150.0 + ((day_offset * 13) % 80), 1)
                cursor.execute("""
                INSERT INTO mandi_price_history (commodity, market, price_date, modal_price, arrivals_tonnes)
                VALUES (?, ?, ?, ?, ?)
                """, (comm, mkt, p_date, day_price, arrivals))

    # Seed Ratings / Trust Reviews
    cursor.execute("SELECT COUNT(*) FROM ratings")
    if cursor.fetchone()[0] == 0:
        ratings_data = [
            (1, 1, 4, 5, "Exemplary Grade-A Sharbati Wheat! Moisture was under 11%, exact assay certificate match. Direct farmgate pickup went smooth.", "2026-08-20 14:30:00"),
            (2, 2, 3, 5, "Sahyadri FPO delivered 200 Q top quality Nashik onions in ventilated crates. Zero rot, transparent digital escrow.", "2026-08-22 11:15:00"),
            (3, 4, 1, 5, "Prompt payment release by GreenFoods. 100% trusted corporate buyer.", "2026-08-21 16:45:00"),
            (4, 1, 3, 4, "High protein grain lot. Timely loading at Sehore cluster hub.", "2026-08-24 10:00:00")
        ]
        for r in ratings_data:
            cursor.execute("""
            INSERT INTO ratings (order_id, rated_user_id, reviewer_id, rating, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, r)

    # Seed Community Posts & Q&A
    cursor.execute("SELECT COUNT(*) FROM community_posts")
    if cursor.fetchone()[0] == 0:
        posts_data = [
            (1, 1, "Yellow rust spotted in Lokwan wheat - What is the best organic spray?", "Pest & Disease", "I noticed yellowish stripes on upper leaves after recent humidity in Sehore district. Which bio-fungicide works best without residue?", "Wheat", 14, "2026-08-26 09:30:00"),
            (2, 2, "How to get 3% interest subsidy on e-NWR Warehouse pledge loans?", "Finance & Loan", "Can small farmers get NABARD interest subvention on gram/soybean stored in WDRA cold storage? What documents are required?", "General", 22, "2026-08-27 15:45:00"),
            (3, 1, "Best sowing window for Pusa Basmati 1121 in Malwa black soil?", "Agronomy", "Planning Basmati transplanting next month. What is optimal spacing and basal fertilizer dose?", "Paddy", 9, "2026-08-28 11:20:00")
        ]
        for p in posts_data:
            cursor.execute("""
            INSERT INTO community_posts (id, user_id, title, category, description, crop_tag, upvotes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, p)

        answers_data = [
            (1, 2, "Use Pseudomonas fluorescens @ 10g/L + Neem oil 1500ppm. If rust spread is high, apply Propiconazole 25% EC @ 1ml/L immediately before flag leaf emergence.", 1, 11),
            (2, 3, "Yes, PM Kisan pledge financing provides 3% subvention for up to 6 months for e-NWR receipts issued by WDRA-registered warehouses! Bring Land Record + e-NWR slip to any SBI Agri Branch.", 1, 18),
            (3, 2, "In Malwa soil, maintain 20cm x 15cm spacing. Apply 50kg DAP + 25kg Potash + 10kg Zinc Sulphate per acre as basal dose.", 0, 7)
        ]
        for a in answers_data:
            cursor.execute("""
            INSERT INTO community_answers (post_id, user_id, answer_text, is_expert, upvotes)
            VALUES (?, ?, ?, ?, ?)
            """, a)

    # Seed Government Schemes
    cursor.execute("SELECT COUNT(*) FROM schemes")
    if cursor.fetchone()[0] == 0:
        schemes_data = [
            ("e-NWR Pledge Loan Interest Subvention (AIF)", "Credit & Storage", "3% annual interest subsidy on warehouse loans up to ₹2 Crore for farmers & FPOs.", 3.0, "Farmers with WDRA electronic warehouse receipt", "https://agriinfra.dac.gov.in", "1800-180-1551"),
            ("PM Krishi Sinchayee Yojana (Drip Subsidy)", "Irrigation", "Up to 55% subsidy for small/marginal farmers for micro-irrigation and solar pumps.", 55.0, "All landholding farmers", "https://pmksy.gov.in", "1800-115-555"),
            ("PM Fasal Bima Yojana (Crop Insurance)", "Risk & Insurance", "Comprehensive crop loss protection against drought, flood, and pests with only 1.5%-2% premium.", 85.0, "Kharif & Rabi crop growers", "https://pmfby.gov.in", "1800-200-5142"),
            ("FPO Formation & Promotion Scheme", "Aggregation", "Financial grant of up to ₹18 Lakh per FPO + ₹2,000 equity grant per farmer member.", 100.0, "Farmer groups with minimum 300 members", "https://sfacindia.com", "011-26862367")
        ]
        for s in schemes_data:
            cursor.execute("""
            INSERT INTO schemes (name, category, benefit_desc, subsidy_pct, eligibility, apply_url, helpline)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, s)

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized and migrated successfully at:", DB_PATH)
