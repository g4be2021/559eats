// Call from your booking endpoints right after the row is saved:
//   const { notifyOwnerOfBooking } = require('./lib/notify-booking');
//   try { await notifyOwnerOfBooking(booking, 'catering'); } catch (e) { console.error(e); }
// Use 'catering' for catering_bookings rows and 'table' for bookings rows.
const { SITE, db, sendSms } = require('./agents');

async function notifyOwnerOfBooking(booking, type = 'catering') {
  const owners = await db(
    `owners?restaurant_id=eq.${booking.restaurant_id}&sms_opt_out=is.false&phone=not.is.null&select=id,phone`
  );
  if (!owners.length) return;
  const [r] = await db(`restaurants?id=eq.${booking.restaurant_id}&select=id,name`);
  if (!r) return;

  const detail =
    type === 'catering'
      ? `catering request${booking.event_date ? ` for ${booking.event_date}` : ''}${booking.guest_count ? `, ${booking.guest_count} guests` : ''}`
      : `booking${booking.booking_date ? ` for ${booking.booking_date}` : ''}${booking.booking_time ? ` at ${booking.booking_time}` : ''}${booking.party_size ? `, party of ${booking.party_size}` : ''}`;

  for (const o of owners) {
    await sendSms({
      to: o.phone,
      body: `559eats: new ${detail} at ${r.name}. View it: ${SITE}/dashboard.html`,
      kind: 'booking_notification',
      restaurantId: r.id,
      ownerId: o.id,
    });
  }
}

module.exports = { notifyOwnerOfBooking };
