import pool, { query } from '@/lib/db/mysql';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================
 * BOOKING SERVICE LAYER
 * Encapsulates business logic for:
 * - Real-time availability checking
 * - Urgent booking validation
 * - Booking creation with conflict detection
 * ============================================
 */

/**
 * Interface for availability status
 */
export interface AvailabilityStatus {
  status: 'available' | 'limited' | 'unavailable';
  remainingSlots: number;
  totalSlots: number;
  availabilityPercentage: number;
  message: string;
  reason?: string;
}

/**
 * Interface for service availability result
 */
export interface ServiceAvailability {
  serviceId: string;
  providerId: string;
  date: string;
  availability: AvailabilityStatus;
  workingHours: {
    start: number;
    end: number;
    label: string;
  };
  availableSlots: string[];
  duration: number;
  isUrgentAvailable: boolean;
  urgentFee: number;
}

/**
 * Interface for urgent booking validation result
 */
export interface UrgentBookingValidation {
  isValid: boolean;
  error?: string;
  errorCode?: string;
  canProceed: boolean;
}

/**
 * Interface for booking creation result
 */
export interface BookingResult {
  success: boolean;
  bookingId?: string;
  totalAmount?: number;
  isUrgent?: boolean;
  urgentFee?: number;
  bookingType?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Parse availability JSON from service or use defaults
 */
function parseAvailability(availabilityJson: any): { startHour: number; endHour: number } {
  const defaultHours = { startHour: 9, endHour: 18 };
  
  if (!availabilityJson) {
    return defaultHours;
  }
  
  try {
    const availability = typeof availabilityJson === 'string' 
      ? JSON.parse(availabilityJson) 
      : availabilityJson;
    
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    
    const todayAvailability = Array.isArray(availability) 
      ? availability.find((a: any) => a.day === dayOfWeek)
      : null;
    
    if (todayAvailability && todayAvailability.periods && todayAvailability.periods.length > 0) {
      const firstPeriod = todayAvailability.periods[0];
      const lastPeriod = todayAvailability.periods[todayAvailability.periods.length - 1];
      
      return {
        startHour: parseInt(firstPeriod.start.split(':')[0]),
        endHour: parseInt(lastPeriod.end.split(':')[0])
      };
    }
    
    return defaultHours;
  } catch (error) {
    console.error('Error parsing availability:', error);
    return defaultHours;
  }
}

/**
 * Check if a specific time slot is available
 */
function isSlotAvailable(
  slotStart: Date,
  slotEnd: Date,
  bookings: any[],
  serviceDuration: number
): boolean {
  for (const booking of bookings) {
    const bookingStart = new Date(booking.scheduled_at);
    const bookingEnd = new Date(bookingStart.getTime() + (booking.duration_minutes || serviceDuration) * 60000);
    
    if (slotStart < bookingEnd && slotEnd > bookingStart) {
      return false;
    }
  }
  return true;
}

/**
 * Get real-time service availability for a specific date
 * This is the main function for checking service availability
 */
export async function getServiceAvailability(
  tenantId: string,
  serviceId: string,
  providerId: string,
  date: string
): Promise<ServiceAvailability | null> {
  try {
    // Get service details including availability
    const serviceRows = await query<any[]>(
      `SELECT s.duration_minutes, s.availability, s.allow_urgent, s.urgent_fee, s.is_active
       FROM services s 
       WHERE s.id = ? AND s.provider_id = ? AND s.tenant_id = ?`,
      [serviceId, providerId, tenantId]
    );

    if (serviceRows.length === 0) {
      return null;
    }

    const service = serviceRows[0];
    
    // Check if service is active
    if (!service.is_active) {
      return {
        serviceId,
        providerId,
        date,
        availability: {
          status: 'unavailable',
          remainingSlots: 0,
          totalSlots: 0,
          availabilityPercentage: 0,
          message: 'This service is currently not available',
          reason: 'service_inactive'
        },
        workingHours: { start: 9, end: 18, label: '09:00 - 18:00' },
        availableSlots: [],
        duration: service.duration_minutes || 60,
        isUrgentAvailable: false,
        urgentFee: 0
      };
    }

    const duration = service.duration_minutes || 60;
    const workingHours = parseAvailability(service.availability);
    const { startHour, endHour } = workingHours;

    // Get existing bookings for the date
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;

    const bookings = await query<any[]>(
      `SELECT b.scheduled_at, s.duration_minutes
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.provider_id = ?
         AND b.tenant_id = ?
         AND b.status NOT IN ('cancelled', 'refunded')
         AND b.scheduled_at BETWEEN ? AND ?
       ORDER BY b.scheduled_at`,
      [providerId, tenantId, startOfDay, endOfDay]
    );

    // Generate available time slots
    const availableSlots: string[] = [];
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isToday = requestedDate.getTime() === today.getTime();
    const isPastDate = requestedDate < today;
    
    const minSlotTime = new Date();
    minSlotTime.setHours(minSlotTime.getHours() + (isToday ? 2 : 0));

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotDateTime = `${date} ${slotTime}:00`;
        
        const slotStart = new Date(slotDateTime);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        if (isToday && slotStart < minSlotTime) {
          continue;
        }

        if (isPastDate) {
          continue;
        }

        if (isSlotAvailable(slotStart, slotEnd, bookings, duration)) {
          availableSlots.push(slotTime);
        }
      }
    }

    // Calculate availability status
    const totalSlots = (endHour - startHour) * 2;
    const remainingSlots = availableSlots.length;
    const isAvailable = remainingSlots > 0;
    const availabilityPercentage = totalSlots > 0 
      ? Math.round((remainingSlots / totalSlots) * 100) 
      : 0;

    let availabilityStatus: 'available' | 'limited' | 'unavailable';
    if (!isAvailable || isPastDate) {
      availabilityStatus = 'unavailable';
    } else if (remainingSlots <= 3) {
      availabilityStatus = 'limited';
    } else {
      availabilityStatus = 'available';
    }

    let message: string;
    if (availabilityStatus === 'unavailable') {
      message = isPastDate ? 'Cannot book for past dates' : 'No available slots for this date';
    } else if (availabilityStatus === 'limited') {
      message = `Only ${remainingSlots} slot(s) remaining`;
    } else {
      message = `${remainingSlots} slots available`;
    }

    return {
      serviceId,
      providerId,
      date,
      availability: {
        status: availabilityStatus,
        remainingSlots,
        totalSlots,
        availabilityPercentage,
        message,
        reason: isPastDate ? 'past_date' : undefined
      },
      workingHours: {
        start: startHour,
        end: endHour,
        label: `${startHour}:00 - ${endHour}:00`
      },
      availableSlots,
      duration,
      isUrgentAvailable: Boolean(service.allow_urgent),
      urgentFee: parseFloat(service.urgent_fee) || 0
    };

  } catch (error) {
    console.error('Error getting service availability:', error);
    throw error;
  }
}

/**
 * Validate urgent booking request
 * Checks if urgent booking is possible based on:
 * - Service allow_urgent flag
 * - Time proximity (within 2 hours)
 * - Current availability
 */
export async function validateUrgentBooking(
  tenantId: string,
  serviceId: string,
  providerId: string,
  scheduledAt: string,
  isUrgent: boolean = false,
  bookingType: string = 'one_time'
): Promise<UrgentBookingValidation> {
  // Not an urgent booking
  if (!isUrgent && bookingType !== 'emergency') {
    return { isValid: true, canProceed: true };
  }

  try {
    // Get service details
    const serviceRows = await query<any[]>(
      `SELECT s.allow_urgent, s.urgent_fee, s.duration_minutes
       FROM services s
       WHERE s.id = ? AND s.provider_id = ? AND s.tenant_id = ?
       LIMIT 1`,
      [serviceId, providerId, tenantId]
    );

    if (serviceRows.length === 0) {
      return {
        isValid: false,
        error: 'Service not found',
        errorCode: 'SERVICE_NOT_FOUND',
        canProceed: false
      };
    }

    const service = serviceRows[0];

    // Check if service allows urgent booking
    if (!service.allow_urgent) {
      return {
        isValid: false,
        error: 'Urgent booking is not available for this service',
        errorCode: 'URGENT_NOT_ALLOWED',
        canProceed: false
      };
    }

    // Check time proximity for urgent booking
    const requestedTime = new Date(scheduledAt);
    const now = new Date();
    const hoursDiff = (requestedTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Allow urgent booking if within 2 hours (or if explicitly marked as emergency)
    if (hoursDiff > 2 && bookingType !== 'emergency') {
      return {
        isValid: false,
        error: 'Urgent booking must be within 2 hours of current time',
        errorCode: 'URGENT_TOO_FAR',
        canProceed: false
      };
    }

    // Check if there's any available slot for urgent booking
    const dateStr = scheduledAt.split(' ')[0];
    const availability = await getServiceAvailability(tenantId, serviceId, providerId, dateStr);
    
    if (!availability || availability.availability.status === 'unavailable') {
      return {
        isValid: false,
        error: 'No available slots for urgent booking',
        errorCode: 'NO_AVAILABLE_SLOTS',
        canProceed: false
      };
    }

    return {
      isValid: true,
      canProceed: true
    };

  } catch (error) {
    console.error('Error validating urgent booking:', error);
    return {
      isValid: false,
      error: 'Failed to validate urgent booking',
      errorCode: 'VALIDATION_ERROR',
      canProceed: false
    };
  }
}

/**
 * Check for booking conflicts
 * Returns true if there's a conflict, false if slot is available
 */
export async function checkBookingConflict(
  tenantId: string,
  providerId: string,
  scheduledAt: string,
  duration: number,
  excludeBookingId?: string
): Promise<boolean> {
  try {
    const formattedScheduledAt = scheduledAt.replace('T', ' ').slice(0, 19);
    
    let queryStr = `
      SELECT b.id
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.provider_id = ?
        AND b.tenant_id = ?
        AND b.status NOT IN ('pending', 'cancelled', 'refunded')
        AND (
          ? < DATE_ADD(b.scheduled_at, INTERVAL COALESCE(s.duration_minutes, 60) MINUTE)
          AND DATE_ADD(?, INTERVAL ? MINUTE) > b.scheduled_at
        )
    `;
    
    const params: any[] = [
      providerId,
      tenantId,
      formattedScheduledAt,
      formattedScheduledAt,
      duration
    ];

    if (excludeBookingId) {
      queryStr += ' AND b.id != ?';
      params.push(excludeBookingId);
    }

    const conflicts = await query<any[]>(queryStr, params);
    
    return conflicts.length > 0;

  } catch (error) {
    console.error('Error checking booking conflict:', error);
    throw error;
  }
}

/**
 * Create a new booking with transaction and locking
 * This is the main function for creating bookings
 */
export async function createBooking(
  tenantId: string,
  customerId: string,
  bookingData: {
    serviceId: string;
    providerId: string;
    scheduledAt: string;
    customerAddress?: any;
    notes?: string;
    addons?: string[];
    paymentType?: string;
    isUrgent?: boolean;
    bookingType?: string;
  }
): Promise<BookingResult> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      serviceId,
      providerId,
      scheduledAt,
      customerAddress,
      notes,
      addons,
      paymentType = 'instant',
      isUrgent = false,
      bookingType = 'one_time'
    } = bookingData;

    // Validate payment type
    const allowedPaymentTypes = ['instant', 'cash_on_delivery'];
    if (!allowedPaymentTypes.includes(paymentType)) {
      await connection.rollback();
      return {
        success: false,
        error: 'Invalid payment type',
        errorCode: 'INVALID_PAYMENT_TYPE'
      };
    }

    // Determine booking type
    let isUrgentBooking = isUrgent;
    let finalBookingType = bookingType;
    
    if (isUrgentBooking && finalBookingType === 'one_time') {
      finalBookingType = 'emergency';
    }

    if (!serviceId || !providerId || !scheduledAt) {
      await connection.rollback();
      return {
        success: false,
        error: 'Service ID, Provider ID, and scheduled time are required',
        errorCode: 'MISSING_REQUIRED_FIELDS'
      };
    }

    const formattedScheduledAt = scheduledAt.replace('T', ' ').slice(0, 19);

    // Get service details with lock
    const [services]: any[] = await connection.execute(
      `SELECT s.*, sp.commission_rate
       FROM services s
       JOIN service_providers sp ON s.provider_id = sp.id
       WHERE s.id = ? AND s.provider_id = ? AND s.tenant_id = ? AND s.is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [serviceId, providerId, tenantId]
    );

    if (services.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Service not found or not available',
        errorCode: 'SERVICE_NOT_FOUND'
      };
    }

    const service = services[0];

    // Validate urgent booking
    if (isUrgentBooking || finalBookingType === 'emergency') {
      if (!service.allow_urgent) {
        await connection.rollback();
        return {
          success: false,
          error: 'Urgent booking is not available for this service',
          errorCode: 'URGENT_NOT_ALLOWED'
        };
      }

      const requestedTime = new Date(formattedScheduledAt);
      const now = new Date();
      const hoursDiff = (requestedTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > 2 && finalBookingType !== 'emergency') {
        await connection.rollback();
        return {
          success: false,
          error: 'Urgent booking must be within 2 hours of current time',
          errorCode: 'URGENT_TOO_FAR'
        };
      }
    }

    // Validate payment method
    const allowedPaymentMethods = service.payment_methods 
      ? (typeof service.payment_methods === 'string' 
          ? JSON.parse(service.payment_methods) 
          : service.payment_methods)
      : ['instant'];
    
    if (!allowedPaymentMethods.includes(paymentType)) {
      await connection.rollback();
      return {
        success: false,
        error: `Payment type '${paymentType}' is not allowed for this service`,
        errorCode: 'PAYMENT_METHOD_NOT_ALLOWED'
      };
    }

    const requestedDuration = service.duration_minutes || 60;

    // Check for conflicts with locking
    const [conflicts]: any[] = await connection.execute(
      `SELECT b.id
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.provider_id = ?
         AND b.tenant_id = ?
         AND b.status NOT IN ('pending', 'cancelled', 'refunded')
         AND (
           ? < DATE_ADD(b.scheduled_at, INTERVAL COALESCE(s.duration_minutes, 60) MINUTE)
           AND DATE_ADD(?, INTERVAL ? MINUTE) > b.scheduled_at
         )
       FOR UPDATE`,
      [providerId, tenantId, formattedScheduledAt, formattedScheduledAt, requestedDuration]
    );

    if (conflicts.length > 0) {
      await connection.rollback();
      return {
        success: false,
        error: 'Selected time slot is not available',
        errorCode: 'TIME_SLOT_CONFLICT'
      };
    }

    // Calculate price with addons
    let totalAmount = parseFloat(service.base_price);
    let addonIds: string[] = [];
    let urgentFee = 0;

    if (Array.isArray(addons) && addons.length > 0) {
      addonIds = addons;
      const placeholders = addonIds.map(() => '?').join(',');

      const [addonsList]: any[] = await connection.execute(
        `SELECT * FROM service_addons WHERE service_id = ? AND id IN (${placeholders})`,
        [serviceId, ...addonIds]
      );

      for (const addon of addonsList) {
        totalAmount += parseFloat(addon.price);
      }
    }

    // Add urgent fee if applicable
    if (isUrgentBooking || finalBookingType === 'emergency') {
      urgentFee = parseFloat(service.urgent_fee) || 0;
      totalAmount += urgentFee;
    }

    const commissionAmount = (totalAmount * service.commission_rate) / 100;

    // Create booking
    const bookingId = uuidv4();

    await connection.execute(
      `INSERT INTO bookings (
        id, tenant_id, customer_id, provider_id, service_id,
        booking_type, allow_urgent, urgent_fee, status, scheduled_at, total_amount, commission_amount,
        currency_id, payment_status, payment_type, customer_address, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingId,
        tenantId,
        customerId,
        providerId,
        serviceId,
        finalBookingType,
        isUrgentBooking || finalBookingType === 'emergency' ? 1 : 0,
        urgentFee,
        'pending',
        formattedScheduledAt,
        totalAmount,
        commissionAmount,
        service.currency_id || null,
        'pending',
        paymentType,
        customerAddress ? JSON.stringify(customerAddress) : null,
        notes || null,
      ]
    );

    // Link addons
    if (addonIds.length > 0) {
      const placeholders = addonIds.map(() => '?').join(',');

      const [addonsList]: any[] = await connection.execute(
        `SELECT * FROM service_addons WHERE service_id = ? AND id IN (${placeholders})`,
        [serviceId, ...addonIds]
      );

      for (const addon of addonsList) {
        await connection.execute(
          `INSERT INTO booking_addons (booking_id, addon_id, price)
           VALUES (?, ?, ?)`,
          [bookingId, addon.id, addon.price]
        );
      }
    }

    await connection.commit();

    return {
      success: true,
      bookingId,
      totalAmount,
      isUrgent: isUrgentBooking || finalBookingType === 'emergency',
      urgentFee,
      bookingType: finalBookingType
    };

  } catch (error) {
    await connection.rollback();
    console.error('Create booking error:', error);
    return {
      success: false,
      error: 'Failed to create booking',
      errorCode: 'BOOKING_FAILED'
    };
  } finally {
    connection.release();
  }
}

/**
 * Get quick availability status (simplified for real-time display)
 * Returns just the status without full slot details
 */
export async function getQuickAvailabilityStatus(
  tenantId: string,
  serviceId: string,
  providerId: string,
  date: string
): Promise<AvailabilityStatus | null> {
  const availability = await getServiceAvailability(tenantId, serviceId, providerId, date);
  return availability?.availability || null;
}

/**
 * Update availability cache or trigger refresh
 * This can be called after booking creation/cancellation
 */
export async function refreshAvailability(
  tenantId: string,
  serviceId: string,
  providerId: string
): Promise<void> {
  // In a real application, this could:
  // 1. Clear any cached availability data
  // 2. Trigger a WebSocket update to connected clients
  // 3. Invalidate any CDN caches
  
  // For now, this is a placeholder for future implementation
  // The availability is calculated in real-time from the database
  console.log(`Availability refresh triggered for service ${serviceId}, provider ${providerId}`);
}

export default {
  getServiceAvailability,
  validateUrgentBooking,
  checkBookingConflict,
  createBooking,
  getQuickAvailabilityStatus,
  refreshAvailability
};
