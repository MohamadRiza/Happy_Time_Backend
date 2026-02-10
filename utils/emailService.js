// server/utils/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready');
  }
});

const getProductHtml = (item) => {
  const imageUrl = item.productId?.images?.[0] 
    ? (item.productId.images[0].startsWith('http') 
        ? item.productId.images[0] 
        : `${process.env.FRONTEND_URL}/uploads/${item.productId.images[0]}`)
    : 'https://placehold.co/100x100/1f2937/ffffff?text=No+Image';

  return `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #374151;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td width="80" style="padding-right: 12px;">
              <img src="${imageUrl}" alt="${item.productId?.title}" width="80" style="border-radius: 8px; display: block;">
            </td>
            <td>
              <div style="font-weight: 600; color: #fff; font-size: 14px;">${item.productId?.title}</div>
              <div style="color: #9ca3af; font-size: 13px; margin: 4px 0;">${item.selectedColor}</div>
              <div style="color: #d1d5db; font-size: 13px;">Qty: ${item.quantity} × ${item.price ? `LKR ${Number(item.price).toLocaleString()}` : 'Contact'}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
};

// ✅ FIXED: Use .toString()
const sendPaymentVerifiedEmail = async (to, order) => {
  const itemsHtml = order.items.map(getProductHtml).join('');
  const total = order.totalAmount ? `LKR ${Number(order.totalAmount).toLocaleString()}` : 'Contact for Price';
  const orderIdShort = order._id.toString().substring(order._id.toString().length - 6); // ✅ FIXED

  const html = `
    <div style="background: #000; color: #fff; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="background: linear-gradient(90deg, #d4af37, #b8860b); width: 40px; height: 40px; border-radius: 50%; margin: 0 auto;"></div>
        <h1 style="color: #d4af37; margin-top: 16px;">Payment Confirmed</h1>
      </div>
      
      <p>Hello ${order.customer?.fullName},</p>
      <p>Great news! Your payment for order <strong>#${orderIdShort}</strong> has been verified.</p>
      
      <div style="background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <h3 style="color: #d4af37; margin-top: 0;">Order Summary</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 0 0; text-align: right; font-size: 16px; font-weight: bold; color: #fff;">
              Total: ${total}
            </td>
          </tr>
        </table>
      </div>
      
      <p>Your order is now being processed. We’ll notify you once it ships!</p>
      <p>Thank you for choosing Happy Time.</p>
      
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #374151; color: #6b7280; font-size: 12px;">
        © ${new Date().getFullYear()} Happy Time Pvt Ltd. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Happy Time" <${process.env.SMTP_USER}>`,
    to,
    subject: `✅ Payment Confirmed – Order #${orderIdShort}`,
    html
  });
};

// ✅ FIXED: Use .toString()
const sendPaymentRejectedEmail = async (to, order) => {
  const itemsHtml = order.items.map(getProductHtml).join('');
  const total = order.totalAmount ? `LKR ${Number(order.totalAmount).toLocaleString()}` : 'Contact for Price';
  const orderIdShort = order._id.toString().substring(order._id.toString().length - 6); // ✅ FIXED

  const html = `
    <div style="background: #000; color: #fff; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="background: #ef4444; width: 40px; height: 40px; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold;">!</div>
        <h1 style="color: #ef4444; margin-top: 16px;">Payment Issue Detected</h1>
      </div>
      
      <p>Hello ${order.customer?.fullName},</p>
      <p>We noticed an issue with the payment receipt for your order <strong>#${orderIdShort}</strong>.</p>
      
      <div style="background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <h3 style="color: #ef4444; margin-top: 0;">Order Summary</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 0 0; text-align: right; font-size: 16px; font-weight: bold; color: #fff;">
              Total: ${total}
            </td>
          </tr>
        </table>
      </div>
      
      <p>Please check:</p>
      <ul style="margin: 12px 0; padding-left: 20px;">
        <li>The bank account number matches ours</li>
        <li>The transfer amount is correct</li>
        <li>The receipt is clear and readable</li>
      </ul>
      
      <p><strong>Next Steps:</strong> Log in to your account, upload a corrected receipt, or contact us for assistance.</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.FRONTEND_URL}/contact" style="display: inline-block; background: #d4af37; color: #000; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Contact Support</a>
      </div>
      
      <p>We’re here to help you complete your purchase.</p>
      
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #374151; color: #6b7280; font-size: 12px;">
        © ${new Date().getFullYear()} Happy Time Pvt Ltd. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Happy Time" <${process.env.SMTP_USER}>`,
    to,
    subject: `⚠️ Action Required: Payment Receipt Issue – Order #${orderIdShort}`,
    html
  });
};

// ✅ FIXED: Use .toString()
const sendOrderStatusEmail = async (to, order, status) => {
  const itemsHtml = order.items.map(getProductHtml).join('');
  const total = order.totalAmount ? `LKR ${Number(order.totalAmount).toLocaleString()}` : 'Contact for Price';
  const orderIdShort = order._id.toString().substring(order._id.toString().length - 6); // ✅ FIXED
  
  let subject, heading, message, color, bgColor;
  
  switch(status) {
    case 'confirmed':
      subject = `📦 Order Confirmed – #${orderIdShort}`;
      heading = 'Order Confirmed';
      message = 'Your order has been confirmed and is being prepared for shipment.';
      color = '#3b82f6';
      bgColor = '#1d4ed8';
      break;
    case 'shipped':
      subject = `🚚 Your Order Has Shipped – #${orderIdShort}`;
      heading = 'Order Shipped';
      message = 'Your order is on its way! Track your package using the details below.';
      color = '#8b5cf6';
      bgColor = '#7c3aed';
      break;
    case 'delivered':
      subject = `✅ Delivered – Thank You! – #${orderIdShort}`;
      heading = 'Order Delivered';
      message = 'Your order has been successfully delivered. Thank you for your purchase!';
      color = '#10b981';
      bgColor = '#059669';
      break;
    case 'cancelled':
      subject = `❌ Order Cancelled – #${orderIdShort}`;
      heading = 'Order Cancelled';
      message = 'We’re sorry, but your order has been cancelled. If this was unexpected, please contact us.';
      color = '#ef4444';
      bgColor = '#dc2626';
      break;
    default:
      return;
  }

  const html = `
    <div style="background: #000; color: #fff; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="background: ${bgColor}; width: 40px; height: 40px; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold;">✓</div>
        <h1 style="color: ${color}; margin-top: 16px;">${heading}</h1>
      </div>
      
      <p>Hello ${order.customer?.fullName},</p>
      <p>${message}</p>
      
      <div style="background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <h3 style="color: ${color}; margin-top: 0;">Order Summary</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 0 0; text-align: right; font-size: 16px; font-weight: bold; color: #fff;">
              Total: ${total}
            </td>
          </tr>
        </table>
      </div>
      
      ${status === 'cancelled' ? `
        <p>We understand this may be disappointing. If you have questions or believe this was a mistake, please reach out to our team.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.FRONTEND_URL}/contact" style="display: inline-block; background: #d4af37; color: #000; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Contact Us</a>
        </div>
      ` : ''}
      
      <p>Thank you for choosing Happy Time.</p>
      
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #374151; color: #6b7280; font-size: 12px;">
        © ${new Date().getFullYear()} Happy Time Pvt Ltd. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Happy Time" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
};

module.exports = {
  sendPaymentVerifiedEmail,
  sendPaymentRejectedEmail,
  sendOrderStatusEmail
};