import { setGlobalOptions } from 'firebase-functions/v2';
import { FUNCTIONS_REGION } from './shared/model';

setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 10, memory: '256MiB' });

export {
  createBooking,
  submitPayment,
  lookupBooking,
  registerDevice,
  adminCreateBooking,
  adminVerifyPayment,
  adminCancelBooking,
  adminSendNotification,
} from './callables';

export {
  onBookingUpdated,
  auditSettings,
  auditFestivals,
  auditDays,
  auditUbayam,
  auditSlots,
  expireHolds,
  completeBookings,
} from './triggers';
