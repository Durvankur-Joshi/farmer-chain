import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'farmerChain.settings')
django.setup()

from django.test import TestCase, Client
from django.utils import timezone
from farmer.models import Farmer, CropPassport
from fpo.models import FPO, FPOQuote, FPOQuoteAllocation, FPOInventoryLot
from retailer.models import Retailer, RetailerBid, RetailerInventoryLot
from escrow.models import RetailerEscrowTransaction


class FPOTailerINRFlowTest(TestCase):
    def setUp(self):
        self.client = Client()

        # 1. Create test Farmer (source of provenance)
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

        # 2. Create CropPassport
        self.passport = CropPassport.objects.create(
            farmer=self.farmer,
            crop_name="Organic Wheat",
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

        # 3. Create test FPO (Seller)
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

        # 4. Create test Retailers (Buyer)
        self.retailer = Retailer.objects.create(
            name="Metro Agro Mart",
            email="metro@example.com",
            gstin="27ABCDE1234F1Z5",
            wallet_address="0x3333333333333333333333333333333333333333",
            city="Mumbai",
            state="Maharashtra",
            approval_status="approved",
        )
        self.retailer.set_password("retailerpass123")
        self.retailer.save()

        self.competing_retailer = Retailer.objects.create(
            name="Fresh Retail Co",
            email="fresh@example.com",
            gstin="27XYZAB5678C1Z9",
            wallet_address="0x4444444444444444444444444444444444444444",
            city="Pune",
            state="Maharashtra",
            approval_status="approved",
        )
        self.competing_retailer.set_password("retailerpass456")
        self.competing_retailer.save()

        # 5. Create FPO Inventory Lot: 100 kg Wheat, 60 available, 40 reserved for quote
        self.fpo_lot = FPOInventoryLot.objects.create(
            fpo=self.fpo,
            farmer=self.farmer,
            crop_passport=self.passport,
            product_name="Organic Wheat",
            crop_category="Grain",
            original_quantity=Decimal("100.00"),
            available_quantity=Decimal("60.00"),
            reserved_quantity=Decimal("40.00"),
            unit="kg",
            acquisition_price=Decimal("0.02"),
            status="available",
        )

        # 6. Create FPOQuote for 40 kg Wheat at ₹60/kg
        self.quote = FPOQuote.objects.create(
            fpo=self.fpo,
            product_name="Organic Wheat",
            category="Grain",
            quantity=Decimal("40.00"),
            unit="kg",
            price_per_unit=Decimal("60.00"),
            status="open",
            deadline=timezone.now().date() + timezone.timedelta(days=14),
        )

        # 7. Create FPOQuoteAllocation linking quote to source lot & provenance
        self.allocation = FPOQuoteAllocation.objects.create(
            quote=self.quote,
            inventory_lot=self.fpo_lot,
            farmer=self.farmer,
            crop_passport=self.passport,
            allocated_quantity=Decimal("40.00"),
        )

        # 8. Create Retailer Bids: Winning bid = ₹60/kg, Competing bid = ₹55/kg
        self.winning_bid = RetailerBid.objects.create(
            retailer=self.retailer,
            quote=self.quote,
            bid_amount=Decimal("60.00"),
            delivery_time_days=3,
            status="submitted",
        )

        self.competing_bid = RetailerBid.objects.create(
            retailer=self.competing_retailer,
            quote=self.quote,
            bid_amount=Decimal("55.00"),
            delivery_time_days=5,
            status="submitted",
        )

    def _login_as_fpo(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken()
        refresh['user_id'] = self.fpo.id
        refresh['role'] = 'fpo'
        token = str(refresh.access_token)
        return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

    def _login_as_retailer(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken()
        refresh['user_id'] = self.retailer.id
        refresh['role'] = 'retailer'
        token = str(refresh.access_token)
        return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

    def test_complete_fpo_retailer_inr_transaction_flow(self):
        """
        Tests the complete Phase 5 lifecycle:
          1. FPO accepts Retailer bid (40 kg @ ₹60/kg = ₹2,400)
          2. Off-chain RetailerEscrowTransaction initialized with authoritative INR values
          3. Escrow create endpoint returns draft idempotently
          4. On-chain escrow ID recorded
          5. Retailer funds escrow
          6. FPO confirms delivery
          7. Retailer releases payment
          8. Final verification:
             - FPO retains 60 kg available stock (0 reserved)
             - Retailer receives 40 kg stock with full multi-step provenance
             - Commercial INR value = ₹2,400 throughout
             - Repeated calls are strictly idempotent (no double release or duplicate inventory)
        """
        fpo_auth = self._login_as_fpo()
        retailer_auth = self._login_as_retailer()

        # ── Step 1: FPO Accepts Retailer Bid ─────────────────────────────
        accept_res = self.client.post(
            f'/api/fpo/bids/retailer/{self.winning_bid.id}/accept/',
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(accept_res.status_code, 200, accept_res.data)
        data = accept_res.json()

        # Authoritative commercial INR validation
        self.assertEqual(data['unit_price_inr'], '60.00')
        self.assertEqual(data['total_amount_inr'], '2400.00')
        self.assertEqual(data['agreed_price_inr'], '2400.00')

        # Database state verification
        self.quote.refresh_from_db()
        self.winning_bid.refresh_from_db()
        self.competing_bid.refresh_from_db()
        self.assertEqual(self.quote.status, 'awarded')
        self.assertEqual(self.winning_bid.status, 'accepted')
        self.assertEqual(self.competing_bid.status, 'rejected')
        self.assertEqual(self.quote.accepted_bid, self.winning_bid)
        self.assertEqual(self.quote.price_per_unit, Decimal('60.00'))

        # Pre-initialized RetailerEscrowTransaction record
        escrow = RetailerEscrowTransaction.objects.get(quote=self.quote)
        self.assertEqual(escrow.unit_price_inr, Decimal('60.00'))
        self.assertEqual(escrow.total_amount_inr, Decimal('2400.00'))
        self.assertEqual(escrow.agreed_price_inr, Decimal('2400.00'))
        self.assertEqual(escrow.payment_status, RetailerEscrowTransaction.PAYMENT_STATUS_PENDING)
        self.assertEqual(escrow.status, RetailerEscrowTransaction.STATUS_CREATED)
        self.assertIsNone(escrow.escrow_id)

        # ── Step 2: Escrow Create Endpoint (Idempotent Draft Return) ─────
        create_res = self.client.post(
            f'/api/escrow/retailer/{self.quote.id}/create/',
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(create_res.status_code, 200)
        cdata = create_res.json()
        self.assertEqual(cdata['id'], escrow.id)
        self.assertEqual(cdata['fpo_wallet'], self.fpo.wallet_address)
        self.assertEqual(cdata['retailer_wallet'], self.retailer.wallet_address)

        # ── Step 3: On-Chain Escrow Recorded ────────────────────────────
        onchain_res = self.client.post(
            f'/api/escrow/retailer/{escrow.id}/created-onchain/',
            data={
                'tx_hash': '0x' + 'a' * 64,
                'escrow_id': 77,
                'contract_address': '0x' + 'c' * 40,
            },
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(onchain_res.status_code, 200)
        escrow.refresh_from_db()
        self.assertEqual(escrow.escrow_id, 77)

        # Test on-chain idempotency
        onchain_dup = self.client.post(
            f'/api/escrow/retailer/{escrow.id}/created-onchain/',
            data={
                'tx_hash': '0x' + 'a' * 64,
                'escrow_id': 77,
            },
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(onchain_dup.status_code, 200)

        # ── Step 4: Retailer Funds Escrow ───────────────────────────────
        fund_res = self.client.post(
            f'/api/escrow/retailer/{escrow.id}/funded/',
            data={'tx_hash': '0x' + 'b' * 64},
            content_type='application/json',
            **retailer_auth,
        )
        self.assertEqual(fund_res.status_code, 200)
        escrow.refresh_from_db()
        self.assertEqual(escrow.status, RetailerEscrowTransaction.STATUS_FUNDED)
        self.assertEqual(escrow.payment_status, RetailerEscrowTransaction.PAYMENT_STATUS_PROCESSING)

        # Test funding idempotency
        fund_dup = self.client.post(
            f'/api/escrow/retailer/{escrow.id}/funded/',
            data={'tx_hash': '0x' + 'b' * 64},
            content_type='application/json',
            **retailer_auth,
        )
        self.assertEqual(fund_dup.status_code, 200)
        self.assertEqual(fund_dup.json()['message'], 'Escrow already funded.')

        # ── Step 5: FPO Confirms Delivery ───────────────────────────────
        delivery_res = self.client.post(
            f'/api/escrow/retailer/{escrow.id}/delivery-confirm/',
            data={'tx_hash': '0x' + 'd' * 64},
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(delivery_res.status_code, 200)
        escrow.refresh_from_db()
        self.assertEqual(escrow.status, RetailerEscrowTransaction.STATUS_DELIVERY_CONFIRMED)

        # Test delivery confirmation idempotency
        delivery_dup = self.client.post(
            f'/api/escrow/retailer/{escrow.id}/delivery-confirm/',
            data={'tx_hash': '0x' + 'd' * 64},
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(delivery_dup.status_code, 200)

        # ── Step 6: Retailer Releases Payment ───────────────────────────
        release_res = self.client.post(
            f'/api/escrow/retailer/{escrow.id}/released/',
            data={'tx_hash': '0x' + 'e' * 64},
            content_type='application/json',
            **retailer_auth,
        )
        self.assertEqual(release_res.status_code, 200)
        escrow.refresh_from_db()
        self.quote.refresh_from_db()

        # Verify completed escrow state
        self.assertEqual(escrow.status, RetailerEscrowTransaction.STATUS_RELEASED)
        self.assertEqual(escrow.payment_status, RetailerEscrowTransaction.PAYMENT_STATUS_PAID)
        self.assertEqual(self.quote.status, 'closed')

        # ── Step 7: Inventory Settlement & Conservation of Stock ────────
        self.fpo_lot.refresh_from_db()
        # FPO had 100 kg initial (60 available, 40 reserved for quote)
        # After 40 kg sold, FPO retains exactly 60 kg available and 0 reserved!
        self.assertEqual(self.fpo_lot.available_quantity, Decimal("60.00"))
        self.assertEqual(self.fpo_lot.reserved_quantity, Decimal("0.00"))
        self.assertEqual(self.fpo_lot.original_quantity, Decimal("100.00"))

        # Retailer Inventory Lot created with 40 kg
        retailer_lots = RetailerInventoryLot.objects.filter(escrow=escrow)
        self.assertEqual(retailer_lots.count(), 1)
        rlot = retailer_lots.first()
        self.assertEqual(rlot.retailer, self.retailer)
        self.assertEqual(rlot.fpo, self.fpo)
        self.assertEqual(rlot.farmer, self.farmer)
        self.assertEqual(rlot.crop_passport, self.passport)
        self.assertEqual(rlot.inventory_lot, self.fpo_lot)
        self.assertEqual(rlot.product_name, "Organic Wheat")
        self.assertEqual(rlot.quantity, Decimal("40.00"))
        self.assertEqual(rlot.unit, "kg")
        self.assertEqual(rlot.purchase_price_per_unit, Decimal("60.00"))
        self.assertEqual(rlot.total_price, Decimal("2400.00"))
        self.assertEqual(rlot.status, "in_stock")

        # ── Step 8: Test Payment Release & Inventory Idempotency ────────
        release_dup = self.client.post(
            f'/api/escrow/retailer/{escrow.id}/released/',
            data={'tx_hash': '0x' + 'e' * 64},
            content_type='application/json',
            **retailer_auth,
        )
        self.assertEqual(release_dup.status_code, 200)

        # Verify NO duplicate inventory lots created and NO double stock deduction
        self.assertEqual(RetailerInventoryLot.objects.filter(escrow=escrow).count(), 1)
        self.fpo_lot.refresh_from_db()
        self.assertEqual(self.fpo_lot.available_quantity, Decimal("60.00"))
        self.assertEqual(self.fpo_lot.reserved_quantity, Decimal("0.00"))

    def test_overselling_prevention(self):
        """
        Test Part C: Retailer deals MUST only be created from available FPO inventory.
        If FPO tries to accept a bid for a quote that exceeds available + reserved stock,
        the operation is rejected.
        """
        fpo_auth = self._login_as_fpo()

        # Artificially alter lot available + reserved to be less than the quote allocation
        self.fpo_lot.available_quantity = Decimal("10.00")
        self.fpo_lot.reserved_quantity = Decimal("10.00")
        self.fpo_lot.save()

        accept_res = self.client.post(
            f'/api/fpo/bids/retailer/{self.winning_bid.id}/accept/',
            content_type='application/json',
            **fpo_auth,
        )
        self.assertEqual(accept_res.status_code, 400)
        self.assertIn("Insufficient stock", accept_res.json()['error'])
