import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'farmerChain.settings')
django.setup()

from django.test import TestCase, Client
from django.utils import timezone
from farmer.models import Farmer, FarmerQuote, CropPassport
from fpo.models import FPO, FPOBid, FPOInventoryLot
from escrow.models import EscrowTransaction


class FarmerFpoINRFlowTest(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Create test Farmer
        self.farmer = Farmer.objects.create(
            name="Ramesh Kumar",
            email="ramesh@example.com",
            aadhaar_number="123456789012",
            city="Pune",
            state="Maharashtra",
            wallet_address="0x1111111111111111111111111111111111111111",
            approval_status="approved",
        )
        self.farmer.set_password("farmerpass123")
        self.farmer.save()

        # Create test FPO
        self.fpo = FPO.objects.create(
            name="Sahyadri Farmers Producer Co",
            email="sahyadri@example.com",
            corporate_identification_number="U01409MH2020PTC123456",
            wallet_address="0x2222222222222222222222222222222222222222",
            city="Nashik",
            state="Maharashtra",
            approval_status="approved",
        )
        self.fpo.set_password("fpopass123")
        self.fpo.save()

        # Create CropPassport
        self.passport = CropPassport.objects.create(
            farmer=self.farmer,
            crop_name="Organic Sharbati Wheat",
            crop_category="Grain",
            quantity=Decimal("100.00"),
            available_quantity=Decimal("100.00"),
            sold_quantity=Decimal("0.00"),
            unit="kg",
            cultivation_date=timezone.now().date(),
            harvest_date=timezone.now().date(),
            location="Pune, Maharashtra",
            status="registered",
        )

        # Create Quote
        self.quote = FarmerQuote.objects.create(
            farmer=self.farmer,
            crop_passport=self.passport,
            product_name="Organic Sharbati Wheat",
            category="Grain",
            quantity=Decimal("100.00"),
            unit="kg",
            price_per_unit=Decimal("50.00"),
            status="open",
            deadline=timezone.now().date() + timezone.timedelta(days=30),
        )

        # Create FPO Bid: ₹50/kg
        self.bid = FPOBid.objects.create(
            fpo=self.fpo,
            quote=self.quote,
            bid_amount=Decimal("50.00"),
            delivery_time_days=5,
            status="submitted",
        )

    def _login_as_farmer(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken()
        refresh['user_id'] = self.farmer.id
        refresh['role'] = 'farmer'
        token = str(refresh.access_token)
        return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

    def _login_as_fpo(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken()
        refresh['user_id'] = self.fpo.id
        refresh['role'] = 'fpo'
        token = str(refresh.access_token)
        return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

    def test_complete_inr_transaction_flow(self):
        farmer_auth = self._login_as_farmer()
        fpo_auth = self._login_as_fpo()

        # ── Step 1: Farmer Accepts FPO Bid ──────────────────────────────
        accept_res = self.client.post(
            f'/api/farmer/bids/fpo/{self.bid.id}/accept/',
            content_type='application/json',
            **farmer_auth,
        )
        self.assertEqual(accept_res.status_code, 200, accept_res.data)
        data = accept_res.json()
        
        # Verify commercial INR values
        self.assertEqual(data['unit_price_inr'], '50.00')
        self.assertEqual(data['total_amount_inr'], '5000.00')
        self.assertEqual(data['agreed_price_inr'], '5000.00')
        
        # Verify DB records
        self.quote.refresh_from_db()
        self.bid.refresh_from_db()
        self.assertEqual(self.quote.status, 'accepted')
        self.assertEqual(self.bid.status, 'accepted')
        self.assertEqual(self.quote.accepted_bid, self.bid)
        self.assertEqual(self.quote.price_per_unit, Decimal('50.00'))

        # Verify pre-initialized EscrowTransaction
        escrow = EscrowTransaction.objects.get(quote=self.quote)
        self.assertEqual(escrow.unit_price_inr, Decimal('50.00'))
        self.assertEqual(escrow.total_amount_inr, Decimal('5000.00'))
        self.assertEqual(escrow.agreed_price_inr, Decimal('5000.00'))
        self.assertEqual(escrow.payment_status, EscrowTransaction.PAYMENT_STATUS_PENDING)
        self.assertEqual(escrow.status, EscrowTransaction.STATUS_CREATED)
        self.assertIsNone(escrow.escrow_id)

        # ── Step 2: Escrow Create Endpoint (Idempotent) ─────────────────
        create_res = self.client.post(
            '/api/escrow/create/',
            data={'quote_id': self.quote.id},
            content_type='application/json',
            **farmer_auth,
        )
        self.assertEqual(create_res.status_code, 200)
        cdata = create_res.json()
        self.assertEqual(cdata['id'], escrow.id)
        self.assertEqual(cdata['farmer_wallet'], self.farmer.wallet_address)
        self.assertEqual(cdata['fpo_wallet'], self.fpo.wallet_address)

        # ── Step 3: On-Chain Escrow Recorded ────────────────────────────
        onchain_res = self.client.post(
            f'/api/escrow/{escrow.id}/created-onchain/',
            data={
                'tx_hash': '0x' + 'a' * 64,
                'escrow_id': 42,
                'contract_address': '0x' + 'c' * 40,
            },
            content_type='application/json',
            **farmer_auth,
        )
        self.assertEqual(onchain_res.status_code, 200)
        escrow.refresh_from_db()
        self.quote.refresh_from_db()
        self.assertEqual(escrow.escrow_id, 42)
        self.assertEqual(self.quote.status, 'contract_created')

        # ── Step 4: FPO Funds Escrow ────────────────────────────────────
        fund_res = self.client.post(
            f'/api/escrow/{escrow.id}/funded/',
            data={'tx_hash': '0x' + 'b' * 64},
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(fund_res.status_code, 200)
        escrow.refresh_from_db()
        self.assertEqual(escrow.status, EscrowTransaction.STATUS_FUNDED)
        self.assertEqual(escrow.payment_status, EscrowTransaction.PAYMENT_STATUS_PROCESSING)

        # Test funding idempotency
        fund_dup = self.client.post(
            f'/api/escrow/{escrow.id}/funded/',
            data={'tx_hash': '0x' + 'b' * 64},
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(fund_dup.status_code, 200)
        self.assertEqual(fund_dup.json()['message'], 'Escrow already funded.')

        # ── Step 5: Farmer Confirms Delivery ────────────────────────────
        delivery_res = self.client.post(
            f'/api/escrow/{escrow.id}/delivery-confirm/',
            data={'tx_hash': '0x' + 'd' * 64},
            content_type='application/json',
            **farmer_auth,
        )
        self.assertEqual(delivery_res.status_code, 200)
        escrow.refresh_from_db()
        self.assertEqual(escrow.status, EscrowTransaction.STATUS_DELIVERY_CONFIRMED)

        # Test delivery confirmation idempotency
        delivery_dup = self.client.post(
            f'/api/escrow/{escrow.id}/delivery-confirm/',
            data={'tx_hash': '0x' + 'd' * 64},
            content_type='application/json',
            **farmer_auth,
        )
        self.assertEqual(delivery_dup.status_code, 200)

        # ── Step 6: FPO Releases Payment ────────────────────────────────
        release_res = self.client.post(
            f'/api/escrow/{escrow.id}/released/',
            data={'tx_hash': '0x' + 'e' * 64},
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(release_res.status_code, 200)
        escrow.refresh_from_db()
        self.quote.refresh_from_db()

        # Verify completed state
        self.assertEqual(escrow.status, EscrowTransaction.STATUS_RELEASED)
        self.assertEqual(escrow.payment_status, EscrowTransaction.PAYMENT_STATUS_PAID)
        self.assertEqual(self.quote.status, 'closed')

        # Verify FPO Inventory Lot created with full provenance
        inv_lot = FPOInventoryLot.objects.get(quote=self.quote)
        self.assertEqual(inv_lot.fpo, self.fpo)
        self.assertEqual(inv_lot.farmer, self.farmer)
        self.assertEqual(inv_lot.crop_passport, self.passport)
        self.assertEqual(inv_lot.original_quantity, Decimal('100.00'))
        self.assertEqual(inv_lot.available_quantity, Decimal('100.00'))
        self.assertEqual(inv_lot.acquisition_price, Decimal('50.00'))
        self.assertEqual(inv_lot.status, 'available')

        # Test release idempotency & duplicate prevention
        release_dup = self.client.post(
            f'/api/escrow/{escrow.id}/released/',
            data={'tx_hash': '0x' + 'e' * 64},
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(release_dup.status_code, 200)
        self.assertEqual(release_dup.json()['message'], 'Payment already released.')
        
        # Verify no duplicate inventory lots created
        self.assertEqual(FPOInventoryLot.objects.filter(quote=self.quote).count(), 1)

        # Verify INR values remained untouched throughout the entire flow
        self.assertEqual(escrow.unit_price_inr, Decimal('50.00'))
        self.assertEqual(escrow.total_amount_inr, Decimal('5000.00'))
        self.assertEqual(escrow.agreed_price_inr, Decimal('5000.00'))

    def test_validation_and_rejection_edge_cases(self):
        farmer_auth = self._login_as_farmer()

        # Another farmer trying to accept
        other_farmer = Farmer.objects.create(
            name="Suresh Patel",
            email="suresh@example.com",
            aadhaar_number="999988887777",
            city="Nagpur",
            state="Maharashtra",
            wallet_address="0x3333333333333333333333333333333333333333",
            approval_status="approved",
        )
        from rest_framework_simplejwt.tokens import RefreshToken
        rf = RefreshToken()
        rf['user_id'] = other_farmer.id
        rf['role'] = 'farmer'
        other_auth = {'HTTP_AUTHORIZATION': f'Bearer {rf.access_token}'}

        res = self.client.post(
            f'/api/farmer/bids/fpo/{self.bid.id}/accept/',
            content_type='application/json',
            **other_auth,
        )
        self.assertEqual(res.status_code, 403)

        # Invalid bid status
        self.bid.status = 'rejected'
        self.bid.save()
        res = self.client.post(
            f'/api/farmer/bids/fpo/{self.bid.id}/accept/',
            content_type='application/json',
            **farmer_auth,
        )
        self.assertEqual(res.status_code, 400)

        # Reset bid and test invalid quantity
        self.bid.status = 'submitted'
        self.bid.save()
        self.quote.quantity = Decimal('0.00')
        self.quote.save()
        res = self.client.post(
            f'/api/farmer/bids/fpo/{self.bid.id}/accept/',
            content_type='application/json',
            **farmer_auth,
        )
        self.assertEqual(res.status_code, 400)

        # Reset quantity and test invalid bid amount
        self.quote.quantity = Decimal('100.00')
        self.quote.save()
        self.bid.bid_amount = Decimal('0.00')
        self.bid.save()
        res = self.client.post(
            f'/api/farmer/bids/fpo/{self.bid.id}/accept/',
            content_type='application/json',
            **farmer_auth,
        )
        self.assertEqual(res.status_code, 400)

