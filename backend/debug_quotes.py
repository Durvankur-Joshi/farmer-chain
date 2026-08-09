"""Inspect actual quote API response data."""
import os, sys, django, json
os.environ['DJANGO_SETTINGS_MODULE'] = 'FarmerChain.settings'
sys.path.insert(0, '.')
django.setup()

from farmer.models import FarmerQuote
from farmer.serializers import FarmerQuoteSerializer

qs = FarmerQuote.objects.all()
data = FarmerQuoteSerializer(qs, many=True).data

print("=== ALL QUOTES ===")
for d in data:
    print(f"\nQuote #{d['id']}:")
    print(f"  status:       {d['status']}")
    print(f"  product:      {d['product_name']}")
    print(f"  accepted_bid: {d['accepted_bid']}  (type: {type(d['accepted_bid']).__name__})")
    print(f"  bids:         {json.dumps(d['bids'], default=str, indent=4)}")

# Show the filter logic the frontend uses
print("\n=== FRONTEND FILTER SIMULATION ===")
accepted = [d for d in data if d['status'] == 'accepted' and d['accepted_bid']]
print(f"Quotes matching status=='accepted' AND accepted_bid truthy: {len(accepted)}")
for d in accepted:
    print(f"  Quote #{d['id']} => accepted_bid={d['accepted_bid']}")

# Also check: any quotes with accepted bids but different status?
has_bid = [d for d in data if d['accepted_bid']]
print(f"\nQuotes with any accepted_bid value: {len(has_bid)}")
for d in has_bid:
    print(f"  Quote #{d['id']} => status={d['status']}, accepted_bid={d['accepted_bid']}")
