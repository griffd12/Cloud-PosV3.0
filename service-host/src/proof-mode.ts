import { Database } from './db/database.js';
import { CapsService } from './services/caps.js';
import { KdsController } from './services/kds-controller.js';
import { TransactionSync } from './sync/transaction-sync.js';
import { CloudConnection } from './sync/cloud-connection.js';
import { ConfigSync } from './sync/config-sync.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const INFO = '\x1b[36mINFO\x1b[0m';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions: string[] = [];

function log(level: string, msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`);
}

function assert(condition: boolean, description: string): boolean {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    log(PASS, description);
    return true;
  } else {
    failedAssertions.push(description);
    log(FAIL, description);
    return false;
  }
}

async function runProofMode(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('  CLOUD POS V3.0 — OFFLINE PROOF MODE');
  console.log('  Pilot-Ready Hybrid Offline Verification Suite');
  console.log('='.repeat(70) + '\n');

  const dataDir = path.join(process.cwd(), 'data', 'proof-mode-' + Date.now());
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'pos.db');
  const businessDate = new Date().toISOString().split('T')[0];

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  PHASE 1 — Database Init & Schema Verification');
  console.log(`${'─'.repeat(50)}\n`);

  const db = new Database(dbPath);

  assert(fs.existsSync(dbPath), 'SQLite database file created');

  const tables = db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  const tableNames = tables.map(t => t.name);

  assert(tableNames.includes('checks'), 'checks table exists');
  assert(tableNames.includes('check_items'), 'check_items table exists');
  assert(tableNames.includes('check_payments'), 'check_payments table exists');
  assert(tableNames.includes('tenders'), 'tenders table exists');
  assert(tableNames.includes('tax_groups'), 'tax_groups table exists');
  assert(tableNames.includes('menu_items'), 'menu_items table exists');
  assert(tableNames.includes('employees'), 'employees table exists');
  assert(tableNames.includes('kds_tickets'), 'kds_tickets table exists');
  assert(tableNames.includes('transaction_journal'), 'transaction_journal table exists');
  assert(tableNames.includes('emc_option_flags'), 'emc_option_flags table exists');

  log(INFO, `Total tables: ${tableNames.length}`);

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  PHASE 2 — Seed Config Data (Simulating Config Sync)');
  console.log(`${'─'.repeat(50)}\n`);

  const enterpriseId = randomUUID();
  const propertyId = randomUUID();
  const rvcId = randomUUID();
  const workstationId = randomUUID();
  const employeeId = randomUUID();
  const cashTenderId = randomUUID();
  const cardTenderId = randomUUID();
  const taxGroupId = randomUUID();
  const menuItem1Id = randomUUID();
  const menuItem2Id = randomUUID();
  const menuItem3Id = randomUUID();
  const kdsDeviceId = randomUUID();
  const discountId = randomUUID();

  db.run(`INSERT INTO enterprises (id, name) VALUES (?, ?)`, [enterpriseId, 'SNS-001 Proof']);
  db.run(`INSERT INTO properties (id, enterprise_id, name) VALUES (?, ?, ?)`,
    [propertyId, enterpriseId, 'Newport Beach']);
  db.run(`INSERT INTO rvcs (id, property_id, name) VALUES (?, ?, ?)`,
    [rvcId, propertyId, 'Counter']);
  db.run(`INSERT INTO workstations (id, rvc_id, name) VALUES (?, ?, ?)`,
    [workstationId, rvcId, 'POS-1']);
  db.run(`INSERT INTO employees (id, enterprise_id, first_name, last_name, role, pin_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [employeeId, enterpriseId, 'Derek', 'Test', 'CASHIER', '1234', 'active']);

  db.run(`INSERT INTO tax_groups (id, enterprise_id, name, rate, tax_mode) VALUES (?, ?, ?, ?, ?)`,
    [taxGroupId, enterpriseId, 'CA Sales Tax', '0.0775', 'add_on']);

  db.run(`INSERT INTO tenders (id, enterprise_id, name, tender_type, is_cash_media, is_card_media, is_gift_media, allow_tips, allow_over_tender, pop_drawer, print_check_on_payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cashTenderId, enterpriseId, 'Cash', 'cash', 1, 0, 0, 0, 1, 1, 1]);
  db.run(`INSERT INTO tenders (id, enterprise_id, name, tender_type, is_cash_media, is_card_media, is_gift_media, allow_tips, allow_over_tender, pop_drawer, print_check_on_payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cardTenderId, enterpriseId, 'Visa/MC', 'credit', 0, 1, 0, 1, 0, 0, 1]);

  db.run(`INSERT INTO menu_items (id, enterprise_id, name, price, tax_group_id, category) VALUES (?, ?, ?, ?, ?, ?)`,
    [menuItem1Id, enterpriseId, 'Burger', 1295, taxGroupId, 'Entrees']);
  db.run(`INSERT INTO menu_items (id, enterprise_id, name, price, tax_group_id, category) VALUES (?, ?, ?, ?, ?, ?)`,
    [menuItem2Id, enterpriseId, 'Fries', 499, taxGroupId, 'Sides']);
  db.run(`INSERT INTO menu_items (id, enterprise_id, name, price, tax_group_id, category) VALUES (?, ?, ?, ?, ?, ?)`,
    [menuItem3Id, enterpriseId, 'Soda', 299, null, 'Beverages']);

  db.run(`INSERT INTO kds_devices (id, property_id, name, station_type) VALUES (?, ?, ?, ?)`,
    [kdsDeviceId, propertyId, 'Kitchen-1', 'kitchen']);

  db.run(`INSERT INTO discounts (id, enterprise_id, name, type, value) VALUES (?, ?, ?, ?, ?)`,
    [discountId, enterpriseId, '10% Off', 'percentage', 10]);

  const seedCounts = {
    enterprises: db.get<{ c: number }>('SELECT COUNT(*) as c FROM enterprises')!.c,
    properties: db.get<{ c: number }>('SELECT COUNT(*) as c FROM properties')!.c,
    rvcs: db.get<{ c: number }>('SELECT COUNT(*) as c FROM rvcs')!.c,
    employees: db.get<{ c: number }>('SELECT COUNT(*) as c FROM employees')!.c,
    menuItems: db.get<{ c: number }>('SELECT COUNT(*) as c FROM menu_items')!.c,
    tenders: db.get<{ c: number }>('SELECT COUNT(*) as c FROM tenders')!.c,
    taxGroups: db.get<{ c: number }>('SELECT COUNT(*) as c FROM tax_groups')!.c,
    kdsDevices: db.get<{ c: number }>('SELECT COUNT(*) as c FROM kds_devices')!.c,
    discounts: db.get<{ c: number }>('SELECT COUNT(*) as c FROM discounts')!.c,
  };

  log(INFO, `Seed data: ${JSON.stringify(seedCounts)}`);
  assert(seedCounts.menuItems === 3, 'Menu items seeded: 3');
  assert(seedCounts.tenders === 2, 'Tenders seeded: 2 (Cash + Card)');
  assert(seedCounts.taxGroups === 1, 'Tax groups seeded: 1 (CA 7.75%)');

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  PHASE 3 — Offline POS Operations (CAPS)');
  console.log(`${'─'.repeat(50)}\n`);

  const cloud = new CloudConnection({ cloudUrl: 'http://localhost:0', authToken: 'test' });
  const txSync = new TransactionSync(db, cloud);
  const caps = new CapsService(db, txSync);
  caps.setDeviceId(workstationId);
  caps.setConfigVersion('proof-v1');

  const kds = new KdsController(db);

  log(INFO, 'Creating check...');
  const check = caps.createCheck({
    rvcId,
    employeeId,
    workstationId,
    orderType: 'dine_in',
    tableNumber: 'T5',
    guestCount: 2,
  });

  assert(!!check.id, `Check created: ID=${check.id.substring(0, 8)}...`);
  assert(check.checkNumber > 0, `Check number assigned: ${check.checkNumber}`);
  assert(check.status === 'open', 'Check status is open');
  assert(!!check.txnGroupId, `txn_group_id assigned: ${check.txnGroupId.substring(0, 8)}...`);
  assert(check.businessDate === businessDate, `Business date set: ${check.businessDate}`);

  log(INFO, 'Adding 3 menu items...');
  const addedItems = caps.addItems(check.id, [
    { menuItemId: menuItem1Id, quantity: 1 },
    { menuItemId: menuItem2Id, quantity: 1, modifiers: [{ name: 'Extra Crispy' }] },
    { menuItemId: menuItem3Id, quantity: 2 },
  ], workstationId);

  assert(addedItems.length === 3, `Items added: ${addedItems.length}`);

  const updatedCheck1 = caps.getCheck(check.id)!;
  const expectedSubtotal = 1295 + 499 + (299 * 2);
  assert(updatedCheck1.subtotal === expectedSubtotal, `Subtotal correct: ${updatedCheck1.subtotal} (expected ${expectedSubtotal})`);

  const taxableAmount = 1295 + 499;
  const expectedTax = Math.round(taxableAmount * 0.0775);
  assert(updatedCheck1.tax === expectedTax, `Tax from tax groups (7.75% on taxable items): ${updatedCheck1.tax} (expected ${expectedTax})`);
  assert(updatedCheck1.total === expectedSubtotal + expectedTax, `Total correct: ${updatedCheck1.total}`);

  log(INFO, 'Soda has no tax_group_id → tax-exempt');
  assert(updatedCheck1.tax > 0, 'Tax is non-zero (from taxable items)');

  log(INFO, 'Sending to kitchen (round 1)...');
  const kitchenResult = caps.sendToKitchen(check.id, workstationId);
  assert(kitchenResult.itemsSent === 3, `Items sent to kitchen: ${kitchenResult.itemsSent}`);
  assert(kitchenResult.roundNumber === 1, `Round number: ${kitchenResult.roundNumber}`);

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  PHASE 4 — KDS Offline Operations');
  console.log(`${'─'.repeat(50)}\n`);

  log(INFO, 'Creating KDS ticket...');
  const kdsTicket = kds.createTicket({
    checkId: check.id,
    checkNumber: check.checkNumber,
    orderType: 'dine_in',
    items: addedItems.map(i => ({ name: i.name, quantity: i.quantity })),
    stationId: kdsDeviceId,
    priority: 0,
  });

  assert(!!kdsTicket.id, `KDS ticket created: ${kdsTicket.id.substring(0, 8)}...`);
  assert(kdsTicket.status === 'active', 'KDS ticket is active');
  assert(kdsTicket.items.length === 3, `KDS ticket has ${kdsTicket.items.length} items`);

  const activeTickets = kds.getActiveTickets(kdsDeviceId);
  assert(activeTickets.length === 1, `Active tickets on station: ${activeTickets.length}`);

  log(INFO, 'Bumping KDS ticket (kitchen complete)...');
  kds.bumpTicket(kdsTicket.id, kdsDeviceId);

  const bumpedTicket = kds.getTicket(kdsTicket.id);
  assert(bumpedTicket?.status === 'bumped', 'KDS ticket bumped');
  assert(!!bumpedTicket?.bumpedAt, 'Bumped timestamp recorded');

  const activeAfterBump = kds.getActiveTickets(kdsDeviceId);
  assert(activeAfterBump.length === 0, 'No active tickets after bump');

  const bumpedTickets = kds.getBumpedTickets(10);
  assert(bumpedTickets.length === 1, `Bumped tickets list: ${bumpedTickets.length}`);

  log(INFO, 'Recalling ticket...');
  kds.recallTicket(kdsTicket.id);

  const recalledTicket = kds.getTicket(kdsTicket.id);
  assert(recalledTicket?.status === 'active', 'KDS ticket recalled to active');

  kds.bumpTicket(kdsTicket.id, kdsDeviceId);
  const reBumped = kds.getTicket(kdsTicket.id);
  assert(reBumped?.status === 'bumped', 'KDS ticket re-bumped after recall');

  const kdsJournalEntries = db.all<{ event_type: string }>(
    `SELECT event_type FROM transaction_journal WHERE event_type LIKE 'kds_%' ORDER BY created_at`
  );
  log(INFO, `KDS journal entries: ${kdsJournalEntries.map(e => e.event_type).join(', ')}`);
  assert(kdsJournalEntries.length >= 4, `KDS journal entries: ${kdsJournalEntries.length} (expect ≥4: create, bump, recall, re-bump)`);

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  PHASE 5 — Tender + Close Check');
  console.log(`${'─'.repeat(50)}\n`);

  log(INFO, 'Applying discount (manual flat amount)...');
  const discountAmount = 200;
  db.run(
    `INSERT INTO check_discounts (id, check_id, discount_id, name, type, amount) VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), check.id, discountId, '10% Off', 'flat', discountAmount]
  );

  const discJournalId = randomUUID();
  db.writeJournalEntry({
    eventId: discJournalId,
    txnGroupId: check.txnGroupId,
    deviceId: workstationId,
    rvcId,
    businessDate,
    checkId: check.id,
    eventType: 'discount_applied',
    payloadJson: JSON.stringify({ discountId, name: '10% Off', amount: discountAmount }),
  });

  const updatedCheck2 = caps.getCheck(check.id)!;
  log(INFO, `Before payment: subtotal=${updatedCheck2.subtotal}, tax=${updatedCheck2.tax}, total=${updatedCheck2.total}`);

  const cashAmount = 1000;
  log(INFO, `Paying cash: ${cashAmount}...`);
  const cashPayment = caps.addPayment(check.id, {
    tenderId: cashTenderId,
    tenderType: 'cash',
    amount: cashAmount,
    tip: 0,
  }, workstationId);

  assert(cashPayment.isCashMedia === true, 'Cash payment: isCashMedia=true');
  assert(cashPayment.popDrawer === true, 'Cash payment: popDrawer=true');
  assert(cashPayment.printCheck === true, 'Cash payment: printCheck=true');

  const updatedCheck3 = caps.getCheck(check.id)!;
  const remainingDue = updatedCheck3.total - cashAmount;
  log(INFO, `Remaining due: ${remainingDue}`);

  assert(updatedCheck3.status === 'open', 'Check still open (partial payment)');

  log(INFO, `Paying card: ${remainingDue} + tip 200...`);
  const cardPayment = caps.addPayment(check.id, {
    tenderId: cardTenderId,
    tenderType: 'credit',
    amount: remainingDue,
    tip: 200,
    reference: 'AUTH-12345',
  }, workstationId);

  assert(cardPayment.isCardMedia === true, 'Card payment: isCardMedia=true');
  assert(cardPayment.tip === 200, 'Card payment: tip=$2.00');
  assert(cardPayment.popDrawer === false, 'Card payment: popDrawer=false');

  const finalCheck = caps.getCheck(check.id)!;
  assert(finalCheck.status === 'closed', 'Check auto-closed after full payment');
  assert(!!finalCheck.closedAt, 'Closed timestamp recorded');

  log(INFO, `Final totals: subtotal=${finalCheck.subtotal}, tax=${finalCheck.tax}, total=${finalCheck.total}`);

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  PHASE 6 — Journal Integrity');
  console.log(`${'─'.repeat(50)}\n`);

  const allJournal = db.all<{ event_type: string; sync_state: string }>(
    `SELECT event_type, sync_state FROM transaction_journal WHERE check_id = ? ORDER BY created_at`,
    [check.id]
  );

  log(INFO, `Journal entries for check: ${allJournal.length}`);
  for (const entry of allJournal) {
    log(INFO, `  ${entry.event_type} [${entry.sync_state}]`);
  }

  const eventTypes = allJournal.map(e => e.event_type);
  assert(eventTypes.includes('check_opened'), 'Journal: check_opened');
  assert(eventTypes.filter(e => e === 'item_added').length === 3, 'Journal: 3x item_added');
  assert(eventTypes.includes('round_sent'), 'Journal: round_sent');
  assert(eventTypes.includes('discount_applied'), 'Journal: discount_applied');
  assert(eventTypes.filter(e => e === 'payment_added').length === 2, 'Journal: 2x payment_added');
  assert(eventTypes.includes('check_closed'), 'Journal: check_closed');

  const pendingCount = allJournal.filter(e => e.sync_state === 'pending').length;
  assert(pendingCount === allJournal.length, `All journal entries pending (${pendingCount}/${allJournal.length})`);

  const journalWithGroup = db.all<{ txn_group_id: string }>(
    `SELECT DISTINCT txn_group_id FROM transaction_journal WHERE check_id = ?`,
    [check.id]
  );
  assert(journalWithGroup.length === 1, 'All journal entries share same txn_group_id');
  assert(journalWithGroup[0].txn_group_id === check.txnGroupId, 'txn_group_id matches check');

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  PHASE 7 — Persistence (Simulated Restart)');
  console.log(`${'─'.repeat(50)}\n`);

  log(INFO, 'Closing database...');
  db.close();

  log(INFO, 'Reopening database (simulating restart)...');
  const db2 = new Database(dbPath);

  const restoredCheck = db2.get<{ id: string; status: string; total: number; check_number: number }>(
    'SELECT id, status, total, check_number FROM checks WHERE id = ?',
    [check.id]
  );

  assert(!!restoredCheck, 'Check survives restart');
  assert(restoredCheck!.status === 'closed', 'Check still closed after restart');
  assert(restoredCheck!.total === finalCheck.total, `Total preserved: ${restoredCheck!.total}`);

  const restoredKds = db2.get<{ id: string; status: string }>(
    'SELECT id, status FROM kds_tickets WHERE id = ?',
    [kdsTicket.id]
  );
  assert(!!restoredKds, 'KDS ticket survives restart');
  assert(restoredKds!.status === 'bumped', 'KDS ticket still bumped');

  const restoredJournal = db2.all<{ event_id: string }>(
    'SELECT event_id FROM transaction_journal WHERE check_id = ?',
    [check.id]
  );
  assert(restoredJournal.length === allJournal.length, `Journal entries preserved: ${restoredJournal.length}`);

  log(INFO, 'Querying offline daily summary...');
  const summary = db2.getOfflineDailySummary(businessDate);
  log(INFO, JSON.stringify(summary, null, 2));

  assert(summary.sales.closedCheckCount === 1, 'Summary: 1 closed check');
  assert(summary.sales.grandTotal > 0, `Summary: grand total > 0 (${summary.sales.grandTotal})`);
  assert(summary.payments.cash.count === 1, 'Summary: 1 cash payment');
  assert(summary.payments.card.count === 1, 'Summary: 1 card payment');
  assert(summary.kds.bumpedTickets >= 1, 'Summary: bumped KDS tickets');
  assert(summary.journal.total > 0, `Summary: journal entries (${summary.journal.total})`);

  db2.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  PHASE 8 — Idempotency Verification (Local)');
  console.log(`${'─'.repeat(50)}\n`);

  const db3 = new Database(dbPath);

  log(INFO, 'Attempting duplicate journal writes...');
  const dupeId = randomUUID();
  db3.writeJournalEntry({
    eventId: dupeId,
    txnGroupId: check.txnGroupId,
    deviceId: workstationId,
    rvcId,
    businessDate,
    checkId: check.id,
    eventType: 'test_idempotency',
    payloadJson: '{}',
  });

  let dupeInserted = false;
  try {
    db3.writeJournalEntry({
      eventId: dupeId,
      txnGroupId: check.txnGroupId,
      deviceId: workstationId,
      rvcId,
      businessDate,
      checkId: check.id,
      eventType: 'test_idempotency',
      payloadJson: '{}',
    });
    dupeInserted = true;
  } catch {
    dupeInserted = false;
  }
  assert(!dupeInserted, 'Duplicate event_id rejected (PRIMARY KEY constraint)');

  db3.close();

  console.log('\n' + '='.repeat(70));
  console.log('  PROOF MODE — FINAL REPORT');
  console.log('='.repeat(70));
  console.log(`  Total assertions:  ${totalAssertions}`);
  console.log(`  Passed:            ${passedAssertions}`);
  console.log(`  Failed:            ${failedAssertions.length}`);

  if (failedAssertions.length > 0) {
    console.log('\n  Failed assertions:');
    for (const f of failedAssertions) {
      console.log(`    ✗ ${f}`);
    }
  }

  console.log(`\n  Result: ${failedAssertions.length === 0 ? PASS : FAIL}`);
  console.log('='.repeat(70) + '\n');

  fs.rmSync(dataDir, { recursive: true, force: true });

  process.exit(failedAssertions.length === 0 ? 0 : 1);
}

runProofMode().catch(err => {
  console.error('Proof mode crashed:', err);
  process.exit(2);
});
