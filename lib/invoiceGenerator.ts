/**
 * Invoice Generator Utility
 * Generates professional HTML invoices for booking confirmations
 */

export interface InvoiceData {
  // Invoice Info
  invoiceNumber: string;
  bookingDate: string;
  bookingId: string;
  
  // Customer Info
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  

  
  // Service Info
  serviceName: string;
  serviceNameAr?: string;
  serviceDescription?: string;
  serviceDuration: number;
  
  // Schedule Info
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
  
  // Pricing
  basePrice: number;
  addons: Array<{
    name: string;
    nameAr?: string;
    price: number;
  }>;
  urgentFee?: number;
  
  // Payment Info
  paymentType: 'instant' | 'cash_on_delivery';
  paymentStatus: 'paid' | 'pending';
  
  // Language
  language: 'en' | 'ar';
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const isArabic = data.language === 'ar';
  const currency = 'OMR';
  
  // Calculate totals
  const addonsTotal = data.addons.reduce((sum, addon) => sum + addon.price, 0);
  const urgentFee = data.urgentFee || 0;
  const total = data.basePrice + addonsTotal + urgentFee;
  
  // Get service name based on language
  const serviceName = isArabic && data.serviceNameAr ? data.serviceNameAr : data.serviceName;
  
  // Payment status text
  const paymentStatusText = data.paymentStatus === 'paid' 
    ? (isArabic ? '✓ مدفوع' : '✓ Paid')
    : (isArabic ? 'معلق' : 'Pending');
  
  // Payment type text
  const paymentTypeText = data.paymentType === 'instant'
    ? (isArabic ? 'الدفع الفوري' : 'Instant Payment')
    : (isArabic ? 'الدفع نقدًا عند الموعد' : 'Cash on Delivery');
  
  // Booking type for display
  const bookingType = data.paymentType === 'instant'
    ? (isArabic ? 'فوري' : 'Instant')
    : (isArabic ? 'نقدًا عند الموعد' : 'Cash on Delivery');

  // Generate addons HTML
  const addonsHTML = data.addons.map(addon => `
    <tr class="border-b">
      <td class="py-3 text-muted-foreground">
        + ${isArabic && addon.nameAr ? addon.nameAr : addon.name}
      </td>
      <td class="text-right py-3 font-medium">
        ${addon.price.toFixed(3)} ${currency}
      </td>
    </tr>
  `).join('');

  // Generate the invoice HTML
  const html = `
<!DOCTYPE html>
<html dir="${isArabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${isArabic ? 'الفاتورة' : 'Invoice'} - ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 40px;
      background: #fff;
      color: #333;
      line-height: 1.6;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    .invoice-header {
      border-bottom: 3px solid #2563eb;
      margin-bottom: 30px;
      padding-bottom: 20px;
    }
    .invoice-title {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 5px;
    }
    .invoice-subtitle {
      color: #666;
      font-size: 14px;
    }
    .invoice-number {
      text-align: ${isArabic ? 'left' : 'right'};
    }
    .invoice-number-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .invoice-number-value {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    .info-section h3 {
      font-size: 14px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-row {
      display: flex;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .info-label {
      font-weight: 600;
      color: #666;
      min-width: 100px;
    }
    .info-value {
      color: #333;
    }
    .schedule-box {
      background: #f8fafc;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .schedule-title {
      font-size: 14px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .schedule-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .schedule-item label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    .schedule-item value {
      display: block;
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .items-table th {
      text-align: ${isArabic ? 'right' : 'left'};
      padding: 12px;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      font-size: 12px;
      font-weight: bold;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .items-table .amount {
      text-align: right;
      font-weight: 600;
    }
    .totals-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row:last-child {
      border-bottom: none;
    }
    .totals-label {
      color: #666;
    }
    .totals-value {
      font-weight: 600;
    }
    .totals-row.total {
      font-size: 20px;
      font-weight: bold;
      color: #2563eb;
      border-top: 2px solid #2563eb;
      margin-top: 10px;
      padding-top: 15px;
    }
    .payment-info {
      background: ${data.paymentType === 'instant' ? '#dcfce7' : '#fef3c7'};
      border: 2px solid ${data.paymentType === 'instant' ? '#22c55e' : '#f59e0b'};
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .payment-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .payment-item label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    .payment-item value {
      display: block;
      font-size: 16px;
      font-weight: bold;
      color: ${data.paymentType === 'instant' ? '#16a34a' : '#d97706'};
    }
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #666;
      font-size: 12px;
    }
    .footer-message {
      font-size: 14px;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 5px;
    }
    @media print {
      body {
        padding: 20px;
      }
      .invoice-container {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="invoice-header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="invoice-title">${isArabic ? 'الفاتورة' : 'INVOICE'}</div>
          <div class="invoice-subtitle">${isArabic ? 'ملخص طلب الحجز' : 'Booking Order Summary'}</div>
        </div>
        <div class="invoice-number">
          <div class="invoice-number-label">${isArabic ? 'رقم الحجز:' : 'Booking ID:'}</div>
          <div class="invoice-number-value">${data.bookingId}</div>
        </div>
      </div>
    </div>

    <!-- Info Grid -->
    <div class="info-grid">
      <!-- Customer Info -->
      <div class="info-section">
        <h3>${isArabic ? 'بيانات العميل' : 'CUSTOMER DETAILS'}</h3>
        <div class="info-row">
          <span class="info-label">${isArabic ? 'الاسم:' : 'Name:'}</span>
          <span class="info-value">${data.customerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${isArabic ? 'البريد:' : 'Email:'}</span>
          <span class="info-value">${data.customerEmail}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${isArabic ? 'الجوال:' : 'Phone:'}</span>
          <span class="info-value">${data.customerPhone}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${isArabic ? 'العنوان:' : 'Address:'}</span>
          <span class="info-value">${data.customerAddress}</span>
        </div>
      </div>

      <!--Service Info -->
      <div class="info-section">
        <h3>${isArabic ? 'الخدمة ' : 'SERVICE'}</h3>
        <div class="info-row">
        </div>
        <div class="info-row">
          <span class="info-label">${isArabic ? 'الخدمة:' : 'Service:'}</span>
          <span class="info-value">${serviceName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${isArabic ? 'المدة:' : 'Duration:'}</span>
          <span class="info-value">${data.serviceDuration} ${isArabic ? 'دقيقة' : 'minutes'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${isArabic ? 'نوع الحجز:' : 'Booking Type:'}</span>
          <span class="info-value">${bookingType}</span>
        </div>
      </div>
    </div>

    <!-- Schedule -->
    <div class="schedule-box">
      <div class="schedule-title">${isArabic ? 'موعد الخدمة' : 'SERVICE SCHEDULE'}</div>
      <div class="schedule-grid">
        <div class="schedule-item">
          <label>${isArabic ? 'التاريخ:' : 'Date:'}</label>
          <value>${data.scheduledDate}</value>
        </div>
        <div class="schedule-item">
          <label>${isArabic ? 'الوقت:' : 'Time:'}</label>
          <value>${data.scheduledTime}</value>
        </div>
      </div>
      ${data.notes ? `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
        <label style="font-size: 12px; color: #666;">${isArabic ? 'ملاحظات:' : 'Notes:'}</label>
        <value style="display: block; margin-top: 4px;">${data.notes}</value>
      </div>
      ` : ''}
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th>${isArabic ? 'الخدمة / الإضافة' : 'Item'}</th>
          <th style="text-align: right;">${isArabic ? 'السعر' : 'Price'}</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b">
          <td class="py-3">${serviceName}</td>
          <td class="amount">${data.basePrice.toFixed(3)} ${currency}</td>
        </tr>
        ${addonsHTML}
        ${urgentFee > 0 ? `
        <tr class="border-b">
          <td class="py-3 text-muted-foreground">${isArabic ? 'رسوم التوصيل العاجل' : 'Urgent Service Fee'}</td>
          <td class="amount">${urgentFee.toFixed(3)} ${currency}</td>
        </tr>
        ` : ''}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-row">
        <span class="totals-label">${isArabic ? 'سعر الخدمة:' : 'Service Price:'}</span>
        <span class="totals-value">${data.basePrice.toFixed(3)} ${currency}</span>
      </div>
      ${addonsTotal > 0 ? `
      <div class="totals-row">
        <span class="totals-label">${isArabic ? 'الإضافات:' : 'Add-ons:'}</span>
        <span class="totals-value">+${addonsTotal.toFixed(3)} ${currency}</span>
      </div>
      ` : ''}
      ${urgentFee > 0 ? `
      <div class="totals-row">
        <span class="totals-label">${isArabic ? 'رسوم التوصيل العاجل:' : 'Urgent Fee:'}</span>
        <span class="totals-value">+${urgentFee.toFixed(3)} ${currency}</span>
      </div>
      ` : ''}
      <div class="totals-row total">
        <span>${isArabic ? 'الإجمالي:' : 'TOTAL:'}</span>
        <span>${total.toFixed(3)} ${currency}</span>
      </div>
    </div>

    <!-- Payment Info -->
    <div class="payment-info">
      <div class="payment-info-grid">
        <div class="payment-item">
          <label>${isArabic ? 'طريقة الدفع:' : 'Payment Method:'}</label>
          <value>${paymentTypeText}</value>
        </div>
        <div class="payment-item">
          <label>${isArabic ? 'حالة الدفع:' : 'Payment Status:'}</label>
          <value>${paymentStatusText}</value>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-message">${isArabic ? 'شكراً لاستخدامك خدماتنا' : 'Thank you for using our services'}</div>
      <div>${data.bookingDate}</div>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Generate invoice and export as PDF using html2pdf.js
 */
export async function exportInvoiceToPDF(
  data: InvoiceData,
  element: HTMLElement,
  onProgress?: (progress: number) => void
): Promise<void> {
  // Import html2pdf.js dynamically
  const html2pdf = (await import('html2pdf.js')).default;
  
  const invoiceHTML = generateInvoiceHTML(data);
  
  // Create a temporary container
  const container = document.createElement('div');
  container.innerHTML = invoiceHTML;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);
  
  const opt = {
    margin: 10,
    filename: `booking-${data.bookingId}.pdf`,
    image: { type: 'png' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: false
    },
    jsPDF: { 
      orientation: 'portrait' as const, 
      unit: 'mm', 
      format: 'a4' 
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };
  
  try {
    await html2pdf().set(opt).from(container).save();
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Open invoice in print dialog
 */
export function printInvoice(data: InvoiceData): void {
  const invoiceHTML = generateInvoiceHTML(data);
  
  const printWindow = window.open('', '', 'height=600,width=800');
  if (printWindow) {
    printWindow.document.write('<!DOCTYPE html>');
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
