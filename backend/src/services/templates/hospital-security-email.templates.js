/**
 * CareSetu Centralized Hospital Security Email Templates
 * Standardized HTML/Text email generators for hospital security warnings, restrictions, and restorations.
 * Strict Privacy Rule: Zero patient data, HealthPack contents, medical records, or secrets.
 */

function formatDate(date) {
  return new Date(date || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata'
  });
}

function getHeaderStyle() {
  return `
    <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: #38bdf8; margin: 0; font-size: 22px; font-family: Arial, sans-serif; letter-spacing: 1px;">
        🛡️ CARESETU SECURITY
      </h1>
      <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; font-family: Arial, sans-serif;">
        Protected Content Security Policy Enforcement
      </p>
    </div>
  `;
}

function getFooterStyle() {
  return `
    <div style="margin-top: 24px; padding-t: 16px; border-t: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-family: Arial, sans-serif;">
      <p style="margin: 0 0 8px 0;">Regards,</p>
      <p style="margin: 0; font-weight: bold; color: #334155;">CareSetu Security Team</p>
      <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">
        This is an automated security notification. Please do not reply directly to this email. Use the authenticated CareSetu Hospital Portal for official communication.
      </p>
    </div>
  `;
}

/**
 * 1. Attempt 1 Email — Security Warning 1 of 3
 */
function hospitalSecurityWarning1({ recipientName = 'Hospital Portal Administrator', detectedAt = new Date(), securityEpoch = 1 }) {
  const subject = 'CareSetu — Security Warning 1 of 3';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
      ${getHeaderStyle()}
      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.6;">
        <p>Dear <strong>${recipientName}</strong>,</p>
        <p>A protected-content security event has been detected on your CareSetu Hospital Portal.</p>
        
        <div style="background-color: #fffbebfb; border-left: 4px solid #f59e0b; padding: 14px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0 0 6px 0;"><strong>Security Warning:</strong> 1 of 3</p>
          <p style="margin: 0 0 6px 0;"><strong>Current Status:</strong> <span style="color: #d97706; font-weight: bold;">WARNING</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Reason:</strong> Protected medical-content capture violation</p>
          <p style="margin: 0 0 6px 0;"><strong>Detected At:</strong> ${formatDate(detectedAt)}</p>
          <p style="margin: 0;"><strong>Protected Resource:</strong> CareSetu HealthPack / Medical Document</p>
        </div>

        <p>This is your <strong>first security warning</strong>.</p>
        <p>Please do not capture, photograph, record, reproduce, download, print, or redistribute protected CareSetu medical information.</p>
        <p>Your portal remains accessible at this stage.</p>
        <p>If you believe this event was detected incorrectly, please contact CareSetu Administration through the Hospital Portal.</p>
        
        ${getFooterStyle()}
      </div>
    </div>
  `;
  return { subject, html };
}

/**
 * 2. Attempt 2 Email — Final Security Warning 2 of 3
 */
function hospitalSecurityWarning2({ recipientName = 'Hospital Portal Administrator', detectedAt = new Date(), securityEpoch = 1 }) {
  const subject = 'CareSetu — Final Security Warning 2 of 3';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
      ${getHeaderStyle()}
      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.6;">
        <p>Dear <strong>${recipientName}</strong>,</p>
        <p>A second protected-content security violation has been confirmed on your CareSetu Hospital Portal.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 14px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0 0 6px 0;"><strong>Security Warning:</strong> 2 of 3</p>
          <p style="margin: 0 0 6px 0;"><strong>Current Status:</strong> <span style="color: #dc2626; font-weight: bold;">FINAL WARNING</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Reason:</strong> Protected medical-content capture violation</p>
          <p style="margin: 0;"><strong>Detected At:</strong> ${formatDate(detectedAt)}</p>
        </div>

        <p>Your account has received <strong>two confirmed security violations</strong>.</p>
        <p style="color: #b91c1c; font-weight: bold;">
          One additional confirmed violation may result in temporary restriction of your Hospital Portal access.
        </p>
        <p>Please immediately stop capturing, photographing, recording, reproducing, downloading, printing, or redistributing protected CareSetu medical information.</p>
        <p>If you believe this event was detected incorrectly, contact CareSetu Administration.</p>
        
        ${getFooterStyle()}
      </div>
    </div>
  `;
  return { subject, html };
}

/**
 * 3. Attempt 3 Email — Hospital Portal Temporarily Blocked
 */
function hospitalSecurityBlocked({ recipientName = 'Hospital Portal Administrator', blockedAt = new Date(), securityEpoch = 1 }) {
  const subject = 'CareSetu — Hospital Portal Temporarily Blocked';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #dc2626; border-radius: 8px; overflow: hidden;">
      ${getHeaderStyle()}
      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.6;">
        <p>Dear <strong>${recipientName}</strong>,</p>
        <p>Your CareSetu Hospital Portal account has been <strong>temporarily restricted</strong> following three confirmed protected-content security violations.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 14px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0 0 6px 0;"><strong>Security Status:</strong> <span style="color: #dc2626; font-weight: bold;">TEMPORARILY BLOCKED</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Security Violations:</strong> 3 / 3</p>
          <p style="margin: 0 0 6px 0;"><strong>Reason:</strong> Protected medical-content capture violation</p>
          <p style="margin: 0 0 6px 0;"><strong>Blocked At:</strong> ${formatDate(blockedAt)}</p>
          <p style="margin: 0;"><strong>Review Status:</strong> <span style="color: #b45309; font-weight: bold;">UNDER SECURITY REVIEW</span></p>
        </div>

        <p>The restriction was applied because protected CareSetu medical content was captured or a protected-screen capture event was detected. This activity violates the CareSetu HealthPack terms and conditions.</p>
        
        <p><strong>While the account is temporarily restricted:</strong></p>
        <ul style="color: #475569; margin: 8px 0 16px 20px; padding: 0;">
          <li>normal Hospital Portal operations are unavailable</li>
          <li>protected patient information cannot be accessed</li>
          <li>HealthPack / document access is restricted</li>
          <li>normal hospital operations remain unavailable until administrative review</li>
        </ul>

        <p>If you believe this restriction was applied incorrectly, log into the Hospital Portal and click <strong>Submit Review Request</strong> or <strong>Contact Administration</strong>.</p>
        <p>Your review request will be forwarded directly to the CareSetu Administration team.</p>
        
        ${getFooterStyle()}
      </div>
    </div>
  `;
  return { subject, html };
}

/**
 * 4. Admin Email — Hospital Review Request Submitted
 */
function hospitalSecurityReviewSubmitted({ hospitalName, userName, userEmail, reviewReference, description, submittedAt = new Date() }) {
  const subject = `CareSetu — Hospital Security Review Request (${hospitalName})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #2563eb; border-radius: 8px; overflow: hidden;">
      ${getHeaderStyle()}
      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.6;">
        <h3 style="color: #1d4ed8; margin: 0 0 12px 0;">⚠️ New Hospital Security Review Request</h3>
        <p>A restricted hospital portal user has submitted an appeal for administrative review.</p>
        
        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 14px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0 0 6px 0;"><strong>Hospital:</strong> ${hospitalName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Hospital User:</strong> ${userName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Email:</strong> ${userEmail}</p>
          <p style="margin: 0 0 6px 0;"><strong>Security Violations:</strong> 3 / 3</p>
          <p style="margin: 0 0 6px 0;"><strong>Reason:</strong> Protected medical-content capture violation</p>
          <p style="margin: 0 0 6px 0;"><strong>Review Reference:</strong> <code style="background-color: #dbeafe; padding: 2px 6px; rounded: 4px;">${reviewReference}</code></p>
          <p style="margin: 0 0 6px 0;"><strong>Submitted At:</strong> ${formatDate(submittedAt)}</p>
          <p style="margin: 0;"><strong>Review Status:</strong> PENDING</p>
        </div>

        <div style="background-color: #fffbebfb; border: 1px solid #fde68a; padding: 14px; margin: 16px 0; border-radius: 6px;">
          <p style="margin: 0 0 6px 0; font-weight: bold; color: #92400e;">Hospital Explanation:</p>
          <p style="margin: 0; color: #78350f; font-style: italic; white-space: pre-wrap;">"${description}"</p>
        </div>

        <p style="font-size: 12px; color: #64748b;">
          Log into the Admin Console at <code>/admin/security-violations</code> to issue an administrative access decision.
        </p>

        ${getFooterStyle()}
      </div>
    </div>
  `;
  return { subject, html };
}

/**
 * 5. Hospital Unblocked Email — Hospital Portal Access Restored
 */
function hospitalSecurityUnlocked({ recipientName = 'Hospital Portal Administrator', restoredAt = new Date(), securityEpoch = 2 }) {
  const subject = 'CareSetu — Hospital Portal Access Restored';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #10b981; border-radius: 8px; overflow: hidden;">
      ${getHeaderStyle()}
      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.6;">
        <p>Dear <strong>${recipientName}</strong>,</p>
        <p>Your CareSetu Hospital Portal access has been <strong>restored</strong> following administrative review.</p>
        
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0 0 6px 0;"><strong>Account Status:</strong> <span style="color: #059669; font-weight: bold;">ACTIVE</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Previous Security Violations:</strong> 3 / 3</p>
          <p style="margin: 0 0 6px 0;"><strong>Reason for Previous Restriction:</strong> Protected medical-content capture violation</p>
          <p style="margin: 0 0 6px 0;"><strong>Review Status:</strong> <span style="color: #059669; font-weight: bold;">APPROVED</span></p>
          <p style="margin: 0;"><strong>Restored At:</strong> ${formatDate(restoredAt)}</p>
        </div>

        <p>Your Hospital Portal access has now been restored.</p>
        <p>Please ensure that protected CareSetu medical information is not captured, photographed, recorded, downloaded, printed, reproduced, or redistributed.</p>
        <p style="font-size: 13px; color: #475569;">
          Future violations may result in additional security restrictions in accordance with CareSetu security policy.
        </p>
        
        ${getFooterStyle()}
      </div>
    </div>
  `;
  return { subject, html };
}

module.exports = {
  hospitalSecurityWarning1,
  hospitalSecurityWarning2,
  hospitalSecurityBlocked,
  hospitalSecurityReviewSubmitted,
  hospitalSecurityUnlocked
};
