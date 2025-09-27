import requests
import random
import string
import sys
import time

# --- Configuration ---
BASE_URL = "http://127.0.0.1:8000/api"
STATE = {}  # Global dictionary to store state like tokens, IDs, etc.

# --- ANSI Colors for better output ---
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# --- Helper Functions ---

def generate_random_string(length=8):
    """Generates a random alphanumeric string."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def print_header(message):
    """Prints a formatted header."""
    print(f"\n{Colors.HEADER}{Colors.BOLD}===== {message.upper()} ====={Colors.ENDC}")

def make_request(method, endpoint, expected_status, name, data=None, headers=None):
    """A wrapper for making requests and handling responses."""
    print(f"{Colors.OKCYAN}--- Testing: {name}{Colors.ENDC}")
    url = f"{BASE_URL}{endpoint}"
    try:
        response = requests.request(method, url, json=data, headers=headers)
        if response.status_code == expected_status:
            print(f"{Colors.OKGREEN}SUCCESS ({response.status_code}){Colors.ENDC}")
            try:
                return response.json()
            except requests.exceptions.JSONDecodeError:
                return response.text
        else:
            print(f"{Colors.FAIL}FAILURE! Expected {expected_status}, got {response.status_code}{Colors.ENDC}")
            print(f"{Colors.WARNING}Response: {response.text}{Colors.ENDC}")
            sys.exit(1) # Stop the script on critical failure
    except requests.exceptions.RequestException as e:
        print(f"{Colors.FAIL}Request failed: {e}{Colors.ENDC}")
        sys.exit(1)

# --- Test Workflow Functions ---

def test_01_registration():
    print_header("Step 1: User Registration")
    
    rand = generate_random_string()
    STATE['admin_username'] = f"testadmin_{rand}"
    STATE['farmer_email'] = f"farmer_{rand}@test.com"
    STATE['fpo_email'] = f"fpo_{rand}@test.com"
    STATE['retailer_email'] = f"retailer_{rand}@test.com"

    admin_data = {"username": STATE['admin_username'], "password": "password123", "wallet_address": f"0xADMIN{rand.upper()}"}
    make_request("POST", "/admin/register/", 201, "Register Admin", data=admin_data)

    farmer_data = {"name": "Test Farmer", "email": STATE['farmer_email'], "password": "password123", "aadhaar_number": str(random.randint(10**11, 10**12 - 1)), "wallet_address": f"0xFARMER{rand.upper()}", "city": "Farmville", "state": "Fields"}
    make_request("POST", "/farmer/register/", 201, "Register Farmer", data=farmer_data)
    
    fpo_data = {"name": "Test FPO", "email": STATE['fpo_email'], "password": "password123", "corporate_identification_number": f"CIN{rand.upper()}", "wallet_address": f"0xFPO{rand.upper()}", "city": "Marketon", "state": "Commerce"}
    make_request("POST", "/fpo/register/", 201, "Register FPO", data=fpo_data)
    
    retailer_data = {"name": "Test Retailer", "email": STATE['retailer_email'], "password": "password123", "gstin": f"GSTIN{rand.upper()}", "wallet_address": f"0xRETAILER{rand.upper()}", "city": "Metropolis", "state": "Urban"}
    make_request("POST", "/retailer/register/", 201, "Register Retailer", data=retailer_data)

def test_02_admin_login_and_approval():
    print_header("Step 2: Admin Login and User Approval")

    login_data = {"username": STATE['admin_username'], "password": "password123", "role": "admin"}
    response = make_request("POST", "/token/", 200, "Admin Login", data=login_data)
    STATE['admin_token'] = response['access']
    admin_headers = {"Authorization": f"Bearer {STATE['admin_token']}"}

    pending_users = make_request("GET", "/admin/pending-registrations/", 200, "Get Pending Users", headers=admin_headers)
    
    STATE['farmer_id'] = next(f['id'] for f in pending_users['farmers'] if f['email'] == STATE['farmer_email'])
    STATE['fpo_id'] = next(f['id'] for f in pending_users['fpos'] if f['email'] == STATE['fpo_email'])
    STATE['retailer_id'] = next(r['id'] for r in pending_users['retailers'] if r['email'] == STATE['retailer_email'])
    
    make_request("POST", f"/admin/approve-farmer/{STATE['farmer_id']}/", 200, "Approve Farmer", headers=admin_headers)
    make_request("POST", f"/admin/approve-fpo/{STATE['fpo_id']}/", 200, "Approve FPO", headers=admin_headers)
    make_request("POST", f"/admin/approve-retailer/{STATE['retailer_id']}/", 200, "Approve Retailer", headers=admin_headers)

def test_03_user_logins():
    print_header("Step 3: Login for Approved Users")

    farmer_login = {"username": STATE['farmer_email'], "password": "password123", "role": "farmer"}
    res = make_request("POST", "/token/", 200, "Farmer Login", data=farmer_login)
    STATE['farmer_token'] = res['access']

    fpo_login = {"username": STATE['fpo_email'], "password": "password123", "role": "fpo"}
    res = make_request("POST", "/token/", 200, "FPO Login", data=fpo_login)
    STATE['fpo_token'] = res['access']

    retailer_login = {"username": STATE['retailer_email'], "password": "password123", "role": "retailer"}
    res = make_request("POST", "/token/", 200, "Retailer Login", data=retailer_login)
    STATE['retailer_token'] = res['access']

def test_04_farmer_fpo_workflow():
    print_header("Step 4: Farmer-FPO Bidding Workflow")
    farmer_headers = {"Authorization": f"Bearer {STATE['farmer_token']}"}
    fpo_headers = {"Authorization": f"Bearer {STATE['fpo_token']}"}

    # Farmer creates quote
    quote_data = {
        "product_name": "Organic Wheat", 
        "category": "Grains", 
        "description": "High quality organic wheat", 
        "quantity": "500.00", 
        "unit": "kg",
        "deadline": "2025-12-31"
    }
    res = make_request("POST", "/farmer/quotes/", 201, "Farmer Creates Quote", data=quote_data, headers=farmer_headers)
    STATE['farmer_quote_id'] = res['id']

    # FPO views open farmer quotes
    make_request("GET", "/fpo/quotes/farmer/open/", 200, "FPO Views Open Farmer Quotes", headers=fpo_headers)

    # FPO places bid on farmer quote
    bid_data = {
        "bid_amount": "20.50", 
        "delivery_time_days": 15, 
        "comments": "We can process your wheat efficiently."
    }
    res = make_request("POST", f"/fpo/quotes/farmer/{STATE['farmer_quote_id']}/bids/", 201, "FPO Places Bid", data=bid_data, headers=fpo_headers)
    STATE['fpo_bid_id'] = res['id']
    
    # Farmer accepts FPO bid
    make_request("POST", f"/farmer/bids/fpo/{STATE['fpo_bid_id']}/accept/", 200, "Farmer Accepts FPO Bid", headers=farmer_headers)

def test_05_fpo_retailer_workflow():
    print_header("Step 5: FPO-Retailer Bidding Workflow")
    fpo_headers = {"Authorization": f"Bearer {STATE['fpo_token']}"}
    retailer_headers = {"Authorization": f"Bearer {STATE['retailer_token']}"}

    # FPO creates quote for retailers
    quote_data = {
        "product_name": "Packaged Wheat Flour", 
        "category": "Processed Grains", 
        "description": "10kg bags of flour", 
        "quantity": "200.00", 
        "unit": "bags",
        "deadline": "2025-12-31"
    }
    res = make_request("POST", "/fpo/quotes/", 201, "FPO Creates Quote for Retailers", data=quote_data, headers=fpo_headers)
    STATE['fpo_quote_id'] = res['id']

    # Retailer views open FPO quotes
    make_request("GET", "/retailer/quotes/fpo/open/", 200, "Retailer Views Open FPO Quotes", headers=retailer_headers)

    # Retailer places bid on FPO quote
    bid_data = { 
        "bid_amount": "150.00", 
        "delivery_time_days": 10, 
        "comments": "We can distribute to our stores." 
    }
    res = make_request("POST", f"/retailer/quotes/fpo/{STATE['fpo_quote_id']}/bids/", 201, "Retailer Places Bid on FPO Quote", data=bid_data, headers=retailer_headers)
    STATE['retailer_bid_id'] = res['id']

    # FPO accepts retailer bid
    make_request("POST", f"/fpo/bids/retailer/{STATE['retailer_bid_id']}/accept/", 200, "FPO Accepts Retailer Bid", headers=fpo_headers)

def test_06_negotiation_workflow():
    print_header("Step 6: Negotiation Workflow (FPO-Retailer)")
    fpo_headers = {"Authorization": f"Bearer {STATE['fpo_token']}"}
    retailer_headers = {"Authorization": f"Bearer {STATE['retailer_token']}"}

    # 1. FPO creates a new quote specifically for this negotiation test
    quote_data = {
        "product_name": "Organic Barley Flour", 
        "category": "Processed Grains", 
        "description": "For negotiation test", 
        "quantity": "100.00", 
        "unit": "bags", 
        "deadline": "2025-11-30"
    }
    res = make_request("POST", "/fpo/quotes/", 201, "[NEGOTIATION] FPO Creates Quote", data=quote_data, headers=fpo_headers)
    negotiation_quote_id = res['id']

    # 2. Retailer places an initial bid on it
    bid_data = {
        "bid_amount": "80.00", 
        "delivery_time_days": 20, 
        "comments": "This bid will be negotiated."
    }
    res = make_request("POST", f"/retailer/quotes/fpo/{negotiation_quote_id}/bids/", 201, "[NEGOTIATION] Retailer Places Initial Bid", data=bid_data, headers=retailer_headers)
    negotiation_bid_id = res['id']
    
    # 3. FPO (the quote owner) starts a negotiation on the retailer's bid
    negotiation_start_data = {
        "content_type": "retailer.retailerbid", 
        "object_id": negotiation_bid_id
    }
    res = make_request("POST", "/negotiation/start/", 201, "[NEGOTIATION] FPO Starts Negotiation", data=negotiation_start_data, headers=fpo_headers)
    STATE['negotiation_id'] = res['id']
    
    # 4. Retailer (the bidder) sends a counter-offer
    counter_offer_data = {
        "message": "We can go up to 85.00 if you can deliver in 15 days.", 
        "counter_amount": "85.00", 
        "counter_delivery_time_days": 15
    }
    make_request("POST", f"/negotiation/{STATE['negotiation_id']}/", 201, "[NEGOTIATION] Retailer Sends Counter-Offer", data=counter_offer_data, headers=retailer_headers)

    # 5. FPO views the negotiation history to see the counter-offer
    res = make_request("GET", f"/negotiation/{STATE['negotiation_id']}/", 200, "[NEGOTIATION] FPO Views Negotiation Details", headers=fpo_headers)
    
    # 6. Verify the counter-offer is present
    last_message = res['messages'][-1]['message']
    if "85.00" in last_message and "15 days" in last_message:
        print(f"{Colors.OKGREEN}SUCCESS: Counter-offer message found in negotiation history.{Colors.ENDC}")
    else:
        print(f"{Colors.FAIL}FAILURE: Counter-offer message not found! Expected '85.00' and '15 days'. Got: {last_message}{Colors.ENDC}")
        sys.exit(1)


def main():
    """Run all test workflows in sequence."""
    start_time = time.time()
    
    test_01_registration()
    test_02_admin_login_and_approval()
    test_03_user_logins()
    test_04_farmer_fpo_workflow()
    test_05_fpo_retailer_workflow()
    test_06_negotiation_workflow()
    
    end_time = time.time()
    print_header(f"All tests passed in {end_time - start_time:.2f} seconds!")
    print(f"{Colors.OKGREEN}{Colors.BOLD}Backend is now fixed and fully tested.{Colors.ENDC}")

if __name__ == "__main__":
    main()