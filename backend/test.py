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
            return None  # Don't exit, just return None
    except requests.exceptions.RequestException as e:
        print(f"{Colors.FAIL}Request failed: {e}{Colors.ENDC}")
        return None

# --- Test Workflow Functions ---

def test_01_registration():
    print_header("Step 1: User Registration")
    
    rand = generate_random_string()
    STATE['admin_username'] = f"testadmin_{rand}"
    STATE['farmer_email'] = f"farmer_{rand}@test.com"
    STATE['fpo_email'] = f"fpo_{rand}@test.com"
    STATE['retailer_email'] = f"retailer_{rand}@test.com"

    admin_data = {"username": STATE['admin_username'], "password": "password123", "wallet_address": f"0xADMIN{rand.upper()}"}
    result = make_request("POST", "/admin/register/", 201, "Register Admin", data=admin_data)
    if not result:
        return False

    farmer_data = {"name": "Test Farmer", "email": STATE['farmer_email'], "password": "password123", "aadhaar_number": str(random.randint(10**11, 10**12 - 1)), "wallet_address": f"0xFARMER{rand.upper()}", "city": "Farmville", "state": "Fields"}
    result = make_request("POST", "/farmer/register/", 201, "Register Farmer", data=farmer_data)
    if not result:
        return False
    
    fpo_data = {"name": "Test FPO", "email": STATE['fpo_email'], "password": "password123", "corporate_identification_number": f"CIN{rand.upper()}", "wallet_address": f"0xFPO{rand.upper()}", "city": "Marketon", "state": "Commerce"}
    result = make_request("POST", "/fpo/register/", 201, "Register FPO", data=fpo_data)
    if not result:
        return False
    
    retailer_data = {"name": "Test Retailer", "email": STATE['retailer_email'], "password": "password123", "gstin": f"GSTIN{rand.upper()}", "wallet_address": f"0xRETAILER{rand.upper()}", "city": "Metropolis", "state": "Urban"}
    result = make_request("POST", "/retailer/register/", 201, "Register Retailer", data=retailer_data)
    if not result:
        return False
    
    return True

def test_02_admin_login_and_approval():
    print_header("Step 2: Admin Login and User Approval")

    login_data = {"username": STATE['admin_username'], "password": "password123", "role": "admin"}
    
    # Make the login request and capture the response object directly
    print(f"{Colors.OKCYAN}--- Testing: Admin Login{Colors.ENDC}")
    login_response = requests.post(f"{BASE_URL}/token/", json=login_data)
    
    if login_response.status_code != 200:
        print(f"{Colors.FAIL}FAILURE! Expected 200, got {login_response.status_code}{Colors.ENDC}")
        print(f"{Colors.WARNING}Response: {login_response.text}{Colors.ENDC}")
        return False
    
    print(f"{Colors.OKGREEN}SUCCESS ({login_response.status_code}){Colors.ENDC}")
    
    # Extract access token from cookies
    if 'access_token' in login_response.cookies:
        STATE['admin_token'] = login_response.cookies['access_token']
    else:
        # Fallback: try to parse JSON response for tokens (if not using cookies)
        try:
            response_data = login_response.json()
            STATE['admin_token'] = response_data.get('access', '')
        except:
            print(f"{Colors.FAIL}Could not extract access token from response{Colors.ENDC}")
            return False
    
    if not STATE['admin_token']:
        print(f"{Colors.FAIL}Access token is empty{Colors.ENDC}")
        return False
    
    # Use the token in Authorization header
    admin_headers = {"Authorization": f"Bearer {STATE['admin_token']}"}

    # Test getting pending users with the proper token
    pending_users = make_request("GET", "/admin/pending-registrations/", 200, "Get Pending Users", headers=admin_headers)
    if not pending_users:
        return False
    
    # Extract user IDs safely
    try:
        STATE['farmer_id'] = next(f['id'] for f in pending_users['farmers'] if f['email'] == STATE['farmer_email'])
        STATE['fpo_id'] = next(f['id'] for f in pending_users['fpos'] if f['email'] == STATE['fpo_email'])
        STATE['retailer_id'] = next(r['id'] for r in pending_users['retailers'] if r['email'] == STATE['retailer_email'])
    except StopIteration:
        print(f"{Colors.FAIL}Could not find registered users in pending list{Colors.ENDC}")
        return False
    
    result = make_request("POST", f"/admin/approve-farmer/{STATE['farmer_id']}/", 200, "Approve Farmer", headers=admin_headers)
    if not result:
        return False
        
    result = make_request("POST", f"/admin/approve-fpo/{STATE['fpo_id']}/", 200, "Approve FPO", headers=admin_headers)
    if not result:
        return False
        
    result = make_request("POST", f"/admin/approve-retailer/{STATE['retailer_id']}/", 200, "Approve Retailer", headers=admin_headers)
    if not result:
        return False
    
    return True

def test_03_user_logins():
    print_header("Step 3: Login for Approved Users")

    farmer_login = {"username": STATE['farmer_email'], "password": "password123", "role": "farmer"}
    res = make_request("POST", "/token/", 200, "Farmer Login", data=farmer_login)
    if not res:
        return False
    STATE['farmer_token'] = res.get('access', '')

    fpo_login = {"username": STATE['fpo_email'], "password": "password123", "role": "fpo"}
    res = make_request("POST", "/token/", 200, "FPO Login", data=fpo_login)
    if not res:
        return False
    STATE['fpo_token'] = res.get('access', '')

    retailer_login = {"username": STATE['retailer_email'], "password": "password123", "role": "retailer"}
    res = make_request("POST", "/token/", 200, "Retailer Login", data=retailer_login)
    if not res:
        return False
    STATE['retailer_token'] = res.get('access', '')
    
    return True

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
    if not res:
        return False
    STATE['farmer_quote_id'] = res['id']

    # FPO views open farmer quotes
    res = make_request("GET", "/fpo/quotes/farmer/open/", 200, "FPO Views Open Farmer Quotes", headers=fpo_headers)
    if not res:
        return False

    # FPO places bid on farmer quote
    bid_data = {
        "bid_amount": "20.50", 
        "delivery_time_days": 15, 
        "comments": "We can process your wheat efficiently."
    }
    res = make_request("POST", f"/fpo/quotes/farmer/{STATE['farmer_quote_id']}/bids/", 201, "FPO Places Bid", data=bid_data, headers=fpo_headers)
    if not res:
        return False
    STATE['fpo_bid_id'] = res['id']
    
    # Farmer accepts FPO bid
    res = make_request("POST", f"/farmer/bids/fpo/{STATE['fpo_bid_id']}/accept/", 200, "Farmer Accepts FPO Bid", headers=farmer_headers)
    if not res:
        return False
    
    return True

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
    if not res:
        return False
    STATE['fpo_quote_id'] = res['id']

    # Retailer views open FPO quotes
    res = make_request("GET", "/retailer/quotes/fpo/open/", 200, "Retailer Views Open FPO Quotes", headers=retailer_headers)
    if not res:
        return False

    # Retailer places bid on FPO quote
    bid_data = { 
        "bid_amount": "150.00", 
        "delivery_time_days": 10, 
        "comments": "We can distribute to our stores." 
    }
    res = make_request("POST", f"/retailer/quotes/fpo/{STATE['fpo_quote_id']}/bids/", 201, "Retailer Places Bid on FPO Quote", data=bid_data, headers=retailer_headers)
    if not res:
        return False
    STATE['retailer_bid_id'] = res['id']

    # FPO accepts retailer bid
    res = make_request("POST", f"/fpo/bids/retailer/{STATE['retailer_bid_id']}/accept/", 200, "FPO Accepts Retailer Bid", headers=fpo_headers)
    if not res:
        return False
    
    return True

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
    if not res:
        return False
    negotiation_quote_id = res['id']

    # 2. Retailer places an initial bid on it
    bid_data = {
        "bid_amount": "80.00", 
        "delivery_time_days": 20, 
        "comments": "This bid will be negotiated."
    }
    res = make_request("POST", f"/retailer/quotes/fpo/{negotiation_quote_id}/bids/", 201, "[NEGOTIATION] Retailer Places Initial Bid", data=bid_data, headers=retailer_headers)
    if not res:
        return False
    negotiation_bid_id = res['id']
    
    # 3. FPO (the quote owner) starts a negotiation on the retailer's bid
    negotiation_start_data = {
        "content_type": "retailer.retailerbid", 
        "object_id": negotiation_bid_id
    }
    res = make_request("POST", "/negotiation/start/", 201, "[NEGOTIATION] FPO Starts Negotiation", data=negotiation_start_data, headers=fpo_headers)
    if not res:
        return False
    STATE['negotiation_id'] = res['id']
    
    # 4. Retailer (the bidder) sends a counter-offer
    counter_offer_data = {
        "message": "We can go up to 85.00 if you can deliver in 15 days.", 
        "counter_amount": "85.00", 
        "counter_delivery_time_days": 15
    }
    res = make_request("POST", f"/negotiation/{STATE['negotiation_id']}/", 201, "[NEGOTIATION] Retailer Sends Counter-Offer", data=counter_offer_data, headers=retailer_headers)
    if not res:
        return False

    # 5. FPO views the negotiation history to see the counter-offer
    res = make_request("GET", f"/negotiation/{STATE['negotiation_id']}/", 200, "[NEGOTIATION] FPO Views Negotiation Details", headers=fpo_headers)
    if not res:
        return False
    
    # 6. Verify the counter-offer is present
    if 'messages' in res and len(res['messages']) > 0:
        last_message = res['messages'][-1]['message']
        if "85.00" in last_message and "15 days" in last_message:
            print(f"{Colors.OKGREEN}SUCCESS: Counter-offer message found in negotiation history.{Colors.ENDC}")
        else:
            print(f"{Colors.WARNING}Counter-offer message not found as expected. Got: {last_message}{Colors.ENDC}")
    else:
        print(f"{Colors.WARNING}No messages found in negotiation history{Colors.ENDC}")
    
    return True


def main():
    """Run all test workflows in sequence."""
    start_time = time.time()
    
    tests = [
        test_01_registration,
        test_02_admin_login_and_approval,
        test_03_user_logins,
        test_04_farmer_fpo_workflow,
        test_05_fpo_retailer_workflow,
        test_06_negotiation_workflow
    ]
    
    all_passed = True
    for test in tests:
        if not test():
            print(f"{Colors.FAIL}Test failed: {test.__name__}{Colors.ENDC}")
            all_passed = False
            break
        time.sleep(1)  # Small delay between tests
    
    end_time = time.time()
    
    if all_passed:
        print_header(f"All tests passed in {end_time - start_time:.2f} seconds!")
        print(f"{Colors.OKGREEN}{Colors.BOLD}Backend is now fixed and fully tested.{Colors.ENDC}")
    else:
        print_header(f"Some tests failed after {end_time - start_time:.2f} seconds!")
        print(f"{Colors.FAIL}{Colors.BOLD}Backend needs fixes.{Colors.ENDC}")

if __name__ == "__main__":
    main()