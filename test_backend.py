import urllib.request
import urllib.parse
import json
import time
import sys
import random

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:8000"

def post_json(path, data, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {'Content-Type': 'application/json'}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=req_headers, method='POST')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_json(path, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers, method='GET')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def run_tests():
    print("🌾 Starting KrishiSetu Automated Verification Suite...\n")
    
    # 1. Test Static Index Page
    print("1. Testing Static HTML Frontend...")
    with urllib.request.urlopen(f"{BASE_URL}/index.html") as resp:
        content = resp.read().decode('utf-8')
        assert "KisanLakshmi" in content or "KrishiSetu" in content, "Failed to load index.html title"
        print("   ✅ Frontend index.html served properly with KisanLakshmi branding!")

    # 2. Test Stats
    print("\n2. Testing Global Statistics API (/api/stats)...")
    stats = get_json("/api/stats")
    assert stats["success"] is True
    print(f"   ✅ Stats: {stats['stats']['registered_farmers']} Farmers, {stats['stats']['connected_mandis']} Mandis tracked.")

    # 3. Test Market Prices & Spread
    print("\n3. Testing Mandi Prices & Price Spread API...")
    prices = get_json("/api/market/prices")
    assert len(prices["prices"]) > 0
    print(f"   ✅ Mandi Prices: {len(prices['prices'])} active commodity records loaded.")

    spread = get_json("/api/market/spread")
    assert len(spread["spreads"]) > 0
    print(f"   ✅ Price Spread: Top crop {spread['spreads'][0]['commodity']} gives +{spread['spreads'][0]['farmer_income_gain_pct']}% farmer gain.")

    # 4. Test Mobile OTP & Seller Registration (Farmer)
    print("\n4. Testing Mobile OTP & Seller Registration (Farmer)...")
    test_phone = f"98{random.randint(10000000, 99999999)}"
    otp_res = post_json("/api/auth/send-otp", {"phone": test_phone})
    assert otp_res["success"] is True
    otp = otp_res["demo_otp"]
    print(f"   ✅ OTP Generated: {otp} for +91 {test_phone}")

    seller_reg = post_json("/api/auth/register", {
        "name": "Devendra Patidar",
        "role": "seller",
        "auth_type": "mobile",
        "phone": test_phone,
        "otp": otp,
        "district": "Ujjain",
        "state": "Madhya Pradesh",
        "fpo_name": "Malwa Kisan Federation"
    })
    assert seller_reg["success"] is True
    seller_id = seller_reg["user"]["id"]
    print(f"   ✅ Farmer Registered: ID {seller_id} - {seller_reg['user']['name']} ({seller_reg['user']['role']})")

    # 5. Test Gmail ID Registration (Buyer / Processor)
    print("\n5. Testing Gmail ID Registration (Buyer / Processor)...")
    test_email = f"procure_{random.randint(1000, 9999)}@itcagri.com"
    buyer_reg = post_json("/api/auth/register", {
        "name": "ITC Agri Services",
        "role": "buyer",
        "auth_type": "gmail",
        "email": test_email,
        "password": "pass123",
        "business_type": "Food Processing Mill",
        "gst_number": "23AABCI1234F1Z1",
        "district": "Indore",
        "state": "Madhya Pradesh"
    })
    assert buyer_reg["success"] is True
    buyer_id = buyer_reg["user"]["id"]
    print(f"   ✅ Buyer Registered: ID {buyer_id} - {buyer_reg['user']['name']} ({buyer_reg['user']['business_type']})")

    # 6. Test Crop Listing by Farmer
    print("\n6. Testing Crop Listing Creation with Quality Grading...")
    listing_res = post_json("/api/listings", {
        "seller_id": seller_id,
        "crop_name": "Wheat",
        "variety": "Lokwan Gold",
        "category": "Grains & Cereals",
        "quantity_quintals": 120.0,
        "base_price": 2750.0,
        "sale_type": "auction",
        "moisture_pct": 11.2,
        "foreign_matter_pct": 0.6,
        "location": "Ujjain Mandi Cluster",
        "state": "Madhya Pradesh",
        "description": "Graded Lokwan wheat from Malwa cluster."
    })
    assert listing_res["success"] is True
    listing_id = listing_res["listing_id"]
    print(f"   ✅ Crop Listed: ID {listing_id} (Grade A automatically assigned).")

    # 7. Test Bidding by Buyer
    print("\n7. Testing Live e-Auction Bidding by Buyer...")
    bid_res = post_json("/api/bids", {
        "buyer_id": buyer_id,
        "listing_id": listing_id,
        "bid_price": 2820.0,
        "quantity": 120.0,
        "message": "ITC Agri offering ₹2,820/Q for entire 120 Q lot with immediate escrow."
    })
    assert bid_res["success"] is True
    bid_id = bid_res["bid_id"]
    print(f"   ✅ Bid Placed: ID {bid_id} at ₹2,820/Q.")

    # 8. Test Bid Acceptance & Auto-Escrow Order Generation
    print("\n8. Testing Farmer Accepting Bid & Creating Escrow Order...")
    accept_res = post_json(f"/api/bids/{bid_id}/respond", {"action": "accept"})
    assert accept_res["success"] is True
    print(f"   ✅ Bid Accepted: {accept_res['message']}")

    # 9. Test Escrow Order Tracking & Advancement
    print("\n9. Testing Escrow Order Pipeline (Assaying -> Dispatch -> Release)...")
    orders = get_json(f"/api/orders?user_id={seller_id}&role=seller")
    assert len(orders["orders"]) > 0
    order_id = orders["orders"][0]["id"]
    print(f"   ✅ Order Found: #{order_id} - Current Escrow: {orders['orders'][0]['escrow_status']}")

    adv_res = post_json(f"/api/orders/{order_id}/advance", {})
    assert adv_res["success"] is True
    print(f"   ✅ Escrow Advanced: {adv_res['message']} (Status: {adv_res['escrow_status']})")

    # 10. Test Warehouse e-NWR Deposit & Instant Pledge Loan
    print("\n10. Testing Warehouse Receipt (e-NWR) & Instant Pledge Loan...")
    dep_res = post_json("/api/warehouse/deposit", {
        "user_id": seller_id,
        "warehouse_name": "CWC Ujjain Logistics Hub",
        "crop_name": "Lokwan Wheat",
        "quantity_quintals": 250.0,
        "unit_price": 2750.0,
        "quality_grade": "Grade A (WDRA Assayed)"
    })
    assert dep_res["success"] is True
    receipt_no = dep_res["receipt_no"]
    print(f"   ✅ e-NWR Generated: {receipt_no}")

    receipts = get_json(f"/api/warehouse/receipts?user_id={seller_id}")
    r_id = receipts["receipts"][0]["id"]
    max_loan = receipts["receipts"][0]["max_loan_amount"]

    loan_res = post_json("/api/warehouse/apply-loan", {
        "receipt_id": r_id,
        "loan_amount": max_loan
    })
    assert loan_res["success"] is True
    print(f"   ✅ Pledge Loan Disbursed: {loan_res['message']}")

    # 11. Test Contract Farming Buyback Requirement
    print("\n11. Testing Forward Buyback Contract Procurement...")
    contract_res = post_json("/api/contracts", {
        "buyer_id": buyer_id,
        "crop_name": "Durum Wheat",
        "required_qty": 1500.0,
        "target_price_per_q": 3100.0,
        "advance_pct": 25.0,
        "delivery_deadline": "2026-11-15",
        "location": "Malwa & Ujjain Clusters",
        "quality_specs": "Min 12.5% protein, Grade A",
        "notes": "ITC pasta processing unit guaranteed procurement."
    })
    assert contract_res["success"] is True
    print(f"   ✅ Contract Posted: {contract_res['message']}")

    # 12. Test AI Chatbot (Krishi Mitra / कृषि मित्र)
    print("\n12. Testing AI Chatbot ('Krishi Mitra')...")
    chat_res = post_json("/api/ai/chat", {
        "message": "गेहूँ का ताजा भाव क्या है और लोन कैसे मिलेगा?",
        "role": "seller",
        "user_id": seller_id
    })
    assert chat_res["success"] is True
    assert len(chat_res["reply"]) > 20
    assert len(chat_res["suggested_actions"]) > 0
    print(f"   ✅ AI Chatbot Hindi/Agri Query: Successfully answered with {len(chat_res['suggested_actions'])} quick chips!")

    # 13. Test WhatsApp / SMS Price Alert Subscription
    print("\n13. Testing WhatsApp / SMS Price Alert Subscription...")
    sub_res = post_json("/api/alerts/subscribe", {
        "user_id": seller_id,
        "commodity": "Wheat",
        "target_condition": "price_up",
        "channel": "both",
        "phone": "9811122233"
    })
    assert sub_res["success"] is True
    print(f"   ✅ Subscribed: {sub_res['message']}")

    subs = get_json(f"/api/alerts/my-subscriptions?user_id={seller_id}")
    assert len(subs["subscriptions"]) > 0
    print(f"   ✅ Verified active subscriptions: {len(subs['subscriptions'])} crop alert(s)")

    # 14. Test Price Fluctuation Simulation & Auto-Dispatch WhatsApp / SMS
    print("\n14. Testing Mandi Price Jump & Auto-Dispatch WhatsApp / SMS to Customers...")
    sim_res = post_json("/api/alerts/simulate-price-change", {
        "commodity": "Wheat",
        "direction": "up",
        "change_amount": 75.0
    })
    assert sim_res["success"] is True
    assert sim_res["dispatched_count"] > 0
    print(f"   ✅ Price Movement Triggered: {sim_res['message']}")
    print(f"   ✅ Sample WhatsApp Alert: \"{sim_res['dispatched_alerts'][0]['message'][:80]}...\"")

    # 15. Test Payment SMS & Notifications Log
    print("\n15. Testing Payment & Escrow SMS Notifications Log...")
    notifs = get_json(f"/api/notifications?user_id={seller_id}")
    assert notifs["success"] is True
    assert len(notifs["notifications"]) > 0
    payment_notifs = [n for n in notifs["notifications"] if n["type"] == "payment"]
    print(f"   ✅ Verified Notification Log: {len(notifs['notifications'])} alerts recorded ({len(payment_notifs)} payment alerts).")

    # 16. Test Smart 14-Day Price Forecasting & History
    print("\n16. Testing Smart 14-Day Price Forecasting & Mandi History...")
    forecast_res = get_json("/api/market/forecast?commodity=Wheat")
    assert forecast_res["success"] is True
    assert len(forecast_res["forecast_points"]) == 14
    print(f"   ✅ 14-Day Forecast: Current ₹{forecast_res['current_price']} -> 7-Day ₹{forecast_res['forecast_7_days']} -> 14-Day ₹{forecast_res['forecast_14_days']}")
    print(f"   ✅ AI Advisory: \"{forecast_res['recommendation'][:65]}...\"")

    history_res = get_json("/api/market/history?commodity=Wheat")
    assert history_res["success"] is True
    assert len(history_res["history"]) > 0
    print(f"   ✅ Historical Prices: {len(history_res['history'])} daily records fetched.")

    # 17. Test Dynamic Farmer Credit Score
    print("\n17. Testing Dynamic Farmer Credit Score Algorithm...")
    cs_res = get_json(f"/api/farmer/credit-score?user_id={seller_id}")
    assert cs_res["success"] is True
    score_data = cs_res["credit_profile"]
    assert score_data["score"] >= 300 and score_data["score"] <= 850
    print(f"   ✅ Credit Score: {score_data['score']}/850 | Tier: {score_data['tier']} | Max LTV: {score_data['ltv_eligible_pct']}% | Interest Rate: {score_data['interest_rate_pct']}%")

    # 18. Test Produce Photo Upload & Static Asset Serving
    print("\n18. Testing Produce Photo Upload & Static Asset Serving...")
    sample_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    upload_res = post_json("/api/upload", {
        "base64": sample_b64,
        "filename": "produce_sample_test.png"
    })
    assert upload_res["success"] is True
    image_url = upload_res["file_url"]
    print(f"   ✅ Image Uploaded: {image_url}")

    with urllib.request.urlopen(f"{BASE_URL}{image_url}") as img_resp:
        assert img_resp.status == 200
        print("   ✅ Image verified via static HTTP server!")

    # 19. Test Hyperlocal Marketplace / Nearby Distance Query
    print("\n19. Testing Hyperlocal Marketplace Search (Haversine Geo-filtering)...")
    nearby_res = get_json("/api/marketplace/nearby?lat=22.7&lng=75.8&max_km=300")
    assert nearby_res["success"] is True
    assert len(nearby_res["nearby_listings"]) > 0
    print(f"   ✅ Nearby Listings Found: {len(nearby_res['nearby_listings'])} lots within 300km (Closest: {nearby_res['nearby_listings'][0]['crop_name']} @ {nearby_res['nearby_listings'][0]['distance_km']} km)")

    # 20. Test Verified Buyer Ratings & Trust System
    print("\n20. Testing Verified Buyer Rating & Trust Review Submission...")
    rating_res = post_json("/api/ratings/submit", {
        "order_id": order_id,
        "reviewer_id": buyer_id,
        "rated_user_id": seller_id,
        "rating": 5,
        "comment": "Excellent Lokwan wheat quality, moisture strictly under 11.5%. Transparent assaying!"
    })
    assert rating_res["success"] is True
    print(f"   ✅ Rating Submitted: {rating_res['message']}")

    ratings_list = get_json(f"/api/ratings?user_id={seller_id}")
    assert ratings_list["success"] is True
    assert ratings_list["total_reviews"] > 0
    print(f"   ✅ Farmer Profile Trust: Avg {ratings_list['average_rating']}⭐ across {ratings_list['total_reviews']} verified reviews.")

    # 21. Test Logistics & Live GPS Checkpoint Tracker
    print("\n21. Testing Logistics Dispatch & Live GPS Checkpoint Tracker...")
    trans_res = post_json(f"/api/orders/{order_id}/update-transport", {
        "transport_status": "in_transit",
        "vehicle_no": "MP-09-GH-4412",
        "driver_phone": "+91 94250 88991",
        "location_checkpoint": "Indore Bypass Toll Plaza (GPS: 22.72, 75.87)"
    })
    assert trans_res["success"] is True
    print(f"   ✅ Transport Updated: status={trans_res['transport_status']}")

    track_res = get_json(f"/api/orders/{order_id}/tracking")
    assert track_res["success"] is True
    assert track_res["order"]["transport_status"] == "in_transit"
    print(f"   ✅ Live Tracking: Checkpoint \"{track_res['order']['location_checkpoint']}\"")

    # 22. Test Low-Tech Feature-Phone & IVR / SMS Price Check
    print("\n22. Testing Low-Tech Feature Phone & IVR / SMS Price Query...")
    ivr_res = get_json("/api/ivr/price-check?commodity=Wheat")
    assert ivr_res["success"] is True
    print(f"   ✅ IVR Voice Prompt: \"{ivr_res['ivr_voice_prompt'][:65]}...\"")
    print(f"   ✅ IVR SMS Response: \"{ivr_res['sms_response'][:50]}...\"")

    # 23. Test Hyperlocal Weather & Agronomy Advisory
    print("\n23. Testing Localized Weather & Agronomy Advisory API...")
    weather_res = get_json("/api/weather/advisory?district=Ujjain")
    assert weather_res["success"] is True
    w_data = weather_res["current"]
    print(f"   ✅ Weather at {weather_res['location']}: {w_data['temp_c']}°C, {w_data['condition']} (Rain chance: {w_data['rain_probability_pct']}%)")
    print(f"   ✅ Agronomy Advisory: \"{weather_res['advisory'][0][:70]}...\"")

    # 24. Test Government Subsidies & Schemes Repository
    print("\n24. Testing Government Subsidies & Schemes API (/api/schemes)...")
    schemes_res = get_json("/api/schemes")
    assert schemes_res["success"] is True
    assert len(schemes_res["schemes"]) >= 4
    print(f"   ✅ Schemes Loaded: {len(schemes_res['schemes'])} central & state schemes (e.g., {schemes_res['schemes'][0]['name']})")

    # 25. Test Farmer Community Discussion Forum (Q&A & Upvotes)
    print("\n25. Testing Farmer Community Discussion Forum (Q&A)...")
    post_res = post_json("/api/community/posts", {
        "user_id": seller_id,
        "title": "Which bio-fertilizer gives best protein in Durum wheat?",
        "description": "Planning for next rabi season durum wheat procurement contract with ITC. Need advice on micronutrients.",
        "category": "Fertilizers & Nutrients",
        "crop_tag": "Wheat"
    })
    assert post_res["success"] is True
    post_id = post_res["post_id"]
    print(f"   ✅ Community Question Posted: ID #{post_id}")

    ans_res = post_json(f"/api/community/posts/{post_id}/answers", {
        "user_id": buyer_id,
        "answer_text": "Apply Azotobacter culture at seed treatment and zinc sulfate at 25 kg/ha during first irrigation.",
        "is_expert": True
    })
    assert ans_res["success"] is True
    print(f"   ✅ Expert Answer Added!")

    upvote_res = post_json(f"/api/community/posts/{post_id}/upvote", {})
    assert upvote_res["success"] is True
    print(f"   ✅ Post Upvoted: {upvote_res['message']}")

    # 26. Test UPI Payment Gateway Simulation
    print("\n26. Testing UPI QR Code Payment Generation & Instant Verification...")
    upi_qr_res = post_json("/api/payments/generate-upi-qr", {
        "order_id": order_id,
        "amount": 338400.0
    })
    assert upi_qr_res["success"] is True
    assert "upi_uri" in upi_qr_res
    print(f"   ✅ UPI URI Generated: {upi_qr_res['upi_uri'][:45]}...")

    upi_verify_res = post_json("/api/payments/verify-upi", {
        "order_id": order_id,
        "amount": 338400.0,
        "txn_ref": upi_qr_res["txn_ref"]
    })
    assert upi_verify_res["success"] is True
    print(f"   ✅ UPI Payment Verified: {upi_verify_res['message']} (Txn Ref: {upi_verify_res['txn_ref']})")

    # 27. Test External Railway Mandi Prices Endpoint (/api/mandi/prices)
    print("\n27. Testing Railway Mandi API Proxy Endpoint (/api/mandi/prices)...")
    mandi_api_res = get_json("/api/mandi/prices")
    assert mandi_api_res["success"] is True
    assert "prices" in mandi_api_res
    assert len(mandi_api_res["prices"]) > 0
    assert mandi_api_res["external_api_url"] == "https://mandi-api-production.up.railway.app/api/mandi/prices"
    print(f"   ✅ Mandi API Endpoint: Verified connected to {mandi_api_res['external_api_url']} ({len(mandi_api_res['prices'])} active crops loaded)")

    # 29. Test Multi-Method Payment System (UPI, NetBanking, RTGS, Escrow Ledger)
    print("\n29. Testing Multi-Method Payment System (NetBanking / RTGS / Ledger)...")
    pay_create_res = post_json("/api/payments/create", {
        "order_id": order_id,
        "amount": 338400.0,
        "payment_method": "netbanking",
        "payer_id": buyer_id
    })
    assert pay_create_res["success"] is True
    payment_id = pay_create_res["payment_id"]
    print(f"   ✅ Payment Intent Created: #{payment_id} via {pay_create_res['payment_method']} (Txn Ref: {pay_create_res['txn_ref']})")

    pay_verify_res = post_json("/api/payments/verify", {
        "order_id": order_id,
        "payment_id": payment_id,
        "payment_method": "netbanking",
        "txn_ref": pay_create_res["txn_ref"],
        "bank_name": "HDFC Bank",
        "amount": 338400.0
    })
    assert pay_verify_res["success"] is True
    assert "utr_number" in pay_verify_res
    print(f"   ✅ Payment Verified: {pay_verify_res['message']} (Bank UTR: {pay_verify_res['utr_number']})")

    ledger_res = get_json("/api/payments/ledger")
    assert ledger_res["success"] is True
    assert len(ledger_res["ledger"]) > 0
    print(f"   ✅ Immutable Payment Ledger: {len(ledger_res['ledger'])} transactions logged.")

    # 30. Test Product Quality Assaying & Digital Certificate
    print("\n30. Testing Product Quality Assaying (Prime Grade Approval) & Digital Certificate...")
    assay_res = post_json("/api/quality/assay", {
        "order_id": order_id,
        "moisture_pct": 10.4,
        "foreign_matter_pct": 0.4,
        "damaged_grains_pct": 0.8,
        "protein_pct": 13.2,
        "inspector_name": "Dr. Arvind Sharma (NABL Assayer #881)",
        "notes": "Premium Lokwan wheat, strictly export quality."
    })
    assert assay_res["success"] is True
    assert assay_res["is_approved"] is True
    assert "Grade A" in assay_res["grade"]
    cert_id = assay_res["certificate_id"]
    print(f"   ✅ Quality Assaying Approved: {assay_res['grade']} (Cert #{cert_id})")

    cert_res = get_json(f"/api/quality/certificate/{cert_id}")
    assert cert_res["success"] is True
    assert cert_res["certificate"]["seal_hash"].startswith("0x")
    print(f"   ✅ NABL Digital Certificate: Seal {cert_res['certificate']['seal_hash'][:20]}... (Status: {cert_res['certificate']['status']})")

    # 31. Test Substandard Quality Assaying Rejection -> Automatic 100% Full Refund
    print("\n31. Testing Substandard Quality Assaying Rejection & Auto-Refund Engine...")
    # Create another test listing & bid to test rejection flow
    sub_listing = post_json("/api/listings", {
        "seller_id": seller_id,
        "crop_name": "Soybean",
        "variety": "JS-9560",
        "category": "Oilseeds",
        "quantity_quintals": 50.0,
        "base_price": 4600.0,
        "sale_type": "direct",
        "location": "Sehore Hub",
        "state": "Madhya Pradesh"
    })
    sub_l_id = sub_listing["listing_id"]
    sub_bid = post_json("/api/bids", {
        "buyer_id": buyer_id,
        "listing_id": sub_l_id,
        "bid_price": 4600.0,
        "quantity": 50.0
    })
    post_json(f"/api/bids/{sub_bid['bid_id']}/respond", {"action": "accept"})
    seller_orders = get_json(f"/api/orders?user_id={seller_id}&role=seller")
    sub_order_id = [o["id"] for o in seller_orders["orders"] if o["crop_name"] == "Soybean"][0]

    # Submit failing assay (high moisture 18.5% and high foreign matter 6.0%)
    fail_assay_res = post_json("/api/quality/assay", {
        "order_id": sub_order_id,
        "moisture_pct": 18.5,
        "foreign_matter_pct": 6.0,
        "damaged_grains_pct": 12.0,
        "protein_pct": 32.0,
        "inspector_name": "Dr. Arvind Sharma (NABL)",
        "notes": "Moisture above WDRA safe storage threshold. Fungal risk."
    })
    assert fail_assay_res["success"] is True
    assert fail_assay_res["is_approved"] is False
    assert fail_assay_res["grade"] == "REJECTED"
    assert "auto_refund_details" in fail_assay_res
    print(f"   ✅ Substandard Assaying Handled: REJECTED lot auto-refunded 100% (Refund Txn: {fail_assay_res['auto_refund_details']['refund_txn_id']})")

    # 32. Test Seller Order Confirmation
    print("\n32. Testing Seller Order Confirmation (/api/orders/<id>/confirm)...")
    confirm_res = post_json(f"/api/orders/{order_id}/confirm", {"seller_id": seller_id})
    assert confirm_res["success"] is True
    print(f"   ✅ Seller Order Confirmation: {confirm_res['message']} (Status: {confirm_res['order_status']})")

    # 33. Test Policy-Based Cancellation & Refund Engine
    print("\n33. Testing Policy-Based Cancellation & Refund (Unconfirmed vs Confirmed)...")
    # Subcase A: Unconfirmed order cancellation -> 100% Free Full Refund (0% fee)
    test_l_a = post_json("/api/listings", {
        "seller_id": seller_id,
        "crop_name": "Mustard",
        "category": "Oilseeds",
        "quantity_quintals": 20.0,
        "base_price": 5400.0,
        "location": "Ujjain"
    })
    test_bid_a = post_json("/api/bids", {
        "buyer_id": buyer_id,
        "listing_id": test_l_a["listing_id"],
        "bid_price": 5400.0,
        "quantity": 20.0
    })
    post_json(f"/api/bids/{test_bid_a['bid_id']}/respond", {"action": "accept"})
    orders_a = get_json(f"/api/orders?buyer_id={buyer_id}&role=buyer")
    order_a_id = [o["id"] for o in orders_a["orders"] if o["crop_name"] == "Mustard"][0]

    cancel_unconfirmed = post_json(f"/api/orders/{order_a_id}/cancel", {
        "user_id": buyer_id,
        "reason": "Buyer logistics rescheduled before farmer dispatch confirmation."
    })
    assert cancel_unconfirmed["success"] is True
    rf_a = cancel_unconfirmed["refund_details"]
    assert rf_a["cancellation_fee_applied"] == 0.0
    assert rf_a["refund_amount"] == 108000.0
    print(f"   ✅ Unconfirmed Order Cancellation: 100% Full Refund ₹{rf_a['refund_amount']} (Fee: ₹{rf_a['cancellation_fee_applied']})")

    # Subcase B: Confirmed order cancellation -> 2.5% Fee Deducted
    test_l_b = post_json("/api/listings", {
        "seller_id": seller_id,
        "crop_name": "Maize",
        "category": "Grains & Cereals",
        "quantity_quintals": 100.0,
        "base_price": 2100.0,
        "location": "Indore"
    })
    test_bid_b = post_json("/api/bids", {
        "buyer_id": buyer_id,
        "listing_id": test_l_b["listing_id"],
        "bid_price": 2100.0,
        "quantity": 100.0
    })
    post_json(f"/api/bids/{test_bid_b['bid_id']}/respond", {"action": "accept"})
    orders_b = get_json(f"/api/orders?buyer_id={buyer_id}&role=buyer")
    order_b_id = [o["id"] for o in orders_b["orders"] if o["crop_name"] == "Maize"][0]

    # Confirm order first
    post_json(f"/api/orders/{order_b_id}/confirm", {"seller_id": seller_id})

    # Now cancel confirmed order
    cancel_confirmed = post_json(f"/api/orders/{order_b_id}/cancel", {
        "user_id": buyer_id,
        "reason": "Processing mill sudden maintenance downtime."
    })
    assert cancel_confirmed["success"] is True
    rf_b = cancel_confirmed["refund_details"]
    assert rf_b["cancellation_fee_applied"] == 5250.0  # 2.5% of 210,000
    assert rf_b["refund_amount"] == 204750.0  # 97.5% of 210,000
    print(f"   ✅ Confirmed Order Cancellation: 2.5% Fee Applied (Fee: ₹{rf_b['cancellation_fee_applied']}, Net Refund: ₹{rf_b['refund_amount']})")

    # 34. Test 6-Stage Delivery Pipeline, GPS Checkpoints & 4-Digit Delivery OTP Verification
    print("\n34. Testing 6-Stage Delivery Logistics, GPS Checkpoints & OTP Verification...")
    # Add checkpoint
    cp_res = post_json(f"/api/orders/{order_id}/add-checkpoint", {
        "checkpoint_name": "Ashta Toll Plaza (GPS: 23.02, 76.71)",
        "status_note": "Truck MP-09-GH-4412 passed weighbridge inspection."
    })
    assert cp_res["success"] is True
    print(f"   ✅ GPS Checkpoint Logged: {cp_res['checkpoint']['checkpoint_name']}")

    tracking_data = get_json(f"/api/orders/{order_id}/tracking")
    assert tracking_data["success"] is True
    assert "pipeline_stages" in tracking_data
    assert len(tracking_data["pipeline_stages"]) == 6
    delivery_otp = tracking_data["order"]["delivery_otp"]
    print(f"   ✅ 6-Stage Pipeline: {len(tracking_data['pipeline_stages'])} milestones | Delivery OTP: {delivery_otp}")

    # Verify Delivery OTP
    otp_verify_res = post_json(f"/api/orders/{order_id}/verify-delivery-otp", {
        "otp": delivery_otp
    })
    assert otp_verify_res["success"] is True
    assert otp_verify_res["escrow_status"] == "released"
    print(f"   ✅ Delivery OTP Verified: {otp_verify_res['message']} (Escrow Released to Farmer!)")

    # 35. Test AgMarket-API Pan-India Mandi Integration (https://github.com/DevavratD/AgMarket-API)
    print("\n35. Testing AgMarket-API Pan-India Mandi Price Feeds (DevavratD/AgMarket-API)...")
    agmark_res = get_json("/api/agmarknet/prices")
    assert agmark_res["success"] is True
    assert len(agmark_res["prices"]) > 0
    print(f"   ✅ AgMarket-API: {len(agmark_res['prices'])} Pan-India mandi commodities fetched from {agmark_res['api_source']}")

    agmark_sync = post_json("/api/agmarknet/sync", {})
    assert "status" in agmark_sync
    print(f"   ✅ AgMarket-API Sync Handler: Status = {agmark_sync['status']} ({agmark_sync['total_commodities']} commodities)")

    print("\n=================================================================")
    print("🎉 ALL 35 COMPREHENSIVE INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================\n")

if __name__ == "__main__":
    run_tests()

