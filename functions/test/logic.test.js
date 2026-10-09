// Unit tests for the pure booking rules (run: npm test). Requires `npm run build` first.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib/logic.js');
const U = require('../lib/shared/utils.js');

const fam = { slotId: 's1', ubayamTypeId: 'u1', bookingType: 'family', contactName: 'Kumar', mobileNumber: '+91 98765-43210', familyName: 'Kumar Family', memberCount: 4, memberNames: ['A', ' ', 'B'] };

test('family booking normalises mobile and member names', () => {
  const n = L.normalizeBooking(L.parse(L.createBookingSchema, fam), 25);
  assert.equal(n.mobileNumber, '9876543210');
  assert.deepEqual(n.memberNames, ['A', 'B']);
  assert.equal(n.memberCount, 4);
  assert.equal(n.groupName, null);
});

test('family booking rejects bad mobile / member count / missing family name', () => {
  assert.throws(() => L.normalizeBooking({ ...fam, mobileNumber: '12345' }, 25), /mobile/);
  assert.throws(() => L.normalizeBooking({ ...fam, memberCount: 0 }, 25), /memberCount/);
  assert.throws(() => L.normalizeBooking({ ...fam, memberCount: 26 }, 25), /memberCount/);
  assert.throws(() => L.normalizeBooking({ ...fam, familyName: '' }, 25), /familyName/);
});

test('group booking sums members and needs 2+ families', () => {
  const g = { ...fam, bookingType: 'group', groupName: 'Karkathi Devotees Group', families: [{ familyName: 'F1', memberCount: 4 }, { familyName: 'F2', memberCount: 3 }, { familyName: 'F3', memberCount: 5 }] };
  const n = L.normalizeBooking(L.parse(L.createBookingSchema, g), 25);
  assert.equal(n.memberCount, 12);
  assert.equal(n.families.length, 3);
  assert.equal(n.familyName, null);
  assert.throws(() => L.normalizeBooking({ ...g, families: [g.families[0]] }, 25), /at least 2/);
  assert.throws(() => L.normalizeBooking({ ...g, groupName: '' }, 25), /groupName/);
});

test('schema rejects wrong types', () => {
  assert.throws(() => L.parse(L.createBookingSchema, { ...fam, bookingType: 'solo' }), (e) => e.code === 'INVALID_INPUT');
  assert.throws(() => L.parse(L.createBookingSchema, { ...fam, memberCount: '4' }), (e) => e.code === 'INVALID_INPUT');
});

test('capacity: units by mode and full slot', () => {
  assert.equal(L.capacityUnits('bookings', 7), 1);
  assert.equal(L.capacityUnits('members', 7), 7);
  assert.doesNotThrow(() => L.checkCapacity({ capacity: 30, bookedCount: 29 }, 1));
  assert.throws(() => L.checkCapacity({ capacity: 30, bookedCount: 30 }, 1), (e) => e.code === 'SLOT_FULL');
  assert.throws(() => L.checkCapacity({ capacity: 30, bookedCount: 25 }, 6), (e) => e.code === 'SLOT_FULL');
});

test('booking id format', () => {
  assert.equal(L.formatBookingId('KA', '2026-10-11', 42), 'KA26-0042');
  assert.equal(L.formatBookingId('k-a!', '2026-10-11', 12345), 'KA26-12345');
});

test('IST conversion', () => {
  assert.equal(L.zonedToUtc('2026-10-11', '18:30', 'Asia/Kolkata').toISOString(), '2026-10-11T13:00:00.000Z');
  assert.equal(L.zonedToUtc('2026-10-11', '06:00', 'Asia/Kolkata').toISOString(), '2026-10-11T00:30:00.000Z');
});

test('payment submit state machine', () => {
  const now = Date.now();
  const base = { bookingStatus: 'pending', paymentStatus: 'pending', paymentSubmitted: false, holdExpiresMs: now + 60000 };
  assert.equal(L.paymentSubmitBlocker(base, now), null);
  assert.equal(L.paymentSubmitBlocker({ ...base, holdExpiresMs: now - 1 }, now), 'HOLD_EXPIRED');
  assert.equal(L.paymentSubmitBlocker({ ...base, paymentSubmitted: true, holdExpiresMs: null }, now), 'INVALID_STATE');
  assert.equal(L.paymentSubmitBlocker({ ...base, paymentStatus: 'rejected' }, now), null, 'resubmit after reject');
  assert.equal(L.paymentSubmitBlocker({ ...base, paymentStatus: 'paid' }, now), 'INVALID_STATE');
  assert.equal(L.paymentSubmitBlocker({ ...base, bookingStatus: 'cancelled' }, now), 'INVALID_STATE');
});

test('verify state machine', () => {
  const sub = { bookingStatus: 'pending', paymentStatus: 'pending', paymentSubmitted: true, holdExpiresMs: null, transactionId: 'UTR123456' };
  assert.equal(L.verifyBlocker(sub, 'approve'), null);
  assert.equal(L.verifyBlocker(sub, 'reject'), null);
  assert.equal(L.verifyBlocker({ ...sub, paymentSubmitted: false, transactionId: null }, 'approve'), 'INVALID_STATE', 'nothing submitted');
  assert.equal(L.verifyBlocker({ ...sub, paymentSubmitted: false, transactionId: null }, 'cash'), null, 'counter cash');
  assert.equal(L.verifyBlocker({ ...sub, paymentSubmitted: false }, 'reject'), 'INVALID_STATE');
  assert.equal(L.verifyBlocker({ ...sub, paymentStatus: 'rejected', paymentSubmitted: false }, 'approve'), null, 'undo mistaken reject');
  assert.equal(L.verifyBlocker({ ...sub, bookingStatus: 'confirmed', paymentStatus: 'paid' }, 'approve'), 'INVALID_STATE');
  assert.equal(L.verifyBlocker({ ...sub, bookingStatus: 'cancelled' }, 'cash'), 'INVALID_STATE');
  assert.equal(L.cancelBlocker({ bookingStatus: 'completed' }), 'INVALID_STATE');
  assert.equal(L.cancelBlocker({ bookingStatus: 'confirmed' }), null);
});

test('shared utils', () => {
  assert.equal(U.slotState({ capacity: 30, bookedCount: 21, active: true }, 25), 'available');
  assert.equal(U.slotState({ capacity: 30, bookedCount: 23, active: true }, 25), 'limited');
  assert.equal(U.slotState({ capacity: 30, bookedCount: 30, active: true }, 25), 'full');
  assert.equal(U.slotState({ capacity: 30, bookedCount: 0, active: false }, 25), 'closed');
  assert.equal(U.formatTime('18:30', 'en'), '06:30 PM');
  assert.equal(U.formatTime('06:00', 'ta'), 'காலை 6:00');
  assert.equal(U.formatDate('2026-10-11', 'en', { weekday: true }), 'Sun, 11 Oct 2026');
  assert.equal(U.normalizeTxnId(' 4123 4567 8901 '), '412345678901');
  assert.equal(U.normalizeTxnId('abc'), null);
  assert.equal(U.normalizeMobile('09876543210'), '9876543210');
  assert.equal(U.upiLink({ upiId: 'a@upi', payeeName: 'Sri Temple', amount: 501, note: 'KA26-0001' }), 'upi://pay?pa=a%40upi&pn=Sri%20Temple&am=501.00&cu=INR&tn=KA26-0001');
});
